# Spec: Punctuality, timestamp classes and the next departure on the docs site (TRAN-57)

Execution spec for `dox-builder`, verified by `dox-tester`. This is not `packages/gmt` work.
`scheduleDeviation`, `classifyPunctuality`, `punctualityRate`, `bestAvailable`, `estimateDrift`
and `nextDeparture` are final. Nothing here edits library source, tests, the READMEs,
`packages/gmt/skills/`, `.changeset/` or `context/domination/`. A library problem found while
building is reported to the main session, never built around.

Sources, in order of precedence: Part B of the owner-approved plan (B1 guide, B2 scenarios and
mistakes, B3 tools, its build order and Verification), the JSDoc of
`packages/gmt/src/transport/compare/scheduleDeviation.ts`, `classifyPunctuality.ts`,
`packages/gmt/src/transport/calculate/punctualityRate.ts`, `bestAvailable.ts`,
`estimateDrift.ts`, `nextDeparture.ts` and `packages/gmt/src/types/transport-timestamps.ts`,
the `## Docs-site scope` section of `context/domination/issues/TRAN-57.md`, then
`context/dox/built.md`. The control primitives are specified in
`context/dox/specs/dox-control-system.md` and `context/dox/reference/design-system.md`
§ Form controls. The tool shape follows `context/dox/specs/tran-10-cutoffs.md`: read the
Cut-off Countdown and Dwell Ledger (`*.ts`, `*-mount.ts`, tests, `.astro` shell, tool page,
CSS) before writing anything.

Every value in this spec was computed against `packages/gmt/dist` built from the final source,
in `TZ=UTC`, `America/Los_Angeles` and `Asia/Tokyo`. Appendix Z is the script; all 81 rows pass.
**Do not type a result that is not in appendix Z.** If you need a new value, compute it against
`packages/gmt/dist` first and add a row to the script.

**Build order.** Land and test one piece at a time. Each step ends with
`pnpm --filter @gmt/dox exec vitest run` green before the next starts.

1. **T0**: the shared helpers, the library loader and the shared sheet, with tests.
2. **PB**: the Punctuality Board, with its chat registration (the main tool).
3. **ED**: the ETA Drift Chart, with its chat registration.
4. **DB**: the Departure Board, with its chat registration.
5. **A**: the guide, the two scenarios, the mistakes, the cross-links and the index updates.
   The content-permalink test needs each `WidgetKind` from steps 2–4.
6. Hand back to `dox-architect`, who writes `built.md`; then `dox-tester` runs section D.

---

## 0. Binding rules

Everything in section 0 of `tran-10-cutoffs.md` and `tran-9-multi-leg-scheduling.md` binds
here, with the deltas below.

- `apps/dox` must not perturb `packages/gmt`. No changeset. **No git operations of any kind**:
  no `add`, `commit`, `stash`, `worktree add`, `checkout`, `restore`. Leave every change
  unstaged.
- **Toolchain.** This machine has `fnm`. Prefix every Node command with
  `eval "$(fnm env)" && fnm use &&`. `packages/gmt/dist` is built from the final source; do
  not rebuild it unless a check asks you to.
- **Import gmt at module granularity only.** These widgets load `GMT_MODULES["transport/compare"]`
  (`scheduleDeviation`, `classifyPunctuality`) and `GMT_MODULES["transport/calculate"]`
  (`punctualityRate`, `bestAvailable`, `estimateDrift`, `nextDeparture`). Both are already in
  `gmt-modules.ts`. Nothing else from gmt.
- **The widgets draw the library's results and compute none of them.** Every deviation, class,
  rate, best-available pick, drift, revision count, `exceedsTolerance` and departure comes from
  a gmt call. The polyfill may be imported for drawing only: axis positions, tick instants,
  mark positions, the connection bar's end (`after` + `minimumConnection`), headway ticks, and
  turning a handle position into the string handed to the library. Formatting a returned ISO
  duration as "+15 min" is formatting, not computing. Each tool shows **one labelled naive value
  of its own**, never presented as a result:
  - Punctuality Board: the wall-clock reading. The planned and actual wall times are rewritten
    as UTC (`wallAsUtc`) and passed to the same three library calls, labelled
    "Read off the wall clocks (naive)".
  - ETA Drift Chart: the latest-recorded event of any class (ties go to the later index),
    labelled "naive: latest recorded".
  - Departure Board: `nextDeparture` called without `minimumConnection`, labelled
    "naive: no connection time".
- **Every result shown is real.** A sentinel (`""` or `null` from invalid input) renders
  `NO SIGNAL` through `renderWidgetOutput(out, "NO SIGNAL", "sentinel")`, with a reason aside.
  A correct empty result renders as empty (`renderWidgetOutput(out, '""', "empty")`) with a
  hint: the Departure Board's `""` when the input is valid and no departure qualifies is
  **empty**, not a sentinel. Which one applies is decided by the library probes in each
  `…NullReason`, never by guessing.
- **Early and late are words, never colours.** No success or error colour anywhere. Amber is
  only for `NO SIGNAL`. A bar or mark outside the tolerance carries a hatch or a word, never a
  colour alone.
- **Control primitives only.** Build every control from `gmt-form-controls.css` and
  `widget-ui.ts`: `.gmt-field-grid` with `labelTextHtml()` labels and the `optional` hint chip,
  `rangeFieldHtml()` / `syncRange()` (`.gmt-range`), `.gmt-handle` for every `role="slider"`
  handle, `chipToggleHtml()` (`.gmt-chip-toggle` in a `.gmt-chip-group` fieldset) for radio
  segments and switches, `.gmt-select`, `.gmt-button--pad`. **No new control CSS** in a tool
  sheet: a tool sheet positions controls and draws its plot, nothing more. If a primitive is
  missing, extend `gmt-form-controls.css` or `widget-ui.ts`, test it in `widget-ui.test.ts`,
  and say so in the handback so the architect records it in `design-system.md`.
- **Every handle has three ways in.** Pointer drag, keyboard (Arrow ±1 step, Shift+Arrow and
  PageUp/PageDown ±10 steps, Home → minimum, End → maximum) and a typed field. Follow the Dwell
  Ledger (`dwell-ledger-mount.ts` § Drag, § Keyboard): pointer capture on `pointerdown`,
  release on `pointerup`/`pointercancel`, `touch-action: none` from `.gmt-handle`. The axis never
  rescales while a handle is dragged or a key is held; it refits on `pointerup`, on a typed
  value's `change`, on a preset and on a seed.
- **Axis labels by measurement.** Tick labels and mark labels use `label-fit.ts`
  (`thinTickLabels`, `placeLabel`, `pickLabelLeft`, `onWidthChange`), so nothing collides,
  crosses a rule or overflows at 390px.
- **Every root** is exactly `<div class="gmt-<tool> gmt-widget not-content">`, first in the
  template, and gets `container-type: inline-size` (add it to the root list at the top of
  `gmt-transport-widgets.css`). Space inside a widget comes from `gap`, never sibling margins.
- **Nothing inside a drawn board, plot or rail is focusable**, except the `.gmt-handle`
  sliders, which are the controls. Each drawing is `role="img"` (or a list of real text) with
  a summary sentence that says what it shows.
- **Permalinks seed through `seedFromLocation`** (top-level strings of 1–64 characters). See
  section P for the flat shape shared by all three tools.
- **Design rules**: no rendered text under 12px (`font-floor.test.ts`), contrast ≥ 7:1 in both
  themes, no horizontal page scroll at 390px, narrow rules as `@container` queries, tokens
  only, no `clip-path`, values the reader is reading never animate.
