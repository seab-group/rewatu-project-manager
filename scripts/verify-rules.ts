/**
 * The rules this system exists to enforce, checked one branch at a time.
 *
 *   npm run verify
 *
 * The Flag column, days late, inclusive days, and the three gates: a step with
 * a required submission needs evidence before it can be Completed; a register
 * entry needs a file before it can be Submitted; an invoice needs a progress
 * report before it can be Submitted. If any of these drift, the system starts
 * telling the team something that is not true, which is the whole problem it
 * was built to fix.
 */
import { canCompleteStep, canSubmitInvoice, canSubmitRegisterEntry, daysLate, stepDays, stepFlag } from '@/lib/derive';
import type { DeliveryStep, DocumentRecord } from '@/types';

const NOW = '2026-09-09';
const base: DeliveryStep = {
  id: 's1', projectId: 'p', order: 0, phase: '1 Initiation', step: '1',
  action: 'Do the thing', deliverable: 'A thing', responsible: 'Project lead', assigneeId: null,
  evidenceLink: '', plannedStart: '', plannedEnd: '', actualCompletion: '',
  status: 'Not started', percentComplete: 0, submission: 'Not required',
  dateSubmitted: '', acknowledged: 'Not applicable', notes: '',
};
const S = (p: Partial<DeliveryStep>): DeliveryStep => ({ ...base, ...p });

let pass = 0, fail = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  if (got === want) { pass++; }
  else { fail++; console.log(`  FAIL ${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
};

console.log('FLAG — following the specified logic top to bottom');
eq('no action text -> blank', stepFlag(S({ action: '  ' }), NOW), '');
eq('no action text wins over Blocked', stepFlag(S({ action: '', status: 'Blocked' }), NOW), '');
eq('Completed + Not required -> Complete', stepFlag(S({ status: 'Completed', submission: 'Not required' }), NOW), 'Complete');
eq('Completed + acknowledged Yes -> Complete', stepFlag(S({ status: 'Completed', submission: 'Submitted', acknowledged: 'Yes' }), NOW), 'Complete');
eq('Completed + Acknowledged + Yes -> Complete', stepFlag(S({ status: 'Completed', submission: 'Acknowledged', acknowledged: 'Yes' }), NOW), 'Complete');
eq('Completed + Submitted + No -> Awaiting', stepFlag(S({ status: 'Completed', submission: 'Submitted', acknowledged: 'No' }), NOW), 'Awaiting acknowledgement');
eq('Completed + Not yet due + No -> Awaiting', stepFlag(S({ status: 'Completed', submission: 'Not yet due', acknowledged: 'No' }), NOW), 'Awaiting acknowledgement');
eq('Completed + Returned -> Awaiting', stepFlag(S({ status: 'Completed', submission: 'Returned for correction', acknowledged: 'No' }), NOW), 'Awaiting acknowledgement');
eq('Awaiting beats an overdue date', stepFlag(S({ status: 'Completed', submission: 'Submitted', acknowledged: 'No', plannedEnd: '2020-01-01' }), NOW), 'Awaiting acknowledgement');
eq('Blocked -> Blocked', stepFlag(S({ status: 'Blocked' }), NOW), 'Blocked');
eq('Blocked beats an overdue date', stepFlag(S({ status: 'Blocked', plannedEnd: '2020-01-01' }), NOW), 'Blocked');
eq('On hold -> On hold', stepFlag(S({ status: 'On hold' }), NOW), 'On hold');
eq('On hold beats an overdue date', stepFlag(S({ status: 'On hold', plannedEnd: '2020-01-01' }), NOW), 'On hold');
eq('no planned end -> No date', stepFlag(S({ status: 'In progress', plannedEnd: '' }), NOW), 'No date');
eq('past planned end -> Overdue', stepFlag(S({ status: 'In progress', plannedEnd: '2026-09-08' }), NOW), 'Overdue');
eq('planned end today -> Due soon', stepFlag(S({ plannedEnd: '2026-09-09' }), NOW), 'Due soon');
eq('planned end +7 -> Due soon', stepFlag(S({ plannedEnd: '2026-09-16' }), NOW), 'Due soon');
eq('planned end +8 -> On track', stepFlag(S({ plannedEnd: '2026-09-17' }), NOW), 'On track');
eq('Not started far out -> On track', stepFlag(S({ plannedEnd: '2027-01-01' }), NOW), 'On track');

console.log('DAYS LATE');
eq('completed 3 days after planned end', daysLate(S({ status: 'Completed', plannedEnd: '2026-08-01', actualCompletion: '2026-08-04' }), NOW), 3);
eq('completed early -> 0, never below zero', daysLate(S({ status: 'Completed', plannedEnd: '2026-08-10', actualCompletion: '2026-08-01' }), NOW), 0);
eq('completed on time -> 0', daysLate(S({ status: 'Completed', plannedEnd: '2026-08-01', actualCompletion: '2026-08-01' }), NOW), 0);
eq('open and 12 days past planned end', daysLate(S({ status: 'In progress', plannedEnd: '2026-08-28' }), NOW), 12);
eq('open and not yet due -> 0', daysLate(S({ status: 'In progress', plannedEnd: '2026-12-01' }), NOW), 0);
eq('no planned end -> 0', daysLate(S({ status: 'In progress' }), NOW), 0);
eq('completed with no actual date -> 0', daysLate(S({ status: 'Completed', plannedEnd: '2026-01-01' }), NOW), 0);

console.log('DAYS (inclusive)');
eq('single day is 1', stepDays(S({ plannedStart: '2026-03-02', plannedEnd: '2026-03-02' })), 1);
eq('2 to 6 March is 5', stepDays(S({ plannedStart: '2026-03-02', plannedEnd: '2026-03-06' })), 5);
eq('missing dates -> null', stepDays(S({ plannedStart: '2026-03-02' })), null);

console.log('GATES');
const doc = (o: Partial<DocumentRecord>): DocumentRecord => ({
  id: 'd', projectId: 'p', name: 'f', stepId: null, registerEntryId: null, invoiceId: null,
  type: 'Evidence', status: 'Draft', storageLocation: 'Working documents', link: '',
  currentVersion: 1, versions: [], ...o,
});
eq('Not required completes with no file', canCompleteStep(S({ submission: 'Not required' }), []).allowed, true);
eq('Not yet due blocked with no file', canCompleteStep(S({ submission: 'Not yet due' }), []).allowed, false);
eq('Submitted allowed once a file exists', canCompleteStep(S({ id: 'x', submission: 'Submitted' }), [doc({ stepId: 'x' })]).allowed, true);
eq('a file on another step does not count', canCompleteStep(S({ id: 'x', submission: 'Submitted' }), [doc({ stepId: 'y' })]).allowed, false);
eq('register Submitted blocked with no file', canSubmitRegisterEntry({ id: 'r' } as never, []).allowed, false);
eq('register Submitted allowed with a file', canSubmitRegisterEntry({ id: 'r' } as never, [doc({ registerEntryId: 'r' })]).allowed, true);
eq('invoice blocked with no progress report', canSubmitInvoice({ id: 'i', progressReportAttached: false } as never, []).allowed, false);
eq('invoice allowed with the flag set', canSubmitInvoice({ id: 'i', progressReportAttached: true } as never, []).allowed, true);
eq('invoice allowed with a report document', canSubmitInvoice({ id: 'i', progressReportAttached: false } as never, [doc({ invoiceId: 'i' })]).allowed, true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
