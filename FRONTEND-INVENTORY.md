# Frontend Inventory — REWATU Project Management System

Extracted 2026-09-10 from `seab-group/rewatu-project-manager` @ `26ddc67`.
Read-only extraction. No source file was modified.

---

## 0. Headline

**Stack:** Vite 5 + React 18.3 + TypeScript 5.6 SPA, React Router 6 (client-side),
Tailwind 3. Pure web — no React Native, Electron or Tauri markers.

**Wiring state: NOT WIRED.** There is no network layer of any kind. All state lives
in a single `useReducer` over an in-memory object graph, seeded on every page load
from `src/data/seed.ts`. Nothing is persisted anywhere — not to a server, and not to
browser storage. A reload discards every change and re-seeds the demo.

The contract this backend must implement is therefore **not** in any API call. It is
in the reducer at `src/store/AppStore.tsx:10-37` (27 typed actions), the entity types
at `src/types.ts`, and the business rules at `src/lib/derive.ts`. Those three files are
the specification. They are unusually complete and internally consistent — this is a
deliberately-shaped prototype, not an abandoned one.

---

## 1. Screens and routes

All routes declared in one place: `src/App.tsx:31-51`. **Every screen is on the mock
side of the line** — the project is not partially wired, so there is no per-screen
split to record. What varies per screen is *access enforcement*, tabulated below.

Router mode is switchable: `BrowserRouter`, or `HashRouter` when `VITE_HASH_ROUTER`
is set (`src/App.tsx:25`) for single-file builds with no server to rewrite paths.

| # | Path | Component | Access enforced in-screen? |
|---|---|---|---|
| 1 | `/` | PortfolioDashboard | Partial — see finding 1 |
| 2 | `/tasks` | MyTasks | Yes — `leadsProject` (`MyTasks.tsx:42`) |
| 3 | `/calendar` | CalendarPage | Yes — `visibleProjects` (`CalendarPage.tsx:43`) |
| 4 | `/projects` | ProjectsList | Yes — `visibleProjects` (`ProjectsList.tsx:28`) |
| 5 | `/projects/new` | NewProjectWizard | **No — none** |
| 6 | `/projects/:projectId` | ProjectWorkspace → ProjectDashboard | Yes — `canSeeProject` (`ProjectWorkspace.tsx:29`) |
| 7 | `/projects/:projectId/setup` | ProjectSetup | Yes — `abilities` (`ProjectSetup.tsx:56`) |
| 8 | `/projects/:projectId/plan` | DeliveryPlan | Yes — `abilities` (`DeliveryPlan.tsx:50`) |
| 9 | `/projects/:projectId/submissions` | SubmissionsRegister | **No — none** |
| 10 | `/projects/:projectId/documents` | ProjectDocuments | **No — none** |
| 11 | `/projects/:projectId/reports` | ProjectReports | **No — none** (money screen) |
| 12 | `/documents` | DocumentsGlobal | **No — none** |
| 13 | `/reports` | Reports | **No — none** (money screen) |
| 14 | `/settings` | Settings | Partial — `canManagePeople` gates edit controls only |
| — | `*` | `<Navigate to="/" replace />` | n/a |

Dynamic segment: `:projectId` only. Nested routes 6–11 render inside the
`ProjectWorkspace` layout, which holds the sole project-level guard.

**Server-side files: none.** No middleware, no route handlers, no controllers, no
loaders or actions. This is a pure client.

The six files with **zero** references to any permission symbol — verified by grep for
`abilities|can\.|canSee|canCreate|canManage|currentUser|accessRole|viewMoney|editRegister`
across the whole file — are `Reports.tsx`, `ProjectReports.tsx`, `NewProjectWizard.tsx`,
`DocumentsGlobal.tsx`, `SubmissionsRegister.tsx`, `DocumentsView.tsx`.

*Note:* the README claims axe was run across "all eleven routes"; the router declares
14 renderable destinations. The three unaccounted for are not identified.

---

## 2. API calls

**Zero.** This is a searched result, not an unexamined absence. Four passes:

| Pass | Patterns | Result |
|---|---|---|
| 1 | `fetch`, `axios`, `XMLHttpRequest`, `ky`, `superagent`, `/api/` | 1 hit, not a server call — see below |
| 2 | `websocket`, `eventsource`, `socket.io`, `pusher`, `ably`, `graphql`, `gql\``, `apollo`, `urql`, `relay`, `trpc`, `firebase`, `supabase`, `amplify`, `appwrite`, `parse` | 0 real hits (all matches were `parseISO`/`parseAmount`/`parseLooseDate`) |
| 3 | `https?://`, `import.meta.env`, `process.env`, `VITE_`, `BASE_URL`, `API_` | 0 endpoints — see below |
| 4 | MSW, json-server, Mirage, WireMock, `__mocks__`; committed OpenAPI/Swagger/Postman | 0 — no mock server, **no committed API spec** |

The single `fetch` is `src/components/documents/DocumentsView.tsx:108`:
`await fetch(v.objectUrl).then((r) => r.blob())` — reading back an in-memory
`blob:` URL created by the upload dialog. Not a network call.

