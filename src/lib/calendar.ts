import type { AppState, ISODate, Person } from '@/types';
import {
  WEEKDAY_NAMES, addDays, isWeekendDate, monthGridDates, monthKey, shiftMonthKey, today,
} from '@/lib/dates';
import { stepFlag, type Tone } from '@/lib/derive';
import { canSeeProject } from '@/lib/permissions';

/**
 * One calendar for the business.
 *
 * Nothing here is scheduled separately: every entry is a date already recorded
 * somewhere — a step's planned end, a submission's due date, an invoice, a
 * monthly report, the start and end of a contract. Move the date on the record
 * and the calendar moves with it.
 */

export type EventKind =
  | 'Step due'
  | 'Step starts'
  | 'Submission due'
  | 'Invoice'
  | 'Monthly report'
  | 'Project starts'
  | 'Project ends';

export const EVENT_KINDS: EventKind[] = [
  'Step due', 'Step starts', 'Submission due', 'Invoice', 'Monthly report', 'Project starts', 'Project ends',
];

export interface CalendarEvent {
  id: string;
  date: ISODate;
  kind: EventKind;
  title: string;
  detail: string;
  projectId: string;
  projectName: string;
  href: string;
  tone: Tone;
  /** Who it belongs to, where the record names someone. */
  assigneeId: string | null;
  /** Already delivered, acknowledged or paid. */
  done: boolean;
}

export function buildCalendar(state: AppState, person: Person, now: ISODate = today()): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  const projects = state.projects.filter((p) => !p.archived && canSeeProject(state, person, p));

  for (const project of projects) {
    const base = { projectId: project.id, projectName: project.name };

    for (const s of state.steps.filter((x) => x.projectId === project.id)) {
      if (s.status === 'Not applicable') continue;
      const flag = stepFlag(s, now);
      const done = flag === 'Complete';
      if (s.plannedEnd) {
        out.push({
          id: `stepend:${s.id}`, date: s.plannedEnd, kind: 'Step due', ...base,
          title: `${s.step} ${s.action}`,
          detail: s.deliverable || s.phase,
          href: `/projects/${project.id}/plan`,
          tone: done ? 'success' : flag === 'Overdue' || flag === 'Blocked' ? 'danger' : flag === 'Due soon' ? 'warning' : 'neutral',
          assigneeId: s.assigneeId, done,
        });
      }
      // Starts matter for planning the week; completed work no longer does.
      if (s.plannedStart && s.plannedStart !== s.plannedEnd && !done) {
        out.push({
          id: `stepstart:${s.id}`, date: s.plannedStart, kind: 'Step starts', ...base,
          title: `${s.step} ${s.action}`,
          detail: s.phase,
          href: `/projects/${project.id}/plan`,
          tone: 'neutral', assigneeId: s.assigneeId, done: false,
        });
      }
    }

    for (const e of state.registerEntries.filter((x) => x.projectId === project.id)) {
      if (!e.plannedDate || e.status === 'Not applicable') continue;
      const done = e.status === 'Acknowledged';
      out.push({
        id: `sub:${e.id}`, date: e.plannedDate, kind: 'Submission due', ...base,
        title: e.submission,
        detail: `${e.template} · ${e.owner}`,
        href: `/projects/${project.id}/submissions`,
        tone: done ? 'success' : e.status === 'Returned for correction' ? 'danger' : 'warning',
        assigneeId: state.people.find((p) => p.role === e.owner)?.id ?? null,
        done,
      });
    }

    for (const i of state.invoices.filter((x) => x.projectId === project.id)) {
      out.push({
        id: `inv:${i.id}`, date: i.date, kind: 'Invoice', ...base,
        title: `${i.number}`,
        detail: i.periodCovered || i.linkedPhase,
        href: `/projects/${project.id}/reports`,
        tone: i.status === 'Paid' ? 'success' : i.status === 'Queried' ? 'danger' : 'warning',
        assigneeId: project.projectManagerId, done: i.status === 'Paid',
      });
    }

    for (const r of state.monthlyReports.filter((x) => x.projectId === project.id)) {
      out.push({
        id: `mr:${r.id}`, date: `${r.month}-28`, kind: 'Monthly report', ...base,
        title: 'Monthly report due',
        detail: r.lodged ? 'Lodged' : 'Not yet lodged',
        href: `/projects/${project.id}/reports`,
        tone: r.lodged ? 'success' : r.month < monthKey(now) ? 'danger' : 'warning',
        assigneeId: project.projectManagerId, done: r.lodged,
      });
    }

    if (project.startDate) {
      out.push({
        id: `pstart:${project.id}`, date: project.startDate, kind: 'Project starts', ...base,
        title: `${project.name} starts`, detail: project.client,
        href: `/projects/${project.id}`, tone: 'neutral',
        assigneeId: project.projectManagerId, done: project.startDate <= now,
      });
    }
    if (project.contractedCompletion) {
      out.push({
        id: `pend:${project.id}`, date: project.contractedCompletion, kind: 'Project ends', ...base,
        title: `${project.name} contracted completion`, detail: project.client,
        href: `/projects/${project.id}`, tone: 'warning',
        assigneeId: project.projectManagerId, done: false,
      });
    }
  }

  return out.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}

/* ------------------------------------------------------------------ *
 * Month grid
 * ------------------------------------------------------------------ */

export interface CalendarDay {
  date: ISODate;
  inMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
}

/** Six weeks starting Monday, so the grid never changes height month to month. */
export function monthGrid(month: string, events: CalendarEvent[], now: ISODate = today()): CalendarDay[] {
  const byDate = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const list = byDate.get(e.date);
    if (list) list.push(e); else byDate.set(e.date, [e]);
  }
  return monthGridDates(month).map((date) => ({
    date,
    inMonth: date.startsWith(month),
    isToday: date === now,
    events: byDate.get(date) ?? [],
  }));
}

export const shiftMonth = shiftMonthKey;

/** The next `days` of events from today, for the agenda view. */
export function upcoming(events: CalendarEvent[], days = 30, now: ISODate = today()): CalendarEvent[] {
  const end = addDays(now, days);
  return events.filter((e) => e.date >= now && e.date <= end);
}

export function groupByDate(events: CalendarEvent[]): Array<{ date: ISODate; events: CalendarEvent[] }> {
  const map = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const list = map.get(e.date);
    if (list) list.push(e); else map.set(e.date, [e]);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, list]) => ({ date, events: list }));
}

export const WEEKDAYS = WEEKDAY_NAMES;
export const isWeekend = isWeekendDate;
