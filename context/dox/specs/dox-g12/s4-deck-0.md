# Slice 4 · Deck 0 content: "Give Me Temporal"

[Index](./index.md) · Binding rules: [built/index.md](../../built/index.md) (the rules that bind
every change), [visual-design.md](../../reference/visual-design.md). Data: `src/data/upstream-filings.ts`,
`src/data/date-faults.ts`, `src/data/temporal-compat.ts`, `src/data/gmt-stats.ts`,
`src/data/zone-matrix.ts`. Live demos: [slice 4b](./s4b-live-agents.md).

## Goal

The 20 slides of the HelsinkiJS talk, in `src/slides/give-me-temporal/Deck0.astro`, using slice
1's components, slice 2's places, slice 2b's wall and slice 3's notes. Every bug on stage is a real filing read
from `upstream-filings.json`; every gmt result is computed by gmt at build time; every count is
derived. The talk runs 20 minutes; slide 16 holds 5 minutes of questions.

## Registry entry

`src/slides/decks.ts` gains `{ slug: "give-me-temporal", label: "Deck 0", title: "Give Me
Temporal", event: "HelsinkiJS", start, minutes: 20, qa: 5, zone: "Europe/Helsinki", locale: "fi" }`.
`start` is the talk's local date and start time as a plain date-time string in the registry's
zone. Until the owner supplies it, the entry holds the exported constant
`OWNER_TO_SUPPLY_TALK_START = "OWNER-TO-SUPPLY"` with a comment saying so, and the pages say
"Date to be announced". `slides-check.mjs` fails while the placeholder is in the build, so the
PR's required gate blocks the merge until the real value lands (slice 5). The index
page and the title slide render the date with gmt from `start` and `zone`.

## Slides