Pass-3 hits accounted for: `VITE_HASH_ROUTER` (a routing-mode flag, `App.tsx:25`,
`vite-env.d.ts:5`); OOXML XML namespaces in the hand-rolled xlsx writer
(`src/lib/xlsx.ts:132-186`); and two `placeholder="https://…"` attributes on
free-text link inputs (`Upload.tsx:264`, `StepEditor.tsx:129`).

There is no base URL, no auth header, no environment pointing at any service.

**Confirming corroboration** — the codebase says so itself:
- `src/components/documents/Upload.tsx:74` — *"No back end yet, so the transfer is simulated"*
- `src/lib/permissions.ts:7` — *"There is no authentication yet"*
- `src/types.ts:24` — *"A back-end will map these off real accounts"*
- `README.md` — *"There is no back end yet; the shape of the store is what a back end will fill."*

---

## 3. Persistence layer

**Nothing is persisted. There are no storage keys to enumerate.**

Verified across three widening passes, all returning zero in `src/` and `scripts/`:

| Pass | Patterns | Result |
|---|---|---|
| 1 | `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie`, `caches.`, `navigator.storage` | **NONE** |
| 2 | `redux-persist`, `zustand`, `persist`, `mobx`, `pinia`, `dexie`, `idb-keyval`, `localforage` | **NONE** (one prose hit: the word "persistent" in a comment) |
| 3 | `getItem`, `setItem`, `removeItem`, `hydrate`, `save(`, `load(`, `persist`, `STORAGE_KEY`, `_KEY` | **NONE** relating to storage |

State origin is a single call: `useReducer(reducer, undefined, buildInitialState)`
at `src/store/AppStore.tsx:254`, where `buildInitialState` (`src/data/seed.ts:370`)
constructs the whole graph fresh. The seed uses a deterministic LCG
(`seed.ts:10-16`) so the demo is byte-identical on every load.

**This is not the seed-plus-mutation-delta pattern.** There is no overrides map, no
locally-created list, no deleted-ids set, no dirty flag, no pending queue. The seed is
the initial value of a reducer, and mutations are applied to it in memory and lost on
unload. Consequently there is no client-side emulation of persistence for the backend
to mirror — but there is a complete, explicit **mutation vocabulary**, which is
section 5.

The one storage-adjacent thing found is an *output* path, not persistence:
`src/lib/download.ts` bridges to `window.claude.use('downloads')` where the host
provides it, falling back to an `<a download>` anchor. See section 8.

---

## 4. Auth model

### As implemented

**There is no authentication.** No login screen, no credential check, no session, no
token, no password field anywhere in the codebase. Identity is a single field —
`AppState.currentUserId` (`src/types.ts:176`), seeded to `'u1'` (`seed.ts:584`) — and
it is changed by a dropdown in the account menu (`TopBar.tsx:358`) dispatching
`user/switch`. The type's own comment: *"No authentication yet — this is the demo switch."*

**Competing identity sources: only one.** `state.currentUserId` is the sole authority;
no hardcoded user literal appears in any create path. This is cleaner than typical and
means write attribution will port directly once real sessions exist. The one caveat is
in section 6, finding 5.

### The authorization model — which is genuinely complete

`src/lib/permissions.ts` (126 lines) is a fully-specified, project-scoped RBAC model,
and it is the most reusable artefact in the repo. Four access roles:

| Role | Sees | Changes |
|---|---|---|
| Director | Every active project, all money | Everything, incl. create/delete projects, manage people |
| Project manager | Their projects, with money | Plan, register, setup, invoices — own projects only |
| Project lead | Their projects, **no money** | Plan, register, documents — own projects only |
| Team member | Only projects they have work on | Own tasks, evidence uploads |

Membership (`isOnProject`, `permissions.ts:33-36`) = holding `projectManagerId` or
`projectLeadId`, **or** being `assigneeId` on any step of that project. A register entry
names a *role*, not a person, so it never confers membership — an explicit design note
at `permissions.ts:30-32`.

Eight per-project abilities (`ProjectAbilities`, `permissions.ts:53-66`): `viewMoney`,
`editMoney`, `editPlan`, `editSetup`, `editRegister`, `assignWork`, `uploadDocuments`,
`deleteProject`. Plus four system-wide predicates: `canCreateProject`,
`canManagePeople`, `canSeePortfolio`, `canSeeReports`, and one row-level check
`canExecuteStep(person, assigneeId)`.

Note `deleteProject` is `true` **only** for Director — a project manager cannot delete
their own project (`permissions.ts:89`).

### The gap

**Every check in this model is client-side, and several are not applied at all.** The
model is sound; its *application* is incomplete, and the incompleteness is
concentrated in the money screens. Detail in section 6, findings 1–3.

Nothing here is enforceable server-side today because there is no server. **All of it
must be implemented from scratch**, and the per-project scoping means row-level
authorization, not just role checks at the route.

---

## 5. Implied API surface

*Inferred.* REST-shaped, because the client is REST-shaped (resource collections,
patch-style partial updates, no GraphQL or RPC idiom anywhere). Derived one-for-one
from the reducer's 27 actions at `src/store/AppStore.tsx:10-37`; the reducer case is
cited so each row is traceable to the code it replaces.

