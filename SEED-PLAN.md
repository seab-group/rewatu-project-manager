# Baseline Seed — PLAN AND VALIDATION REPORT

**Status: DECISIONS APPLIED — 2026-09-10. The generator is the deliverable; the data is
a build artifact.**

Regenerated against the decided schema, twice — round 1 and round 2 (N1–N7).
Coverage went from **29 to 41 assertions** —
the new nine cover the narrowed access model (AZ-D1, AZ-D3), the at-most-one-subject
rule (ERD-D3) and the audit columns (AZ-D7).

`seed/out/` is not committed — checked-in rows make regeneration a churn diff and
turn "deterministic" into a claim nobody re-checks. Run `seed/verify.sh` to
reproduce and validate.

Built 2026-09-10 from `FRONTEND-INVENTORY.md`, `DATA-MODEL-DRAFT.md` and
`AUTHZ-MODEL-DRAFT.md`. All three were present; none was inferred from the codebase.

---

## 0. What the seed is for

In the order its consumers use it:

1. **The authorization implementation (M1, then every module).** Its first job is to
   prove authorization *refuses*. Every `allow-if` rule in `AUTHZ-MODEL-DRAFT.md` §5
   has a row the rule admits **and** a row it denies — §3.
2. **Module verification (M3–M9).** Each module's acceptance criteria in
   `MODULE-PLAN.md` §3 need data to test against; the volumes here are sized to those
   criteria, not to look plausible.
3. **Screen rendering.** Every route in `FRONTEND-INVENTORY.md` §1 renders non-empty,
   except four states seeded deliberately empty — §3.1.
4. **Migration rehearsal.** The 55-step and 22-entry standard template is carried
   across verbatim from `src/data/templates.ts` rather than regenerated, because
   `FRONTEND-INVENTORY.md` §7 identifies it as real domain content with migration
   value.

### Files

| File | Role |
|---|---|
| `seed/seed.config.json` | Seed value, base date, and every volume **with the requirement behind it** |
| `seed/parse-erd.mjs` | Parses `DATA-MODEL-DRAFT.md` §3 into `{table: [columns]}` |
| `seed/generate.mjs` | config → rows → one JSON file per table |
| `seed/schema-check.mjs` | Conformance: fails on unknown table/column; reports unseeded tables |
| `seed/coverage-check.mjs` | 29 assertions: both sides of every rule, empty states, secrets |
| `seed/verify.sh` | The acceptance test — determinism → conformance → coverage |

---

## 1. Decisions required

**S1 — Output format is JSON per table, not SQL.**
`DATA-MODEL-DRAFT.md` §0 states no database engine is assumed. Emitting dialect SQL
would settle that upstream decision as a side effect of building fixtures. A renderer
to whatever engine is chosen is a small, separate job. **Recommendation: keep JSON**
until the engine decision lands.

**S2 — Who owns the seed once modules start?**
Each module's acceptance criteria need rows that do not exist yet — M1 will add
credential columns, M6 may add real storage keys. Unowned, the seed drifts from the
schema and the conformance check starts failing for the wrong reason.
**Recommendation: the module adding a column adds its seed rows in the same change,
and `verify.sh` runs in CI.**

**S3 — Two upstream decisions would change this seed materially.**

| Decision | Effect if answered the other way |
|---|---|
| **ERD-D2** (phase lookup) | `phase` disappears; 3 columns revert to strings. 10 rows and 3 FKs affected |
| **ERD-D4** (`stored_file`) | `stored_file` disappears; 11 rows and `document_version.stored_file_id` go |
| **ERD-D7** (`client_organisation`) | 4 rows go; `project.client_id` reverts to free text |

The generator is small enough to follow any of these; they are named so nobody
mistakes the seed for evidence that the decisions are settled.

**S4 — One rule cannot be covered, and silence would read as coverage.**
`AUTHZ-MODEL-DRAFT.md` §4 marks reference-data writes (`phase`, `document_template`)
as **"§1 question"** — deny-biased, with no rule defined either way, because no UI
exists. The seed therefore has **no admit side** for that cell: there is nothing to
admit, and inventing one would fabricate a permission. Stated here rather than left
as an apparent pass.

