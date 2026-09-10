# Phase 0 — Decisions Log

Answers to the open decisions raised in `DATA-MODEL-DRAFT.md` §1 (`ERD-*`),
`AUTHZ-MODEL-DRAFT.md` §1 (`AZ-*`) and `MODULE-PLAN.md` §1.2 (`P-*`).

Answered by the product owner in session, 2026-09-10. Recorded as given; where an
answer creates new work not in the original drafts, that is noted under **Follow-on**.

**All 17 open decisions answered**, plus 3 raised in session, plus **all 7 round-2
questions** (N1–N7) — 27 in total.

**Two answers override the upstream drafts and must be applied before anyone builds:**
`AZ-D1` (access scoping) and `ERD-D4` (SharePoint integration). Both are marked in place below.

---

## AZ-D2 — Does `active = false` revoke access?

**ANSWERED: locked out completely.**

An inactive person cannot sign in at all. Their name stays on past work — uploads,
completed steps, projects they managed — so history is preserved.

**Context that produced the answer.** The most common real case at Rewatu is a
contractor's engagement ending (the job-role list already carries `External`,
`Department` and `Department and provider`, and roles like Designer and Trainer are
typically per-engagement). Someone rolling off should stop reading client contracts
and invoices, but may be re-engaged later — so deactivate, never delete.

A second "On leave" state was offered and declined. It can be added later without
reworking this decision.

**What changes:**
- Every permission predicate gains an `active` check — none has one today.
- An inactive person's existing session is terminated, not left to expire
  (`AUTHZ-MODEL-DRAFT.md` §6, revocation).
- `AUTHZ-MODEL-DRAFT.md` §4: every matrix cell is deny for an inactive principal.
  This was already the draft's deny-biased assumption; it is now confirmed rather
  than assumed.

**Delete vs deactivate, settled as a consequence:** anyone who has ever been assigned
a step, uploaded a file or managed a project is deactivated. Hard delete is reserved
for a person added in error who has touched nothing — which resolves
`DATA-MODEL-DRAFT.md` **ERD-D8** in the same stroke.

---

## Deactivation and work in progress — *new decision, raised in session*

**ANSWERED: warn, list the work, allow the deactivation to proceed.**

Deactivating someone who owns delivery plan steps shows a dialog naming what they
own — "12 steps across 3 projects" — and lets the operator continue. Reassignment
happens afterwards, at Rewatu's pace.

Rejected: blocking until reassigned (traps you when someone leaves at short notice),
auto-handing work to the project manager (silent), and today's behaviour of allowing
it with no warning at all.

**Follow-on — not in any draft, needs building:**
- A "what does this person own" query: steps assigned, projects managed, projects led.
- The warning dialog itself.
- Work owned by an inactive person must remain visible to project managers, or it
  disappears from view along with its owner.

**Lands in** `MODULE-PLAN.md` **M1**.

---

## Treated as a defect, not a decision

The delivery plan's assignee picker lists **inactive** people, while the project
manager and project lead pickers exclude them — `DeliveryPlan.tsx:402` and `:540`
pass `state.people` unfiltered, where `NewProjectWizard.tsx:94` and
`ProjectSetup.tsx:115` filter on `p.active`. Inconsistent; the pickers will be made
to match. No decision required.

---

## AZ-D7 — Audit columns

**ANSWERED: record who created it, and who last changed it.**

Every project, delivery step, register entry, invoice and monthly report gains
`created_by` / `created_at` and `updated_by` / `updated_at`.

Full per-field change history (offered as option C) was declined. Note it cannot be
reconstructed later — from cutover onward only the *last* change is attributable.
If disputes with departments about submission and acknowledgement dates become a
recurring problem, adding history to those specific fields is a separate, later change.

**What changes:**
- `DATA-MODEL-DRAFT.md` §3: four columns added to five tables. Not in the draft —
  the ERD flagged their absence in `AUTHZ-MODEL-DRAFT.md` H11 but proposed none.
- `MODULE-PLAN.md` M1 sets the pattern; every module carries it.
- Resolves `AUTHZ-MODEL-DRAFT.md` **AZ-D7**.

---

## ERD-D2 — Does a `phase` lookup table exist?

**ANSWERED: yes, phases become a proper managed list.**

A `phase` table with `ordinal` and `name`. The three columns that currently hold phase
strings — `delivery_step.phase`, `register_entry.phase`, `invoice.linked_phase` —
become foreign keys to it.

