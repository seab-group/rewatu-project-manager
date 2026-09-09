import type {
  AppState, DeliveryStep, DocumentRecord, Flag, Health, Invoice, Project, RegisterEntry,
} from '@/types';
import { addDays, daysBetween, inclusiveDays, monthKey, monthRange, parseISO, today } from '@/lib/dates';
import { pct, round2 } from '@/lib/money';
import { PHASES } from '@/data/reference';

export type Tone = 'success' | 'warning' | 'danger' | 'neutral';

/* ------------------------------------------------------------------ *
 * Step-level derivation
 * ------------------------------------------------------------------ */

/**
 * Days late.
 * Completed  -> planned end to actual completion, never below zero.
 * Otherwise  -> days since a planned end that has already passed.
 * Everything else is zero.
 */
export function daysLate(step: DeliveryStep, now = today()): number {
  if (step.status === 'Completed') {
    if (!step.plannedEnd || !step.actualCompletion) return 0;
    return Math.max(0, daysBetween(step.plannedEnd, step.actualCompletion) ?? 0);
  }
  if (!step.plannedEnd) return 0;
  const overdueBy = daysBetween(step.plannedEnd, now) ?? 0;
  return Math.max(0, overdueBy);
}

/**
 * The flag. This is the point of the whole system: a step is not complete
 * because someone ticked Completed. It is complete when the deliverable exists
 * and, where a submission was required, the client has acknowledged it.
 */
export function stepFlag(step: DeliveryStep, now = today()): Flag {
  if (!step.action.trim()) return '';

  const submissionCleared =
    step.submission === 'Not required' ||
    (step.submission as string) === 'Not applicable' ||
    step.acknowledged === 'Yes';

  if (step.status === 'Completed' && submissionCleared) return 'Complete';
  if (step.status === 'Completed' && step.submission !== 'Not required') return 'Awaiting acknowledgement';
  if (step.status === 'Blocked') return 'Blocked';
  if (step.status === 'On hold') return 'On hold';
  if (!step.plannedEnd) return 'No date';

  const daysToEnd = daysBetween(now, step.plannedEnd);
  if (daysToEnd === null) return 'No date';
  if (daysToEnd < 0) return 'Overdue';
  if (daysToEnd <= 7) return 'Due soon';
  return 'On track';
}

export function flagTone(flag: Flag): Tone {
  switch (flag) {
    case 'Complete': return 'success';
    case 'Awaiting acknowledgement': return 'warning';
    case 'Due soon': return 'warning';
    case 'Blocked': return 'danger';
    case 'Overdue': return 'danger';
    default: return 'neutral';
  }
}

export function statusTone(status: DeliveryStep['status']): Tone {
  switch (status) {
    case 'Completed': return 'success';
    case 'In progress': return 'warning';
    case 'Blocked': return 'danger';
    default: return 'neutral';
  }
}

export function submissionTone(s: string): Tone {
  switch (s) {
    case 'Acknowledged': return 'success';
    case 'Submitted': return 'warning';
    case 'Prepared': return 'warning';
    case 'Returned for correction': return 'danger';
    default: return 'neutral';
  }
}

export function stepDays(step: DeliveryStep): number | null {
  if (!step.plannedStart || !step.plannedEnd) return null;
  return inclusiveDays(step.plannedStart, step.plannedEnd);
}

/** A submission is required unless the step says it is not. */
export function submissionRequired(step: DeliveryStep): boolean {
  return step.submission !== 'Not required';
}

/* ------------------------------------------------------------------ *
 * Gating rules — the rules that stop the spreadsheet lying
 * ------------------------------------------------------------------ */

export interface GateResult { allowed: boolean; reason: string }

/**
 * A step with a required submission may only be marked Completed once an
 * evidence file exists. Acknowledgement is what turns it into a green flag.
 */
export function canCompleteStep(step: DeliveryStep, docs: DocumentRecord[]): GateResult {
  if (!submissionRequired(step)) return { allowed: true, reason: '' };
  const hasEvidence = docs.some((d) => d.stepId === step.id);
  if (!hasEvidence) {
    return {
      allowed: false,
      reason:
        'This step carries a submission to the client, so it needs an evidence file before it can be marked Completed. Attach the deliverable in the Evidence column, then set the status.',
    };
  }
  return { allowed: true, reason: '' };
}