---

## 2. Determinism

Three hazards make a seed non-reproducible. Each is one line, and each is **absent
from the generator source** — verified by grep, not asserted:

| Hazard | Occurrences outside comments | Replacement in use |
|---|---|---|
| `Math.random()` | **0** | `mulberry32(cfg.seed)` — `generate.mjs:25-33` |
| `Date.now()` / `new Date()` no-arg | **0** | `BASE = Date.parse(cfg.baseDate)`; every date is `BASE + offset * DAY` |
| `crypto.randomUUID()` / random ids | **0** | Stable readable ids — `p-tm-1`, `prj-1`, `prj-1-s14`, `dv-7` |

Also fixed: tables are emitted in **sorted** order, and object keys in declaration
order, so serialisation is stable.

**Seed value and base date live in config, not in literals.** Changing either changes
every row — a decision, not an edit. Confirmed both directions:

- Same config, two runs → `diff -r` empty (check 1).
- `seed: 1` vs `seed: 20260910` → `delivery_step.json` differs. The PRNG is genuinely
  wired in, not decorative.

The one clock-adjacent call that remains is `Date.parse` on a **fixed string** from
config, which is deterministic by construction.

---

## 3. Coverage — both sides of every rule

Rules from `AUTHZ-MODEL-DRAFT.md` §5. Asserted by `coverage-check.mjs`; all 29 pass.

| Rule | Admit side | Deny side |
|---|---|---|
| `MANAGES` | `p-pm-1` manages prj-1, prj-2, prj-4 | **`p-pm-2` holds Project manager and manages nothing** |
| `LEADS` | `p-lead-1` leads prj-1, prj-3, prj-4 | **`p-lead-2` holds Project lead and leads nothing** |
| `ASSIGNED` | `p-tm-1` has assigned steps on prj-1 | prj-1 has steps assigned to others |
| `MEMBER` | `p-tm-1` on prj-1 via assignment | **`p-tm-2` is on no project at all** |
| `MEMBER` cross-project | `p-tm-3` on prj-3 | **`p-tm-3` NOT on prj-1** — isolation |
| `VISIBLE` | active Director `p-director` | **prj-2 is archived** |
| account state (AZ-D2) | nine active people | **`p-inactive` is inactive** |
| `SELF` (receipts) | 2 receipts owned by `p-tm-1` | **1 receipt owned by `p-director`** |
| `GATE_STEP` | a submission-required step with evidence | **one without** |
| `GATE_REGISTER` | a register entry with a file | **one without** |
| `GATE_INVOICE` | `inv-1` has `doc-3` | **`inv-2`, `inv-3` have none** |
| `OWN_EVIDENCE` (AZ-D1) | `doc-10`, on a step assigned to `p-tm-1` | **every other document on `prj-1`** — their own project, still not theirs to see |
| `OWN_EVIDENCE` standalone | — | **`doc-9`** has no subject at all, so it reaches no Team member (ERD-D3) |
| `ASSIGNED_ON` vs `RUNS` | `p-pm-1` runs prj-1 | **`p-tm-1` is assigned on prj-1 but does not run it** — the two rules must resolve differently |
| `ONE_SUBJECT` (ERD-D3) | every document has ≤1 subject | asserted across all rows |
| audit `created_by` (AZ-D7) | rows with a real author | **rows with `created_by` null** — migrated, author unknown |
| money projection | `contract_value` and `amount` populated | — a projection omitting them is observable |
| `cost_budget` null-vs-zero | set on prj-1, prj-2 | **null on prj-3, prj-4** — "not captured" ≠ zero |

**AZ-D4 has a dedicated actor.** `p-lead-3` holds `access_role: 'Project lead'` and is
`project_manager_id` on prj-3 — the person who manages a project without seeing its
money. The decision is unresolved upstream; the row exists so either answer is testable.

### 3.1 Screens

Every route in `FRONTEND-INVENTORY.md` §1 renders non-empty for `p-director`. Four
states are seeded **deliberately empty**, each covering a branch nothing else reaches:

