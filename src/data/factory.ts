import { DELIVERY_PLAN_TEMPLATE, SUBMISSIONS_TEMPLATE } from '@/data/templates';
import type { DeliveryStep, Project, RegisterEntry, Responsible } from '@/types';
import { addDays, daysBetween } from '@/lib/dates';

export const TEMPLATE_STEP_COUNT = DELIVERY_PLAN_TEMPLATE.length;
export const TEMPLATE_REGISTER_COUNT = SUBMISSIONS_TEMPLATE.length;

let counter = 0;
export function uid(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`;
}

/**
 * Build a project's delivery plan from the standard template. Every new project
 * arrives fully formed: 55 steps, in template order, status "Not started",
 * dates blank. The team edits its own copy afterwards.
 */
export function instantiateDeliveryPlan(projectId: string, idPrefix = ''): DeliveryStep[] {
  return DELIVERY_PLAN_TEMPLATE.map((row, i) => ({
    id: idPrefix ? `${idPrefix}-s${i}` : uid('step'),
    projectId,
    order: i,
    phase: row.phase,
    step: row.step,
    action: row.action,
    deliverable: row.deliverable,
    responsible: row.responsible as Responsible,
    assigneeId: null,
    evidenceLink: '',
    plannedStart: '',
    plannedEnd: '',
    actualCompletion: '',
    status: 'Not started',
    percentComplete: 0,
    submission: row.submission as DeliveryStep['submission'],
    dateSubmitted: '',
    acknowledged: row.submission === 'Not required' ? 'Not applicable' : 'No',
    notes: '',
  }));
}

export function instantiateRegister(projectId: string, idPrefix = ''): RegisterEntry[] {
  return SUBMISSIONS_TEMPLATE.map((row, i) => ({
    id: idPrefix ? `${idPrefix}-r${i}` : uid('reg'),
    projectId,
    order: i,
    phase: row.phase,
    submission: row.submission,
    template: row.template,
    signedBy: row.signedBy,
    owner: row.owner,
    plannedDate: '',
    dateSubmitted: '',
    acknowledgedOn: '',
    status: 'Not started',
    notes: '',
  }));
}

/**
 * Spread planned dates evenly across the contract term. A new project gets a
 * workable first draft of a schedule rather than 55 blank date cells; the PM
 * then moves what needs moving.
 */
export function scheduleSteps(steps: DeliveryStep[], start: string, end: string): DeliveryStep[] {
  const span = daysBetween(start, end);
  if (!span || span <= 0) return steps;
  const per = span / steps.length;
  return steps.map((s, i) => ({
    ...s,
    plannedStart: addDays(start, Math.round(i * per)),
    plannedEnd: addDays(start, Math.max(Math.round((i + 1) * per) - 1, Math.round(i * per))),
  }));
}

/** Each register entry is due when the last step of its phase is due. */
export function scheduleRegister(entries: RegisterEntry[], steps: DeliveryStep[]): RegisterEntry[] {
  return entries.map((e) => {
    const inPhase = steps.filter((s) => s.phase.startsWith(`${e.phase} `));
    const last = inPhase[inPhase.length - 1];
    return { ...e, plannedDate: last?.plannedEnd ?? '' };
  });
}

export function emptyProject(): Omit<Project, 'id' | 'createdAt'> {
  return {
    name: '', client: '', contractRef: '', serviceScheduleRef: '', deliveryTier: '1',
    projectManagerId: '', projectLeadId: '', projectEmail: '',
    clientProjectManager: '', clientBusinessOwner: '',
    startDate: '', contractedCompletion: '', contractValue: 0, currency: 'ZAR',
    supportPeriodMonths: 12, costBudget: null, costToDate: null,
    systemRepositoryLocation: '', workingDocumentLocation: '', approvedDocumentLocation: '',
    departmentalWorkbookUpdated: '', thisWorkbookUpdated: '',
    archived: false,
  };
}
