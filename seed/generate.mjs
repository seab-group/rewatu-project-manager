/**
 * REWATU PMS — baseline seed generator.
 *
 * The generator is the deliverable. Its output is a build artifact and is not
 * committed: checked-in rows make regeneration a churn diff and turn
 * "deterministic" into a claim nobody re-checks.
 *
 * Determinism, by construction:
 *   - no Math.random()        -> mulberry32 seeded from config
 *   - no Date.now()/new Date()-> every timestamp is baseDate + a fixed offset
 *   - no randomUUID()         -> ids are stable, readable counters
 *   - tables emitted in sorted order, keys in declaration order
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const cfg = JSON.parse(readFileSync(join(HERE, 'seed.config.json'), 'utf8'));
const OUT = process.argv[2] ?? join(HERE, 'out');

/* ---------- determinism primitives ---------- */

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(cfg.seed);

/** Every date in the seed is baseDate + a fixed integer offset. */
const BASE = Date.parse(`${cfg.baseDate}T00:00:00Z`);
const DAY = 86400000;
const day = (offset) => new Date(BASE + offset * DAY).toISOString().slice(0, 10);
const stamp = (offset, hour = 9) =>
  new Date(BASE + offset * DAY + hour * 3600000).toISOString().replace('.000', '');

/**
 * Audit stamp — decision AZ-D7.
 * `created_by` is deliberately null on a deterministic minority of rows, standing for
 * rows migrated from the mock where nobody knows who created them. That nullable case
 * needs a fixture, or the "unknown author" branch never renders.
 */
const AUDIT_ACTORS = ['p-pm-1', 'p-lead-1', 'p-director', 'p-lead-3'];
function audit(offset, i, { withCreatedAt = true } = {}) {
  const migrated = i % 13 === 0;
  const a = {
    created_by: migrated ? null : AUDIT_ACTORS[i % AUDIT_ACTORS.length],
    updated_by: AUDIT_ACTORS[(i + 2) % AUDIT_ACTORS.length],
    updated_at: stamp(offset + 2, 14),
  };
  if (withCreatedAt) a.created_at = stamp(offset, 9);
  return a;
}

/* ---------- authored domain content, carried across verbatim ---------- */
/* FRONTEND-INVENTORY.md §7 identifies the standard template as real domain
 * material with migration value, not fixture data. It is read and instantiated,
 * never regenerated. */

function readTemplate(constName) {
  const src = readFileSync(join(REPO, 'src/data/templates.ts'), 'utf8');
  const block = src.split(`export const ${constName}`)[1].split('\n];')[0];
  return [...block.matchAll(/\{([^}]*)\}/g)].map((m) => {
    const row = {};
    for (const f of m[1].matchAll(/(\w+):\s*"((?:[^"\\]|\\.)*)"/g)) row[f[1]] = f[2];
    return row;
  });
}
const PLAN_TEMPLATE = readTemplate('DELIVERY_PLAN_TEMPLATE');
const REG_TEMPLATE = readTemplate('SUBMISSIONS_TEMPLATE');