**Why it mattered.** The same concept is stored three different ways today:
`"1 Initiation"` (ordinal + name), `"2"` (ordinal only), and `"2 Planning"`. They are
joined by string prefix matching — `steps.filter(s => s.phase.startsWith(\`${e.phase} \`))`
at `factory.ts:80`. Renaming a phase silently breaks the delivery-plan-to-register link
with no error. The lookup table removes that join.

**What changes:**
- `DATA-MODEL-DRAFT.md` §3.1 `phase` table is confirmed, not conditional.
- `MODULE-PLAN.md` M2 keeps its largest table; the M2→M4/M5/M7 dependency edges stand.
- The 10 members are domain data, not fixture — they migrate, they are not invented.

---

## ERD-D7 — Is `client` an organisation entity?

**ANSWERED: yes, client departments become a managed pick-list.**

A `client_organisation` table. `project.client` (free text) becomes
`project.client_id`.

**Why.** Rewatu works with the same national departments repeatedly, so a typo would
split one department across two names in reporting, and there is currently no way to
total work per department.

**What changes:**
- `DATA-MODEL-DRAFT.md` §3.1 `client_organisation` is confirmed, not conditional.
  This was the draft's own weakest proposal (§9, ranked first) — the evidence in the
  data was thin, four departments with one project each. Confirmed on domain grounds.
- `MODULE-PLAN.md` M2 owns the table; the M2→M3 edge stands.
- Migration: the four existing free-text values map to rows. Any future variant
  spelling has to be reconciled by a human, not automatically.

**Still open:** whether Rewatu can add a department itself, or whether the list is
maintained centrally. That falls under the reference-data authoring surface, which
does not exist today (`MODULE-PLAN.md` §6 item 3).

---

## ERD-D5 — Temporal representation and timezone

**ANSWERED: all dates and all overdue logic run on South African time (SAST), decided
server-side.**

Confirmed in session: everyone at Rewatu is in South Africa, and so are the client
departments. No staff or clients outside SA.

**What changes:**
- Due dates, planned start/end, submission and acknowledgement dates are stored as
  plain calendar dates. `document_version.uploaded_at` and `project.created_at` stay
  full timestamps.
- **"Is this overdue?" is evaluated on the server in SAST, never from the client's
  clock.** Today every date rule uses `today()` taken from the browser
  (`derive.ts`, `now = today()` throughout), so a user changing their machine clock
  changes what the system considers overdue.
- Empty string stops meaning "not set" — those become `NULL`
  (`DATA-MODEL-DRAFT.md` H3). This affects roughly 20 date columns.

**Why this was easy and usually is not:** SAST is UTC+2 with **no daylight saving**,
so the recurring-event and DST-boundary problems that make this decision expensive
elsewhere do not arise. Worth recording, because that is the assumption that would
break if Rewatu ever took on work in another country.

**Blocked 7 of 9 modules** — the widest single decision in the set. Now unblocked.

---

## AZ-D1 — Does step assignment grant access to the whole project?

**ANSWERED — and the answer is stricter than any option offered. This one reshapes
the permission matrix.**

Assignment does **not** grant access to the project as a whole. A Team member sees:

- **their own assigned steps** — full detail, and they may work them;
- **the rest of that project's delivery plan, read-only** — so they can see what sits
  around their work and who owns it;
- **nothing else.**

Explicitly **denied** to a Team member, even on a project they are working on:
contracts, invoices, monthly reports, all money fields, project setup, and the
project's document library other than evidence attached to steps.

Product owner's words: *"access to contracts, invoicing and high level project info
is separate — users must only see the work they are assigned to and nothing else."*

### What this changes in `AUTHZ-MODEL-DRAFT.md`

The draft's `MEMBER` rule granted blanket read of a project and everything under it,
including its whole document set. **That is now wrong** and §4 must be reworked:

| Resource | Draft said (Team member) | Now |
|---|---|---|
| `project` read | full row, money stripped | name, client, dates and phase only — **not** setup, locations, refs |
| `delivery_step` read | whole plan | whole plan, read-only — **unchanged** |
| `document` list/read | every document on the project | only documents attached to a step assigned to them |
| `register_entry` read | whole register | **denied** — the register is the contractual submission trail |
| `invoice`, `monthly_report` | already denied | unchanged |

`MEMBER` splits into two rules: **`ASSIGNED_ON(person, project)`** — grants the
read-only plan view — and the existing per-row `ASSIGNED(person, step)` for their own
work. The old blanket `MEMBER` read disappears.

### Follow-on

- The document rule stops being project-scoped and becomes step-scoped for Team
  members, which the draft did not anticipate. `MODULE-PLAN.md` M6 gains work.
- `AZ-D3` (is the global document list scoped?) is **partly pre-answered**: for a Team
  member it must be scoped to their own steps' evidence, not to their projects.