/** A submission cannot be marked Submitted without a file attached. */
export function canSubmitRegisterEntry(entry: RegisterEntry, docs: DocumentRecord[]): GateResult {
  const hasFile = docs.some((d) => d.registerEntryId === entry.id);
  if (!hasFile) {
    return {
      allowed: false,
      reason:
        'Attach the file that was sent to the client before marking this Submitted. The register records what actually left the building, not what was intended.',
    };
  }
  return { allowed: true, reason: '' };
}

/** An invoice cannot be marked Submitted without a progress report attached. */
export function canSubmitInvoice(invoice: Invoice, docs: DocumentRecord[]): GateResult {
  const hasReport = invoice.progressReportAttached || docs.some((d) => d.invoiceId === invoice.id);
  if (!hasReport) {
    return {
      allowed: false,
      reason:
        'The client returns invoices that arrive without a progress report. Attach the report before marking this Submitted.',
    };
  }
  return { allowed: true, reason: '' };
}

/* ------------------------------------------------------------------ *
 * Project-level metrics
 * ------------------------------------------------------------------ */

export interface DeliveryMetrics {
  total: number;
  completed: number;
  completedPct: number;
  inProgress: number;
  notStarted: number;
  onHold: number;
  notApplicable: number;
  overdue: number;
  blocked: number;
  dueWithin7: number;
  awaitingAcknowledgement: number;
}

export interface TimeMetrics {
  start: string;
  end: string;
  today: string;
  daysRemaining: number | null;
  totalDays: number | null;
  elapsedPct: number;
  scheduleVariance: number;
  totalDaysLate: number;
}

export interface MoneyMetrics {
  contractValue: number;
  invoiced: number;
  paid: number;
  outstanding: number;
  stillToInvoice: number;
  invoicedPct: number;
  costBudget: number | null;
}

export interface SubmissionMetrics {
  required: number;
  acknowledged: number;
  awaiting: number;
  returned: number;
  notYetDue: number;
  acknowledgedPct: number;
}

export interface AttentionMetrics {
  doneNotAcknowledged: number;
  noPlannedEnd: number;
  noResponsible: number;
  completedNoEvidence: number;
  workbookAgeDays: number | null;
}

export interface ProjectMetrics {
  project: Project;
  delivery: DeliveryMetrics;
  time: TimeMetrics;
  money: MoneyMetrics;
  submissions: SubmissionMetrics;
  attention: AttentionMetrics;
  health: Health;
  healthReason: string;
  phaseReached: string;
  nextSubmissionDue: { label: string; date: string } | null;
}

/** Steps marked Not applicable are excluded from the denominator — they are not work. */
function countableSteps(steps: DeliveryStep[]): DeliveryStep[] {
  return steps.filter((s) => s.status !== 'Not applicable');
}

export function deliveryMetrics(steps: DeliveryStep[], now = today()): DeliveryMetrics {
  const countable = countableSteps(steps);
  const total = countable.length;
  const completed = countable.filter((s) => s.status === 'Completed').length;
  let overdue = 0;
  let dueWithin7 = 0;
  let awaiting = 0;
  for (const s of countable) {
    const f = stepFlag(s, now);
    if (f === 'Overdue') overdue += 1;
    if (f === 'Due soon') dueWithin7 += 1;
    if (f === 'Awaiting acknowledgement') awaiting += 1;
  }
  return {
    total,
    completed,
    completedPct: pct(completed, total),
    inProgress: countable.filter((s) => s.status === 'In progress').length,
    notStarted: countable.filter((s) => s.status === 'Not started').length,
    onHold: countable.filter((s) => s.status === 'On hold').length,
    notApplicable: steps.length - countable.length,
    overdue,
    blocked: countable.filter((s) => s.status === 'Blocked').length,
    dueWithin7,
    awaitingAcknowledgement: awaiting,
  };
}

