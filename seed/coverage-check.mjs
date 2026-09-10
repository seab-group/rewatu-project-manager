/**
 * Coverage: every authz rule needs data on BOTH sides.
 *
 * A seed where every row is happy-path renders beautifully and proves nothing.
 * If the seed cannot show that authorization REFUSES, the authz model has no
 * fixture and the bugs live exactly there.
 *
 * Rules are from AUTHZ-MODEL-DRAFT.md §5.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] ?? join(HERE, 'out');
const t = (n) => JSON.parse(readFileSync(join(OUT, `${n}.json`), 'utf8'));

const person = t('person'), project = t('project'), step = t('delivery_step');
const reg = t('register_entry'), doc = t('document'), inv = t('invoice');
const ark = t('alert_read_receipt'), dv = t('document_version');

const results = [];
const check = (rule, side, ok, detail) => results.push({ rule, side, ok, detail });

const MEMBER = (pid, prj) =>
  prj.project_manager_id === pid || prj.project_lead_id === pid ||
  step.some((s) => s.project_id === prj.id && s.assignee_id === pid);

const prj1 = project.find((p) => p.id === 'prj-1');
const prj3 = project.find((p) => p.id === 'prj-3');

/* --- MANAGES --- */
check('MANAGES', 'admit', project.some((p) => p.project_manager_id === 'p-pm-1'), 'p-pm-1 manages at least one project');
check('MANAGES', 'deny', !project.some((p) => p.project_manager_id === 'p-pm-2'),
  'p-pm-2 holds Project manager but manages nothing');

/* --- LEADS --- */
check('LEADS', 'admit', project.some((p) => p.project_lead_id === 'p-lead-1'), 'p-lead-1 leads at least one project');
check('LEADS', 'deny',
  !project.some((p) => p.project_lead_id === 'p-lead-2' || p.project_manager_id === 'p-lead-2'),
  'p-lead-2 holds Project lead but leads and manages nothing');

/* --- ASSIGNED --- */
check('ASSIGNED', 'admit', step.some((s) => s.assignee_id === 'p-tm-1'), 'p-tm-1 has assigned steps');
check('ASSIGNED', 'deny', step.some((s) => s.project_id === 'prj-1' && s.assignee_id !== 'p-tm-1'),
  'prj-1 has steps NOT assigned to p-tm-1');

/* --- MEMBER --- */
check('MEMBER', 'admit', MEMBER('p-tm-1', prj1), 'p-tm-1 is a member of prj-1 via assignment');
check('MEMBER', 'deny', !MEMBER('p-tm-2', prj1) && !project.some((p) => MEMBER('p-tm-2', p)),
  'p-tm-2 is a member of NO project');
check('MEMBER', 'cross-project deny', MEMBER('p-tm-3', prj3) && !MEMBER('p-tm-3', prj1),
  'p-tm-3 is on prj-3 but not prj-1');

/* --- VISIBLE (Director bypass + archived) --- */
check('VISIBLE', 'admit', person.some((p) => p.access_role === 'Director' && p.active),
  'an active Director exists for the bypass path');
check('VISIBLE', 'deny', project.some((p) => p.status === 'archived'),
  'an archived project exists — proves the status filter');
check('VISIBLE', 'cancelled deny', project.some((p) => p.status === 'cancelled'),
  'a cancelled project exists — N6, must be excluded from reporting separately from archived');
check('STATUS', 'three states', new Set(project.map((p) => p.status)).size === 3,
  'all three project states are represented: active, archived, cancelled');
check('STATUS', 'cancelled has no plan', !step.some((s2) => s2.project_id === 'prj-5'),
  'the cancelled project never got a delivery plan');

/* --- account state (AZ-D2) --- */
check('ACTIVE', 'admit', person.some((p) => p.active === true), 'active people exist');
check('ACTIVE', 'deny', person.some((p) => p.active === false), 'an inactive person exists');

/* --- SELF (alert read receipts) --- */
check('SELF', 'admit', ark.some((a) => a.person_id === 'p-tm-1'), 'p-tm-1 owns receipts');
check('SELF', 'deny', ark.some((a) => a.person_id !== 'p-tm-1'),
  'a receipt belonging to another person exists, which p-tm-1 must be refused');

/* --- AZ-D1 / AZ-D3: a Team member sees only their own steps' evidence --- */
const tmSteps = new Set(step.filter((x) => x.assignee_id === 'p-tm-1').map((x) => x.id));
const tmVisibleDocs = doc.filter((d) => d.step_id && tmSteps.has(d.step_id));
check('OWN_EVIDENCE', 'admit', tmVisibleDocs.length > 0,
  'a document attached to a step assigned to p-tm-1');
check('OWN_EVIDENCE', 'deny', doc.some((d) => d.project_id === 'prj-1' && !(d.step_id && tmSteps.has(d.step_id))),
  'documents on p-tm-1\'s own project that they must NOT see');
check('OWN_EVIDENCE', 'standalone deny', doc.some((d) => !d.step_id && !d.register_entry_id && !d.invoice_id),
  'a project-level document with no subject — reaches no Team member by construction (ERD-D3)');