- A Team member's task view must still show enough project context — project name,
  phase, client — to be usable. That minimal projection needs defining.

**Supersedes** the draft's `MEMBER` definition. `AUTHZ-MODEL-DRAFT.md` §4 and §5 need
revising against this before anyone builds from them.

---

## ERD-D4 — Does the system store files, or do they stay in SharePoint?

**ANSWERED: both. Azure Blob Storage holds the bytes; SharePoint remains document
management; uploads are pushed to SharePoint automatically so the two stay in step.**

Product owner: *"we need SharePoint for document management and blob storage for
storing the files."* Then chose the synchronising option over Blob-only.

**What this confirms:**
- `stored_file` exists as a table (`DATA-MODEL-DRAFT.md` §3.3) — it was conditional on
  this decision. `storage_key` points at a Blob object.
- `MODULE-PLAN.md` M6 keeps its full scope, and gains a SharePoint integration that
  was in **no draft**. M6 was already the module with the most never-built work; this
  enlarges it.
- The three completion gates become genuinely enforceable — the server can verify a
  file exists, which it cannot do against a free-text SharePoint path.

**Follow-on — none of this is in any draft, and it is not small:**
1. **SharePoint write integration** — auth (app registration / Graph API), the target
   site and folder per project, failure handling.
2. **Which one wins on conflict.** If a file is edited in SharePoint after upload,
   does the system re-pull it, overwrite it, or flag it? Undecided.
3. **Does the push happen synchronously or in the background?** A synchronous push
   makes every upload depend on SharePoint being reachable.
4. **The existing `project.working_document_location` / `approved_document_location`
   free-text paths** now overlap with a real integration. They are either the
   integration's configuration or they are dead. Undecided.
5. **Retention and deletion.** Deleting a document in the app — does the SharePoint
   copy go too?

**Recommend these five reach a decision before M6 starts**, since they change its shape
rather than its detail.

---

## AZ-D5 — Who may move a record past a gate?

**ANSWERED: the assignee may complete their own step; the project manager and lead may
complete any step on their project.**

Matches how the tasks screen already works — a person works the steps that carry their
name (`canExecuteStep`, "anyone may work a step that is theirs").

**What changes:**
- `AUTHZ-MODEL-DRAFT.md` §4 `delivery_step` transition row is confirmed as drafted.
- The gate itself is unaffected by who triggers it: `GATE_STEP` still requires an
  evidence document to exist, whoever attempts the transition.

**Still open, and not the same question:** who may mark a **register entry** Submitted
and an **invoice** Submitted. Team members are denied the register outright under
`AZ-D1`, so those two transitions sit with the project manager and lead by default.
Confirm if that is wrong.

---

## AZ-D6 + ERD-D9 — Project deletion and archiving

**ANSWERED: projects are never deleted. Archiving is the only disposal route.**

This settles two open decisions at once.

- **AZ-D6** (may a PM delete their own project?) — moot. Nobody deletes.
- **ERD-D9** (build the archive write path, or drop the column?) — **build it.**
  `project.archived` stops being a column that is read in eight places and written
  nowhere, and becomes the supported action.

**What changes:**
- The `project` delete operation comes out of `AUTHZ-MODEL-DRAFT.md` §4 entirely.
  The five-table cascade documented in `DATA-MODEL-DRAFT.md` §3.2 is no longer needed
  for projects — nothing will ever trigger it.