export function timeMetrics(project: Project, steps: DeliveryStep[], now = today()): TimeMetrics {
  const totalDays = daysBetween(project.startDate, project.contractedCompletion);
  const elapsed = daysBetween(project.startDate, now);
  const daysRemaining = daysBetween(now, project.contractedCompletion);
  const elapsedPct =
    totalDays && totalDays > 0 && elapsed !== null
      ? Math.max(0, Math.min(100, Math.round((elapsed / totalDays) * 100)))
      : 0;
  const completedPct = deliveryMetrics(steps, now).completedPct;
  return {
    start: project.startDate,
    end: project.contractedCompletion,
    today: now,
    daysRemaining,
    totalDays,
    elapsedPct,
    scheduleVariance: completedPct - elapsedPct,
    totalDaysLate: steps.reduce((sum, s) => sum + daysLate(s, now), 0),
  };
}

export function moneyMetrics(project: Project, invoices: Invoice[]): MoneyMetrics {
  const mine = invoices.filter((i) => i.projectId === project.id);
  // "Invoiced" counts everything that has left our office, queried or not.
  const invoiced = round2(mine.reduce((s, i) => s + i.amount, 0));
  const paid = round2(mine.filter((i) => i.status === 'Paid').reduce((s, i) => s + i.amount, 0));
  return {
    contractValue: project.contractValue,
    invoiced,
    paid,
    outstanding: round2(invoiced - paid),
    stillToInvoice: round2(Math.max(0, project.contractValue - invoiced)),
    invoicedPct: pct(invoiced, project.contractValue),
    costBudget: project.costBudget,
  };
}

export function submissionMetrics(entries: RegisterEntry[]): SubmissionMetrics {
  const required = entries.filter((e) => e.status !== 'Not applicable').length;
  const acknowledged = entries.filter((e) => e.status === 'Acknowledged').length;
  return {
    required,
    acknowledged,
    awaiting: entries.filter((e) => e.status === 'Submitted').length,
    returned: entries.filter((e) => e.status === 'Returned for correction').length,
    notYetDue: entries.filter((e) => e.status === 'Not started' || e.status === 'Prepared').length,
    acknowledgedPct: pct(acknowledged, required),
  };
}

export function attentionMetrics(
  project: Project, steps: DeliveryStep[], docs: DocumentRecord[], now = today(),
): AttentionMetrics {
  const completed = steps.filter((s) => s.status === 'Completed');
  return {
    doneNotAcknowledged: completed.filter(
      (s) => submissionRequired(s) && s.acknowledged !== 'Yes',
    ).length,
    noPlannedEnd: steps.filter((s) => s.status !== 'Not applicable' && !s.plannedEnd).length,
    noResponsible: steps.filter((s) => !s.responsible).length,
    completedNoEvidence: completed.filter(
      (s) => submissionRequired(s) && !docs.some((d) => d.stepId === s.id),
    ).length,
    workbookAgeDays: project.departmentalWorkbookUpdated
      ? daysBetween(project.departmentalWorkbookUpdated, now)
      : null,
  };
}

/**
 * Health. At risk whenever any step is overdue or blocked. Otherwise On track
 * or Behind schedule according to whether completion keeps pace with elapsed
 * contract time — five points of slack, so a project is not called out for
 * rounding.
 */
const SCHEDULE_SLACK = 5;

export function projectHealth(delivery: DeliveryMetrics, time: TimeMetrics): { health: Health; reason: string } {
  if (delivery.overdue > 0 || delivery.blocked > 0) {
    const parts: string[] = [];
    if (delivery.overdue) parts.push(`${delivery.overdue} step${delivery.overdue === 1 ? '' : 's'} overdue`);
    if (delivery.blocked) parts.push(`${delivery.blocked} blocked`);
    return { health: 'At risk', reason: parts.join(', ') };
  }
  if (time.scheduleVariance < -SCHEDULE_SLACK) {
    return {
      health: 'Behind schedule',
      reason: `${delivery.completedPct}% complete against ${time.elapsedPct}% of contract time elapsed`,
    };
  }
  return {
    health: 'On track',
    reason: `${delivery.completedPct}% complete against ${time.elapsedPct}% of contract time elapsed`,
  };
}