- **Naming.** DCSA (the `eventClassifierCode` vocabulary: PLN, EST, REQ, ACT; the port-call
  cycle) and GTFS `frequencies.txt` (the headway row format) **may** be named, under
  `context/domination/tracker.md:312` ("a body's _format, vocabulary, cadence or algorithm_ is
  a standard GMT may implement and cite"). This differs from the TRAN-9 and TRAN-10 specs,
  whose GTFS ban was scoped to those stories. **No law is named**: no CFR, EU261, statute,
  regulation, docket, court, agency or jurisdiction label, in any page, widget string, preset,
  chat doc or test name. Tolerances are labelled by their numbers only: "15-minute",
  "60/120-minute", "day-based". Do not use the word "regulation" or "regulator" at all.
- **Plain English** (`/plain-english`): short sentences, active voice, one idea per sentence,
  no "simply", no "just".

---

## A. Content (build after the three tools exist)

All paths under `apps/dox/src/content/docs/`. Every permalink is
`/tools/<page>/?w=<kind>&wa=` plus `encodeURIComponent(JSON.stringify(obj))` of the JSON in
section P. Every fenced example imports what it calls from `@northguild/gmt/transport` (as the
existing transport guides do), and every `call // result` line is copied from appendix Z or
from the function's JSDoc `@example`. `node scripts/api-surface.mjs check` runs every one.

### A1. New guide `guides/industries/transport-punctuality-and-timestamps.mdx`

Frontmatter:

```yaml
title: "Transport: Punctuality and Timestamps"
description: scheduleDeviation, classifyPunctuality, punctualityRate, bestAvailable, estimateDrift and nextDeparture — late as exact elapsed time, on time against a tolerance you state, which of four timestamp classes to show, how far an estimate moved, and the next departure a connection can make.
sidebar:
  order: 5
```

The file name's `transport-` prefix is required by `scripts/stats.mjs` `industryLayers()`.

Intro (two short paragraphs, no heading): every mode publishes a plan and records what
happened, and measures the gap the same way; only the tolerance differs, and it is yours. One
field often holds four kinds of time. Then the import block, and one sentence saying all six
live in `@northguild/gmt/transport/compare` (`scheduleDeviation`, `classifyPunctuality`) and
`@northguild/gmt/transport/calculate` (the other four), linking
[`scheduleDelivery`](/reference/transport/calculate/scheduleDelivery/) as the function
`nextDeparture` feeds.

```typescript
import {
  bestAvailable,
  classifyPunctuality,
  estimateDrift,
  nextDeparture,
  punctualityRate,
  scheduleDeviation,
} from "@northguild/gmt/transport";
```

Then these sections, in this order, with exactly these `##` headings (the chat's retrieval
indexes each `##`). Prose is two to four short paragraphs per section, ported from
`packages/gmt/README.md` § "Punctuality, timestamp classes and the next departure" and the
JSDoc, not rewritten from memory.

1. `## Late is exact elapsed time: \`scheduleDeviation\``
   - Signed, hours as the largest unit, `"PT0S"` on the plan, a zone it is written in does not
     matter, a zoneless wall time is `""`. Link [`etaAtZone`](/reference/transport/convert/etaAtZone/)
     for a schedule's local time.
   - Code block:

     ```typescript
     import { scheduleDeviation } from "@northguild/gmt/transport";

     scheduleDeviation("2024-06-15T10:00:00Z", "2024-06-15T10:14:00Z"); // "PT14M"
     scheduleDeviation("2024-06-15T10:00:00Z", "2024-06-15T09:55:00Z"); // "-PT5M" (five minutes early)
     scheduleDeviation("2024-06-15T10:00:00Z", "2024-06-17T11:30:00Z"); // "PT49H30M" (hours, never days)
     scheduleDeviation("2024-11-03T01:30:00-04:00[America/New_York]", "2024-11-03T01:30:00-05:00[America/New_York]"); // "PT1H"
     scheduleDeviation("2024-03-10T01:30:00-05:00[America/New_York]", "2024-03-10T03:30:00-04:00[America/New_York]"); // "PT1H"
     scheduleDeviation("2024-06-15T10:00:00", "2024-06-15T10:14:00Z"); // ""
     ```

     One sentence after it: across the fall-back the wall clocks read 0 minutes and across the
     spring-forward 120; the deviation is 60 both times. Link the scenario
     [A Delay Across the Fall-Back](/scenarios/delay-across-fall-back/).
2. `## On time needs a stated tolerance: \`classifyPunctuality\``
   - GMT holds no default. A `PunctualityTolerance` is `{ late, early? }`, exact durations (a
     day is 24 hours; weeks, months, years or a negative value return `null`). The tolerance
     differs by mode; show the 15-minute, the 60/120-minute and the day-based examples, labelled
     by their numbers only.
   - `### Both edges are outside`: a deviation of `late` or more is late; with `early`, one of
     `-early` or less is early. On time is strictly inside. This is GMT's own stated convention.
     Without `early`, every early arrival is on time. `late: "PT0S"` makes an arrival exactly on
     the plan late.
   - Code block:

     ```typescript
     import { classifyPunctuality } from "@northguild/gmt/transport";

     // A 15-minute tolerance: exactly 15 minutes is late.
     classifyPunctuality("2024-06-15T10:00:00Z", "2024-06-15T10:14:59Z", { late: "PT15M" }); // "onTime"
     classifyPunctuality("2024-06-15T10:00:00Z", "2024-06-15T10:15:00Z", { late: "PT15M" }); // "late"
     // Early is optional. Without it, an early arrival is on time.
     classifyPunctuality("2024-06-15T10:00:00Z", "2024-06-15T08:00:00Z", { late: "PT15M" }); // "onTime"
     classifyPunctuality("2024-06-15T10:00:00Z", "2024-06-15T09:49:00Z", { late: "PT15M", early: "PT10M" }); // "early"
     // A 60/120-minute pair: the same 90-minute delay, two answers.
     classifyPunctuality("2024-06-15T10:00:00Z", "2024-06-15T11:30:00Z", { late: "PT60M" }); // "late"
     classifyPunctuality("2024-06-15T10:00:00Z", "2024-06-15T11:30:00Z", { late: "PT120M" }); // "onTime"
     // Day-based, one day either side: both edges belong to the outside.
     classifyPunctuality("2024-06-12T06:00:00+08:00", "2024-06-11T06:00:00+08:00", { late: "P1D", early: "P1D" }); // "early"
     classifyPunctuality("2024-06-12T06:00:00+08:00", "2024-06-13T05:00:00+08:00", { late: "P1D", early: "P1D" }); // "onTime"
     classifyPunctuality("2024-06-12T06:00:00+08:00", "2024-06-13T06:00:00+08:00", { late: "P1D", early: "P1D" }); // "late"
     classifyPunctuality("2024-06-15T10:00:00Z", "2024-06-15T10:00:00Z", { late: "PT0S" }); // "late"
     classifyPunctuality("2024-06-15T10:00:00Z", "2024-06-15T10:14:00Z", { late: "P1W" }); // null (weeks need a reference point)
     ```

   - End: "The [Punctuality Board](/tools/punctuality-board/) puts six arrivals on one axis and
     lets you drag both edges of the tolerance."
3. `## A rate is a count under one tolerance: \`punctualityRate\``
   - Reads the tolerance once; only `"onTime"` counts, so with `early` an early arrival is not on
     time; `rate` is not rounded; an empty list or one invalid pair is `null`, never a rate over
     the rest; percentiles and causes are the consumer's.
   - Code block (the README example, then the JSDoc early example, then `[]`):

     ```typescript
     import { punctualityRate } from "@northguild/gmt/transport";

     punctualityRate([
       { planned: "2024-06-15T10:00:00Z", actual: "2024-06-15T10:05:00Z" },
       { planned: "2024-06-15T10:00:00Z", actual: "2024-06-15T10:14:00Z" },
       { planned: "2024-06-15T10:00:00Z", actual: "2024-06-15T10:16:00Z" },
       { planned: "2024-06-15T10:00:00Z", actual: "2024-06-15T09:57:00Z" },
     ], { late: "PT15M" }); // { onTime: 3, total: 4, rate: 0.75 }
     punctualityRate([{ planned: "2024-06-15T10:00:00Z", actual: "2024-06-15T09:48:00Z" }, { planned: "2024-06-15T10:00:00Z", actual: "2024-06-15T10:01:00Z" }], { late: "PT15M", early: "PT10M" }); // { onTime: 1, total: 2, rate: 0.5 }
     punctualityRate([], { late: "PT15M" }); // null
     ```

   - End: "The same six arrivals are 2 of 6 on time under 60 minutes and 4 of 6 under 120 in
     the [Punctuality Board's 60/120-minute preset](PB3)." (rows G13/PB2a/PB2b).
4. `## One field, four meanings: \`bestAvailable\``
   - DCSA's `eventClassifierCode` vocabulary names four classes: `PLN` planned, `EST` estimated,
     `REQ` requested, `ACT` actual. A `TimestampEvent` is `{ classifier, at, recordedAt }`.
     `bestAvailable` returns an `ACT` whenever one exists, else `PLN`, else `REQ`, else `EST`, the
     newest `recordedAt` within the class (a tie goes to the later one in the array), and returns
     the class with the value. The order is GMT's, read from the most settled end of DCSA's
     port-call cycle (estimated → requested → planned → actual); DCSA defines the classes and
     the cycle, not a selection rule. It is not configurable.
   - `### Never put an EST in the ACT column`: a dashboard that shows the latest-recorded value
     puts an estimate in the actual column the moment a late feed arrives.
   - Code block: the three JSDoc examples of `bestAvailable` verbatim (ACT despite a later EST;
     the newest PLN; REQ over EST), each on one line with its `//` result, then
     `bestAvailable([]); // null`.
   - End: "Open [an estimate recorded after the actual](PE1) in the ETA Drift Chart."
5. `## How far the estimate moved: \`estimateDrift\``
   - Reads only `EST` records in `recordedAt` order; `revisions` counts them, the first
     included; `drift` is last minus first, signed; with `tolerance`, `exceedsTolerance` is true
     only when the drift is **greater** than it, in either direction; exactly the tolerance is
     `false`; without it, `null`. Fewer than two `EST` records is `null`: there is no drift from
     one sample.
   - Code block:

     ```typescript
     import { estimateDrift } from "@northguild/gmt/transport";

     const estimates = [
       { classifier: "EST", at: "2024-06-20T08:00:00Z", recordedAt: "2024-06-01T00:00:00Z" },
       { classifier: "EST", at: "2024-06-20T12:00:00Z", recordedAt: "2024-06-05T00:00:00Z" },
       { classifier: "EST", at: "2024-06-20T17:00:00Z", recordedAt: "2024-06-10T00:00:00Z" },
     ];
     estimateDrift(estimates, { tolerance: "PT8H" });
     // { first: "2024-06-20T08:00:00Z", last: "2024-06-20T17:00:00Z", drift: "PT9H", revisions: 3, exceedsTolerance: true }
     estimateDrift(estimates, { tolerance: "PT9H" });
     // { first: "2024-06-20T08:00:00Z", last: "2024-06-20T17:00:00Z", drift: "PT9H", revisions: 3, exceedsTolerance: false }
     estimateDrift(estimates.slice(0, 1)); // null (no drift from one estimate)
     ```

     If `api-surface.mjs show` reports that it cannot bind `estimates` (a multi-line `const`),
     inline the array in each call instead; never drop a result.
   - Then the JSDoc's "nine hours earlier" example (`-PT9H`, `exceedsTolerance: true`) on one line.
   - End: "Drag the tolerance to exactly 9 hours in the [ETA Drift Chart](PE2)."
6. `## The next departure you can make: \`nextDeparture\``
   - Timetable lookup, not routing. The threshold is `after` plus `minimumConnection` (exact
     time, not negative, default `"PT0S"`); a departure exactly at the threshold is made. Every
     moment must carry its offset: a wall time without one returns `""`, because in a repeated
     fall-back hour it names two departures. One invalid entry returns `""`.
   - `### A list of departures`: any order; a tie goes to the first; the entry is echoed exactly
     as written. Code block: the JSDoc list examples 1–3 and the two "needs an offset" examples.
   - `### A service every N minutes`: `{ headway, from, to }` has the shape of a GTFS
     `frequencies.txt` row. The window is half-open, `[from, to)`: `to` is never a departure.
     Departures are `from` plus whole headways in exact time, computed, never stepped. The
     result is written the way `from` was. Code block: the two JSDoc headway examples and the
     fall-back hourly example, plus rows M4:

     ```typescript
     import { nextDeparture } from "@northguild/gmt/transport";

     const shuttle = { headway: "PT20M", from: "2024-06-15T06:00:00+02:00", to: "2024-06-15T09:00:00+02:00" };
     nextDeparture("2024-06-15T06:05:00+02:00", shuttle); // "2024-06-15T06:20:00+02:00"
     nextDeparture("2024-06-15T08:40:00+02:00", shuttle); // "2024-06-15T08:40:00+02:00"
     nextDeparture("2024-06-15T08:55:00+02:00", shuttle); // ""
     nextDeparture("2024-06-15T09:00:00+02:00", shuttle); // ""
     nextDeparture("2024-11-03T01:30:00-04:00[America/New_York]", { headway: "PT1H", from: "2024-11-03T00:00:00-04:00[America/New_York]", to: "2024-11-03T04:00:00-05:00[America/New_York]" }); // "2024-11-03T01:00:00-05:00[America/New_York]"
     ```

   - `### It feeds \`scheduleDelivery\``: the returned entry goes straight into a leg's
     `departure`. Code block (G11):

     ```typescript
     import { scheduleDelivery } from "@northguild/gmt/transport";

     scheduleDelivery([{ departure: "2024-06-15T11:00:00Z", duration: "PT2H", timeZone: "Europe/London" }]);
     // { eta: "2024-06-15T14:00:00+01:00[Europe/London]", legTimes: [{ arrival: "2024-06-15T13:00:00Z", localArrival: "2024-06-15T14:00:00+01:00[Europe/London]", dwellAfter: "PT0S" }] }
     ```

     One sentence: `2024-06-15T11:00:00Z` is the departure the 45-minute connection makes in the
     list example above. Link the [Multi-leg Scheduling guide](/guides/industries/transport-multi-leg-scheduling/).
   - End: "The [Departure Board](/tools/departure-board/) draws the timetable on a rail; drag the
     arrival and watch the connection bar push it to the next departure, then send the result
     to the [Delivery Scheduler](/tools/delivery-scheduler/)."
7. `## See it break, then work`, a list:
   - `[Punctuality Board: six arrivals against a 15-minute tolerance](/tools/punctuality-board/)`
   - `[ETA Drift Chart: an estimate that slid nine hours](/tools/eta-drift/)`
   - `[Departure Board: a shuttle every 20 minutes, a 10-minute connection](/tools/departure-board/)`
   - `[An Estimate Shown as the Actual](/scenarios/estimate-shown-as-actual/)`
   - `[A Delay Across the Fall-Back](/scenarios/delay-across-fall-back/)`
   - `[Transport mistakes: punctuality and timestamps](/mistakes/transport/#punctuality-and-timestamps)`

The built page must have these ids (tester checks): `late-is-exact-elapsed-time-scheduledeviation`,
`on-time-needs-a-stated-tolerance-classifypunctuality`,
`a-rate-is-a-count-under-one-tolerance-punctualityrate`, `one-field-four-meanings-bestavailable`,
`how-far-the-estimate-moved-estimatedrift`, `the-next-departure-you-can-make-nextdeparture`,
`see-it-break-then-work`.

### A2. Updates to existing pages

- **`guides/industries/transport-multi-leg-scheduling.mdx`**: a new
  `### Which departure the cargo can make: \`nextDeparture\`` directly after the
  `### A scheduled departure is a connection, and dwell is the minimum connect time` section
  (after its "Open the handoff…" line, before `### A departure is exact, …`). Two sentences, no
  code: a scheduled `departure` is often the answer to "which departure can this cargo still
  make"; `nextDeparture` reads it off a timetable list or a service every N minutes, after the
  minimum connection time, and returns the entry exactly as written so it goes straight into the
  leg. Link `/guides/industries/transport-punctuality-and-timestamps/#the-next-departure-you-can-make-nextdeparture`
  and the [Departure Board](/tools/departure-board/).
- **`guides/index.mdx`**: in the Industries row, add "punctuality and timestamp classes" to the
  list of layers (after "multi-leg scheduling").
- **`guides/industries/index.mdx`**:
  - Layers: a bullet after "Transport: multi-leg scheduling": "[Transport: punctuality and
    timestamps](./transport-punctuality-and-timestamps/) — measure how late an arrival was in
    exact time, judge it against a tolerance you state, count a rate, pick the best of planned,
    estimated, requested and actual timestamps, measure how far an estimate moved, and find the
    next departure a connection can make. Built on the legs-and-dwell layer."
  - Scenarios: two bullets after "A Filing Deadline Anchored to the Wrong Event":
    `- [An Estimate Shown as the Actual](/scenarios/estimate-shown-as-actual/)` and
    `- [A Delay Across the Fall-Back](/scenarios/delay-across-fall-back/)`.
- **`mistakes/index.mdx`**: after `- [Cut-off Mistakes](/mistakes/transport/#cut-offs)`, add
  `- [Punctuality and Timestamp Mistakes](/mistakes/transport/#punctuality-and-timestamps)`.
- **`scenarios/index.mdx` is generated** by `scripts/build-scenario-index.mjs` from the
  scenario frontmatter, and is untracked. Never hand-edit it; `generate` adds both scenarios.

### A3. Scenario `scenarios/estimate-shown-as-actual.mdx`

Shape exactly as `connection-missed-at-spring-forward.mdx` (`<Scenario … fixedSpecId=… />`,
then a closing paragraph).

- Frontmatter title "An Estimate Shown as the Actual"; description: "A vessel berthed at 12:52.
  An hour later a late feed delivered an estimate of 13:05, and the dashboard's Actual column
  now says 13:05."
- `description` prop: "A vessel's berth time is tracked as four records: the plan, an
  estimate, the actual, and an estimate a late feed delivered after the vessel had berthed.
  Which time goes in the Actual column?"
- `naiveCode` (no gmt import; rows E2, N2):

  ```js
  // The naive approach: the newest record wins, whatever it claims to be
  const events = [
    { classifier: "PLN", at: "2024-06-15T12:00:00Z", recordedAt: "2024-06-01T00:00:00Z" },
    { classifier: "EST", at: "2024-06-15T12:40:00Z", recordedAt: "2024-06-14T00:00:00Z" },
    { classifier: "ACT", at: "2024-06-15T12:52:00Z", recordedAt: "2024-06-15T12:53:00Z" },
    { classifier: "EST", at: "2024-06-15T13:05:00Z", recordedAt: "2024-06-15T14:00:00Z" },
  ];
  const latest = events.reduce((a, e) => (Date.parse(e.recordedAt) >= Date.parse(a.recordedAt) ? e : a));
  latest.at; // "2024-06-15T13:05:00Z" — shown as the actual, and it is an estimate
  ```

- `explanation`: one field holds four kinds of time (DCSA's PLN, EST, REQ, ACT). The newest
  record is not the best one: an estimate recorded after the arrival is still only an
  estimate. `bestAvailable` returns an `ACT` whenever one exists, and returns the class with the
  value so the column can be labelled. `estimateDrift` reads the late feed as what it is, a
  revision of the estimate.
- `gmtCode` (rows ED2):

  ```ts
  import { bestAvailable, estimateDrift } from "@northguild/gmt/transport";

  const events = [ …the same four lines… ];

  bestAvailable(events);
  // { at: "2024-06-15T12:52:00Z", classifier: "ACT" } — the class travels with the value
  estimateDrift(events);
  // { first: "2024-06-15T12:40:00Z", last: "2024-06-15T13:05:00Z", drift: "PT25M", revisions: 2, exceedsTolerance: null } — the late feed is an estimate revision
  ```

- `fixedSpecId="bestAvailable"`.
- Closing paragraph: "Open these four records in the [ETA Drift Chart](PE1): the best-available
  pick rings the actual, and the naive pick rings the estimate recorded after it. Change the
  actual's class to EST and the plan becomes the best available. The rules are in [Transport:
  Punctuality and Timestamps](/guides/industries/transport-punctuality-and-timestamps/#one-field-four-meanings-bestavailable)."
  (Row ED2r: with the ACT reclassified as EST, `bestAvailable` is the PLN.)

### A4. Scenario `scenarios/delay-across-fall-back.mdx`

- Frontmatter title "A Delay Across the Fall-Back"; description: "A train due at 01:30 on the
  night New York's clocks go back arrives at 01:30 by the station clock, an hour later.
  Subtracting the clocks says it was on time."
- `description` prop: "A train is due in New York at 01:30 EDT on Sunday 3 November 2024. At
  02:00 the clocks go back to 01:00, and the train arrives at 01:30 EST. How late was it?"
- `naiveCode` (row N1):

  ```js
  // The naive approach: subtract the times on the arrivals board
  const minutes = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
  minutes("01:30") - minutes("01:30"); // 0 — "on time", across the fall-back
  minutes("03:30") - minutes("01:30"); // 120 — "two hours late", across the spring-forward
  ```

- `explanation`: a wall-clock subtraction assumes every hour on the clock happened once. On a
  fall-back night 01:00–02:00 happens twice, so the same printed 01:30 names two instants an
  hour apart; on a spring-forward night 02:00–03:00 never happens. `scheduleDeviation` subtracts
  instants, so the delay is 60 minutes both times, and `classifyPunctuality` judges that against
  your tolerance.
- `gmtCode` (rows G1, G2, PB4):

  ```ts
  import { classifyPunctuality, scheduleDeviation } from "@northguild/gmt/transport";

  scheduleDeviation("2024-11-03T01:30:00-04:00[America/New_York]", "2024-11-03T01:30:00-05:00[America/New_York]");
  // "PT1H" — the second 01:30 is an hour after the first
  classifyPunctuality("2024-11-03T01:30:00-04:00[America/New_York]", "2024-11-03T01:30:00-05:00[America/New_York]", { late: "PT15M" });
  // "late"
  scheduleDeviation("2024-03-10T01:30:00-05:00[America/New_York]", "2024-03-10T03:30:00-04:00[America/New_York]");
  // "PT1H" — 03:30 EDT is an hour after 01:30 EST
  ```

- `fixedSpecId="scheduleDeviation"`.
- Closing paragraph: "Open the [fall-back night in the Punctuality Board](PB2): read off the
  wall clocks, 3 of 4 trains are on time under a 15-minute tolerance; measured, 1 of 4 is. The
  rules are in [Transport: Punctuality and
  Timestamps](/guides/industries/transport-punctuality-and-timestamps/#late-is-exact-elapsed-time-scheduledeviation)."
  (Rows PB4, PB4n.)

### A5. `mistakes/transport.mdx`

- Frontmatter description: add "punctuality, timestamp classes and next departures".
- Intro paragraph: add the six functions to the list of functions, and "calling an arrival on
  time with no stated tolerance, showing an estimate as an actual, and picking a departure the
  connection cannot make" to the list of mistakes.
- A new `## Punctuality and timestamps` after the last Cut-offs `<Mistake>`, opening with:
  "Each of these has a live tool: the [Punctuality Board](/tools/punctuality-board/), the [ETA
  Drift Chart](/tools/eta-drift/) and the [Departure Board](/tools/departure-board/)."
- Four `<Mistake>` entries, in this order. Each `wrongCode` and `rightCode` result is an
  appendix Z row.
  1. `severity="high"`, title "Calling an arrival on time with no stated tolerance".
     description: "On time is a measurement only against a tolerance someone stated. A
     threshold buried in a comparison hides its number and its edge: here exactly 15 minutes
     counts as on time, and the next person who reads it cannot tell whether that was meant.
     classifyPunctuality takes the tolerance as an argument, holds no default, and puts both
     edges outside the on-time window." `wrongCode` (row N4):

     ```js
     // "On time" with the tolerance buried in a comparison
     const late = (plannedMs, actualMs) => actualMs - plannedMs > 15 * 60 * 1000;
     late(Date.parse("2024-06-15T10:00:00Z"), Date.parse("2024-06-15T10:15:00Z")); // false — exactly 15 minutes counted as on time
     ```

     `rightCode` (JSDoc, G3):

     ```ts
     import { classifyPunctuality } from "@northguild/gmt/transport";

     classifyPunctuality("2024-06-15T10:00:00Z", "2024-06-15T10:15:00Z", { late: "PT15M" }); // "late"
     classifyPunctuality("2024-06-15T10:00:00Z", "2024-06-15T11:30:00Z", { late: "PT60M" }); // "late"
     classifyPunctuality("2024-06-15T10:00:00Z", "2024-06-15T11:30:00Z", { late: "PT120M" }); // "onTime"
     ```

     `rightSpecId="classifyPunctuality"`.
  2. `severity="high"`, title "Showing an estimate in the actual column". description: "When
     one field carries planned, estimated, requested and actual times, the newest record is not
     the best one. An estimate a late feed delivers after the arrival replaces the actual on a
     latest-wins dashboard. bestAvailable returns an ACT whenever one exists, and returns its
     class with it." `wrongCode`: the two-event latest-wins reduce over the JSDoc's first
     `bestAvailable` example (ACT 12:52 recorded 12:53; EST 13:05 recorded 14:00), result
     `"2024-06-15T13:05:00Z"`. `rightCode`: that JSDoc example verbatim with its result.
     `rightSpecId="bestAvailable"`.
  3. `severity="high"`, title "Picking the next departure without the minimum connection".
     description: "A departure ten minutes after you arrive is on the timetable, not within
     reach. The threshold is the arrival plus the time it takes to connect. nextDeparture takes
     minimumConnection and counts a departure exactly at the threshold as made." `wrongCode`
     (row G8):

     ```ts
     import { nextDeparture } from "@northguild/gmt/transport";

     // The train arrives at 09:20; boarding the ferry takes 45 minutes.
     nextDeparture("2024-06-15T09:20:00Z", ["2024-06-15T09:30:00Z", "2024-06-15T11:00:00Z"]);
     // "2024-06-15T09:30:00Z" — ten minutes to make a 45-minute connection
     ```

     `rightCode` (row G9): the same call with `{ minimumConnection: "PT45M" }`, result
     `"2024-06-15T11:00:00Z"`. `rightSpecId="nextDeparture"`.
  4. `severity="medium"`, title "Treating a headway window's end as a departure".
     description: "A service every 20 minutes from 06:00 to 09:00 stops at 09:00; 09:00 is
     the end of service, not a departure. A loop that steps up to and including the end time
     sells one departure too many. nextDeparture reads the window as half-open, [from, to), as
     a GTFS frequencies.txt end_time is read." `wrongCode` (row N3):

     ```js
     // The naive approach: step every 20 minutes up to and including the end time
     const departures = [];
     for (let t = Date.parse("2024-06-15T06:00:00+02:00"); t <= Date.parse("2024-06-15T09:00:00+02:00"); t += 20 * 60 * 1000) departures.push(new Date(t).toISOString());
     departures.at(-1); // "2024-06-15T07:00:00.000Z" — 09:00 local, the end of service, sold as a departure
     ```

     `rightCode` (row M4):

     ```ts
     import { nextDeparture } from "@northguild/gmt/transport";

     const shuttle = { headway: "PT20M", from: "2024-06-15T06:00:00+02:00", to: "2024-06-15T09:00:00+02:00" };
     nextDeparture("2024-06-15T08:40:00+02:00", shuttle); // "2024-06-15T08:40:00+02:00"
     nextDeparture("2024-06-15T08:55:00+02:00", shuttle); // "" — the last departure is 08:40
     ```

     `rightSpecId="nextDeparture"`.

---

## T0. Shared helpers (build first)

### T0.1 `src/lib/punctuality-widgets.ts` (pure: no DOM, no gmt import)

May import `@js-temporal/polyfill` for drawing only. Reuses, never copies: `durationText`,
`localParts`, `localLabel`, `walkTicks`, `hourTickLabel`, `dayTickLabel` from
`cutoff-widgets.ts`; `epochMs`, `TRANSPORT_ZONES`, `zoneOptionsHtml` from
`transport-widgets.ts`. **Do not reuse `cutoff-widgets.ts` `callSource`**: its
`keyOrderFor` knows only cut-off shapes and silently drops every other key (a `{ planned,
actual }` pair prints as `{ }`).

- Types, declared locally as `cutoff-widgets.ts` declares its own (no type import from gmt):
  `TimestampClass`, `TimestampEvent`, `PunctualityTolerance`, `Punctuality`, `PlannedActual`,
  `OnTimeRate`, `ClassifiedTimestamp`, `DriftReport`, `Headway`, and `interface PunctualityLib`
  with `scheduleDeviation`, `classifyPunctuality`, `punctualityRate`, `bestAvailable`,
  `estimateDrift`, `nextDeparture`, typed as their JSDoc signatures.
- `TIMESTAMP_CLASSES`: `[{ code: "PLN", label: "planned" }, { code: "EST", label: "estimated" },
  { code: "REQ", label: "requested" }, { code: "ACT", label: "actual" }]`.
- `PUNCTUALITY_LABELS`: `{ early: "early", onTime: "on time", late: "late" }`.
- `minutesToIso(minutes)`: whole minutes ≥ 0 to an exact duration with hours as the largest
  unit: `0` → `"PT0S"`, `15` → `"PT15M"`, `60` → `"PT1H"`, `90` → `"PT1H30M"`, `1440` →
  `"PT24H"`. It builds an input; it computes no result.
- `isoToMinutes(iso)`: a duration's length in minutes for **drawing only**, a day as 24 hours
  (`"P1D"` → 1440, `"PT14M59S"` → 14.983…), a leading `-` negates; `null` for anything with
  years, months or weeks, or that does not parse. Use `Temporal.Duration.from(…).total({ unit:
  "minutes" })`; confirm in the test that `P1D` gives 1440 without `relativeTo`.
- `signedText(iso)`: `"PT15M"` → `"+15 min"`, `"-PT3M"` → `"−3 min"` (U+2212), `"PT0S"` →
  `"0 min"`, `"PT1H35M"` → `"+1 h 35 min"`, `"-PT36H"` → `"−36 h"`, `"PT14M59S"` →
  `"+14 min 59 s"`, `""` → `""`. Built on `durationText`.
- `writtenParts(s)`: `{ date, weekday, time, offset, zone }` of a moment **as written**: a zoned
  string through `localParts`; an instant with `Z` or a numeric offset by a regex (`zone: ""`,
  `offset: "Z"` or `"+02:00"`). Seconds shown only when non-zero. All `""` when it does not
  parse. `writtenLabel(s)`: `"Sat 15 Jun 13:00"`; `writtenTime(s)`: `"13:00"`.
- `wallAsUtc(s)`: the date-time part of `s` (before any offset or `[`), plus `Z`
  (`"2024-11-03T01:30:00-05:00[America/New_York]"` → `"2024-11-03T01:30:00Z"`); `""` when there
  is no date-time part. This builds the naive reading's input.
- `formatValue(v)` and `callArgs(args): [html, plain]`: the JSDoc spelling, unquoted keys,
  double-quoted strings, numbers and booleans bare, `null` as `null`, arrays in brackets,
  absent keys omitted. Key order by shape: pair `planned, actual`; tolerance `late, early`;
  event `classifier, at, recordedAt`; headway `headway, from, to`; drift options `tolerance`;
  departure options `minimumConnection`; rate `onTime, total, rate`; classified `at,
  classifier`; drift report `first, last, drift, revisions, exceedsTolerance` (with `null`
  printed). Unknown keys keep insertion order rather than being dropped. `formatValue` of the
  PB1 rate is `{ onTime: 4, total: 6, rate: 0.6666666666666666 }`.
- `niceMinutes(m)`: the smallest of `[5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 360, 480,
  720, 1440, 2160, 2880, 4320, 5760, 7200, 10080]` that is ≥ `m`, else `m` rounded up to whole
  days. Drawing only.
- `stepMinutesFor(spanMinutes)`: `≤ 180` → 1, `≤ 2880` → 15, else 60. Drawing and keyboard
  step only.

### T0.2 `src/lib/punctuality-lib.ts`

`loadPunctualityLib(): Promise<PunctualityLib>`: `Promise.all` of
`GMT_MODULES["transport/compare"]()` and `GMT_MODULES["transport/calculate"]()`, cast as
`cutoff-lib.ts` casts. Each mount calls it inside its own `try` and throws
`new WidgetLoadError(cause)` on failure. Do not extend `loadCutoffLib` or `loadTransportLib`. A
heavy module (section X).

### T0.3 `src/lib/punctuality-widgets.test.ts`

Covers every example in T0.1: `minutesToIso`, `isoToMinutes` (`P1D`, `PT14M59S`, `-PT36H`,
`P1W` → null, `"x"` → null), `signedText`, `writtenParts`/`writtenLabel`/`writtenTime` (a zoned,
a `Z` and a `+02:00` string), `wallAsUtc`, `formatValue` (the PB1 rate, the ED1 report, the
ED2 classified pick, `null`) and `callArgs` (a pairs array and a tolerance; the plain text of
the PB-pill call equals
`[{ planned: "2024-06-14T09:00:00+01:00[Europe/London]", actual: "2024-06-14T09:15:00+01:00[Europe/London]" }], { late: "PT15M" }`),
`niceMinutes`, `stepMinutesFor`.

### T0.4 `src/styles/gmt-punctuality-widgets.css`

Only rules two or more of the three tools share, tokens only: the drawn-axis frame and its tick
labels (reuse `gmt-cutoff-widgets.css` tick classes by adding the three roots to its selector
lists where a rule applies, rather than copying), the hatch pattern used for "outside the
tolerance" and for the connection bar (one `repeating-linear-gradient` recipe on
`currentColor`), the "naive" outline treatment (dashed 1px border plus the word "naive"), and
the callout label. Register it in `astro.config.mjs` `customCss` directly after
`gmt-cutoff-countdown.css` with `// Punctuality widgets, shared (TRAN-57)`, then the three tool
sheets. Add forced-colors rules to `gmt-a11y.css` so the band, its edges, bars, hatches, marks,
the connection bar and the made and naive departures stay distinguishable by border style and
text.

---

## PB. Punctuality Board: `/tools/punctuality-board/`, kind `punctuality`

Answers: was each arrival late, by how much, and what share was on time, under a tolerance I
can see and move? Root: `<div class="gmt-punctuality-board gmt-widget not-content">`.

### PB1. `src/lib/punctuality-board.ts` (pure)

- `MAX_ROWS = 6`. `BoardState = { preset: string; rows: PlannedActual[]; late: string;
  earlyOn: boolean; early: string; compareOn: boolean; compareLate: string }`. `preset` is the
  id whose rows the state carries, or `"custom"`. Rows are never edited in the UI; they come
  from a preset, the chat, or a permalink.
- `toleranceA(state)`: `{ late }` plus `early` when `earlyOn` (and `early` not blank).
  `toleranceB(state)`: `{ late: compareLate }` plus the same `early`. B exists only when
  `compareOn`.
- `PUNCTUALITY_PRESETS`, in this order (rows and results in appendix Z):

  | id | label | rows | tolerance | result |
  | --- | --- | --- | --- | --- |
  | `fifteen-minute` | 15-minute tolerance: six arrivals at a London station | `P15` | `late: "PT15M"` | PB1 |
  | `sixty-and-120` | 60/120-minute: the same six arrivals, two tolerances | `P60` | `late: "PT60M"`, compare `"PT120M"` | PB2a, PB2b |
  | `day-based` | Day-based: a day either side, both edges outside | `PDAY` | `late: "P1D"`, early `"P1D"` | PB3 |
  | `fall-back` | A delay across New York's fall-back | `PFB` | `late: "PT15M"` | PB4, naive PB4n |

  Descriptions, one or two sentences each:
  1. "Six trains due at a London station on Friday 14 June 2024, against a 15-minute late
     tolerance. The 09:00 arrived at 09:15 exactly, on the late edge, which is late. With no
     early tolerance the two early arrivals are on time."
  2. "Six arrivals in Amsterdam on Saturday 15 June 2024, against a 60-minute and a
     120-minute late tolerance at once. The same arrivals are 2 of 6 on time under one and 4 of
     6 under the other, so a rate means nothing without its tolerance."
  3. "Six vessel calls at Singapore in June 2024, one day either side. Exactly 24 hours early
     is early and exactly 24 hours late is late: both edges belong to the outside."
  4. "Four arrivals on Sunday 3 November 2024, when New York's clocks went back from 02:00 to
     01:00. The 01:30 arrived at the second 01:30, an hour late, and the station clock shows no
     delay. The wall-clock column is the naive reading."
- `readArgs(args)`: start from the preset named by `args.preset` (a known id), else the first
  preset. A `pairs` array (the chat) replaces the rows and sets `preset: "custom"`; else flat
  `pairCount` / `planned1…6` / `actual1…6` (the permalink) do the same. Then each scalar key
  present overrides its field: `late`; `early` (sets `earlyOn`; the string `"none"` turns it
  off); `compareLate` (sets `compareOn`; `"none"` turns it off). A chat call has no `preset`,
  so its tolerance is exactly `late`, `early?`, `compareLate?`. Non-strings become `""`.
- `matchPreset(state)`: the preset whose rows **and** tolerance equal the state's (trimmed),
  else `"custom"`.
- `permalinkOf(state)`: strings only. When `state.preset` is a preset id: `{ preset }` plus each
  tolerance field that differs from that preset's (`"none"` for one switched off). Otherwise
  `{ pairCount, planned1…, actual1…, late, early?, compareLate? }`. Every value ≤ 64
  characters; a row string over 64 is a schema failure upstream, never truncated here.
- `collectBoardFacts(state, lib)`: per row, `deviation = lib.scheduleDeviation(p, a)`,
  `classA = lib.classifyPunctuality(p, a, toleranceA)`, `classB` likewise when `compareOn`,
  `naiveDeviation = lib.scheduleDeviation(wallAsUtc(p), wallAsUtc(a))` and
  `naiveClass = lib.classifyPunctuality(wallAsUtc(p), wallAsUtc(a), toleranceA)`. Then
  `rateA = lib.punctualityRate(rows, toleranceA)`, `rateB`, `naiveRate` over the wall pairs, and
  `showNaive` = some row's `naiveDeviation !== deviation`.
- `boardNullReason(state, facts, lib)`, checked in this order, each by a library probe with
  `REF = "2024-01-01T00:00:00Z"` (row N6):
  1. `lib.classifyPunctuality(REF, REF, { late }) === null` → `invalid-late`: "The late
     tolerance is not an exact duration. Write it as PT15M, PT1H30M or P1D: weeks, months and
     years have no fixed length, and a negative tolerance is refused, so classifyPunctuality
     returns null."
  2. `earlyOn` and `lib.classifyPunctuality(REF, REF, { late: "PT0S", early }) === null` →
     `invalid-early`: the same wording for the early tolerance.
  3. `compareOn` and `lib.classifyPunctuality(REF, REF, { late: compareLate }) === null` →
     `invalid-compare`: the same wording for the second late tolerance.
  4. The first row whose `deviation === ""` → `invalid-row`: "Arrival n's planned or actual time
     has no offset or zone, so it is not a moment. One invalid pair makes punctualityRate return
     null, never a rate over the rest."
- `axisMinutes(state, facts)`: drawing only. `R = niceMinutes(1.2 × max(|isoToMinutes(dev)|
  over valid rows, late, early, compareLate, 5))`. The axis runs from −R to +R, centred on 0.

### PB2. `src/lib/punctuality-board.test.ts`

`readArgs` (chat pairs, flat keys, preset with overrides, `"none"`, junk to `""`),
`toleranceA`/`toleranceB`, `matchPreset` (every preset and custom), `permalinkOf` (the preset
form round-trips through `readArgs`; the custom form round-trips; every value ≤ 64),
`collectBoardFacts` for every preset against appendix Z (PB1, PB1e, PB2a, PB2b, PB3, PB4,
PB4n, and `showNaive` true only on `fall-back`), each reason (PBR1–PBR6, asserting the real
call returns `null` or `""` for it), `axisMinutes` on each preset.

### PB3. `src/lib/punctuality-board-mount.ts`

`renderPunctualityBoardTemplate(args = {})` (seeded when `args.pairs`, `args.planned1` or
`args.preset` is defined, else the first preset) and `mountPunctualityBoard(root, args, signal)`.

1. `<h4>1. The arrivals and the tolerance</h4>`:
   - A field grid: "Preset" (`preset`, `.gmt-select`, Custom first, `gmt-field-wide`), then
     the description (`preset-description`, `.gmt-widget-hint`, a full row).
   - A field grid: "Late tolerance" (`late`, text), "Early tolerance" (`early`, text, `optional`
     chip, disabled while the switch is off), "Second late tolerance" (`compare-late`, text,
     `optional` chip, disabled while off). Hint under it (full row): "ISO 8601 durations of
     exact time: PT15M, PT1H30M, P1D. A day is 24 hours."
   - A `.gmt-chip-group` fieldset (legend "Compare") with two switches built by
     `chipToggleHtml({ switch: true })`: "Early tolerance" (`early-on`) and "A second late
     tolerance" (`compare-on`).
2. `<h4>2. Late, early or on time</h4>`:
   - The rate header (`rate`, `aria-live="polite"`): "4 of 6 on time, late tolerance 15 min
     (PT15M)" built from `rateA` (`onTime`, `total`) and the tolerance as written
     (`durationText`, then the ISO string); when
     comparing, a second line for B. When `showNaive`: a third line, "Read off the wall clocks
     (naive): 3 of 4 on time", with the `.gmt-transport-naive` treatment.
   - **The board** (`board`): a tolerance track over a list of rows, on one shared axis from
     −R to +R with 0 marked "on the plan".
     - The track (`tolerance-track`, `aria-hidden` except its handles) holds the band and its
       handles. The band A is the region from `−early` (or the left edge, open-ended with an
       arrow and the words "early is on time", when early is off) to `late`, drawn as a
       translucent `--gmt-cyan` tint with solid edges. Band B, when comparing, is a dashed
       outline from the same left edge to `compareLate`, on a second lane of the track.
     - Handles, each `<div class="gmt-handle" role="slider" tabindex="0">` positioned by `left`:
       `handle-late` (aria-label "Late tolerance", value range 0…R), `handle-early` (aria-label
       "Early tolerance", range −R…0, its value is `−early`; present only when early is on),
       `handle-compare` (aria-label "Second late tolerance", range 0…R, on lane B; present only
       when comparing). Each sets `aria-valuemin`, `aria-valuemax`, `aria-valuenow` (signed
       minutes on the axis) and `aria-valuetext` ("Late tolerance 15 minutes, PT15M").
       Dragging or a key writes `minutesToIso(|position|)` into the matching text field and
       re-renders every row and the rate header live. Step: `stepMinutesFor(R)`; Shift and
       PageUp/PageDown ×10; Home and End to the range ends; a late handle never goes below 0,
       an early handle never above 0. Typing in a field moves its handle on `input` when
       `isoToMinutes` reads it; an unreadable value leaves the handle where it was and the
       library's `null` shows the reason.
     - Each row (an `<ol>` of `<li data-role="row-n">`, real text): a label "09:00 → 09:15"
       (`writtenTime` of planned and actual; the date only when the two dates differ), a bar
       (`aria-hidden`) from 0 to the deviation, hatched where it lies outside band A, and a
       text cell with `signedText(deviation)` and the class word(s) from the library ("late",
       "on time", "early"; with B, "late · on time under 120"). A row exactly on an edge reads
       the library's word: PB1's 09:00 → 09:15 reads "late". The class words are never
       coloured; "late" and "early" carry a small outlined tag, "on time" none. When
       `showNaive`, each row also shows the naive reading ("wall clock: 0 min, on time
       (naive)").
     - At container widths under 30rem the row label sits above its bar; the board never
       scrolls the page sideways at 390px.
   - `board-summary` (`.gmt-widget-hint`): one sentence per row ("Arrival 3, due 09:00, came at
     09:15: +15 min, late."). The board's `aria-describedby` points at it.
   - `reason-aside` for `boardNullReason`.
3. `<h4>3. What the calls return</h4>`: a code frame with the `punctualityRate(pairs,
   tolerance)` call (`callArgs`) and `rate-output-a` (`formatValue`, or `NO SIGNAL`); when
   comparing, a second frame and `rate-output-b`. Then a table (`calls-table`): Arrival |
   `scheduleDeviation` | `classifyPunctuality` (A, and B when comparing), every cell the
   library's literal output (`"PT15M"`, `"late"`, `NO SIGNAL` for `""`/`null`).

Every control re-renders on `input`/`change`. The mount returns a handle whose `destroy` is
idempotent, which releases a held pointer capture, stops on `signal` abort, and exposes
`getPermalinkState()` returning `permalinkOf(state)`.

### PB4. `src/lib/punctuality-board-mount.test.tsx` (jsdom, real gmt)

- For each preset: the rate header text, every row's deviation text and class word, the
  `punctualityRate` output verbatim (appendix Z), and on `fall-back` the naive line and the
  naive per-row text.
- The boundary: on `fifteen-minute`, row 3 reads "late"; pressing ArrowRight once on
  `handle-late` (step 1 min, R = 30) writes `"PT16M"` to `late` and row 3 reads "on time"
  (PB1d), and the header reads 5 of 6 (PB1d2).
- Turning on the early switch with `early` = `"PT10M"` gives PB1e (row 6 "early", 3 of 6).
- Home on `handle-late` writes `"PT0S"` and the header reads 2 of 6 (PB1z); End writes
  `minutesToIso(R)`.
- Shift+ArrowLeft on `handle-early` moves it 10 steps.
- Typing `"P1W"` in `late` shows `NO SIGNAL` and the `invalid-late` reason (PBR1).
- The chat seed (the pill args, PB8) renders PBP: one row, "+15 min", "late", 0 of 1.
- A pointer drag: `pointerdown` on `handle-late`, `pointermove` to a clientX inside the track
  (stub `getBoundingClientRect`), `pointerup`: `late` holds the snapped value and the rows
  re-rendered.
- The permalink round-trip (preset form and custom form), the abort and the double destroy.

### PB5 to PB7

- **Shell** `src/components/PunctualityBoard.astro`, as `CutoffCountdown.astro`, with
  `seedFromLocation("punctuality")` and `.gmt-punctuality-board`.
- **Page** `src/content/docs/tools/punctuality-board.mdx`. Title "Punctuality Board".
  Description: "Was it late, by how much, and what share was on time? scheduleDeviation,
  classifyPunctuality and punctualityRate judge a set of arrivals against a tolerance you
  drag: both edges outside, early optional, and no default." Intro (two short paragraphs: the
  tolerance is yours and both edges belong to the outside; a rate travels with its tolerance),
  then `<PunctualityBoard />`. "Worth trying": PB1 (a 10-minute early tolerance), PB2 (the
  fall-back night), PB3 (60 and 120 side by side). A Reference paragraph linking
  [`scheduleDeviation`](/reference/transport/compare/scheduleDeviation/),
  [`classifyPunctuality`](/reference/transport/compare/classifyPunctuality/),
  [`punctualityRate`](/reference/transport/calculate/punctualityRate/) and the guide sections
  `#on-time-needs-a-stated-tolerance-classifypunctuality` and
  `#a-rate-is-a-count-under-one-tolerance-punctualityrate`.
- **CSS** `src/styles/gmt-punctuality-board.css`, `// Punctuality Board widget (TRAN-57)`.

### PB8. Chat registration

| Item | Value |
| --- | --- |
| Schema | `showPunctualityBoardInput = z.object({ pairs: z.array(z.object({ planned: dateTimeSchema, actual: dateTimeSchema })).min(1).max(6), late: durationSchema, early: durationSchema.optional(), compareLate: durationSchema.optional() })` |
| `purpose` | "Planned and actual times judged by scheduleDeviation, classifyPunctuality and punctualityRate on one axis, with the tolerance band drawn and draggable: each deviation in exact time, early, on time or late with both edges outside, and the on-time rate." |
| `when` | "the reader asks whether an arrival or departure was late, early or on time, by how much, or what share of several was on time under a tolerance" |
| `args` | "pairs (1 to 6, each a planned and an actual ISO date-time with an offset or a bracketed zone), late (the late tolerance as an ISO 8601 duration such as PT15M or P1D; required: there is no default, so ask for it), early (optional early tolerance; without it an early arrival is on time), compareLate (optional second late tolerance to compare side by side, such as PT120M against PT60M)" |
| Worker | a trivial `execute` with no zone check, as `showIntervalVisualizer` |
| Registry | `punctualityEntry`, `title: "Punctuality board"`, `kind: "punctuality"`, no `validate` |
| Permalink | `punctuality: "/tools/punctuality-board/"` |
| Starter | text "Train due 09:00 on 14 June 2024 in London arrived 09:15. Late under a 15-minute tolerance?" (90 characters). args `{ pairs: [{ planned: "2024-06-14T09:00:00+01:00[Europe/London]", actual: "2024-06-14T09:15:00+01:00[Europe/London]" }], late: "PT15M" }`, with the comment "London is on British Summer Time in June. Exactly the tolerance is late: the board shows the edge." Result: PBP. |

---

## ED. ETA Drift Chart: `/tools/eta-drift/`, kind `etadrift`

Answers: which of these timestamps do I show, and how far has the estimate moved? Root:
`<div class="gmt-eta-drift gmt-widget not-content">`.

### ED1. `src/lib/eta-drift.ts` (pure)

- `MAX_EVENTS = 6`. `DriftState = { eventCount: string; events: TimestampEvent[6] (strings,
  blank when unused); tolerance: string }`. The visible events are the first `eventCount`.
- `ETA_PRESETS`, in this order (results in appendix Z):

  | id | label | events | tolerance | result |
  | --- | --- | --- | --- | --- |
  | `vessel-slide` | A vessel ETA slides 9 hours against an 8-hour tolerance | `E1` | `PT8H` | ED1 |
  | `est-after-act` | An estimate recorded after the actual | `E2` | blank | ED2 |
  | `req-beats-est` | A requested time beats a later estimate | `E3` | `PT15M` | ED3 |
  | `one-estimate` | One estimate: no drift to measure | `E4` | `PT15M` | ED4 |

  Descriptions:
  1. "Three estimates of one vessel's arrival on 20 June 2024, recorded on 1, 5 and 10 June:
     08:00, 12:00, then 17:00 UTC. The estimate moved 9 hours, more than the 8-hour tolerance.
     Drag the tolerance to exactly 9 hours: equal does not exceed."
  2. "The vessel berthed at 12:52, recorded at 12:53. At 14:00 a late feed delivered an
     estimate of 13:05. The newest record is an estimate; bestAvailable still returns the
     actual. With no tolerance, exceedsTolerance is null."
  3. "A berth was requested for 12:30. Two estimates followed, 12:40 then 12:45.
     bestAvailable never returns an estimate when a request exists, however much later the
     estimate was recorded."
  4. "A plan and one estimate. There is no drift from one sample, so estimateDrift returns
     null. The plan is the best available: an estimate never replaces it."
- `readArgs(args)`: start from `args.preset` (known id) or the first preset. An `events` array
  (the chat) replaces the events; else flat `eventCount` / `classifier1…6` / `at1…6` /
  `recordedAt1…6`. Then `tolerance` overrides (`"none"` → blank). A chat call has no `preset`,
  so its tolerance is exactly what it gives (absent → blank).
- `eventsOf(state)`: the visible events as `{ classifier, at, recordedAt }`, trimmed.
- `matchPreset`, `permalinkOf` as in PB1 (preset form when the events equal a preset's: `{
  preset }` plus `tolerance` when it differs, `"none"` when cleared; otherwise the flat form).
- `naivePick(events)`: the event with the greatest `epochMs(recordedAt)`, ties to the later
  index; `null` when any `recordedAt` does not parse. The tool's one naive value.
- `collectDriftFacts(state, lib)`: `best = lib.bestAvailable(events)`, `drift =
  lib.estimateDrift(events, tolerance ? { tolerance } : undefined)`, `naive = naivePick(events)`,
  `estCount` = the number of visible events whose classifier is `"EST"` (input reading).
- `driftNullReason(state, facts, lib)`, in this order:
  1. `best === null`: the first visible event `e` with `lib.bestAvailable([e]) === null` →
     `invalid-event`: "Event n is not a timestamp: its class must be PLN, EST, REQ or ACT, and
     at and recordedAt need an offset or a zone. One invalid event makes both calls return
     null." (Rows EDR1, EDR2, EDR5.)
  2. `drift === null` and tolerance not blank and
     `lib.estimateDrift(E1, { tolerance }) === null` → `invalid-tolerance`: "The tolerance is
     not an exact duration that is zero or more. Write it as PT8H or PT30M: weeks, months and
     years have no fixed length." (EDR3; `E1` is a module constant copied from appendix Z.)
  3. `drift === null` and `estCount === 1` → `one-estimate`: "There is no drift from one
     estimate: estimateDrift returns null with fewer than two EST records." `estCount === 0` →
     `no-estimate`: "No EST records: estimateDrift reads only estimates." (ED4.)
- `plotWindow(events)`: drawing only. x from the earliest to the latest `recordedAt`, y from the
  lowest to the highest `at` (and the tolerance band's edges when drawn), each padded 8% (a zero
  span pads ±1 day on x and ±1 h on y).

### ED2. `src/lib/eta-drift.test.ts`

`readArgs` (chat array, flat keys, preset with `tolerance`, `"none"`), `eventsOf`,
`matchPreset`, `permalinkOf` (both forms round-trip; ≤ 64 each), `naivePick` (ED2's 13:05 EST,
ED3's 12:45 EST, a tie goes to the later index), `collectDriftFacts` for every preset (ED1–ED4),
ED1a/ED1b/ED1c (tolerance `PT9H`, `PT8H45M`, blank), ED2r (reclassify event 3 as EST), each
reason (EDR1, EDR2, EDR3, ED4), `plotWindow`.

### ED3. `src/lib/eta-drift-mount.ts`

`renderEtaDriftTemplate(args = {})` and `mountEtaDrift(root, args, signal)`.

1. `<h4>1. The timestamps</h4>`: a field grid with "Preset" (`gmt-field-wide`) and "Events"
   (`event-count`, a `.gmt-select` 1–6); the description. Then one
   `<fieldset class="gmt-transport-leg" data-role="event-n">` per visible event (legend
   "Event n"), holding a `.gmt-chip-group` fieldset (legend "Class") of four radio chips built
   by `chipToggleHtml({ type: "radio", name: "classifier-n-<instance>", role: "classifier-n",
   value: "PLN" … })`, labelled `PLN`…`ACT`, and a field grid with "At" (`at-n`) and "Recorded
   at" (`recorded-at-n`). The radio `name` carries a per-mount suffix so two widgets on one
   page (a tool page and the rail) never share a radio group. Arrow keys move between radio
   chips natively.
2. `<h4>2. Which time, and how far it moved</h4>`:
   - Two callout lines (`callout-best`, `callout-naive`): "Best available: ACT, Sat 15 Jun
     12:52 (bestAvailable)" and "Naive, latest recorded: EST, Sat 15 Jun 13:05". When the two
     picks are the same event, one line says so.
   - **The plot** (`drift-plot`, `role="img"`, `aria-labelledby="drift-summary"`): x is
     recorded-at, y is the predicted `at` (later at the top), fixed height 240px, width 100%.
     One mark per event, its shape by class (ACT filled diamond, PLN filled square, REQ
     triangle, EST hollow circle) plus a bevelled class chip (`PLN`/`EST`/`REQ`/`ACT`) placed by
     `placeLabel` so it never runs off the plot. The EST marks are joined in recording order by
     a thin line, with an arrow from the first to the last labelled `signedText(drift.drift)`.
     The best pick gets a solid ring and the label "best available"; the naive pick a dashed
     ring and "naive". When a tolerance is set, the band from the first EST's `at` − tolerance
     to + tolerance is a translucent horizontal band labelled "±8 h around the first estimate";
     its words, not a colour, say whether the last estimate is outside ("exceeds the tolerance:
     true", from `drift.exceedsTolerance`). x tick labels by `thinTickLabels`; at most five y
     tick labels from a nice step. Nothing in the plot is focusable.
   - Under the plot, the tolerance: a field grid with "Tolerance" (`tolerance`, text,
     `optional` chip) and "Drag the tolerance" (`rangeFieldHtml({ role: "tolerance-slider",
     min: 0, max: M, step: 15, value, valueText: "8 h", ends: ["0", "24 h"] })`, where `M` is
     1440 minutes, or `niceMinutes(1.5 × |drift|)` when that is larger). Dragging writes
     `minutesToIso(value)` into `tolerance`; typing moves the slider on `input` when
     `isoToMinutes` reads it. `syncRange()` on every `input` and after every value, `max` or
     `disabled` the code sets. aria-valuetext "Tolerance 8 hours, PT8H".
   - `drift-summary`: one sentence per event in recording order, then one for the drift.
   - A table (`event-table`): # | Class | At | Recorded | Note ("best available", "naive
     pick", "first EST", "last EST").
   - `reason-aside` for `driftNullReason`.
3. `<h4>3. What the calls return</h4>`: two code frames, `bestAvailable(events)` with
   `best-output` and `estimateDrift(events, { tolerance })` (the options argument omitted when
   blank) with `drift-output`, each `formatValue` or `NO SIGNAL`.

### ED4. `src/lib/eta-drift-mount.test.tsx` (jsdom, real gmt)

- For each preset: both printed calls, both outputs verbatim, both callout lines and the table's
  notes.
- `vessel-slide`: setting the slider to 540 gives `"PT9H"` in `tolerance` and
  `exceedsTolerance: false` (ED1a); 525 gives `"PT8H45M"` and `true` (ED1b); clearing
  `tolerance` gives `null` (ED1c).
- `est-after-act`: choosing the `EST` chip on event 3 gives ED2r (best is the PLN).
- `one-estimate`: `NO SIGNAL` for `estimateDrift` with the `one-estimate` reason.
- Typing `"ETA"`-shaped junk is impossible through the radios; a chat seed with an invalid `at`
  (`"2024-06-15T12:40:00"`) shows `NO SIGNAL` twice and the `invalid-event` reason (EDR2).
- The chat seed (the pill args, ED8) renders ED1.
- Two mounts in one document keep separate radio groups.
- The permalink round-trip, the abort and the double destroy.

### ED5 to ED7

- **Shell** `src/components/EtaDrift.astro`, `seedFromLocation("etadrift")`, `.gmt-eta-drift`.
- **Page** `tools/eta-drift.mdx`. Title "ETA Drift Chart". Description: "Which timestamp do
  you show, and how far did the estimate move? bestAvailable picks from planned, estimated,
  requested and actual records and says which class it is; estimateDrift measures the slide
  against a tolerance you drag." Intro (two short paragraphs: one field, four classes from
  DCSA's vocabulary, the class travels with the value; drift is first to last estimate, greater
  than the tolerance to exceed it), then `<EtaDrift />`. "Worth trying": PE1 (an estimate
  recorded after the actual), PE2 (exactly the tolerance). Reference:
  [`bestAvailable`](/reference/transport/calculate/bestAvailable/),
  [`estimateDrift`](/reference/transport/calculate/estimateDrift/), the guide sections
  `#one-field-four-meanings-bestavailable` and `#how-far-the-estimate-moved-estimatedrift`, and
  the scenario [An Estimate Shown as the Actual](/scenarios/estimate-shown-as-actual/).
- **CSS** `gmt-eta-drift.css`, `// ETA Drift Chart widget (TRAN-57)`.

### ED8. Chat registration

| Item | Value |
| --- | --- |
| Schema | `showEtaDriftInput = z.object({ events: z.array(z.object({ classifier: z.enum(["PLN", "EST", "REQ", "ACT"]), at: dateTimeSchema, recordedAt: dateTimeSchema })).min(1).max(6), tolerance: durationSchema.optional() })` |
| `purpose` | "Planned, estimated, requested and actual timestamps of one event plotted by when each was recorded: the best available pick from bestAvailable with its class beside the naive latest-recorded pick, and how far the estimate moved from estimateDrift, against an optional tolerance." |
| `when` | "the reader asks which of several planned, estimated, requested or actual times to show for an arrival or event, or how far an ETA or estimate moved between revisions" |
| `args` | "events (1 to 6, each a classifier PLN, EST, REQ or ACT, an at time and a recordedAt time, both ISO date-times with an offset or a bracketed zone), tolerance (optional ISO 8601 duration such as PT8H; exceedsTolerance is true only when the drift is greater than it)" |
| Worker | a trivial `execute` with no zone check, as `showIntervalVisualizer` |
| Registry | `etaDriftEntry`, `title: "ETA drift chart"`, `kind: "etadrift"`, no `validate` |
| Permalink | `etadrift: "/tools/eta-drift/"` |
| Starter | text "A ship ETA for 20 June 2024 (UTC) went 08:00, 12:00, 17:00 on 1, 5 and 10 June. Has it drifted past 8 hours?" (108 characters). args `{ events: E1 as three objects, tolerance: "PT8H" }`, with the comment "Each estimate recorded at midnight UTC on its date." Result: ED1. |

---

## DB. Departure Board: `/tools/departure-board/`, kind `departure`

Answers: which departure can I make, after the time it takes to connect? Root:
`<div class="gmt-departure-board gmt-widget not-content">`.

### DB1. `src/lib/departure-board.ts` (pure)

- `MAX_DEPARTURES = 6`. `BoardForm = "list" | "headway"`. `DepartureState = { form; after;
  minimumConnection; departureCount: string; departures: string[6]; headway; from; to;
  onwardDuration; onwardZone; onwardMode }`.
- `timetableOf(state)`: the visible non-blank list entries (`string[]`, in input order) or `{
  headway, from, to }`. `optionsOf(state)`: `{ minimumConnection }` when not blank, else
  `undefined` (the printed call omits it).
- `DEPARTURE_PRESETS`, in this order:

  | id | label | form, timetable | after | connection | onward | result |
  | --- | --- | --- | --- | --- | --- | --- |
  | `shuttle-headway` | A shuttle every 20 minutes from 06:00, a 10-minute connection | headway `SHUTTLE` | `AMS 06:12` | `PT10M` | `PT35M`, `Europe/Amsterdam`, `shuttle` | DB1, naive 06:20, hand-off DB1h |
  | `ferry-list` | Five ferries from Helsinki, a 45-minute connection | list `FERRY` (out of order) | `HEL 10:05` | `PT45M` | `PT2H`, `Europe/Tallinn`, `ferry` | DB2, naive 10:30, DB2h |
  | `arrival-at-to` | Arriving exactly at `to`: 09:00 is not a departure | headway `SHUTTLE` | `AMS 09:00` | blank | as 1 | DB3: `""`, empty |
  | `fall-back-hourly` | Hourly across New York's fall-back | headway `HOURLY` | `EDT 01:30` | blank | blank | DB4 |

  Descriptions:
  1. "An airport shuttle in Amsterdam leaves every 20 minutes from 06:00 until 09:00 on 15 June
     2024. You arrive at 06:12 and need 10 minutes to reach the stop, so the 06:20 is gone and
     you make the 06:40."
  2. "Ferries leave Helsinki at 07:30, 10:30, 13:00, 16:30 and 19:30 on 15 June 2024, listed
     out of order. Your train arrives at 10:05 and boarding takes 45 minutes, so you miss the
     10:30 and make the 13:00."
  3. "The same shuttle. You arrive at 09:00, the end of the service window. The window is
     half-open, [06:00, 09:00): the last shuttle left at 08:40, and 09:00 is never a
     departure. Drag the arrival back to 08:40 and you make it with no time to spare."
  4. "A service every hour from midnight on 3 November 2024, the night New York's clocks went
     back. Departures keep their spacing in exact time, so after 01:30 EDT the next one is
     01:00 EST, the second pass of the repeated hour."
- `readArgs(args)`: start from `args.preset` (known id) or the first preset. A `departures`
  array (the chat) sets `form: "list"` and the list; else a chat `headway` sets `form:
  "headway"` with `headway`, `from`, `to`; else flat keys (`form`, `departureCount`,
  `departure1…6`, `headway`, `from`, `to`). Scalars override: `after`, `minimumConnection`,
  `onwardDuration`, `onwardZone`, `onwardMode` (`"none"` → blank). A chat call has no `preset`:
  every field it does not give is blank.
- `matchPreset`, `permalinkOf` as in PB1 (preset form when the timetable equals a preset's:
  `{ preset }` plus every scalar that differs, `"none"` when cleared; else the flat form).
- `collectDepartureFacts(state, lib)`: `made = lib.nextDeparture(after, timetable, options)`,
  `naive = lib.nextDeparture(after, timetable)`.
- `departureNullReason(state, facts, lib)`, in this order, each a probe (rows DBR1–DBR7, N5):
  1. `after` blank → `no-arrival`: "No arrival time." Else `lib.nextDeparture(after, [after])
     === ""` → `invalid-after`: "The arrival has no offset. Every moment needs its offset (Z,
     +02:00, or a zoned string written with its offset): in a repeated fall-back hour a wall
     time names two instants."
  2. connection not blank and `lib.nextDeparture(after, [FAR], { minimumConnection }) === ""`,
     `FAR = "+275760-09-13T00:00:00Z"` → `invalid-connection`: "The minimum connection is not
     an exact duration that is zero or more. Write it as PT45M or PT1H30M: weeks, months and
     years have no fixed length."
  3. List form: the first visible non-blank entry `e` with `lib.nextDeparture(e, [e]) === ""` →
     `invalid-entry`: "Departure n has no offset, or its zone disagrees with its offset. One
     invalid entry makes the whole list return \"\"." Headway form: `from` or `to` failing the
     same self-probe → `invalid-from` / `invalid-to` (same wording); then
     `lib.nextDeparture(to, [from]) !== ""` → `empty-window`: "to must be after from: the
     window [from, to) is empty."; then `lib.nextDeparture(from, { headway, from, to }) === ""`
     → `invalid-headway`: "The headway is not an exact duration greater than zero, such as
     PT20M."
  4. Otherwise a `""` is a **correct empty answer**, not a sentinel: list form with no entries →
     `empty-list`: "An empty timetable has no departure."; list form → `none-left`: "No
     departure at or after {threshold}: the last one leaves before it."; headway form →
     `after-window`: "No departure at or after {threshold}: the window ends at {to}, and to
     itself is never a departure." `{threshold}` is the drawn threshold's `writtenLabel`, a
     label only.
- `handoffArgs(state, made)`: `null` when `made === ""` or `onwardDuration` or `onwardZone` is
  blank; else the Delivery Scheduler's flat permalink `{ legCount: "1", departure1: made,
  duration1: onwardDuration, timeZone1: onwardZone, mode1?: onwardMode }` (strings ≤ 64; the
  Delivery Scheduler's own `readArgs` reads these keys).
- `railWindow(state, facts)`: drawing only. List form: from the earliest of `after` and every
  valid entry to the latest of the threshold and every valid entry. Headway form: `[from, to]`
  when it is under 24 hours, else 3 hours either side of the threshold. Then padded 8%, at
  least 15 minutes each side, rounded outward to whole minutes.

### DB2. `src/lib/departure-board.test.ts`

`readArgs` (chat list, chat headway, flat keys, preset with overrides, `"none"`),
`timetableOf`, `optionsOf`, `matchPreset`, `permalinkOf` (both forms round-trip; ≤ 64),
`collectDepartureFacts` for every preset (DB1–DB4, both `made` and `naive`), DB1z, DB2l,
DB4b, each reason (DBR1, DBR2, DBR3, DBR4, DBR5, DBR6, DBR7) with the real call returning `""`
for it, the correct-empty reasons on DB3 and DB2l, `handoffArgs` (DB1h, DB2h, `null` cases),
`railWindow`.

### DB3. `src/lib/departure-board-mount.ts`

`renderDepartureBoardTemplate(args = {})` and `mountDepartureBoard(root, args, signal)`.

1. `<h4>1. The arrival and the timetable</h4>`:
   - Field grid: "Preset" (`gmt-field-wide`); the description.
   - A `.gmt-chip-group` fieldset (legend "Timetable") with two radio chips (per-mount `name`):
     "A list of departures" (`form`, value `list`) and "Every N minutes" (value `headway`).
   - Field grid: "Arrival" (`after`, text, `gmt-field-wide`), "Minimum connection"
     (`minimum-connection`, text, `optional` chip).
   - List form (`list-fields`, `hidden` in headway form): "Departures" (`departure-count`,
     select 1–6) and one text field per visible departure (`departure-1`…`departure-6`).
   - Headway form (`headway-fields`, `hidden` in list form): "Every" (`headway`), "From"
     (`from`), "To, excluded" (`to`).
   - Hint (full row): "Every time needs its offset: 2024-06-15T10:05:00+03:00, or a zoned
     string written with its offset."
2. `<h4>2. The departure you can make</h4>`:
   - The verdict (`verdict`, `.gmt-transport-verdict`, `aria-live="polite"`): "You make the
     13:00." (`writtenTime(made)`), or the correct-empty sentence, or nothing when invalid.
     Under it the naive line (`.gmt-transport-naive`): "Naive, with no connection time: the
     10:30." When `made === naive`: "The connection time changes nothing here."
   - **The rail** (`departure-rail`): an exact-time axis over `railWindow`, with local tick
     labels in the zone the arrival is written in (by `thinTickLabels`).
     - Departure ticks: list entries, or for a headway every `from + k × headway` inside the
       window (at most 60 drawn; past that, a patterned run labelled "every 1 min" and no
       ticks). `from` is a solid start bracket labelled "from". `to` is drawn as an **open end**:
       a hollow bracket labelled "to, excluded".
     - The departure the library returned (`made`) is lit: a solid tall marker and the label
       "made: 13:00". The naive one is a dashed outline labelled "naive". Labels placed by
       `placeLabel`/`pickLabelLeft`.
     - The connection bar: a hatched bar from `after` to the threshold, labelled "45 min to
       connect" (`durationText(minimumConnection)`), with `aria-hidden`.
     - The arrival handle `<div class="gmt-handle" role="slider" tabindex="0"
       data-role="handle-after" aria-label="Arrival">` on the rail. `aria-valuemin`/`max` are
       the window ends in minutes from the window start, `aria-valuenow` the arrival's,
       `aria-valuetext` "Arrival Sat 15 Jun 10:05". Dragging or a key writes the new arrival
       into `after` **in the arrival's own notation**: a bracketed zone stays that zone
       (`ZonedDateTime#toString()`), a numeric offset stays that offset, `Z` stays `Z`. Step 1
       minute; Shift and PageUp/PageDown 10; Home/End the window ends. The made departure and
       the verdict update live.
     - `rail-summary` (`.gmt-widget-hint`) states the arrival, the threshold, the made and the
       naive departure in words; the rail is `role="img"` labelled by it, apart from the handle.
   - `reason-aside` for `departureNullReason` (a caution aside for invalid input, a note aside
     for a correct empty answer).
