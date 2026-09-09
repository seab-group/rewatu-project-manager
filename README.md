# REWATU Project Management System

The front end of the internal system Rewatu Solutions uses to run every client
delivery from appointment to closure.

It replaces a per-project spreadsheet. The spreadsheet worked, but it did not
roll up across projects, it did not hold the evidence files, and every new
project began by copying the last one. This fixes those three things without
losing anything the spreadsheet did.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run check      # typecheck + the business-rule tests
npm run build
```

State is held in React and seeded with four sample projects. There is no back
end yet; the shape of the store is what a back end will fill.

## How people use it

**My tasks** is where the work happens. A task is not a separate record — it is
a delivery plan step with someone's name on it, so working a task edits the plan
directly and the two can never disagree. Tasks group into Overdue, Blocked, Due
today, Due this week, Waiting on the client, Later and Done, and each one shows
the single next thing it needs: start it, upload the deliverable, complete it,
or chase the acknowledgement. Marking yourself blocked requires a reason, and
puts the project At risk on both dashboards.

**Alerts** are derived from the data on every render, never stored, so an alert
cannot outlive its cause — fix the step and it is gone. They cover overdue and
imminent work, blocked steps, missing evidence, submissions waiting on the
client or returned for correction, stale client workbooks, unlodged monthly
reports, invoices with no progress report, and contracts running out. The bell
shows the ones addressed to you; the dashboard opens with the same list as
"what needs you today". Only what has been read is remembered.

**Calendar** is one view of everything dated across the business: step starts
and planned ends, submissions due, invoices, monthly reports, and contract
start and end dates. Nothing is scheduled separately — move a date on a record
and the calendar moves with it. Month grid or agenda, filterable by project,
type, and whether it is yours.

## Roles

`src/lib/permissions.ts` holds the access model. Access is always scoped to the
projects someone is actually on: being a project manager never means being
manager of everything.

| Role | Sees | Changes |
|---|---|---|
| **Director** | Every project, all money | Everything, including creating and deleting projects and managing people |
| **Project manager** | Their projects, with money | Plan, register, setup, invoices on their own projects |
| **Project lead** | Their projects, no money | Plan, register and documents on their own projects |
| **Team member** | Only projects they have work on | Their own tasks and evidence uploads |

Membership comes from holding a named role on a project or having a step
assigned to you. A register entry names a role rather than a person, so it never
confers access on its own.

**There is no authentication yet.** This is the access model, not a security
boundary — the user menu switches who you are so each role can be demonstrated.
Everything a real sign-in needs to plug into is already here.

## The rule the whole system exists for

A step is not complete because someone ticked *Completed*. It is complete when
the deliverable exists and, where a submission was required, the client has
acknowledged it.

That rule lives in `stepFlag()` in [`src/lib/derive.ts`](src/lib/derive.ts) and
is reproduced exactly as specified:

```
no action text                                  -> blank
Completed and (Not required or acknowledged)    -> Complete                 green
Completed and a submission is outstanding       -> Awaiting acknowledgement amber
Blocked                                         -> Blocked                  red
On hold                                         -> On hold                  neutral
no planned end date                             -> No date                  neutral
today is past planned end                       -> Overdue                  red
planned end within 7 days                       -> Due soon                 amber
otherwise                                       -> On track                 neutral
```

`npm run verify` checks every branch of it, plus days late, inclusive days, and
the three gates below. 38 assertions, no test framework.

### The gates

Three things the system refuses to let the team record, each with an inline
explanation and a shortcut to the action that unblocks it:

| Refusal | Why |
|---|---|
| A step with a required submission cannot be marked **Completed** without an evidence file | The spreadsheet let steps be closed with nothing filed |
| A register entry cannot be marked **Submitted** without a file attached | The register is the evidence trail for the contract |
| An invoice cannot be marked **Submitted** without a progress report | The client returns invoices that arrive without one |

## The standard template

Every project is created from
[`src/data/templates.ts`](src/data/templates.ts): **55 delivery plan steps
across 10 phases** and **22 submissions register entries**, verbatim and in
order, with status *Not started* and a first-draft schedule laid across the
contract term. Nobody starts from an empty grid and nobody copies last
project's file. The template is visible read-only under **Settings → Standard
template**; editing a project's own copy never changes it.

## Layout

```
src/
  data/        templates (verbatim), reference lists, project factory, demo seed
  lib/         dates, money, files, Excel export
               derive      flags, metrics, gates
               permissions access roles, scoped per project
               tasks       steps with a name on them, and what each needs next
               alerts      everything that needs someone, worked out from state
               calendar    every dated record, in one place
  store/       AppStore — one reducer over the whole domain
  components/  ui primitives, layout, charts, document handling
  pages/       portfolio, tasks, calendar, projects, wizard, documents,
               reports, settings
    project/   the six workspace tabs