### Projects

| Operation | Reducer action | Reducer case | Notes |
|---|---|---|---|
| `POST /projects` | `project/create` | `:48-58` | **Not a plain insert** — see cascade below |
| `PATCH /projects/:id` | `project/update` | `:59-63` | Partial patch |
| `DELETE /projects/:id` | `project/delete` | `:64-73` | Cascades to 5 tables |
| `GET /projects` | `visibleProjects` | `permissions.ts:39` | Scoped per caller; excludes `archived` |

`project/create` **transactionally creates 78 rows**: the project, plus 55 delivery
steps from `DELIVERY_PLAN_TEMPLATE` and 22 register entries from `SUBMISSIONS_TEMPLATE`,
each scheduled across the contract term (`scheduleSteps`, `scheduleRegister`). This
must be one transaction server-side.

`project/delete` explicitly cascades to `steps`, `registerEntries`, `documents`,
`invoices`, `monthlyReports` (`:67-72`) — the intended FK behaviour is `ON DELETE CASCADE`.

### Delivery steps

| Operation | Reducer action | Reducer case | Notes |
|---|---|---|---|
| `PATCH /steps/:id` | `step/update` | `:75-79` | |
| `PATCH /steps` (bulk) | `step/updateMany` | `:80-86` | Same patch to an id set — needs a bulk endpoint |
| `POST /projects/:id/steps` | `step/insert` | `:87-106` | Inserts *within a phase*; fractional order then renumber |
| `POST /steps/:id/duplicate` | `step/duplicate` | `:107-116` | Copies, resets status/percent/dates |
| `DELETE /steps/:id` | `step/delete` | `:117-125` | **Nulls** `documents.stepId` — `ON DELETE SET NULL` |
| `PUT /projects/:id/steps/order` | `step/reorder` | `:126-139` | Reorders within one phase only |

Ordering is non-trivial and worth preserving exactly: inserts use `order + 0.5` then
`renumber()` (`:40-44`) rewrites the whole project's steps to a clean `0..n`. Reorder
keeps the phase's existing slots and only permutes occupants (`:129-131`), so phase
groups stay contiguous. `DeliveryStep.ref` is **derived from `order`, never stored**
(`types.ts:43`).

### Submissions register

| Operation | Reducer action | Reducer case | Notes |
|---|---|---|---|
| `PATCH /register/:id` | `register/update` | `:141-145` | |
| `POST /projects/:id/register` | `register/insert` | `:146-155` | `order = max + 1` |
| `DELETE /register/:id` | `register/delete` | `:156-162` | **Nulls** `documents.registerEntryId` |

### Documents

| Operation | Reducer action | Reducer case | Notes |
|---|---|---|---|
| `POST /documents` | `doc/add` | `:164-165` | Prepends — newest first |
| `POST /documents/:id/versions` | `doc/addVersion` | `:166-181` | **Server assigns the version number** |
| `PATCH /documents/:id` | `doc/update` | `:182-186` | |
| `DELETE /documents/:id` | `doc/delete` | `:187-188` | |

`doc/addVersion` carries an explicit server-side contract, commented at `:167-168`:
*"The uploader does not know the record's history; the store assigns the next version
number."* The client sends `version: 0` as a placeholder (`Upload.tsx:105`) and the
store overwrites it with `max(versions) + 1`. It also auto-transitions status
`Superseded → For review` on a new version (`:177`).

**File transfer itself is entirely unbuilt** — see section 8.

### Invoices, monthly reports, people

| Operation | Reducer action | Reducer case | Notes |
|---|---|---|---|
| `POST /invoices` | `invoice/add` | `:190-191` | |
| `PATCH /invoices/:id` | `invoice/update` | `:192-196` | |
| `DELETE /invoices/:id` | `invoice/delete` | `:197-202` | **Hard-deletes** linked documents (not null) |
| `POST /reports` | `report/add` | `:204-205` | |
| `PATCH /reports/:id` | `report/update` | `:206-210` | |
| *(no delete)* | — | — | **Asymmetry — see finding 7** |
| `POST /people` | `person/add` | `:212-213` | |
| `PATCH /people/:id` | `person/update` | `:214-218` | |
| `DELETE /people/:id` | `person/delete` | `:219-220` | **No cascade — see finding 4** |

Note the deliberate inconsistency: `invoice/delete` **removes** its documents
(`:201`), while `step/delete` and `register/delete` **null** the link. Three delete
paths, two different FK policies. Intentional or not, the backend must pick per
relationship.

### Alerts and session

| Operation | Reducer action | Reducer case | Notes |
|---|---|---|---|
| `POST /alerts/read` | `alerts/read` / `alerts/readAll` | `:222-224` | Both cases are **identical code** |
| *(session)* | `user/switch` | `:225-226` | Replaced by real auth |

Only *read receipts* are stored (`readAlertIds: string[]`). Alerts themselves are
recomputed from state on every render and never stored — `types.ts:177-180`,
*"so they can never go stale."* The read-id list is append-only and never pruned.

### Server-only operations with no client action at all

