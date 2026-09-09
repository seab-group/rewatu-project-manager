import type { AppState, DeliveryStep, Flag, ISODate, Person } from '@/types';
import { daysBetween, today } from '@/lib/dates';
import { canCompleteStep, daysLate, stepFlag, submissionRequired, type Tone } from '@/lib/derive';
import { canSeeProject, leadsProject } from '@/lib/permissions';

/**
 * Tasks.
 *
 * A task is not a separate record. It is a delivery plan step with someone's
 * name on it — so working a task edits the plan directly, and the two can never
 * disagree. Assigning work is done in the plan; doing the work is done here.
 */

export type TaskBucket =
  | 'Overdue'
  | 'Due today'
  | 'Due this week'
  | 'Later'
  | 'Waiting on the client'
  | 'Blocked'
  | 'Done';

export interface Task {
  step: DeliveryStep;
  projectId: string;
  projectName: string;
  client: string;
  flag: Flag;
  bucket: TaskBucket;
  daysLate: number;
  /** Days until the planned end. Negative once it has passed; null with no date. */
  dueInDays: number | null;
  hasEvidence: boolean;
  /** Why this cannot be marked complete yet, if it cannot. */
  blockedFromCompleting: string;
  assigneeId: string | null;
  tone: Tone;
  weight: number;
}

const BUCKET_TONE: Record<TaskBucket, Tone> = {
  Overdue: 'danger',
  Blocked: 'danger',
  'Due today': 'warning',
  'Due this week': 'warning',
  'Waiting on the client': 'warning',
  Later: 'neutral',
  Done: 'success',
};

export const BUCKET_ORDER: TaskBucket[] = [
  'Overdue', 'Blocked', 'Due today', 'Due this week', 'Waiting on the client', 'Later', 'Done',
];

function bucketFor(step: DeliveryStep, flag: Flag, dueInDays: number | null): TaskBucket {
  if (flag === 'Complete') return 'Done';
  if (flag === 'Awaiting acknowledgement') return 'Waiting on the client';
  if (step.status === 'Blocked') return 'Blocked';
  if (flag === 'Overdue') return 'Overdue';
  if (dueInDays === 0) return 'Due today';
  if (dueInDays !== null && dueInDays > 0 && dueInDays <= 7) return 'Due this week';
  return 'Later';
}

function toTask(state: AppState, step: DeliveryStep, now: ISODate): Task | null {
  const project = state.projects.find((p) => p.id === step.projectId);
  if (!project || project.archived) return null;

  const flag = stepFlag(step, now);
  const dueInDays = step.plannedEnd ? daysBetween(now, step.plannedEnd) : null;
  const bucket = bucketFor(step, flag, dueInDays);
  const docs = state.documents.filter((d) => d.projectId === project.id);
  const gate = canCompleteStep(step, docs);

  const order = BUCKET_ORDER.indexOf(bucket);
  return {
    step,
    projectId: project.id,
    projectName: project.name,
    client: project.client,
    flag,
    bucket,
    daysLate: daysLate(step, now),
    dueInDays,
    hasEvidence: docs.some((d) => d.stepId === step.id),
    blockedFromCompleting: gate.allowed ? '' : gate.reason,
    assigneeId: step.assigneeId,
    tone: BUCKET_TONE[bucket],
    // Earliest bucket first, then soonest due inside it.
    weight: (BUCKET_ORDER.length - order) * 10000 - (dueInDays ?? 9999),
  };
}

/** Everything assigned to this person, across every project they can see. */
export function tasksFor(state: AppState, person: Person, now: ISODate = today()): Task[] {
  return state.steps
    .filter((s) => s.assigneeId === person.id && s.status !== 'Not applicable')
    .map((s) => toTask(state, s, now))
    .filter((t): t is Task => t !== null)
    .sort((a, b) => b.weight - a.weight);
}

/**
 * Everything on the projects this person runs — theirs and everyone else's.
 * Only for people who actually run a project.
 */
export function teamTasks(state: AppState, person: Person, now: ISODate = today()): Task[] {
  const projectIds = new Set(
    state.projects
      .filter((p) => !p.archived && canSeeProject(state, person, p)
        && (person.accessRole === 'Director' || leadsProject(person, p)))
      .map((p) => p.id),
  );
  return state.steps
    .filter((s) => projectIds.has(s.projectId) && s.status !== 'Not applicable')
    .map((s) => toTask(state, s, now))
    .filter((t): t is Task => t !== null)
    .sort((a, b) => b.weight - a.weight);
}

export function groupByBucket(tasks: Task[]): Array<{ bucket: TaskBucket; tasks: Task[] }> {
  return BUCKET_ORDER
    .map((bucket) => ({ bucket, tasks: tasks.filter((t) => t.bucket === bucket) }))
    .filter((g) => g.tasks.length > 0);
}

export interface TaskCounts {
  total: number; open: number; overdue: number; dueThisWeek: number;
  blocked: number; waiting: number; done: number;
}

export function countTasks(tasks: Task[]): TaskCounts {
  return {
    total: tasks.length,
    open: tasks.filter((t) => t.bucket !== 'Done').length,
    overdue: tasks.filter((t) => t.bucket === 'Overdue').length,
    dueThisWeek: tasks.filter((t) => t.bucket === 'Due today' || t.bucket === 'Due this week').length,
    blocked: tasks.filter((t) => t.bucket === 'Blocked').length,
    waiting: tasks.filter((t) => t.bucket === 'Waiting on the client').length,
    done: tasks.filter((t) => t.bucket === 'Done').length,
  };
}

/* ------------------------------------------------------------------ *
 * What to do next
 * ------------------------------------------------------------------ */

export type NextAction =
  | { kind: 'start'; label: string; hint: string }
  | { kind: 'upload'; label: string; hint: string }
  | { kind: 'complete'; label: string; hint: string }
  | { kind: 'submit'; label: string; hint: string }
  | { kind: 'unblock'; label: string; hint: string }
  | { kind: 'wait'; label: string; hint: string }
  | { kind: 'none'; label: string; hint: string };

/**
 * The single next thing this task needs. This is the whole point of the tasks
 * page: rather than showing someone a status drop-down and hoping, say what the
 * step actually needs from them now.
 */
export function nextAction(task: Task): NextAction {
  const s = task.step;

  if (s.status === 'Blocked') {
    return {
      kind: 'unblock',
      label: 'Update the blocker',
      hint: 'Record what is holding this up, or clear it and set the status back to In progress.',
    };
  }
  if (task.flag === 'Complete') {
    return { kind: 'none', label: 'Nothing outstanding', hint: 'Delivered and acknowledged.' };
  }
  if (task.flag === 'Awaiting acknowledgement') {
    return {
      kind: 'wait',
      label: 'Chase the acknowledgement',
      hint: 'Submitted to the client. It is not complete until they acknowledge it.',
    };
  }
  if (s.status === 'Not started') {
    return { kind: 'start', label: 'Start this step', hint: 'Marks it In progress so the plan reflects the work.' };
  }
  if (submissionRequired(s) && !task.hasEvidence) {
    return {
      kind: 'upload',
      label: 'Upload the deliverable',
      hint: 'This step carries a submission, so it needs the file before it can be completed.',
    };
  }
  if (s.status === 'In progress' && submissionRequired(s) && task.hasEvidence && s.submission !== 'Submitted') {
    return {
      kind: 'complete',
      label: 'Mark it complete',
      hint: 'The evidence is filed. Completing it moves the submission on to the client.',
    };
  }
  return { kind: 'complete', label: 'Mark it complete', hint: 'The work is done and nothing is outstanding on it.' };
}
