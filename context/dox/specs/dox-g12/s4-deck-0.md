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
- **`one-clock`** ("One clock for the whole planet"): the ice wall ([slice 2b](./s2b-ice-wall.md)).
  Notes: "Each of these sites shows one clock. That is the view most date code takes, and the view
  the agents took: one place, one local time. Hold that."
- **`date`**: the wall breaks as the slide arrives; the table enters once the shards are clear.
  Rows from `dateFaults`; every row's code types out together. The guess row is
  `new Date("2025-03-30T01:30")`: its result and reason wait for build 1.
- **`temporal`**: Temporal's arrival and per-engine state from `temporal-compat.ts`
  (`engineLabel`, `stateLine`), in plain words, left of the Earth.
- **`experiments`, then `gaps`, `overlaps`, `host`, `odd`**: `ExperimentOpener` and
  `ExperimentSlide`, read from `zone-probe.json`; GMT stays in the list, its zero in green.
  `experiment-gaps` takes `guess`: the question first, the bars on build 1.
- **Bug slides**: the visuals and receipts of [slice 6](./s6-time-not-camera.md#a-visual-per-bug),
  then one last build with `GmtStep` ([slice 7](./s7-running-question.md#the-gmt-step-on-each-bug-slide)).
  Each call below was run on Node 22 and 26 (ICU 78.3) with these results:

  | Slide | Filings | GMT call (module) | Result |
  | --- | --- | --- | --- |
  | `abort` | `nodejs/node#67076` (D23), `CLDR-19873` (D24) | `formatDateToParts("1970-01-01", "gd", { year: "numeric", month: "short" })` (`plain/format`) | month `Faoi`, year `1970` |
  | `years` | `ICU-23609`, `fullcalendar/temporal-polyfill#127` (notes), `ICU-23619` (D25) | `formatDate("1870-03-01", "en-u-ca-japanese", { era: "short", year: "numeric" })` (`plain/format`) | `1870 AD` |
  | `day-off` | `ICU-23627`, `WebKit 331726` (no workaround), `fullcalendar/temporal-polyfill#128` (note) | `holidayDates({ name: "Spring Festival", kind: "calendarFixed", calendar: "chinese", monthCode: "M01", day: 1 }, 2027)` (`calendar/rules`) | `[]`, shown as NO SIGNAL |
  | `manila` | `tc39/proposal-temporal#3330` (zoned.E) | `resolveLocal("1844-12-31T12:00:00", "Asia/Manila", { disambiguation: "reject" })` (`instant/convert`) | `""`, shown as NO SIGNAL |
  | `engines` | `nodejs/node#67457` (note) | `diffDateAsDuration("2000-01-01", "2001-01-01", "years", { smallestUnit: "months", roundingMode: "halfExpand" })` (`plain/calculate`) | `P1Y` |

  On `day-off` the step says what the data says and no more: GMT has no workaround for the
  Kolkata bug (the two notes as written), and for Chinese dates the call returns nothing, beside
  the #128 note, which names the weekly swap check. No reason for the empty result is given
  beyond the note. Notes for the GMT steps say what GMT did, never that a library is wrong.
- **`scoreboard`**: `FilingLegend` with the filings as pins ([slice 6](./s6-time-not-camera.md#filings-as-pins)).
- **`familiar`** ("Names you already know"): three `FamiliarPair`s from `familiar.json`:

  | Job | Moment / date-fns / Day.js shape | GMT call | Result |
  | --- | --- | --- | --- |
  | Add a month to 31 January | `moment("2027-01-31").add(1, "month")` · `addMonths(new Date(2027, 0, 31), 1)` · `dayjs("2027-01-31").add(1, "month")` | `addDate("2027-01-31", { months: 1 })` | `2027-02-28` |
  | Days between two dates | `moment("2027-03-28").diff("2027-01-01", "days")` · `differenceInCalendarDays(new Date(2027, 2, 28), new Date(2027, 0, 1))` · `dayjs("2027-03-28").diff("2027-01-01", "day")` | `diffDate("2027-01-01", "2027-03-28", "days")` | `86` |
  | Start of the month | `moment("2027-03-28").startOf("month")` · `startOfMonth(new Date(2027, 2, 28))` · `dayjs("2027-03-28").startOf("month")` | `startOfDate("2027-03-28", "month")` | `2027-03-01` |

  GMT calls are `plain/calculate`, computed at build time. The other shapes are code text only,
  checked against each library's docs and by R's harness test. A contrast of shape: notes say
  "Same jobs, same kind of names; strings in, strings out." No verdict.
- **`gmt`**: the running question, answered: `resolveLocal("2027-03-28T03:30:00",
  "Europe/Helsinki", { disambiguation: "reject" })` through `GmtResult` (NO SIGNAL), then
  `classifyLocal` on the same input (`"nonexistent"`). Build 1 and 2 keep the crystal clock at
  02:59, then 04:00 ([slice 6](./s6-time-not-camera.md#the-crystal-clock)). The `addDate`
  result moves to `familiar`; the `addZoned` one is dropped.
- **`guards`**: one paragraph from `compatGroups`, `groupsStillNeeded`, `probeTotals` and
  `gmtStats`, and the link to every filing. The bug slides already showed guards at work.
- **`ask-dox`**, **`page-tools`**: [slice 4b](./s4b-live-agents.md).
- **`why-not-temporal`** ("Why not just Temporal?"): three plain points: bad input throws, a
  time that never happened is moved rather than refused, and engines and polyfills disagree (the
  filing count and `gmtStats.timezones`). Notes link to `/upstream/`, `/pulse/` and issue #316.
  Facts only.
- **`qa`** ("Q&D: Questions and Dox"): the audience-question panel (slice 4b); the notes say questions run
  through Dox chat or aloud and link to the spare.
- **`thanks`**: two `QrCode`s, labelled "LinkedIn" (`https://www.linkedin.com/in/craigocurtis/`)
  and "NorthGuild" (`https://northguild.dev/`); the site and repository links as text. It is the last
  main slide. Each URL is one constant used for the code and the text.
- **`spare-size`** ("How big is it?"): four rows of `bundleRows()` (`@js-temporal/polyfill`,
  `isValidDate`, `formatDate`, `@northguild/gmt`) through `bundleCells`, with the measurement's
  date, Node and esbuild from `bundle-size.json`, and a link to `/bundle-size/`.

## `GmtResult.astro`

Props: `module` (a key of `GMT_MODULES`), `name`, `args`. It renders `callText` and awaits
`callGmt` at build time, so the code shown and the value shown come from one source. A sentinel
(`""`, `null`, `false`, `[]`) renders as `⟨ NO SIGNAL — invalid input ⟩` in Signal-lost amber
([Colour](../../reference/visual-design.md#colour)). Module barrels only.

## Panels

Opaque `--gmt-surface-widget`, full bevelled border (`corner-shape: bevel`), any accent on the
bottom edge only. No left-only stripe on any card, step, pair or code block.

## Tests

- `scripts/slides-built.test.ts` reads the built deck through `distDirOrSkip()`: ids unique and
  in outline order, the spare last; main minutes sum to the registry's 20 plus its 5 of `qa`; every `data-place`
  resolves; every slide has notes; six wall figures with captions; no wall on `date`.
- `filing-card.test.ts`, `gmt-result.test.ts`, `decks.test.ts` as built; the new pieces' tests
  are in [slice 7](./s7-running-question.md#tests-and-checks).

## Definition of done

- The deck plays end to end at `/slides/give-me-temporal/` with every build and note; the owner
  rehearses it once against the presenter timer.
- No figure on any slide is typed by hand; removing a filing key from the JSON fails the build.
- Own tests, `pnpm dox:lint` and `pnpm dox:check` green; the owner's listening pass.