function readPhases() {
  const src = readFileSync(join(REPO, 'src/data/reference.ts'), 'utf8');
  const block = src.split('export const PHASES')[1].split('] as const')[0];
  return [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}
const PHASE_LABELS = readPhases();

/* ---------- tables ---------- */

const T = {};

// phase — ERD-D2. "1 Initiation" splits into ordinal + name; this is the whole
// point of the table: it removes the startsWith() prefix join.
T.phase = PHASE_LABELS.map((label, i) => {
  const sp = label.indexOf(' ');
  return { id: `ph-${i + 1}`, ordinal: Number(label.slice(0, sp)), name: label.slice(sp + 1) };
});
const phaseByOrdinal = new Map(T.phase.map((p) => [p.ordinal, p]));

T.client_organisation = [
  { id: 'org-1', name: 'Department of Science, Technology and Innovation' },
  { id: 'org-2', name: 'Department of Basic Education' },
  { id: 'org-3', name: 'Department of Health' },
  { id: 'org-4', name: 'Department of Small Business Development' },
];

T.document_template = [...new Set(REG_TEMPLATE.map((r) => r.template))]
  .sort()
  .map((name, i) => ({ id: `tpl-${i + 1}`, name }));
const templateByName = new Map(T.document_template.map((t) => [t.name, t]));

// person — anchors are load-bearing; see seed.config.json volumes.person.anchors
T.person = [
  { id: 'p-director',   name: 'Musa Ndlovu',      email: 'musa@rewatu.co.za',     job_role: 'Director',          access_role: 'Director',        active: true },
  { id: 'p-pm-1',       name: 'Lebogang Makhura', email: 'lebogang@rewatu.co.za', job_role: 'Project manager',   access_role: 'Project manager', active: true },
  { id: 'p-pm-2',       name: 'Zanele Mabaso',    email: 'zanele@rewatu.co.za',   job_role: 'Project manager',   access_role: 'Project manager', active: true },
  { id: 'p-lead-1',     name: 'Nkululeko Xulu',   email: 'nkululeko@rewatu.co.za',job_role: 'Project lead',      access_role: 'Project lead',    active: true },
  { id: 'p-lead-2',     name: 'Farhaan Ismail',   email: 'farhaan@rewatu.co.za',  job_role: 'Project lead',      access_role: 'Project lead',    active: true },
  { id: 'p-lead-3',     name: 'Refilwe Dube',     email: 'refilwe@rewatu.co.za',  job_role: 'Project lead',      access_role: 'Project lead',    active: true },
  { id: 'p-tm-1',       name: 'Thandiwe Mokoena', email: 'thandiwe@rewatu.co.za', job_role: 'Business analyst',  access_role: 'Team member',     active: true },
  { id: 'p-tm-2',       name: 'Sipho Dlamini',    email: 'sipho@rewatu.co.za',    job_role: 'Front-end developer', access_role: 'Team member',   active: true },
  { id: 'p-tm-3',       name: 'Kagiso Sithole',   email: 'kagiso@rewatu.co.za',   job_role: 'Tester / QA',       access_role: 'Team member',     active: true },
  { id: 'p-inactive',   name: 'Aneline du Toit',  email: 'aneline@rewatu.co.za',  job_role: 'Trainer',           access_role: 'Team member',     active: false },
];

const PROJECTS = [
  { id: 'prj-1', name: 'Vulindlela Power Business Intelligence System', org: 'org-1', pm: 'p-pm-1',   lead: 'p-lead-1', start: -400, end: 120,  status: 'active',    tier: '1' },
  { id: 'prj-2', name: 'Ikusasa Learner Records Modernisation',         org: 'org-2', pm: 'p-pm-1',   lead: 'p-lead-3', start: -700, end: -30,  status: 'archived',  tier: '2' },
  { id: 'prj-3', name: 'Thuthuka Grant Administration Portal',          org: 'org-4', pm: 'p-lead-3', lead: 'p-lead-1', start: -300, end: 200,  status: 'active',    tier: '1' },
  { id: 'prj-4', name: 'Sizani Community Health Information System',    org: 'org-3', pm: 'p-pm-1',   lead: 'p-lead-1', start: -20,  end: 400,  status: 'active',    tier: '2' },
  // N6: created in error. Excluded from reporting by default, and distinct from archived.
  { id: 'prj-5', name: 'Duplicate — Thuthuka (created in error)',       org: 'org-4', pm: 'p-pm-1',   lead: 'p-lead-1', start: -5,   end: 300,  status: 'cancelled', tier: '1' },
];

T.project = PROJECTS.map((p, i) => ({
  id: p.id,
  name: p.name,
  client_id: p.org,
  contract_ref: `RWT-${2025 + (i % 2)}-${String(100 + i)}`,
  service_schedule_ref: `SS-${String(i + 1).padStart(3, '0')}`,
  delivery_tier: p.tier,
  project_manager_id: p.pm,
  project_lead_id: p.lead,
  project_email: p.id === 'prj-4' ? '' : `${p.name.split(' ')[0].toLowerCase()}@rewatu.co.za`,
  client_project_manager: p.id === 'prj-4' ? '' : ['Mpho Radebe', 'Nomvula Khoza', 'Refilwe Sekgobela', 'Sr Beatrice Mathebula'][i],
  client_business_owner: p.id === 'prj-4' ? '' : ['Dr Sizwe Mahlangu', 'Adv. Peter Coetzee', 'Mr Deon Fourie', 'Dr Anusha Naidoo'][i],
  start_date: day(p.start),
  contracted_completion: day(p.end),
  contract_value: [4850000, 2960000, 6420000, 1780000][i],
  currency: 'ZAR',
  support_period_months: 12,
  // Deliberately null on two projects: the ERD records these as the only fields
  // distinguishing "not captured" from zero.
  cost_budget: i < 2 ? [3100000, 1900000][i] : null,
  cost_to_date: i < 2 ? [2740000, 2050000][i] : null,
  system_repository_location: `https://dev.azure.com/rewatu/${p.name.split(' ')[0]}`,
  departmental_workbook_updated: day(p.start + 30),
  this_workbook_updated: day(-3 - i),
  status: p.status,
  created_at: stamp(p.start, 8),
  ...audit(p.start, i, { withCreatedAt: false }),
}));

/* delivery_step — the 55-row standard template instantiated per project.
 * Assignment is what confers membership (AZ §2.2), so who is assigned where is
 * a coverage decision, not decoration. */
const assigneeFor = (projectId, idx) => {
  if (projectId === 'prj-1') {
    // p-tm-1 assigned here (MEMBER admit). p-tm-3 never assigned here (deny).
    if (idx % 7 === 0) return 'p-tm-1';
    if (idx % 5 === 0) return 'p-lead-1';
    if (idx % 3 === 0) return 'p-pm-1';
    return null;
  }
  if (projectId === 'prj-3') {
    // p-tm-3 assigned only here — proves cross-project isolation.
    if (idx % 6 === 0) return 'p-tm-3';
    if (idx % 4 === 0) return 'p-lead-3';
    return null;
  }
  if (projectId === 'prj-2') return idx % 8 === 0 ? 'p-lead-2' : null;
  return null; // prj-4: unassigned, so its plan renders with no owners
};

const STATUS_BY_PROGRESS = (pct) =>
  pct >= 100 ? 'Completed' : pct > 0 ? 'In progress' : 'Not started';

// prj-5 is cancelled and was created in error, so it never got a delivery plan.
const PLANNED = PROJECTS.filter((p) => p.status !== 'cancelled');

T.delivery_step = [];
for (const p of PLANNED) {
  const span = p.end - p.start;
  const per = span / PLAN_TEMPLATE.length;
  PLAN_TEMPLATE.forEach((row, i) => {
    const sp = row.phase.indexOf(' ');
    const ordinal = Number(row.phase.slice(0, sp));
    const plannedStart = Math.round(p.start + i * per);
    const plannedEnd = Math.round(p.start + (i + 1) * per) - 1;
    // Progress is a function of the row index and the project, never of a clock
    // or a random draw, so the same row always lands in the same state.
    const elapsed = plannedEnd < 0;
    const jitter = rand();
    let pct = 0;
    if (p.id === 'prj-4') pct = 0;
    else if (elapsed) pct = jitter > 0.18 ? 100 : 60;
    else if (plannedStart < 0) pct = 40;
    const required = row.submission !== 'Not required';
    const completed = pct >= 100;
    T.delivery_step.push({
      id: `${p.id}-s${i}`,
      project_id: p.id,
      position: i,
      phase_id: phaseByOrdinal.get(ordinal).id,
      step_number: row.step,
      action: row.action,
      deliverable: row.deliverable,
      responsible: row.responsible,
      assignee_id: assigneeFor(p.id, i),
      evidence_link: required && completed && i % 9 === 0
        ? `${p.working_document_location ?? 'SharePoint'} > ${row.step}`.replace(/^undefined > /, 'SharePoint > ')
        : '',
      planned_start: day(plannedStart),
      planned_end: day(plannedEnd),
      actual_completion: completed ? day(plannedEnd) : null,
      status: p.id === 'prj-4' ? 'Not started' : STATUS_BY_PROGRESS(pct),
      percent_complete: pct,
      submission: row.submission,
      date_submitted: completed && required ? day(plannedEnd + 1) : null,
      acknowledged: !required ? 'Not applicable' : completed && jitter > 0.4 ? 'Yes' : 'No',
      notes: i % 11 === 0 ? 'Carried over from the previous reporting cycle.' : '',
      ...audit(plannedStart, i),
    });
  });
}

/* register_entry — the 22-row standard register, instantiated per project. */
T.register_entry = [];
for (const p of PLANNED) {
  REG_TEMPLATE.forEach((row, i) => {
    const ordinal = Number(row.phase);
    const phase = phaseByOrdinal.get(ordinal);
    const steps = T.delivery_step.filter((s) => s.project_id === p.id && s.phase_id === phase.id);
    const last = steps[steps.length - 1];
    const due = last ? last.planned_end : day(p.end);
    const past = Date.parse(`${due}T00:00:00Z`) < BASE;
    const j = rand();
    let status = 'Not started';
    if (p.id !== 'prj-4' && past) status = j > 0.35 ? 'Acknowledged' : j > 0.15 ? 'Submitted' : 'Prepared';
    T.register_entry.push({
      id: `${p.id}-r${i}`,
      project_id: p.id,
      position: i,
      phase_id: phase.id,
      submission: row.submission,
      template_id: templateByName.get(row.template)?.id ?? null,
      signed_by: row.signedBy,
      owner: row.owner,
      planned_date: due,
      date_submitted: status === 'Acknowledged' || status === 'Submitted' ? due : null,
      acknowledged_on: status === 'Acknowledged' ? day(Date.parse(`${due}T00:00:00Z`) / DAY - BASE / DAY + 6) : null,
      status,
      notes: i % 7 === 0 ? 'Template supplied by the department.' : '',
      ...audit(p.start + i, i),
    });
  });
}

/* stored_file / document / document_version — gate coverage.
 * Each gate needs a subject WITH a document (admit) and one WITHOUT (deny). */

const gateStepAdmit = T.delivery_step.find(
  (s) => s.project_id === 'prj-1' && s.submission !== 'Not required'
);
const gateStepDeny = T.delivery_step.find(
  (s) => s.project_id === 'prj-1' && s.submission !== 'Not required' && s.id !== gateStepAdmit.id
);
const gateRegAdmit = T.register_entry.find((r) => r.project_id === 'prj-1');
const gateRegDeny = T.register_entry.find((r) => r.project_id === 'prj-1' && r.id !== gateRegAdmit.id);
const prj3Step = T.delivery_step.find((s) => s.project_id === 'prj-3' && s.submission !== 'Not required');
// AZ-D1: a Team member sees ONLY documents attached to steps assigned to them.
// tmStep is p-tm-1's own step, so doc-10 is the OWN_EVIDENCE admit row.
const tmStep = T.delivery_step.find((s) => s.project_id === 'prj-1' && s.assignee_id === 'p-tm-1');

const DOCS = [
  { id: 'doc-1', project_id: 'prj-1', name: 'Signed requirements specification', step_id: gateStepAdmit.id, register_entry_id: null, invoice_id: null, doc_type: 'Deliverable', status: 'Approved',   storage_location: 'Approved documents', versions: 3 },
  { id: 'doc-2', project_id: 'prj-1', name: 'Kick-off minutes',                  step_id: null, register_entry_id: gateRegAdmit.id, invoice_id: null, doc_type: 'Minutes',     status: 'Approved',   storage_location: 'Approved documents', versions: 1 },
  { id: 'doc-3', project_id: 'prj-1', name: 'Progress report — August 2026',     step_id: null, register_entry_id: null, invoice_id: 'inv-1', doc_type: 'Report',      status: 'Approved',   storage_location: 'Approved documents', versions: 1 },
  { id: 'doc-4', project_id: 'prj-1', name: 'Technical design document',         step_id: null, register_entry_id: null, invoice_id: null,  doc_type: 'Deliverable', status: 'For review', storage_location: 'Working documents',  versions: 2 },
  { id: 'doc-5', project_id: 'prj-1', name: 'Environment access request',        step_id: null, register_entry_id: null, invoice_id: null,  doc_type: 'Evidence',    status: 'Draft',      storage_location: 'Working documents',  versions: 1 },
  { id: 'doc-6', project_id: 'prj-2', name: 'Contract — Ikusasa',                step_id: null, register_entry_id: null, invoice_id: null,  doc_type: 'Contract',    status: 'Approved',   storage_location: 'Approved documents', versions: 1 },
  { id: 'doc-7', project_id: 'prj-3', name: 'Thuthuka UAT record',               step_id: prj3Step.id, register_entry_id: null, invoice_id: null, doc_type: 'Evidence', status: 'For review', storage_location: 'Working documents', versions: 1 },
  { id: 'doc-8', project_id: 'prj-3', name: 'Thuthuka change register',          step_id: null, register_entry_id: null, invoice_id: null,  doc_type: 'Other',       status: 'Draft',      storage_location: 'Working documents',  versions: 1 },
  { id: 'doc-9', project_id: 'prj-1', name: 'Legacy scope note (no file)',       step_id: null, register_entry_id: null, invoice_id: null,  doc_type: 'Other',       status: 'Superseded', storage_location: 'Working documents',  versions: 1, noFile: true },
  { id: 'doc-10', project_id: 'prj-1', name: 'Evidence for my own step',          step_id: tmStep.id, register_entry_id: null, invoice_id: null, doc_type: 'Evidence', status: 'For review', storage_location: 'Working documents', versions: 1 },
];

T.stored_file = [];
T.document_version = [];
let fileN = 0;
let versionRowN = 0;

T.document = DOCS.map((d) => {
  for (let v = 1; v <= d.versions; v += 1) {
    let storedId = null;
    if (!d.noFile) {
      fileN += 1;
      storedId = `sf-${fileN}`;
      T.stored_file.push({
        id: storedId,
        file_name: `${d.name.replace(/[^A-Za-z0-9]+/g, '-').toLowerCase()}-v${v}.pdf`,
        file_size: 180000 + Math.round(rand() * 2200000),
        mime_type: 'application/pdf',
        storage_key: `projects/${d.project_id}/${d.id}/v${v}.pdf`,
        created_at: stamp(-90 + versionRowN * 3, 10),
      });
    }
    versionRowN += 1;
    T.document_version.push({
      id: `dv-${versionRowN}`,
      document_id: d.id,
      version: v,
      stored_file_id: storedId,
      uploaded_by_id: ['p-pm-1', 'p-lead-1', 'p-tm-1'][versionRowN % 3],
      uploaded_at: stamp(-90 + versionRowN * 3, 10),
    });
  }
  return {
    id: d.id,
    project_id: d.project_id,
    name: d.name,
    step_id: d.step_id,
    register_entry_id: d.register_entry_id,
    invoice_id: d.invoice_id,
    doc_type: d.doc_type,
    status: d.status,
    storage_location: d.storage_location,
    link: d.storage_location === 'Approved documents'
      ? `https://rewatu.sharepoint.com/sites/${d.project_id}/approved/${d.id}`
      : '',
    current_version: d.versions,
  };
});

/* invoice — GATE_INVOICE admit (doc-3 points at inv-1) and deny (inv-2 has none) */
T.invoice = [
  { id: 'inv-1', project_id: 'prj-1', number: 'RWT-INV-0041', invoice_date: day(-45), period_covered: 'July 2026',            amount: 985000,  linked_phase_id: phaseByOrdinal.get(7).id,  status: 'Paid',                 date_paid: day(-12) },
  { id: 'inv-2', project_id: 'prj-1', number: 'RWT-INV-0042', invoice_date: day(-14), period_covered: 'August 2026',          amount: 985000,  linked_phase_id: phaseByOrdinal.get(9).id,  status: 'Submitted',            date_paid: null },
  { id: 'inv-3', project_id: 'prj-1', number: 'RWT-INV-0043', invoice_date: day(-7),  period_covered: 'August 2026 support',  amount: 240000,  linked_phase_id: phaseByOrdinal.get(10).id, status: 'Queried',              date_paid: null },
  { id: 'inv-4', project_id: 'prj-3', number: 'RWT-INV-0018', invoice_date: day(-60), period_covered: 'April to June 2026',   amount: 1450000, linked_phase_id: phaseByOrdinal.get(5).id,  status: 'Approved for payment', date_paid: null },
].map((r, i) => ({ ...r, ...audit(-60 + i * 10, i) }));

const monthOf = (offset) => `${day(offset).slice(0, 7)}-01`;
T.monthly_report = [
  { id: 'mr-1', project_id: 'prj-1', month: monthOf(-90), lodged: true,  lodged_on: day(-86), invoice_id: 'inv-1', notes: '' },
  { id: 'mr-2', project_id: 'prj-1', month: monthOf(-60), lodged: true,  lodged_on: day(-57), invoice_id: null,    notes: '' },
  { id: 'mr-3', project_id: 'prj-1', month: monthOf(-30), lodged: false, lodged_on: null,     invoice_id: null,    notes: 'Awaiting the client sign-off note.' },
  { id: 'mr-4', project_id: 'prj-1', month: monthOf(0),   lodged: false, lodged_on: null,     invoice_id: null,    notes: '' },
  { id: 'mr-5', project_id: 'prj-3', month: monthOf(-30), lodged: true,  lodged_on: day(-25), invoice_id: 'inv-4', notes: '' },
].map((r, i) => ({ ...r, ...audit(-90 + i * 20, i) }));

/* alert_read_receipt — SELF admit and deny. Two belong to p-tm-1; one belongs to
 * p-director, which p-tm-1 must be refused. This is the row set that proves read
 * state is per-person, replacing the single global array the mock used. */
T.alert_read_receipt = [
  { id: 'ark-1', person_id: 'p-tm-1',     alert_key: `overdue:${gateStepDeny.id}`, read_at: stamp(-2, 8) },
  { id: 'ark-2', person_id: 'p-tm-1',     alert_key: `duesoon:${gateStepAdmit.id}`, read_at: stamp(-1, 8) },
  { id: 'ark-3', person_id: 'p-director', alert_key: `overdue:${gateStepDeny.id}`, read_at: stamp(-2, 9) },
];

/* ---------- emit ---------- */

mkdirSync(OUT, { recursive: true });
const summary = [];
for (const name of Object.keys(T).sort()) {
  writeFileSync(join(OUT, `${name}.json`), `${JSON.stringify(T[name], null, 2)}\n`);
  summary.push(`${name}: ${T[name].length}`);
}
writeFileSync(join(OUT, '_manifest.json'), `${JSON.stringify({
  seed: cfg.seed, baseDate: cfg.baseDate,
  tables: Object.fromEntries(Object.keys(T).sort().map((k) => [k, T[k].length])),
}, null, 2)}\n`);

console.log(summary.join('\n'));
console.log(`\n${Object.keys(T).length} tables -> ${OUT}`);