Derived from README "Known gaps" and section 8 — these have no reducer action because
no client can perform them: **sending** alerts (email, daily digest, push), file
storage and retrieval, and any clock the user cannot change.

---

## 6. Findings

*Inferred and ranked by consequence for backend design.*

### 1. The portfolio dashboard leaks every project's money to users who cannot see those projects

`src/pages/PortfolioDashboard.tsx:28-32`:

```ts
const m = useMemo(() => {
  const all = portfolioMetrics(state);                                  // ← whole portfolio
  const perProject = all.perProject.filter((p) => activeIds.has(p.project.id));
  return { ...all, perProject };                                        // ← only the list is scoped
}, [state, activeIds]);
```

Only `perProject` is filtered to the caller's visible projects. Every **scalar
aggregate** is spread through unscoped from `portfolioMetrics(state)`, which itself
operates on `state.projects.filter(p => !p.archived)` — all active projects, business-wide
(`derive.ts:488`). Those aggregates are then rendered as money: `contractValue`,
`invoiced`, `paid`, `outstanding`, `stillToInvoice` (`:128-132`), 30/60/90-day forecast
(`:140-142`), and spend against budget (`:155-171`).

Compounding it, the route has **no** `canSeePortfolio` check. That predicate exists and
returns `false` for `Team member` (`permissions.ts:116`), but it is used in exactly one
place — hiding the sidebar link (`Sidebar.tsx:23`). A Team member typing `/` sees
portfolio-wide financials while the project table below correctly shows only their own.

**For the backend:** aggregates must be computed *after* row-level scoping, server-side,
per caller. This cannot be a client concern. It is the clearest demonstration in the repo
that the nav layer and the data layer disagree about who may see what.

### 2. Both money screens are reachable by URL with no check

- `/reports` (`Reports.tsx`) reads `portfolioMetrics(state)`, `cashPosition(state.invoices)`
  and the full invoice list unscoped (`:22-28`). `canSeeReports` exists
  (`permissions.ts:120`, Director + PM only) and is used **only** to hide the sidebar
  link (`Sidebar.tsx:28`).
- `/projects/:id/reports` (`ProjectReports.tsx`) is the per-project money tab —
  invoices and monthly reports. `ProjectWorkspace` filters the *tab* out of the nav when
  `!can.viewMoney` (`ProjectWorkspace.tsx:57`), but the child route still renders. The
  file contains no permission reference at all.

`viewMoney` is the single most load-bearing flag in the model — it is what separates
Project lead from Project manager (`permissions.ts:92-96`). It is enforced nowhere that
a URL cannot bypass.

### 3. `/documents` shows every file in the business to everyone

`DocumentsGlobal.tsx` renders `state.documents` with no project scoping — its own
subtitle says *"across every project"* (`:31`). `DocumentsView.tsx` has no permission
reference either. Unlike routes 1 and 2, there is no guard predicate even *defined* for
global document visibility, so this gap is in the model as well as its application.

`/projects/new` is the same shape: `canCreateProject` exists (`permissions.ts:106`,
excludes Project lead and Team member) and gates only the two buttons that link to the
wizard (`ProjectsList.tsx:69`, `PortfolioDashboard.tsx:63`). The wizard itself checks
nothing and dispatches `project/create` on submit.

### 4. Deleting a person leaves dangling references across four tables

`person/delete` (`AppStore.tsx:219-220`) removes the row and does nothing else. Nothing
in the codebase reassigns or nulls:

- `DeliveryStep.assigneeId` → orphaned; also silently **removes project membership**
  from anyone whose access came via that step (`isOnProject`, `permissions.ts:35`)
- `Project.projectManagerId` / `Project.projectLeadId` → orphaned; `ProjectWorkspace.tsx:55`
  does `state.people.find(...)` and renders nothing when undefined
- `DocumentVersion.uploadedBy` → holds a **name string**, so history survives the delete
  but is unverifiable (finding 5)

Every other delete path in the reducer cascades or nulls deliberately. This one is the
exception, and `Person` is the most-referenced entity in the graph. The backend needs an
explicit policy — soft-delete via the existing `Person.active` flag (`types.ts:37`) is
the likelier intent, since the field exists and nothing currently sets it to `false`.

### 5. Upload attribution is stored as a display name, not a foreign key

`DocumentVersion.uploadedBy: string` (`types.ts:85`) is written as `currentUser.name`,
not `currentUser.id` — `Upload.tsx:109` and `:135`. The seed follows the same shape,
resolving ids to names at construction time (`seed.ts:488`, `:517`, `:552`).

Every other cross-entity reference in the model is a proper id (`assigneeId`,
`projectManagerId`, `stepId`, `registerEntryId`, `invoiceId`). This one field breaks the
pattern. A person renamed in Settings leaves every historical version attributed to a
name that no longer exists, and audit history cannot be joined back to `Person`.

This is the single field to change before data is migrated, not after.

### 6. Enum disagreement: `'Not applicable'` is a submission value the type forbids

`SUBMISSION_STATUS` (`reference.ts:18-20`) has six values and **does not include**
`'Not applicable'`. But `derive.ts:40` — inside `stepFlag`, the rule the README calls
*"the rule the whole system exists for"* — casts the field to compare against it:

