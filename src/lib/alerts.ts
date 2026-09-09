import type { AppState, ISODate, Person, Project } from '@/types';
import { daysBetween, monthKey, today } from '@/lib/dates';
import {
  canSubmitInvoice, daysLate, stepFlag, submissionRequired, type Tone,
} from '@/lib/derive';
import { canSeeProject } from '@/lib/permissions';
import { formatZAR } from '@/lib/money';
import { formatMonthKey } from '@/lib/dates';

/**
 * Alerts.
 *
 * Every alert is derived from the current data, every time. Nothing is stored,
 * so an alert cannot survive the thing that caused it: fix the step and the
 * alert is gone on the next render. Ids are built from the record and the kind,
 * so they stay stable across renders and "read" sticks to the right thing.
 *
 * Each alert names who it is for. A person sees the ones addressed to them,
 * plus the ones addressed to whoever runs the project they are on.
 */

export type AlertKind =
  | 'Task overdue'
  | 'Task due soon'
  | 'Task not started'
  | 'Task blocked'
  | 'Evidence missing'
  | 'Awaiting acknowledgement'
  | 'Submission returned'
  | 'Submission due'
  | 'Workbook not updated'
  | 'Monthly report due'
  | 'Invoice missing report'
  | 'Invoice queried'
  | 'Project ending';

export interface Alert {
  id: string;
  kind: AlertKind;
  severity: 'critical' | 'warning' | 'info';
  tone: Tone;
  title: string;
  body: string;
  projectId: string;
  projectName: string;
  href: string;
  /** Person ids this is addressed to. Empty means everyone who runs the project. */
  forPersonIds: string[];
  /** Sorts the list; higher is more pressing. */
  weight: number;
  /** The date the alert hangs off, where it has one. */
  date: ISODate;
}

const SEVERITY_TONE: Record<Alert['severity'], Tone> = {
  critical: 'danger', warning: 'warning', info: 'neutral',
};

function make(a: Omit<Alert, 'tone'>): Alert {
  return { ...a, tone: SEVERITY_TONE[a.severity] };
}

/** Whoever runs the project: the alert's fallback audience. */
function runners(project: Project): string[] {
  return [project.projectManagerId, project.projectLeadId].filter(Boolean);
}