```

Exports are real `.xlsx` workbooks, written by a dependency-free OOXML writer
in [`src/lib/xlsx.ts`](src/lib/xlsx.ts) and saved through
[`src/lib/download.ts`](src/lib/download.ts), which uses the host's download
capability where one exists (the claude.ai artifact viewer) and a plain anchor
everywhere else.

`src/lib/derive.ts` is the only place business rules live. Every dashboard
figure, pill and attention item is derived from state there rather than stored,
so nothing can be stale relative to the underlying record.

## Design notes

Palette, semantic colours and the card-on-canvas treatment follow the brand
specification. Two details worth knowing:

- **The cyan-to-violet gradient appears in exactly three places** — the logo
  mark, the primary button, and the active navigation tile. Progress bars and
  chart marks use solid colour.
- **Chart colours are re-stepped from the brand palette** so they survive a
  colour-blindness and contrast check against a white card (`#0092AD` /
  `#5B3FE0` for the two-series pairs). The bright brand cyan `#00D2F5` stays on
  UI surfaces, where it is not a data mark. Status never rests on colour alone:
  every pill carries a dot or icon plus its label, and every chart has a
  labelled legend.

### Dates

`src/components/ui/DatePicker.tsx` replaces `<input type="date">` everywhere.
The browser's own control paints a calendar from the operating system, which
lands in the middle of this interface looking like it came from somewhere else;
this is the same control drawn in the system's language — card surface, cyan
accent, line borders, the same focus ring.

It stays a text field, because dates get typed far more often than clicked:
`12/03/2026`, `12-3-26`, `12 Mar 2026`, `12 March 2026` and the ISO form all
parse, day first. An entry that is not a date (`31/02/2026`) is refused inline
and never half-applied. The calendar opens on click, `ArrowDown` or `Enter`;
arrows move by day, `PageUp`/`PageDown` by month, with `Shift` by year, `Enter`
selects and `Escape` closes and returns focus to the field. `min`/`max` bounds
strike out the days outside them. On a phone it becomes a bottom sheet.

The grid is a real `<table>` rather than ARIA roles on a flat CSS grid, so rows,
column headers and cells carry their own semantics — axe reports zero
violations with the picker open, in both the popover and the sheet.

### Accessibility, and where it moved the palette

The brief asks for the brand palette *and* WCAG 2.1 AA. Four of the brand
colours fail AA when they carry text, so they were darkened for text use only —
fills, dots, borders and chart marks still use the specified values:

| Role | Brand | Text variant | Was → is |
|---|---|---|---|
| `ink-faint` micro-labels and hints | `#97A1AC` | `#676D75` | 2.5:1 → 4.9:1 |
| `neutral` pill text on `#EDF0F3` | `#64748B` | `#5E6D83` | 4.2:1 → 4.6:1 |
| Cyan link text on white | `#00B4D4` | `#007B91` | 2.5:1 → 5.0:1 |
| `warning` pill text on `#FCEFD6` | `#9A6510` | `#966210` | 4.3:1 → 4.6:1 |

The original `#97A1AC` remains available as `ink-ghost` for decoration, where
contrast does not apply. `success` and `danger` already passed.

Verified with axe-core against WCAG 2.1 A and AA across all eleven routes:
**zero violations**. Also checked: no route scrolls horizontally at 390px, focus
is trapped in dialogs, every table is keyboard navigable (arrows, Home/End,
Enter), and every control has a cyan focus ring.

Tables become stacked cards below `md`; no table scrolls the page sideways on a
phone. Wide grids (the 19-column delivery plan) scroll inside their own card on
desktop, and become a card list with a full-field editor on a phone.

## Known gaps

- Nothing persists: state lives in React, so a browser reload starts from the
  seeded demo data again. That is the brief's "in-memory state", and the store
  is shaped so a back end can replace it without touching the interface.
- Uploads are held in memory as object URLs and the transfer is simulated;
  seeded demo documents have no file behind them, and say so when you try to
  preview or download them.
- "Spend against budget" needs an actual internal cost, which the brief's money
  model does not include. `costToDate` was added to the project record and is
  captured on the Setup tab; without it the figure would have had to be
  invented from revenue.
- The four demo projects produce two *On track* and two *At risk*, and no
  *Behind schedule* — that category is real and reachable, but the four
  scenarios the brief specifies do not happen to include one.
- Alerts appear in the app. Sending them anywhere — email, a daily digest, a
  push — needs a back end, and is the natural next step once one exists.
