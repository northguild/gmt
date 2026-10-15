# Spec: the intermodal tools (INT-14)

What `apps/dox` ships for INT-14 (#304): four tools, a shared look for the day-strip tools, and
fixes to four tools beside them. `dox-builder` builds against this spec, and `dox-tester` verifies
against section G. This is not `packages/gmt` work.

| Tool | Page | Kind | Chat tool | Library calls |
| --- | --- | --- | --- | --- |
| B/L Date Stamp | `/tools/bl-date-stamp/` | `bldate` | `showBlDateStamp` | `bolTimestamp`, `isAfterDate`, `areDatesEqual` |
| Journey Split | `/tools/journey-split/` | `journeysplit` | `showJourneySplit` | `multimodalETA`, `scheduleDelivery`, `diffUtcAsDuration` |
| Demurrage Clock | `/tools/demurrage-clock/` | `demclock` | `showDemurrageClock` | `demurrageClock`, `toOffsetInstant`, `diffUtcAsDuration` |
| EPCIS Event Reader | `/tools/epcis-event-reader/` | `epcis` | `showEpcisEventReader` | `parseEpcisEvent`, `formatEpcisEvent`, `convertUtcToPlainDate`, `chopTime`, `isAfterDate`, `areDatesEqual` |

The existing tools this spec changes: the Free Time Ledger and the Dwell Ledger (the family look
and the stillness gate), Billing Deadlines (three deadline plates) and the Delivery Scheduler (a
hand-off link and one word). Every list inside a widget loses the prose list marker.

**The library surface**, as built in `packages/gmt/dist`:

| Function | Barrel | Signature and result |
| --- | --- | --- |
| `bolTimestamp` | `intermodal/format` | `(value, event, { timeZone })` gives `"YYYY-MM-DD"` or `""`. `event` is `issue`, `received` or `shippedOnBoard`. `timeZone` is an IANA name or a UTC offset. All three events give the same date |
| `multimodalETA` | `intermodal/calculate` | `(legs, options?)` gives `{ eta, totalLegs, totalTransit, totalDwell }` or `null`. It returns no per-leg times |
| `demurrageClock` | `intermodal/calculate` | `(events, scope, { direction, startEvent? })` gives `{ start, end }` in the caller's own strings, or `null` |
| `parseEpcisEvent` | `intermodal/parse` | `({ eventTime, eventTimeZoneOffset })` gives `{ instant, offset, local }` or `null` |
| `formatEpcisEvent` | `intermodal/format` | `({ instant, offset })` gives `{ eventTime, eventTimeZoneOffset }` or `null` |
| `isValidEpcisEventTime`, `isValidEpcisTimeZoneOffset` | `intermodal/validate` | one string each, `boolean` |
| `scheduleDelivery` | `transport/calculate` | `(legs, options?)` gives `{ eta, legTimes }` or `null` |
| `isAfterDate`, `areDatesEqual` | `plain/compare` | two `YYYY-MM-DD` dates. `isAfterDate` returns `false` for a date-time, so it is given dates only |
| `chopTime` | `plain/chop` | `"2024-06-16T01:30:00"` gives `"2024-06-16"` |
| `convertUtcToPlainDate` | `utc/convert` | `"2024-06-15T23:30:00Z"` gives `"2024-06-15"` |
| `toOffsetInstant` | `instant/convert` | any instant gives `{ instant, offset, timeZone? }`, `instant` ending in `Z` |
| `diffUtcAsDuration` | `utc/calculate` | `(a, b, "hours")` gives `"PT139H30M"`. It reads `Z` instants only: an offset or a bracketed zone returns `""` |
| `isValidInstant`, `isValidDate`, `isValidTimeZone` | `precision/validate`, `plain/validate`, `zoned/validate` | one string each |

Sources, in order of precedence: the binding rules in section 0, then the JSDoc of each function
above, then `context/domination/docs-site.md`, then `context/dox/built.md`. The shape follows
`context/dox/specs/int-15-edi-timestamp-tools.md` (a family with a shared helper, loader and
sheet) and `context/dox/specs/tran-57-charts-restyle.md` (the plates and the stillness gate).

**Every value in this spec and on the pages is a real call.** A result shown on a page is pasted
from a run against the built library, never typed. A test runs each preset against the library.

Line anchors are for the tree this spec describes. Re-read each file before editing: an anchor
says where to look, not what is there.

---

## 0. Binding rules

- **No git operation that changes state, and no `gh` write.** No `add`, `commit`, `stash`,
  `checkout`, `restore`, `rm`, `worktree add`, `push`, pull request or issue edit. Every change
  stays unstaged in the working tree.
- **Three places are never touched:** `packages/gmt` (source, tests, skills, READMEs),
  `.changeset/` and `context/domination/`. A library problem found while working on the site is
  reported to the main session and never built around.
- **Never rebuild `packages/gmt/dist` in this worktree.** A dev server on port 4321 runs from it
  and aliases the library to `dist`, so a rebuild breaks every open tool. Do not run
  `pnpm run validate`, `pnpm build`, `pnpm dox:dev`, `pnpm --filter @northguild/gmt build` or any
  script that builds the library here. `dist` is current and holds every function above.
- **Never use port 4321 or `apps/dox/dist`.** A site build goes into a private folder under the
  session scratchpad, with `DOX_VITE_CACHE_DIR` set to a private folder, and is served on another
  port (section G0). Stop every server you start.
- **Toolchain.** This machine has `fnm`. Prefix every Node command with
  `eval "$(fnm env)" && fnm use &&`.
- **Never run `vitest list --json` with a file path.** Vitest 4 overwrites that path. Use
  `vitest run <file> --reporter=verbose`.
- **Import gmt at module granularity only**, through `GMT_MODULES`. Never the root and never a
  namespace barrel. Every subpath the new tools use is already a key of `GMT_MODULES`.
- **The widget draws the library's results and computes none of them.** Every date, duration,
  verdict, interval and total on screen is a gmt call. Positions and formatting are the site's:
  where a mark sits, `"PT400H"` shown as "16 d 16 h", an instant shown as "Fri 14 Jun 15:00" on a
  zone's clock. `@js-temporal/polyfill` is imported for drawing only. A test asserts the drawing
  agrees with the library for every preset.
- **The printed call is the call made.** Each tool records its calls (`runCall`, section B0.2)
  and prints them one a line, with the results beside them in the same order. A blank optional
  input is left out of the call and never filled from a preset.
- **The site holds no table of the library's rules.** Which two events bound a clock comes from
  probing `demurrageClock` (section B3), never from a table of scopes. Whether an EPCIS field is
  readable comes from the library's validators.
- **GMT tracks no law, and the UI names no body.** No statute, regulation, agency, court,
  carrier, bank rule or jurisdiction label appears in a widget string, a preset, a chat doc, page
  copy or a test name. The `demurrageClock` JSDoc names carriers as evidence; the site does not
  repeat them. "Latest date allowed" is the caller's date and names no rule. A place may be named
  as an example ("New York", "Rotterdam"). Standards are named as data: the DCSA field names
  `issueDate`, `receivedForShipmentDate` and `shippedOnBoardDate`, GS1 EPCIS 2.0, ISO/IEC 19987,
  UN/EDIFACT and ANSI X12. Each pure module states this rule in its header comment.
- **Nothing guesses a zone.** No module maps a place, a port or an offset to a zone. A preset is
  an example and carries its zones as literal fields, written by hand beside its description. A
  permalink or chat seed names only what it carries.
- **Every sentinel renders through `renderWidgetOutput(out, "NO SIGNAL", "sentinel")`** with a
  caution aside of one plain sentence. A state with no library call behind it renders through
  `renderWidgetOutput(out, text, "empty")`, never amber. A `null` or `""` the library returned is
  always the sentinel. `multimodalETA`'s result for no legs is a value, not a sentinel; the form
  always holds one leg, so it is not reachable.
- **No left-border-only accent** on any plate, row, callout or result block. An accent edge is a
  bottom edge, or the element has a full border. No class contains `card` except
  `.gmt-widget-card`.
- **Amber is the sentinel's alone.** No verdict, mark, bar, line or state is amber, green for
  good or red for bad. Verdicts are words and patterns. A series colour goes on a mark, never on
  text.
- **Readouts hold still.** Hero plates are pinned at their edges with reserved widths,
  `tabular-nums` and `nowrap`. Every region is present in every state. Nothing above a dragged
  control moves.
- **Every new tool ships with its Dox button:** the `CHAT_STARTERS` card and the chat widget
  registration land with the tool.
- **Zero known bugs.** No `it.skip`, `it.todo` or `it.fails`. A defect found is fixed now, with
  every other case of it. Every existing test assertion stays unless this spec changes the thing
  it asserts; each one that changes is listed in the builder's report with its reason.
- **No constants that age.** No tool holds a fixed year window or a century pivot. A preset's
  dates are an example and carry their year.
- **No catch-all functions** in new site helpers. A call the types accept returns a value: split
  a helper by kind with narrow unions, and return one shape.
- **Plain English** (`/plain-english`) for page copy, widget strings, comments and context files:
  short sentences, active voice, one idea each, no "simply" and no "just". Page copy holds no
  tool, function or test count.
- **React stays inside `/dox`.** Each tool page is Astro plus a plain-DOM module. A tool page
  imports no `dox-tools.ts`, `zod` or `ai`.
- **A folded story leaves no id.** The EPCIS tool and the restyles belong to INT-14 (#304). No
  story id is invented for them.

---

## A. Scope and non-goals

**In scope:** the four tools with their chat registration; the shared ledger sheet; the Free Time
Ledger and Dwell Ledger restyle and their `readout:still` entries; Billing Deadlines' plates; the
Delivery Scheduler's link and label; the list-marker rule; four tool pages and the links into
them; `context/dox/built.md`, `context/dox/reference/design-system.md` and
`context/dox/specs/int-15-edi-timestamp-tools.md`.

**Not in scope:**

- A restyle of the Connection Checker or the Crossing Clock.
- A drag handle on the Journey Split or the Demurrage Clock. The Connection Checker and the
  Departure Board own "slide a connection", and the Demurrage Clock teaches which pair of events,
  not where they sit.
- A currency, a rate or an amount anywhere. The tools count days and name dates.
- A registry of places, ports or zones, and any tool that reads a whole EPCIS document.
- A disambiguation control. A B/L value and an EPCIS `eventTime` are moments, and a moment has one
  local date.
- `packages/gmt`, the READMEs, `.changeset/` and `context/domination/`.

---

## B. The tools

Each new tool has a pure module (state, presets, reading and text; no DOM and no gmt import) and
a mount (`…-mount.ts`: `render…Template(args)` and `mount…(root, args, signal)`), an Astro shell
and a tool page, as `dtm-decoder.ts` and `DtmDecoder.astro` do. Each root is
`<div class="gmt-<slug> gmt-widget not-content">`, the first thing in the template, with no other
attribute. Each mount wires delegated listeners on the root, throws `WidgetLoadError` when its
loader rejects, and returns `onceDestroy` with `getPermalinkState`.

### B0. Shared pieces

#### B0.1 `src/styles/gmt-ledger-widgets.css`

One sheet for the five tools that draw time on local days: the Free Time Ledger (`.gmt-freetime`),
the Dwell Ledger (`.gmt-dwell`), the B/L Date Stamp (`.gmt-bl-date-stamp`), the Journey Split
(`.gmt-journey-split`) and the Demurrage Clock (`.gmt-demurrage-clock`). It is registered in
`astro.config.mjs` `customCss` after `gmt-departure-board.css`, and the five tool sheets follow
it, so a tool sheet always comes after the recipes it refines. `gmt-dwell-ledger.css` and
`gmt-free-time-ledger.css` move to that place in the list.

It reuses, and does not copy:

- **The plates:** `.gmt-punct-heroes`, `.gmt-punct-hero`, `.gmt-punct-hero-cap`, `-value`, `-sub`
  and `heroLinesHtml` (`gmt-punctuality-widgets.css`, `punctuality-widgets.ts`). The classes are
  unscoped, so the five roots use them as they are. A quiet plate is `.gmt-punct-hero--quiet`.
- **The chart recipes of `gmt-cutoff-widgets.css`:** the five roots join every root `:is()` list
  there (the series mapping, the swatch, `.gmt-cutoff-chip`, `.gmt-cutoff-mark`,
  `.gmt-cutoff-gate`, `.gmt-cutoff-closed`, the axis ticks), and `.gmt-ledger-frame` joins the
  chart-surface list beside `.gmt-punct-frame`. The sheet's header and its "seven roots" comments
  are reworded to name no count.
- **The hatch:** `.gmt-punct-hatch` (`gmt-punctuality-widgets.css`), by adding the five roots to
  its `:is()` list.

It adds only what no sheet has:

- **`.gmt-ledger-frame`:** the drawn frame that holds the plates and the chart. It is the `frame`
  the stillness gate records.
- **`.gmt-ledger-days` and `.gmt-ledger-day`:** full-height glass day columns with a header strip
  (`.gmt-ledger-day-label`, an opaque `--gmt-surface` plate holding the date), following the
  Cut-off Stack's day-column recipe. Each column is placed and sized by its day's real bounds, so
  a 23- or 25-hour day is narrower or wider. Neighbouring days alternate in strength through
  `background-color`, never the shorthand. A column too narrow for "15 Jun · Sat" drops the
  weekday, then the label (`--short`, `--narrow`), and its `aria-label` still names the day.
- **The day states**, by `data-state` on a column: `lit` (lit glass in the column's series
  colour), `hatched` (the family hatch), `closed` (`.gmt-cutoff-closed`) and `plain`. A state is a
  pattern and a chip with a word. No state is a verdict colour.
- **The odd-day chip:** a `.gmt-cutoff-chip` reading `23 h` or `25 h` in `--gmt-ice`. Its edge
  follows the sheet's DST pair: dashed `--gmt-dst-gold` for a day shorter than 24 hours, double
  `--gmt-dst-purple` for a longer one. The text never takes the colour.
- **`.gmt-ledger-lane`:** a labelled row over the day columns, with a mono label column whose
  width is one custom property on the root, so every lane starts at the same x. Under 30rem of
  container width the label sits above its lane.
- **The half-open bar** (`.gmt-ledger-bar`): a bar whose start is a solid capped edge and whose
  end is a dashed open edge, the Departure Board's window recipe (`gmt-departure-board.css`).
- **`.gmt-ledger-legend`:** a wrapped row of swatch and word. A swatch is a mark, so it may take
  a series colour or a hatch.
- **`.gmt-ledger-hold`:** a one-cell grid that stacks a live element and hidden sizers, for a
  region whose text comes and goes. The live wrapper stretches (the hold-cell trap in `built.md`).
  Build the markup with `holdHtml` and the sizer helpers of `edi-picture.ts`; pass the class in
  rather than copying the helper.
- **`.gmt-ledger-sr`:** visually hidden text for a live sentence.

Rules for the sheet: `@container` queries by name on the root or the frame; tokens only; no
`[data-theme="light"]` colour block; no `transition` or `animation` on a value, a mark or a
plate; no `backdrop-filter` and no `clip-path`; text at least 12px; every label inside a chart
sits on a chip. An element with an author `display` has its own `[hidden]` rule.

#### B0.2 `src/lib/ledger-widgets.ts` (pure: no DOM, no gmt import)

What the five tools share beyond the grid helpers of `dwell-ledger.ts`:

- `dayColumnsHtml(cells, canvas, states)`: the markup for a row of day columns. `cells` are
  `dayCells` results. `states` maps a date to `{ state, chip?, series? }`. Each column is
  `role="listitem"` with `data-date`, `data-hours`, `data-state` and an `aria-label`.
- `hourDurationText(iso)`: an exact duration the library returned, shown in days, hours and
  minutes with a day as 24 hours (`"PT400H"` is "16 d 16 h", `"PT139H30M"` is
  "5 d 19 h 30 min", `"PT0S"` is "0 h"). It returns `""` for a string that is not such a duration.
  A test asserts it for every duration the presets produce.
- `dateText(date)`: `"2024-06-15"` as "Sat 15 Jun 2024". `localText(instant, zone)`:
  "Fri 14 Jun 15:00" on that zone's clock, and `""` when the zone or the instant cannot be read.
- `zoneWithOffsets`: the zone list for a control that also takes offsets:
  `[...TRANSPORT_ZONES, "+08:00", ...FIXED_OFFSET_ZONES]`, de-duplicated.
- `PlateSpec`, `plateHtml` and `platesHtml`: a plate with `role`, `caption`, `value` (`null`
  reads `NO_RESULT`, "no result", and blanks its lines), fixed sub `lines`, an optional `series`
  and `quiet` (the smaller value of `.gmt-punct-hero--quiet`, for a secondary plate in the same
  row). `platesHtml(role, plates)` is the pinned, `aria-hidden` row. Every new tool builds its
  plates with these.
- `DayMark` (`state`, `chip?`, `series?`, `tier?`, `kind?`, `aria?`), `dayColumnFit` and
  `PAGE_STEP_UNITS` (twelve snap units for PageUp and PageDown).

`label-fit.ts` holds the measuring passes a mount runs after layout: `fitDayColumns(days, trackPx,
dayColumnFit)` sets `--short` and `--narrow` from each column's width, then measures each column
that keeps its chips and sets `--bare` (chips hidden) when they would overflow it;
`thinTickLabels(row)` hides axis tick labels that would collide; `placeLabel` and `pickLabelLeft`
flip and place a chip; `onWidthChange` re-runs a pass on a width change and returns its disposer.
A tool with day columns or an axis runs these passes on paint and on a width change.

The call recorder is `runCall` in `edi-widgets.ts`, widened so any tool can use it:
`runCall<L extends object>(lib: L, fn: keyof L & string, ...args)` returns `{ fn, args, result }`,
and `EdiCall.fn` is a `string`. `renderCalls` and `callResultsText` (`edi-render.ts`) print them.
`callArgs` and `formatValue` come from `punctuality-widgets.ts`, so a printed call and result are
the library's literal input and output.

#### B0.3 Loaders

Each loader is one `Promise.all` over `GMT_MODULES` keys. A failed import rejects, and the mount
turns it into a `WidgetLoadError`. `loadTransportLib`, `TransportLib`, `loadEdiLib` and `EdiLib`
do not change, so no existing tool loads a module it does not use (the `loadTimetableLib`
rule).

| Loader | File | Modules | Members |
| --- | --- | --- | --- |
| `loadBlDateLib` | `src/lib/ledger-lib.ts` | `intermodal/format`, `plain/compare`, `plain/validate` | `bolTimestamp`, `isAfterDate`, `areDatesEqual`, `isValidDate` |
| `loadDemurrageLib` | `src/lib/ledger-lib.ts` | `intermodal/calculate`, `instant/convert`, `utc/calculate`, `precision/validate` | `demurrageClock`, `toOffsetInstant`, `diffUtcAsDuration`, `isValidInstant` |
| `loadJourneyLib` | `src/lib/transport-lib.ts` | `loadTransportLib()` plus `intermodal/calculate`, `utc/calculate` | `TransportLib` plus `multimodalETA`, `diffUtcAsDuration` |
| `loadEpcisLib` | `src/lib/edi-lib.ts` | `intermodal/parse`, `intermodal/format`, `intermodal/validate`, `plain/chop`, `plain/compare`, `utc/convert` | `parseEpcisEvent`, `formatEpcisEvent`, `isValidEpcisEventTime`, `isValidEpcisTimeZoneOffset`, `chopTime`, `isAfterDate`, `areDatesEqual`, `convertUtcToPlainDate` |

`src/test/ledger-lib.ts` exports the same members imported by module path and typed as each
`…Lib`, so no unit test needs a mount's dynamic imports (`src/test/edi-lib.ts` is the model).

### B1. B/L Date Stamp: `/tools/bl-date-stamp/`, kind `bldate`

One moment has a different calendar date in each place. A bill of lading carries the local one.

**Inputs** (`BlDateState`, all strings): `value` (the moment, at most 64 characters), `event`,
`timeZone` (the place of the event), `zone2` to `zone4` (other calendars, optional) and `latest`
(the latest date allowed, optional, `YYYY-MM-DD`).

- **Event** is a `<select>` of the library's three values, labelled with the DCSA field each
  fills: "Shipped on board (`shippedOnBoardDate`)", "Received for shipment
  (`receivedForShipmentDate`)", "Issue (`issueDate`)". A seeded value outside the three is added
  as its own option and reaches the library as given.
- **Place zone** and the three **other calendars** are `<select>`s built with
  `zoneOptionsHtml(zoneWithOffsets, selected, "No zone")`. A seeded zone or offset the list lacks
  is added. "No zone" on the place leaves `options` out of the call.
- **Latest date allowed** is a native `<input type="date">` with the `optional` chip.
- **The slider** is a native range (`rangeFieldHtml`, `data-role="moment-slider"`) under the
  chart. It moves the moment in 15-minute steps across a half-open 72-hour window that starts
  36 hours before the local midnight nearest the moment, in the place zone (UTC when there is
  none): 288 positions, the last 35 h 45 min after that midnight. The window's end is left out
  because it is the start of a day the lanes do not draw. The window
  is set when a preset, a typed value or a zone settles, and never while the slider moves. The
  slider writes the moment into the typed field in the form it was typed (`writeLike`).

**Reading** (`readBlDate`):

1. `bolTimestamp(value, event, { timeZone })` is the B/L date. With no place zone the call is
   `bolTimestamp(value, event)`.
2. `bolTimestamp(value, event, { timeZone: "UTC" })` is the UTC date, the naive read.
3. One `bolTimestamp` call for each other calendar chosen.
4. `areDatesEqual(utc, bl)` and `isAfterDate(utc, bl)` give the words on the UTC plate: "same
   date", "one day later" or "one day earlier". They are called only when both dates came back.
5. With a latest date that `isValidDate` accepts, `isAfterDate(date, latest)` for the B/L date and
   again for the UTC date gives "after" or "on or before". A latest date that is not a date makes
   no comparison, and the line says so.

**Chart: calendar lanes** (`.gmt-ledger-frame`, section 2). Five lanes on one time axis, always
rendered: UTC at the top, the place as lane 1, the other calendars as lanes 2 to 4.

- Each lane is that zone's local days at their true width (`dayCells` over the slider's window).
- The UTC lane is hollow and dashed, and its label reads "UTC (naive)". Lanes 1 to 4 carry
  `data-series` 1 to 4 and a number badge.
- One gate line (`.gmt-cutoff-gate`) marks the moment and cuts every lane. Its chip reads the
  moment in UTC (`01:00Z`).
- In each lane the day that holds the gate is `lit` and carries a date chip. The lit day is the
  one whose date equals the library's result for that lane. A test asserts that it is also the
  day the gate falls in, for every preset.
- A lane with no zone reads "no zone chosen" in the same box. A lane whose zone the drawing
  cannot lay out (an offset with seconds) still shows its date from the library and says its days
  are not drawn.

**Hero plates**, pinned at opposite edges, `aria-hidden`:

| Plate | Caption | Value | Sub lines |
| --- | --- | --- | --- |
| `hero-bl`, series 1 | the event: "Shipped on board date", "Received for shipment date" or "Issue date" | the B/L date (`dateText`) | the local time and the zone id ("21:00 in America/New_York"); the latest-date words, or blank |
| `hero-utc`, quiet | "UTC date" | the UTC date | "one day later", "one day earlier" or "same date"; the latest-date words, or blank |

A plate with no result keeps its box and reads "no result" in `--gmt-ice-dim`. A visually hidden
`summary` (`aria-live="polite"`) says both plates as one sentence, after the slider settles
(`settledAnnouncer`).

**Why `NO SIGNAL`** (`blNullText`), one sentence decided by probing the library, never by a
table: the place zone is missing (every B/L date is local, so the zone is required); the zone is
not one the library reads (`bolTimestamp` of a known instant in that zone returns `""`); the value
is not a moment (it needs a `Z`, an offset, or an offset with a bracketed zone); the event is not
one of the three.

**Presets**, each a JSDoc example or a worked case:

| Id | Value, event, zone | Returns |
| --- | --- | --- |
| `new-york-evening` | `2024-06-16T01:00:00Z`, `shippedOnBoard`, `America/New_York` | `"2024-06-15"`; UTC says the 16th |
| `shanghai-morning` | `2024-06-14T23:00:00Z`, `shippedOnBoard`, `Asia/Shanghai` | `"2024-06-15"`; UTC says the 14th |
| `rotterdam-fall-back` | `2024-10-27T00:30:00Z`, `received`, `Europe/Amsterdam` | the 27th, a 25-hour day; 02:30 happens twice that night and the moment is one of them |
| `apia-deleted-day` | `2011-12-30T10:00:00Z`, `shippedOnBoard`, `Pacific/Apia` | `"2011-12-31"`; the lane has no 30 December |
| `fixed-offset` | `2024-06-16T01:00:00Z`, `shippedOnBoard`, `+08:00` | `"2024-06-16"` |
| `no-zone` | `2024-06-16T01:00:00Z`, `shippedOnBoard`, no zone | `NO SIGNAL` |

Paste each result from a run; the table states what to expect, and the run decides. The
`new-york-evening` preset also carries `Asia/Shanghai` as `zone2`, so the first paint shows two
calendars.

**Template.** Three sections: 1 the moment and the place; 2 the date in each place (plates,
lanes, the slider, the summary and the reason aside); 3 what `bolTimestamp` returns (the calls
made, one a line, and the results). Section 2 carries `gmt-widget-section--wide`.

**Permalink keys:** `value`, `event`, `timeZone`, `zone2`, `zone3`, `zone4`, `latest`. Blank keys
are left out.

**Chat copy.** `showBlDateStamp({ value, event, timeZone, zone2?, zone3?, zone4?, latest? })`.
`value` carries its offset or `Z`. `timeZone` is the place of the event as the reader named it,
an IANA id or an offset; the schema checks its shape only, because a zone the library does not
read is the widget's sentinel to show. Call when the reader asks what date goes on a bill of
lading, or why a B/L date differs from a UTC timestamp.

**Tests.** `bl-date-stamp.test.ts` (every preset against the library, the calls made, the words,
the sentences, the lit day equals the library's date) and `bl-date-stamp-mount.test.tsx` (the
template's roles, every preset's printed calls and results, seeding, permalinks, the slider, the
latest date, naming, lifecycle).

### B2. Journey Split: `/tools/journey-split/`, kind `journeysplit`

The same hours, sorted two ways: in the order they happen, and gathered into moving and waiting.
The Delivery Scheduler draws the legs; this tool draws the split.

**Words.** On screen the stated `dwellAfter` is "handling" and the time spent at a hand-off is
"waiting". The printed call keeps the library's keys. "Dwell" appears only inside a printed call
or result.

**Inputs.** The Delivery Scheduler's leg state: `readArgs`, `legsOf` and `permalinkOf` from
`delivery-scheduler.ts`, and `legObject` and `scheduleCallSource` from `transport-widgets.ts`.
One to four legs. The leg fieldsets use `.gmt-transport-leg` and the Delivery Scheduler's roles
(`leg-count`, `start-zone`, `mode-n`, `duration-n`, `zone-n`, `departure-n`, `dwell-n`), with the
label "Handling after" on `dwell-n`.

**Reading** (`readJourney`):

1. `multimodalETA(legs, options?)` gives `eta`, `totalTransit`, `totalDwell` and `totalLegs`.
2. `collectJourneyFacts(legs, options, lib)` gives each leg's departure, arrival and ready
   instant from `scheduleDelivery`, never by arithmetic.
3. For each hand-off, `diffUtcAsDuration(arrival, nextDeparture, "hours")` is the time waited and
   `diffUtcAsDuration(ready, nextDeparture, "hours")` is the wait beyond the stated handling.
4. `diffUtcAsDuration(firstDeparture, lastArrival, "hours")` is the time door to door.

Each leg's moving time is its own `duration`, the caller's input. The printed calls are
`multimodalETA` and `scheduleDelivery`; the `diffUtcAsDuration` calls print under them.

**Chart: two ribbons on one scale** (`.gmt-ledger-frame`, section 2). The scale is elapsed time
from the first departure, ticked in days or hours.

- **"As it happens":** the legs in order. Moving is a solid stem in the leg's series colour with
  its number badge. Waiting is the family hatch, split by pattern into the handling the caller
  stated and the wait for a scheduled departure. A chip under a wait names both parts ("2 d: 6 h
  handling + 42 h for the scheduled departure"). A wait with no scheduled departure names the
  handling alone.
- **"Gathered":** the same segments pushed together, moving at the left and waiting at the right.
  Two brackets under it carry `totalTransit` and `totalDwell`.
- Positions are drawing. A test asserts the moving segments' widths add up to `totalTransit` and
  the waiting ones to `totalDwell`, for every preset.
- Labels are fitted with `placeLabels` and `label-fit.ts`, and re-fitted on a width change.

**Hero plates**, three, pinned, `aria-hidden`:

| Plate | Caption | Value | Sub line |
| --- | --- | --- | --- |
| `hero-eta`, series 1 | "ETA" | `eta` on the last leg's clock (`localText`) and its zone id | the door-to-door time ("484 h door to door") |
| `hero-moving`, series 2 | "Moving" | `hourDurationText(totalTransit)` | `totalTransit` as returned |
| `hero-waiting`, series 3 | "Waiting" | `hourDurationText(totalDwell)` | `totalDwell` as returned |

**The hand-off table** under the chart, styled as the Cut-off Stack's table is
(`.gmt-cutoff-stack-table`'s recipe, by widening its selectors): one row for each hand-off, with
columns Arrives, Handling, Ready, Departs and Waited. It keeps four rows' height in every state.
Under 34rem it becomes stacked rows with a `data-label` on each cell.

**A `null` result** shows `NO SIGNAL` with `scheduleNullText(diagnose(…))`. The plates read "no
result", and the ribbons and the table keep their boxes and say in words that there is no journey
to draw.

**No drag handle.** The tool is a form and presets. Its definition of done measures the same
boxes across every preset (section G).

**Hand-off, both ways.** A link under the table reads "Open these legs in the Delivery
Scheduler" and is `encodeWidgetPermalink("delivery", permalinkOf(state))`. The two tools share
the flat leg keys, so the link is the same permalink under the other kind.

**Presets:**

| Id | Legs | Returns |
| --- | --- | --- |
| `scheduled-sailing` | truck `PT6H` from `2024-06-10T08:00:00+08:00[Asia/Shanghai]` with `PT6H` handling; ship `P14DT6H` to `America/Los_Angeles`, scheduled to leave at `2024-06-12T14:00:00+08:00[Asia/Shanghai]`, with `PT36H` handling; rail `PT52H` to `America/Chicago` | `eta: "2024-06-29T23:00:00-05:00[America/Chicago]"`, `totalTransit: "PT400H"`, `totalDwell: "PT84H"` |
| `no-schedule` | the same legs with no scheduled departure | `eta: "2024-06-28T05:00:00-05:00[America/Chicago]"`, `totalDwell: "PT42H"`: the two handling times |
| `missed-connection` | the JSDoc's two legs with the second leaving inside the handling | `null` |
| `across-a-clock-change` | one leg across a spring-forward and a hand-off | the transit counts the hours that passed |

The cargo is ready 42 hours before the scheduled departure of `scheduled-sailing`, so its first
wait is 48 hours: 6 of handling and 42 for the departure. Paste every result from a run.

**Template.** Three sections: 1 the legs; 2 moving and waiting (plates, ribbons, the table, the
link, the reason aside); 3 what `multimodalETA` returns. Section 2 is wide.

**Chat copy.** `showJourneySplit({ legs, startTimeZone? })`, with the Delivery Scheduler's leg
schema. Call when the reader asks how much of a multi-leg journey is moving and how much is
waiting, or what the total transit and dwell of a multimodal move are.

**Tests.** `journey-split.test.ts` and `journey-split-mount.test.tsx`, as for B1, plus the
round trip: the link to the Delivery Scheduler keeps every key through `seedFromLocation`.

### B3. Demurrage Clock: `/tools/demurrage-clock/`, kind `demclock`

Which two events bound each clock. Demurrage and detention share one event and nothing else.

**Inputs** (`DemurrageState`): up to six event rows, each a type `<select>` (blank, then the
library's seven types) and an instant field (at most 64 characters); `scope`; `direction`;
`startEvent` (a `<select>` of "not given", `discharged`, `available`; "not given" leaves it out of
the call); and `zone`, the terminal clock.

**The terminal clock is a display zone.** It sets the day columns and the local times on the
chips and plates. It is not an argument of `demurrageClock`, and the tool says so beside the
control. With no zone the display is UTC and is labelled UTC.

**Reading** (`readClocks`):

1. `demurrageClock(events, scope, options)` once for each of the four scopes, with the reader's
   events and options. The chosen scope's call is the one printed first.
2. For the chosen scope, when it returned an interval: `toOffsetInstant(start)`,
   `toOffsetInstant(end)`, then `diffUtcAsDuration(a.instant, b.instant, "hours")`.
   `demurrageClock` returns the caller's own strings, and `diffUtcAsDuration` reads `Z` instants
   only, so each end goes through `toOffsetInstant` first. All three calls are printed.
3. **Which pair bounds a scope** comes from the library. `clockPair(scope, options, lib)` calls
   `demurrageClock` with one probe event of each of the seven types at seven known, rising
   instants, and reads the two types back from the strings returned. No module holds a table of
   scope to events.

**Chart: one event rail, four clock lanes** (`.gmt-ledger-frame`, section 2), over day columns in
the terminal clock's zone.

- **The event rail:** one diamond mark for each event row, with a chip naming it in words
  ("discharged", "gated out", "empty returned") and its local time. Chips are placed with
  `placeLabels` so none overlaps.
- **Four lanes**, always rendered, in the order demurrage, detention, storage, combined, with
  `data-series` 1 to 4. Each lane draws its own call's interval as a half-open bar
  (`.gmt-ledger-bar`). The chosen scope's lane is lit and the other three are dimmed marks; every
  lane's label stays at full contrast.
- **A lane the library returned `null` for** keeps its row and says why in words on a chip
  (`laneNullText`), from the probed pair and the reader's rows: the start event or the end event
  is not recorded, an event is recorded twice, the end is before the start, or a row is not a
  valid event. Only the chosen scope's output shows `NO SIGNAL`.
- Direction and start event move the bars, because each lane is a fresh call.

**Hero plates**, three, pinned, `aria-hidden`, for the chosen scope:

| Plate | Caption | Value | Sub line |
| --- | --- | --- | --- |
| `hero-start`, the scope's series | "Clock starts" | the start event in words | its local time (`localText`) |
| `hero-end` | "Clock ends" | the end event in words | its local time |
| `hero-ran` | "Ran for" | `hourDurationText` of the elapsed time | the duration as returned |

The event words come from the probed pair, so the two captions hold when the result is `null`;
the times and the elapsed plate then read "no result".

**Hand-off.** A link reads "Count the days in the Free Time Ledger" and is
`encodeWidgetPermalink("freetime", { clockStart, clockEnd, zone })`, with the chosen scope's
`start` and `end` as returned and the terminal clock. `zone` is left out when there is none.
The link is `aria-disabled` with no `href` when the chosen scope is `null`, and a hint says why.

**Presets**, each from the function's JSDoc, each with its terminal clock as a literal field:

| Id | Direction, scope | Returns |
| --- | --- | --- |
| `import-demurrage` | import, `demurrage` | discharged to gated out |
| `import-detention` | import, `detention` | gated out to empty returned |
| `export-storage` | export, `storage` | gated in to loaded |
| `merged-clock` | import, `combined` | discharged to empty returned |
| `recorded-twice` | import, `demurrage`, two `discharged` rows | `null` |
| `gate-out-before-discharge` | import, `demurrage` | `null` |

**Template.** Three sections: 1 the events and the options; 2 which events bound each clock
(plates, the rail, the lanes, the link, the reason aside); 3 what `demurrageClock` returns.
Section 2 is wide.

**Permalink keys:** `eventCount`, `type1`…`type6`, `at1`…`at6`, `scope`, `direction`,
`startEvent`, `zone`.

**Chat copy.** `showDemurrageClock({ events, scope, direction, startEvent?, zone? })`: `events`
is one to six `{ type, at }`, each `at` with its offset or `Z`. `direction` is required and never
guessed from the events. `zone` is passed only when the reader named a terminal's zone. Call when
the reader asks which events a demurrage, detention, storage or combined clock runs between, or
how detention differs from demurrage.

**Tests.** `demurrage-clock.test.ts` (every preset; the probe finds the same pair the JSDoc
states for each scope and direction; every event word is a type the library accepts; the reason
sentences) and `demurrage-clock-mount.test.tsx`, as for B1, plus the Free Time Ledger link's
round trip.

### B4. EPCIS Event Reader: `/tools/epcis-event-reader/`, kind `epcis`

A third member of the EDI family, on `edi-widgets.ts`, `edi-picture.ts`, `edi-render.ts` and
`gmt-edi-widgets.css`: pictures on the left, values on the right, one seam, every region present
in every state, every varying region in a hold.

**Inputs** (`EpcisState`): `eventTime` (at most 64 characters) and `eventTimeZoneOffset` (at most
16), both text fields. A blank offset leaves the member out of the event object.

**Reading** (`readEpcis`):

1. `parseEpcisEvent(event)` gives `{ instant, offset, local }`.
2. With a result: `convertUtcToPlainDate(instant)` and `chopTime(local)` are the two dates, and
   `areDatesEqual` and `isAfterDate` give the words under the rails: "the local date is the next
   day", "the local date is the day before" or "the same date on both clocks".
3. With a result: `formatEpcisEvent(result)` writes it back.

A blank form makes no call and shows the empty state. Anything typed is partial input and gets
the library's sentinel with its sentence.

**Why `NO SIGNAL`** (`epcisNullText`), one sentence from the library's validators: the offset is
missing (both fields are required and UTC is not assumed); `isValidEpcisTimeZoneOffset` refuses
the offset (it must be `±HH:MM` from `-14:00` to `+14:00`; `Z`, `+0200` and `+02` are not
offsets in this field); `isValidEpcisEventTime` refuses the time (seconds are required, then `Z`
or `±HH:MM`); or both fields have the right shape and the date does not exist or the fraction is
finer than a nanosecond.

**Template.** Four numbered sections, each `gmt-widget-section--wide`:

1. **The event's two fields:** the preset, its description, `eventTime` and
   `eventTimeZoneOffset`.
2. **What the event states.** Left: both fields taken apart into boxed fields with brackets, the
   date in series 1, the time in series 2 and the offset in series 3 (`takenApartHtml`, `lit`). A
   refused field is one neutral box. The tool cuts the typed text to draw it and says so; the
   library reads each field whole. Right: the verdict plate ("Offset: stated (+02:00)" or "Offset:
   not stated"), a detail line (an `eventTime` that carries an offset of its own fixes the instant
   only), the member grid (Instant, Offset, Local), the call and the output.
3. **The same moment on two clocks.** Left: two day rails, UTC and the event's local clock, with
   one pin at the instant on both and day ticks on each rail's own midnights. Positions are
   drawing, from the polyfill. With no result each rail keeps its box and says why in words ("not
   stated" on the local rail when the offset is missing). Right: the two dates, the words, and
   the calls that gave them.
4. **Written back by `formatEpcisEvent`:** the call, the result, a note when `-00:00` came back
   as `+00:00`, and the hand-off link.

The member cells, the verdict, the detail line, the rails, the asides, the outputs and the call
frames are held (`holdHtml`, with the text list built by running the pure text functions over a
result of each shape). The two-pane band and the right column's minimum are derived as the other
two tools derive theirs, and the arithmetic is written in the sheet beside the rule: the widest
member is a 33-character instant with a nine-digit fraction and a six-digit year
(`+010000-01-01T04:30:00.123456789Z`, which `parseEpcisEvent` returns for
`9999-12-31T23:30:00.123456789-05:00` at `+14:00`).

**Hand-off.** A link reads "Read this moment as a shipped on board date in the B/L Date Stamp"
and is `encodeWidgetPermalink("bldate", { value: instant, event: "shippedOnBoard", timeZone:
offset })`. The link states the event it picks, and the reader can change it there. With no
result the link is `aria-disabled` with no `href`.

**Presets**, each from the two functions' JSDoc:

| Id | `eventTime`, `eventTimeZoneOffset` | Returns |
| --- | --- | --- |
| `next-day` | `2024-06-15T23:30:00Z`, `+02:00` | local `2024-06-16T01:30:00` |
| `offsets-disagree` | `2024-06-15T10:00:00+02:00`, `-05:00` | instant `2024-06-15T08:00:00Z`, local `2024-06-15T03:00:00` |
| `minus-zero` | `2024-06-15T14:30:00Z`, `-00:00` | offset `+00:00` |
| `no-offset` | `2024-06-15T14:30:00Z`, blank | `NO SIGNAL` |
| `z-as-offset` | `2024-06-15T14:30:00Z`, `Z` | `NO SIGNAL` |
| `no-colon` | `2024-06-15T14:30:00Z`, `+0200` | `NO SIGNAL` |
| `no-seconds` | `2024-06-15T14:30Z`, `+02:00` | `NO SIGNAL` |
| `february-30` | `2024-02-30T14:30:00Z`, `+02:00` | `NO SIGNAL` |

**Permalink keys:** `eventTime`, `eventTimeZoneOffset`.

**Chat copy.** `showEpcisEventReader({ eventTime, eventTimeZoneOffset? })`. Both values are
passed exactly as the reader gave them; a missing offset is left out and never filled. Call when
the reader asks what a GS1 EPCIS `eventTime` and `eventTimeZoneOffset` mean, what local time an
EPCIS event happened at, or why an event needs both fields.

**Tests.** `epcis-event-reader.test.ts` and `epcis-event-reader-mount.test.tsx`, as for the DTM
Decoder: every preset against the library, the calls made, the sentences, the cut picture, the
rails, the write-back, the link's round trip into the B/L Date Stamp, the holds, the on-screen
words (no `GMT` for the library, no raw `null`).

### B5. Free Time Ledger: the family look

The day strip keeps its job and every `data-role`, `data-date`, `data-hours`, `data-state`,
`role` and `aria-label` its tests read. It changes how each state is drawn.

- **Section 2 holds a `.gmt-ledger-frame`:** the plates, then the track, the axis and the legend.
- **Day columns** are the shared glass columns. A free day is `lit` in series 1. A charged day is
  `hatched` and carries a "charged" chip. A closed day is `closed`, with its chip. The event day
  the tariff did not count is `plain` with an "event day" chip. A day the clock never touched is
  `plain`.
- **Tiers** differ by hatch density and a numbered chip ("tier 2"). A column carries
  `data-tier`. No tier is told by a coloured edge.
- **The cell word is "charged"** in the chip, the legend and the `aria-label`. The count on the
  plate is "chargeable days", the library's member name.
- **The expiry** is the family gate (`.gmt-cutoff-gate`) with a chip reading "expires" and the
  local time. `placeLabel` still flips the chip near the right edge.
- **The clock bar** takes series 1 through `data-series`. An inverted bar is a dashed neutral
  outline (`--gmt-border-strong`), never amber.
- **Three hero plates**, pinned, `aria-hidden`:

  | Plate | Caption | Value | Sub line |
  | --- | --- | --- | --- |
  | `hero-free`, series 1 | "Free days used" | `freeDaysUsed` | "of N free", the reader's own number |
  | `hero-charged` | "Chargeable days" | `chargeableDays` | the count in each tier from `byTier`, or blank |
  | `hero-expires` | "Free time expires" | `expiresAt` on the terminal's clock (`formatLocal`) | the zone id |

  A plate with no result reads "no result". `hero-expires` falls back to `freeTimeExpiry`'s
  `expiresAt` when `chargeableDays` returned `null`, as the marker does.
- **The summary** keeps its text and its `aria-live`, and is visually hidden (`.gmt-ledger-sr`):
  the plates show the same numbers.
- **Gone:** every `--gmt-signal` and `--gmt-spring` rule on a cell, a bar, a line or a label; the
  `$` in a charged cell; the `transition` on `.gmt-freetime-cell` and its reduced-motion block;
  the tier-end edge.
- **Stillness.** The preset description keeps its height when a drag makes the state custom
  (`setPresetDescription`). The handles answer PageUp and PageDown with a step of twelve snap
  units, beside the arrow keys, Home and End. The canvas still refits when a change settles.

### B6. Dwell Ledger: the same strip

- The timeline sits in a `.gmt-ledger-frame` with two plates above it: `hero-elapsed` ("Elapsed":
  `hourDurationText(duration)`, with `duration` as returned under it) and `hero-days` ("Local
  days": `calendarDays`, with "in <zone>" under it and, with a second zone, "<n> in <zone>" on a
  second line that is always reserved).
- A touched day is `lit` in series 1 in the first row and series 2 in the comparison row. The
  elapsed bar takes its row's series. An inverted bar is the dashed neutral outline.
- The odd-day chip, the summary, the preset description and the PageUp and PageDown keys follow
  B5.
- **Gone:** the `--gmt-signal` rules, the green bar as a colour of its own, and the `transition`
  on `.gmt-dwell-cell`.

### B7. Billing Deadlines: three plates

- **Three hero plates** at the top of section 2, pinned, `aria-hidden`, one for each deadline
  `billingTimeline` returns, numbered as the lanes are and carrying `data-series` 1 to 3 (the
  lanes' own colours): "1 Issue by", "2 Dispute by", "3 Resolve by". The value is the deadline
  date (`dateText`); the sub line is the window in days as the reader typed it. A deadline the
  result does not hold reads "not set", and a `null` result reads "no result".
- The `deadlines` line keeps its text and is visually hidden. The verdicts stay visible lines.
- `.gmt-billing` joins the series lists of `gmt-cutoff-widgets.css`, or sets `--series` on each
  plate from its lane's token in its own sheet. Use whichever leaves the strip's markup alone.

### B8. Delivery Scheduler: a link and one word

- **The label "Dwell after" is "Handling after".** The words that name that field follow it: the
  `invalid-dwell` sentence of `scheduleNullText` ("Leg n's handling time is not a duration of
  time units, or it is negative."), the "Invalid dwell" reason title, and the preset description
  that says "two hours of dwell". The printed call keeps `dwellAfter`.
- **A hand-off link** at the end of section 3, in a `.gmt-widget-controls` row: "Split this
  journey into moving and waiting", `encodeWidgetPermalink("journeysplit", permalinkOf(state))`.
  It always has an `href`.

### B9. Lists inside a widget

The prose list marker never reaches a widget. The three rules in `gmt-content.css`
(`.sl-markdown-content ul`, `… ul li` and `… ul li::before`) exclude any list inside
`.gmt-widget`, with `:not(:where(.gmt-widget *))` on the `ul`, the way the link rule below them
excludes `.not-content`. This fixes the Billing Deadlines verdicts and legend and the Free Time
Ledger legend, and every list a tool adds later.

- The tools that already reset the marker (the Delivery Scheduler, the ETA Drift Chart, the
  Timetable Reader, the zone combobox) keep their own list styling. A comment there that says the
  prose rule reaches the widget is reworded to say what the rule does now.
- A test in `src/lib` reads `gmt-content.css` and asserts the three selectors carry the
  exclusion.
- The browser pass (G9) checks every `li` inside a `.gmt-widget` on every tool page: the
  computed `content` of its `::before` is `none` unless that tool's own sheet sets it.

---

## C. Registration checklist (each new tool at every step)

Each item names the test that guards it, or says that nothing does.

| # | File (under `apps/dox/`) | Where | What is registered | Guard |
| --- | --- | --- | --- | --- |
| C1 | `src/lib/dox-tools.ts` | after `showX12TimeReaderInput` (362) | `showDemurrageClockInput`, `showBlDateStampInput`, `showEpcisEventReaderInput`, `showJourneySplitInput` (the Delivery Scheduler's leg schema) | `widget-registry.test.ts` |
| C2 | same | `DoxToolName` (396) | the four names | typecheck |
| C3 | same | `DOX_TOOL_INPUTS` (418) | the four | typecheck |
| C4 | same | `DOX_TOOL_DOCS` (442) | the four, **appended** after `showX12TimeReader`: indices 20 to 23 | see the trap below |
| C5 | same | `DOX_TOOLS` (595) | the four, in the docs' order, each with its own `DOX_TOOL_DOCS[n].purpose` | `chat-handler.test.ts` |
| C6 | same | `ENABLED_TOOL_NAMES` (698) | the four | `widget-registry.test.ts`, `chat-starters.test.ts` |
| C7 | `worker/tools.ts` | imports (56); tools (351 onward) | the four tools with a trivial `execute` | `tools.test.ts` |
| C8 | `src/components/ask/widget-registry.ts` | type imports (65); schema imports (67); entries after `x12TimeEntry` (582); `WIDGET_REGISTRY` (651) | `import type` only, never a value import; each entry has a literal `import("~/lib/…-mount")` | `widget-registry.test.ts`, `widget-graph.test.ts` |
| C9 | `src/lib/widget-permalink.ts` | `WidgetKind` (35); `WIDGET_PAGE_PATHS` (71) | `"bldate"`, `"journeysplit"`, `"demclock"`, `"epcis"` and their paths | `widget-permalink.test.ts` |
| C10 | `src/lib/chat-constants.ts` | `CHAT_STARTERS` (396) | four cards, area `intermodal`: the Demurrage Clock's after the Free Time Ledger's, the B/L Date Stamp's and the Journey Split's after Billing Deadlines', the EPCIS Event Reader's after the X12 Time Reader's | `chat-starters.test.ts` (21 to 109 characters, a digit or a known place, no tool name; the seed passes its schema and `validate`) |
| C11 | `src/lib/widget-load-error.test.tsx` | imports; `MOUNTS` | one row for each new mount | **manual: nothing fails if forgotten** |
| C12 | `src/components/ask/widget-graph.test.ts` | `heavy` (127) | `lib/ledger-widgets.ts`, `lib/ledger-lib.ts`, `lib/bl-date-stamp.ts`, `lib/journey-split.ts`, `lib/demurrage-clock.ts`, `lib/epcis-event-reader.ts` | **manual** |
| C13 | `astro.config.mjs` | `customCss` (236) | `gmt-ledger-widgets.css` and the two ledger sheets are registered after `gmt-departure-board.css` (264 to 266); `gmt-bl-date-stamp.css`, `gmt-journey-split.css` and `gmt-demurrage-clock.css` follow them | **manual**; an unregistered sheet shows as an unstyled widget in the browser pass |
| C14 | `src/lib/mdx-jsx.ts` | the dropped-components list (near 365) | `"BlDateStamp"`, `"JourneySplit"`, `"DemurrageClock"`, `"EpcisEventReader"` | `scripts/llms.test.ts`, **only after a build** |
| C15 | `scripts/html-diff.mjs` | `PAGES` (32) | the four pages, each with its root class string | **manual** |
| C16 | `scripts/visual-snapshot.mjs` | `PAGES` (87) | `tool-bl-date-stamp`, `tool-journey-split`, `tool-demurrage-clock`, `tool-epcis-event-reader` | **manual** |
| C17 | `scripts/grow-measure.mjs` | `PAGES` (80) | the four: `root: ".gmt-widget"`, `preset: '[data-role="preset"]'`; `drag: '[data-role="moment-slider"]'` for the B/L Date Stamp and `null` for the rest. The header comment names no page count | **manual** |
| C18 | `scripts/readout-still.mjs` | `TOOLS` (145) | the B/L Date Stamp, after the Free Time Ledger and the Dwell Ledger, which are in place (below) | **manual** |
| C19 | `src/styles/gmt-a11y.css` | the ledger family's `@media (forced-colors: active)` block (1057) | the day columns, gates, bars, hatches, rail marks and pins keep a system colour; frames, plates and chips take `border-color: CanvasText` | **manual**; checked in the browser pass |
| C20 | `src/lib/industry-tags.ts` | the intermodal `definition` | names demurrage and detention clocks, bill of lading dates, multimodal journeys and EPCIS events beside what it names now | `industry-tags.test.ts` |
| C21 | `src/lib/chat-constants.ts` | `EXAMPLE_AREAS` (360) | the intermodal label still fits its eight cards; change it only if it no longer does | `chat-starters.test.ts` |

**Trap: `DOX_TOOLS` reads `DOX_TOOL_DOCS` by position.** Each `DOX_TOOLS` entry's description is
`DOX_TOOL_DOCS[n].purpose` with a literal `n`. **Append**, never insert, and after editing
confirm `DOX_TOOL_DOCS[n].name` equals the key for every entry. No test guards this today, so
this work adds one to `chat-starters.test.ts` (it already imports `DOX_TOOL_DOCS`): for every key
of `DOX_TOOLS`, its `description` equals the `purpose` of the `DOX_TOOL_DOCS` entry whose `name`
is that key.

**The `readout:still` entries.** A `TOOLS` entry may name, per control, the field whose value
the handle edits (`value`), and may cap the keyboard sweep (`maxKeys`), because a ledger handle
has no far end: the canvas widens when a handle reaches its edge. `valueOf` reads the named
field; the Departure Board's own case stays.

| Slug | Root | Controls | Track | Frame | Drawn |
| --- | --- | --- | --- | --- | --- |
| `bl-date-stamp` | `.gmt-bl-date-stamp` | `moment-slider` (a native range) | none | `.gmt-ledger-frame` | the lanes |
| `free-time-ledger` | `.gmt-freetime` | `handle-start` (value `clock-start`), `handle-end` (value `clock-end`) | `[data-role="track"]` | `.gmt-ledger-frame` | the track's insides and a hold's live wrapper |
| `dwell-ledger` | `.gmt-dwell` | `handle-entry` (value `entry`), `handle-exit` (value `exit`) | `[data-role="track-dwell"]` | `.gmt-ledger-frame` | both tracks' insides and a hold's live wrapper |

Each entry lists every preset of its tool that returns a value. The script's header and the
tool list in its comment name the seven tools.

---

## D. Content pages

All paths are under `apps/dox/src/content/docs/`. Every result shown is pasted from a run against
the built library. Every permalink is built with `encodeWidgetPermalink`, never
`encodeURIComponent` and never by hand: an instant holds `+`, `:` and `[`.

- **Four tool pages**, `tools/bl-date-stamp.mdx`, `tools/journey-split.mdx`,
  `tools/demurrage-clock.mdx` and `tools/epcis-event-reader.mdx`, in the shape of
  `tools/dtm-decoder.mdx`: frontmatter with `industries: [intermodal]`, a `ToolLayout` with a
  use case, a key point, an intro, the widget `fullbleed`, and an `after` slot that states the
  rule, the functions the tool calls with links to their reference pages, and a "Worth trying"
  paragraph of permalinks. The Demurrage Clock's page says the terminal clock is a display zone
  and not an argument. The Journey Split's page says what "handling" and "waiting" are in the
  library's words. `tools/index.mdx` is generated.
- **Existing tool pages:** `tools/free-time-ledger.mdx`, `tools/dwell-ledger.mdx`,
  `tools/billing-deadlines.mdx` and `tools/delivery-scheduler.mdx` are re-read against the
  widgets. A sentence that describes a colour, a `$`, a label or a legend word this spec changes
  is corrected. The Delivery Scheduler's page links the Journey Split, and the Free Time Ledger's
  page links the Demurrage Clock.
- **Links from the guides and scenarios**, one where it fits, in the page's own list of related
  links or beside the passage it illustrates:
  - `guides/industries/intermodal-bill-of-lading-and-eta.mdx`: the B/L Date Stamp and the
    Journey Split;
  - `guides/industries/intermodal-free-time-and-demurrage.mdx`: the Demurrage Clock;
  - `guides/industries/intermodal-edi-timestamps.mdx`: the EPCIS Event Reader;
  - `scenarios/bill-of-lading-dated-a-day-late.mdx`: the B/L Date Stamp, seeded with the
    scenario's own moment;
  - `scenarios/eta-that-forgot-the-sailing.mdx`: the Journey Split, seeded with its legs;
  - `scenarios/detention-is-not-demurrage.mdx`: the Demurrage Clock, seeded with its events;
  - `scenarios/the-epcis-offset-nobody-kept.mdx`: the EPCIS Event Reader, seeded with its event.
- `industry-tags.test.ts` requires a page's declared tags to be a subset of the layers it links
  under `/reference/<layer>/` or imports from. A page tagged `intermodal` may link
  `/reference/transport/` (the Journey Split links `scheduleDelivery`), as long as it also links
  an intermodal reference page, which every new tool page does.

---

## E. Design constraints

1. **No left-border-only accent, anywhere.** No `border-left`, `border-inline-start`, left
   `inset` shadow or left `::before` bar as the only accent of a plate, a row, a callout, a lane
   or a result block. A day column's hairline between days is a divider on every column, not an
   accent.
2. **Every region is present in every state, and holds still.** Every readout value is
   `tabular-nums` and `nowrap`. Each plate reserves the width of the longest value its tool can
   show, measured across every preset and the whole range of every handle: the value in `em`, the
   sub line in `ch`. A region whose text varies reserves its tallest text with a hold. A new
   value, a new preset or a new zone never moves or resizes a region above the control that
   changed it.
3. **Amber is the sentinel's alone.** `NO SIGNAL` and the caution aside's own styling. Charged,
   closed, missed, late and inverted are words and patterns.
4. **Text is at least 12px** (`font-floor.test.ts`), and measures **at least 7:1** in both themes
   against the worst pixel behind its glyph box (`pnpm run contrast:measure`).
5. **Tokens only.** No colour literal, and no `[data-theme="light"]` colour block. A series
   colour goes on a mark, an edge or a swatch, never on text.
6. **Compose `gmt-form-controls.css` through `widget-ui.ts`:** `.gmt-field-grid`,
   `labelTextHtml()` (with `{ optional: true }` for the chip), `.gmt-input`, `.gmt-select`,
   `rangeFieldHtml`, `syncRange`, `setControlValue`. Add no control CSS. Real `<select>`,
   `<input>` and `<input type="range">` elements.
7. **Every root carries `not-content`** and `container-type: inline-size`. Narrow rules are named
   `@container` queries, because the `/dox` rail is narrow on a wide viewport. Space comes from
   `gap`. No horizontal page scroll at 390px, and none in the rail at 360px or 300px.
8. **No motion on a value.** No `transition` or `animation` on a readout, a verdict, a mark, a
   day column or a plate. Section heights ease through `.gmt-grow`.
9. **No class containing `card`** other than `.gmt-widget-card`. **No `backdrop-filter` and no
   `clip-path` inside a tool.**
10. **Nothing in a chart is focusable** but a real control. Each chart is `role="img"` with a
    generated `aria-label`, or a list of labelled items, and a hidden sentence says what it
    shows. The ledger handles keep their `role="slider"` and their typed fields.
11. **`escapeAttr` or `escapeHtml` on every template interpolation.** The input is text a model
    or a stranger's URL wrote.
12. **An element with an author `display` gets its own `[hidden]` rule.** A call frame with no
    call keeps its box (`visibility: hidden`).
13. **A table inside a widget** takes `overflow-x: auto`, never `overflow: hidden`, and first and
    last cells have at least 10px of inline padding (the bevel trap).
14. **On-screen text calls the library "the library"** in the EPCIS tool, as its family does.
    No readout shows a raw `null`.

---

## F. `context/dox/built.md`

`built.md` holds the as-built record, in the present tense: § Tier 2 has the four tools in the
teaching-widget list with their rules, the ledger sheet's roots and recipes, the Free Time
Ledger's and the Dwell Ledger's look, the DST pair on the day chips, the list-marker rule in
place of its trap, the tool-page list, the permalink keys, the registration lists with
`readout:still`'s seven tools, and the guarded `DOX_TOOL_DOCS` order; § Tier 6 has the four chat
tools, and the tool and starter counts re-derived from `ENABLED_TOOL_NAMES` and `CHAT_STARTERS`.
`reference/design-system.md` names no tool-page count, and its measured contrast figures are the
ones the gate reports. `specs/int-15-edi-timestamp-tools.md` describes three EDI tools.
`dox-architect` writes these three after the tester's run.

---

## G. Definition of done (`dox-tester`: run each line literally)

**G0. The two private trees.** Nothing in G6 to G11 uses port 4321, `apps/dox/dist` or this
worktree's `packages/gmt/dist`. `$SP` is the session scratchpad, and `$W` is this worktree.

```bash
# The baseline: the commit the branch is based on, with no git state change.
BASE=$(git -C "$W" merge-base HEAD origin/main)
mkdir -p "$SP/base" && git -C "$W" archive "$BASE" | tar -x -C "$SP/base"
# The branch as it stands, uncommitted changes included.
mkdir -p "$SP/after" && rsync -a --exclude node_modules --exclude dist --exclude .git \
  --exclude .astro --exclude .visual --exclude .wrangler "$W"/ "$SP/after"/
# In each tree:
cd "$SP/<tree>" && eval "$(fnm env)" && fnm use && pnpm install --frozen-lockfile \
  && pnpm --filter @northguild/gmt build \
  && DOX_VITE_CACHE_DIR="$SP/vite-<tree>" pnpm --filter @gmt/dox build
# Serve the branch build for the browser gates, and stop the server afterwards:
python3 -m http.server 48391 --bind 127.0.0.1 --directory "$SP/after/apps/dox/dist"
```

A library build inside `$SP` writes that tree's own `dist` and touches nothing in `$W`. Re-run
the `rsync` and the site build of `$SP/after` after any builder change.

1. In `$W`: `pnpm --filter @gmt/dox test` is green, with no skipped, todo or expected-failure
   test in the files this work adds or changes.
2. In `$W`: `DOX_VITE_CACHE_DIR=<private folder> pnpm --filter @gmt/dox check` reports 0 errors,
   and `pnpm --filter @gmt/dox lint` reports nothing.
3. In `$W`: `pnpm dox:generate` and `pnpm dox:docs-check` report 0 gaps.
4. The parity tests pass by name: `widget-registry`, `chat-starters`, `chat-handler`,
   `widget-permalink`, `widget-load-error`, `widget-graph`, `client-graph`, `industry-tags`,
   `font-floor`, and, in `$SP/after` after its build, `scripts/llms.test.ts`.
5. `git -C "$W" status --short` shows no path under `packages/gmt`, `.changeset` or
   `context/domination` beyond the owner's own `context/domination/tracker.md`, and nothing
   staged. `grep` over the changed and new files under `apps/dox/src` and `apps/dox/worker` finds
   no `--gmt-signal` outside the sentinel's own rules, no `border-left` or `border-inline-start`
   used as an accent, no colour literal, no `backdrop-filter`, no `clip-path`, no `$` printed in
   a day cell, and no name of a carrier, an agency, a statute or a court.
6. `html-diff`: `capture` in `$SP/base/apps/dox`, `compare` in `$SP/after/apps/dox`. The four new
   pages report `+`. The Free Time Ledger, the Dwell Ledger, Billing Deadlines and the Delivery
   Scheduler report `✗`, and each difference is one this spec asks for. Every other page reports
   no widget change.
7. `visual:diff`: `visual:before` in `$SP/base/apps/dox`; copy its `.visual/before` into
   `$SP/after/apps/dox/.visual/`; `visual:after` and `visual:diff` there. The eight pages of this
   work differ, and each difference is read and matches the spec. A tool page outside the eight
   that differs is a regression, except where the list-marker rule removed a stray dash.
8. `grow:measure --base http://127.0.0.1:48391 --out <dir>` passes for the eight pages in
   Chromium and WebKit at 1440 and 390, and `readout:still --base http://127.0.0.1:48391` passes
   for all seven tools at its default widths (1440, 390, and the root at 360 and 300), in
   Chromium and WebKit.
9. **Browser pass** on the eight pages, in both themes, at 1440 and 390, and in the `/dox` rail
   with the widget root at 360 and 300 (each new tool opened from its `CHAT_STARTERS` card):
   - no overlap of any two labels, chips or plates, and no horizontal page scroll;
   - `pnpm run contrast:measure -- --base http://127.0.0.1:48391` passes (7:1 for muted text,
     3:1 for a disabled border) on the eight pages and the `/dox` page;
   - no element with a left edge as its only accent (computed style, plus the screenshots);
   - forced colours: every mark, gate, bar, hatch, rail and pin keeps an edge;
   - the keyboard path reaches every control in order, each ledger handle moves under the arrow
     keys, PageUp, PageDown, Home and End, and nothing inside a chart takes focus;
   - no `li` inside a `.gmt-widget` on any tool page draws the prose dash (B9);
   - **stillness with no handle:** for the Journey Split, the Demurrage Clock, the EPCIS Event
     Reader and Billing Deadlines, record the bounding box of every plate, the frame and every
     held region for every preset. At a given width each plate keeps its size and each held region
     its height from one preset to the next. A result region may grow through `.gmt-grow`, which
     `grow:measure` gates: the reason aside under a sentinel, a second lane for a second zone, or
     a chart that moves down because section 1 shows more fields. Every preset description is held to the tallest description at that width. The
     Journey Split's leg form has one fieldset for each leg, so a preset with fewer legs makes
     section 1 shorter: its boxes are measured relative to the top of section 2.
10. **Values.** A script in `$SP` runs every preset of the four new tools against
    `$SP/after`'s built library and prints each call and result. For every preset, the output a
    built page shows equals the script's value, and every `call // result` on the four tool pages
    equals it too.
11. **Hand-off links.** Each of these opens the target tool with every key kept, checked through
    `seedFromLocation` in a test and by following the link in the browser: Demurrage Clock to
    Free Time Ledger (`clockStart`, `clockEnd`, `zone`); EPCIS Event Reader to B/L Date Stamp
    (`value`, `event`, `timeZone`); Journey Split to Delivery Scheduler and back (every leg key,
    `legCount`, `startTimeZone`); Departure Board to Delivery Scheduler still works.
12. Firefox does not launch on this machine. Record it as blocked. Do not bypass the sandbox.

`pnpm run validate` is not run here: it rebuilds the library under the dev server. The main
session runs it at the end.

---

## H. Files

**New**, under `apps/dox/`: `src/lib/ledger-widgets.ts`, `ledger-lib.ts`, `bl-date-stamp.ts`,
`bl-date-stamp-mount.ts`, `journey-split.ts`, `journey-split-mount.ts`, `demurrage-clock.ts`,
`demurrage-clock-mount.ts`, `epcis-event-reader.ts`, `epcis-event-reader-mount.ts` and their
tests; `src/test/ledger-lib.ts`; `src/styles/gmt-ledger-widgets.css`, `gmt-bl-date-stamp.css`,
`gmt-journey-split.css`, `gmt-demurrage-clock.css`; `src/components/BlDateStamp.astro`,
`JourneySplit.astro`, `DemurrageClock.astro`, `EpcisEventReader.astro`; the four tool pages.

**Changed:** the registration files of section C; `src/lib/edi-widgets.ts`, `edi-lib.ts`,
`edi-picture.ts`, `edi-render.ts`, `src/test/edi-lib.ts`, `src/styles/gmt-edi-widgets.css`;
`src/lib/transport-lib.ts`, `transport-widgets.ts`; `src/lib/free-time-ledger-mount.ts`,
`free-time-ledger.ts`, `dwell-ledger-mount.ts`, `dwell-ledger.ts`, `billing-deadlines-mount.ts`,
`delivery-scheduler-mount.ts`, `delivery-scheduler.ts` and their tests;
`src/styles/gmt-free-time-ledger.css`, `gmt-dwell-ledger.css`, `gmt-billing-deadlines.css`,
`gmt-delivery-scheduler.css`, `gmt-cutoff-widgets.css`, `gmt-punctuality-widgets.css`,
`gmt-content.css`, `gmt-a11y.css`; the content pages of section D.

---

## I. Build order

Each step ends with `pnpm --filter @gmt/dox exec vitest run` green for the files it touched, and
the whole suite green before the next step starts.

1. The ledger sheet and `ledger-widgets.ts`; the Free Time Ledger and the Dwell Ledger (B5, B6);
   the list-marker rule (B9); their `readout:still` entries.
2. The Demurrage Clock (B3), with its registration, page and starter.
3. The B/L Date Stamp (B1), the same.
4. The EPCIS Event Reader (B4), the same.
5. The Journey Split (B2), the same; the Delivery Scheduler's link and label (B8).
6. Billing Deadlines (B7).
7. The links from the guides, the scenarios and the existing tool pages (D).
8. The gates of section G.