- `MODULE-PLAN.md` M3 loses delete and gains archive. §6 item 5 ("project archiving
  never built") moves from a gap to required scope.
- Who may archive is **not yet decided** — Director only, or the project's manager
  too? Recommend the project's manager plus Director, since archiving is reversible
  and deletion was the dangerous part.

**Open edge case — needs an answer, small but real.** A project created by mistake
(wrong client, duplicate, test row) can now never be removed. It will sit archived
forever and appear in any report that includes archived projects. Options: accept it,
allow a Director-only hard delete for projects with no activity, or a "voided" state
distinct from archived. **Not decided.**

---

## ERD-D1 — Are client-side people a second population?

**ANSWERED: no. They stay as free-text names on the project.**

`project.client_project_manager` and `project.client_business_owner` remain plain text
columns. No `client_contact` table.

**What this means in practice:** the system cannot hold a client contact's email or
phone, cannot show all projects for one client contact, and a renamed or replaced
contact leaves no history. Accepted deliberately.

**Note the asymmetry with ERD-D7,** which was answered the other way — client
*organisations* became a managed list, client *people* did not. That is coherent:
departments recur across projects and need totalling; individual contacts do not, and
each project names its own.

**Reversible later** — promoting these two columns to a table is a contained change,
and the free-text values migrate into it. `AZ-D8` (are client people ever principals?)
stays out of scope as a consequence: they are not modelled, so they cannot log in.

---

## ERD-D6 — `'Not applicable'` as a submission status

**ANSWERED: same thing. Keep only `'Not required'`.**

The submission column keeps its six documented values. `'Not applicable'` is **not**
added as a seventh.

**What this means:** the branch at `derive.ts:40` inside `stepFlag` —

```ts
(step.submission as string) === 'Not applicable' ||
```

— is **dead code**, and the cast to `string` that was needed to write it is the tell.
It is removed. This is the rule the README calls the one the whole system exists for,
so removing a branch from it is worth doing deliberately rather than leaving it to be
tidied by whoever touches the file next.

**Unaffected:** `'Not applicable'` remains a legitimate value on two *other* fields
where it means something different and real —
- `delivery_step.status` — this step does not apply to this project;
- `delivery_step.acknowledged` — no acknowledgement is expected.

Those keep it. Only the submission column loses it.

**Verification:** `scripts/verify-rules.ts` has 38 assertions over `stepFlag`. Any that
exercise the removed branch must be updated with it, not deleted silently.

---

## ERD-D3 — How a document attaches to its subject

**ANSWERED: at most one subject, and none is allowed.**

A document attaches to a delivery step, **or** a register entry, **or** an invoice —
never more than one — **or** to nothing at all, sitting at project level. A signed
contract is the obvious case for the last one.

*(Recorded reading: option C was taken to mean "zero or one", not "zero or many".
If it was meant as "a document may attach to several things", say so — it changes the
constraint below from a CHECK to a junction table.)*

**What changes:**
- Keeps the three nullable typed foreign keys — `step_id`, `register_entry_id`,
  `invoice_id` — as drafted in `DATA-MODEL-DRAFT.md` §3.3. The polymorphic
  `subject_type` + `subject_id` alternative is rejected, which preserves real
  referential integrity on each link.
- **Adds the CHECK the draft flagged as missing:** at most one of the three is
  non-null. Nothing enforces this today.
- `document.project_id` stays and does the real work — it is how a standalone document
  belongs anywhere, and it is what authorization is evaluated against.

**Interaction with AZ-D1.** Team members now see only documents attached to steps
assigned to them. A standalone project-level document — a contract — therefore reaches
no Team member at all, which is consistent with the access decision.

---

## AZ-D4 — Project lead who is named as a project's manager: money?

**ANSWERED: no. High-level project information is granted by role, not by the seat.**

A person whose `access_role` is `Project lead` sees no money on any project, including
one where they are named `project_manager_id`. Being put in the manager's seat does not
raise what they are allowed to see.

### The governing principle, stated once

This is the second decision to land the same way (see also `AZ-D1`), so it is recorded
as a rule for the whole model rather than a case:

> **`access_role` decides *what kind* of information a person may ever see.
> The project relationship decides *which projects* they see it on.
> A relationship never widens the kind.**

Consequences that follow without needing separate decisions:
- A `Team member` assigned to a project sees no money and no contractual register,
  however senior their work.
- A `Project lead` managing a project runs its delivery and sees no money.
- Only `Project manager` and `Director` roles ever reach money, and a Project manager
  only on projects they manage.
- Anyone who genuinely needs money on a project must have their **role** changed, not
  their seat.

**What changes:** `AUTHZ-MODEL-DRAFT.md` §4 as drafted is correct on this point.
The draft flagged it as "subtle enough that a wrong answer is unlikely to be noticed in
testing" — it is now confirmed, not assumed.

---

## AZ-D3 — Is the global document list scoped?

**ANSWERED: the screen stays, scoped per caller. Everyone sees it; everyone sees only
what they are entitled to.**

What each role gets on `/documents`, following from `AZ-D1` and `AZ-D4`:

| Role | Sees |
|---|---|
| Director | Every document in the business |
| Project manager | Every document on projects they manage |
| Project lead | Every document on projects they lead |
| Team member | **Only documents attached to steps assigned to them** |

**What changes.** This is the gap where no guard predicate existed at all — the screen
renders `state.documents` unfiltered today, and its own subtitle says *"across every
project"*. It was the one finding where the model was missing a rule, not merely
failing to apply one. The rule now exists.

**Note the Team member row is much narrower than the draft assumed** — it is
step-scoped, not project-scoped, because of `AZ-D1`. A Team member on a project will
see very few documents here, and none of its contracts. That is intended.

**Follow-on:** the screen's counts and empty states need to reflect the caller's scope.
A Team member seeing "3 files" where a Director sees "400" is correct, and the screen
must not imply anything is missing.

---
---

# Round 2 — decisions raised by round 1

Answered in session 2026-09-10, immediately after the seventeen above.

---

## N1 — SharePoint/Blob conflict: which wins?

**ANSWERED: SharePoint wins. The app pulls the newer version back in.**

**This makes the integration two-way, and that is a material increase in scope.**
ERD-D4 as recorded was a one-way push on upload. To honour "SharePoint wins", the app
must **detect** that a SharePoint copy changed — which needs either Microsoft Graph
change notifications (a subscription, an endpoint to receive them, renewal handling) or
periodic polling of every project folder.

Consequences to design, none of which existed before this answer:
- A pulled-back change creates a **new `document_version`** — the version history must
  record that the change came from SharePoint, not from a person using the app.
- `document_version.uploaded_by_id` has no answer for such a row. Either it is null with
  a source flag, or the SharePoint editor is resolved to a `person`. **Undecided.**
- The three completion gates read "a document exists". A SharePoint-side edit could in
  principle replace evidence *after* a step was completed against it. Nothing currently
  contemplates that.

**Recommend this is re-costed before M6 starts.** It is a different piece of work from
the one ERD-D4 described.

---

## N2 — Is the SharePoint push synchronous or background?

**ANSWERED: background.** The upload completes as soon as Blob has the file; SharePoint
catches up afterwards.

Right call — a synchronous push would make every upload fail whenever SharePoint is
unreachable, and the app's own gates only need Blob.

**Follow-on:** a job queue with retries, and a visible state for "in Blob, not yet in
SharePoint". A silent failure here means a document the team believes is filed is not.
The UI needs to show that state rather than implying success.

---

## N3 — Does deleting in the app delete the SharePoint copy?

**ANSWERED: no. SharePoint keeps everything.**

Deleting a document in the app removes the app's record. The SharePoint copy stays.

Appropriate for signed submissions to government departments, where a retention
obligation may apply. **Not verified against an actual retention policy** — if one
exists, check this against it.

**Follow-on:** the two stores now diverge by design. A document deleted in the app and
still in SharePoint will, under **N1**, look like a SharePoint-side change. The
pull-back logic must not resurrect deleted documents. This is a real bug waiting to
happen and it sits exactly at the join between N1 and N3.

---

## N4 — What are the free-text folder-path fields for?

**ANSWERED: remove them.** The app decides its own SharePoint folder structure.

`project.working_document_location` and `project.approved_document_location` are
dropped.

**`project.system_repository_location` is NOT dropped** — it is the code repository
location, a different thing from document filing, and was not part of this question.

**What changes:** `DATA-MODEL-DRAFT.md` §3.2 loses two columns. The app needs a
deterministic folder convention per project instead — that convention is now a design
decision nobody has made.

---

## N5 — Who may archive a project?

**ANSWERED: Directors, and the project's own manager.**

Archiving is reversible, which is what makes this safe where deletion was not.

**What changes:** `AUTHZ-MODEL-DRAFT.md` §4 `project` archive row becomes
allow / allow-if `MANAGES` / deny / deny.

---

## N6 — A project created by mistake

**ANSWERED: a separate "cancelled" state, kept apart from archived projects.**

**This is a schema change.** `project.archived` (boolean) becomes a lifecycle status:

| Status | Meaning |
|---|---|
| `active` | Normal |
| `archived` | Real work, finished, kept for the record |
| `cancelled` | Created in error, or abandoned. Excluded from reporting by default |

**What changes:**
- `DATA-MODEL-DRAFT.md` §3.2: `archived boolean` → `status` enum, three members.
- The eight places that read `!p.archived` become `status = 'active'`.
- Reporting must exclude `cancelled` by default — that is the whole point of separating
  it from `archived`.
- **Who may cancel, and can it be undone?** Recommend Director-only and reversible.
  **Undecided.**

---

## N7 — The Team-member project header projection

**ANSWERED: name, client, project manager and project lead.**

A Team member's task list shows the project's `name` and `client`, and the names of its
`project_manager_id` and `project_lead_id` — so they know who to ask.

**Explicitly not shown:** contract ref, service schedule ref, delivery tier, project
email, client-side contact names, start and completion dates, support period, every
money field, the repository location, and the workbook dates.

**What changes:** `AUTHZ-MODEL-DRAFT.md` §4 `project` — the header projection is now
defined rather than deferred. Note it resolves two person ids to **names**, so the
projection needs a join the Team member cannot make themselves.
