# Authorization Model — DRAFT PROPOSAL

**Status: DECISIONS APPLIED — 2026-09-10.**

All eight open decisions in §1 have been answered. **One of them — AZ-D1 — changed the
model rather than confirming it**, and §2, §4 and §5 are reworked accordingly. The old
blanket `MEMBER` read rule is gone. `PHASE-0-DECISIONS.md` carries the reasoning.

Derived 2026-09-10 from `FRONTEND-INVENTORY.md` §1, §4, §5, §6 and `DATA-MODEL-DRAFT.md`
§3, §5. Both inputs were present and well-formed. Sections 2, 3 and 7 are **observation**
— what the two documents record. Sections 4, 5 and 6 are **proposal** — the server-side
model, derived separately and deliberately not a transcription of the client's.

I did not read application code. Every line below traces to one of the two documents.

---

## 0. Headline

Four roles — **Director, Project manager, Project lead, Team member** — layered over
three project relationships (manager-of, lead-of, assigned-on) and one account state
(active/inactive). Authorization is **row-level, not route-level**: a role grants nothing
on its own, and every non-Director permission is qualified by a relationship to the
specific project.

**The single biggest gap: there is no authentication.** Not a weak one — none. No login,
no credential, no session, no token (`FRONTEND-INVENTORY.md` §4). Identity is a client-held
field the user picks from a dropdown. Every rule in this document must be built from
nothing, and until it is, every route and every mutation is open to anyone who can reach
the application.

The authorization *model* is unusually good and largely portable. Its *enforcement* does
not exist.

---

## 1. Decisions — ALL ANSWERED

Answered in session 2026-09-10. Reasoning retained; each heading carries its answer.

### D1 — Does being assigned a step still grant access to the whole project?

> **ANSWERED — and this REWROTE the model. Neither option offered was taken.**
> Assignment grants **the read-only delivery plan of that project, and nothing else**.
> A Team member sees their own steps in full, the rest of the plan read-only, and is
> **denied** contracts, the submissions register, invoices, monthly reports, all money,
> project setup, and every document not attached to a step assigned to them.
> Product owner: *"users must only see the work they are assigned to and nothing else."*
> **The blanket `MEMBER` read rule is superseded — see §2.2 and §5.**

**Moves: every project-scoped cell in §4 — roughly two-thirds of the matrix.**

`FRONTEND-INVENTORY.md` §4 records membership as: holding `projectManagerId` **or**
`projectLeadId`, **or** being `assigneeId` on any step of that project. So project
membership is *derived*, not stored — there is no `project_membership` table in
`DATA-MODEL-DRAFT.md` §3.

| For keeping derived membership | Against |
|---|---|
| It is the existing design, and it is coherent: you are on a project because you have work on it | Granting access becomes a **side effect** of an unrelated operation (assigning a step) |
| No table to keep in sync; membership can never disagree with the work | No audit trail — nothing records who granted access, or when |
| Removing the last assignment removes access automatically | Revocation is equally implicit: reassigning a step silently strips someone's access to every document on the project |

**Recommendation: keep the derived rule, and add explicit auditing of the grant.** The
rule is sound and the frontend depends on it; what it lacks is a record. Anyone with
`assignWork` on a project can confer read access to that project's entire document set,
and nothing currently notices. See H7.

### D2 — Does `active = false` revoke access?

> **ANSWERED: locked out completely.** An inactive person cannot sign in at all. Their
> name stays on past work. Existing sessions are terminated, not left to expire. A second
> "on leave" state was offered and declined; it can be added later without rework.

**Moves: every cell, conditionally.**

`DATA-MODEL-DRAFT.md` §3.1 records `person.active` as a real column with a working
Deactivate/Reactivate control. But `FRONTEND-INVENTORY.md` §4 enumerates every permission
predicate in the model — `isOnProject`, `visibleProjects`, `canSeeProject`, `abilities`,
`canCreateProject`, `canManagePeople`, `canSeePortfolio`, `canSeeReports`,
`canExecuteStep` — and **none of them consults `active`**.

So a deactivated person retains every ability they had. Deactivation is presentational.

**Recommendation: `active = false` denies everything except authentication failure.** This
is the deny-biased reading and it is almost certainly the intent — a control labelled
"Deactivate" that does not deactivate is a defect, not a design. Flagged rather than
assumed because it is a product decision about what deactivation means: whether it is
"has left the company" (deny all) or "on leave" (deny writes, permit reads).

### D3 — Is the global document list scoped to the caller's projects?

> **ANSWERED: the screen stays, scoped per caller.** Director sees everything; PM sees
> documents on projects they manage; Lead on projects they lead; **Team member sees only
> documents attached to steps assigned to them** — much narrower than this draft assumed,
> because of AZ-D1.

**Moves: all `document` list and read cells, plus the `/documents` route.**

`FRONTEND-INVENTORY.md` finding 3 records that `/documents` renders every document in the
business with no scoping, and that — unlike the money routes — **no guard predicate is
even defined** for global document visibility. The gap is in the model, not only its
application.