3. `<h4>3. What <code>nextDeparture</code> returns</h4>`: two code frames, the real call
   (`nextDeparture(after, timetable, { minimumConnection })`) with `made-output` and the naive
   call (`nextDeparture(after, timetable)`) with `naive-output`. Each `"…"` literal,
   `NO SIGNAL` for an invalid `""`, or `""` in the empty state for a correct empty answer.
4. `<h4>4. Send it on</h4>`: a field grid with "Onward leg duration" (`onward-duration`),
   "Destination clock" (`onward-zone`, `.gmt-select` through `zoneOptionsHtml(TRANSPORT_ZONES,
   value)` with a blank "(not given)" option first) and "Mode" (`onward-mode`, `optional`
   chip). Then `<a class="gmt-button gmt-button--pad" data-role="handoff">Send to Delivery
   Scheduler</a>` whose `href` is `encodeWidgetPermalink("delivery", handoffArgs)`. When
   `handoffArgs` is `null`, the link has no `href`, `aria-disabled="true"`, and the hint says
   what is missing ("No departure to send." or "Give the onward leg's duration and destination
   clock."). Import `encodeWidgetPermalink` from `widget-permalink.ts` (it imports no zod).

### DB4. `src/lib/departure-board-mount.test.tsx` (jsdom, real gmt)

- For each preset: both printed calls, both outputs verbatim, the verdict and naive lines, and
  the handoff `href` decoded back to DB1h's and DB2h's keys (and absent on `fall-back-hourly`).
- `arrival-at-to`: the output is `""` in the **empty** state (no amber), the note aside says
  `after-window`; ArrowLeft ×20 on `handle-after` writes `"2024-06-15T08:40:00+02:00[Europe/Amsterdam]"`
  to `after` and the verdict reads "You make the 08:40." (DB3).
- `ferry-list`: End on the handle moves the arrival to the rail's end; the output is `""` in
  the empty state with the `none-left` note (the rule DB2l pins at 19:00). Then clearing the
  connection on the preset gives `made` = the 10:30 and "The connection time changes nothing
  here." (DB2's naive call).
- Switching the form chip to headway shows the headway fields and hides the list fields.
- Each invalid probe (DBR1, DBR2, DBR4, DBR5) shows `NO SIGNAL` and its caution reason.
- The chat seed (the pill args, DB8) renders DB2: "You make the 13:00."
- A pointer drag on the handle (stubbed rect) writes a minute-snapped `after`.
- The permalink round-trip, the abort and the double destroy.

### DB5 to DB7

- **Shell** `src/components/DepartureBoard.astro`, `seedFromLocation("departure")`,
  `.gmt-departure-board`.
- **Page** `tools/departure-board.mdx`. Title "Departure Board". Description: "Which
  departure can you make? nextDeparture reads a timetable list or a service every N minutes,
  after your arrival plus the minimum connection, with the end of the service window
  excluded, and hands the answer to the Delivery Scheduler." Intro (two short paragraphs: the
  threshold is the arrival plus the connection, and a departure exactly at it is made; a
  service every N minutes has the shape of a GTFS `frequencies.txt` row, and its `to` is never
  a departure), then `<DepartureBoard />`. "Worth trying": PD2 (arriving exactly at `to`),
  PD3 (the ferry list with no connection time). Reference:
  [`nextDeparture`](/reference/transport/calculate/nextDeparture/),
  [`scheduleDelivery`](/reference/transport/calculate/scheduleDelivery/), the guide section
  `#the-next-departure-you-can-make-nextdeparture`, and the
  [Connection Checker](/tools/connection-checker/) for one handoff's handling time.