```ts
(step.submission as string) === 'Not applicable' ||
```

The cast is required precisely because the type says this can never happen. Meanwhile
`REGISTER_STATUS` (`reference.ts:27-29`) **does** include `'Not applicable'`, and so does
`YES_NO` for the separate `acknowledged` field.

So three adjacent status vocabularies disagree about whether "not applicable" is a
state. Either `stepFlag` carries a dead branch, or `SUBMISSION_STATUS` is missing a
value that production data will contain. **This must be settled before the migration is
written**, and it is invisible if you read either enum alone.

### 7. Monthly reports can be created and updated but never deleted

`report/add` and `report/update` exist; there is no `report/delete`
(`AppStore.tsx:204-210`). Every other entity except `Person`-adjacent rows has a delete
path. Either a deliberate append-only decision — plausible, these are statutory lodgement
records — or an oversight. It should be a decision, recorded, not inherited by accident.

### 8. Derived read models that must not become tables

These are computed on every render and stored nowhere. They are **views**, and the
README is explicit that this is deliberate (*"nothing can be stale relative to the
underlying record"*). Do not create tables for them:

| View model | Source | Notes |
|---|---|---|
| `Alert` (13 kinds) | `lib/alerts.ts:22-50` | Only the **read receipts** persist, as `readAlertIds` |
| `Task` / `TaskBucket` (7) / `NextAction` (7) | `lib/tasks.ts:14-40,148` | *"A task is not a separate record — it is a delivery plan step with someone's name on it"* |
| `CalendarEvent` / `EventKind` (7) | `lib/calendar.ts:17-40` | Every dated record, unified |
| `ProjectMetrics`, `PortfolioMetrics`, `CashPoint`, `PhaseProgress` | `lib/derive.ts` | All money and progress aggregates |
| `Flag` (8 values) | `derive.ts:35` `stepFlag` | Derived from status + submission + acknowledged + dates |
| `Health` (3 values) | `derive.ts:324` `projectHealth` | |

**Two derivation thresholds are magic numbers with no stated rule**, and both change
what users see:
- `SCHEDULE_SLACK = 5` (`derive.ts:322`) — the percentage-point tolerance below which a
  project flips to `Behind schedule`. Undocumented anywhere.
- `daysToEnd <= 7` → `Due soon` (`derive.ts:52`) — the one threshold the README *does*
  publish.

Alert severity has two more inline: `waiting > 14` days → warning (`alerts.ts:127`),
`toEnd <= 30` days → warning (`alerts.ts:209`). Whoever owns the product should confirm
these four numbers rather than have them inherited silently.

### 9. Three business gates the backend must enforce, not merely echo

`derive.ts:106-144`. Currently client-side only. Each returns a `GateResult` with
user-facing prose, and each guards a state transition:

| Gate | Rule | Function |
|---|---|---|
| Step completion | A step with a required submission cannot be `Completed` without an evidence document linked via `stepId` | `canCompleteStep` |
| Register submission | An entry cannot be `Submitted` without a document linked via `registerEntryId` | `canSubmitRegisterEntry` |
| Invoice submission | An invoice cannot be `Submitted` without `progressReportAttached` or a document linked via `invoiceId` | `canSubmitInvoice` |

These encode the system's whole reason for existing (README: *"A step is not complete
because someone ticked Completed"*). They are transactional invariants — enforcing them
only in the client means any direct API call bypasses the contract the business runs on.

`scripts/verify-rules.ts` holds **38 assertions** covering every branch of `stepFlag`,
`daysLate`, `inclusiveDays` and these three gates. It is a ready-made conformance suite
for the backend implementation — the highest-value test asset in the repo.

### 10. Two distinct role vocabularies live on one entity

`Person` carries both `role: Responsible` (12 job titles — `reference.ts:12-16`) and
`accessRole: AccessRole` (4 permission levels — `types.ts:27`). `role` drives the
responsible-party dropdowns and the seed's roster-to-person mapping; `accessRole` drives
every permission decision. They overlap confusingly — `'Project manager'`, `'Project lead'`
and `'Director'` are values in **both** lists — but they are not the same axis and must
not be merged. `types.ts:33-36` documents the distinction; preserve it.

### 11. ID generation will collide across sessions

`uid()` (`factory.ts:9-12`) returns `${prefix}-${Date.now().toString(36)}-${counter}`
where `counter` is a module-level integer that **resets to 0 on every page load**. Two
ids generated in the same millisecond in different sessions collide. Harmless while
nothing persists; a real hazard the moment these reach a database.

Seed rows use a different scheme entirely — deterministic `${projectId}-s${i}` /
`-r${i}` (`factory.ts:21`, `:45`). So two ID conventions coexist. The backend should own
generation (UUID or sequence) and treat both as import-only.

### 12. Dependency hygiene: `npm run check` fails on a clean install

`package.json:11` — the `verify` script invokes `esbuild`, which is **not declared** in
`dependencies` or `devDependencies`. It resolves today only via a transitive hoist from
Vite's tree. `npm run check` (typecheck + verify) is the documented pre-commit gate and
will break the moment that hoist changes. Declare it explicitly.

`DELIVERY_TIER` (`reference.ts:35`) is exported and imported by **zero** files — the
`Project.deliveryTier` field is typed inline as `'1' | '2'` (`types.ts:139`) instead.
Dead export.

`PRIORITY` (`reference.ts:23`) is referenced only to be *displayed* as a reference list
in Settings (`Settings.tsx:233`). **No entity has a priority field.** It is a vocabulary
with no column — either a planned feature never built, or a leftover. Do not create a
column for it without asking.

All other declared dependencies are used (`lucide-react` 28 files, `react-router-dom` 21,
`recharts` 1). All versions are caret ranges, none unpinned to `latest`.

---

## 7. Data shapes

Eight persisted entities, all declared in `src/types.ts` — a complete, strict TypeScript
layer (`"strict": true`, `noUnusedLocals`, `noUnusedParameters`). **Nothing in this
section is inferred**; every shape is read from an explicit declaration. No runtime
schema library (zod/yup/valibot) is present, so validation rules live in imperative code
(`lib/files.ts:27` for uploads, `ProjectSetup.tsx:74-76` and `NewProjectWizard.tsx:65-67`
for money fields, `lib/dates.ts:24` for dates) rather than in the type layer.

No entity types are declared inline in screen components — checked; the model directory
sweep is complete.

### Entities

**`Person`** — `types.ts:29-38`
`id`, `name`, `email`, `role: Responsible`, `accessRole: AccessRole`, `active: boolean`.
11 seeded (`seed.ts:18-30`), ids `u1`–`u11`. `active` is set `true` on all 11 and never
written anywhere else — a soft-delete flag with no code path.

**`Project`** — `types.ts:133-165` (26 fields)
Identity: `id`, `name`, `client`, `contractRef`, `serviceScheduleRef`, `deliveryTier: '1'|'2'`.
People: `projectManagerId`, `projectLeadId` (both → `Person.id`), `projectEmail`,
`clientProjectManager`, `clientBusinessOwner` (the last two are **free-text names, not
FKs** — the client side has no Person record).
Money and time: `startDate`, `contractedCompletion`, `contractValue`, `currency`,
`supportPeriodMonths`, `costBudget: number|null`, `costToDate: number|null`.
Locations: `systemRepositoryLocation`, `workingDocumentLocation`, `approvedDocumentLocation`
(free-text paths — where files *actually* live today).
Housekeeping: `departmentalWorkbookUpdated`, `thisWorkbookUpdated`, `archived`, `createdAt`.

`costToDate` is flagged in the README as an addition beyond the original brief, needed
for spend-against-budget.

**`DeliveryStep`** — `types.ts:40-62` (18 fields) — *the core working entity*
`id`, `projectId`, `order: number`, `phase`, `step`, `action`, `deliverable`,
`responsible: Responsible|''`, `assigneeId: string|null`, `evidenceLink`,
`plannedStart`, `plannedEnd`, `actualCompletion`, `status: Status`,
`percentComplete: number`, `submission: SubmissionStatus`, `dateSubmitted`,
`acknowledged: YesNo`, `notes`.
`order` is fractional during insert then renumbered. The displayed `ref` is derived from
`order` and never stored (`types.ts:43`).

**`RegisterEntry`** — `types.ts:64-78` (13 fields)
`id`, `projectId`, `order`, `phase`, `submission`, `template`, `signedBy`, `owner`,
`plannedDate`, `dateSubmitted`, `acknowledgedOn`, `status: RegisterStatus`, `notes`.
`owner` and `signedBy` are **role/name strings, not FKs** — deliberate: a register entry
names a role, so it never confers project membership (`permissions.ts:30-32`).

**`DocumentRecord`** — `types.ts:91-107`
`id`, `projectId`, `name`, `stepId: string|null`, `registerEntryId: string|null`,
`invoiceId: string|null`, `type: DocType`, `status: DocStatus`,
`storageLocation: StorageLocation`, `link`, `currentVersion: number`,
`versions: DocumentVersion[]`.
The three nullable FKs are **mutually exclusive in practice** — a document is evidence
for a step, *or* the file for a register entry, *or* an invoice's progress report — but
nothing in the type or any code enforces exclusivity. Worth a CHECK constraint.

**`DocumentVersion`** — `types.ts:80-89` (embedded, would normalise to its own table)
`version: number`, `fileName`, `fileSize`, `mimeType`, `uploadedBy: string` (**a name —
finding 5**), `uploadedAt: string` (full ISO timestamp, unlike `ISODate` elsewhere),
`objectUrl: string|null` (`null` for seeded rows; a `blob:` URL for session uploads —
**this field does not survive into a real system** and should become a storage key).

**`Invoice`** — `types.ts:109-120`
`id`, `projectId`, `number`, `date`, `periodCovered`, `amount`, `linkedPhase`,
`progressReportAttached: boolean`, `status: InvoiceStatus`, `datePaid`.
`progressReportAttached` duplicates what a linked `DocumentRecord.invoiceId` already
tells you — `canSubmitInvoice` (`derive.ts:135`) accepts **either**. Redundant state that
can disagree with itself.

**`MonthlyReport`** — `types.ts:122-131`
`id`, `projectId`, `month: string` (`YYYY-MM`), `lodged: boolean`, `lodgedOn: ISODate`,
`invoiceId: string|null`, `notes`.

### Enums — complete value sets

All in `src/data/reference.ts`. Every dropdown is driven from here *"so a value can never
drift"* (`:1-2`).

| Enum | Values | Used by |
|---|---|---|
| `PHASES` | 10: `1 Initiation`, `2 Planning`, `3 Requirements`, `4 Front-end development`, `5 Client demo 1`, `6 Environment and access`, `7 Publish and test`, `8 Back-end development`, `9 Final deployment`, `10 Training and support` | `DeliveryStep.phase`, `RegisterEntry.phase`, `Invoice.linkedPhase` |
| `STATUS` | 6: Not started, In progress, Completed, On hold, Blocked, Not applicable | `DeliveryStep.status` |
| `RESPONSIBLE` | 12: Project manager, Project lead, Front-end developer, Back-end developer, Business analyst, Designer, Tester / QA, Trainer, Director, Department, Department and provider, External | `Person.role`, `DeliveryStep.responsible` |
| `SUBMISSION_STATUS` | 6: Not required, Not yet due, Prepared, Submitted, Acknowledged, Returned for correction | `DeliveryStep.submission` — **see finding 6** |
| `YES_NO` | 3: Yes, No, Not applicable | `DeliveryStep.acknowledged` |
| `DOC_TYPE` | 7: Deliverable, Evidence, Submission, Contract, Minutes, Report, Other | `DocumentRecord.type` |
| `DOC_STATUS` | 4: Draft, For review, Approved, Superseded | `DocumentRecord.status` |
| `REGISTER_STATUS` | 6: Not started, Prepared, Submitted, Acknowledged, Returned for correction, Not applicable | `RegisterEntry.status` |
| `INVOICE_STATUS` | 4: Submitted, Approved for payment, Paid, Queried | `Invoice.status` |
| `STORAGE_LOCATION` | 2: Working documents, Approved documents | `DocumentRecord.storageLocation` |
| `HEALTH` | 3: On track, Behind schedule, At risk | **derived**, not stored |
| `FLAGS` | 8: Complete, Awaiting acknowledgement, Blocked, On hold, No date, Overdue, Due soon, On track | **derived**, not stored |
| `DELIVERY_TIER` | 2: `'1'`, `'2'` | **dead export** — field typed inline |
| `PRIORITY` | 3: High, Medium, Low | **no field uses it** — display only |
| `AccessRole` | 4: Director, Project manager, Project lead, Team member | `types.ts:27` (not in reference.ts) |

`ISODate` is `YYYY-MM-DD`, and **empty string means "not set"** (`types.ts:19-20`) — not
`null`. This convention runs through every date field on every entity and is the single
most pervasive shape decision in the codebase. `DocumentVersion.uploadedAt` is the lone
exception: a full ISO timestamp.

### Referential graph

```
Person ─┬─< Project.projectManagerId
        ├─< Project.projectLeadId
        ├─< DeliveryStep.assigneeId          (nullable)
        └─·· DocumentVersion.uploadedBy      (BY NAME, not id — finding 5)

Project ─┬─< DeliveryStep.projectId          cascade delete
         ├─< RegisterEntry.projectId         cascade delete
         ├─< DocumentRecord.projectId        cascade delete
         ├─< Invoice.projectId               cascade delete
         └─< MonthlyReport.projectId         cascade delete

DeliveryStep  ──< DocumentRecord.stepId          nullable · SET NULL on delete
RegisterEntry ──< DocumentRecord.registerEntryId nullable · SET NULL on delete
Invoice       ─┬─< DocumentRecord.invoiceId      nullable · CASCADE DELETE on delete
               └─< MonthlyReport.invoiceId       nullable · no delete path exists

DocumentRecord ──< DocumentVersion               embedded array → own table

Unmodelled (free text, no FK):
  Project.clientProjectManager, Project.clientBusinessOwner   — client-side people
  RegisterEntry.owner, RegisterEntry.signedBy                 — roles, deliberately
  Project.*Location (3 fields)                                — filesystem paths
```

Every entity appears above. No orphan types were found.

### Seed volumes and authoring completeness

4 projects, 11 people. Per project: 55 delivery steps + 22 register entries, from the
verbatim standard template (`src/data/templates.ts`, 77 rows — counts confirmed by
`awk`, and matching the README). So **220 steps and 88 register entries** in the seeded
graph, plus generated documents, invoices and monthly reports.

Template content is **fully authored for all 77 rows** — phase, step, action,
deliverable, responsible, submission. This is real domain content with genuine migration
value, not sample data: it is the standard delivery methodology, and the README states
every project is created from it *verbatim*. It should be carried across, not
regenerated.

The four scenarios are named after plausible client engagements (Vulindlela Power BI,
Ikusasa Learner Records, Thuthuka Grant Portal, Sizani Community Health) and the README
notes they produce two *On track* and two *At risk*, with **no `Behind schedule`
project** — that health branch is reachable but unexercised by the seed.

---

## 8. Stack facts

| | |
|---|---|
| Framework | React 18.3.1, React DOM 18.3.1 |
| Build | Vite 5.4.11, `@vitejs/plugin-react` 4.3.3 |
| Language | TypeScript 5.6.3, `strict: true`, `noEmit`, bundler resolution |
| Routing | react-router-dom 6.28.0 — `BrowserRouter`, or `HashRouter` when `VITE_HASH_ROUTER` set |
| Styling | Tailwind 3.4.15 + PostCSS 8.4.49 + autoprefixer |
| Icons | lucide-react 0.454.0 |
| Charts | recharts 2.13.3 (one import site) |
| Path alias | `@/*` → `./src/*`, declared in both `tsconfig.json` and `vite.config.ts` |
| Dev server | port 5173 |
| Package manager | npm (`package-lock.json` present) |
| Repo size | 58 source files, 12,528 lines |

**Test tooling: none.** No Vitest, Jest, Playwright, Cypress or Testing Library. The only
verification is `scripts/verify-rules.ts` — 38 hand-rolled assertions with a custom `eq()`
helper, bundled by esbuild and run under node. No test framework, by explicit design
(README). No CI configuration is present in the repo.

**Deploy target — worth knowing, because it explains the architecture.** `src/lib/download.ts`
detects `window.claude.use('downloads')` and routes file saves through the host
capability when present, falling back to an `<a download>` anchor otherwise
(`:21-30`, `:36-60`). Together with `VITE_HASH_ROUTER` for single-file builds
(`App.tsx:20-25`), this shows the app was built to run as a **claude.ai artifact** as
well as a normally-served SPA. The in-memory-only architecture is a consequence of that
origin, not an oversight.

**Excel export is dependency-free**: `src/lib/xlsx.ts` (197 lines) hand-writes OOXML —
worksheets, styles, content types, relationships — producing real `.xlsx` files with no
library. Used by the portfolio, register and reports screens.

**Upload is a real control with no transport.** `<input type="file">` plus drag-and-drop
(`Upload.tsx:187`, `:179`), client-side validation against a 25 MB cap and a 17-extension
allowlist (`lib/files.ts:1-12`, `validateFile:27-42`), then `URL.createObjectURL(file)`
into memory (`Upload.tsx:111`, `:137`). Progress is a `setInterval` animation, admitted
at `:74-75`. So: **a real control that encodes into client memory** — not unbuilt, and
not wired. Seeded documents carry `objectUrl: null` and the UI says so when you try to
preview them.

**Backend-only capability, in priority order** — nothing client-side can do any of this:

1. **File storage and retrieval** — the entire document module rests on it
2. **Sending alerts** — all 13 alert kinds render in-app only; email, daily digest and
   push all need a server (README names this *"the natural next step"*)
3. **Authentication and sessions** — nothing exists
4. **Cross-user visibility** — every user currently reads the same in-memory graph
5. **A trustworthy clock** — every date rule uses `today()` from the client
   (`derive.ts` defaults `now = today()` throughout); overdue, due-soon and health all
   trust a clock the user controls
6. **Server-side enforcement of the three gates and all authorization** (findings 1-3, 9)

**Conventions assumed** (declared, per the skill's instruction): REST for section 5,
because the client shows no GraphQL, tRPC or realtime idiom and its reducer is
resource-and-patch shaped. HTTP verb and path choices there are mine; the *operations*
and their cascade behaviour are read from the reducer.

---

## 9. Not covered

Deliberate exclusions, and what remains partial:

- **Fixture bodies.** `src/data/seed.ts:19-587` was read for structure, entity shapes, ID
  conventions, authoring completeness and the four scenario definitions — not row by row.
  Per-row values of 220 steps and 88 register entries were not transcribed; they are
  generated from the template plus deterministic jitter, so the template file is the real
  content and it *was* read.
- **Presentation internals.** Tailwind class composition, the design-token palette,
  `components/ui/*` primitives, `components/charts/*` and `DatePicker.tsx` (483 lines)
  were read only for data flow and permission references, not for their rendering logic.
  The README documents the design system and its WCAG contrast adjustments; none of it
  affects backend design.
- **`node_modules`, lockfile, build output** — excluded per scope.
- **Runtime behaviour.** This was a static read; the app was never built or run. Claims
  about what a route renders are read from source, not observed. The two claims most
  worth confirming at runtime are findings 1 and 2 — navigate to `/`, `/reports` and
  `/projects/:id/reports` as a Team member (`u3`–`u7`, `u11`) via the account switcher
  and confirm the money is visible.
- **Git history beyond `git log --oneline`.** Four commits, read as subject lines only.
  No branches other than `main`; no PR or issue history was consulted.
- **The eleven-vs-fourteen route discrepancy** in the README's accessibility claim is
  noted in section 1 but not resolved — I did not determine which three routes were
  excluded from the axe run, or why.

Nothing blocked this extraction. Every file listed in section 8's count was reachable and
readable, and every "none" in sections 2 and 3 is the result of at least three widening
search passes recorded in those sections.
