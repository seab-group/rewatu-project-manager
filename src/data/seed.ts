import type {
  AppState, DeliveryStep, DocumentRecord, Invoice, MonthlyReport,
  Person, Project, RegisterEntry,
} from '@/types';
import { instantiateDeliveryPlan, instantiateRegister, scheduleRegister, scheduleSteps } from '@/data/factory';
import { addDays, addMonths, monthKey, monthRange, today } from '@/lib/dates';
import { PHASES } from '@/data/reference';

/* Deterministic jitter, so the demo looks the same on every load. */
function makeRandom(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export const PEOPLE: Person[] = [
  { id: 'u1', name: 'Lebogang Makhura', email: 'lebogang@rewatu.co.za', role: 'Project manager', accessRole: 'Project manager', active: true },
  { id: 'u2', name: 'Nkululeko Xulu', email: 'nkululeko@rewatu.co.za', role: 'Project lead', accessRole: 'Project lead', active: true },
  { id: 'u3', name: 'Thandiwe Mokoena', email: 'thandiwe@rewatu.co.za', role: 'Business analyst', accessRole: 'Team member', active: true },
  { id: 'u4', name: 'Sipho Dlamini', email: 'sipho@rewatu.co.za', role: 'Front-end developer', accessRole: 'Team member', active: true },
  { id: 'u5', name: 'Reyhana Patel', email: 'reyhana@rewatu.co.za', role: 'Back-end developer', accessRole: 'Team member', active: true },
  { id: 'u6', name: 'Kagiso Sithole', email: 'kagiso@rewatu.co.za', role: 'Tester / QA', accessRole: 'Team member', active: true },
  { id: 'u7', name: 'Aneline du Toit', email: 'aneline@rewatu.co.za', role: 'Trainer', accessRole: 'Team member', active: true },
  { id: 'u8', name: 'Musa Ndlovu', email: 'musa@rewatu.co.za', role: 'Director', accessRole: 'Director', active: true },
  { id: 'u9', name: 'Zanele Mabaso', email: 'zanele@rewatu.co.za', role: 'Project manager', accessRole: 'Project manager', active: true },
  { id: 'u10', name: 'Farhaan Ismail', email: 'farhaan@rewatu.co.za', role: 'Project lead', accessRole: 'Project lead', active: true },
  { id: 'u11', name: 'Palesa Motaung', email: 'palesa@rewatu.co.za', role: 'Designer', accessRole: 'Team member', active: true },
];

interface Scenario {
  project: Project;
  /** Steps 0..completedThrough are delivered and acknowledged. */
  completedThrough: number;
  stepOverrides: Record<number, Partial<DeliveryStep>>;
  registerOverrides: Record<number, Partial<RegisterEntry>>;
  /** Completed step indexes deliberately left without an evidence file. */
  missingEvidence: number[];
  /**
   * Who does each responsible role on this project. The project's own manager
   * and lead are filled in automatically; this covers everyone else.
   */
  team: Partial<Record<string, string>>;
  /**
   * A re-baselined tail. Where a project has slipped, the PM re-plans the
   * remaining work rather than leaving forty rows sitting overdue — so the
   * steps from `index` on are laid out afresh between `from` and `to`.
   */
  rebaseline?: { index: number; from: string; to: string };
  /**
   * When delivery (phases 1 to 9) is contracted to finish. Phase 10 — training
   * and support — then runs from there to the contracted completion date.
   * Without this the schedule spreads evenly across a term that includes the
   * support tail, and delivery steps end up planned years out.
   */
  deliveryEnd?: string;
  invoices: Array<Omit<Invoice, 'id' | 'projectId'>>;
  monthlyReports: Array<Omit<MonthlyReport, 'id' | 'projectId'>>;
}

const NOW = today();

function project(p: Partial<Project> & Pick<Project, 'id' | 'name' | 'client'>): Project {
  return {
    contractRef: '', serviceScheduleRef: '', deliveryTier: '1',
    projectManagerId: 'u1', projectLeadId: 'u2', projectEmail: '',
    clientProjectManager: '', clientBusinessOwner: '',
    startDate: '', contractedCompletion: '', contractValue: 0, currency: 'ZAR',
    supportPeriodMonths: 12, costBudget: null, costToDate: null,
    systemRepositoryLocation: '', workingDocumentLocation: '', approvedDocumentLocation: '',
    departmentalWorkbookUpdated: '', thisWorkbookUpdated: '',
    archived: false, createdAt: '2025-01-01T08:00:00Z',
    ...p,
  };
}

/* ------------------------------------------------------------------ *
 * 1 — Vulindlela Power Business Intelligence System
 *     Phase 8. One step overdue, two submissions awaiting acknowledgement.
 * ------------------------------------------------------------------ */
const P1: Scenario = {
  project: project({
    id: 'p1',
    name: 'Vulindlela Power Business Intelligence System',
    client: 'Department of Science, Technology and Innovation',
    contractRef: 'DSTI/TOR/2025-118',
    serviceScheduleRef: 'SS-2025-118-04',
    deliveryTier: '2',
    projectManagerId: 'u1',
    projectLeadId: 'u2',
    projectEmail: 'vulindlela@rewatu.co.za',
    clientProjectManager: 'Mpho Radebe',
    clientBusinessOwner: 'Dr Anusha Naidoo',
    startDate: '2026-01-19',
    contractedCompletion: '2027-03-15',
    contractValue: 498732.72,
    supportPeriodMonths: 3,
    costBudget: 341000,
    costToDate: 226400,
    systemRepositoryLocation: 'github.com/rewatu/vulindlela-bi',
    workingDocumentLocation: 'SharePoint › Rewatu › Vulindlela › 01 Working',
    approvedDocumentLocation: 'SharePoint › Rewatu › Vulindlela › 02 Approved',
    departmentalWorkbookUpdated: addDays(NOW, -4),
    thisWorkbookUpdated: addDays(NOW, -1),
    createdAt: '2026-01-19T07:45:00Z',
  }),
  completedThrough: 36,
  missingEvidence: [],
  team: {
    Director: 'u8', 'Business analyst': 'u3', 'Front-end developer': 'u4',
    'Back-end developer': 'u5', 'Tester / QA': 'u6', Trainer: 'u7',
  },
  deliveryEnd: '2026-12-15',
  stepOverrides: {
    // 8.3 Update the technical design document — submitted, not yet acknowledged.
    36: { submission: 'Submitted', acknowledged: 'No', dateSubmitted: addDays(NOW, -9) },
    // 8.4 Build the back end — running late.
    37: {
      status: 'In progress', percentComplete: 60, actualCompletion: '',
      plannedStart: '2026-07-20', plannedEnd: addDays(NOW, -12),
      notes: 'Data model reworked after the round 1 UAT findings on grid-level aggregation.',
    },
    38: { plannedStart: addDays(NOW, -5), plannedEnd: addDays(NOW, 16) },
    39: { plannedStart: addDays(NOW, 10), plannedEnd: addDays(NOW, 27) },
    // 8.7 Security documentation — drafted in parallel and submitted, awaiting the client.
    40: {
      status: 'Completed', percentComplete: 100, actualCompletion: addDays(NOW, -6),
      submission: 'Submitted', acknowledged: 'No', dateSubmitted: addDays(NOW, -6),
      plannedStart: addDays(NOW, -24), plannedEnd: addDays(NOW, -5),
    },
  },
  registerOverrides: {
    11: { status: 'Submitted', dateSubmitted: addDays(NOW, -9), acknowledgedOn: '', notes: 'Sent to Mpho Radebe. Follow-up sent on the 5th.' },
    12: { status: 'Submitted', dateSubmitted: addDays(NOW, -6), acknowledgedOn: '', notes: 'With the departmental security officer for review.' },
  },
  invoices: [
    { number: 'INV-2026-014', date: '2026-03-31', periodCovered: 'January to March 2026', amount: 124683.18, linkedPhase: '2 Planning', progressReportAttached: true, status: 'Paid', datePaid: '2026-04-28' },
    { number: 'INV-2026-041', date: '2026-06-30', periodCovered: 'April to June 2026', amount: 149619.82, linkedPhase: '5 Client demo 1', progressReportAttached: true, status: 'Paid', datePaid: '2026-07-31' },
    { number: 'INV-2026-063', date: '2026-08-31', periodCovered: 'July to August 2026', amount: 99746.54, linkedPhase: '7 Publish and test', progressReportAttached: true, status: 'Submitted', datePaid: '' },
  ],
  monthlyReports: [],
};

/* ------------------------------------------------------------------ *
 * 2 — Phase 3, healthy, nothing overdue.
 * ------------------------------------------------------------------ */
const P2: Scenario = {
  project: project({
    id: 'p2',
    name: 'Ikusasa Learner Records Modernisation',
    client: 'Department of Basic Education',
    contractRef: 'DBE/TOR/2026-042',
    serviceScheduleRef: 'SS-2026-042-01',
    deliveryTier: '1',
    projectManagerId: 'u9',
    projectLeadId: 'u10',
    projectEmail: 'ikusasa@rewatu.co.za',
    clientProjectManager: 'Refilwe Sekgobela',
    clientBusinessOwner: 'Adv. Peter Coetzee',
    startDate: '2026-07-01',
    contractedCompletion: '2027-06-30',
    contractValue: 312450,
    supportPeriodMonths: 5,
    costBudget: null,
    systemRepositoryLocation: 'github.com/rewatu/ikusasa-lrm',
    workingDocumentLocation: 'SharePoint › Rewatu › Ikusasa › 01 Working',
    approvedDocumentLocation: 'SharePoint › Rewatu › Ikusasa › 02 Approved',
    departmentalWorkbookUpdated: addDays(NOW, -2),
    thisWorkbookUpdated: NOW,
    createdAt: '2026-07-01T09:10:00Z',
  }),
  completedThrough: 13,
  missingEvidence: [],
  team: {
    Director: 'u8', 'Business analyst': 'u3', 'Front-end developer': 'u4',
    'Back-end developer': 'u5', 'Tester / QA': 'u6', Trainer: 'u7',
  },
  deliveryEnd: '2027-01-31',
  stepOverrides: {
    14: {
      status: 'In progress', percentComplete: 40, actualCompletion: '',
      plannedStart: addDays(NOW, -6), plannedEnd: addDays(NOW, 12),
      notes: 'Session booked for the 24th with the districts and the national office.',
    },
    15: { plannedStart: addDays(NOW, 13), plannedEnd: addDays(NOW, 30) },
  },
  registerOverrides: {
    3: { status: 'Prepared', notes: 'Template 01 issued to the business unit for completion.' },
  },
  invoices: [
    { number: 'INV-2026-052', date: '2026-07-31', periodCovered: 'July 2026', amount: 62490, linkedPhase: '2 Planning', progressReportAttached: true, status: 'Paid', datePaid: '2026-08-27' },
    { number: 'INV-2026-070', date: '2026-08-31', periodCovered: 'August 2026', amount: 46867.5, linkedPhase: '3 Requirements', progressReportAttached: true, status: 'Approved for payment', datePaid: '' },
  ],
  monthlyReports: [],
};

/* ------------------------------------------------------------------ *
 * 3 — Phase 10 support, fully delivered, invoicing monthly.
 * ------------------------------------------------------------------ */
const P3: Scenario = {
  project: project({
    id: 'p3',
    name: 'Thuthuka Grant Administration Portal',
    client: 'Department of Small Business Development',
    contractRef: 'DSBD/TOR/2025-007',
    serviceScheduleRef: 'SS-2025-007-02',
    deliveryTier: '2',
    projectManagerId: 'u1',
    projectLeadId: 'u10',
    projectEmail: 'thuthuka@rewatu.co.za',
    clientProjectManager: 'Nomvula Khoza',
    clientBusinessOwner: 'Mr Deon Fourie',
    startDate: '2025-03-03',
    contractedCompletion: '2027-03-02',
    contractValue: 1284900,
    supportPeriodMonths: 13,
    costBudget: 820000,
    costToDate: 741200,
    systemRepositoryLocation: 'github.com/rewatu/thuthuka-grants',
    workingDocumentLocation: 'SharePoint › Rewatu › Thuthuka › 01 Working',
    approvedDocumentLocation: 'SharePoint › Rewatu › Thuthuka › 02 Approved',
    departmentalWorkbookUpdated: addDays(NOW, -6),
    thisWorkbookUpdated: addDays(NOW, -3),
    createdAt: '2025-03-03T08:00:00Z',
  }),
  completedThrough: 52,
  missingEvidence: [],
  team: {
    Director: 'u8', 'Business analyst': 'u3', 'Front-end developer': 'u4',
    'Back-end developer': 'u5', 'Tester / QA': 'u6', Trainer: 'u7',
  },
  deliveryEnd: '2026-01-31',
  stepOverrides: {
    53: {
      status: 'In progress', percentComplete: 70, actualCompletion: '',
      plannedStart: '2026-01-01', plannedEnd: '2027-02-28',
      notes: 'Running monthly. August report lodged late; September in preparation.',
    },
    54: { plannedStart: '2026-12-01', plannedEnd: '2027-02-28' },
  },
  registerOverrides: {
    20: { status: 'Submitted', dateSubmitted: addDays(NOW, -14), notes: 'Monthly report cycle, ongoing for the support period.' },
    21: { status: 'Not started', notes: 'Due three months before contract end.' },
  },
  invoices: [
    { number: 'INV-2025-018', date: '2025-05-30', periodCovered: 'March to May 2025', amount: 257000, linkedPhase: '3 Requirements', progressReportAttached: true, status: 'Paid', datePaid: '2025-06-27' },
    { number: 'INV-2025-047', date: '2025-09-30', periodCovered: 'June to September 2025', amount: 321225, linkedPhase: '7 Publish and test', progressReportAttached: true, status: 'Paid', datePaid: '2025-10-29' },
    { number: 'INV-2026-003', date: '2026-01-30', periodCovered: 'October 2025 to January 2026', amount: 385470, linkedPhase: '9 Final deployment', progressReportAttached: true, status: 'Paid', datePaid: '2026-02-26' },
    { number: 'INV-2026-011', date: '2026-02-27', periodCovered: 'February 2026 support', amount: 45000, linkedPhase: '10 Training and support', progressReportAttached: true, status: 'Paid', datePaid: '2026-03-27' },
    { number: 'INV-2026-019', date: '2026-03-31', periodCovered: 'March 2026 support', amount: 45000, linkedPhase: '10 Training and support', progressReportAttached: true, status: 'Paid', datePaid: '2026-04-29' },
    { number: 'INV-2026-028', date: '2026-04-30', periodCovered: 'April 2026 support', amount: 45000, linkedPhase: '10 Training and support', progressReportAttached: true, status: 'Paid', datePaid: '2026-05-28' },
    { number: 'INV-2026-037', date: '2026-05-29', periodCovered: 'May 2026 support', amount: 45000, linkedPhase: '10 Training and support', progressReportAttached: true, status: 'Paid', datePaid: '2026-06-26' },
    { number: 'INV-2026-045', date: '2026-06-30', periodCovered: 'June 2026 support', amount: 45000, linkedPhase: '10 Training and support', progressReportAttached: true, status: 'Paid', datePaid: '2026-07-30' },
    { number: 'INV-2026-054', date: '2026-07-31', periodCovered: 'July 2026 support', amount: 45000, linkedPhase: '10 Training and support', progressReportAttached: true, status: 'Approved for payment', datePaid: '' },
    { number: 'INV-2026-064', date: '2026-08-31', periodCovered: 'August 2026 support', amount: 45000, linkedPhase: '10 Training and support', progressReportAttached: true, status: 'Submitted', datePaid: '' },
  ],
  monthlyReports: [],
};

/* ------------------------------------------------------------------ *
 * 4 — At risk. Three overdue steps, one blocked, one submission returned
 *     for correction, two completed steps with no evidence uploaded.
 * ------------------------------------------------------------------ */
const P4: Scenario = {
  project: project({
    id: 'p4',
    name: 'Sizani Community Health Information System',
    client: 'Department of Health',
    contractRef: 'DOH/TOR/2025-231',
    serviceScheduleRef: 'SS-2025-231-03',
    deliveryTier: '2',
    projectManagerId: 'u9',
    projectLeadId: 'u2',
    projectEmail: 'sizani@rewatu.co.za',
    clientProjectManager: 'Sr Beatrice Mathebula',
    clientBusinessOwner: 'Dr Sizwe Mahlangu',
    startDate: '2025-11-10',
    contractedCompletion: '2026-11-09',
    contractValue: 674300,
    supportPeriodMonths: 2,
    costBudget: 510000,
    costToDate: 402800,
    systemRepositoryLocation: 'github.com/rewatu/sizani-chis',
    workingDocumentLocation: 'SharePoint › Rewatu › Sizani › 01 Working',
    approvedDocumentLocation: 'SharePoint › Rewatu › Sizani › 02 Approved',
    departmentalWorkbookUpdated: addDays(NOW, -19),
    thisWorkbookUpdated: addDays(NOW, -8),
    createdAt: '2025-11-10T08:30:00Z',
  }),
  completedThrough: 21,
  team: {
    Director: 'u8', 'Business analyst': 'u3', 'Front-end developer': 'u11',
    'Back-end developer': 'u5', 'Tester / QA': 'u6', Trainer: 'u7',
  },
  // 10 and 11 (client demo notes, change register) were ticked off with nothing filed.
  missingEvidence: [20, 21],
  deliveryEnd: '2026-08-31',
  // Phases 7 to 10 were re-planned in August once the access blockage was
  // escalated. The recovery plan runs past the contracted completion date,
  // which is exactly what a project in this state looks like.
  rebaseline: { index: 26, from: addDays(NOW, 4), to: addDays(NOW, 168) },
  stepOverrides: {
    20: { submission: 'Submitted', acknowledged: 'No', dateSubmitted: addDays(NOW, -62) },
    21: { submission: 'Submitted', acknowledged: 'No', dateSubmitted: addDays(NOW, -58) },
    // 12.1 Tech Stack Form — returned by the directorate, still not resolved.
    22: {
      status: 'In progress', percentComplete: 50, actualCompletion: '',
      plannedStart: '2026-06-15', plannedEnd: '2026-07-15',
      submission: 'Returned for correction', acknowledged: 'No', dateSubmitted: '2026-07-02',
      notes: 'Directorate returned Appendix B: the licence costs for the reporting layer were not itemised.',
    },
    // 12.2 Cloud Provisioning Form — waiting behind the tech stack approval.
    23: { status: 'Not started', plannedStart: '2026-07-01', plannedEnd: '2026-07-31', notes: 'Cannot be lodged until Appendix B is approved.' },
    // 12.3 User Forms — overdue.
    24: { status: 'Not started', plannedStart: '2026-07-20', plannedEnd: '2026-08-14', notes: 'Fourteen forms outstanding from the district offices.' },
    // 12.4 Azure access — blocked.
    25: {
      status: 'Blocked', percentComplete: 0,
      plannedStart: '2026-08-01', plannedEnd: '2026-08-28',
      notes: 'Blocked on departmental SCM: no purchase order raised for the subscription. Escalated to the director on 21 August.',
    },
  },
  registerOverrides: {
    7: {
      status: 'Returned for correction', dateSubmitted: '2026-07-02', acknowledgedOn: '',
      notes: 'Returned 9 July: licence costs for the reporting layer not itemised. Correction outstanding.',
    },
    6: { status: 'Prepared', notes: '14 of 22 user forms received from the district offices.' },
    8: { status: 'Not started', notes: 'Held until Appendix B is approved.' },
  },
  invoices: [
    { number: 'INV-2026-009', date: '2026-02-27', periodCovered: 'November 2025 to February 2026', amount: 168575, linkedPhase: '2 Planning', progressReportAttached: true, status: 'Paid', datePaid: '2026-04-02' },
    { number: 'INV-2026-036', date: '2026-05-29', periodCovered: 'March to May 2026', amount: 168575, linkedPhase: '5 Client demo 1', progressReportAttached: true, status: 'Paid', datePaid: '2026-07-08' },
    { number: 'INV-2026-058', date: '2026-07-31', periodCovered: 'June to July 2026', amount: 101145, linkedPhase: '6 Environment and access', progressReportAttached: true, status: 'Queried', datePaid: '' },
  ],
  monthlyReports: [],
};

const SCENARIOS = [P1, P2, P3, P4];

/* ------------------------------------------------------------------ *
 * Build
 * ------------------------------------------------------------------ */

const EXTENSIONS: Record<string, string> = {
  minutes: 'docx', note: 'docx', record: 'xlsx', register: 'xlsx',
  plan: 'xlsx', charter: 'pdf', report: 'pdf', form: 'pdf',
  guide: 'pdf', pack: 'zip', link: 'txt', list: 'xlsx',
};

function fileNameFor(text: string, projectName: string): string {
  const key = Object.keys(EXTENSIONS).find((k) => text.toLowerCase().includes(k));
  const ext = key ? EXTENSIONS[key] : 'pdf';
  const slug = text
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .split(/\s+/).filter(Boolean).slice(0, 5).join('-');
  const prefix = projectName.split(/\s+/)[0].toUpperCase();
  return `${prefix}-${slug}.${ext}`;
}

function docTypeFor(step: DeliveryStep): DocumentRecord['type'] {
  const d = step.deliverable.toLowerCase();
  if (d.includes('minute')) return 'Minutes';
  if (d.includes('report')) return 'Report';
  if (step.submission !== 'Not required') return 'Submission';
  return 'Evidence';
}

export function buildInitialState(): AppState {
  const projects: Project[] = [];
  const steps: DeliveryStep[] = [];
  const registerEntries: RegisterEntry[] = [];
  const documents: DocumentRecord[] = [];
  const invoices: Invoice[] = [];
  const monthlyReports: MonthlyReport[] = [];
  let docSeq = 0;

  SCENARIOS.forEach((scenario, si) => {
    const p = scenario.project;
    projects.push(p);
    const rand = makeRandom(1000 + si * 77);

    // 1. Seed from the standard template, then lay a first-draft schedule over it.
    const seeded = instantiateDeliveryPlan(p.id, p.id);
    const supportAt = seeded.findIndex((x) => x.phase === PHASES[PHASES.length - 1]);
    let planSteps: typeof seeded;
    if (scenario.deliveryEnd && supportAt > 0) {
      planSteps = [
        ...scheduleSteps(seeded.slice(0, supportAt), p.startDate, scenario.deliveryEnd),
        ...scheduleSteps(seeded.slice(supportAt), addDays(scenario.deliveryEnd, 1), p.contractedCompletion),
      ];
    } else {
      planSteps = scheduleSteps(seeded, p.startDate, p.contractedCompletion);
    }

    // 2. Put a name on every step. Work with no name on it is work nobody is
    //    doing, so the project's roster turns each responsible role into a person.
    const roster: Record<string, string> = {
      ...scenario.team,
      'Project manager': p.projectManagerId,
      'Project lead': p.projectLeadId,
    };
    planSteps = planSteps.map((s) => ({
      ...s,
      assigneeId: roster[s.responsible] ?? p.projectManagerId,
    }));

    // 3. Close out everything delivered so far.
    planSteps = planSteps.map((s, i) => {
      if (i > scenario.completedThrough) return s;
      const slip = Math.round(rand() * 6) - 2; // a little early, a little late
      const actual = addDays(s.plannedEnd, Math.max(slip, -2));
      const required = s.submission !== 'Not required';
      return {
        ...s,
        status: 'Completed',
        percentComplete: 100,
        actualCompletion: actual > NOW ? NOW : actual,
        submission: required ? 'Acknowledged' : 'Not required',
        dateSubmitted: required ? actual : '',
        acknowledged: required ? 'Yes' : 'Not applicable',
      };
    });

    // 4. Re-baseline the tail where the scenario says the plan was re-planned.
    if (scenario.rebaseline) {
      const { index, from, to } = scenario.rebaseline;
      const tail = scheduleSteps(planSteps.slice(index), from, to);
      planSteps = [...planSteps.slice(0, index), ...tail];
    }

    // 5. Apply the scenario's specific state.
    planSteps = planSteps.map((s, i) => {
      const o = scenario.stepOverrides[i];
      return o ? { ...s, ...o } : s;
    });
    steps.push(...planSteps);

    // 6. Register: acknowledged where the phase is closed out, then overridden.
    let entries = scheduleRegister(instantiateRegister(p.id, p.id), planSteps);
    entries = entries.map((e, i) => {
      const phaseName = PHASES.find((ph) => ph.startsWith(`${e.phase} `))!;
      const phaseSteps = planSteps.filter((s) => s.phase === phaseName);
      const closed = phaseSteps.length > 0 && phaseSteps.every((s) => s.status === 'Completed');
      // A submission that has been acknowledged was sent when the work was
      // actually finished, not when it was planned to be — and never in the future.
      const finished = phaseSteps
        .map((x) => x.actualCompletion)
        .filter(Boolean)
        .sort()
        .pop() ?? e.plannedDate;
      const sent = finished > NOW ? NOW : finished;
      const ack = addDays(sent, 3 + Math.round(rand() * 6));
      const base: RegisterEntry = closed
        ? { ...e, status: 'Acknowledged', dateSubmitted: sent, acknowledgedOn: ack > NOW ? NOW : ack }
        : e;
      const o = scenario.registerOverrides[i];
      return o ? { ...base, ...o } : base;
    });
    registerEntries.push(...entries);

    // 7. Evidence files for everything delivered, bar what the scenario withholds.
    for (const s of planSteps) {
      if (s.status !== 'Completed') continue;
      if (s.submission === 'Not required') continue;
      const idx = planSteps.indexOf(s);
      if (scenario.missingEvidence.includes(idx)) continue;
      docSeq += 1;
      const approved = s.acknowledged === 'Yes';
      documents.push({
        id: `doc-${docSeq}`,
        projectId: p.id,
        name: s.deliverable,
        stepId: s.id,
        registerEntryId: null,
        invoiceId: null,
        type: docTypeFor(s),
        status: approved ? 'Approved' : 'For review',
        storageLocation: approved ? 'Approved documents' : 'Working documents',
        link: '',
        currentVersion: 1,
        versions: [{
          version: 1,
          fileName: fileNameFor(s.deliverable, p.name),
          fileSize: 45_000 + Math.round(rand() * 3_800_000),
          mimeType: 'application/pdf',
          uploadedBy: PEOPLE.find((x) => x.id === s.assigneeId)?.name ?? 'Lebogang Makhura',
          uploadedAt: `${s.actualCompletion || s.plannedEnd}T14:20:00Z`,
          objectUrl: null,
        }],
      });
    }

    // 8. The register's own files, for anything that has actually left the building.
    for (const e of entries) {
      if (e.status === 'Not started' || e.status === 'Not applicable') continue;
      if (e.status === 'Prepared') continue;
      docSeq += 1;
      documents.push({
        id: `doc-${docSeq}`,
        projectId: p.id,
        name: e.submission,
        stepId: null,
        registerEntryId: e.id,
        invoiceId: null,
        type: 'Submission',
        status: e.status === 'Acknowledged' ? 'Approved' : e.status === 'Returned for correction' ? 'Draft' : 'For review',
        storageLocation: e.status === 'Acknowledged' ? 'Approved documents' : 'Working documents',
        link: '',
        currentVersion: e.status === 'Returned for correction' ? 2 : 1,
        versions: e.status === 'Returned for correction'
          ? [
              { version: 1, fileName: fileNameFor(e.submission, p.name), fileSize: 220_400, mimeType: 'application/pdf', uploadedBy: 'Nkululeko Xulu', uploadedAt: `${e.dateSubmitted || e.plannedDate}T09:00:00Z`, objectUrl: null },
              { version: 2, fileName: fileNameFor(`${e.submission} rev B`, p.name), fileSize: 231_900, mimeType: 'application/pdf', uploadedBy: 'Nkululeko Xulu', uploadedAt: `${addDays(e.dateSubmitted || e.plannedDate, 11)}T09:00:00Z`, objectUrl: null },
            ]
          : [{ version: 1, fileName: fileNameFor(e.submission, p.name), fileSize: 120_000 + Math.round(rand() * 2_400_000), mimeType: 'application/pdf', uploadedBy: PEOPLE.find((x) => x.role === e.owner)?.name ?? 'Lebogang Makhura', uploadedAt: `${e.dateSubmitted || e.plannedDate}T11:05:00Z`, objectUrl: null }],
      });
    }

    // 9. The signed contract, filed against every project.
    docSeq += 1;
    documents.push({
      id: `doc-${docSeq}`,
      projectId: p.id,
      name: `Signed contract and terms of reference — ${p.contractRef}`,
      stepId: null, registerEntryId: null, invoiceId: null,
      type: 'Contract', status: 'Approved', storageLocation: 'Approved documents',
      link: '', currentVersion: 1,
      versions: [{
        version: 1, fileName: `${p.contractRef.replace(/\//g, '-')}-signed.pdf`,
        fileSize: 1_840_220, mimeType: 'application/pdf',
        uploadedBy: 'Musa Ndlovu', uploadedAt: `${p.startDate}T10:00:00Z`, objectUrl: null,
      }],
    });

    // 10. Invoices, each with the progress report the client insists on.
    scenario.invoices.forEach((inv, i) => {
      const id = `${p.id}-inv${i}`;
      invoices.push({ ...inv, id, projectId: p.id });
      docSeq += 1;
      documents.push({
        id: `doc-${docSeq}`,
        projectId: p.id,
        name: `Progress report accompanying ${inv.number}`,
        stepId: null, registerEntryId: null, invoiceId: id,
        type: 'Report', status: 'Approved', storageLocation: 'Approved documents',
        link: '', currentVersion: 1,
        versions: [{
          version: 1, fileName: `${inv.number}-progress-report.pdf`,
          fileSize: 380_000 + Math.round(rand() * 400_000), mimeType: 'application/pdf',
          uploadedBy: PEOPLE.find((x) => x.id === p.projectManagerId)?.name ?? 'Lebogang Makhura',
          uploadedAt: `${inv.date}T16:30:00Z`, objectUrl: null,
        }],
      });
    });
  });

  // Monthly reporting position — only projects that have reached support.
  const supportStart = '2026-01';
  for (const month of monthRange('2026-01-01', addMonths(NOW, 0))) {
    if (month < supportStart) continue;
    const lodged = month < '2026-08';
    const linked = invoices.find((i) => i.projectId === 'p3' && monthKey(i.date) === month);
    monthlyReports.push({
      id: `mr-p3-${month}`,
      projectId: 'p3',
      month,
      lodged,
      lodgedOn: lodged ? `${month}-28` : '',
      invoiceId: linked?.id ?? null,
      notes: lodged ? '' : 'Not yet lodged.',
    });
  }

  return {
    people: PEOPLE,
    projects,
    steps,
    registerEntries,
    documents,
    invoices,
    monthlyReports,
    currentUserId: 'u1',
    readAlertIds: [],
  };
}