export function healthTone(h: Health): Tone {
  if (h === 'At risk') return 'danger';
  if (h === 'Behind schedule') return 'warning';
  return 'success';
}

/** The furthest phase with any work started; falls back to the first phase. */
export function phaseReached(steps: DeliveryStep[]): string {
  let reached = PHASES[0] as string;
  for (const phase of PHASES) {
    const inPhase = steps.filter((s) => s.phase === phase);
    if (inPhase.some((s) => s.status !== 'Not started' && s.status !== 'Not applicable')) {
      reached = phase;
    }
  }
  return reached;
}

export function nextSubmissionDue(
  entries: RegisterEntry[], now = today(),
): { label: string; date: string } | null {
  const open = entries
    .filter((e) => e.status !== 'Acknowledged' && e.status !== 'Not applicable' && e.plannedDate)
    .sort((a, b) => a.plannedDate.localeCompare(b.plannedDate));
  const next = open.find((e) => e.plannedDate >= now) ?? open[0];
  return next ? { label: next.submission, date: next.plannedDate } : null;
}

export function projectMetrics(state: AppState, project: Project, now = today()): ProjectMetrics {
  const steps = state.steps.filter((s) => s.projectId === project.id);
  const entries = state.registerEntries.filter((e) => e.projectId === project.id);
  const docs = state.documents.filter((d) => d.projectId === project.id);
  const delivery = deliveryMetrics(steps, now);
  const time = timeMetrics(project, steps, now);
  const { health, reason } = projectHealth(delivery, time);
  return {
    project,
    delivery,
    time,
    money: moneyMetrics(project, state.invoices),
    submissions: submissionMetrics(entries),
    attention: attentionMetrics(project, steps, docs, now),
    health,
    healthReason: reason,
    phaseReached: phaseReached(steps),
    nextSubmissionDue: nextSubmissionDue(entries, now),
  };
}

/* ------------------------------------------------------------------ *
 * Portfolio-level rollup
 * ------------------------------------------------------------------ */

export interface PhaseProgress { phase: string; complete: number; remaining: number; total: number }

export function phaseProgress(steps: DeliveryStep[], now = today()): PhaseProgress[] {
  return PHASES.map((phase) => {
    const inPhase = steps.filter((s) => s.phase === phase && s.status !== 'Not applicable');
    const complete = inPhase.filter((s) => stepFlag(s, now) === 'Complete').length;
    return { phase, complete, remaining: inPhase.length - complete, total: inPhase.length };
  });
}

export interface CashPoint { month: string; invoiced: number; paid: number; invoicedInMonth: number; paidInMonth: number }

/**
 * The cash position by month: invoiced and paid, accumulated. Billing is lumpy
 * — most months carry no invoice at all — so plotting the raw monthly figure
 * gives a line that drops to zero between milestones and reads as noise. The
 * running total is what "position" means, and the month's own figure stays on
 * the point for the tooltip.
 */
export function cashPosition(invoices: Invoice[], months: number = 12, now = today()): CashPoint[] {
  const start = addDays(now, -Math.round(months * 30.44));
  const keys = monthRange(start, now);
  const firstKey = keys[0] ?? monthKey(now);

  // Anything billed before the window still counts towards the position.
  let invoiced = invoices
    .filter((i) => monthKey(i.date) < firstKey)
    .reduce((s, i) => s + i.amount, 0);
  let paid = invoices
    .filter((i) => i.status === 'Paid' && i.datePaid && monthKey(i.datePaid) < firstKey)
    .reduce((s, i) => s + i.amount, 0);

  return keys.map((key) => {
    const invoicedInMonth = invoices
      .filter((i) => monthKey(i.date) === key)
      .reduce((s, i) => s + i.amount, 0);
    const paidInMonth = invoices
      .filter((i) => i.status === 'Paid' && monthKey(i.datePaid) === key)
      .reduce((s, i) => s + i.amount, 0);
    invoiced = round2(invoiced + invoicedInMonth);
    paid = round2(paid + paidInMonth);
    return { month: key, invoiced, paid, invoicedInMonth, paidInMonth };
  });
}