- **CSS** `gmt-departure-board.css`, `// Departure Board widget (TRAN-57)`.

### DB8. Chat registration

| Item | Value |
| --- | --- |
| Schema | `showDepartureBoardInput = z.object({ after: dateTimeSchema, departures: z.array(dateTimeSchema).min(1).max(6).optional(), headway: durationSchema.optional(), from: dateTimeSchema.optional(), to: dateTimeSchema.optional(), minimumConnection: durationSchema.optional(), onwardDuration: durationSchema.optional(), onwardZone: zoneSchema.optional() })` |
| `purpose` | "A timetable on a time rail with the arrival as a draggable marker and the minimum connection as a hatched bar: the departure nextDeparture says the arrival can make, beside the naive pick with no connection time, with a service window's end excluded and a link to hand the result to the Delivery Scheduler." |
| `when` | "the reader asks which departure from a timetable, or from a service every N minutes, an arrival can still make after a connection or boarding time" |
| `args` | "after (the arrival: ISO date-time with an offset or a bracketed zone written with its offset), departures (1 to 6 departures, each with an offset) or headway with from and to (a service every headway, an ISO 8601 duration such as PT20M, from the first departure up to but never at to), minimumConnection (optional ISO 8601 duration such as PT45M), onwardDuration and onwardZone (optional: the next leg's duration and the IANA id of its destination, to hand the result to the Delivery Scheduler). Give either departures or headway, from and to." |
| Worker | `unknownZones(onwardZone ? [onwardZone] : [])` |
| Registry | `departureEntry`, `title: "Departure board"`, `kind: "departure"`, `validate` checks `onwardZone` when given |
| Permalink | `departure: "/tools/departure-board/"` |
| Starter | text "Helsinki ferries 07:30, 10:30, 13:00, 16:30, 19:30 on 15 June 2024. I arrive 10:05, need 45 min. Which one?" (107 characters). args `{ after: "2024-06-15T10:05:00+03:00[Europe/Helsinki]", departures: [the five FERRY entries in time order], minimumConnection: "PT45M" }`, with the comment "Helsinki is UTC+3 in June. The pill lists the ferries in time order; the ferry-list preset lists them out of order to show any order works." Result: DB2 (`made` 13:00, naive 10:30). |

