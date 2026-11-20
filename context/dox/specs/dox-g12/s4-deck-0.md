# Slice 4 · Deck 0 content: "Give Me Temporal"

[Index](./index.md) · Binding rules: [built/index.md](../../built/index.md),
[visual-design.md](../../reference/visual-design.md). Data: `src/data/upstream-filings.ts`,
`src/data/date-faults.ts`, `src/data/temporal-compat.ts`, `src/data/gmt-stats.ts`,
`src/data/zone-matrix.ts`, `src/lib/bundle-size.ts`. Live demos: [slice 4b](./s4b-live-agents.md).
New pieces and the builder phases: [slice 7](./s7-running-question.md).

## Goal

The 25 slides and the spare of the HelsinkiJS talk, in `src/slides/give-me-temporal/Deck0.astro`,
using slice 1's components, slice 2's places, slice 2b's wall and slice 3's notes. Every bug on
stage is a real filing read from `upstream-filings.json`; every gmt result is computed by gmt at
build time; every count is derived. The talk runs 20 minutes; `qa` holds 5 of questions.

## Registry entry

`src/slides/decks.ts` holds `{ slug: "give-me-temporal", label: "Deck 0", title: "Give Me
Temporal", event: "HelsinkiJS", start: "2026-12-16T18:00:00+02:00[Europe/Helsinki]", minutes: 20,
qa: 5, zone: "Europe/Helsinki", locale: "fi" }`. The index page and the title slide render the
date with gmt from `start` and `zone`; a `null` start reads "Date to be announced".

## Slides

The outline, places and minutes are in [the index](./index.md#deck-0-outline-20-minutes). Every
slide has `<Notes>` in plain English for the owner's review. Examples use Helsinki, Tokyo and other
places; no national default, no law, no business wording, no text that judges a library.

- **`title`**: the event and date, and the venue's local time now from gmt in a kit `readout`
  with samples, so the arriving time moves nothing.
- **`agent-answer`** ("Ask an agent"): `AgentQuote`, the answer the transcript's `quoted` names.
  Build 0: the question, as the owner asked it. Build 1: the agent's code (its `excerpt` when
  set) in the site's own code block, dark on the dark stage (`DeckCode`), the model and date as the source line, and "What does it return?" (a guess). Build 2: the
  call and the value the code returned on Node 26 at `TZ=Europe/Helsinki`, the count of distinct
  values across its runs, zones and Node majors, and the line "That time never happens in
  Helsinki", shown only when `classifyLocal("2027-03-28T03:30:00", "Europe/Helsinki")`
  (`instant/convert`) returns `"nonexistent"` at build time; it does today. The agent's prose goes
  to the notes (`part="prose"`): on the slide it would give the guess away.
- **`agents`** ("What the agents returned"): `AgentTable`, one row per answer in file order: the
  model, the code's line count and imported libraries, the value on Node 26 in Helsinki, and the
  distinct values across its runs. An answer not ready fills its row with the marked cell.
- **`date`** ("Date only knows this machine"): the venue's clock still shows, and nothing animates. The
  first row is the agents' question asked of `Date` (`AGENTS_FAULT` in `content.ts`): it knows only
  the machine's clock, which is why the agents failed. Two of the home page's rows from `dateFaults`
  follow, the ones no other slide shows: months counted from 0, and `setDate` changing a `Date` in
  place. No builds.
- **`kinds`** ("Date takes anything"): the venue's clock still shows. A five-line `nextDay` over
  `Date` (`date-kinds.json`), then, in a `Swap` so each step replaces the last, on build 1, `RunGrid`: one row per kind of time passed in (a
  date, a local time, a UTC time, an offset, a zone, a `Date` object), one column per zone (Niue,
  New York, UTC, Kolkata, Helsinki), each cell what Node 26 returned there, from
  `date-kinds-run.json` (`scripts/zone-matrix/date-kinds.mjs`), red or green against
  2027-03-28, with the count of distinct results under it. Build 2 is GMT's run of
  `GMT_CALLS.kinds`. `kinds.ts` builds the grid once; `content.test.ts` fails while a run record is
  stale. Notes end: "Every library that keeps a Date inside inherits this grid."
- **`one-clock`** ("The web shows one clock"): the ice wall ([slice 2b](./s2b-ice-wall.md)).
  Notes: "Each of these sites shows one clock. That is the view most date code takes, and the view
  the agents took: one place, one local time. Hold that." The wall breaks as the talk steps on.
- **`temporal`** ("Give me Temporal"): the wall breaks, then the clock behind it shatters into the
  Earth as the wall's last shards fade. The text: "One clock against the whole planet. Temporal lets your code tell the time anywhere
  on Earth: you pass in the place, and it works out the rest." No bug counts and no GMT; those
  belong to `guards`.