/**
 * Forecast to invoice. Derived from the phases due inside each window: the value
 * still to invoice, apportioned by the share of remaining steps whose planned end
 * falls in the window.
 */
export function forecastToInvoice(
  state: AppState, projects: Project[], now = today(),
): { d30: number; d60: number; d90: number } {
  const out = { d30: 0, d60: 0, d90: 0 };
  for (const project of projects) {
    const steps = state.steps.filter(
      (s) => s.projectId === project.id && s.status !== 'Completed' && s.status !== 'Not applicable',
    );
    const stillToInvoice = moneyMetrics(project, state.invoices).stillToInvoice;
    if (!stillToInvoice || steps.length === 0) continue;
    const perStep = stillToInvoice / steps.length;
    for (const s of steps) {
      if (!s.plannedEnd) continue;
      const d = daysBetween(now, s.plannedEnd);
      if (d === null) continue;
      if (d <= 30) out.d30 += perStep;
      if (d <= 60) out.d60 += perStep;
      if (d <= 90) out.d90 += perStep;
    }
  }
  return { d30: round2(out.d30), d60: round2(out.d60), d90: round2(out.d90) };
}

export interface PortfolioMetrics {
  activeProjects: number;
  byHealth: Record<Health, number>;
  overdueSteps: number;
  awaitingAcknowledgement: number;
  documentsOutstanding: number;
  monthlyReportsOutstanding: number;
  contractValue: number;
  invoiced: number;
  paid: number;
  outstanding: number;
  stillToInvoice: number;
  costBudget: number;
  spendAgainstBudget: number;
  forecast: { d30: number; d60: number; d90: number };
  perProject: ProjectMetrics[];
}

export function portfolioMetrics(state: AppState, now = today()): PortfolioMetrics {
  const active = state.projects.filter((p) => !p.archived);
  const perProject = active.map((p) => projectMetrics(state, p, now));

  const byHealth: Record<Health, number> = { 'On track': 0, 'Behind schedule': 0, 'At risk': 0 };
  for (const m of perProject) byHealth[m.health] += 1;

  // Only projects with a budget captured contribute to either side of the
  // spend-against-budget figure, so the comparison stays like for like.
  const budgeted = active.filter((p) => p.costBudget != null);
  const costBudget = budgeted.reduce((s, p) => s + (p.costBudget ?? 0), 0);

  return {
    activeProjects: active.length,
    byHealth,
    overdueSteps: perProject.reduce((s, m) => s + m.delivery.overdue, 0),
    awaitingAcknowledgement: perProject.reduce((s, m) => s + m.submissions.awaiting, 0),
    documentsOutstanding: perProject.reduce((s, m) => s + m.attention.completedNoEvidence, 0),
    monthlyReportsOutstanding: monthlyReportsOutstanding(state, now).length,
    contractValue: round2(perProject.reduce((s, m) => s + m.money.contractValue, 0)),
    invoiced: round2(perProject.reduce((s, m) => s + m.money.invoiced, 0)),
    paid: round2(perProject.reduce((s, m) => s + m.money.paid, 0)),
    outstanding: round2(perProject.reduce((s, m) => s + m.money.outstanding, 0)),
    stillToInvoice: round2(perProject.reduce((s, m) => s + m.money.stillToInvoice, 0)),
    costBudget,
    spendAgainstBudget: budgeted.reduce((s, p) => s + (p.costToDate ?? 0), 0),
    forecast: forecastToInvoice(state, active, now),
    perProject,
  };
}

/* ------------------------------------------------------------------ *
 * Attention list
 * ------------------------------------------------------------------ */

export type AttentionKind =
  | 'Overdue step' | 'Blocked step' | 'Returned for correction'
  | 'Missing evidence' | 'Workbook stale' | 'Monthly report outstanding';

export interface AttentionItem {
  id: string;
  kind: AttentionKind;
  projectId: string;
  projectName: string;
  what: string;
  detail: string;
  tone: Tone;
  /** Higher sorts first. */
  weight: number;
  href: string;
}