---

## X. Registration common to all three

Each item is guarded by the named test.

- `dox-tools.ts`: the three schemas, three `DoxToolName` members, `DOX_TOOL_INPUTS`, three
  `DOX_TOOL_DOCS` entries after `showCutoffCountdown`, three `DOX_TOOLS` entries (indices 14,
  15, 16), and `ENABLED_TOOL_NAMES`. (`widget-registry.test.ts`, `chat-handler.test.ts`)
- `worker/tools.ts`: three tools with a trivial `execute`, as `showCrossingClock`; the
  Departure Board's checks `onwardZone` with `unknownZones`. (`tools.test.ts`)
- `components/ask/widget-registry.ts`: three `import type` lines (never a value import) and
  three entries. (`widget-registry.test.ts`, `widget-graph.test.ts`)
- `widget-permalink.ts`: three `WidgetKind` members (`punctuality`, `etadrift`, `departure`)
  and paths. (`widget-permalink.test.ts`, whose content test checks every permalink in
  section P)
- `chat-constants.ts`: three `CHAT_STARTERS` after the Cut-off Countdown's.
  (`chat-starters.test.ts`: under 110 characters, a digit, no tool name, the seed passes the
  schema and `validate`)
- **Manual lists, which fail nothing when forgotten:**
  - `lib/widget-load-error.test.tsx` `MOUNTS`: the three mounts ("punctuality board", "eta
    drift chart", "departure board").
  - `components/ask/widget-graph.test.ts` heavy list: `lib/punctuality-widgets.ts`,
    `lib/punctuality-lib.ts`, `lib/punctuality-board.ts`, `lib/eta-drift.ts`,
    `lib/departure-board.ts`.
  - `scripts/html-diff.mjs` `PAGES`: `{ path: "tools/punctuality-board", widget:
    "gmt-punctuality-board gmt-widget" }`, then `eta-drift` (`"gmt-eta-drift gmt-widget"`) and
    `departure-board` (`"gmt-departure-board gmt-widget"`), after the Cut-off Countdown.
  - `scripts/visual-snapshot.mjs` `PAGES`: `tool-punctuality-board`, `tool-eta-drift`,
    `tool-departure-board`, after `tool-cutoff-countdown`.
- `astro.config.mjs` `customCss`: `gmt-punctuality-widgets.css` then the three tool sheets,
  after `gmt-cutoff-countdown.css`. `optimizeDeps.entries` already globs `src/lib/**/*.ts`;
  confirm, no change.
- `gmt-transport-widgets.css`: the three roots in the `container-type` root list.

## P. Permalinks

All three tools share one flat shape, strings only, each 1–64 characters, read by
`seedFromLocation`:

- **Preset form** (every content link): `{ "preset": "<id>" }` plus any scalar that differs from
  the preset. `"none"` clears an optional scalar.
- **List form** (a chat-seeded or edited list, so the rail's copy-permalink reproduces what the
  reader sees): numbered keys (`pairCount`, `planned1`…; `eventCount`, `classifier1`…;
  `form`, `departureCount`, `departure1`…) plus the scalars, with no `preset` key.

| id | kind | JSON | shows |
| --- | --- | --- | --- |
| PB1 | punctuality | `{"preset":"fifteen-minute","early":"PT10M"}` | PB1e: 3 of 6, row 6 early |
| PB2 | punctuality | `{"preset":"fall-back"}` | PB4 with the naive line PB4n |
| PB3 | punctuality | `{"preset":"sixty-and-120"}` | PB2a and PB2b side by side |
| PE1 | etadrift | `{"preset":"est-after-act"}` | ED2 |
| PE2 | etadrift | `{"preset":"vessel-slide","tolerance":"PT9H"}` | ED1a: `exceedsTolerance: false` |
| PD1 | departure | `{"preset":"ferry-list"}` | DB2 |
| PD2 | departure | `{"preset":"arrival-at-to"}` | DB3: `""`, the empty state |
| PD3 | departure | `{"preset":"ferry-list","minimumConnection":"none"}` | made 10:30, naive 10:30 |

`widget-permalink.test.ts`'s content test reads every `?w=` link in the content and checks
each key survives `seedFromLocation`; confirm it covers these.

---

## D. Definition of done (`dox-tester`: run each line literally)

`$WT` is `/Users/craigcurtis/workbench/northguild/gmt.worktrees/feature/259-tran-57-schedule-deviation-punctuality-plnestreqact-nextdeparture`.
`$SP` is `/private/tmp/claude-501/-Users-craigcurtis-workbench-northguild-gmt-worktrees-feature-259-tran-57-schedule-deviation-punctuality-plnestreqact-nextdeparture/3c2a50e7-e634-4143-a3b8-fdc70ab56f9b/scratchpad`.
Prefix every Node command with `eval "$(fnm env)" && fnm use &&`.

1. `pnpm -C $WT --filter @gmt/dox test` passes (it runs `generate`), including the seven new
   test files and `widget-ui`, `widget-registry`, `chat-starters`, `widget-permalink` (with the
   content-permalink test), `widget-graph`, `client-graph`, `lib-module-graph`,
   `widget-load-error`, `font-floor`, `date-ban`, `chat-handler` and `tools.test.ts`.
2. `pnpm -C $WT --filter @gmt/dox check` reports 0 errors, then
   `pnpm -C $WT --filter @gmt/dox lint` passes.
3. From `$WT`: `node scripts/api-surface.mjs check` exits 0, and `node scripts/stats.mjs check`
   exits 0. `api-surface.mjs show` lists the new guide's, scenarios' and mistakes' examples as
   checked, not skipped.
4. **Every value against dist.** `DIST=$WT/packages/gmt/dist node $SP/tran57-values.mjs` prints
   `all ok`, and again with `TZ=America/Los_Angeles` and `TZ=Asia/Tokyo`. Then list every
   expected literal in the seven new test files and in the new content and confirm each matches
   an appendix Z row or a JSDoc `@example`. A result in neither fails. If a row fails, stop and
   report; never edit the script to match.
5. `pnpm -C $WT --filter @gmt/dox build` succeeds.
6. **Internal links.** From `$WT/apps/dox` after the build, run the
   `context/dox/specs/int-58-billing-deadlines.md` section 10 script with
   `tools/punctuality-board tools/eta-drift tools/departure-board
   guides/industries/transport-punctuality-and-timestamps guides/industries/transport-multi-leg-scheduling
   guides/industries guides scenarios/estimate-shown-as-actual scenarios/delay-across-fall-back
   scenarios mistakes/transport mistakes`. It prints nothing and exits 0. Check the seven guide
   ids in A1 exist in the built guide, and `id="punctuality-and-timestamps"` in the built
   mistakes page.
7. **Structural and pixel gates.** Baselines were captured by `dox-architect` from this tree
   before any Part B change: `$SP/html-baseline` for `html-diff`, and
   `$WT/apps/dox/.visual/before` for `visual:diff` (the control-system baselines were moved to
   `.visual/before-control-system` and `.visual/after-control-system`; leave them). Do not
   recapture.

   ```sh
   lsof -iTCP:48173 -sTCP:LISTEN   # must print nothing
   (cd $WT/apps/dox && node scripts/html-diff.mjs compare $SP/html-baseline; pnpm visual:after; pnpm visual:diff)
   ```

   - **Expected `html-diff`:** `+` for the three new tool pages; `~` or `✓` for every other
     page. `✗` anywhere is a regression.
   - **Expected `visual:diff`:** `MISSING (no before)` for the three new tool shots. `✗` only
     where the before/after PNGs show nothing changed but the Tools sidebar group (three new
     rows) or the `/dox` starter pills (three new pills). Open each pair and list them. Any
     other `✗` is a regression.
8. **Visual capture of the new pages.** With `astro preview` on port 48173, a scratch
   Playwright script (in `$SP`, not the repo) screenshots, at 1440×900 and 390×844 in both
   themes, full page: the three tool pages, the guide, both scenarios and
   `/mistakes/transport/#punctuality-and-timestamps`. Save to
   `$WT/apps/dox/.visual/tran57/<slug>-<theme>-<viewport>.png`. Review each by eye: nothing
   overlaps, every label row lines up, no text is clipped, nothing is amber except a
   `NO SIGNAL`.
9. **Phone width and overlap sweep.** At 390×844 on each tool page and each preset:
   `document.documentElement.scrollWidth <= window.innerWidth`; in every `.gmt-field-grid` the
   labels of one rendered row share a `.gmt-label-text` top and a control top (±1px); no two
   visible text boxes inside the board, plot or rail intersect (compare the bounding rects of
   every visible label, tick and chip; ignore hidden thinned ticks). `/dox`'s empty screen with
   its pills fits at 390.
10. **Handles in Chromium and WebKit.** Playwright, both engines, `/tools/punctuality-board/`:
    drag `handle-late` from 15 to 16 minutes on `fifteen-minute` and confirm row 3 turns from
    "late" to "on time" and the header from 4 to 5 of 6; drag `handle-early` (after switching
    early on) and confirm row 6 turns "early" at 10 minutes. Element screenshots of the track
    at rest, focused and mid-drag in each engine to `$WT/apps/dox/.visual/engines/<engine>-punctuality-<state>.png`.
    Repeat the drag check for the Departure Board's arrival handle and the ETA Drift Chart's
    range. **Firefox cannot launch on this machine:** record it as blocked; do not try to
    bypass the sandbox.
11. **Keyboard-only pass** on each tool page and in the `/dox` rail through each new pill: Tab
    reaches every control in visual order and nothing inside a board, plot or rail except the
    handles; Arrow, Shift+Arrow, PageUp/PageDown and Home/End move each handle and the range;
    each handle's typed field moves it; Space selects each chip; the focus ring is visible in
    both themes. Punctuality Board: ArrowRight on the late handle flips row 3 to "on time".
    ETA Drift Chart: the slider at 9 h gives `exceedsTolerance: false`. Departure Board: the
    arrival handle to 08:40 on `arrival-at-to` gives "You make the 08:40."
12. **Contrast** ≥ 7:1 in both themes for labels, rate header, row text, class words, callouts,
    plot chips, axis and tick labels, rail labels, verdicts, outputs, and text over the band.
13. **`forced-colors: active`** (Chromium emulation): the band and its edges, bars and their
    hatches, handles, plot marks and rings, the connection bar, the made and naive departures,
    the open end, checked and unchecked chips, and every focus ring stay distinguishable.
    Screenshot to `$WT/apps/dox/.visual/engines/chromium-forced-<tool>.png`.
    **`prefers-reduced-motion: reduce`:** nothing animates on focus or while dragging.
14. **Droppability.** No new tool page loads a `zod`, `ai` or `dox-tools` chunk (built-chunk or
    network inspection).
15. **Law grep** prints nothing:
    `grep -rniE "CFR|EU261|statut|regulat|docket" $WT/apps/dox/src/content/docs/tools/punctuality-board.mdx $WT/apps/dox/src/content/docs/tools/eta-drift.mdx $WT/apps/dox/src/content/docs/tools/departure-board.mdx $WT/apps/dox/src/content/docs/guides/industries/transport-punctuality-and-timestamps.mdx $WT/apps/dox/src/content/docs/scenarios/estimate-shown-as-actual.mdx $WT/apps/dox/src/content/docs/scenarios/delay-across-fall-back.mdx $WT/apps/dox/src/lib/punctuality-*.ts $WT/apps/dox/src/lib/eta-drift*.ts $WT/apps/dox/src/lib/departure-board*.ts`,
    plus the new `<Mistake>` blocks of `mistakes/transport.mdx` and the three new
    `DOX_TOOL_DOCS` and `CHAT_STARTERS` entries checked by eye. This grep is scoped to law
    terms, unlike the TRAN-9 and TRAN-10 specs, because `tracker.md:312` allows DCSA and GTFS
    `frequencies.txt` to be named here.
16. `pnpm -C $WT run validate` is green.
17. `git -C $WT status --short` shows nothing staged, no change under `packages/gmt`,
    `.changeset` or `context/domination` from this work, and only the files in section F under
    `apps/dox`.

---

## E. Risks and plan corrections

- **R1. The plan's permalink line ("a preset id plus scalar overrides; lists come from
  presets") cannot carry a chat-seeded list.** The rail's copy-permalink encodes the live state
  (`WidgetRail.tsx`), so a chat call with its own pairs, events or departures would be lost.
  *Resolution:* section P. Every content link uses the preset form exactly as planned; the flat
  list form exists only for state that no preset holds. Both are flat strings.
- **R2. `cutoff-widgets.ts` `callSource` drops keys it does not know.** Its `keyOrderFor`
  falls back to the cut-off options' key list, so any other object prints as `{ }`.
  *Resolution:* T0.1 `formatValue`/`callArgs` with their own key table; `cutoff-widgets.ts` is
  not changed.
- **R3. `""` from `nextDeparture` means two things.** Invalid input and "no departure
  qualifies" return the same string. *Resolution:* the probes in DB1 decide, and a valid empty
  answer renders as empty, never amber.
- **R4. `estimateDrift`'s `null` with one EST is not invalid input**, but the library uses its
  sentinel. *Resolution:* `NO SIGNAL`, as the generated playground shows it, with the
  `one-estimate` reason saying why.
- **R5. Rows on the Punctuality Board are not editable.** The tolerance is the manipulation;
  rows come from presets, the chat or a permalink. A reader's own data reaches the board through
  the chat. Editing rows is not in the plan.
- **R6. Seventeen starter pills on `/dox`.** D9 checks phone width. Trimming pills is an owner
  decision.
- **R7. Chat tool overlap.** `showDepartureBoard` sits near `showConnectionChecker`;
  `showEtaDrift` near nothing. *Resolution:* the `when` lines say "which departure from a
  timetable" against "is this one handoff made". Probing brains spends quota; offer
  `scripts/probe-brains.ts` to the owner after merge.
- **R8. Radio groups in two mounts.** A tool page and the `/dox` rail can both hold a widget;
  a shared radio `name` would make them one group. *Resolution:* a per-mount suffix on every
  radio `name` (ED3, DB3).
- **R9. The visual harness does not capture guides or scenarios.** *Resolution:* D8's scratch
  capture.
- **R10. Firefox cannot launch on this machine.** The three-engine dragger check of the
  control-system spec becomes Chromium and WebKit here; Firefox is recorded as blocked.
- **R11. Documentation drift found while planning.** (1) `built.md` § Tier 2 says the cut-off
  helpers in `cutoff-widgets.ts` are shared, which is true, but `callSource` is cut-off-specific
  (R2). (2) `scenarios/index.mdx` is generated, which `built.md` § Tier 5 does not say. The
  architect corrects both at close-out.

## Blocked on the library pipeline

Nothing. Every value in appendix Z passes against the final source.

---

## F. Files

**Create** (under `apps/dox/`):

- Shared: `src/lib/punctuality-widgets.ts`, `src/lib/punctuality-widgets.test.ts`,
  `src/lib/punctuality-lib.ts`, `src/styles/gmt-punctuality-widgets.css`.
- For each of `punctuality-board`, `eta-drift` and `departure-board`: `src/lib/<name>.ts`,
  `src/lib/<name>.test.ts`, `src/lib/<name>-mount.ts`, `src/lib/<name>-mount.test.tsx`,
  `src/components/<Name>.astro` (`PunctualityBoard`, `EtaDrift`, `DepartureBoard`),
  `src/content/docs/tools/<name>.mdx`, `src/styles/gmt-<name>.css`.
- Content: `src/content/docs/guides/industries/transport-punctuality-and-timestamps.mdx`,
  `src/content/docs/scenarios/estimate-shown-as-actual.mdx`,
  `src/content/docs/scenarios/delay-across-fall-back.mdx`.

**Modify:**

- Content (under `src/content/docs/`): `guides/industries/transport-multi-leg-scheduling.mdx`,
  `guides/index.mdx`, `guides/industries/index.mdx`, `mistakes/transport.mdx`,
  `mistakes/index.mdx`.
- `src/lib/dox-tools.ts`, `src/lib/chat-constants.ts`, `src/lib/widget-permalink.ts`,
  `src/lib/widget-load-error.test.tsx`; `src/lib/widget-ui.ts` and `widget-ui.test.ts` only if a
  primitive is missing (say so).
- `src/components/ask/widget-registry.ts`, `src/components/ask/widget-graph.test.ts`,
  `worker/tools.ts`.
- `src/styles/gmt-a11y.css`, `src/styles/gmt-transport-widgets.css` (root list only),
  `src/styles/gmt-cutoff-widgets.css` (selector lists only, if a tick rule is reused),
  `src/styles/gmt-form-controls.css` only if a primitive is missing, `astro.config.mjs`.
- `scripts/html-diff.mjs`, `scripts/visual-snapshot.mjs`.
- Generated by `generate` (keep the diff): `src/generated/reference/gmt-corpus.json`,
  `src/generated/reference/route-manifest.ts`, `src/data/gmt-stats.json` if `stats:sync` moves.
- Context (architect only): `context/dox/built.md`, `context/dox/reference/design-system.md` if
  a primitive was added, `context/domination/issues/TRAN-57.md` § Docs-site scope, this spec.

---

## Appendix Z. The values script (`$SP/tran57-values.mjs`)

Run: `DIST=$WT/packages/gmt/dist node $SP/tran57-values.mjs`. It prints `ok <id>` per row
and `all ok`, or exits 1 on any `FAIL`. The script is saved at that path; this is its content.

```js
// tran57-values.mjs — every value the TRAN-57 Dox guide, scenarios, mistakes and tools show.
// Run: DIST=<path to packages/gmt/dist> node tran57-values.mjs   (prints `ok <id>` per row; exit 1 on any FAIL)
const DIST = process.env.DIST;
const { scheduleDeviation, classifyPunctuality } = await import(`${DIST}/transport/compare/index.js`);
const { punctualityRate, bestAvailable, estimateDrift, nextDeparture, scheduleDelivery } = await import(`${DIST}/transport/calculate/index.js`);
let failed = 0;
const eq = (id, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) console.log(`ok ${id}`); else { failed++; console.log(`FAIL ${id}\n  got  ${g}\n  want ${w}`); }
};
const LON = (t) => `2024-06-14T${t}+01:00[Europe/London]`;
const AMS = (t) => `2024-06-15T${t}+02:00[Europe/Amsterdam]`;
const SIN = (d, t) => `2024-06-${d}T${t}+08:00[Asia/Singapore]`;
const EDT = (t) => `2024-11-03T${t}-04:00[America/New_York]`;
const EST_ = (t) => `2024-11-03T${t}-05:00[America/New_York]`;
const HEL = (t) => `2024-06-15T${t}+03:00[Europe/Helsinki]`;
const board = (rows, tol) => [rows.map(([p, a]) => [scheduleDeviation(p, a), classifyPunctuality(p, a, tol)]), punctualityRate(rows.map(([planned, actual]) => ({ planned, actual })), tol)];

// ===== Punctuality Board (scheduleDeviation, classifyPunctuality, punctualityRate)
const P15 = [[LON("08:00:00"), LON("08:05:00")], [LON("08:30:00"), LON("08:44:59")], [LON("09:00:00"), LON("09:15:00")], [LON("09:30:00"), LON("09:47:00")], [LON("10:00:00"), LON("09:57:00")], [LON("10:30:00"), LON("10:18:00")]];
eq("PB1 fifteen-minute", board(P15, { late: "PT15M" }), [
  [["PT5M", "onTime"], ["PT14M59S", "onTime"], ["PT15M", "late"], ["PT17M", "late"], ["-PT3M", "onTime"], ["-PT12M", "onTime"]],
  { onTime: 4, total: 6, rate: 0.6666666666666666 }]);
eq("PB1e with a 10-minute early tolerance", board(P15, { late: "PT15M", early: "PT10M" }), [
  [["PT5M", "onTime"], ["PT14M59S", "onTime"], ["PT15M", "late"], ["PT17M", "late"], ["-PT3M", "onTime"], ["-PT12M", "early"]],
  { onTime: 3, total: 6, rate: 0.5 }]);
eq("PB1d dragged to 16 minutes: the boundary row flips", classifyPunctuality(LON("09:00:00"), LON("09:15:00"), { late: "PT16M" }), "onTime");
eq("PB1d2 the rate at 16 minutes", board(P15, { late: "PT16M" })[1], { onTime: 5, total: 6, rate: 0.8333333333333334 });
eq("PB1z late PT0S: nothing at or after the plan is on time", board(P15, { late: "PT0S" })[1], { onTime: 2, total: 6, rate: 0.3333333333333333 });
eq("PB1y early PT0S, late PT15M: the plan itself is early", classifyPunctuality(LON("09:00:00"), LON("09:00:00"), { late: "PT15M", early: "PT0S" }), "early");
eq("PB1h dragged tolerance written in hours", board(P15, { late: "PT1H30M" })[1], { onTime: 6, total: 6, rate: 1 });

const P60 = [[AMS("07:00:00"), AMS("07:30:00")], [AMS("08:00:00"), AMS("08:59:00")], [AMS("09:00:00"), AMS("10:00:00")], [AMS("10:00:00"), AMS("11:35:00")], [AMS("11:00:00"), AMS("13:00:00")], [AMS("12:00:00"), AMS("14:30:00")]];
eq("PB2a 60-minute", board(P60, { late: "PT60M" }), [
  [["PT30M", "onTime"], ["PT59M", "onTime"], ["PT1H", "late"], ["PT1H35M", "late"], ["PT2H", "late"], ["PT2H30M", "late"]],
  { onTime: 2, total: 6, rate: 0.3333333333333333 }]);
eq("PB2b 120-minute, side by side", board(P60, { late: "PT120M" }), [
  [["PT30M", "onTime"], ["PT59M", "onTime"], ["PT1H", "onTime"], ["PT1H35M", "onTime"], ["PT2H", "late"], ["PT2H30M", "late"]],
  { onTime: 4, total: 6, rate: 0.6666666666666666 }]);

const PDAY = [[SIN("10", "06:00:00"), SIN("08", "18:00:00")], [SIN("12", "06:00:00"), SIN("11", "06:00:00")], [SIN("14", "06:00:00"), SIN("14", "00:00:00")], [SIN("16", "06:00:00"), SIN("17", "02:00:00")], [SIN("18", "06:00:00"), SIN("19", "06:00:00")], [SIN("20", "06:00:00"), SIN("23", "06:00:00")]];
eq("PB3 day-based", board(PDAY, { late: "P1D", early: "P1D" }), [
  [["-PT36H", "early"], ["-PT24H", "early"], ["-PT6H", "onTime"], ["PT20H", "onTime"], ["PT24H", "late"], ["PT72H", "late"]],
  { onTime: 2, total: 6, rate: 0.3333333333333333 }]);
eq("PB3h the same tolerance dragged, written PT24H", board(PDAY, { late: "PT24H", early: "PT24H" })[1], { onTime: 2, total: 6, rate: 0.3333333333333333 });

const PFB = [[EDT("01:30:00"), EST_("01:30:00")], [EDT("01:50:00"), EST_("01:05:00")], [EDT("00:45:00"), EDT("01:10:00")], [EST_("01:40:00"), EST_("01:50:00")]];
eq("PB4 fall-back", board(PFB, { late: "PT15M" }), [
  [["PT1H", "late"], ["PT15M", "late"], ["PT25M", "late"], ["PT10M", "onTime"]],
  { onTime: 1, total: 4, rate: 0.25 }]);
// The naive column: the same wall times read with no offset, as if both were on one clock.
const wall = (s) => `${s.slice(0, 19)}Z`;
eq("PB4n naive wall-clock reading", board(PFB.map(([p, a]) => [wall(p), wall(a)]), { late: "PT15M" }), [
  [["PT0S", "onTime"], ["-PT45M", "onTime"], ["PT25M", "late"], ["PT10M", "onTime"]],
  { onTime: 3, total: 4, rate: 0.75 }]);

// Pill and reasons
eq("PBP pill: due 09:00, arrived 09:15", board([[LON("09:00:00"), LON("09:15:00")]], { late: "PT15M" }), [[["PT15M", "late"]], { onTime: 0, total: 1, rate: 0 }]);
eq("PBR1 weeks tolerance", [classifyPunctuality(LON("09:00:00"), LON("09:00:00"), { late: "P1W" }), punctualityRate([{ planned: LON("09:00:00"), actual: LON("09:00:00") }], { late: "P1W" })], [null, null]);
eq("PBR2 negative tolerance", classifyPunctuality(LON("09:00:00"), LON("09:00:00"), { late: "-PT15M" }), null);
eq("PBR3 not a duration", classifyPunctuality(LON("09:00:00"), LON("09:00:00"), { late: "15 min" }), null);
eq("PBR4 bad early only", classifyPunctuality(LON("09:00:00"), LON("09:00:00"), { late: "PT15M", early: "P1M" }), null);
eq("PBR5 zoneless actual", [scheduleDeviation(LON("09:00:00"), "2024-06-14T09:15:00"), classifyPunctuality(LON("09:00:00"), "2024-06-14T09:15:00", { late: "PT15M" })], ["", null]);
eq("PBR6 one bad pair voids the rate", punctualityRate([{ planned: LON("09:00:00"), actual: LON("09:05:00") }, { planned: LON("09:00:00"), actual: "2024-06-14T09:15:00" }], { late: "PT15M" }), null);
eq("PBR7 empty list", punctualityRate([], { late: "PT15M" }), null);

// ===== ETA Drift Chart (bestAvailable, estimateDrift); the naive pick is the latest recordedAt, any class
const ev = (classifier, at, recordedAt) => ({ classifier, at, recordedAt });
const naive = (events) => events.reduce((a, e) => (Date.parse(e.recordedAt) >= Date.parse(a.recordedAt) ? e : a));
const E1 = [ev("EST", "2024-06-20T08:00:00Z", "2024-06-01T00:00:00Z"), ev("EST", "2024-06-20T12:00:00Z", "2024-06-05T00:00:00Z"), ev("EST", "2024-06-20T17:00:00Z", "2024-06-10T00:00:00Z")];
eq("ED1 vessel slides 9 h against 8 h", [bestAvailable(E1), estimateDrift(E1, { tolerance: "PT8H" }), naive(E1).at], [
  { at: "2024-06-20T17:00:00Z", classifier: "EST" },
  { first: "2024-06-20T08:00:00Z", last: "2024-06-20T17:00:00Z", drift: "PT9H", revisions: 3, exceedsTolerance: true },
  "2024-06-20T17:00:00Z"]);
eq("ED1a tolerance exactly 9 h: not greater", estimateDrift(E1, { tolerance: "PT9H" }).exceedsTolerance, false);
eq("ED1b tolerance 8 h 45 min", estimateDrift(E1, { tolerance: "PT8H45M" }).exceedsTolerance, true);
eq("ED1c no tolerance", estimateDrift(E1).exceedsTolerance, null);
eq("ED1d tolerance 0", estimateDrift(E1, { tolerance: "PT0S" }).exceedsTolerance, true);
const E2 = [ev("PLN", "2024-06-15T12:00:00Z", "2024-06-01T00:00:00Z"), ev("EST", "2024-06-15T12:40:00Z", "2024-06-14T00:00:00Z"), ev("ACT", "2024-06-15T12:52:00Z", "2024-06-15T12:53:00Z"), ev("EST", "2024-06-15T13:05:00Z", "2024-06-15T14:00:00Z")];
eq("ED2 an estimate recorded after the actual", [bestAvailable(E2), estimateDrift(E2), naive(E2)], [
  { at: "2024-06-15T12:52:00Z", classifier: "ACT" },
  { first: "2024-06-15T12:40:00Z", last: "2024-06-15T13:05:00Z", drift: "PT25M", revisions: 2, exceedsTolerance: null },
  ev("EST", "2024-06-15T13:05:00Z", "2024-06-15T14:00:00Z")]);
eq("ED2r reclassify the ACT row as EST: three revisions", (() => { const e = E2.map((x) => ({ ...x })); e[2].classifier = "EST"; return [bestAvailable(e), estimateDrift(e)]; })(), [
  { at: "2024-06-15T12:00:00Z", classifier: "PLN" },
  { first: "2024-06-15T12:40:00Z", last: "2024-06-15T13:05:00Z", drift: "PT25M", revisions: 3, exceedsTolerance: null }]);
const E3 = [ev("EST", "2024-06-15T12:40:00Z", "2024-06-14T00:00:00Z"), ev("REQ", "2024-06-15T12:30:00Z", "2024-06-12T00:00:00Z"), ev("EST", "2024-06-15T12:45:00Z", "2024-06-14T06:00:00Z")];
eq("ED3 a request beats a later estimate", [bestAvailable(E3), estimateDrift(E3, { tolerance: "PT15M" }), naive(E3)], [
  { at: "2024-06-15T12:30:00Z", classifier: "REQ" },
  { first: "2024-06-15T12:40:00Z", last: "2024-06-15T12:45:00Z", drift: "PT5M", revisions: 2, exceedsTolerance: false },
  ev("EST", "2024-06-15T12:45:00Z", "2024-06-14T06:00:00Z")]);
const E4 = [ev("PLN", "2024-06-15T12:00:00Z", "2024-06-01T00:00:00Z"), ev("EST", "2024-06-15T12:40:00Z", "2024-06-14T00:00:00Z")];
eq("ED4 one estimate: no drift", [bestAvailable(E4), estimateDrift(E4, { tolerance: "PT15M" }), naive(E4).classifier], [{ at: "2024-06-15T12:00:00Z", classifier: "PLN" }, null, "EST"]);
// Reasons the widget probes
eq("EDR1 unknown classifier", [bestAvailable([ev("ETA", "2024-06-15T12:40:00Z", "2024-06-14T00:00:00Z")]), estimateDrift([ev("ETA", "2024-06-15T12:40:00Z", "2024-06-14T00:00:00Z"), ...E1])], [null, null]);
eq("EDR2 zoneless at", bestAvailable([ev("EST", "2024-06-15T12:40:00", "2024-06-14T00:00:00Z")]), null);
eq("EDR3 weeks tolerance", estimateDrift(E1, { tolerance: "P1W" }), null);
eq("EDR4 empty", [bestAvailable([]), estimateDrift([])], [null, null]);
eq("EDR5 probe: one event alone", [bestAvailable([E1[0]]), bestAvailable([ev("EST", "2024-06-20T08:00:00Z", "yesterday")])], [{ at: "2024-06-20T08:00:00Z", classifier: "EST" }, null]);
eq("EDR6 recordedAt tie goes to the later index", bestAvailable([ev("EST", "2024-06-15T12:40:00Z", "2024-06-14T00:00:00Z"), ev("EST", "2024-06-15T12:50:00Z", "2024-06-14T00:00:00Z")]), { at: "2024-06-15T12:50:00Z", classifier: "EST" });
eq("EDR7 moved earlier, JSDoc", estimateDrift([ev("EST", "2024-06-20T17:00:00Z", "2024-06-01T00:00:00Z"), ev("EST", "2024-06-20T08:00:00Z", "2024-06-10T00:00:00Z")], { tolerance: "PT8H" }), { first: "2024-06-20T17:00:00Z", last: "2024-06-20T08:00:00Z", drift: "-PT9H", revisions: 2, exceedsTolerance: true });

// ===== Departure Board (nextDeparture; the naive pick is the same call without minimumConnection)
const SHUTTLE = { headway: "PT20M", from: AMS("06:00:00"), to: AMS("09:00:00") };
eq("DB1 shuttle every 20 min, 10-min connection", [nextDeparture(AMS("06:12:00"), SHUTTLE, { minimumConnection: "PT10M" }), nextDeparture(AMS("06:12:00"), SHUTTLE)], [AMS("06:40:00"), AMS("06:20:00")]);
eq("DB1h hand-off to the Delivery Scheduler", scheduleDelivery([{ departure: AMS("06:40:00"), duration: "PT35M", timeZone: "Europe/Amsterdam", mode: "shuttle" }]), { eta: AMS("07:15:00"), legTimes: [{ arrival: "2024-06-15T05:15:00Z", localArrival: AMS("07:15:00"), dwellAfter: "PT0S", mode: "shuttle" }] });
eq("DB1z the threshold is a departure: made with zero slack", nextDeparture(AMS("06:10:00"), SHUTTLE, { minimumConnection: "PT10M" }), AMS("06:20:00"));
const FERRY = [HEL("16:30:00"), HEL("07:30:00"), HEL("10:30:00"), HEL("13:00:00"), HEL("19:30:00")];
eq("DB2 ferry list, 45-min connection", [nextDeparture(HEL("10:05:00"), FERRY, { minimumConnection: "PT45M" }), nextDeparture(HEL("10:05:00"), FERRY)], [HEL("13:00:00"), HEL("10:30:00")]);
eq("DB2h hand-off: a two-hour crossing", scheduleDelivery([{ departure: HEL("13:00:00"), duration: "PT2H", timeZone: "Europe/Tallinn", mode: "ferry" }]).eta, "2024-06-15T15:00:00+03:00[Europe/Tallinn]");
eq("DB2l after the last ferry", nextDeparture(HEL("19:00:00"), FERRY, { minimumConnection: "PT45M" }), "");
eq("DB3 arrival exactly at to", [nextDeparture(AMS("09:00:00"), SHUTTLE), nextDeparture(AMS("08:40:00"), SHUTTLE), nextDeparture(AMS("08:41:00"), SHUTTLE)], ["", AMS("08:40:00"), ""]);
const HOURLY = { headway: "PT1H", from: EDT("00:00:00"), to: EST_("04:00:00") };
eq("DB4 hourly across the fall-back (JSDoc)", nextDeparture(EDT("01:30:00"), HOURLY), EST_("01:00:00"));
eq("DB4b the repeated hour's first pass", nextDeparture(EDT("00:30:00"), HOURLY), EDT("01:00:00"));
// Reasons the widget probes (each "" is invalid input, not an empty answer)
eq("DBR1 zoneless after", nextDeparture("2024-06-15T10:05:00", FERRY), "");
eq("DBR1p probe after against itself", [nextDeparture(HEL("10:05:00"), [HEL("10:05:00")]), nextDeparture("2024-06-15T10:05:00", ["2024-06-15T10:05:00"])], [HEL("10:05:00"), ""]);
eq("DBR2 an entry with no offset", [nextDeparture("2024-06-15T09:00:00Z", ["2024-06-15T09:30:00"]), nextDeparture("2024-06-15T09:00:00Z", ["2024-06-15T09:30:00[Europe/London]"])], ["", ""]);
eq("DBR3 a zone that disagrees with its offset", nextDeparture("2024-06-15T09:00:00Z", ["2024-06-15T09:30:00+05:00[Europe/London]"]), "");
eq("DBR4 negative and calendar connections", [nextDeparture(HEL("10:05:00"), FERRY, { minimumConnection: "-PT5M" }), nextDeparture(HEL("10:05:00"), FERRY, { minimumConnection: "P1W" })], ["", ""]);
eq("DBR5 headway not positive, to before from", [nextDeparture(AMS("06:12:00"), { ...SHUTTLE, headway: "PT0S" }), nextDeparture(AMS("06:12:00"), { ...SHUTTLE, to: AMS("06:00:00") })], ["", ""]);
eq("DBR5p probe: from >= to", [nextDeparture(AMS("06:00:00"), [AMS("06:00:00")]), nextDeparture(AMS("09:00:00"), [AMS("06:00:00")])], [AMS("06:00:00"), ""]);
eq("DBR6 empty list", nextDeparture(HEL("10:05:00"), []), "");
eq("DBR7 one bad entry voids the list", nextDeparture(HEL("10:05:00"), [HEL("13:00:00"), "2024-06-15T16:30:00"]), "");

// ===== Guide, scenarios and mistakes (beyond the JSDoc examples, which api-surface already runs)
eq("G1 delay across spring-forward", scheduleDeviation("2024-03-10T01:30:00-05:00[America/New_York]", "2024-03-10T03:30:00-04:00[America/New_York]"), "PT1H");
eq("G2 delay across fall-back", scheduleDeviation(EDT("01:30:00"), EST_("01:30:00")), "PT1H");
eq("G3 one 90-minute delay under 60 and 120", [classifyPunctuality("2024-06-15T10:00:00Z", "2024-06-15T11:30:00Z", { late: "PT60M" }), classifyPunctuality("2024-06-15T10:00:00Z", "2024-06-15T11:30:00Z", { late: "PT120M" })], ["late", "onTime"]);
eq("G4 day-based, both edges outside", [classifyPunctuality("2024-06-12T06:00:00+08:00", "2024-06-11T06:00:00+08:00", { late: "P1D", early: "P1D" }), classifyPunctuality("2024-06-12T06:00:00+08:00", "2024-06-13T05:00:00+08:00", { late: "P1D", early: "P1D" }), classifyPunctuality("2024-06-12T06:00:00+08:00", "2024-06-13T06:00:00+08:00", { late: "P1D", early: "P1D" })], ["early", "onTime", "late"]);
eq("G5 the same pairs, two rates", [punctualityRate(P60.map(([planned, actual]) => ({ planned, actual })), { late: "PT60M" }).rate, punctualityRate(P60.map(([planned, actual]) => ({ planned, actual })), { late: "PT120M" }).rate], [0.3333333333333333, 0.6666666666666666]);
eq("G6 nextDeparture feeds scheduleDelivery", scheduleDelivery([{ departure: nextDeparture("2024-06-15T09:00:00Z", ["2024-06-15T08:00:00Z", "2024-06-15T09:30:00Z", "2024-06-15T11:00:00Z"], { minimumConnection: "PT45M" }), duration: "PT2H", timeZone: "Europe/London" }]).eta, "2024-06-15T14:00:00+01:00[Europe/London]");
eq("G7 inclusive to is a mistake: to is never a departure", [nextDeparture("2024-06-15T08:55:00+02:00", { headway: "PT20M", from: "2024-06-15T06:00:00+02:00", to: "2024-06-15T09:00:00+02:00" }), nextDeparture("2024-06-15T08:55:00+02:00", { headway: "PT20M", from: "2024-06-15T06:00:00+02:00", to: "2024-06-15T09:00:00.000000001+02:00" })], ["", "2024-06-15T09:00:00+02:00"]);
eq("G8 no connection time misses nothing on paper", nextDeparture("2024-06-15T09:20:00Z", ["2024-06-15T09:30:00Z", "2024-06-15T11:00:00Z"]), "2024-06-15T09:30:00Z");
eq("G9 with the 45-minute connection", nextDeparture("2024-06-15T09:20:00Z", ["2024-06-15T09:30:00Z", "2024-06-15T11:00:00Z"], { minimumConnection: "PT45M" }), "2024-06-15T11:00:00Z");

eq("G10 exactly the tolerance does not exceed it", estimateDrift(E1, { tolerance: "PT9H" }), { first: "2024-06-20T08:00:00Z", last: "2024-06-20T17:00:00Z", drift: "PT9H", revisions: 3, exceedsTolerance: false });
eq("G11 the made departure as a leg", scheduleDelivery([{ departure: "2024-06-15T11:00:00Z", duration: "PT2H", timeZone: "Europe/London" }]), { eta: "2024-06-15T14:00:00+01:00[Europe/London]", legTimes: [{ arrival: "2024-06-15T13:00:00Z", localArrival: "2024-06-15T14:00:00+01:00[Europe/London]", dwellAfter: "PT0S" }] });
eq("G12 late PT0S: on the plan is late", classifyPunctuality("2024-06-15T10:00:00Z", "2024-06-15T10:00:00Z", { late: "PT0S" }), "late");
eq("G13 rate under 60 and 120, same pairs", [punctualityRate(P60.map(([planned, actual]) => ({ planned, actual })), { late: "PT60M" }), punctualityRate(P60.map(([planned, actual]) => ({ planned, actual })), { late: "PT120M" })], [{ onTime: 2, total: 6, rate: 0.3333333333333333 }, { onTime: 4, total: 6, rate: 0.6666666666666666 }]);
const OFF = { headway: "PT20M", from: "2024-06-15T06:00:00+02:00", to: "2024-06-15T09:00:00+02:00" };
eq("M4 the last shuttle and the end of service", [nextDeparture("2024-06-15T08:40:00+02:00", OFF), nextDeparture("2024-06-15T08:55:00+02:00", OFF)], ["2024-06-15T08:40:00+02:00", ""]);
// Naive JavaScript shown on the scenario and mistakes pages (no gmt): checked here so the pages state facts
const minutes = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
eq("N1 wall-clock subtraction, fall-back and spring-forward", [minutes("01:30") - minutes("01:30"), minutes("03:30") - minutes("01:30")], [0, 120]);
eq("N2 latest recorded wins", (() => { const latest = E2.reduce((a, e) => (Date.parse(e.recordedAt) >= Date.parse(a.recordedAt) ? e : a)); return latest.at; })(), "2024-06-15T13:05:00Z");
eq("N3 an inclusive end time", (() => { const departures = []; for (let t = Date.parse("2024-06-15T06:00:00+02:00"); t <= Date.parse("2024-06-15T09:00:00+02:00"); t += 20 * 60 * 1000) departures.push(new Date(t).toISOString()); return [departures.length, departures.at(-1)]; })(), [10, "2024-06-15T07:00:00.000Z"]);
eq("N4 a threshold buried in code", (() => { const late = (plannedMs, actualMs) => actualMs - plannedMs > 15 * 60 * 1000; return late(Date.parse("2024-06-15T10:00:00Z"), Date.parse("2024-06-15T10:15:00Z")); })(), false);
eq("N5 the probe moment for a connection", [nextDeparture(HEL("10:05:00"), ["+275760-09-13T00:00:00Z"], { minimumConnection: "PT45M" }), nextDeparture(HEL("10:05:00"), ["+275760-09-13T00:00:00Z"], { minimumConnection: "P1W" }), nextDeparture(HEL("10:05:00"), ["+275760-09-13T00:00:00Z"])], ["+275760-09-13T00:00:00Z", "", "+275760-09-13T00:00:00Z"]);
eq("N6 a valid tolerance probe pair", [classifyPunctuality("2024-01-01T00:00:00Z", "2024-01-01T00:00:00Z", { late: "PT15M" }), classifyPunctuality("2024-01-01T00:00:00Z", "2024-01-01T00:00:00Z", { late: "PT0S", early: "PT10M" })], ["onTime", "late"]);

// ===== Rows added by dox-builder for values the new Dox tests print (not in the original appendix)
eq("PB3e day-based with early switched off: 36 h early is on time", classifyPunctuality(SIN("10", "06:00:00"), SIN("08", "18:00:00"), { late: "P1D" }), "onTime");
const E2e = E2.map((x) => ({ ...x })); E2e[3].at = "2024-06-15T13:30:00Z";
eq("ED5 typing a 13:30 last estimate: drift PT50M", estimateDrift(E2e).drift, "PT50M");
const E6 = [ev("PLN", "2024-06-15T12:00:00Z", "2024-06-01T00:00:00Z"), ev("EST", "2024-06-15T12:40:00Z", "2024-06-14T00:00:00Z"), ev("EST", "2024-06-15T12:50:00Z", "2024-06-14T05:00:00Z")];
eq("ED6 a chat seed of three events, tolerance PT20M", estimateDrift(E6, { tolerance: "PT20M" }), { first: "2024-06-15T12:40:00Z", last: "2024-06-15T12:50:00Z", drift: "PT10M", revisions: 2, exceedsTolerance: false });
eq("DB5 arrival 08:00, 10-minute connection, shuttle", nextDeparture(AMS("08:00:00"), SHUTTLE, { minimumConnection: "PT10M" }), AMS("08:20:00"));
eq("DB6 the arrival moved to 06:21 and 06:31", [nextDeparture(AMS("06:21:00"), SHUTTLE, { minimumConnection: "PT10M" }), nextDeparture(AMS("06:31:00"), SHUTTLE, { minimumConnection: "PT10M" })], [AMS("06:40:00"), AMS("07:00:00")]);
const FERRY_T = [HEL("07:30:00"), HEL("10:30:00"), HEL("13:00:00"), HEL("16:30:00"), HEL("19:30:00")];
eq("DB2t the chat pill lists the ferries in time order", [nextDeparture(HEL("10:05:00"), FERRY_T, { minimumConnection: "PT45M" }), nextDeparture(HEL("10:05:00"), FERRY_T)], [HEL("13:00:00"), HEL("10:30:00")]);

if (failed) { console.log(`${failed} FAILED`); process.exit(1); }
console.log("all ok");
```