| Empty state | Covers |
|---|---|
| `prj-4` — no documents, no invoices, no monthly reports | The zero-row branch on three screens |
| `prj-4` — every step unassigned | A delivery plan with no owners |
| `p-tm-2` — on no project | Projects list, calendar and tasks all empty |
| `p-pm-2` — manages nothing | Portfolio totals are zero, not the business total. **This is also the H4 regression test**: if aggregates leak, `p-pm-2` sees the whole business instead of nothing |
| `doc-9` — `document_version.stored_file_id = null` | The "no file behind this" preview branch |

### 3.2 Secrets absent

`DATA-MODEL-DRAFT.md` §3 declares **no credential column anywhere**, because
authentication was never built (`AUTHZ-MODEL-DRAFT.md` §6). So there is nothing to
null — and the risk is the opposite one: that a later contributor adds
`password_hash: "test123"` and every downstream environment learns that is acceptable.

`coverage-check.mjs` asserts that **no column matching**
`password|passwd|secret|token|hash|salt|credential|api_key|private_key|signature`
carries a non-null value, across all six actor-bearing tables. It passes today
because no such column exists, and it will fail the moment one is seeded with a value.

---

## 4. Table coverage

**13 of 13 ERD tables seeded. None deferred.** All 19 audit columns added by AZ-D7 are
populated, and `project.status` replaces `archived` with all three members represented — the conformance check flagged them as declared-but-unseeded the moment the
ERD changed, which is the drift this check exists to catch.

| Table | Rows | Requirement source |
|---|---|---|
| `phase` | 10 | Domain-fixed (`reference.ts` PHASES) |
| `client_organisation` | 4 | One per project — ERD-D7 |
| `document_template` | 18 | Distinct templates named by the standard register |
| `person` | 10 | Every role, plus a role-holder with no relationship — §3 |
| `project` | 5 | Populated, archived, isolation, empty, **and one `cancelled`** (N6) — the cancelled row has no delivery plan, since it was created in error |
| `delivery_step` | 220 | 55 × 4 — authored template, carried verbatim |
| `register_entry` | 88 | 22 × 4 — authored template, carried verbatim |
| `document` | 10 | Gate coverage both sides ×3, plus `doc-10` attached to a step assigned to `p-tm-1` — the OWN_EVIDENCE admit row required by AZ-D1 |
| `document_version` | 12 | One per document + 3 on `doc-1`, 2 on `doc-4` |
| `stored_file` | 11 | One per version with bytes; `doc-9` deliberately has none |
| `invoice` | 4 | Gate both sides, plus Paid and Queried tone branches |
| `monthly_report` | 5 | Lodged, unlodged, invoice-linked; distinct `(project_id, month)` |
| `alert_read_receipt` | 3 | `SELF` both sides |

Volumes are checked against `seed.config.json` — the config's stated count and the
generated count agree for every table.

---

## 5. How this was validated

`seed/verify.sh`, three checks in dependency order. Conformance and coverage are
meaningless without determinism, because otherwise each run checks a different artifact.

| # | Check | Result | What it caught |
|---|---|---|---|
| 1 | **Determinism** — generate twice, `diff -r` | PASS, byte-identical | — |
| 2 | **Conformance** — every table/column against the parsed ERD | PASS, 0 errors, 13/13 seeded | **Four columns null in every row** (`delivery_step.evidence_link`, `delivery_step.notes`, `register_entry.notes`, `document.link`) — screen branches that would never have rendered. Fixed by populating a deterministic minority |
| 3 | **Coverage** — 41 assertions | PASS, 41/41 | **A wrong deny anchor.** `p-lead-2` was declared the "leads nothing" case in config while leading two projects. Caught by the `LEADS` deny assertion; leads reassigned |

**The parser was verified before being trusted.** `schema-check.mjs` depends entirely
on `parse-erd.mjs` being right, and a checker that over-reports trains the reader to
ignore it. Verified against a hand-read table: `person` → 6 columns, parser → 6.
Then against the hardest table, `project`: parser 25, grep 25, and the source
interface `src/types.ts:133-165` **25** — reconciling with exactly one intended rename
(`client` → `client_id`, per ERD-D7) and no genuine gaps.