export function attentionList(state: AppState, projectId?: string, now = today()): AttentionItem[] {
  const items: AttentionItem[] = [];
  const projects = state.projects.filter(
    (p) => !p.archived && (!projectId || p.id === projectId),
  );

  for (const project of projects) {
    const steps = state.steps.filter((s) => s.projectId === project.id);
    const docs = state.documents.filter((d) => d.projectId === project.id);
    const entries = state.registerEntries.filter((e) => e.projectId === project.id);

    for (const s of steps) {
      // Not applicable is not work; the flag rules still run on it, but it has
      // no business appearing on anyone's list for today.
      if (s.status === 'Not applicable') continue;
      const flag = stepFlag(s, now);
      if (flag === 'Overdue') {
        items.push({
          id: `overdue-${s.id}`, kind: 'Overdue step', projectId: project.id, projectName: project.name,
          what: `${s.step} ${s.action}`,
          detail: `${daysLate(s, now)} days past planned end`,
          tone: 'danger', weight: 100 + daysLate(s, now),
          href: `/projects/${project.id}/plan`,
        });
      }
      if (flag === 'Blocked') {
        items.push({
          id: `blocked-${s.id}`, kind: 'Blocked step', projectId: project.id, projectName: project.name,
          what: `${s.step} ${s.action}`,
          detail: s.notes || 'No blocker recorded',
          tone: 'danger', weight: 95,
          href: `/projects/${project.id}/plan`,
        });
      }
      if (s.status === 'Completed' && submissionRequired(s) && !docs.some((d) => d.stepId === s.id)) {
        items.push({
          id: `noevidence-${s.id}`, kind: 'Missing evidence', projectId: project.id, projectName: project.name,
          what: `${s.step} ${s.action}`,
          detail: 'Marked complete with no evidence file attached',
          tone: 'warning', weight: 70,
          href: `/projects/${project.id}/plan`,
        });
      }
    }

    for (const e of entries) {
      if (e.status === 'Returned for correction') {
        items.push({
          id: `returned-${e.id}`, kind: 'Returned for correction', projectId: project.id, projectName: project.name,
          what: e.submission,
          detail: e.notes || 'Returned by the client; correction outstanding',
          tone: 'danger', weight: 90,
          href: `/projects/${project.id}/submissions`,
        });
      }
    }

    const age = project.departmentalWorkbookUpdated
      ? daysBetween(project.departmentalWorkbookUpdated, now)
      : null;
    if (age !== null && age > 7) {
      items.push({
        id: `workbook-${project.id}`, kind: 'Workbook stale', projectId: project.id, projectName: project.name,
        what: "Client's project plan workbook",
        detail: `Not updated for ${age} days`,
        tone: age > 14 ? 'danger' : 'warning', weight: age > 14 ? 85 : 60,
        href: `/projects/${project.id}/setup`,
      });
    }
  }

  for (const r of monthlyReportsOutstanding(state, now, projectId)) {
    const project = state.projects.find((p) => p.id === r.projectId)!;
    items.push({
      id: `report-${r.id}`, kind: 'Monthly report outstanding', projectId: project.id, projectName: project.name,
      what: `Monthly report, ${r.month}`,
      detail: 'Support period month with no report lodged',
      tone: 'warning', weight: 55,
      href: `/projects/${project.id}/reports`,
    });
  }

  return items.sort((a, b) => b.weight - a.weight);
}

export function monthlyReportsOutstanding(state: AppState, now = today(), projectId?: string) {
  return state.monthlyReports.filter((r) => {
    if (projectId && r.projectId !== projectId) return false;
    const project = state.projects.find((p) => p.id === r.projectId);
    if (!project || project.archived) return false;
    // A month's report is outstanding only once the month itself has passed.
    return !r.lodged && r.month < monthKey(now);
  });
}

/** Documents that exist for a project, newest version first. */
export function documentsForStep(docs: DocumentRecord[], stepId: string): DocumentRecord[] {
  return docs.filter((d) => d.stepId === stepId);
}

export function isDateOrderValid(start: string, end: string): boolean {
  if (!start || !end) return true;
  const a = parseISO(start);
  const b = parseISO(end);
  if (!a || !b) return true;
  return b.getTime() >= a.getTime();
}