/* --- ERD-D3: at most one subject, zero permitted --- */
check('ONE_SUBJECT', 'holds', doc.every((d) =>
  [d.step_id, d.register_entry_id, d.invoice_id].filter(Boolean).length <= 1),
  'no document attaches to more than one subject');

/* --- AZ-D1: RUNS vs ASSIGNED_ON are genuinely different populations --- */
const RUNS = (pid, prj) => prj.project_manager_id === pid || prj.project_lead_id === pid;
const ASSIGNED_ON = (pid, prj) => step.some((x) => x.project_id === prj.id && x.assignee_id === pid);
check('ASSIGNED_ON', 'not RUNS', ASSIGNED_ON('p-tm-1', prj1) && !RUNS('p-tm-1', prj1),
  'p-tm-1 is assigned on prj-1 but does not run it — the two rules must differ');
check('RUNS', 'not ASSIGNED_ON', RUNS('p-pm-1', prj1),
  'p-pm-1 runs prj-1 — full read subject to role');

/* --- AZ-D7: audit columns --- */
check('AUDIT', 'populated', project.every((p) => 'updated_by' in p && 'updated_at' in p),
  'every project carries updated_by and updated_at');
check('AUDIT', 'null created_by', step.some((s2) => s2.created_by === null),
  'some rows have created_by null — the "migrated, author unknown" case');
check('AUDIT', 'set created_by', step.some((s2) => s2.created_by !== null),
  'other rows have a real author');

/* --- the three gates --- */
const stepsRequiring = step.filter((s) => s.project_id === 'prj-1' && s.submission !== 'Not required');
check('GATE_STEP', 'admit', stepsRequiring.some((s) => doc.some((d) => d.step_id === s.id)),
  'a submission-required step WITH an evidence document');
check('GATE_STEP', 'deny', stepsRequiring.some((s) => !doc.some((d) => d.step_id === s.id)),
  'a submission-required step WITHOUT one');

check('GATE_REGISTER', 'admit', reg.some((r) => doc.some((d) => d.register_entry_id === r.id)),
  'a register entry WITH an attached file');
check('GATE_REGISTER', 'deny', reg.some((r) => !doc.some((d) => d.register_entry_id === r.id)),
  'a register entry WITHOUT one');

check('GATE_INVOICE', 'admit', inv.some((i) => doc.some((d) => d.invoice_id === i.id)),
  'an invoice WITH a progress report');
check('GATE_INVOICE', 'deny', inv.some((i) => !doc.some((d) => d.invoice_id === i.id)),
  'an invoice WITHOUT one');

/* --- money projection has something to hide (AZ §3.6) --- */
check('MONEY', 'present', project.some((p) => p.contract_value > 0) && inv.some((i) => i.amount > 0),
  'money columns are populated, so a projection that omits them is observable');
check('MONEY', 'null-vs-zero', project.some((p) => p.cost_budget === null) && project.some((p) => p.cost_budget !== null),
  'cost_budget is null on some projects and set on others — "not captured" vs zero');

/* --- deliberate empty states --- */
check('EMPTY', 'project with no documents', !doc.some((d) => d.project_id === 'prj-4'), 'prj-4 has no documents');
check('EMPTY', 'project with no invoices', !inv.some((i) => i.project_id === 'prj-4'), 'prj-4 has no invoices');
check('EMPTY', 'version with no file', dv.some((v) => v.stored_file_id === null),
  'a document_version with no bytes — the "no file behind this" branch');
check('EMPTY', 'unassigned plan', step.some((s) => s.project_id === 'prj-4' && s.assignee_id === null),
  'prj-4 has unassigned steps');

/* --- multi-version history --- */
check('HISTORY', 'multi-version', dv.filter((v) => v.document_id === 'doc-1').length >= 3,
  'a document with 3 versions — supersede-and-retain');

/* --- secrets must be absent (step 7) --- *
 * The ERD declares no credential column, because authentication was never built.
 * This asserts the seed never invents one — a seed containing a real value
 * teaches every downstream environment that it is acceptable. */
const SECRETISH = /password|passwd|secret|token|hash|salt|credential|api_?key|private_?key|signature/i;
const leaked = [];
for (const name of ['person', 'project', 'document', 'document_version', 'stored_file', 'invoice']) {
  for (const row of t(name)) {
    for (const [k, v] of Object.entries(row)) {
      if (SECRETISH.test(k) && v !== null) leaked.push(`${name}.${k}`);
    }
  }
}
check('SECRETS', 'absent', leaked.length === 0,
  leaked.length ? `LEAKED: ${[...new Set(leaked)].join(', ')}` : 'no credential-shaped column carries a value');

/* --- report --- */
const failed = results.filter((r) => !r.ok);
const w = Math.max(...results.map((r) => r.rule.length));
for (const r of results) {
  console.log(`  ${r.ok ? 'ok  ' : 'FAIL'}  ${r.rule.padEnd(w)}  ${r.side.padEnd(22)}  ${r.detail}`);
}
console.log(`\ncoverage: ${results.length - failed.length}/${results.length} assertions passed`);
if (failed.length) process.exit(1);