- **`experiments`, then `gaps`, `overlaps`, `host`, `odd`**: `ExperimentOpener` and
  `ExperimentSlide`, read from `zone-probe.json`; GMT stays in the list, its zero in green.
- **Bug slides**: the visuals and receipts of [slice 6](./s6-time-not-camera.md#a-visual-per-bug),
  then one last build with `GmtStep` ([slice 7](./s7-running-question.md#the-gmt-step-on-each-bug-slide)).
  Each call below was run on Node 26 (ICU 78.3) with these results; a slide's calls share one `GmtRun`:

  | Slide | Filings | GMT call (module) | Result |
  | --- | --- | --- | --- |
  | `abort` | `nodejs/node#67076` (D23), `CLDR-19873` (D24) | `formatDateToParts("2024-12-30", "gd", { year: "numeric", month: "short" })` (`plain/format`), the date the Unicode ticket's run prints in 2025 | month `Dùbh`, year `2024` |
  | `years` | `ICU-23609`, `fullcalendar/temporal-polyfill#127` (notes), `ICU-23619` (D25) | `formatDate("2124-03-20", "en-u-ca-persian", { year: "numeric", month: "long", day: "numeric" })`, then `formatDate("1870-03-01", "en-u-ca-japanese", { era: "short", year: "numeric" })` (`plain/format`) | `Farvardin 1, 1503 AP`, then `1870 AD` |
  | `day-off` | `ICU-23627`, `WebKit 331726` (no workaround), `fullcalendar/temporal-polyfill#128` (note) | `holidayDates({ name: "Spring Festival", kind: "calendarFixed", calendar: "chinese", monthCode: "M01", day: 1 }, 2027)` (`calendar/rules`) | `[]`, marked lost, with a note that GMT has no answer yet: `@js-temporal/polyfill` throws on every Chinese date under ICU 78 (js-temporal/temporal-polyfill#360) |
  | `manila` | `tc39/proposal-temporal#3330` (zoned.E) | `resolveLocal("1844-12-30T12:00:00", …reject)`, `classifyLocal("1844-12-31T12:00:00", "Asia/Manila")`, `resolveLocal("1845-01-01T12:00:00", …reject)` (`instant/convert`) | `1844-12-31T03:56:08Z`, `nonexistent`, `1845-01-01T03:56:08Z`: two local days a day apart in UTC |
  | `engines` | `nodejs/node#67457` (note) | `diffDateAsDuration("2000-01-01", "2001-01-01", "years", { smallestUnit: "months", roundingMode: "halfExpand" })` (`plain/calculate`) | `P1Y` |

  On `day-off` the step says what the data says and no more: GMT has no workaround for the
  Kolkata bug (the two notes as written), and for Chinese dates the call returns nothing, beside
  the #128 note, which names the weekly swap check. No reason for the empty result is given
  beyond the note. Notes for the GMT steps say what GMT did, never that a library is wrong.
- **`scoreboard`**: `FilingLegend` with the filings as pins ([slice 6](./s6-time-not-camera.md#filings-as-pins)).
- **`familiar`** ("Names you already know"), after `gmt`: three `FamiliarPair`s from `familiar.json`:

  | Job | Moment / date-fns / Day.js shape | GMT call | Result |
  | --- | --- | --- | --- |
  | Add a month to 31 January | `moment("2027-01-31").add(1, "month")` · `addMonths(new Date(2027, 0, 31), 1)` · `dayjs("2027-01-31").add(1, "month")` | `addDate("2027-01-31", { months: 1 })` | `2027-02-28` |
  | Days between two dates | `moment("2027-03-28").diff("2027-01-01", "days")` · `differenceInCalendarDays(new Date(2027, 2, 28), new Date(2027, 0, 1))` · `dayjs("2027-03-28").diff("2027-01-01", "day")` | `diffDate("2027-01-01", "2027-03-28", "days")` | `86` |
  | Start of the month | `moment("2027-03-28").startOf("month")` · `startOfMonth(new Date(2027, 2, 28))` · `dayjs("2027-03-28").startOf("month")` | `startOfDate("2027-03-28", "month")` | `2027-03-01` |

  GMT calls are `plain/calculate`, computed at build time. The other shapes are code text only,
  checked against each library's docs and by R's harness test. A contrast of shape: notes say
  "Same jobs, same kind of names; strings in, strings out." No verdict.
- **`gmt`**: the running question, answered: `resolveLocal("2027-03-28T03:30:00",
  "Europe/Helsinki", { disambiguation: "reject" })` (NO SIGNAL), then `classifyLocal` on the
  same input (`"nonexistent"`), both in one `GmtRun`. Build 1 and 2 keep the crystal clock at
  02:59, then 04:00 ([slice 6](./s6-time-not-camera.md#the-crystal-clock)). The `addDate`
  result moves to `familiar`; the `addZoned` one is dropped.
- **`guards`**: one paragraph from `compatGroups`, `groupsStillNeeded`, `probeTotals` and
  `gmtStats`, and the link to every filing. The bug slides already showed guards at work.
- **`ask-dox`**, **`page-tools`**: [slice 4b](./s4b-live-agents.md).
- **`why-not-temporal`** ("Why not just Temporal?"): three plain points: bad input throws, a
  time that never happened is moved rather than refused, and engines and polyfills disagree (GMT
  guards the bugs still open, tested in `gmtStats.timezones` zones; no bug count). Notes link to `/upstream/`, `/pulse/` and issue #316.
  Facts only.
- **`qa`** ("Q&D: Questions and Dox"): the audience-question panel (slice 4b); the notes say questions run
  through Dox chat or aloud and link to the spare.
- **`thanks`**: two `QrCode`s, labelled "LinkedIn" (`https://www.linkedin.com/in/craigocurtis/`)
  and "NorthGuild" (`https://northguild.dev/`); the site and repository links as text. It is the last
  main slide. Each URL is one constant used for the code and the text.
- **`spare-size`** ("How big is it?"): four rows of `bundleRows()` (`@js-temporal/polyfill`,
  `isValidDate`, `formatDate`, `@northguild/gmt`) through `bundleCells`, with the measurement's
  date, Node and esbuild from `bundle-size.json`, and a link to `/bundle-size/`.

## The run panel

`CodeRun.astro` is every snippet on stage, laid out the way a test runner prints a run: a runtime
heading, then each step's code and one outcome row. A shell command (`$`) is a terminal: it types
out after its prompt. A JavaScript call (`>`) sits in the site's own code block (`DeckCode`, the
Starlight `Code` block in its dark theme), as every example on the guides does. The outcome row
holds the **Result** (the lines the step printed) and, beside a result that is not right, the
**Expected** value (the step's `want`); a right result has no Expected row, since it would repeat
the result. The values share one line while they fit and wrap when not, their labels one width so
a wrapped value starts in the same column.

`RunLabel.astro` labels every value: "✗ Result" in red for a bug, "✓ Expected" in green for the
right value, "✓ Result" in green for a right result, and "∅ Result" for a sentinel (`""`, `null`,
`false`, `[]`), printed as it is in Signal-lost amber
([Colour](../../reference/visual-design.md#colour)). A run can name who gave its results in place
of "Result" (`by`). Red and green are the deck's pair (`--gmt-deck-wrong`, `--gmt-deck-right` in
`slides.css`); the split-flap rows and the calendar figures (`MonthShift`, `MonthPage`) take the
same labels and colours.

`GmtRun.astro` builds the steps from gmt calls (`module`, a key of `GMT_MODULES`, `name`, `args`)
through `gmtSteps`, which awaits `callGmt` at build time, so the code shown and the value shown
come from one source. Module barrels only. Its first block opens with the calls' imports from
`@northguild/gmt/<module>` (`importText`), so nobody has to guess whose code it is, and its results
read "✓ GMT". A call's `bug` (who gives it, and the value or words from its filing) prints in red
beside GMT's result, as "✗ temporal-polyfill", "✗ Intl", "✗ Temporal" or "✗ Node 26": the slide says what
GMT returns and what the filed bug gives for the same input. `content.test.ts` holds every `bug`
to its report.

## Panels

Opaque `--gmt-surface-widget`, full bevelled border (`corner-shape: bevel`), any accent on the
bottom edge only. No left-only stripe on any card, step, pair or code block.

## Tests

- `scripts/slides-built.test.ts` reads every registered deck as built through `distDirOrSkip()`:
  ids unique, spares last and without minutes, main minutes sum to the registry's `minutes` plus
  `qa`, every slide has notes. `src/slides/give-me-temporal/built.test.ts` holds Deck 0's own:
  the outline order, six wall figures with captions, and `date`'s table opening on the agents'
  question with no wall figures.
- A place, reveal zone or lapse a slide names that the deck's stage data lacks fails the build
  (`checkStageNames` in `Slide.astro` and `Build.astro`).
- `gmt-call.test.ts`, `decks.test.ts` as built; the new pieces' tests are in
  [slice 7](./s7-running-question.md#tests-and-checks).

## Definition of done

- The deck plays end to end at `/slides/give-me-temporal/` with every build and note; the owner
  rehearses it once against the presenter timer.
- No figure on any slide is typed by hand; removing a filing key from the JSON fails the build.
- Own tests, `pnpm dox:lint` and `pnpm dox:check` green; the owner's listening pass.
