import type { DeliveryStep, DocumentRecord } from '@/types';
import { canCompleteStep, daysLate, stepDays, stepFlag } from '@/lib/derive';
import { formatDate } from '@/lib/dates';
import type { Sheet } from '@/lib/export';

export const PLAN_COLUMNS = [
  'Ref', 'Phase', 'Step', 'Action', 'Deliverable', 'Responsible party', 'Evidence / location',
  'Planned start', 'Planned end', 'Days', 'Actual completion', 'Status', '% complete',
  'Submission to client', 'Date submitted', 'Acknowledged', 'Days late', 'Flag', 'Blockers / notes',
] as const;

const WIDTHS = [6, 22, 8, 46, 32, 20, 30, 13, 13, 7, 14, 14, 10, 22, 14, 13, 9, 24, 34];

/** The export matches the column order on screen, exactly. */
export function planSheet(
  steps: DeliveryStep[], docs: DocumentRecord[], people: Array<{ id: string; name: string }>, name: string,
): Sheet {
  return {
    name,
    headers: [...PLAN_COLUMNS],
    widths: WIDTHS,
    rows: steps.map((s, i) => {
      const files = docs.filter((d) => d.stepId === s.id);
      const evidence = [
        ...files.map((d) => d.versions[d.versions.length - 1]?.fileName ?? d.name),
        s.evidenceLink,
      ].filter(Boolean).join('; ');
      const person = people.find((p) => p.id === s.assigneeId);
      return [
        i + 1,
        s.phase,
        s.step,
        s.action,
        s.deliverable,
        person ? `${s.responsible} (${person.name})` : s.responsible,
        evidence,
        s.plannedStart ? formatDate(s.plannedStart) : '',
        s.plannedEnd ? formatDate(s.plannedEnd) : '',
        stepDays(s) ?? '',
        s.actualCompletion ? formatDate(s.actualCompletion) : '',
        s.status,
        s.percentComplete,
        s.submission,
        s.dateSubmitted ? formatDate(s.dateSubmitted) : '',
        s.acknowledged,
        daysLate(s),
        stepFlag(s),
        s.notes,
      ];
    }),
  };
}

export interface PendingChange {
  stepId: string;
  field: 'status' | 'submission' | 'acknowledged';
  value: string;
  /** Set when the change cannot go ahead at all. */
  blockedReason?: string;
  title: string;
  description: string;
  consequence?: string;
}

/**
 * Work out what a status or acknowledgement change actually means before it is
 * applied — including the cases the system refuses.
 */
export function describeStatusChange(
  step: DeliveryStep, next: string, docs: DocumentRecord[],
): PendingChange {
  if (next === 'Completed') {
    const gate = canCompleteStep(step, docs);
    if (!gate.allowed) {
      return {
        stepId: step.id, field: 'status', value: next,
        blockedReason: gate.reason,
        title: 'This step cannot be marked Completed yet',
        description: `Step ${step.step} carries a submission to the client (${step.submission}).`,
      };
    }
    const willFlagComplete =
      step.submission === 'Not required' || step.acknowledged === 'Yes';
    return {
      stepId: step.id, field: 'status', value: next,
      title: `Mark step ${step.step} Completed?`,
      description: step.action,
      consequence: willFlagComplete
        ? 'The flag becomes Complete: the deliverable exists and no acknowledgement is outstanding.'
        : 'The flag becomes Awaiting acknowledgement, not Complete. The step is only complete once the client acknowledges the submission.',
    };
  }

  if (next === 'Blocked') {
    return {
      stepId: step.id, field: 'status', value: next,
      title: `Mark step ${step.step} Blocked?`,
      description: step.action,
      consequence: 'This puts the whole project At risk on both dashboards until it clears. Record what the blocker is in the notes.',
    };
  }

  return {
    stepId: step.id, field: 'status', value: next,
    title: `Change step ${step.step} to ${next}?`,
    description: step.action,
  };
}

export function describeAcknowledgement(step: DeliveryStep, next: string): PendingChange {
  if (next === 'Yes' && !step.dateSubmitted) {
    return {
      stepId: step.id, field: 'acknowledged', value: next,
      blockedReason: 'Record the date this was submitted to the client before marking it acknowledged. An acknowledgement with no submission date cannot be evidenced later.',
      title: 'This cannot be marked acknowledged yet',
      description: `Step ${step.step} has no date submitted.`,
    };
  }
  return {
    stepId: step.id, field: 'acknowledged', value: next,
    title: `Set acknowledged to ${next}?`,
    description: step.action,
    consequence: next === 'Yes' && step.status === 'Completed'
      ? 'With the step already Completed, the flag becomes Complete.'
      : undefined,
  };
}