| For scoping to visible projects | Against |
|---|---|
| Consistent with every other resource in the model | A cross-project document search may be a real requirement the frontend was reaching for |
| Documents include client contracts, signed submissions and invoicing evidence | Directors would lose nothing (they see all projects anyway) |

**Recommendation: scope it.** Same rule as `project` read. If a business-wide document
search is wanted, that is a Director-and-above capability to be added deliberately, not
the default that arrived by omission.

### D4 — Should a Project lead who is the project's *manager* see money?

> **ANSWERED: no.** Confirms the draft. This established the governing principle now
> recorded at the head of §4: **role decides what kind of information a person may ever
> see; the relationship decides which projects; a relationship never widens the kind.**

**Moves: one row of §4, but it is the money row.**

`FRONTEND-INVENTORY.md` §4 records the ability rules as role **and** relationship: a
`Project manager` gets money when `isManager`; a `Project lead` gets the lead ability set
when `isLead || isManager` — with `viewMoney: false`. So a person whose *access role* is
Project lead but who is named as `projectManagerId` on a project manages that project
without seeing its money.

**Recommendation: keep it.** `access_role` is the authority on what a person may ever see;
the relationship decides which projects. Money follows the role, not the seat. This reads
as deliberate, but it is subtle enough that a reviewer should confirm rather than inherit.

### D5 — Who may move a record past one of the three business gates?

> **ANSWERED: the assignee may complete their own step; the project manager and lead may
> complete any step on their project.** Confirms the draft. Register and invoice
> transitions sit with PM and Lead, since Team members are denied both outright.

**Moves: the status-transition cells on `delivery_step`, `register_entry`, `invoice`.**

`DATA-MODEL-DRAFT.md` H6 records three gates that must become server-side transactional
invariants: a step cannot be Completed without evidence, a register entry cannot be
Submitted without a file, an invoice cannot be Submitted without a progress report.