export function buildAlerts(state: AppState, now: ISODate = today()): Alert[] {
  const out: Alert[] = [];

  for (const project of state.projects.filter((p) => !p.archived)) {
    const steps = state.steps.filter((s) => s.projectId === project.id);
    const entries = state.registerEntries.filter((e) => e.projectId === project.id);
    const docs = state.documents.filter((d) => d.projectId === project.id);
    const invoices = state.invoices.filter((i) => i.projectId === project.id);
    const owners = runners(project);
    const base = { projectId: project.id, projectName: project.name };

    /* ---- Steps ---- */
    for (const s of steps) {
      if (s.status === 'Not applicable') continue;
      const flag = stepFlag(s, now);
      const who = s.assigneeId ? [s.assigneeId, ...owners] : owners;
      const href = `/projects/${project.id}/plan`;
      const label = `${s.step} ${s.action}`;

      if (flag === 'Overdue') {
        const late = daysLate(s, now);
        out.push(make({
          id: `overdue:${s.id}`, kind: 'Task overdue', severity: 'critical', ...base,
          title: `${late} day${late === 1 ? '' : 's'} overdue`,
          body: label, href, forPersonIds: who, weight: 1000 + late, date: s.plannedEnd,
        }));
      } else if (flag === 'Due soon') {
        const inDays = daysBetween(now, s.plannedEnd) ?? 0;
        out.push(make({
          id: `duesoon:${s.id}`, kind: 'Task due soon', severity: 'warning', ...base,
          title: inDays === 0 ? 'Due today' : `Due in ${inDays} day${inDays === 1 ? '' : 's'}`,
          body: label, href, forPersonIds: who, weight: 600 - inDays, date: s.plannedEnd,
        }));
        if (s.status === 'Not started') {
          out.push(make({
            id: `notstarted:${s.id}`, kind: 'Task not started', severity: 'warning', ...base,
            title: 'Due this week and not started',
            body: label, href, forPersonIds: who, weight: 590 - inDays, date: s.plannedEnd,
          }));
        }
      } else if (flag === 'Blocked') {
        out.push(make({
          id: `blocked:${s.id}`, kind: 'Task blocked', severity: 'critical', ...base,
          title: 'Blocked',
          body: s.notes ? `${label} — ${s.notes}` : label,
          href, forPersonIds: who, weight: 950, date: s.plannedEnd,
        }));
      }

      if (s.status === 'Completed' && submissionRequired(s) && !docs.some((d) => d.stepId === s.id)) {
        out.push(make({
          id: `noevidence:${s.id}`, kind: 'Evidence missing', severity: 'warning', ...base,
          title: 'Marked complete with no evidence filed',
          body: label, href, forPersonIds: who, weight: 700, date: s.actualCompletion,
        }));
      }
      if (flag === 'Awaiting acknowledgement') {
        const waiting = s.dateSubmitted ? daysBetween(s.dateSubmitted, now) ?? 0 : 0;
        out.push(make({
          id: `awaiting:${s.id}`, kind: 'Awaiting acknowledgement', severity: waiting > 14 ? 'warning' : 'info', ...base,
          title: waiting > 0 ? `With the client for ${waiting} days` : 'Waiting on the client to acknowledge',
          body: label, href, forPersonIds: who, weight: 400 + waiting, date: s.dateSubmitted,
        }));
      }
    }

    /* ---- Register ---- */
    for (const e of entries) {
      const href = `/projects/${project.id}/submissions`;
      const who = owners;
      if (e.status === 'Returned for correction') {
        out.push(make({
          id: `returned:${e.id}`, kind: 'Submission returned', severity: 'critical', ...base,
          title: 'Returned for correction',
          body: e.notes ? `${e.submission} — ${e.notes}` : e.submission,
          href, forPersonIds: who, weight: 900, date: e.dateSubmitted,
        }));
      }
      const due = e.plannedDate ? daysBetween(now, e.plannedDate) : null;
      if (due !== null && due >= 0 && due <= 14 && e.status !== 'Acknowledged' && e.status !== 'Not applicable') {
        out.push(make({
          id: `subdue:${e.id}`, kind: 'Submission due', severity: due <= 7 ? 'warning' : 'info', ...base,
          title: due === 0 ? 'Submission due today' : `Submission due in ${due} days`,
          body: e.submission, href, forPersonIds: who, weight: 500 - due, date: e.plannedDate,
        }));
      }
    }

    /* ---- The client's workbook ---- */
    const age = project.departmentalWorkbookUpdated
      ? daysBetween(project.departmentalWorkbookUpdated, now)
      : null;
    if (age === null || age > 7) {
      out.push(make({
        id: `workbook:${project.id}`,
        kind: 'Workbook not updated',
        severity: age !== null && age > 14 ? 'critical' : 'warning',
        ...base,
        title: age === null ? 'Client workbook never recorded' : `Client workbook is ${age} days old`,
        body: "This system does not replace the client's project plan workbook. Bring it up to date and record when you did.",
        href: `/projects/${project.id}/setup`,
        forPersonIds: owners, weight: age !== null && age > 14 ? 800 : 450,
        date: project.departmentalWorkbookUpdated,
      }));
    }

    /* ---- Money and monthly reporting ---- */
    for (const i of invoices) {
      if (!canSubmitInvoice(i, docs).allowed) {
        out.push(make({
          id: `invnoreport:${i.id}`, kind: 'Invoice missing report', severity: 'warning', ...base,
          title: `${i.number} has no progress report`,
          body: `${formatZAR(i.amount)} — the department returns invoices that arrive without one.`,
          href: `/projects/${project.id}/reports`, forPersonIds: owners, weight: 650, date: i.date,
        }));
      }
      if (i.status === 'Queried') {
        out.push(make({
          id: `invqueried:${i.id}`, kind: 'Invoice queried', severity: 'warning', ...base,
          title: `${i.number} has been queried`,
          body: `${formatZAR(i.amount)} is not moving until the query is answered.`,
          href: `/projects/${project.id}/reports`, forPersonIds: owners, weight: 640, date: i.date,
        }));
      }
    }

    for (const r of state.monthlyReports) {
      if (r.projectId !== project.id || r.lodged) continue;
      if (r.month >= monthKey(now)) continue;
      out.push(make({
        id: `report:${r.id}`, kind: 'Monthly report due', severity: 'warning', ...base,
        title: `${formatMonthKey(r.month)} monthly report not lodged`,
        body: 'The support period requires a report every month.',
        href: `/projects/${project.id}/reports`, forPersonIds: owners, weight: 620, date: `${r.month}-28`,
      }));
    }

    /* ---- Contract running out ---- */
    const toEnd = project.contractedCompletion ? daysBetween(now, project.contractedCompletion) : null;
    if (toEnd !== null && toEnd >= 0 && toEnd <= 90) {
      out.push(make({
        id: `ending:${project.id}`, kind: 'Project ending', severity: toEnd <= 30 ? 'warning' : 'info', ...base,
        title: `Contract ends in ${toEnd} days`,
        body: 'Closure begins three months before contract end: final report and the full documentation set.',
        href: `/projects/${project.id}`, forPersonIds: owners, weight: 300, date: project.contractedCompletion,
      }));
    }
  }

  return out.sort((a, b) => b.weight - a.weight);
}

/**
 * The alerts this person should see, in the order they should see them. A
 * director watches the whole portfolio, so they get everything; everyone else
 * gets what is addressed to them on a project they are on.
 */
export function alertsFor(state: AppState, person: Person, now: ISODate = today()): Alert[] {
  return buildAlerts(state, now).filter((a) => {
    const project = state.projects.find((p) => p.id === a.projectId);
    if (!project || !canSeeProject(state, person, project)) return false;
    if (person.accessRole === 'Director') return true;
    return a.forPersonIds.length === 0 || a.forPersonIds.includes(person.id);
  });
}

export function unreadCount(alerts: Alert[], readIds: string[]): number {
  const read = new Set(readIds);
  return alerts.filter((a) => !read.has(a.id)).length;
}

/** A one-line summary for the top of the day. */
export function digest(alerts: Alert[]): { critical: number; warning: number; total: number } {
  return {
    critical: alerts.filter((a) => a.severity === 'critical').length,
    warning: alerts.filter((a) => a.severity === 'warning').length,
    total: alerts.length,
  };
}