The outline, places and minutes are in [the index](./index.md#deck-0-outline-20-minutes). Content
rules per slide:

- **`title`**: "Give Me Temporal", the event and date, and the venue's local time now from gmt
  (`getZonedNow` from `@northguild/gmt/zoned/get` in the registry's zone, shown with
  `formatZonedDateTime` from `@northguild/gmt/zoned/format`), dynamically imported; until it
  loads the slot shows the server-rendered date only. The slot is a kit `readout` with samples,
  so the arriving time moves nothing.
- **`one-clock`**: the ice wall ([slice 2b](./s2b-ice-wall.md)): six captioned `<figure>`s
  from `wall.json` in a three by two grid in the left two thirds, under the title, and under
  them the slide 2 agent quote from `quotes/agent-moment.json` (the
  owner's real transcript: the question, the model, the date, the answer's code), set as a
  quotation with its source line. No library is named in the slide's own text beyond the
  captions; the logos appear only inside the captured images. Notes: "Each of these sites shows
  one clock. That is the view most date code takes: one place, one local time. Hold that."
- **`date`**: the wall breaks as the slide arrives and the clock stays in the right third; the
  table enters once the shards are clear and fits the left two thirds. Rows from `dateFaults`
  (`date-faults.ts`), the same table the home page states, so the deck never types its own `Date`
  claims (and stays outside `date-ban.test.ts`). The slide has no builds: every row's code types
  out together when the table appears, not at arrival.
- **`temporal`**: the clock turns into the Earth in place, then the text enters; Temporal's arrival
  and per-engine state from `temporal-compat.ts` (`engineLabel`, `stateLine`); no engine version
  typed by hand. The text sits left of the Earth, in plain words: what Temporal does, then how
  many known bugs still need a workaround and in which engines. The guard and probe counts are on
  `guards`.
  Notes: "One clock against the whole planet. Temporal takes the zone as data, so code can ask
  any place on Earth, and GMT is built on it."
- **`experiments`, then one slide per experiment** (`gaps`, `overlaps`, `host`, `odd`): the
  opener (`ExperimentOpener`) gives the number of cases, libraries and zones in one line; each
  experiment slide (`ExperimentSlide`) asks its question in large type, then one bar per library
  with its wrong count, one example and a footnote. All of it is read from `zone-probe.json`.
  GMT stays in the list, its zero in green. Notes say what was fed in, and nothing about the
  libraries beyond the counts.
- **`abort`, `years`, `day-off`, `manila`, `engines`**: one `FilingCard` per filing, as listed
  in the index outline; `years` has one build per place (Tehran, Tokyo) and `day-off` one per
  place (Kolkata, Shanghai, the Moon). Under the cards, a short reproduction and the observed and
  expected lines, written from that filing's own text (its `summary` and the linked report), in a
  Starlight `<Code>` block. Nothing runs on stage; no bug is described beyond what its filing says.
- **`scoreboard`**: filings by tracker and by state from `filingsByRepo`, `filingsByState` and
  `filingGroup`; total from `filings.length`. A plain `<table>` with a caption, no chart.
- **`gmt`**: three calls whose results gmt computes at build time through `GmtResult`:
  `addDate("2024-01-31", { months: 1 })` from `plain/calculate`, an `addZoned` across the
  Europe/Helsinki spring change from `zoned/calculate`, and `resolveLocal` with
  `{ disambiguation: "reject" }` on a skipped Helsinki time from `instant/convert`, whose `""`
  renders as the amber NO SIGNAL sentinel. The function count comes from `gmt-stats.ts`.
- **`guards`**: the guard and canary story from `temporal-compat.ts` (`compatGroups`,
  `groupsStillNeeded`, `probeTotals`); derived numbers only.
- **`ask-dox`**: the slide 2 question again, sent live (`LiveAnswer`, slice 4b). Notes: "Same
  question, but this agent has the whole planet's tools."
- **`page-tools`**: the live `check_eta_against_cutoff` call, then this deck's three tools, the
  agent prompt and `llms.txt`. Links are `withBase` page links ending in `/`.
- **`thanks`**: the site URL, the repository and the audience-question panel (slice 4b). The sky
  data credits and the wall's capture credits are in the info menu on every slide.

Every slide has `<Notes>` written in plain English for the owner's review. The deck's framing,
in the index lede and the title slide's notes, is "one clock against the whole planet": a
contrast of viewpoint, never a verdict on a library. Examples use Helsinki,
Tokyo and other places; no national default, no law, no business wording.

## `FilingCard.astro`

Props: `filing` (a `filingKey`, for example `"nodejs/node#67076"` or `"ICU-23609"`). It calls `findFiling`, which finds the
filing in `filings` and renders `filingRef`, the tracker group name, the title, the state as a
badge (kit `badge`) with words, and a link to `url`. An unknown key throws at build time, so a
renamed or removed filing fails the build rather than vanishing.
Panel: opaque `--gmt-surface-widget`, full bevelled border (`corner-shape: bevel`), the state
colour on the bottom edge only. No left-only stripe.

## `GmtResult.astro`

Props: `module` (a key of `GMT_MODULES` in `src/lib/gmt-modules.ts`), `name`, `args` (a JSON
array). It renders `callText` from those props and awaits `callGmt` at build time, so the
code shown and the value shown come from one source. A sentinel (`""`, `null`, `false`, `[]`)
renders as `⟨ NO SIGNAL — invalid input ⟩` in Signal-lost amber
([Colour](../../reference/visual-design.md#colour)). An unknown module or name throws at build.
Module barrels only, never a namespace barrel.

## Tests

- `scripts/slides-built.test.ts` reads the built deck page through `distDirOrSkip()` (the
  `display-font-built.test.ts` pattern: returns early without a build, throws under
  `DOX_DIST_REQUIRED`). It checks slide ids unique and in outline order; `data-minutes` sum to
  the registry's `minutes` (20); every `data-place` resolves (`resolvePlace`); every slide has
  notes; slide 2 has four figures with captions. The repo renders no `.astro` in Vitest, so the built HTML is the test surface.
- `filing-card.test.ts` and `gmt-result.test.ts` test the pure lookups the two components call
  (`findFiling(key)` in `src/lib/slides/filing.ts`, `callGmt(module, name, args)` and
  `callText(name, args)` in `src/lib/slides/gmt-call.ts`): a found filing, an unknown key throws;
  a value, a sentinel, an unknown module or name throws; the call text matches the args.
- `decks.test.ts`: `start` is the placeholder or parses as a plain date-time in `zone`.
- The title slide's clock: jsdom with the gmt modules faked (`vi.mock`, `isolated` project), the
  mount aborted in `afterEach`; the slot keeps its box when the time arrives (sizer present).
- `pnpm dox:docs-check` is unaffected (no reference page changes).

## Definition of done

- The deck plays end to end at `/slides/give-me-temporal/` with every flight, build and note;
  the owner rehearses it once against the presenter timer.
- No figure on any slide is typed by hand; removing a filing key from the JSON fails the build.
- Own tests, `pnpm dox:lint` and `pnpm dox:check` green; the owner's listening pass.