The documents establish *what* the gates check but not *who* may attempt the transition.
Two readings: the ability that governs the resource (`editPlan`, `editRegister`,
`editMoney`), or the assignment (`canExecuteStep` — "anyone may work a step that is
theirs", `FRONTEND-INVENTORY.md` §4).

**Recommendation: the assignee may transition their own step; the plan abilities govern
everything else.** This matches the product's stated centre of gravity — the tasks screen,
where a Team member works their own steps — while keeping register and invoice
transitions with the roles that own those artefacts.

### D6 — May a Project manager delete their own project?

> **ANSWERED: nobody deletes a project.** Archiving is the only disposal route, so the
> delete operation is removed from §4 entirely rather than restricted to Directors.

**Moves: one cell.**

`FRONTEND-INVENTORY.md` §4 is explicit: `deleteProject` is true **only** for Director. A
project manager cannot delete a project they run.

**Recommendation: keep the restriction.** Deletion cascades to five tables
(`DATA-MODEL-DRAFT.md` §3.2) and is irreversible. Note the model has no archive path
either — `project.archived` has no write path at all (`DATA-MODEL-DRAFT.md` D9), so today
the only disposal route is a Director hard-delete.

### D7 — Do the missing audit columns get added?

> **ANSWERED: yes.** `created_by` / `created_at` / `updated_by` / `updated_at` on
> `project`, `delivery_step`, `register_entry`, `invoice` and `monthly_report`. Full
> per-field history was declined — only the *last* change is attributable.

**Moves: no current cell — but it bounds which rules can ever be written.**

`DATA-MODEL-DRAFT.md` §3 shows exactly one actor-attribution column across the entire
schema: `document_version.uploaded_by_id`. There is no `created_by` or `updated_by` on
`project`, `delivery_step`, `register_entry`, `invoice` or `monthly_report`.

Any rule of the form "you may edit what you created" is **unevaluable** — there is no
column to evaluate it against. This is a schema change, not an authorization decision.

**Recommendation: add `created_by` and `created_at` to every mutable table** before the
first rule needs them. None of the matrix below depends on them today; that is a
consequence of the schema, not a choice.

### D8 — Are client-side people ever principals?

> **ANSWERED: no.** Client-side people are not modelled at all (ERD-D1), so they cannot
> be principals. No external tier in v1.

**Moves: nothing today; determines whether an external-access tier exists later.**

`DATA-MODEL-DRAFT.md` D1 records eight named client-side individuals stored as free text
on `project` — client project managers and business owners. They have no email, no access
role and no credential.

The whole product is built around submissions **to** the client and acknowledgement **by**
the client, but the client acknowledging is recorded by internal staff, not performed by
the client.

**Recommendation: no external principal in v1.** Flag it as the most likely next
authorization requirement, because a client portal would change the model's shape rather
than extend it — every scoping rule assumes the caller is internal staff.

---

## 2. Principals

*Observation.* Three kinds of thing are kept separate here because the frontend keeps
them separate, and collapsing them is the error this section exists to prevent.

### 2.1 Roles — `person.access_role`

A named permission tier. Source: `FRONTEND-INVENTORY.md` §4, `DATA-MODEL-DRAFT.md` §5.

| Role | Intent |
|---|---|
| `Director` | Every active project, all money, manages people, creates and deletes projects |
| `Project manager` | Their own projects end to end, including money |
| `Project lead` | Delivery on their own projects — plan, register, documents. No money |
| `Team member` | Only projects they have work on; their own tasks and evidence uploads |

**A role grants nothing by itself.** Every non-Director permission is qualified by a
relationship (§2.2). A `Project manager` has no rights over a project they do not manage.

### 2.2 Relationships — derived, not stored

Source: `FRONTEND-INVENTORY.md` §4; FK paths from `DATA-MODEL-DRAFT.md` §3.

| Relationship | FK path | Grants |
|---|---|---|
| `MANAGES(person, project)` | `project.project_manager_id = person.id` | The manager ability set, with money if role permits |
| `LEADS(person, project)` | `project.project_lead_id = person.id` | The lead ability set |
| `ASSIGNED(person, step)` | `delivery_step.assignee_id = person.id` | The right to work that step |
| `ASSIGNED_ON(person, project)` | `∃ step: step.project_id = project.id ∧ step.assignee_id = person.id` | The **read-only delivery plan** of that project, and a minimal project header. Nothing else |
| `RUNS(person, project)` | `MANAGES ∨ LEADS` | Read of the project and everything under it, subject to role |

**`MEMBER` no longer exists.** The draft defined it as
`MANAGES ∨ LEADS ∨ assigned-on-a-step`, granting read of the project *and everything
under it*. **AZ-D1 rejected that.** Being given work no longer opens the project.

The rule split in two because the two halves now grant different things:

- **`RUNS`** — you are named as the project's manager or lead. You see the project and
  its contents, limited by your role (money only if `Project manager` or `Director`).
- **`ASSIGNED_ON`** — you merely have work here. You see **the delivery plan read-only**
  and your own steps in full. Not the register, not documents beyond your own steps'
  evidence, not invoices, not setup, not money.

There is still **no `project_membership` table** — both are computed. `ASSIGNED_ON`
requires a subquery against `delivery_step` on every evaluation.

**Explicitly not a relationship:** `register_entry.owner`. It names a *job role*, not a
person (`FRONTEND-INVENTORY.md` §4, `DATA-MODEL-DRAFT.md` §3.2), and confers no access.
Do not turn it into an FK to `person`.

### 2.3 Account state — `person.active`

Boolean. Toggled by a Deactivate/Reactivate control (`DATA-MODEL-DRAFT.md` §3.1).
**Consulted by no permission predicate today.** See D2.

### 2.4 Not a principal dimension — `person.job_role`

`Responsible`, 12 members (`DATA-MODEL-DRAFT.md` §5). It drives responsible-party
dropdowns and shares three spellings with `access_role` (`Project manager`,
`Project lead`, `Director`), which invites exactly the collapse this section forbids.
`job_role` has **no authorization meaning**. `FRONTEND-INVENTORY.md` finding 10 records
the two as separate axes; that separation must survive into the server model.

### 2.5 Roles that exist as UI but not as data

None. Every role in the interface is a value of `access_role`. There is no admin URL
prefix, no superuser branch, no role inferred from an email domain.

---

## 3. Resources and operations

*Observation.* Derived from `FRONTEND-INVENTORY.md` §5, which maps the client's 27
mutations to a REST surface. Read and list are kept separate throughout: "may see the row"
and "may see it in a listing" are different rules with different leaks.

| Resource | Operations |
|---|---|
| `project` | list, read, create, update, delete |
| `delivery_step` | list, read, create, update, update-bulk, duplicate, delete, reorder, **transition-status** |
| `register_entry` | list, read, create, update, delete, **transition-status** |
| `document` | list (global), list (per project), read, create, update, delete |
| `document_version` | read, create (upload) |
| `invoice` | list, read, create, update, delete, **transition-status** |
| `monthly_report` | list, read, create, update *(no delete exists)* |
| `person` | list, read, create, update, deactivate, delete |
| `alert_read_receipt` | list (own), create (own) |
| reference data (`phase`, `document_template`) | list, read |
| **money projection** | read of `project.contract_value`, `cost_budget`, `cost_to_date`, `invoice.amount` and every aggregate over them |

The money projection is listed as a resource because `DATA-MODEL-DRAFT.md` §3.6 treats it
as one: it is a column-level read permission that cuts across `project` and `invoice`.

---

## 4. Permission matrix

> ### The governing principle
>
> Established by AZ-D4 and AZ-D1 together, and it decides every cell below:
>
> **`access_role` decides what *kind* of information a person may ever see.
> The project relationship decides *which projects* they see it on.
> A relationship never widens the kind.**
>
> So: a Team member assigned to a project still sees no money and no register, however
> senior their work. A Project lead sitting in the manager's seat still sees no money.
> Anyone who genuinely needs money must have their **role** changed, not their seat.

*Proposal.* Cells are **allow**, **deny**, or **allow-if-\<rule\>** naming a rule from §5.
Deny is the default wherever the documents do not justify an allow.

`D` = Director · `PM` = Project manager · `PL` = Project lead · `TM` = Team member

**All cells assume `person.active = true` (D2). Every cell is deny for an inactive
principal.**

### project

| Operation | D | PM | PL | TM |
|---|---|---|---|---|
| list | allow (all `active`) | allow-if `RUNS` | allow-if `RUNS` | allow-if `ASSIGNED_ON` |
| read — full row | allow | allow-if `RUNS` | allow-if `RUNS`, money stripped | **deny** |
| read — **header projection only** | — | — | — | allow-if `ASSIGNED_ON` |
| create | allow | allow | deny | deny |
| update (setup) | allow | allow-if `MANAGES` | deny | deny |
| update (money fields) | allow | allow-if `MANAGES` | deny | deny |
| **archive** (N5) | allow | allow-if `MANAGES` | deny | deny |
| **cancel** (N6) | allow | deny | deny | deny |
| ~~delete~~ | **removed — see AZ-D6** | — | — | — |

**The header projection — defined by N7.** A Team member receives exactly:

| Field | Note |
|---|---|
| `project.name` | |
| `project.client` | via `client_organisation.name` |
| project manager | **name**, resolved from `project_manager_id` |
| project lead | **name**, resolved from `project_lead_id` |

**Nothing else.** Not contract ref, service schedule ref, delivery tier, project email,
client-side contact names, start or completion dates, support period, repository
location, workbook dates, or any money field.

Note it resolves two person ids to names, so the projection performs a join the Team
member is not themselves permitted to make. It is a server-side projection, not a
filtered row.

`create` for PM: `canCreateProject` is role-only (`FRONTEND-INVENTORY.md` §4) — there is no
relationship to check, since the project does not exist yet. See H9 on what the creator
may set.

### delivery_step

| Operation | D | PM | PL | TM |
|---|---|---|---|---|
| list / read (the whole plan, read-only) | allow | allow-if `RUNS` | allow-if `RUNS` | **allow-if `ASSIGNED_ON`** |
| create / delete / reorder / duplicate | allow | allow-if `MANAGES` | allow-if `LEADS ∨ MANAGES` | deny |
| update (plan fields) | allow | allow-if `MANAGES` | allow-if `LEADS ∨ MANAGES` | deny |
| update (assignee) | allow | allow-if `MANAGES` | allow-if `LEADS ∨ MANAGES` | deny |
| update (own progress/status) | allow | allow-if `MANAGES` | allow-if `LEADS ∨ MANAGES` | **allow-if `ASSIGNED`** |
| transition-status past gate | allow-if `GATE_STEP` | allow-if `MANAGES ∧ GATE_STEP` | allow-if `(LEADS ∨ MANAGES) ∧ GATE_STEP` | allow-if `ASSIGNED ∧ GATE_STEP` |

**`delivery_step` is the one resource a Team member sees beyond their own rows.**
AZ-D1 kept the whole plan visible read-only, so people can see what sits around their
work and who owns it. Everything else on the project is closed to them.

The Team-member write row is the product's centre: `canExecuteStep` — "anyone may work a
step that is theirs". It is their only write anywhere, and it is scoped to `assignee_id`,
not to the project.

### register_entry

| Operation | D | PM | PL | TM |
|---|---|---|---|---|
| list / read | allow | allow-if `RUNS` | allow-if `RUNS` | **deny** |
| create / update / delete | allow | allow-if `MANAGES` | allow-if `LEADS ∨ MANAGES` | deny |
| transition-status past gate | allow-if `GATE_REGISTER` | allow-if `MANAGES ∧ GATE_REGISTER` | allow-if `(LEADS ∨ MANAGES) ∧ GATE_REGISTER` | deny |

**Changed by AZ-D1.** The draft let any project member read the register. A Team member
is now denied it outright: the register is the contractual submission trail with the
department, and it is not theirs to see even on a project they work on.

### document / document_version

| Operation | D | PM | PL | TM |
|---|---|---|---|---|
| list (global `/documents`) | allow — everything | allow-if `MANAGES` | allow-if `LEADS` | **allow-if `OWN_EVIDENCE`** |
| list (per project) / read | allow | allow-if `RUNS` | allow-if `RUNS` | **allow-if `OWN_EVIDENCE`** |
| create (upload) | allow | allow-if `RUNS` | allow-if `RUNS` | allow-if `ASSIGNED` — against their own step only |
| update (metadata) | allow | allow-if `MANAGES` | allow-if `LEADS ∨ MANAGES` | deny |
| delete | allow | allow-if `MANAGES` | allow-if `LEADS ∨ MANAGES` | deny |

**Substantially narrowed by AZ-D1 and AZ-D3.** The draft gave every project member read
of every document on the project. A Team member now reaches **only documents attached to
a step assigned to them** — rule `OWN_EVIDENCE` in §5.

Consequences worth stating plainly:
- A project-level document with no subject attached — a signed contract, the case ERD-D3
  explicitly permits — reaches **no Team member at all**. That is intended.
- Team members may still upload, because filing evidence is their job. But they upload
  **against their own step**, not freely against the project.
- The global `/documents` screen stays for everyone, showing each caller only what they
  are entitled to. A Team member seeing three files where a Director sees four hundred is
  correct, and the screen must not imply anything is missing.

### invoice / monthly_report

| Operation | D | PM | PL | TM |
|---|---|---|---|---|
| list / read | allow | allow-if `MANAGES` | deny | deny |
| create / update / delete | allow | allow-if `MANAGES` | deny | deny |
| transition-status past gate | allow-if `GATE_INVOICE` | allow-if `MANAGES ∧ GATE_INVOICE` | deny | deny |

Invoices and monthly reports are money artefacts. `viewMoney` is false for PL and TM
(`FRONTEND-INVENTORY.md` §4), so these rows are **deny outright** rather than
membership-scoped — a Project lead on the project still sees nothing here.

`monthly_report` has no delete operation anywhere in the model
(`DATA-MODEL-DRAFT.md` §3.4). Left absent rather than invented.

### money projection (column-level)

| Read of | D | PM | PL | TM |
|---|---|---|---|---|
| `project.contract_value`, `cost_budget`, `cost_to_date` | allow | allow-if `MANAGES` | deny | deny |
| `invoice.amount` | allow | allow-if `MANAGES` | deny | deny |
| any aggregate over the above | allow (all projects) | allow-if `MANAGES`, aggregated **after** scoping | deny | deny |

The aggregate row is the rule `FRONTEND-INVENTORY.md` finding 1 shows being broken today.
Totals must be computed over the caller's permitted row set, never filtered afterwards.

### person

| Operation | D | PM | PL | TM |
|---|---|---|---|---|
| list | allow | allow | allow | allow |
| read | allow | allow | allow | allow |
| create | allow | deny | deny | deny |
| update (any field) | allow | deny | deny | deny |
| update (**`access_role`**) | allow | deny | deny | deny |
| deactivate | allow | deny | deny | deny |
| delete | allow | deny | deny | deny |

`list`/`read` are allow for everyone: the roster populates assignee and responsible-party
pickers on every screen. **Restrict the projection** — name, job role and active status
are needed; `access_role` and `email` are not, for a Team member.

`update` is Director-only per `canManagePeople` (`FRONTEND-INVENTORY.md` §4). The
`access_role` row is called out separately because it is the escalation surface — see H3.

**No self-service row.** A person may not edit their own record, because the client has no
such screen and inventing one here would be inventing a permission. Likely a real product
gap; it belongs in a product conversation, not this matrix.

### alert_read_receipt

| Operation | D | PM | PL | TM |
|---|---|---|---|---|
| list (own) | allow-if `SELF` | allow-if `SELF` | allow-if `SELF` | allow-if `SELF` |
| create (own) | allow-if `SELF` | allow-if `SELF` | allow-if `SELF` | allow-if `SELF` |
| list/create (another's) | deny | deny | deny | deny |

`DATA-MODEL-DRAFT.md` §3.5 records that read state is currently **one global array** —
marking an alert read marks it read for everyone. The table exists to fix that; the rule
is that a receipt is writable only for `person_id = session.person_id`.

### reference data (`phase`, `document_template`)

| Operation | D | PM | PL | TM |
|---|---|---|---|---|
| list / read | allow | allow | allow | allow |
| create / update / delete | **§1 question** | deny | deny | deny |

Neither document records a UI for editing the standard template or the phase list —
`FRONTEND-INVENTORY.md` §1 route 14 shows Settings displaying the standard template
**read-only**. Who may change the delivery methodology is a real question with no answer
in either input. Deny-biased default: nobody, via the API.

---

## 5. Row-level rules

*Proposal.* Each rule with its FK path, written against `DATA-MODEL-DRAFT.md` §3.

**`SELF(person)`**
`person.id = session.person_id`
Used by: `alert_read_receipt`.

**`MANAGES(person, project)`**
`project.project_manager_id = person.id`
Used by: project update/money, all invoice and monthly_report operations, step and
register writes.

**`LEADS(person, project)`**
`project.project_lead_id = person.id`
Used by: step and register writes, document metadata writes.

**`ASSIGNED(person, step)`**
`delivery_step.assignee_id = person.id`
Used by: the Team-member step-progress write, and step status transitions.
This is the only rule that reaches an individual row rather than a project.

**`RUNS(person, project)`**
```
project.project_manager_id = person.id
∨ project.project_lead_id  = person.id
```
Used by: every read a Project manager or Project lead makes. What they see *within* the
project is then limited by role — money only for `Project manager` and `Director`.

**`ASSIGNED_ON(person, project)`**
```
∃ s ∈ delivery_step : s.project_id = project.id ∧ s.assignee_id = person.id
```
Used by: a Team member's read of the project header and the read-only delivery plan.
**Grants nothing else.** Requires a subquery against `delivery_step` on every evaluation;
a materialised view is a performance decision, out of scope here.

**`OWN_EVIDENCE(person, document)`**
```
∃ s ∈ delivery_step : s.id = document.step_id ∧ s.assignee_id = person.id
```
Used by: a Team member's document reads, globally and per project. Note it reaches
through `document.step_id` — so a document with **no** subject attached, which ERD-D3
permits, matches no Team member by construction.

> **`MEMBER` is deleted.** The draft defined it as
> `MANAGES ∨ LEADS ∨ assigned-on-a-step` and used it for *every read in the model*,
> granting a Team member the project and everything under it. **AZ-D1 rejected that.**
> It is replaced by the three rules above, which grant deliberately different things.
> Any implementation started against the earlier draft must be re-checked: a single
> `MEMBER` check where `ASSIGNED_ON` now belongs is an over-permission, and it will not
> announce itself.

**Reaching a project from a child resource** — the FK path matters, and these are different
rules:

| Resource | Path to the owning project |
|---|---|
| `delivery_step` | `delivery_step.project_id → project` |
| `register_entry` | `register_entry.project_id → project` |
| `document` | `document.project_id → project` — **direct, not via `step_id`** |
| `document_version` | `document_version.document_id → document.project_id → project` |
| `invoice` | `invoice.project_id → project` |
| `monthly_report` | `monthly_report.project_id → project` |

`document` carries its own `project_id` alongside three nullable subject FKs
(`DATA-MODEL-DRAFT.md` §3.3). Authorize on `document.project_id` directly. Reaching the
project through `step_id` would leave documents with all three subject links null —
permitted by the schema — unauthorizable.

**`VISIBLE(person, project)`**
`person.access_role = 'Director' ∨ ((RUNS ∨ ASSIGNED_ON)(person, project) ∧ project.status = 'active')`
Decides whether a project appears at all. What the caller then sees *of* it differs
sharply between `RUNS` and `ASSIGNED_ON` — see §4. The Director bypass is the model's only
unconditional grant.

**`GATE_STEP`, `GATE_REGISTER`, `GATE_INVOICE`**
Not authorization rules — **transactional invariants** that must hold at the moment of a
status transition (`DATA-MODEL-DRAFT.md` H6). Listed here because they are checked in the
same write path and are equally absent server-side:

| Gate | Condition |
|---|---|
| `GATE_STEP` | Transition to `Completed` requires `∃ document: document.step_id = step.id`, when the step's submission is required |
| `GATE_REGISTER` | Transition to `Submitted` requires `∃ document: document.register_entry_id = entry.id` |
| `GATE_INVOICE` | Transition to `Submitted` requires `∃ document: document.invoice_id = invoice.id` |

`DATA-MODEL-DRAFT.md` H6 notes a ready-made conformance suite of 38 assertions exists for
these.

---

## 6. Session and identity

*Proposal.* Nothing in this section exists today.

**What must be built.** Authentication in full: credential storage, login, session
issuance, expiry, revocation, and a password reset path. `FRONTEND-INVENTORY.md` §4
records no login screen, no credential check, no session, no token and no password field
anywhere.

**One genuine advantage over a typical handover:** because no credentials exist, none are
compromised. There are no hardcoded logins in the bundle, no cleartext passwords in
storage, nothing to invalidate on cutover. The usual "treat every stored credential as
leaked" migration step does not apply. `person.email` — eleven `@rewatu.co.za` addresses
— is the only identity data present, and it is not secret.

**What the session must carry:** `person_id` and nothing else that authorization depends
on. Role and relationships are read **from the database on every request**, never from the
token. `access_role` in a token would make every role change wait for expiry, and would
put a privilege decision inside a value the client holds.

**Values the server must never again trust as input:**

| Client-held value | Why it must be ignored |
|---|---|
| `currentUserId` | The demo user switch. Today the client picks who it is from a dropdown (`FRONTEND-INVENTORY.md` §4) |
| `access_role` in any request body | The escalation surface — H3 |
| `project_id` on a create payload | The client supplies it on document, invoice, step and report creates (`FRONTEND-INVENTORY.md` §5) — H9 |
| `person_id` on an alert read receipt | Must come from the session — §4 |
| `uploaded_by` on a document version | Currently a client-supplied display name (`DATA-MODEL-DRAFT.md` H2) |
| Any `version` number on upload | Already assigned server-side by design (`FRONTEND-INVENTORY.md` §5) |

**Revocation.** Two triggers beyond logout: `active` set to false (D2), and `access_role`
lowered. Both must take effect without waiting for token expiry, which argues for
server-side session state or short-lived tokens with a refresh check.

---

## 7. Frontend assumption vs server requirement

*Observation of the left column; proposal in the right.* Route numbering and guard facts
from `FRONTEND-INVENTORY.md` §1.

| # | Route | Client guard today | Server requirement | Verdict |
|---|---|---|---|---|
| 1 | `/` Portfolio | `visibleProjects` for the list; **none** for the route or the money aggregates | Authn; `VISIBLE` scoping; aggregates computed after scoping; deny for TM | **Stricter** |
| 2 | `/tasks` | `leadsProject` | Authn; tasks scoped to `ASSIGNED` for TM, `RUNS` otherwise | Same, plus authn |
| 3 | `/calendar` | `visibleProjects` | Authn; `VISIBLE` scoping | Same, plus authn |
| 4 | `/projects` | `visibleProjects` | Authn; `VISIBLE` scoping | Same, plus authn |
| 5 | `/projects/new` | **none** | Authn; `canCreateProject` — D or PM only; server sets creator | **Absent → must be added** |
| 6 | `/projects/:id` | `canSeeProject` | Authn; `VISIBLE` | Same, plus authn |
| 7 | `/projects/:id/setup` | `abilities` | Authn; `MANAGES` for writes; money fields per §4 | Same, plus authn |
| 8 | `/projects/:id/plan` | `abilities` | Authn; `MANAGES ∨ LEADS` for plan writes; `ASSIGNED` for own progress | Same, plus authn |
| 9 | `/projects/:id/submissions` | **none in-screen**; membership enforced by the parent layout | Authn; `RUNS` to read — **TM denied outright (AZ-D1)**; `MANAGES ∨ LEADS` to write; `GATE_REGISTER` on transition | **Stricter** — ability checks absent |
| 10 | `/projects/:id/documents` | **none in-screen**; membership enforced by the parent layout | Authn; `RUNS` to read, **`OWN_EVIDENCE` for TM (AZ-D1)**; upload scoped to own step for TM; `MANAGES ∨ LEADS` to edit or delete | **Stricter** |
| 11 | `/projects/:id/reports` | **none**; the parent hides the *tab* when `!viewMoney` but renders the route | Authn; money rules — deny for PL and TM even when they run the project (AZ-D4) | **Absent → in-project money leak** |
| 12 | `/documents` | **none** | Authn; per-caller scoping — `OWN_EVIDENCE` for TM, `RUNS` for PM/PL, all for Director (AZ-D3) | **Absent → business-wide document leak** |
| 13 | `/reports` | **none**; the sidebar hides the link via `canSeeReports` | Authn; D or PM only; aggregates scoped to `MANAGES` | **Absent → business-wide money leak** |
| 14 | `/settings` | `canManagePeople` gates the edit controls only | Authn; roster read allowed with a restricted projection; every write Director-only; `access_role` writes audited | **Stricter** |

**The pattern across rows 11, 12 and 13.** In each, a guard predicate exists in the model
and is used **only to hide a navigation link**. Hiding a link is not a control. Rows 12
and 13 are top-level routes and leak business-wide; row 11 sits under the project layout,
so it leaks to members of that project who lack `viewMoney` — narrower, still a leak.

---

## 8. Hazards

Ranked by exploitability today.

**H1 — Every route and every mutation is unauthenticated.** There is no login, no session
and no credential (`FRONTEND-INVENTORY.md` §4). Anyone who can reach the application has
Director-equivalent access, because they can select the Director from the user dropdown.
This outranks everything else and is not a finding about the design — the design assumes a
server that does not exist. Until authentication is built, nothing below is mitigated by
anything.

**H2 — Identity is a client-held value the user picks.** `currentUserId` is switched from
the account menu (`FRONTEND-INVENTORY.md` §4). Any server that accepts it as input inherits
a complete impersonation primitive. It must be deleted from the request surface, not
validated.

**H3 — Self-escalation through `person.update`.** `access_role` is an ordinary writable
column, and `person/update` takes a partial patch (`FRONTEND-INVENTORY.md` §5). The only
thing standing between a Team member and Director is `canManagePeople`, which runs in the
browser. If the server accepts a role change without checking the *caller's* role, the
lowest-privileged principal promotes itself in one request. Follow the whole path: role
change → Director → every project, all money, delete anything.

Mitigations: Director-only, never self-targeted, and audited. A Director should not be
able to change their own role either — that is how a sole Director locks the business out.

**H4 — Business-wide money leak on `/reports` and `/`.** `FRONTEND-INVENTORY.md` finding 1
records that the portfolio dashboard filters only its per-project list, while every money
aggregate — contract value, invoiced, paid, outstanding, forecast, spend against budget —
is computed over all active projects. Finding 2 records `/reports` reading the full invoice
list with no check. A Team member reaches both by typing the URL.

**H5 — Business-wide document leak on `/documents`.** Every document in the business,
including contracts and signed submissions, with no scoping and **no guard predicate
defined anywhere** (`FRONTEND-INVENTORY.md` finding 3). The other leaks are unenforced
rules; this one is a missing rule.

**H6 — Listing endpoints will leak rows the caller cannot read individually.** The general
form of H4 and H5. Every list operation in §3 needs the same rule as its read operation,
and aggregates need it applied *before* aggregation. This is the single most repeatable
mistake available in this codebase, because the client's own habit is to compute over
everything and filter afterwards.

**H7 — Project access is granted as a side effect, with no audit.** Assigning a step to
someone makes them a project member (§2.2) and gives them read access to that project's
entire document set. Anyone with `assignWork` — Director, the project's manager, the
project's lead — can do this, and nothing records that access was granted. Reassigning the
step revokes it just as silently. See D1.

**H8 — Deactivated people keep every permission.** `person.active` is consulted by no
predicate in the model (`FRONTEND-INVENTORY.md` §4 enumerates them all). A person marked
inactive in Settings retains their abilities. See D2.

**H9 — Confused deputy on every create.** The client supplies the full row on
`project/create`, `doc/add`, `invoice/add`, `report/add` and `person/add`
(`FRONTEND-INVENTORY.md` §5), including the `project_id` that decides which project's data
it lands in — and, on `project/create`, including `project_manager_id` and
`project_lead_id`. A server that inserts what it is given lets a caller write into a
project they cannot read, or name themselves onto a project. Every foreign key on a create
payload must be re-checked against the caller's permissions, not merely accepted.

**H10 — Alert read receipts are global.** `readAlertIds` is one array shared by everyone
(`DATA-MODEL-DRAFT.md` §3.5). An integrity problem rather than a disclosure one — nobody
sees another's data, but one person can suppress another's notifications. The proposed
table fixes it if the `SELF` rule is enforced on write.

**H11 — Rules that cannot be evaluated: no audit columns.** Exactly one actor-attribution
column exists across the schema (`document_version.uploaded_by_id`, and it currently holds
a display name — `DATA-MODEL-DRAFT.md` H2). There is no `created_by` anywhere. Any
ownership rule beyond the four in §5 is unwritable until the schema carries the data. See
D7.

**H12 — Name-valued attribution cannot be authorized against.** `uploaded_by` is a display
name, and `person.name` has no uniqueness constraint (`DATA-MODEL-DRAFT.md` H2, H8). Two
people with the same name are indistinguishable in upload history. Any rule of the form
"you may replace a version you uploaded" is unenforceable until this becomes an FK.

**H13 — No rate limiting, lockout or brute-force protection is specified anywhere**,
because no authentication exists to protect. Named so it is not discovered late: it is part
of building H1, not a separate later task.

---

## 9. Confidence and not covered

### Confidence by area

| Area | Confidence | Why |
|---|---|---|
| Roles and their intent (§2.1) | **High** | Explicitly documented in `FRONTEND-INVENTORY.md` §4, which calls the model complete and reusable |
| Relationship rules (§2.2, §5) | **High** | FK paths verified against `DATA-MODEL-DRAFT.md` §3 |
| Project-scoped matrix cells (§4) | **High** | Direct from the documented ability sets |
| Money projection (§4, §5) | **High** | `DATA-MODEL-DRAFT.md` §3.6 names the exact columns |
| The unguarded-route diff (§7) | **High** | `FRONTEND-INVENTORY.md` §1 marks each route explicitly |
| Status-transition permissions (§4) | **Low** | D5 — the documents establish what the gates check, not who may attempt them |
| Reference-data write permissions | **Low** | No UI exists; deny-biased default with no evidence either way |
| `person` list/read projection | **Medium** | The need for the roster is clear; which fields each role should receive is my inference |
| Session design (§6) | **Medium** | Nothing exists to derive from; §6 is conventional practice, not evidence |

### An error in an input document

**`FRONTEND-INVENTORY.md` §1 is imprecise about routes 9, 10 and 11**, in a way that
overstates the exposure.

Its route table marks `/projects/:id/submissions`, `/projects/:id/documents` and
`/projects/:id/reports` as **"No — none"** for access enforcement. Read alone, that
suggests they are open. They are not: all three are children of the `ProjectWorkspace`
layout, which the same table records at route 6 as enforcing `canSeeProject`, and which
returns a "You are not on this project" panel instead of rendering its children.

What is actually true: **membership is enforced** on those three routes by the parent
layout; what is absent is the finer per-ability check (`editRegister`, `viewMoney`). So
route 11 leaks money to members of that project who lack `viewMoney` — a Project lead or
Team member on the project — rather than to everyone. Routes 12 and 13, being top-level,
do leak business-wide.

The distinction matters for triage: H4 and H5 are reachable by any user, H6's route-11
instance is reachable only by project members. `FRONTEND-INVENTORY.md` finding 2 states the
mechanism correctly; the §1 table's shorthand is what misleads. I have not edited it —
correcting it only for this document would leave the next consumer to rediscover it.

### Not covered

- **No code was read.** Per this skill's contract, the model derives from the two
  documents. Both are marked complete against their own contracts, but both inherit the
  inventory's own limit: the application was never built or run, so every claim is a
  static read.
- **Field-level write permissions are only partly specified.** §4 separates money-field
  writes on `project` and `access_role` writes on `person`, because the documents justify
  those splits. Other columns are treated at row granularity. A full column-level matrix
  would need a product conversation about which fields each role may change.
- **No authentication mechanism is chosen.** §6 specifies what the session must carry and
  what must stop being trusted, not whether it is a session cookie, a JWT, or an external
  identity provider. That choice belongs with whoever owns the deployment.
- **No external-principal tier.** D8 — client-side people are not modelled as principals.
  If a client portal is coming, this model changes shape rather than extending.
- **Rate limiting, audit-log retention and data-export controls** are out of scope.
- ~~`project.archived` has no write path, so no archive permission appears in §4.~~
  **Resolved.** N5 and N6 settled it: `archive` is Director or the project's manager;
  `cancel` is Director-only (recommended, not yet confirmed). Both cells are in §4, and
  `archived` is now one member of a three-state `status`.

### Blocked on nothing

Both inputs were present and readable. No section of this model is partial for want of an
input; the low-confidence areas above are low because the documents genuinely do not
settle them, and each has a §1 question or an explicit deny-biased default.