**No check asserts a magic number.** Table and column counts are compared against the
parsed ERD; volume counts against the config's own stated requirements. The delta is
the finding.

---

## 6. Confidence

### What this validation does NOT cover

**Ranked. The first item is the most likely first-load failure.**

1. **Foreign-key integrity is unverified.** Parsing a schema *document* proves table
   and column **names**. It proves nothing about whether `delivery_step.phase_id`
   points at a `phase` row that exists, because no database exists yet to enforce it.
   The generator constructs FKs from in-memory lookups so they should be sound, but
   **should is not checked**. This is the most likely first-load failure.
2. **Uniqueness is unverified.** `DATA-MODEL-DRAFT.md` H8 proposes five UNIQUE
   constraints — `person.email`, `invoice.number`, `(monthly_report.project_id, month)`,
   `(document_version.document_id, version)`, `(alert_read_receipt.person_id, alert_key)`.
   The seed satisfies all five by construction; none is asserted.
3. **Check constraints are unverified.** `percent_complete` 0–100, `file_size` ≤ 25 MB,
   and the ERD's "at most one document subject FK non-null" CHECK.
4. **Enum membership is unverified.** Values were taken from the ERD §5 member lists,
   but `schema-check.mjs` validates column *names*, not whether `status` holds a legal
   member.
5. **Nullability is unverified.** The ERD marks each column's nullability; nothing
   checks that a `no` column is never null.

Items 2–5 are all cheap to add **once an engine is chosen** (S1), which is the honest
reason they are absent rather than an oversight.

### Never validated against a database

This seed has been validated against **three documents**, not against a running
schema. It has never been loaded. Every conformance claim above is a claim about
agreement with `DATA-MODEL-DRAFT.md`, which is itself an unreviewed draft carrying
nine open decisions.

### Weakest parts, ranked

1. **FK integrity** — above.
2. **The seed rests on an unreviewed ERD.** Three open decisions (S3) would each
   remove a table this seed populates.
3. **Date realism.** All dates are `baseDate + offset`, so the fixture ages: rows
   "overdue" today drift further overdue as real time passes. Deliberate — a moving
   `Date.now()` would break determinism — but it means the seed's *relative* time
   picture is only accurate near `baseDate`. `DATA-MODEL-DRAFT.md` D5 (timezone) is
   unresolved, and this seed assumes plain calendar dates in no zone.
4. **`document_template` free-form members.** Two of the 18 ("Own format, per the TOR",
   "Per the standard") are genuinely free text and arguably should not be catalogue
   rows — `DATA-MODEL-DRAFT.md` §9 flags this as the ERD's second-weakest proposal.
   The seed materialises them as rows, so it inherits that weakness.
5. **Step progress is index-derived.** `percent_complete` is a function of row index
   and project, not of anything domain-meaningful. It renders correctly and drives the
   flag rule, but nobody should read the seeded plan as a plausible project history.

### An error in an input document

**`DATA-MODEL-DRAFT.md` §3.2 says `project` has "26 fields".** It has **25** — the
document's own column table lists 25 rows, and the source interface
`src/types.ts:133-165` declares 25. The prose count is off by one; the table itself is
correct, and the parser agrees with the table.

Caught while verifying the parser against a hand-read table — which is precisely why
that verification step exists. Not edited: correcting it only here would leave the next
consumer to rediscover it, and `DATA-MODEL-DRAFT.md` has other readers.

### Not attempted

- **No database engine chosen, no DDL, no migrations** — out of scope, and S1 explains
  why emitting SQL would overreach.
- **The generated rows are not committed** — `seed/.gitignore` excludes `out/`.
- **The standard template was not regenerated.** 55 delivery steps and 22 register
  entries are read from `src/data/templates.ts` and instantiated verbatim, because
  `FRONTEND-INVENTORY.md` §7 identifies them as migration payload rather than fixture.
