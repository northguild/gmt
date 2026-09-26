# Spec: Multi-leg scheduling on the docs site (TRAN-9)

Execution spec for `dox-builder`, verified by `dox-tester`. This is not `packages/gmt` work.
`scheduleDelivery` and `crossingTime` are final. Nothing here edits library source, tests, the
READMEs or `packages/gmt/skills/`. A library problem found while building is reported to the
main session, never built around.

Sources, in order of precedence: the owner's scope decision (four standalone tools), the JSDoc
of `packages/gmt/src/transport/calculate/scheduleDelivery.ts` and `crossingTime.ts`,
`context/domination/issues/TRAN-9.md`, `context/domination/docs-site.md`, then
`context/dox/built.md`. The shape follows `context/dox/specs/int-58-billing-deadlines.md`.

Every value in this spec was computed against a build of the final library source. Section 9
holds the table, and appendix Z holds the script that checks every row. Do not type a result
that is not in section 9. If you need a new value, compute it against `packages/gmt/dist`
first and add a row to the table and the script.

**Build order.** Land and test one piece at a time, in this order. Each step ends with
`pnpm --filter @gmt/dox test` green before the next starts.

1. **C0**: the shared transport helpers and their tests.
2. **C-a**: the Delivery Scheduler, with its chat registration.
3. **C-c**: the Connection Checker, with its chat registration.
4. **C-d**: the Timetable Reader, with its chat registration.
5. **C-b**: the Crossing Clock, with its chat registration. It shares least, so it can move
   anywhere after C0.
6. **A**: the content pages. The scenario and the mistakes link to all four tools, and the
   content-permalink test needs each `WidgetKind` to exist.
7. **C9**: `built.md`, then the gates in section D.

The tool letters follow the owner's numbering (a Delivery, b Crossing, c Connection,
d Timetable). The build order is a, c, d, b, because the Connection Checker and the Timetable
Reader reuse what the Delivery Scheduler proves.

---

## 0. Binding rules

From `built.md` § "Rules that bind every change", which bind every item here:

- `apps/dox` must not perturb `packages/gmt`. `pnpm run validate` stays green, including the
  timezone matrix. No changeset.
- **Import gmt at module granularity only.** The widgets load `GMT_MODULES["transport/calculate"]`,
  `["transport/convert"]`, `["zoned/validate"]`, `["plain/validate"]` and `["instant/convert"]`.
  Never the root or a namespace barrel.
- **Counts drift.** New copy contains no function, tool, test or guide counts. `built.md`
  § Tier 6 "Seven tools" becomes a sentence with no number (C9).
- **Tests never touch the network or spend AI budget.**
- **React stays inside `/dox`.** Every tool page is Astro plus a plain-DOM module.
- **Restyle native controls.** Real `<select>`, `<input type="text">`, `<input type="range">`,
  `<fieldset>`. Nothing inside a drawn strip, ruler or timeline is focusable.
- **Every tier after Tier 1 stays droppable.** No tool page imports `dox-tools.ts`, `zod` or
  `ai`.

From `built.md` § "Tiers 0–1" (Generator, Guides):

- **Generate, don't maintain.** The reference pages, playground seeds and route manifest for
  `scheduleDelivery` and `crossingTime` come from `build-reference.ts`. Both are already in
  `route-manifest.ts` and `LIVE_PLAYGROUND_TEMPLATES`, so `fixedSpecId="scheduleDelivery"` and
  `rightSpecId="crossingTime"` resolve. Never hand-edit a generated file.
- **Ported, not rewritten.** `packages/gmt/README.md` has no multi-leg section yet (R3). The
  guide's examples are the JSDoc `@example` lines plus section 9 rows. Nothing else.

From `built.md` § "Tier 2":

- **Each widget is a `src/lib/<widget>-mount.ts` exporting `render…Template(args)` and
  `mount…(root, args, signal)`.** The `.astro` shell server-renders the template with
  `<Fragment set:html>`, and the `/dox` rail string-mounts the same markup.
- **A widget that cannot load says so.** A failed `GMT_MODULES` import throws
  `WidgetLoadError`. Every shell catches its mount and calls `showUnavailable`.
- **`escapeAttr` or `escapeHtml` on every template interpolation.** Values come from a model or a
  URL.
- **Sentinel-aware output.** A `null` result renders `NO SIGNAL` through
  `renderWidgetOutput(out, "NO SIGNAL", "sentinel")`. Amber is only for that sentinel. Made,
  missed, early and late never use amber, success or error colours.
- **Permalinks seed through `seedFromLocation`**, which keeps only top-level strings of 1–64
  characters (and integers 1900–2100). Every permalink in this spec is flat and all strings
  (R1).
- **Gates.** `html-diff.mjs` compares built widget markup, and `visual:diff` is the pixel gate.

From `built.md` § "Tier 5": a scenario is the naive approach, then the widget showing it break,
then why, then the gmt approach, then the same widget working. Mistakes carry severity and live
proof.

From `built.md` § "Tier 6" (Widget tools, Runbooks):

- **Parity.** `ENABLED_TOOL_NAMES` equals the registry keys, and every enabled tool has a
  `CHAT_STARTERS` pill whose `args` pass the schema and `validate`.
- **Worker tools carry a trivial `execute`.**
- **The client never trusts tool input.** The registry re-validates with the zod schema and
  checks every zone with gmt's `isValidTimeZone`. It imports only **types** from mount modules.
- **Runbook: keep `optimizeDeps.entries`.** It already globs `src/lib/**/*.ts`, so no change is
  needed. Confirm the glob still covers the new files.

Repo rules for this story:

- **GMT tracks no law.** No page, widget string, preset, chat doc or test name names a statute,
  standard, regulator, docket or industry body. Say "minimum connect time" and "handling time"
  generically. Do not name IATA, GTFS, ICAO, IMO or any timetable standard. "The Date Line" is
  geography and stays.
- **The widgets draw the library's results and compute none of them.** Every arrival, local
  arrival, ETA, ready instant, departure instant, elapsed duration and earlier or later
  classification shown comes from a gmt call. Each tool computes one naive value of its own,
  and labels it naive: the offset-table reading (C-a), the wall-clock difference (C-b), the
  printed-clock check (C-c). The polyfill may be imported for drawing only: axis positions,
  tick instants and DST-transition markers.
- **Every result shown is real.** Nothing is elided.
- **No git operations.**

---

## A. Content pages

All paths are under `apps/dox/src/content/docs/`. Every fenced block and every `rightCode` or
`gmtCode` that shows a `call // result` imports the function it calls, so `api-surface.mjs`
executes it. In those blocks, bind legs with `const name = { … }` object literals and call with
arrays of bindings. **No spreads, no helper functions and no `.eta` member access** in an
import-bound block: `api-surface.mjs` binds only literals and skips member access. Section D4's
script checks everything else.

### A1. `guides/industries/transport-multi-leg-scheduling.mdx` (new)

The filename starts with `transport-`, which `scripts/stats.mjs` `industryLayers()` requires.
Front matter:

```yaml
title: "Transport: Multi-leg Scheduling"
description: scheduleDelivery and crossingTime — chain truck, ship and rail legs into one ETA with every handoff an exact instant, check a scheduled connection against the minimum connect time, and time a crossing on the clock that administers it.
sidebar:
  order: 4
```

Sections, in this order. Each function gets one `##` headed with a claim, in the style of
`transport-legs-and-dwell.mdx`. Sub-rules are `###`.

1. **Intro (no heading).** A multi-modal move, truck to ship to rail, is published as one
   departure plus a duration per leg, with handling time at each handoff. The hour naive code
   loses lives at the handoffs. Every leg boundary here is an exact instant, and local times are
   rendered only at the edges. Then:
   `import { crossingTime, scheduleDelivery } from "@northguild/gmt/transport";` and one line
   saying both live in `@northguild/gmt/transport/calculate`, beside `transitTime` and
   `dwellTime` from [Transport: Legs and Dwell](/guides/industries/transport-legs-and-dwell/).
2. **`## Every handoff is an exact instant: scheduleDelivery`.** Link
   [`scheduleDelivery(legs, options?)`](/reference/transport/calculate/scheduleDelivery/).
   - Rules: each leg's arrival plus its `dwellAfter` is the next leg's departure. `arrival` is a
     UTC instant. `localArrival` is that instant in the leg's `timeZone`, as `etaAtZone`
     renders it. `eta` is the last leg's `localArrival`. A single leg is exactly `transitTime`
     then `etaAtZone`. Code: V1, then V12 and V13 with their imports
     (`transitTime` from `@northguild/gmt/transport`, `etaAtZone` from the same).
   - Code: V2 (a two-hour dwell, the second leg leaves at 12:00Z).
   - The journey. Code: `const truck = {…}`, `const ship = {…}` and `const rail = {…}` as
     literals, then `scheduleDelivery([truck, ship, rail])` with V30's result (the ship has no
     `departure`). Prose: the truck lands at 05:00 in Los Angeles, three hours after the clocks
     sprang forward. An offset table holding Los Angeles's winter −08:00 reads that arrival as
     04:00, an hour early, and every handoff time after it inherits the error. Link the
     [Delivery Scheduler](/tools/delivery-scheduler/).
   - **The Date Line.** Code: V27 (it leaves Los Angeles at 23:00 on Friday 14 June and lands in
     Tokyo at 02:00 on Sunday 16 June, after 11 elapsed hours). Then V57 (eastbound, it lands in
     Los Angeles at 11:00 on 17 June, six wall-clock hours before it left Tokyo on the same
     date). One sentence: nothing special happens at the Date Line, because each end is only an
     instant rendered in a zone.
   - `### A scheduled departure is a connection, and dwell is the minimum connect time`.
     A later leg with its own `departure` is a scheduled connection the cargo waits for.
     `dwellAfter` is the handling time at the handoff, the minimum connect time. A departure
     earlier than the previous arrival plus its dwell is a missed connection and returns
     `null`, not a negative wait. Equal passes. Code: V6 (`null`) and V14 (equal passes). Then
     V22: the last leg's dwell is validated and echoed, but moves nothing, and V23: it is still
     validated. Link the [Connection Checker](/tools/connection-checker/).
   - `### A departure must be exact, and a timetable names its zone`. The first leg needs a
     departure that is an instant or a zoned string (V9, V7). `startTimeZone` reads a zoneless
     first departure as a published local time (V4). It is ignored when the departure is already
     exact (V26). An invalid `startTimeZone` returns `null` even when unused (V17). A zoneless
     departure on a later leg returns `null` (V16), and a bracket that contradicts its offset
     returns `null` (V28). Then the resolution rule, stated once: an ambiguous wall time
     resolves to the earlier instant and a nonexistent one to the later instant. Code: V18
     (01:30 on the fall-back night, the earlier pass), V19 (writing `-05:00` picks the later
     pass), V20 (02:30 on the spring-forward night becomes 03:30) and V83 (no offset makes a
     skipped time exist: `null`). Link the [Timetable Reader](/tools/timetable-reader/) and,
     for the general DST rule, the [DST Inspector](/tools/dst-inspector/).
   - `### Tags, zones and the sentinels`. `mode`, `origin` and `destination` are opaque tags
     echoed onto each `LegTime` and absent when not supplied (V25, then V1 has none). `timeZone`
     is the caller's fact. GMT resolves no port or station code. A fixed offset is accepted, but
     observes no DST (V24). Then one block with every sentinel and its neighbour: V5 (`[]` is
     valid and returns `{ eta: "", legTimes: [] }`), V15 (a zero-length leg passes), V8 (a
     negative leg is `null`), V10 (calendar units are `null`), V29 (a negative dwell is `null`)
     and V11 (a non-array is `null`).
3. **`## A crossing is exact time on the authority's clock: crossingTime`.** Link
   [`crossingTime(entry, exit, targetZone)`](/reference/transport/calculate/crossingTime/).
   A crossing (a canal transit, a strait passage, a border queue) is logged as two instants and
   read on the clock of the place that administers it. `duration` is exact elapsed time with
   hours as the largest unit. Code: V46, then V48 (seven elapsed hours, while the wall clocks
   read 00:00 and 08:00), then V49 (both ends read 01:30, and the offsets tell them apart).
   Then: `targetZone` is always the rendering zone, and a bracket in the input is never read
   (V55). A fixed offset renders with no DST (V51, and V56: the spring-forward night on a fixed
   −05:00 reads 07:00, not New York's 08:00). A zero-length crossing is `PT0S` (V50). An exit
   before its entry, an unknown zone or a zoneless time returns `null` (V52, V53, V54). One
   sentence: it counts no calendar days, because a crossing that needs a day count is a dwell,
   and links [`dwellTime`](/reference/transport/calculate/dwellTime/). Link the
   [Crossing Clock](/tools/crossing-clock/).
4. **`## See it break, then work`.** A bulleted list:
   - `[Delivery Scheduler: a truck, a ship and a train across the spring-forward](/tools/delivery-scheduler/)`
   - `[Connection Checker: slide the handling time across the boundary](/tools/connection-checker/)`
   - `[Timetable Reader: one printed time, two instants](/tools/timetable-reader/)`
   - `[Crossing Clock: seven hours that read as eight](/tools/crossing-clock/)`
   - `[A Connection Missed at the Spring-Forward Handoff](/scenarios/connection-missed-at-spring-forward/)`
   - `[Transport mistakes: multi-leg scheduling](/mistakes/transport/#multi-leg-scheduling)`

### A2. `scenarios/connection-missed-at-spring-forward.mdx` (new)

Copy `container-dwell-days.mdx`'s shape. `scenarios/index.mdx` is generated: never edit it.

- Front matter: `title: "A Connection Missed at the Spring-Forward Handoff"`, description: "A
  truck reaches the Los Angeles port the morning clocks spring forward. An offset table says
  the ship connection holds with 30 minutes to spare. It is missed by 30 minutes."
- `<Scenario title=… description="A truck leaves Chicago at 08:00 on 8 March 2024 on a 46-hour
  run to the Los Angeles port. Handling there takes two hours. The ship to Tokyo is published
  to sail at 06:30 on 10 March. Is the connection made?" … fixedSpecId="scheduleDelivery" />`.
- `naiveCode` (N1, verified in any `TZ`):

  ```js
  // The naive approach: one UTC offset per place, from a table
  const OFFSET_HOURS = { "America/Los_Angeles": -8 }; // Los Angeles, as the table was built in winter
  const departed = Date.parse("2024-03-08T08:00:00-06:00"); // Chicago, 08:00
  const arrived = departed + 46 * 36e5; // 2024-03-10T12:00:00.000Z
  const toLocal = (ms) => new Date(ms + OFFSET_HOURS["America/Los_Angeles"] * 36e5).toISOString().slice(0, 16);
  toLocal(arrived); // "2024-03-10T04:00"
  const ready = arrived + 2 * 36e5; // two hours of handling: "2024-03-10T06:00" local
  const sails = Date.parse("2024-03-10T06:30:00Z") - OFFSET_HOURS["America/Los_Angeles"] * 36e5; // 06:30 local, by the table
  ready <= sails; // true — "made, with 30 minutes to spare"
  ```

- `explanation`: a fixed offset is a place's offset at one moment. The table's −08:00 was Los
  Angeles's offset when the truck left. Clocks sprang forward at 02:00 on 10 March, and the
  truck arrived at 12:00Z, which is 05:00 PDT. The naive code reads the arrival and the
  ship's published 06:30 through the same stale offset, so the handoff looks 30 minutes early.
  In fact the cargo is ready at 07:00, and the ship sailed at 06:30. `scheduleDelivery` keeps
  every handoff an exact instant. It reads the ship's published time in the port's own zone.
  It treats a departure before the arrival plus the handling time as a missed connection, and
  returns `null` rather than a negative wait.
- `gmtCode`: import `scheduleDelivery` from `@northguild/gmt/transport`. Bind
  `const truck = { departure: "2024-03-08T08:00:00-06:00[America/Chicago]", duration: "PT46H", timeZone: "America/Los_Angeles", dwellAfter: "PT2H", mode: "truck" };`,
  `const ship = { departure: "2024-03-10T06:30:00[America/Los_Angeles]", duration: "P11D", timeZone: "Asia/Tokyo", mode: "ship" };`
  and `const laterShip` (the same with `07:30:00`). Show `scheduleDelivery([truck]);` with V41
  (05:00, not 04:00), then `scheduleDelivery([truck, ship]); // null — the ship sails inside
  the two-hour handoff: a missed connection` (V36), then `scheduleDelivery([truck, laterShip]);`
  with V37.
- Edit paragraph: "Open the handoff in the [Connection Checker](PC3) and slide the handling
  time down: at 90 minutes the ship sails exactly when the cargo is ready, and equal passes. At
  91 it is missed. Or open the whole journey in the [Delivery Scheduler](PD1) and change the
  ship's departure to 07:30." Then link the guide section
  `/guides/industries/transport-multi-leg-scheduling/#a-scheduled-departure-is-a-connection-and-dwell-is-the-minimum-connect-time`.
  PC3 is V73 at 120 and V74 at 90 (V75 at 91).

### A3. `mistakes/transport.mdx` (modify)

- Intro: replace "The transport layer is three functions, `transitTime`, `etaAtZone` and
  `dwellTime`, and the mistakes around them are …" with a sentence that names the five
  functions without a count (`transitTime`, `etaAtZone`, `dwellTime`, `scheduleDelivery` and
  `crossingTime`). Add "reading a handoff through a fixed offset, and checking a connection
  against the arrival instead of the arrival plus its handling time" to the list of mistakes.
- Rename `## Mistakes` to `## Legs and dwell`. Nothing links to `#mistakes`
  (checked: `grep -rn "#mistakes" apps/dox/src/content/docs` finds no transport hit).
- Append `## Multi-leg scheduling`. Its first paragraph links the four tools: "Each of these
  has a live tool: the [Delivery Scheduler](/tools/delivery-scheduler/), the [Connection
  Checker](/tools/connection-checker/), the [Timetable Reader](/tools/timetable-reader/) and
  the [Crossing Clock](/tools/crossing-clock/)." Then six `<Mistake>` entries. Every
  `rightCode` imports from `@northguild/gmt/transport`. `rightSpecId` is `scheduleDelivery`
  for M1–M4 and M6, and `crossingTime` for M5.

| # | severity | title | wrongCode | rightCode |
| --- | --- | --- | --- | --- |
| M1 | high | Reading a handoff through an offset table | N1 lines up to `toLocal(arrived); // "2024-03-10T04:00"` | `const truck = {…}` then V41 |
| M2 | high | Checking a connection against the arrival, not the arrival plus handling | N2: `Date.parse("2024-03-10T13:30:00Z") >= Date.parse("2024-03-10T12:00:00Z"); // true — but the handoff needs two hours` | V36 (`null`), then V37 |
| M3 | medium | Giving a later leg a published local time with no zone | V40 (`null`), with its import | V37 |
| M4 | medium | Stamping a published local time as UTC | V39 (a `Z` added to New York's 10:00) | V4 (`startTimeZone`) |
| M5 | medium | Timing a crossing from its wall clocks | N3: `(Date.parse("2024-11-03T01:30:00") - Date.parse("2024-11-03T01:30:00")) / 36e5; // 0 — both ends read 01:30` | V49 |
| M6 | medium | Writing an offset into a skipped hour | V83 (`null`) | V81 (the zoneless form resolves to the later instant) |

Descriptions are one or two sentences and name no standard. M3's: "Only the first leg can be
read in `startTimeZone`. A later scheduled departure must be exact, so write its zone in
brackets: `2024-03-10T07:30:00[America/Los_Angeles]`." M6's: "02:30 on 10 March 2024 never
showed on a New York clock, so no offset names it. Leave the offset off and it resolves to the
later instant, 03:30."

### A4. Indexes and cross-links (modify)

- `guides/industries/index.mdx`, Layers: add after the transport bullet:
  `- [Transport: multi-leg scheduling](./transport-multi-leg-scheduling/) — chain truck, ship
  and rail legs into one ETA with every handoff an exact instant, check a scheduled connection
  against the minimum connect time, and time a crossing on the clock that administers it.
  Built on the legs-and-dwell layer.` Scenarios: add
  `- [A Connection Missed at the Spring-Forward Handoff](/scenarios/connection-missed-at-spring-forward/)`
  after "Two arrivals, one wall time". The closing paragraph's mistakes links stay.
- `guides/index.mdx`, Industries row: "transport legs and dwell, free time and demurrage,
  billing deadlines" becomes "transport legs and dwell, multi-leg scheduling, free time and
  demurrage, billing deadlines". The table must stay valid Markdown.
- `mistakes/index.mdx`, under `## Transport`: add
  `- [Multi-leg Scheduling Mistakes](/mistakes/transport/#multi-leg-scheduling)`.
- `guides/industries/transport-legs-and-dwell.mdx`: add one sentence to the end of the intro:
  "Chaining legs into one journey, with scheduled connections and crossings, is
  [Transport: Multi-leg Scheduling](/guides/industries/transport-multi-leg-scheduling/)."

---

## C0. Shared transport helpers (build first)

The house pattern for shared widget code is a plain module that other widgets import, as the
Free Time Ledger imports the Dwell Ledger's grid helpers. The four tools share leg handling,
formatting, the null diagnosis and zone options, so they go in one place.

### C0.1 `src/lib/transport-widgets.ts` (pure: no DOM, no gmt import)

It may import `@js-temporal/polyfill` for drawing only, and `CURATED_TIMEZONES`.

- `TRANSPORT_ZONES`: `[...CURATED_TIMEZONES, "Europe/Amsterdam", "Europe/Rome", "America/Panama"]`.
  `FIXED_OFFSET_ZONES = ["+02:00", "-05:00"]` (the Crossing Clock only).
- `zoneOptionsHtml(zones, selected, noneLabel?)`: the Dwell Ledger's `zoneOptions`, escaped. A
  selected value the list lacks is appended. `noneLabel` adds a first `value=""` option. (The
  ui-audit P4 move of `options()` into `widget-ui.ts` is out of scope. Do not touch the DST
  Inspector or the Converter Bench.)
- `interface TransportLib`: `scheduleDelivery(legs: unknown, options?: unknown)`,
  `transitTime(d: string, dur: string): string`, `etaAtZone(i: string, z: string): string`,
  `crossingTime(a: string, b: string, z: string)`, `isValidTimeZone(v: string): boolean`,
  `isValidDateTime(v: string): boolean` (plain/validate), and
  `resolveLocal(w: string, z: string, o?: { disambiguation: "earlier" | "later" }): string`
  (instant/convert). Every helper below takes it as an argument, so this module stays free of
  gmt imports and the tests inject the real library.
- `type LegFields = { departure, duration, timeZone, dwellAfter, mode }` (all strings).
  `legObject(f)`: the leg passed to the library. Keys in the order `departure, duration,
  timeZone, dwellAfter, mode`, which is the JSDoc order. **Every blank field is omitted.**
- `scheduleCallSource(legs, options?)`: `[html, plain]` for `renderCallLine`, as in the
  `optionsSource` pattern. `plain` is exactly the JSDoc spelling:
  `[{ departure: "…", duration: "…", timeZone: "…" }, { … }]`, then
  `, { startTimeZone: "…" }` only when given. For V2 and V4 it equals the JSDoc call text
  verbatim, without the function name, which `renderCallLine` adds.
- `formatSchedule(r)`: `{ eta: "…",\n  legTimes: [{ arrival: "…", localArrival: "…", dwellAfter: "…"[, mode: "…"] },\n    { … }] }`.
  Replacing every `\n` plus its indent with one space gives the JSDoc result literal exactly.
  `{ eta: "", legTimes: [] }` for V5.
- `formatCrossing(r)`: `{ duration: "…",\n  enter: "…",\n  exit: "…" }`, collapsing to the JSDoc
  literal.
- `minutesText(n)`: `"0 min"`, `"5 min"`, `"1 h"`, `"1 h 30 min"`, `"55 min"`. Hours and
  minutes only. Negative values take their absolute value, and the caller words the direction.
- `ZERO_LEG = { duration: "PT0S", timeZone: "UTC" }`. A zero-length leg is valid input (V15).
  It is how a widget asks the library for an instant without computing one:
  - `readyAt(legs, k, options, lib)`: the instant the leg after `k` may leave, which is
    `scheduleDelivery([...legs.slice(0, k + 1), ZERO_LEG], options)?.legTimes[k + 1].arrival`,
    or `null`. Leg `k` is non-final in this call, so its dwell is applied exactly as in the
    real call (V35).
  - `departureAt(departure, isFirst, options, lib)`: the instant a written departure names,
    which is `scheduleDelivery([{ departure, ...ZERO_LEG }], isFirst ? options : undefined)`, or
    `null` (V43).
- `diagnose(legs, options, lib)`: why `scheduleDelivery` returned `null`, checked in the
  library's order (`scheduleDelivery` → `chainLegs` → `legTags`, `legDeparture`,
  `legBoundaries`). It returns `{ leg: k, reason }` or `null`.
  1. `startTimeZone` given and `!isValidTimeZone` → `{ leg: -1, reason: "invalid-start-zone" }`.
  2. `k` is the smallest index for which
     `scheduleDelivery([...legs.slice(0, k + 1), ...(k + 1 < legs.length ? [ZERO_LEG] : [])], options)`
     is `null`. Appending `ZERO_LEG` keeps leg `k` non-final, as it is in the full call.
  3. The departure. `k === 0` with a blank departure → `no-departure`. A departure present on
     leg 0, or on a later leg, that `departureAt` cannot resolve → `zoneless-first` (leg 0, no
     `startTimeZone`) or `zoneless-later` (a later leg) when it is zoneless, else
     `invalid-departure`. Zoneless means `isValidDateTime` is true and the text has no `Z`, no
     numeric offset and no `[`.
  4. A later leg whose departure resolves, when
     `scheduleDelivery([...legs.slice(0, k), { departure, ...ZERO_LEG }], options)` is `null`
     → `missed-connection`.
  5. With the leg's departure instant (from `departureAt`, or from `readyAt(k - 1)` when it has
     none), `transitTime(dep, duration) === ""` → `invalid-duration`. An arrival before `dep` →
     `negative-duration`.
  6. `!isValidTimeZone(timeZone)` → `invalid-zone`.
  7. Otherwise `invalid-dwell` when the dwell is not a time-unit duration or is negative, else
     `out-of-range`.
- `SCHEDULE_NULL_TEXT`, a function of `(reason, n, facts)` where `n` is the 1-based leg. These
  are the only reason strings:
  - `invalid-start-zone`: "startTimeZone is not a time zone this browser knows. An invalid
    startTimeZone returns null even when no departure needs it."
  - `no-departure`: "Leg 1 has no departure. The first leg needs one: an instant, or a zoned
    date-time."
  - `zoneless-first`: "Leg 1 leaves at a wall time with no offset or zone, so it is not a
    moment. Set the start zone to read it as a published local time, or write its offset."
  - `zoneless-later`: "Leg n's scheduled departure has no offset or zone. Only the first leg is
    read in the start zone. A later departure must be exact, so write its zone in brackets."
  - `invalid-departure`: "Leg n's departure is not an instant, or a zoned date-time whose zone
    is real and agrees with its offset."
  - `missed-connection`: "Missed connection: leg n is scheduled to leave at {dep}, but leg n−1
    arrives at {arr} and needs {dwell} at the handoff, so the earliest it can leave is {ready}.
    A departure before the arrival plus its handling time returns null." Each time is
    `etaAtZone(instant, legs[k - 1].timeZone)`.
  - `invalid-duration`: "Leg n's duration is not one transitTime accepts: hours, minutes and
    seconds, and days of exactly 24 hours. Years, months and weeks return null."
  - `negative-duration`: "Leg n's duration is negative. A leg cannot arrive before it departs."
  - `invalid-zone`: "Leg n's arrival zone is not a time zone this browser knows."
  - `invalid-dwell`: "Leg n's dwell is not a duration of time units, or it is negative."
  - `out-of-range`: "The schedule leaves the range of instants Temporal can represent."
- `collectJourneyFacts(legs, options, lib)`: `{ result, failure, departures[], arrivals[],
  localArrivals[], readies[], scheduled[] }` for every leg that is reached (all legs when
  `result` is non-null, legs `0..k-1` when leg `k` fails). `departures[i]` is `departureAt`
  for leg 0 and for scheduled legs, and `readies[i - 1]` otherwise. `arrivals` and
  `localArrivals` come from `result` or, on failure, from the prefix
  `scheduleDelivery(legs.slice(0, k), options)`. `readies[i]` is `readyAt(i)` for every
  non-final reached leg, plus `readyAt(k - 1)` on a missed connection.
- `offsetTableReading(instantZ, zone, bookedAtZ)`: the naive value. The zone's offset at
  `bookedAtZ` (the first departure), applied to `instantZ`, via the polyfill:
  `{ wall: "2024-03-10T04:00", offset: "-08:00", deltaMinutes: -60 }`. `deltaMinutes` is the
  naive wall clock minus the library's wall clock, from their `YYYY-MM-DDTHH:MM` text.

### C0.2 `src/lib/transport-lib.ts`

`loadTransportLib(): Promise<TransportLib>` loads the five `GMT_MODULES` entries named in
section 0 with `Promise.all` and returns the functions, cast as the existing mounts cast them.
Each mount calls it inside its own `try` and throws `new WidgetLoadError(cause)` on failure. It
is a heavy module (C-x).

### C0.3 `src/lib/transport-widgets.test.ts`

This test imports the real gmt modules (by module path) to build a `TransportLib`. It covers:

- `legObject` (key order, blanks omitted).
- `scheduleCallSource` (V2 and V4 JSDoc text verbatim; `startTimeZone` omitted when blank).
- `formatSchedule` and `formatCrossing` (collapsing to V1, V2, V5 and V46 literals).
- `minutesText`.
- `readyAt` (V35: `"2024-03-10T14:00:00Z"`) and `departureAt` (V43: `"2024-03-10T13:30:00Z"`).
- `diagnose`: one state per reason, asserting both the reason and that the real
  `scheduleDelivery` returns `null` for it. Use V17 `invalid-start-zone`, V9 `no-departure`,
  V7 `zoneless-first`, V16 `zoneless-later`, V28 `invalid-departure`, V32 `missed-connection`
  (leg index 1), V10 `invalid-duration`, V8 `negative-duration`, an unknown zone
  `invalid-zone`, and V29 `invalid-dwell`.
- `collectJourneyFacts` for V30 and V32.
- `offsetTableReading("2024-03-10T12:00:00Z", "America/Los_Angeles", "2024-03-08T14:00:00Z")` →
  `{ wall: "2024-03-10T04:00", offset: "-08:00", deltaMinutes: -60 }`.

### C0.4 `src/styles/gmt-transport-widgets.css`

Rules shared by the four tools, per the style guide ("when two components share a rule, merge
it"): the leg `<fieldset>` grid, the verdict line, the naive row and its badge, the reason
aside spacing. Tokens only. Put `container-type: inline-size` on each tool root and write the
narrow rules as `@container` queries, because the `/dox` rail is narrow on a wide viewport.
Register it in `astro.config.mjs` `customCss` directly after `gmt-billing-deadlines.css`, with
the comment `// Transport widgets, shared (TRAN-9)`.

---

## C-a. Delivery Scheduler: `scheduleDelivery`, `/tools/delivery-scheduler/`, key `delivery`

The root is exactly `<div class="gmt-delivery gmt-widget">`, the first thing in the template,
with no other attribute (`html-diff.mjs` matches the literal string).

### C-a1. `src/lib/delivery-scheduler.ts` (pure)

- `MAX_LEGS = 4`. `DeliveryState = { legCount: string; startTimeZone: string; legs: LegFields[4] }`.
- `DeliverySchedulerArgs`: `legs?: Partial<LegFields>[]` (chat), `startTimeZone?`,
  `legCount?`, and flat `departure1…4`, `duration1…4`, `timeZone1…4`, `dwellAfter1…4`,
  `mode1…4` (permalink, all strings).
- `DELIVERY_PRESETS`, in this order:

  | id | label | legs | result |
  | --- | --- | --- | --- |
  | `truck-ship-rail` | Truck → ship → rail across the spring-forward | truck, ship (no departure), rail | V30 |
  | `ship-scheduled` | The ship sails at 07:30: a scheduled connection | truck, ship at `2024-03-10T07:30:00[America/Los_Angeles]`, rail | V31 |
  | `missed-connection` | The ship sails at 06:30: a missed connection | truck, ship at `…06:30:00[America/Los_Angeles]`, rail | V32 (`null`) |
  | `trans-pacific` | Tokyo → Los Angeles by air, across the Date Line | V57's two legs | V57 |
  | `fall-back-night` | Overnight rail across New York's fall-back | V58's two legs | V58 |
  | `dwell-handoff` | Two hours at a UTC terminal, then on to Tokyo | V2's legs (the JSDoc example) | V2 |

  `truck`, `ship` and `rail` are the section 9 bindings (`truck` has `dwellAfter: "PT2H"`, and
  `ship` has `dwellAfter: "PT24H"` in these presets). Descriptions, one or two sentences each:
  1. "A truck leaves Chicago at 08:00 on 8 March 2024 and reaches Los Angeles at 05:00 on the
     10th, three hours after the clocks sprang forward. Two hours of handling, eleven days at
     sea, a day at the Tokyo terminal, then two and a half hours by rail."
  2. "The ship now sails at a scheduled 07:30. The cargo is ready at 07:00, so it waits 30
     minutes and the connection holds."
  3. "The ship sails at 06:30, before the two-hour handoff ends. An offset table's −08:00 would
     read the truck's arrival as 04:00 and call this a connection. scheduleDelivery returns
     null."
  4. "A flight leaves Tokyo at 17:00 on 17 June and lands in Los Angeles at 11:00 the same
     date, before it left by the wall clock. Then 44 hours by truck to Chicago."
  5. "A train leaves at 22:00 on 2 November 2024 and runs six hours through the night New York
     falls back. The wall clock shows five. An offset table's −04:00 puts every later time an
     hour late."
  6. "The JSDoc's two-leg case: ten hours to a UTC terminal, two hours of dwell, five hours on
     to Tokyo. The second leg leaves at 12:00Z."
- `readArgs(args)`: `legs` (an array) wins. Otherwise read the flat keys. `legCount` comes from
  `legs.length`, else `legCount` parsed as 1–4, else the highest index with any non-blank
  field, else 1. Missing strings become `""`. An absent `startTimeZone` is `""`.
- `matchPreset(state)`: compares `legCount`, `startTimeZone` and every visible leg's five
  fields, trimmed.
- `legsOf(state)`: `legObject` for legs `0..legCount-1`. `optionsOf(state)`:
  `{ startTimeZone }` or `undefined` when blank.
- `permalinkOf(state)`: `legCount`, `startTimeZone` when set, and every non-blank field of each
  visible leg under its flat key. Strings only.
- `buildItinerary(facts, legs, originZone, lib)`: every event `scheduleDelivery` produced — a
  departure, an arrival, a handoff or a DST transition — grouped by the local date it happens on
  (in the zone it happens in), walked in strict instant order (grouping never reorders it).
  Returns `{ groups, summary }`: `groups` is one `ItineraryGroup` per local date (`heading`, an
  optional Date-Line/zone-change `anomaly`, its `events`); `summary` is a plain-language sentence
  per leg, handoff and DST transition — the charts' shared `aria-label`.
- `buildChartData(facts, legs, originZone, lib)`: the two chart views' shared data model, drawn
  from `facts` and `lib.etaAtZone` only — nothing time-proportional or arithmetic beyond
  formatting a duration or a delta. Returns `ChartData | null`:
  - `legs`: one `ChartLeg` per reached leg (`fromStation`/`toStation` indices, `departureMs`/
    `arrivalMs`, `durationText`), plus one broken `ChartLeg` (`missed: true`) for a leg scheduled
    but never reached, so the Route view has a link to draw and the To-scale view a lane to mark
    the conflict in.
  - `stations`: one `ChartStation` per leg boundary (origin plus every arrival, or the missed
    leg's scheduled departure), each with its local `time`/`date`/`offset`, the leg colour its
    node takes (`legColorIndex`), and its `badges` (`handling`, `wait`, `offset`, `missed`).
  - `transitions`: every DST/Date-Line transition, attached to every leg whose departure or
    arrival zone — extended through a scheduled wait — contains it, so a transition in the
    shared handoff zone attaches to both the leg that ends there and the leg that starts there.
    The same `dstTransitionsIn` helper the itinerary's own DST notes use, so the charts, the ETA
    card's flags and the itinerary always name the same set.
  - `conflict`: on a missed connection, the gap between when the cargo was ready and when the
    next leg was scheduled to leave, in the handoff zone — the To-scale view's conflict marker.
  - `journeySpanMs`: the whole journey's span; `visibleBarEndMs(departureMs, arrivalMs,
    journeySpanMs)` stretches a leg's bar to `MIN_CHART_BAR_FRACTION` (3%) of that span when it
    would otherwise draw as a sliver (an 11-day sea leg beside a 2.5-hour rail leg).
- `buildEtaSummary(facts, legs, chartData)`: the ETA card's own small record (below).

### C-a2. `src/lib/delivery-scheduler.test.ts`

Covers `readArgs` (the chat array, the flat keys, `legCount` inference, junk becoming `""`),
`matchPreset` (every preset and custom), `legsOf`, `optionsOf`, `permalinkOf` (strings only,
blanks omitted) and `originZoneOf`.

`buildItinerary`, for V30: strict instant order regardless of local date; the Los Angeles and
Chicago spring-forward DST notes; the Los Angeles arrival read 1 h early against the offset
table (V41); the final Tokyo arrival tagged ETA. Also V32 (the scheduled departure and the
`missed` tail on the truck's handoff), V58 (both New York arrivals read an hour late) and V57
(the Date Line annotation, and no offset-table disagreement).

`buildChartData`: one `ChartLeg` per reached leg with its own duration text, and — the DST
attribution fix — leg ① on the default preset carries both Chicago's and Los Angeles's
spring-forward transitions, not only the arrival zone's.

`buildEtaSummary`: the real ETA, its exact ISO, the door-to-door span and the DST/offset flags
on V30; the failing leg and a short headline on V32; the Date Line flag with no offset-table
flag on `trans-pacific`. Every expected value is from section 9.

### C-a3. `src/lib/delivery-scheduler-mount.ts`

The leg-card form and the date-grouped itinerary went through two owner-review passes (the
original five-column grid and tick-row timeline, then a time-proportional overview strip that
buried the answer as plain ISO text). Section 2's chart moved a third time, off hand-built HTML
onto TanStack Charts, once the strip's own alignment fixes ran out of runway: two views — a
schematic Route map and a real-time-axis To-scale Gantt — behind a toggle. What ships now:

- **An ETA summary card leads section 2.** `buildEtaSummary` (`delivery-scheduler.ts`) turns
  `collectJourneyFacts`' output and `buildChartData`'s transitions/badges into one small,
  non-`null` record: the real `eta`'s local reading (`Sat 23 Mar 2024 · 01:30 Tokyo (+09:00)`,
  parsed from the library's own zoned string, never recomputed), the exact ISO on a muted line,
  the door-to-door span (a genuine `Temporal` difference between the first departure and the
  final arrival — both gmt-returned instants, formatted `14 d 2 h 30 min door to door`), the leg
  count, and small flags (`DST ×2`, `Date Line`, `1 h offset-table error`) read off the same
  transitions and badges the charts draw — one shared source, so the card and the charts can
  never disagree. A missed connection (or any other `null`) turns the card into a failure state
  naming the leg and a short reason headline (`Leg 2: Missed connection`); the full reason
  sentence stays in `reason-aside`, unchanged. Never amber, red or green — a failure borrows the
  same dashed dst-purple treatment the itinerary already uses for a missed handoff (§ binding
  rules).
- **`buildItinerary` stays the date-grouped vertical rail**, pure, computing nothing beyond date
  grouping and the Date Line / DST wall-clock notes. **`buildChartData` is the two chart views'
  shared data** (types and fields in C-a1) — one `ChartLeg`/pair of `ChartStation`s per leg
  reached, plus a broken leg and a `conflict` record for a missed connection, and every DST/Date
  Line `transition` attached to the leg(s) it falls in.
- `renderDeliverySchedulerTemplate(args = {})`: seeded when `args.legs`, `args.legCount` or
  `args.duration1` is defined, else the first preset. Layout:
  1. `<h4>1. Build the journey</h4>`: the preset `<select>` (Custom first), the description, a
     "Legs" `<select data-role="leg-count">` (1–4), a "Start zone" select with "optional" as a
     muted suffix rather than in the label text (`start-zone`, first option "(none)"), a hint
     paragraph underneath naming what it's for, then four `<fieldset data-role="leg-1">`…`leg-4`,
     each carrying `data-leg="1".."4"` (`legAccentAttr`) for its own left accent bar and a
     `<legend>` carrying that leg's own number badge (`①②③④`, plain Unicode circled digits — no
     image, colour is never the only cue) plus a running summary: "① Truck · PT46H → Los
     Angeles" (mode, or "Leg" when blank; duration and arrival city each dropped until typed).
     Each fieldset is its own leg card, `gmt-delivery-leg-grid` (not the shared
     `gmt-transport-leg-grid`, which clipped both the zoned departure string and the zone name):
     row 1 is three columns — "Mode" (`mode-n`, a `<select>` of "(none)", truck, rail, ship,
     barge, air — a seeded or typed mode the list lacks is appended as an extra option, never
     dropped), "Duration" (`duration-n`, text) and "Arrives in" (`zone-n`, select of
     `TRANSPORT_ZONES`, truncated with an ellipsis when tight — a `<select>`'s full value is
     still in its option list and its accessible name, unlike a clipped text `<input>`); row 2 is
     "Departs" on leg 1 or "Scheduled departure" on later legs (`departure-n`, text), full width;
     row 3 is "Dwell after" (`dwell-n`, text), full width. Text inputs are
     `type="text" spellcheck="false" autocomplete="off"` with **no placeholder**. A placeholder
     time reads as a default. Fieldsets past the leg count are `hidden` and keep their values.
  2. `<h4>2. The journey, handoff by handoff</h4>`: the ETA summary card (`eta-summary`, with
     `eta-headline`, `eta` — the muted exact ISO line, `aria-live="polite"` — `eta-duration`,
     `eta-legs` and `eta-flags`), then a view toggle (`chart-toggle`, the shared
     `.gmt-chart-toggle` pattern, two `aria-pressed` buttons `view-route`/`view-scale` — "Route"
     starts pressed) over two chart panels (`timeline`, `aria-labelledby` pointing at
     `timeline-summary`; the unpressed panel is `hidden`, not unmounted, so both chart hosts stay
     live and only one paints):
     - **Route** (`chart-route`, `buildRouteChartDefinition`): a schematic metro line — a `link`
       mark per leg on a continuous linear x-scale over station index (equal spacing regardless
       of duration; a `scalePoint` x-scale was tried and dropped — its fractional midpoints rank
       as new categories, not proportional positions, which is what shifted every segment label
       one station over), in the leg's own colour, dashed for a missed connection; a `dot` per
       station; text marks for each leg's own numeral and duration, one merged `DST`/`DL` marker
       per leg (never per transition — two transitions on one leg would otherwise stack two
       identical labels), and — outside `compact` (< 640px host width) — each station's city,
       date and badges.
     - **To-scale** (`chart-scale`, `buildScaleChartDefinition`): a Gantt lane per leg on a real
       time axis (`barX`, `maxThickness` capped, stretched to a minimum visible width below
       `MIN_CHART_BAR_FRACTION` of the journey's span), a lighter dashed bar for a handoff/dwell,
       a `ruleX` per exact DST/Date-Line instant (nearby rules merged into one shared annotation
       label, all at the same row — never staggered), and a dashed `link` plus a "missed" text
       mark for a missed connection's conflict. A bar's duration label never sits inside it: to
       its right when there's room, else to its left, else folded into that lane's own y-axis
       label — always the card's own ink, since it never sits against a leg colour. The x-axis
       ticks are dates/times read through Temporal (`formatAxisTick`), never a native `Date`; its
       own `label` names the zone. Height is `laneChartHeight(legCount)` — content-sized, not an
       aspect ratio, so it stays the same height at 390px as at 1440px.
     Both views' tooltips (`stationTooltip`/`legTooltip`/`transitionTooltip`) carry the detail a
     compact or to-scale view drops from its own marks — city, date, badges, the ISO duration.
     `timeline-summary` (the charts' shared accessible name, kept in the DOM but visually
     hidden — the itinerary underneath it carries every value a sighted reader would otherwise
     re-read as a paragraph), a static legend (`legend`, naming the itinerary's own rail-dot
     conventions: departure/arrival, handoff, missed connection, DST/Date Line note), the
     itinerary (`journey`, an `<ol>` of date-group `<li>`s, each a heading plus a nested `<ol>` of
     event rows drawn as stops on a left-hand rail, one leg colour per stop), and `reason-aside`.
     - Every event is one leg's departure, one leg's arrival, a handoff, or a DST transition,
       grouped under the local-date heading (`Fri 8 Mar 2024`) the zone in which it happens puts
       it on, walked in strict instant order — never reordered by date. A date header gets a
       Date Line / zone-change annotation when the event landing in it crossed into a local date
       its previous zone's calendar would not yet have shown (or would already have passed),
       computed from Temporal alone (never named per preset): `"{City} date — crossed the Date
       Line"` or `"{City} date — the calendar skips ahead here"`.
     - A departure or arrival event is a solid dot on the rail, in its leg's own colour, with the
       mode icon, the local time (bold), city and offset, the leg number and mode, and the full
       zoned string on a muted second line (precision stays visible, not tooltip-only) — never a
       bordered box.
     - An arrival event also carries an `ETA` tag on the final leg's arrival when the journey
       resolved, and — when a booked-at instant exists — the offset-table check badge ("1 h
       early", "1 h late" or "agrees"), with the naive `HH:MM` spelled out beside it when they
       disagree.
     - A handoff event is a smaller, hollow dot on a dashed, lighter rail section, its own text
       smaller and muted (never bold): "Ready after {dwell} handling — " then either "the next
       leg leaves now" (for example "Ready after PT2H handling — the next leg leaves now"), "leaves 30 min
       after the cargo is ready", or, on the leg the connection was missed at, "Missed
       connection: scheduled to leave 06:30, before the cargo is ready." (a dotted purple
       rail section marks the row, matching the To-scale chart's own conflict marker).
     - A DST event has no dot at all — an annotation beside the line, italic and small, never a
       boxed row: "Los Angeles clocks spring forward 02:00 → 03:00", the wall-clock jump either
       side of the transition, for every zone the journey touches.
  3. `<h4>3. What <code>scheduleDelivery</code> returns</h4>`: `codeFrameHtml("delivery")` (gives
     `call-delivery` and `copy-delivery`), then `<output data-role="delivery-output">`.
- `mountDeliveryScheduler: MountFn<DeliverySchedulerArgs>`:
  1. Call `loadTransportLib()`, and on failure throw `WidgetLoadError`. Check `signal.aborted`.
  2. `applyArgs`, then delegated `input` and `change` listeners on the root, and
     `wireCopyButtons`. Mode's `<select>` fires on `change`, alongside the zone selects.
  3. Render: refresh every leg's header (number, icon, mode, duration, arrival city), then call
     `scheduleDelivery(legsOf(state), optionsOf(state))`. The output is `formatSchedule` or
     `NO SIGNAL`, with `renderAside(reasonEl, "caution", "Why null", …)` from `diagnose`. Then
     `collectJourneyFacts`, `buildItinerary`, `buildChartData`, the ETA summary card, both charts
     (`mountChart`'s first call, or `.update()` after) and the itinerary. A `ResizeObserver`
     re-renders only on a compact-breakpoint crossing (390px's dropped chart text, not every
     resize); a `MutationObserver` on `<html data-theme>` re-renders on a light/dark toggle, since
     a leg's colour is read from `var(--gmt-*)` at mount/update time, not live-recascaded.
  4. Typing sets the preset from `matchPreset`. Choosing a preset writes every field of every
     leg, including blanking fields, hiding fieldsets, and inserting a mode option a preset does
     not otherwise offer.
  5. The permalink state is `permalinkOf(state)`.
- **Do not copy `resolveWallTime`.** A zoneless departure on a later leg is `null` by the
  library's rule, and the widget shows that rule.
- **`src/lib/transport-icons.ts`** (new, generic — not a `delivery-*` file, and imports nothing
  from one): inline SVG icons for `truck`, `rail`, `ship`, `barge`, `air` and a `generic`
  fallback, 24×24, stroke-based, `currentColor`, legible at 16px. `transportIcon(mode, options?)`
  returns a standalone `<svg>` string, falling back to the generic icon for an unrecognized mode
  tag rather than nothing — `scheduleDelivery` never validates `mode`, so the widget must not
  either. `TRANSPORT_MODES` is the ordered list a mode picker offers. Registered in
  `src/components/Icon.astro`'s `BuiltInIcons` dictionary (`transport-truck` … `transport-
  generic`) so an MDX page can use them too. Shared with the Connection Checker, the Timetable
  Reader and the Crossing Clock, not owned by any one of them.
- **`src/lib/delivery-scheduler-charts.ts`** (new, chart-library-specific — mirrors
  `why-gmt-charts.ts`'s role beside its own plain data module): `buildRouteChartDefinition` and
  `buildScaleChartDefinition` (both described above), each a `defineChart` call over `ChartData`.
  Leg colour/ink and the `①②③④` numerals are this file's own constants — the same four house
  tokens the leg-card form and itinerary rail use, read as `var(--gmt-*)` strings passed straight
  into mark options (they resolve live in the rendered SVG's own DOM on a theme change, needing
  no `getComputedStyle` read — a genuine re-render still runs on a theme toggle, but only because
  the bar-label placement itself is a *computed* pixel decision, not because the colours need it).
  `CHART_FONT_SIZE = 12` is set directly on every text mark's `fontSize`, since a mark's font size
  is a plain attribute a CSS token cannot reach.

### C-a4. `src/lib/delivery-scheduler-mount.test.tsx` (jsdom, real gmt)

- `REQUIRED_ROLES`: `preset`, `preset-description`, `leg-count`, `start-zone`, `leg-1`…`leg-4`,
  `mode-1`, `departure-1`, `duration-1`, `zone-1`, `dwell-1` (and so on to 4), `eta-summary`,
  `eta-headline`, `eta`, `eta-duration`, `eta-flags`, `chart-toggle`, `view-route`, `view-scale`,
  `timeline`, `chart-route`, `chart-scale`, `timeline-summary`, `legend`, `journey`,
  `reason-aside`, `call-delivery`, `copy-delivery` and `delivery-output`.
- `EXPECTED`, a map from preset id to `[call, result]`. `dwell-handoff` is copied verbatim from
  the JSDoc (V2). The others are section 9's V30, V31, V32, V57 and V58, in the same literal
  style. Then `it.each(DELIVERY_PRESETS)`:
  - `copy-delivery`'s `dataset.copyText` equals the call;
  - the collapsed output equals the result, or `NO SIGNAL` for V32 with the `missed-connection`
    reason naming leg 2, 06:30, 05:00 and 07:00 in Los Angeles;
  - the ETA line equals `result.eta`;
  - every leg item's local arrival equals the result's.
- The ETA summary card carries the real headline, door-to-door span and flags, and turns into a
  failure state naming the leg on a missed connection.
- The Route chart draws one `link`/leg and one `dot`/station in `[data-role="chart-route"] svg`,
  each leg's own numeral among its text marks, a dashed link for a missed connection.
- The To-scale chart draws one `.ts-chart__bar-x rect` per reached leg (none for the missed one)
  and a "missed" text mark on a missed connection.
- The offset-table badge reads "1 h early" on leg 1 of `truck-ship-rail` and "1 h late" on both
  legs of `fall-back-night`, and no badge disagrees on `trans-pacific`.
- The chat seed V38 (`legs` array, no `legCount`) renders V38 and sets the leg count to 2.
- Typing `2024-03-10T07:30:00` (zoneless) into leg 2 of `truck-ship-rail` gives `NO SIGNAL`
  and `zoneless-later` (V34).
- For each `diagnose` reason, the rendered aside text is `SCHEDULE_NULL_TEXT`'s.
- Permalinks round-trip for every preset: `getPermalinkState()` holds only strings, and
  `encodeWidgetPermalink("delivery", s)` → `seedFromLocation` → remount gives the same output.
- An aborted mount is inert, and destroying twice is safe.

### C-a5. `src/components/DeliveryScheduler.astro`

Copy `DwellLedger.astro`: `renderDeliverySchedulerTemplate()`, `seedFromLocation("delivery")`,
`.gmt-delivery`, `showUnavailable` on catch.

### C-a6. `src/content/docs/tools/delivery-scheduler.mdx`

- `title: Delivery Scheduler`, description: "Chain truck, ship and rail legs into one ETA with
  scheduleDelivery: every handoff an exact instant, each arrival shown where it lands, and a
  missed connection shown as the null it is."
- An intro of about four short paragraphs. Each leg is a departure, a duration and the zone it
  lands in. The summary card leads with the ETA, its exact instant, the door-to-door span and
  small flags for what happened along the way; a missed connection turns it into a failure state
  naming the leg. Below it, a toggle switches between two charts of the same journey: Route
  draws it as a schematic line — one segment per leg, numbered and coloured, never sized by
  duration, so an eleven-day sea crossing and a two-and-a-half-hour rail leg read as the same
  length; To scale draws the same legs as lanes on a real time axis, so they read as what they
  are, with a handoff as a lighter bar and a missed connection as a broken link and a "missed"
  marker. The itinerary underneath lists the same journey top to bottom, on a rail in each leg's
  own colour, grouped by the local date each event falls on. Where a fixed offset would misread a
  handoff, both charts and the itinerary flag it — the Los Angeles arrival 1 h early, in the
  default journey — against the offset table's naive reading. The outputs are the real
  [`scheduleDelivery`](/reference/transport/calculate/scheduleDelivery/) call.
- `<DeliveryScheduler />`.
- "**Worth trying:**" PD1 (the ship at 06:30, a missed connection) and PD2 (leg 2's departure
  typed with no zone).
- A Reference paragraph linking `scheduleDelivery`, `transitTime`, `etaAtZone`, the
  [Connection Checker](/tools/connection-checker/) and the guide.

### C-a7. `src/styles/gmt-delivery-scheduler.css`

Registered after `gmt-transport-widgets.css` with `// Delivery Scheduler widget (TRAN-9)`.

- **Leg colour and number.** `.gmt-delivery [data-leg="1".."4"]` sets `--leg-color`/`--leg-ink` —
  four house tokens, each an already contrast-checked "ink" pair in both themes: cyan, spring,
  the DST purple and the teal-based `--gmt-severity-high` pair. Every leg-coloured DOM element (a
  leg card, an itinerary stop) carries the matching `data-leg` attribute (`legAccentAttr`,
  delivery-scheduler-mount.ts) and reads `var(--leg-color)`/`var(--leg-ink)`, never a literal.
  The two charts read the same four colours as `var(--gmt-*)` strings passed straight into mark
  options (`delivery-scheduler-charts.ts`'s own `legColor`/`legInk` — a duplicate small palette,
  since a chart mark option is not a CSS selector this stylesheet can reach). Never amber, which
  stays the sentinel's alone.
- **Leg cards:** `gmt-delivery-leg-grid` is this widget's own grid (not the shared
  `gmt-transport-leg-grid`), named-area, `minmax(0, …)` tracks: row 1 is Mode, Duration and
  Arrives in as three columns (a `<select>` truncates its own value with an ellipsis, unlike a
  clipped text `<input>`), then Departs/Scheduled departure and Dwell after each get a full-width
  row of their own — long enough that `2024-03-08T08:00:00-06:00[America/Chicago]` never clips.
  The fieldset itself carries a `border-left` in its own leg colour; `.gmt-delivery-leg-number`
  colours the `①②③④` badge with `--leg-ink`. `.gmt-delivery-optional` is the muted "optional"
  suffix; `.gmt-delivery-leg-icon` sizes a mode icon inline with the legend text. A narrow host
  (the `/dox` rail) stacks every field to one column via `@container`.
- **The ETA summary card** (`.gmt-delivery-summary`): a quiet bordered card, not a banner —
  `[data-state="failed"]` switches to the same dashed dst-purple border and ink the itinerary
  uses for a missed handoff, never amber/red/green. Flags are `.gmt-transport-badge`s in an
  unstyled `<ul>`, reusing the shared badge look rather than inventing a second one.
- **The two charts** (`.gmt-delivery-charts`): the toggle buttons, `.gmt-chart` itself, the
  tooltip and the charts' own forced-colours/reduced-transparency handling all live in the
  shared `gmt-charts.css` — this sheet adds only the wrapper's bottom margin and a floor on every
  chart text node (`.gmt-delivery-charts .gmt-chart text { font-size: 12px }`), since a mark's
  `fontSize` is a plain SVG attribute the shared sheet's tokens cannot reach (the axis's own
  label text is the one node not covered by the marks' own `fontSize` option, so this blanket
  rule is what floors it).
- **The itinerary rail:** date groups and their events are normal document flow — nothing here is
  absolutely positioned except the rail and its dot, so nothing here can overprint.
  `.gmt-delivery-day` gets a top rule and vertical spacing. Each `.gmt-delivery-event` draws its
  own rail section as a `::before` `border-left` in its leg's colour (never one continuous line
  the events sit on top of, so a handoff's own section can be dashed and lighter
  (`--handoff`) independently of its neighbours), with a real `.gmt-delivery-rail-dot` — solid
  for a departure/arrival, smaller and hollow-dashed for a handoff — positioned on top of it. A
  missed handoff (`.gmt-delivery-event--missed`) turns its own rail section dotted purple. A DST
  note (`.gmt-delivery-event--dst`) draws no rail section and no dot at all — an annotation
  beside the line, italic and small, never boxed. The exact ISO value sits on its own muted line
  under the bold local time, `overflow-wrap: anywhere` so a long zoned string wraps rather than
  overflows. `.gmt-delivery-visually-hidden` is the two charts' shared accessible-name
  paragraph: real text, clipped to 1px rather than shown as a redundant paragraph, since the
  itinerary already carries everything in it.
- **Legend:** `.sl-markdown-content ul li::before` (gmt-content.css) draws every markdown bullet
  as a dash into the padding it also reserves for it — a site-wide rule the legend's own `<ul>`
  inherits by accident. `ul.gmt-delivery-legend > li` and its `::before` reset both, matched at
  the same selector depth so the override wins on specificity, not on load order. The legend
  names the itinerary rail's own conventions (departure/arrival, handoff, missed connection,
  DST/Date Line note) — the two charts' own conventions are in their tooltips and, on the Route
  view, right on the chart as the `①②③④` numerals and `DST`/`DL` text marks.
- No `transition` or `animation` on anything that shows a value; a top-level
  `@media (prefers-reduced-motion: reduce)` rule kills any that would apply anyway.
- `gmt-a11y.css`, inside the existing `@media (forced-colors: active)` block: the two charts' own
  forced-colours handling lives in the shared `gmt-charts.css` (leg identity there survives
  through the `①②③④` badge text alone, never colour alone); this widget's own rules cover what
  the shared sheet does not — `.gmt-delivery-event { forced-color-adjust: none; border-color:
  CanvasText; }`, `.gmt-delivery-rail-dot` gets `forced-color-adjust: none; background: Highlight;
  border-color: CanvasText;` (the handoff dot's own hollow centre stays `Canvas`), and
  `.gmt-transport-badge` (shared) gets `forced-color-adjust: none; color: CanvasText; outline: 1px
  solid CanvasText;`. Kind (departure/arrival, handoff, missed) still reads from border style —
  solid, dashed, dotted — which gradients dropping under forced colours never touches.

### C-a8. Chat registration

| Item | Value |
| --- | --- |
| Schema (`dox-tools.ts`) | `showDeliverySchedulerInput = z.object({ legs: z.array(z.object({ departure: dateTimeSchema.optional(), duration: durationSchema, timeZone: zoneSchema, dwellAfter: durationSchema.optional(), mode: z.string().min(1).max(16).optional() })).min(1).max(4), startTimeZone: zoneSchema.optional() })`. Add `export const durationSchema = z.string().min(3).max(32);` with a comment that it checks shape, not validity. |
| Doc `purpose` | "A multi-leg journey — truck, ship, rail — chained by scheduleDelivery into one ETA, with every handoff an exact instant, each arrival shown in the zone it lands in, and a missed connection shown as null." |
| Doc `when` | "the reader asks when a multi-leg or multi-modal shipment arrives, or what local time each leg lands at across a DST change or the Date Line" |
| Doc `args` | "legs (1 to 4, in travel order): departure (ISO date-time with an offset or a bracketed zone; required on the first leg; on a later leg only when it has a scheduled departure), duration (ISO 8601 time units such as PT46H or P11D; no months or years), timeZone (IANA id where the leg arrives), dwellAfter (optional handling time at the handoff after the leg), mode (optional tag such as truck, ship or rail). startTimeZone (optional IANA id a zoneless first departure is read in). Never invent a zone: ask if the reader did not name one." |
| Worker (`worker/tools.ts`) | `execute`: `unknownZones([...legs.map((l) => l.timeZone), ...(startTimeZone ? [startTimeZone] : [])])`, reject naming them, else `accept("delivery-scheduler")`. |
| Registry | `deliveryEntry = defineWidget<DeliverySchedulerArgs>({ title: "Delivery scheduler", kind: "delivery", parse, load: () => import("~/lib/delivery-scheduler-mount")…, validate: (a) => checkZones([...a.legs.map(l => l.timeZone), ...(a.startTimeZone ? [a.startTimeZone] : [])]) })` |
| Permalink | `"delivery"` in `WidgetKind`, `delivery: "/tools/delivery-scheduler/"` |
| Starter | text: "A truck leaves Chicago at 08:00 on 8 March 2024: 46 h to Los Angeles, then 11 days by ship to Tokyo. ETA?" (105 characters). args: `{ legs: [{ departure: "2024-03-08T08:00:00-06:00[America/Chicago]", duration: "PT46H", timeZone: "America/Los_Angeles", mode: "truck" }, { duration: "P11D", timeZone: "Asia/Tokyo", mode: "ship" }] }`, with a comment that the question names no handling time, so there is no dwell. Result: V38. |

---

## C-b. Crossing Clock: `crossingTime`, `/tools/crossing-clock/`, key `crossing`

Root: `<div class="gmt-crossing gmt-widget">`.

### C-b1. `src/lib/crossing-clock.ts` (pure)

- `CrossingClockArgs = { entry?, exit?, targetZone? }` (strings).
- `CROSSING_ZONES = [...TRANSPORT_ZONES, ...FIXED_OFFSET_ZONES]`.
- `CROSSING_PRESETS`:

  | id | label | entry, exit, targetZone | result |
  | --- | --- | --- | --- |
  | `canal` | A 9½-hour canal transit, read in Berlin | V46's | V46 |
  | `spring-forward` | Seven hours across New York's spring-forward | V48's | V48 |
  | `fall-back` | One hour across the fall-back: both ends read 01:30 | V49's | V49 |
  | `fixed-offset` | The same spring-forward night on a fixed −05:00 | V56's | V56 |
  | `read-elsewhere` | Logged in Berlin, read on the canal's clock in Panama | V55's | V55 |
  | `inverted` | Exit before entry | V52's | V52 (`null`) |

  Descriptions say what the numbers show. Example for `spring-forward`: "Seven hours pass. The
  clocks read 00:00 and 08:00, because New York skipped 02:00. Subtracting the wall clocks says
  eight."
- `naiveWallDifference(result)`: the naive value. The `YYYY-MM-DDTHH:MM` of `enter` and `exit`
  read as plain wall times and subtracted, in minutes. It gives 480 for V48, 0 for V49, 570 for
  V46, 420 for V56 and 570 for V55. `naiveText(elapsedMinutes, naiveMinutes)` gives "8 h: 1 h
  more than elapsed", "0 min: 1 h less than elapsed" or "9 h 30 min: agrees".
- `hourRuler(result, targetZone)`: ticks at the entry instant plus every whole elapsed hour up
  to the exit, then the exit. Each is labelled `HH:MM ±hh:mm` in `targetZone` through the
  polyfill. Cap: past 48 ticks, step by `ceil(hours / 48)` hours and say so. It flags `skipped`
  between two ticks whose wall clocks are two hours apart after one elapsed hour ("02:00 never
  shows"), and `repeat` on a tick whose wall time already appeared. V48 gives 00:00, 01:00,
  03:00 … 08:00, with the skip between 01:00 and 03:00. V49 gives `01:30 −04:00` and
  `01:30 −05:00`, flagged `repeat`.
- `NULL_REASON_TEXT` and `explainNull(entry, exit, zone, lib)`, in `crossingTime`'s order:
  `invalid-entry`, `invalid-exit` (each: "not an instant: it needs a Z, an offset, or an offset
  with a bracketed zone"), `unknown-zone`, `inverted` ("An exit before its entry is a data
  error, not a negative transit.").
- `readArgs`, `matchPreset` and `permalinkOf` (strings only).

**Redesigned around two analog clocks, a proportional strip and dial highlights
(owner review, four passes after the first build).** The shape below is what
actually shipped; `hourRuler`/`RulerTick` do not exist — `crossingStrip` and
`CrossingChangeMarker` replaced them outright.

- **`CROSSING_PRESETS` leads with the two clock-change cases**, because a skipped
  or repeated hour is the tool's main lesson. Order and labels:
  1. `spring-forward` — "Skipped hour: seven hours across New York's spring-forward"
     (the default, unseeded state).
  2. `fall-back` — "Added hour: one hour across New York's fall-back, both ends
     read 01:30".
  3. `fixed-offset`, 4. `canal`, 5. `read-elsewhere`, 6. `inverted` — unchanged
     values, ids and permalinks; only their position and (for 1–2) their label
     and description moved. Every description now opens by naming the lesson
     ("The clocks jump from 02:00 to 03:00…" / "The clocks fall back from 02:00
     to 01:00…") rather than the elapsed-hours count.
- **Two crystal clocks (`src/lib/crystal-clock.ts`), one per end.** A shared,
  reusable analog face — pure geometry plus an SVG-string renderer, no
  framework, the same shape as `dox-mark.ts` — first adopted here, written so
  the Connection Checker, the Timetable Reader and the DST Inspector can adopt
  it later. It is deliberately **not** a Dox-mark treatment at clock size: no
  facet ring, no spokes, no gradient face. The only borrowed shape is a
  hairline 12-sided (dodecagon) outline, oriented so a flat side — not a
  vertex — centres under each hour tick (`vertexAngle`, offset 15° from the
  hour angles). The dial fills nearly the whole shape: fine ticks (heavier at
  12/3/6/9), a slim hour hand, a slimmer longer minute hand, a small centre
  cap, hands cast a soft drop-shadow onto the dial.
  - `crossingClockFace(zoned)` in `crossing-clock.ts` reads one of
    `crossingTime`'s own `enter`/`exit` strings into `{ hour, minute, offset,
    zoneLabel, dateLabel, timeLabel }` — every field copied, nothing computed.
    `isRepeatedReading` flags the fall-back case (identical wall clocks, real
    instants apart) so both faces get `state: "repeated"`.
  - **Ice-glass pane.** A translucent layer over the whole dial — two SVG
    polygons on a copy of the bezel's own dodecagon (never a smaller,
    separate shape, so it always reaches the frame on every side): a vertical
    tint (`--gmt-ice` brightness up top fading through `--gmt-glass-tint-subtle`
    to a `--gmt-teal` falloff at the bottom) and a radial sheen centred just
    above the top-left frame edge. Both gradients, the clip-path and the hand
    shadow filter live in the SVG markup (`<defs>`), not CSS, and every id is
    suffixed with the caller's `id` so Entry and Exit never collide.
  - **The night light.** An easter egg — never named after the trademarked
    feature it echoes, anywhere. `glowable` (default `true`) wraps the face in
    a real `<button type="button" aria-pressed>`; clicking or tapping floods
    the face `--gmt-cyan` and flips ticks/hands/cap to `--gmt-void` (never
    left cyan-on-cyan), with a 150ms fade, instant under
    `prefers-reduced-motion`, ignored under `forced-colors`. `bindClockGlow(root,
    signal)` delegates the click on `root` rather than the button — `render()`
    replaces the button on every input change — and is called once from
    `mountCrossingClock`. Pure presentation: it never touches a value, the
    permalink or a chat argument, and a fresh render always starts un-glowed.
  - **The highlight.** `highlight?: { fromHour, fromMinute, toHour, toMinute,
    kind: "skipped" | "repeated" }` draws the affected wall-clock hour as a
    sector between the tick ring and the centre — `skipped` one dashed
    pie-wedge outline, `repeated` two concentric solid arcs, so the two read
    apart by shape before colour (`--gmt-dst-purple`, the same token the
    Delivery Scheduler's DST rows use, with a `forced-colors` fallback to
    `CanvasText`). The angle is the hour hand's own formula (`hourMarkAngle`,
    reusing `handAngles`), never hand-picked per preset. The highlight's own
    label ("02:00–03:00 never shown") folds into the button's accessible
    name. Both clocks get it — they read the same `targetZone` — since only
    the first `CrossingChangeMarker` draws (one sector, not a list).
  - **Bug (owner found, fixed):** the hands' shadow filter defaulted to
    `filterUnits="objectBoundingBox"`. At 00:00, 06:00, 12:00 and 18:00 the
    hour and minute hands are exactly collinear, so the filtered group's own
    bounding box has zero width or height, an empty filter region, and the
    whole group — both hands — rendered as nothing. Fixed with
    `filterUnits="userSpaceOnUse"` and an explicit region pinned to the
    viewBox (`x="0" y="0" width="100" height="100"`), which never depends on
    the hands' own geometry.
- **The crossing strip (`crossingStrip`) replaced the hour-ruler chips.** The
  original ruler — one flex-wrap chip per whole elapsed hour, plus a visible
  prose paragraph repeating every chip — read as "a massive amount of text"
  once real clocks carried the entry/exit readings. It is now one compact
  proportional bar, entry → exit:
  - `entryLabel`/`exitLabel` (`HH:MM ±hh:mm`) at the bar's own ends.
  - `tickPercents`: faint, unlabelled real-time positions (entry, every whole
    elapsed hour, exit), same 48-tick cap and `stepHours` widening as the old
    ruler, computed with `crossingTime`'s own duration.
  - `changes: CrossingChangeMarker[]`: every DST transition inside the span
    (mirrors `delivery-scheduler.ts`'s `dstTransitionsIn` — `getTimeZoneTransition
    ("next")` plus the offset either side, at most 4), each a single point (the
    jump is instantaneous in real time) with a `kind`, a `percent`, a prose
    `label`, and the `fromHour`/`fromMinute`/`toHour`/`toMinute` pair the
    crystal clock's `highlight` option draws from. A crossing with none gets
    one quiet sentence ("No clock change during the crossing — every hour
    showed once") instead of an empty list.
  - `summary`: the bar's accessible name, `aria-labelledby`, visually hidden
    with the new shared `.gmt-transport-visually-hidden`
    (`gmt-transport-widgets.css` — identical to, and added beside, the
    pre-existing `.gmt-delivery-visually-hidden`; a shared addition, flagged
    per the builder's brief). The legend (`data-role="legend"`) only lists
    the kinds that actually occur in this crossing, and collapses
    (`:empty { display: none }`) when there are none.
- **`.gmt-crossing-clocks` is a five-row CSS grid**, not two independent flex
  columns: `grid-template-areas` places entry's heading/face/time/meta/date in
  column 1 and exit's in column 3, so `align-items: start` top-aligns every
  row across both columns identically (owner review: independent flex
  columns drifted out of alignment once their total heights happened to
  differ). The connector occupies only the face row (`grid-area: co`) with
  `align-self: center`, so it centres on the clock faces alone, never the
  whole column. Below 30rem it collapses to a single stacked column.
- **Data-role changes from the original C-b3 shape below:** `entry-heading`/
  `exit-heading` (new), `strip-entry-label`, `strip-track`,
  `strip-exit-label`, `strip-changes` (new, replacing the old `tick-N`/`gap-N`
  roles), `connector` (new, on the connector div). `ruler`, `ruler-summary`,
  `legend`, `entry-clock`/`exit-clock`/`-time`/`-meta`/`-date` are unchanged
  in name though `ruler`'s subtree and `ruler-summary`'s visibility changed.

### C-b2 to C-b7

- **C-b2 test.** Cover presets, `naiveWallDifference` for every preset, `hourRuler` for V48, V49
  and V46, the 48-tick cap with a 10-day crossing, and `explainNull`.
- **C-b3 mount.**
  - `<h4>1. Log the crossing</h4>`: preset, entry and exit (text, no placeholder), and
    "Read on the clock of" (`target-zone`, a select of `CROSSING_ZONES`).
  - `<h4>2. Elapsed, and what the clocks say</h4>`: `elapsed` (the result's `duration`,
    `aria-live`), `naive` (the naive difference and its badge), `ruler` (`role="img"` labelled
    by `ruler-summary`), `ruler-summary`, `legend`, `reason-aside`.
  - `<h4>3. What <code>crossingTime</code> returns</h4>`: `codeFrameHtml("crossing")`, then
    `crossing-output`.
  - `applyArgs` reads a zoneless chat or permalink `entry` and `exit` in `targetZone` with the
    Dwell Ledger's `resolveWallTime` (import it from `dwell-ledger.ts`, with
    `disambiguation: "reject"`). This matches `showDwellLedger`, and a wall time in a skipped
    hour stays as typed and shows the sentinel. It is the only tool that reads wall times this
    way, because `crossingTime` has no wall-time rule of its own.
- **C-b4 mount test.**
  - `REQUIRED_ROLES`: the roles above, plus `preset`, `preset-description`, `entry`, `exit`,
    `target-zone`, `call-crossing`, `copy-crossing` and `crossing-output`.
  - `EXPECTED` is copied verbatim from the `crossingTime.ts` JSDoc for `canal`,
    `spring-forward`, `fall-back` and `inverted`, and from section 9 for V55 and V56. For each
    preset, assert the call, the collapsed output, the elapsed text, and the naive text above.
  - The chat seed `{ entry: "2024-03-10T00:00", exit: "2024-03-10T08:00", targetZone:
    "America/New_York" }` renders V94.
  - Also cover the permalink round-trip, the aborted mount and the double destroy.
- **C-b5 shell.** `CrossingClock.astro`.
- **C-b6 page `tools/crossing-clock.mdx`.**
  - Title "Crossing Clock". Description: "Time a canal, strait or border crossing with
    crossingTime: exact elapsed hours, the entry and exit on the clock that administers it,
    and the wall-clock subtraction that is an hour off on a DST night."
  - Intro, then `<CrossingClock />`.
  - "Worth trying": PX1 (the fall-back night) and PX2 (the spring-forward night read on a fixed
    −05:00).
  - One sentence: a day count for a stay is [`dwellTime`](/reference/transport/calculate/dwellTime/),
    drawn in the [Dwell Ledger](/tools/dwell-ledger/).
- **C-b7 CSS `gmt-crossing-clock.css`.** Registered with `// Crossing Clock widget (TRAN-9)`.
  The ruler is a row of ticks with labels below. `skipped` is a gap drawn with a dashed border
  and the text "02:00 never shows". `repeat` is a tick with a double border and the text
  "repeats". Forced-colours rules sit beside the others:
  `.gmt-crossing-tick { forced-color-adjust: none; border-color: CanvasText; }`.

### C-b8. Chat registration

| Item | Value |
| --- | --- |
| Schema | `showCrossingClockInput = z.object({ entry: dateTimeSchema, exit: dateTimeSchema, targetZone: zoneSchema })` |
| `purpose` | "A crossing — a canal transit, a strait passage, a border queue — timed by crossingTime: the exact elapsed hours, with the entry and exit read on the clock of the zone that administers it." |
| `when` | "the reader asks how long a crossing, transit or passage between two logged times really took, or what the entry and exit read on one zone's clock, especially across a DST change" |
| `args` | "entry, exit (ISO date-times; a plain 2024-03-10T00:00 is read as wall time in targetZone), targetZone (IANA id of the clock the crossing is read on)" |
| Worker | `isValidTimeZone(targetZone)` else reject, `accept("crossing-clock")` |
| Registry | `crossingEntry`, `title: "Crossing clock"`, `kind: "crossing"`, `validate: ({ targetZone }) => checkZones([targetZone])` |
| Permalink | `crossing: "/tools/crossing-clock/"` |
| Starter | "A border crossing in New York runs 00:00 to 08:00 on 10 March 2024. How many hours really passed?" (97 characters). args `{ entry: "2024-03-10T00:00", exit: "2024-03-10T08:00", targetZone: "America/New_York" }`, with the comment "Wall times, read in targetZone by the widget." Result: V94. It differs from the Dwell Ledger's pill, which asks for days. |

---

## C-c. Connection Checker: the missed-connection rule, `/tools/connection-checker/`, key `connection`

Root: `<div class="gmt-connection gmt-widget">`.

### C-c1. `src/lib/connection-checker.ts` (pure)

- `ConnectionState`: `inboundDeparture`, `inboundDuration`, `portZone`, `handlingMinutes`,
  `onwardDeparture`, `onwardDuration`, `onwardZone` (all strings). The chat's
  `handlingMinutes` is a number, and the permalink's a string.
- `legsOf(state)`:
  `[{ departure: inboundDeparture, duration: inboundDuration, timeZone: portZone, dwellAfter: \`PT${handlingMinutes}M\` }, { departure: onwardDeparture, duration: onwardDuration || "PT0S", timeZone: onwardZone || portZone }]`.
  A blank onward duration or zone falls back as shown. The hint says so: "The onward leg's run
  time does not change whether the connection is made." The printed call is always the real
  call.
- `CONNECTION_PRESETS`:

  | id | label | inbound | handling | onward | result |
  | --- | --- | --- | --- | --- | --- |
  | `made` | Lands 13:10, train at 14:00, 45 min handling | `2024-06-14T22:10:00+02:00[Europe/Berlin]`, `PT15H`, `Europe/Amsterdam` | 45 | `2024-06-15T14:00:00[Europe/Amsterdam]`, `PT12H`, `Europe/Rome` | V59 |
  | `zero-slack` | 50 min handling: ready exactly at 14:00 | same | 50 | same | V60 |
  | `spring-forward` | The same barge the night the clocks spring forward | `2024-03-30T22:10:00+01:00[Europe/Berlin]`, `PT15H`, `Europe/Amsterdam` | 45 | `2024-03-31T14:00:00[Europe/Amsterdam]`, `PT12H`, `Europe/Rome` | V62 (`null`) |
  | `zone-change` | A flight whose landing time was printed in London | `2024-06-15T12:10:00+01:00[Europe/London]`, `PT1H`, `Europe/Amsterdam` | 45 | `2024-06-15T14:00:00[Europe/Amsterdam]`, `PT12H`, `Europe/Rome` | V63 (`null`) |

- `verdict(facts)` comes from the library only. `result !== null` means **made**. The slack is
  `departureAt(onward) − readyAt(0)` (V65–V69). Zero slack is "Made with zero slack: the train
  leaves exactly when the cargo is ready. Equal passes." A `null` whose `diagnose` reason is
  `missed-connection` means **missed**: "Missed: the train leaves 55 min before the cargo is
  ready." Any other reason means **no verdict**, and the reason aside explains it. The ready
  and departure times are shown through `etaAtZone` in `portZone` (V70, V71).
- `naiveCheck(state)`: the naive value, "the times as printed". The inbound departure's written
  wall clock (the `YYYY-MM-DDTHH:MM` text before any offset or bracket), plus its duration as a
  wall-clock addition (polyfill `PlainDateTime.add`), plus the handling time, compared with
  the onward departure's written wall clock. It returns
  `{ lands: "13:10", ready: "13:55", leaves: "14:00", made: true, spareMinutes: 5 }` for
  `made`. `zero-slack` gives ready 14:00 and made. `spring-forward` and `zone-change` both give
  lands 13:10, ready 13:55, made, **while the library says missed** (ready 14:55 in Amsterdam,
  the train at 14:00).
- `readArgs`, `matchPreset` and `permalinkOf` (strings only).

### C-c2 to C-c7

- **C-c2 test.** Presets, `legsOf` (the onward fallback, `PT0M` at zero handling), `naiveCheck`
  for all four presets, `readArgs` (a number or a string), and `matchPreset`.
- **C-c3 mount.**
  - `<h4>1. The handoff</h4>`: preset; "Inbound departs", "Inbound duration" and "Arrives at
    the port in" (`port-zone` select); the handling slider
    `<input type="range" data-role="handling" min="0" max="240" step="1">` with a visible label
    "Handling time (minimum connect time)" and an `<output data-role="handling-value">` showing
    `PT45M (45 min)`; "Onward departs", "Onward duration (optional)" and "Onward arrives in
    (optional)" (a select with a "(the port's zone)" option).
  - `<h4>2. Made or missed</h4>`: two rows side by side, stacking below a container width:
    `verdict` ("scheduleDelivery", `aria-live="polite"`) and `naive-verdict` ("The times as
    printed"), each with arrival, ready and departure. A `disagrees` badge appears when the
    two differ. Below them, a mini strip (`handoff-strip`, `role="img"` labelled by
    `handoff-summary`): the arrival, a hatched handling bar to ready, and the departure marker,
    on a port-local axis from 90 min before arrival to 90 min after the later of ready and
    departure. Then `reason-aside`.
  - `<h4>3. What <code>scheduleDelivery</code> returns</h4>`: `codeFrameHtml("connection")`,
    then `connection-output`.
  - Moving the slider re-renders on `input`. Arrow keys move one minute, as the native control
    does.
- **C-c4 mount test.**
  - For each preset, assert the call, the output (V59, V60, or `NO SIGNAL`), both verdict
    texts, and the `disagrees` badge on `spring-forward` and `zone-change` only.
  - Setting the slider on `made` to 50 gives zero slack (V60), and 51 gives missed by 1 min
    (V61).
  - At 0, the call carries `dwellAfter: "PT0M"` (V64).
  - The chat seed (below) renders `NO SIGNAL`, a missed verdict and a naive "made".
  - Also cover the permalink round-trip, the abort and the double destroy.
- **C-c5 shell.** `ConnectionChecker.astro`.
- **C-c6 page `tools/connection-checker.mdx`.**
  - Title "Connection Checker". Description: "Will the cargo make its onward departure?
    scheduleDelivery checks a scheduled connection against the arrival plus the handling time,
    and equal passes, beside the wall-clock check that says made when it is not."
  - Intro, then `<ConnectionChecker />`.
  - "Worth trying": PC1 (handling 51, missed by a minute) and PC2 (the spring-forward barge).
  - A Reference paragraph linking `scheduleDelivery`, the
    [Delivery Scheduler](/tools/delivery-scheduler/) and the guide section.
- **C-c7 CSS `gmt-connection-checker.css`.** Registered with
  `// Connection Checker widget (TRAN-9)`. Restyle the range input with the house control
  tokens, keeping the native control. The verdicts use body-copy colour: made and missed are
  words, never colours.

### C-c8. Chat registration

| Item | Value |
| --- | --- |
| Schema | `showConnectionCheckerInput = z.object({ inboundDeparture: dateTimeSchema, inboundDuration: durationSchema, portZone: zoneSchema, handlingMinutes: z.number().int().min(0).max(240), onwardDeparture: dateTimeSchema, onwardDuration: durationSchema.optional(), onwardZone: zoneSchema.optional() })` |
| `purpose` | "One handoff checked by scheduleDelivery: an arriving leg, the handling time at the port (the minimum connect time) and a scheduled onward departure, made or missed, beside the naive check of the times as printed." |
| `when` | "the reader asks whether cargo or a passenger makes a scheduled onward departure after a handoff with a given handling time" |
| `args` | "inboundDeparture (ISO date-time with an offset or a bracketed zone), inboundDuration (ISO 8601 time units), portZone (IANA id of the handoff), handlingMinutes (whole minutes, 0 to 240; ask if the reader did not say), onwardDeparture (the scheduled departure, with a bracketed zone, e.g. 2024-03-31T14:00:00[Europe/Amsterdam]), onwardDuration and onwardZone (optional)" |
| Worker | `unknownZones([portZone, ...(onwardZone ? [onwardZone] : [])])` |
| Registry | `connectionEntry`, `title: "Connection checker"`, `kind: "connection"`, `validate` checks both zones |
| Permalink | `connection: "/tools/connection-checker/"` |
| Starter | "Barge leaves Duisburg 22:10, 30 March 2024, 15 h to Amsterdam, 45 min handling: does it make the 14:00 train?" (109 characters, one under the limit). args `{ inboundDeparture: "2024-03-30T22:10:00+01:00[Europe/Berlin]", inboundDuration: "PT15H", portZone: "Europe/Amsterdam", handlingMinutes: 45, onwardDeparture: "2024-03-31T14:00:00[Europe/Amsterdam]" }`, with the comment "Duisburg is on Europe/Berlin's clock. The night of 30–31 March 2024 springs forward, so the printed-clock check says made and scheduleDelivery says missed." Result: V72 (`null`, missed). |

---

## C-d. Timetable Reader: `startTimeZone`, `/tools/timetable-reader/`, key `timetable`

Root: `<div class="gmt-timetable gmt-widget">`.

### C-d1. `src/lib/timetable-reader.ts` (pure)

- `TimetableState`: `startTimeZone`, `duration`, `timeZone`, and four rows, each
  `{ departure, offset }` (strings). A row with a blank departure is skipped. The chat sends
  `departures: string[]` and optional `offsets: string[]`. The permalink sends `departure1…4`
  and `offset1…4`.
- `rowDeparture(row, zone)`: the printed text when `offset` is blank, else
  `${printed}${offset}[${zone}]`. That is the string passed.
- `rowCall(state, i)`: `scheduleDelivery([{ departure: rowDeparture, duration, timeZone }], { startTimeZone })`.
  Each row is its own call.
- `classify(printed, zone, lib)`: from the library only. `e = resolveLocal(printed, zone,
  { disambiguation: "earlier" })` and `l = …"later"`. `e === l` → `once`. When they differ,
  it is `twice` when the `HH:MM` of `etaAtZone(e, zone)` equals the printed `HH:MM`, else
  `skipped` (V89–V93). Badges: `once` shows no badge; `twice` "Occurs twice: the earlier
  instant" (or "Offset written: this pass" when the row has an offset); `skipped` "Never
  shows on the clock: the later instant". An offset written into a `skipped` row gives
  `NO SIGNAL` with the reason "No offset names a time this clock skipped. Leave the offset off
  and it resolves to the later instant." (V83).
- `leavesAt(state, i, lib)`: the exact departure, `scheduleDelivery([{ departure: rowDeparture,
  duration: "PT0S", timeZone: startTimeZone }], { startTimeZone }).legTimes[0].localArrival`
  (V86–V88).
- `TIMETABLE_PRESETS`:

  | id | label | zone, run | rows | results |
  | --- | --- | --- | --- | --- |
  | `fall-back` | New York's fall-back night: 00:30, 01:30, 02:30 | `America/New_York`, `PT1H` to `America/New_York` | `2024-11-03T00:30:00`, `…01:30:00`, `…02:30:00` | V76, V77, V78 |
  | `offset-picks` | 01:30 twice: with no offset, then with −05:00 | same | `2024-11-03T01:30:00`; `2024-11-03T01:30:00` with offset `-05:00` | V77, V79 |
  | `spring-forward` | New York's spring-forward night: 01:30, 02:30, 03:30 | same | `2024-03-10T01:30:00`, `…02:30:00`, `…03:30:00` | V80, V81, V82 |
  | `published-local` | A published 10:00, read in New York | `America/New_York`, `PT1H` to `UTC` | `2024-06-15T10:00:00` | V4 (JSDoc) |
  | `berlin-fall-back` | Berlin's fall-back night: 02:30 | `Europe/Berlin`, `PT1H` to `Europe/Amsterdam` | `2024-10-27T02:30:00` | V84 |

  The `spring-forward` description: "02:30 never shows on a New York clock that night, so it
  resolves to 03:30, the same instant as the row printed 03:30. Two timetable rows, one
  departure."
- `readArgs`, `matchPreset` and `permalinkOf`.

### C-d2 to C-d7

- **C-d2 test.** Cover `classify` for every preset row (`once` for 00:30 and 02:30 on
  3 November, `twice` for 01:30, `skipped` for 02:30 on 10 March, `twice` for Berlin's 02:30),
  `rowDeparture`, `readArgs` (a chat array or flat keys), and `matchPreset`.
- **C-d3 mount.**
  - `<h4>1. The timetable</h4>`: preset; "Printed in" (`start-zone`, a select); "Run time"
    (`duration`, text); "Arrives in" (`zone`, a select); four row groups, each with "Printed
    departure" (`departure-n`, text, no placeholder) and "Offset (optional)" (`offset-n`,
    text).
  - `<h4>2. What each printed time means</h4>`: a `<table data-role="rows">` with the columns
    Printed, Leaves (exact), Badge and Local arrival. Then `reason-aside`, and a static note
    linking the [DST Inspector](/tools/dst-inspector/) for the general rule.
  - `<h4>3. What <code>scheduleDelivery</code> returns</h4>`: a "Show the call for"
    `<select data-role="row-pick">` of the non-blank rows, `codeFrameHtml("timetable")`, then
    `timetable-output` for the picked row.
- **C-d4 mount test.**
  - For each preset, assert every row's Leaves, badge and local arrival, and the picked row's
    call and output. `published-local` is copied verbatim from the JSDoc (V4).
  - On `spring-forward`, rows 2 and 3 show the same Leaves text.
  - Typing `-05:00` into row 2's offset on `spring-forward` gives `NO SIGNAL` and the
    skipped-offset reason (V83).
  - The chat seed renders V84, and its row shows the "Occurs twice" badge.
  - Also cover the permalink round-trip, the abort and the double destroy.
- **C-d5 shell.** `TimetableReader.astro`.
- **C-d6 page `tools/timetable-reader.mdx`.**
  - Title "Timetable Reader". Description: "Read a timetable's printed local times as exact
    instants with scheduleDelivery's startTimeZone: a repeated time takes the earlier
    instant, a skipped one the later, and a written offset picks the other pass."
  - Intro: timetables print wall times with no offset. The zone they are printed in makes
    them exact. For the general DST rule see the DST Inspector. This tool is about reading a
    transport timetable.
  - `<TimetableReader />`.
  - "Worth trying": PT1 (the spring-forward rows) and PT2 (an offset written into the skipped
    hour).
  - A Reference paragraph linking `scheduleDelivery`,
    [`resolveLocal`](/reference/instant/convert/resolveLocal/) and the guide section.
- **C-d7 CSS `gmt-timetable-reader.css`.** Registered with
  `// Timetable Reader widget (TRAN-9)`. The table uses the content table styles. Badges are
  text with an outline, never colour alone, and never amber.

### C-d8. Chat registration

| Item | Value |
| --- | --- |
| Schema | `showTimetableReaderInput = z.object({ startTimeZone: zoneSchema, departures: z.array(dateTimeSchema).min(1).max(4), offsets: z.array(z.string().max(9)).max(4).optional(), duration: durationSchema, timeZone: zoneSchema })` |
| `purpose` | "A transport timetable's printed local departure times read as exact instants through scheduleDelivery's startTimeZone, marking a time the clock shows twice (the earlier instant) or never (the later instant)." |
| `when` | "the reader asks which instant a printed timetable or schedule departure time means, especially on a night the clocks change" |
| `args` | "startTimeZone (IANA id the timetable is printed in), departures (1 to 4 wall times as printed, e.g. 2024-10-27T02:30:00, with no offset), offsets (optional, one per departure, to pick a pass), duration (the run time, ISO 8601 time units), timeZone (IANA id where it arrives)" |
| Worker | `unknownZones([startTimeZone, timeZone])` |
| Registry | `timetableEntry`, `title: "Timetable reader"`, `kind: "timetable"`, `validate` checks both zones |
| Permalink | `timetable: "/tools/timetable-reader/"` |
| Starter | "A timetable prints 02:30 on 27 October 2024 in Berlin, a 1 h run to Amsterdam. Which instant is that?" (101 characters). args `{ startTimeZone: "Europe/Berlin", departures: ["2024-10-27T02:30:00"], duration: "PT1H", timeZone: "Europe/Amsterdam" }`. Result: V84. It does not reuse the DST Inspector pill's New York 01:30 on 3 November. |

---

## C-x. Registration common to all four

Each item is guarded by the named test.

- `dox-tools.ts`: the four schemas, `durationSchema`, the four `DoxToolName` members,
  `DOX_TOOL_INPUTS`, four `DOX_TOOL_DOCS` entries (indices 7–10) and `DOX_TOOLS`
  (`DOX_TOOL_DOCS[7…10].purpose`), and `ENABLED_TOOL_NAMES`. (`widget-registry.test.ts`,
  `chat-handler.test.ts`)
- `worker/tools.ts`: four tools with a trivial `execute`. (`tools.test.ts`)
- `widget-registry.ts`: four `import type` lines and four entries in `WIDGET_REGISTRY`.
  (`widget-registry.test.ts`, `widget-graph.test.ts`)
- `widget-permalink.ts`: four `WidgetKind` members and paths. (`widget-permalink.test.ts`, whose
  content test checks every permalink in section P)
- `chat-constants.ts`: four `CHAT_STARTERS`. (`chat-starters.test.ts`: under 110 characters, a
  digit, no tool name, seed passes the schema and `validate`)
- **Manual lists, which fail nothing when forgotten:**
  - `widget-load-error.test.tsx` `MOUNTS`: add the four mounts.
  - `widget-graph.test.ts` `heavy`: add `lib/transport-widgets.ts`, `lib/transport-lib.ts`,
    `lib/delivery-scheduler.ts`, `lib/crossing-clock.ts`, `lib/connection-checker.ts` and
    `lib/timetable-reader.ts`.
- `scripts/html-diff.mjs` `PAGES`: `{ path: "tools/delivery-scheduler", widget: "gmt-delivery gmt-widget" }`,
  and the same for `crossing-clock` (`gmt-crossing`), `connection-checker` (`gmt-connection`)
  and `timetable-reader` (`gmt-timetable`).
- `scripts/visual-snapshot.mjs` `PAGES`: `tool-delivery-scheduler`, `tool-connection-checker`,
  `tool-timetable-reader` and `tool-crossing-clock`, after `tool-billing-deadlines`.
- `optimizeDeps.entries` already globs `src/lib/**/*.ts`. No change.

## P. Permalinks (strings only; `?w=<kind>&wa=` + `encodeURIComponent(JSON.stringify(obj))`)

`TSR` is `{"legCount":"3","departure1":"2024-03-08T08:00:00-06:00[America/Chicago]","duration1":"PT46H","timeZone1":"America/Los_Angeles","dwellAfter1":"PT2H","mode1":"truck", …leg 2…, "duration3":"PT2H30M","timeZone3":"Asia/Tokyo","mode3":"rail"}`,
where leg 2 is `"departure2":<below>,"duration2":"P11D","timeZone2":"Asia/Tokyo","dwellAfter2":"PT24H","mode2":"ship"`.

| id | kind | JSON | shows |
| --- | --- | --- | --- |
| PD1 | delivery | `TSR` with `departure2` `"2024-03-10T06:30:00[America/Los_Angeles]"` | V32 `null`, missed |
| PD2 | delivery | `TSR` with `departure2` `"2024-03-10T07:30:00"` | V34 `null`, `zoneless-later` |
| PC1 | connection | `{"inboundDeparture":"2024-06-14T22:10:00+02:00[Europe/Berlin]","inboundDuration":"PT15H","portZone":"Europe/Amsterdam","handlingMinutes":"51","onwardDeparture":"2024-06-15T14:00:00[Europe/Amsterdam]","onwardDuration":"PT12H","onwardZone":"Europe/Rome"}` | V61 `null`, missed by 1 min |
| PC2 | connection | the `spring-forward` preset's fields, `handlingMinutes` `"45"` | V62 `null` |
| PC3 | connection | `{"inboundDeparture":"2024-03-08T08:00:00-06:00[America/Chicago]","inboundDuration":"PT46H","portZone":"America/Los_Angeles","handlingMinutes":"120","onwardDeparture":"2024-03-10T06:30:00[America/Los_Angeles]","onwardDuration":"P11D","onwardZone":"Asia/Tokyo"}` | V73 `null` (V74 at 90, V75 at 91) |
| PT1 | timetable | `{"startTimeZone":"America/New_York","duration":"PT1H","timeZone":"America/New_York","departure1":"2024-03-10T01:30:00","departure2":"2024-03-10T02:30:00","departure3":"2024-03-10T03:30:00"}` | V80–V82 |
| PT2 | timetable | `{"startTimeZone":"America/New_York","duration":"PT1H","timeZone":"America/New_York","departure1":"2024-03-10T02:30:00","offset1":"-05:00"}` | V83 `null` |
| PX1 | crossing | `{"entry":"2024-11-03T05:30:00Z","exit":"2024-11-03T06:30:00Z","targetZone":"America/New_York"}` | V49 |
| PX2 | crossing | `{"entry":"2024-03-10T05:00:00Z","exit":"2024-03-10T12:00:00Z","targetZone":"-05:00"}` | V56 |

---

## C9. `context/dox/built.md`

Present tense, no history.

- **Tier 2, teaching widgets.** Append the four TRAN-9 tools, one clause each:
  - the Delivery Scheduler: a multi-leg journey as an unlabelled exact-time overview strip plus
    an itinerary grouped by local date, flagging an arrival against the offset table where a
    fixed offset would misread a handoff;
  - the Connection Checker: one handoff, with a handling-time slider, made or missed beside the
    times as printed;
  - the Timetable Reader: printed wall times read through `startTimeZone`, with the
    earlier-or-later badge;
  - the Crossing Clock: exact elapsed hours beside the wall-clock difference, on an hour ruler.

  Add the rule they share: they import `transport-widgets.ts`. They find the failing leg and
  every ready or departure instant by calling `scheduleDelivery` on prefixes and zero-length
  legs, never by arithmetic. Each computes one labelled naive value.
- **Tier 2, tool pages.** Add the four paths.
- **Tier 6, Widget tools.** Change "Seven tools, schemas shared by client and Worker in
  `src/lib/dox-tools.ts`:" to "The widget tools, with schemas shared by client and Worker in
  `src/lib/dox-tools.ts`:". Add four bullets:
  - `showDeliveryScheduler({ legs, startTimeZone? })`: `legs` is an array of objects, so its
    permalink flattens them to `departure1`…`mode4` plus `legCount`, because
    `seedFromLocation` keeps only top-level strings;
  - `showCrossingClock({ entry, exit, targetZone })`: a zoneless wall time is read in
    `targetZone` with `disambiguation: "reject"`, as `showDwellLedger` does;
  - `showConnectionChecker({ inboundDeparture, inboundDuration, portZone, handlingMinutes, onwardDeparture, onwardDuration?, onwardZone? })`;
  - `showTimetableReader({ startTimeZone, departures, offsets?, duration, timeZone })`: a
    zoneless departure is the point, and it is never pre-resolved.
- **Tier 2 or Traps.** A new line: "`seedFromLocation` keeps only top-level strings of 1–64
  characters and years. A widget whose arguments are lists or objects flattens them into
  numbered string keys (Delivery Scheduler) or joined strings (Free Time Ledger), and the
  content-permalink test checks every key survives."

Do not add a row to `context/dox/tracker.md`.

---

## D. Definition of done (`dox-tester`: run each line literally)

Prefix every shell with `eval "$(fnm env)" && fnm use`. `$WT` is
`/Users/craigcurtis/workbench/northguild/gmt.worktrees/feature/190-tran-9-scheduledelivery-crossingtime`.
`$SP` is the session scratchpad.

1. `pnpm -C $WT --filter @northguild/gmt build`, then `pnpm -C $WT --filter @gmt/dox test`
   passes. That includes the ten new test files and `widget-registry`, `chat-starters`,
   `widget-permalink` (with the content-permalink test), `widget-graph`, `client-graph`,
   `widget-load-error`, `chat-handler` and `tools.test.ts`.
2. `pnpm -C $WT --filter @gmt/dox check` reports 0 errors. Then
   `pnpm -C $WT --filter @gmt/dox lint` passes.
3. `node $WT/scripts/api-surface.mjs check` exits 0. Then `node $WT/scripts/api-surface.mjs show`
   lists the guide's, scenario's and mistakes' results as checked, not skipped as `unbound`.
4. **Every value against dist.** Write appendix Z to `$SP/tran9-values.mjs` and run
   `DIST=$WT/packages/gmt/dist node $SP/tran9-values.mjs`. Every line prints `ok`. Repeat
   with `TZ=America/Los_Angeles` and `TZ=Asia/Tokyo`. Then list every `// result` comment and
   every widget test's expected literal in the new and changed files, and confirm each matches
   a section 9 row. Any result not in the table fails. If a row fails, stop and report it.
   Never edit the table to match.
5. **Scenario index.** After `pnpm -C $WT dox:generate`, the generated `scenarios/index.mdx`
   lists "A Connection Missed at the Spring-Forward Handoff".
6. **Internal links.** After `pnpm -C $WT --filter @gmt/dox build`, run section 10's script
   over the built pages listed there. It prints nothing and exits 0. Check these anchors by
   hand as `id=` in the target HTML: `#multi-leg-scheduling`,
   `#a-scheduled-departure-is-a-connection-and-dwell-is-the-minimum-connect-time`.
7. **Structural and pixel gates against a clean `main` baseline.** `main` is `5afd68a`, the
   branch's base. The branch's work is uncommitted, so a detached worktree at `main` is clean.

   ```sh
   BASE=$SP/dox-main
   git -C $WT worktree add --detach "$BASE" main
   mkdir -p "$BASE/apps/dox/src/generated"
   cp $WT/apps/dox/src/generated/upstream-filings.live.json "$BASE/apps/dox/src/generated/"
   pnpm -C "$BASE" install --frozen-lockfile
   pnpm -C "$BASE" --filter @northguild/gmt build && pnpm -C "$BASE" --filter @gmt/dox build
   (cd "$BASE/apps/dox" && node scripts/html-diff.mjs capture $SP/html-baseline && pnpm visual:before)
   rm -rf $WT/apps/dox/.visual/before && mkdir -p $WT/apps/dox/.visual && cp -R "$BASE/apps/dox/.visual/before" $WT/apps/dox/.visual/before
   lsof -iTCP:48173 -sTCP:LISTEN   # must print nothing before the branch run
   pnpm -C $WT --filter @northguild/gmt build && pnpm -C $WT --filter @gmt/dox build
   (cd $WT/apps/dox && node scripts/html-diff.mjs compare $SP/html-baseline; pnpm visual:after; pnpm visual:diff)
   git -C $WT worktree remove --force "$BASE"
   ```

   - **Expected `html-diff`:** `+` for each of the four new tool pages, and `~` or `✓` for
     every other page. No existing widget's markup changes. `✗` anywhere is a regression.
   - **Expected `visual:diff`:**
     - `MISSING (no before)` for the four new tools' shots.
     - `✗` allowed only for the following, each confirmed by opening the before and after PNGs
       and finding nothing else changed:
       - every `tool-*` page at desktop (four new rows under Tools in the open sidebar);
       - `dox` (four new starter pills and the generated corpus counts);
       - the changed transport guide and mistakes pages;
       - any page whose only change is the new reference entries, which the `main` baseline
         lacks.
     - Any other `✗` is a regression.
8. **Keyboard-only pass** (no mouse) on each of the four tool pages, and in the `/dox` rail
   through each new starter pill:
   - Tab reaches every control in visual order, and nothing inside a timeline, ruler or strip.
   - Arrow keys change each preset and move the handling slider one minute at a time.
   - Delivery Scheduler: choosing `missed-connection` shows `NO SIGNAL` and the missed reason.
   - Connection Checker: sliding from 50 to 51 turns made into missed.
   - Timetable Reader: typing `-05:00` into a skipped row shows the skipped-offset reason.
   - The focus ring is visible on every control in both themes.
9. **`prefers-reduced-motion: reduce`:** nothing animates on a preset change.
   **`forced-colors: active`:** timeline segments, handoff items, ruler ticks and badges stay
   distinguishable by border style and text.
10. **Contrast**, measured on each rendered tool page in both themes: labels, badges, verdicts,
    timeline and ruler text, and outputs are ≥ 7:1.
11. **Phone width.** At 390×844, no tool page scrolls horizontally, and `/dox`'s empty screen
    with its starter pills fits without horizontal scroll.
12. **Droppability.** In the build, no tool page's scripts pull in a `zod`, `ai` or `dox-tools`
    chunk (`grep -l "dox-tools\|zod" dist/_astro/*.js` for the chunks each page references).
13. **Law and naming grep.** This prints nothing:
    `grep -rniE "IATA|GTFS|ICAO|\bIMO\b|SOLAS|CFR|statut|regulation|docket|Incoterm" $WT/apps/dox/src/content/docs/{guides/industries/transport-multi-leg-scheduling.mdx,scenarios/connection-missed-at-spring-forward.mdx,mistakes/transport.mdx,tools} $WT/apps/dox/src/lib/{transport-widgets,delivery-scheduler,crossing-clock,connection-checker,timetable-reader,dox-tools,chat-constants}*.ts`.
    Read any hit in `tools/` that predates this story. None should exist.
14. `pnpm -C $WT stats:sync`, then `pnpm -C $WT run validate` exits 0.
15. `git -C $WT status --short` shows only the files in section 11 plus the files already
    modified before this work, and nothing staged.

---

## E. Risks and plan corrections

- **R1. `seedFromLocation` drops anything that is not a top-level string (or a year).** The
  Delivery Scheduler's `legs` is an array of objects, the Timetable Reader's `departures` an
  array, and the Connection Checker's `handlingMinutes` a number. *Resolution:* flat,
  numbered string keys, `readArgs` accepting both shapes, and the content-permalink test over
  every MDX link.
- **R2. `visual:diff` cannot be clean outside the new pages.** The Tools sidebar, the `/dox`
  pills and the reference entries change. *Resolution:* the expected-diff list in D7.
- **R3. The package README has no multi-leg section, so "ported, not rewritten" has no
  source.** *Resolution:* the guide uses JSDoc examples and section 9 rows only. If the
  finalizer adds a README section, every example in it must be a section 9 row, or the guide
  and the README disagree. The main session reconciles them at close-out.
- **R4. The tracker `Status` for TRAN-9 is "Not started".** `docs-site.md` says only merged
  (`Done`) functions are named on the site. The pages ship in the story's own PR, so the status
  must be `Done` before merge (the finalizer's step, then `pnpm deps:sync`). The tester reports
  it as open if it is not `Done` when D14 runs. It is not a dox failure.
- **R5. `diagnose` mirrors the library's check order.** If `scheduleDelivery`'s order changes,
  a reason can name the wrong field. *Resolution:* the C0.3 test asserts, for each reason,
  that the real library returns `null` for its state. A reorder that breaks a reason fails
  there.
- **R6. `api-surface.mjs` skips spreads, helpers and member access.** A skipped example is
  unchecked, not failed. *Resolution:* A's binding rule, D3's `show` check, and D4's script
  over every value.
- **R7. Chat tool overlap.** `showCrossingClock` sits beside `showDwellLedger`, and
  `showTimetableReader` beside `showDstInspector`. A model may pick the neighbour.
  *Resolution:* the `when` lines separate them: days versus hours, and a transport timetable
  versus a DST question. Probing the brains spends real quota, so it is not in D. Offer the
  owner `scripts/probe-brains.ts` after merge.
- **R8. Eleven starter pills on `/dox`.** They wrap in a flex row (`gmt-hive.css`
  `.gmt-hive-starters`), but the empty screen grows. *Resolution:* D11 checks phone width.
  Trimming the pills is an owner decision, not the builder's.
- **R9. A 2-hour dwell on a 15-day exact axis is under 1% wide.** *Resolution:* a minimum
  visible width, labels outside the bars, and the leg list carrying every value. Compressing
  the axis would break the exact-time rule the owner asked for.
- **R10. Writing an offset "picks the other pass" only in a repeated hour.** In a skipped
  hour, every offset returns `null` (V83). *Resolution:* the Timetable Reader states both, and
  mistake M6 covers the second.
- **R11. The Connection Checker's onward leg falls back to `PT0S` in the port zone** when the
  chat omits it. That is a default, but it cannot change the verdict. *Resolution:* the hint
  says so, and the printed call shows it.
- **R12. The two manual registration lists** (`MOUNTS`, `heavy`) fail nothing when forgotten.
  *Resolution:* C-x names every entry.
- **R13. `html-diff` matches each root by literal string.** *Resolution:* each root is
  exactly as written in its section.
- **R14. Four tools is the owner's decision over a single tool.** `crossingTime`'s output is
  `dwellTime`'s without `calendarDays`, and the Crossing Clock's lesson (elapsed hours against
  wall clocks) overlaps the Dwell Ledger's spring-forward preset. *Resolution:* the Crossing
  Clock draws hours on an hour ruler, not days on a day grid, and its page links the Dwell
  Ledger for the day count.

## Blocked on the library pipeline

Nothing. The contract matches the final source, and all section 9 rows pass against it.

---

## 9. Verified values

Computed from the final `packages/gmt/src` (compiled with the package's own
`tsconfig.build.json`), in `TZ=UTC`, `America/Los_Angeles` and `Asia/Tokyo`. All 103 rows pass.
Appendix Z is the script and holds every value in full. The table below names each row. A
result is written out in full in appendix Z, and pages copy it from there.

Shorthand used only in this table: `truck` = `{ departure: "2024-03-08T08:00:00-06:00[America/Chicago]", duration: "PT46H", timeZone: "America/Los_Angeles", dwellAfter: "PT2H", mode: "truck" }`;
`ship(d)` = `{ departure: d, duration: "P11D", timeZone: "Asia/Tokyo", dwellAfter: "PT24H", mode: "ship" }` (no `departure` when `d` is absent);
`shipNoDwell(d)` = the same without `dwellAfter`;
`rail` = `{ duration: "PT2H30M", timeZone: "Asia/Tokyo", mode: "rail" }`;
`ZERO` = `{ duration: "PT0S", timeZone: "UTC" }`;
`T(dep, zone, dur, tz)` = `scheduleDelivery([{ departure: dep, duration: dur, timeZone: tz }], { startTimeZone: zone })`;
`K(dep, dur, h, onDep, onDur, onZone)` = the Connection Checker's two legs, the first into `Europe/Amsterdam` with `dwellAfter: "PT{h}M"`;
`L(h)` = `truck` with `dwellAfter: "PT{h}M"`, then `{ departure: "2024-03-10T06:30:00[America/Los_Angeles]", duration: "P11D", timeZone: "Asia/Tokyo" }`.

| id | what | result, in short |
| --- | --- | --- |
| V1–V11 | the `scheduleDelivery` JSDoc examples, verbatim, in file order (V8 is the negative leg, V9 no departure, V10 `P1M`, V11 `"legs"`) | as in the JSDoc |
| V12, V13 | `transitTime("2024-06-15T10:00:00Z", "PT36H")`, `etaAtZone("2024-06-16T22:00:00Z", "Asia/Tokyo")` | `"2024-06-16T22:00:00Z"`, `"2024-06-17T07:00:00+09:00[Asia/Tokyo]"` |
| V14 | V6 with the second departure at 12:00Z: equal passes | eta `2024-06-15T13:00:00+00:00[UTC]` |
| V15 | a `PT0S` leg | eta `2024-06-15T10:00:00+00:00[UTC]` |
| V16 | a zoneless departure on leg 2 | `null` |
| V17 | `startTimeZone: "Mars/Olympus_Mons"`, unused | `null` |
| V18 | `2024-11-03T01:30:00[America/New_York]`, `PT1H` | arrival `06:30Z` (it left 05:30Z, the earlier pass) |
| V19 | `2024-11-03T01:30:00-05:00[America/New_York]`, `PT1H` | arrival `07:30Z` (the later pass) |
| V20 | `2024-03-10T02:30:00[America/New_York]`, `PT1H` | arrival `08:30Z` (it left 07:30Z, 03:30 EDT) |
| V21 | zoneless 01:30 on 3 November, `startTimeZone` New York | arrival `06:30Z` |
| V22, V23 | the last leg's dwell `PT5H`, then `P1M` | eta unchanged `11:00`; `null` |
| V24 | `timeZone: "+09:00"` | `2024-06-15T20:00:00+09:00[+09:00]` |
| V25 | `mode`, `origin` and `destination` echoed | all three present |
| V26 | an exact departure with `startTimeZone` | the option is ignored |
| V27 | Los Angeles 23:00 on 14 June, `PT11H` to Tokyo | `2024-06-16T02:00:00+09:00[Asia/Tokyo]` |
| V28 | `-05:00[America/New_York]` in June | `null` |
| V29 | a `-PT1H` dwell on a non-final leg | `null` |
| V30 | `[truck, ship(), rail]` | eta `2024-03-23T01:30:00+09:00[Asia/Tokyo]`; truck `2024-03-10T05:00:00-07:00[America/Los_Angeles]` |
| V31 | `[truck, ship("…07:30:00[America/Los_Angeles]"), rail]` | eta `2024-03-23T02:00:00+09:00[Asia/Tokyo]` |
| V32 | the same at 06:30 | `null` |
| V33 | the same at 07:00 | as V30 |
| V34 | the same at a zoneless `2024-03-10T07:30:00` | `null` |
| V35 | `[truck, ZERO]` | leg 2 arrival `2024-03-10T14:00:00Z` (the ready instant) |
| V36, V37 | `[truck, shipNoDwell(06:30 LA)]`, `[truck, shipNoDwell(07:30 LA)]` | `null`; eta `2024-03-21T23:30:00+09:00[Asia/Tokyo]` |
| V38 | the Delivery Scheduler starter | eta `2024-03-21T21:00:00+09:00[Asia/Tokyo]` |
| V39 | New York's 10:00 stamped `Z` | eta `2024-06-15T11:00:00+00:00[UTC]` |
| V40 | `[truck, shipNoDwell("2024-03-10T07:30:00")]` | `null` |
| V41 | `[truck]` | eta `2024-03-10T05:00:00-07:00[America/Los_Angeles]` |
| V42, V43 | the probe for 06:30 LA after the truck; 06:30 LA alone | `null`; `2024-03-10T13:30:00Z` |
| V44, V45 | `etaAtZone` of 14:00Z and 13:30Z in Los Angeles | `07:00-07:00`, `06:30-07:00` |
| V46–V54 | the `crossingTime` JSDoc examples, verbatim, in file order | as in the JSDoc |
| V55 | Berlin-bracketed entry and exit read in `America/Panama` | `01:00-05:00` to `10:30-05:00`, `PT9H30M` |
| V56 | the spring-forward instants read in `-05:00` | `00:00` to `07:00`, `PT7H` |
| V57 | Tokyo 17:00, 17 June, air `PT10H` to LA, `PT3H` dwell, truck `PT44H` to Chicago | LA `2024-06-17T11:00:00-07:00`; eta `2024-06-19T12:00:00-05:00[America/Chicago]` |
| V58 | New York 22:00, 2 November, rail `PT6H`, `PT1H` dwell, truck `PT2H` | `03:00-05:00`, eta `2024-11-03T06:00:00-05:00[America/New_York]` |
| V59, V60, V61 | `K(Berlin 22:10 14 June, PT15H, 45/50/51, Amsterdam 14:00 15 June, PT12H, Rome)` | made; made (zero slack); `null` |
| V62, V63 | the spring-forward barge; the London flight | `null`; `null` |
| V64 | handling 0 | `dwellAfter: "PT0M"` echoed |
| V65–V69 | ready instants and departure instants for the Connection Checker | `11:55Z`, `12:55Z`, `12:55Z`; `12:00Z`, `12:00Z` |
| V70, V71 | ready in Amsterdam | `14:55+02:00` both |
| V72 | the Connection Checker starter | `null` |
| V73, V74, V75 | `L(120)`, `L(90)`, `L(91)` | `null`; eta `2024-03-21T22:30:00+09:00[Asia/Tokyo]`; `null` |
| V76–V85 | Timetable Reader rows (see appendix Z) | V81 and V82 both arrive `2024-03-10T08:30:00Z`; V83 `null` |
| V86–V88 | departures from a `PT0S` leg in the origin zone | `01:30-04:00`, `03:30-04:00`, `02:30+02:00` |
| V89–V93 | `resolveLocal` earlier and later, and `etaAtZone` of the earlier | 01:30 on 3 Nov: `05:30Z` / `06:30Z`; 02:30 on 10 Mar: `06:30Z` / `07:30Z`; 00:30 on 3 Nov: equal |
| V94 | the Crossing Clock starter, resolved | `PT7H` |
| V95, V96 | Timetable Reader `leavesAt`, `fall-back`'s once-only rows: `00:30` and `02:30` | `2024-11-03T00:30:00-04:00[America/New_York]`; `2024-11-03T02:30:00-05:00[America/New_York]` |
| V97 | Timetable Reader `leavesAt`, `offset-picks`' `01:30` with `-05:00` written | `2024-11-03T01:30:00-05:00[America/New_York]` |
| N1a–N1d, N2, N3 | the naive plain-JavaScript values | `"2024-03-10T12:00:00.000Z"`, `"2024-03-10T04:00"`, `"2024-03-10T06:00"`, `true`; `true`; `0` |

## 10. Internal-link check (D6)

Use `context/dox/specs/int-58-billing-deadlines.md` section 10's script unchanged, run from
`$WT/apps/dox` after a build, with these pages:

- `guides/industries/transport-multi-leg-scheduling`
- `guides/industries/transport-legs-and-dwell`
- `guides/industries`
- `guides`
- `scenarios/connection-missed-at-spring-forward`
- `mistakes/transport`
- `mistakes`
- `tools/delivery-scheduler`
- `tools/crossing-clock`
- `tools/connection-checker`
- `tools/timetable-reader`

## 11. Files

**Create** (under `apps/dox/`):

- Shared: `src/lib/transport-widgets.ts`, `src/lib/transport-widgets.test.ts`,
  `src/lib/transport-lib.ts`, `src/lib/transport-icons.ts`, `src/lib/transport-icons.test.ts`,
  `src/styles/gmt-transport-widgets.css`.
- For each of `delivery-scheduler`, `crossing-clock`, `connection-checker` and
  `timetable-reader`:
  - `src/lib/<name>.ts` and `src/lib/<name>.test.ts`;
  - `src/lib/<name>-mount.ts` and `src/lib/<name>-mount.test.tsx`;
  - `src/components/<Name>.astro`;
  - `src/content/docs/tools/<name>.mdx`;
  - `src/styles/gmt-<name>.css`.
- Content: `src/content/docs/guides/industries/transport-multi-leg-scheduling.mdx`,
  `src/content/docs/scenarios/connection-missed-at-spring-forward.mdx`.

**Modify:**

- Content: `guides/industries/index.mdx`, `guides/index.mdx`,
  `guides/industries/transport-legs-and-dwell.mdx`, `mistakes/index.mdx` and
  `mistakes/transport.mdx`, all under `apps/dox/src/content/docs/`.
- Library and tests: `src/lib/dox-tools.ts`, `src/lib/chat-constants.ts`,
  `src/lib/widget-permalink.ts` and `src/lib/widget-load-error.test.tsx`.
- Chat: `src/components/ask/widget-registry.ts`, `src/components/ask/widget-graph.test.ts`
  and `worker/tools.ts`.
- Components: `src/components/Icon.astro` (registers the `transport-*` icons in its own
  `BuiltInIcons`, from `transport-icons.ts` — Starlight's `Icon` is not an override slot).
- Styles and config: `src/styles/gmt-a11y.css` and `astro.config.mjs`.
- Scripts: `scripts/html-diff.mjs` and `scripts/visual-snapshot.mjs`.
- Context: `context/dox/built.md`.

Regenerated, not hand-edited: `apps/dox/src/data/gmt-stats.json` (`pnpm stats:sync`), and the
already-modified `src/generated/reference/*`.

**Close-out for the main session** (not the builder's):

- TRAN-9 tracker `Status` → `Done`, then `pnpm deps:sync` (R4).
- If the finalizer adds a README section, reconcile its examples with section 9 (R3).
- Offer the owner a `probe-brains.ts` run for the four new tools after merge (R7).

---

## Appendix Z. The values script (`$SP/tran9-values.mjs`)

Run: `DIST=$WT/packages/gmt/dist node $SP/tran9-values.mjs`. It prints `ok <id>` per row and
exits 1 on any `FAIL`.

```js
// tran9-values.mjs — every value the TRAN-9 dox pages and widget show.
// Run: DIST=<path to packages/gmt/dist> node tran9-values.mjs   (prints `ok <id>` per row; exit 1 on any FAIL)
const DIST = process.env.DIST;
const { scheduleDelivery, crossingTime, transitTime } = await import(`${DIST}/transport/calculate/index.js`);
const { etaAtZone } = await import(`${DIST}/transport/convert/index.js`);

const truck = { departure: "2024-03-08T08:00:00-06:00[America/Chicago]", duration: "PT46H", timeZone: "America/Los_Angeles", dwellAfter: "PT2H", mode: "truck" };
const ship = (departure) => ({ ...(departure ? { departure } : {}), duration: "P11D", timeZone: "Asia/Tokyo", dwellAfter: "PT24H", mode: "ship" });
const shipNoDwell = (departure) => ({ departure, duration: "P11D", timeZone: "Asia/Tokyo", mode: "ship" });
const rail = { duration: "PT2H30M", timeZone: "Asia/Tokyo", mode: "rail" };
const ZERO = { duration: "PT0S", timeZone: "UTC" };

const LA_TRUCK = { arrival: "2024-03-10T12:00:00Z", localArrival: "2024-03-10T05:00:00-07:00[America/Los_Angeles]", dwellAfter: "PT2H", mode: "truck" };

const rows = [
  // scheduleDelivery JSDoc, verbatim
  ["V1", () => scheduleDelivery([{ departure: "2024-06-15T10:00:00Z", duration: "PT36H", timeZone: "Asia/Tokyo" }]),
    { eta: "2024-06-17T07:00:00+09:00[Asia/Tokyo]", legTimes: [{ arrival: "2024-06-16T22:00:00Z", localArrival: "2024-06-17T07:00:00+09:00[Asia/Tokyo]", dwellAfter: "PT0S" }] }],
  ["V2", () => scheduleDelivery([{ departure: "2024-06-15T00:00:00Z", duration: "PT10H", timeZone: "UTC", dwellAfter: "PT2H" }, { duration: "PT5H", timeZone: "Asia/Tokyo" }]),
    { eta: "2024-06-16T02:00:00+09:00[Asia/Tokyo]", legTimes: [{ arrival: "2024-06-15T10:00:00Z", localArrival: "2024-06-15T10:00:00+00:00[UTC]", dwellAfter: "PT2H" }, { arrival: "2024-06-15T17:00:00Z", localArrival: "2024-06-16T02:00:00+09:00[Asia/Tokyo]", dwellAfter: "PT0S" }] }],
  ["V3", () => scheduleDelivery([{ departure: "2024-06-15T10:00:00Z", duration: "PT1H", timeZone: "UTC", mode: "ship" }]),
    { eta: "2024-06-15T11:00:00+00:00[UTC]", legTimes: [{ arrival: "2024-06-15T11:00:00Z", localArrival: "2024-06-15T11:00:00+00:00[UTC]", dwellAfter: "PT0S", mode: "ship" }] }],
  ["V4", () => scheduleDelivery([{ departure: "2024-06-15T10:00:00", duration: "PT1H", timeZone: "UTC" }], { startTimeZone: "America/New_York" }),
    { eta: "2024-06-15T15:00:00+00:00[UTC]", legTimes: [{ arrival: "2024-06-15T15:00:00Z", localArrival: "2024-06-15T15:00:00+00:00[UTC]", dwellAfter: "PT0S" }] }],
  ["V5", () => scheduleDelivery([]), { eta: "", legTimes: [] }],
  ["V6", () => scheduleDelivery([{ departure: "2024-06-15T00:00:00Z", duration: "PT10H", timeZone: "UTC", dwellAfter: "PT2H" }, { departure: "2024-06-15T11:00:00Z", duration: "PT1H", timeZone: "UTC" }]), null],
  ["V7", () => scheduleDelivery([{ departure: "2024-06-15T10:00:00", duration: "PT1H", timeZone: "UTC" }]), null],
  ["V8", () => scheduleDelivery([{ departure: "2024-06-15T10:00:00Z", duration: "-PT1H", timeZone: "UTC" }]), null],
  ["V9", () => scheduleDelivery([{ duration: "PT1H", timeZone: "UTC" }]), null],
  ["V10", () => scheduleDelivery([{ departure: "2024-06-15T10:00:00Z", duration: "P1M", timeZone: "UTC" }]), null],
  ["V11", () => scheduleDelivery("legs"), null],
  // single leg = transitTime then etaAtZone
  ["V12", () => transitTime("2024-06-15T10:00:00Z", "PT36H"), "2024-06-16T22:00:00Z"],
  ["V13", () => etaAtZone("2024-06-16T22:00:00Z", "Asia/Tokyo"), "2024-06-17T07:00:00+09:00[Asia/Tokyo]"],
  // edges
  ["V14", () => scheduleDelivery([{ departure: "2024-06-15T00:00:00Z", duration: "PT10H", timeZone: "UTC", dwellAfter: "PT2H" }, { departure: "2024-06-15T12:00:00Z", duration: "PT1H", timeZone: "UTC" }]),
    { eta: "2024-06-15T13:00:00+00:00[UTC]", legTimes: [{ arrival: "2024-06-15T10:00:00Z", localArrival: "2024-06-15T10:00:00+00:00[UTC]", dwellAfter: "PT2H" }, { arrival: "2024-06-15T13:00:00Z", localArrival: "2024-06-15T13:00:00+00:00[UTC]", dwellAfter: "PT0S" }] }],
  ["V15", () => scheduleDelivery([{ departure: "2024-06-15T10:00:00Z", duration: "PT0S", timeZone: "UTC" }]),
    { eta: "2024-06-15T10:00:00+00:00[UTC]", legTimes: [{ arrival: "2024-06-15T10:00:00Z", localArrival: "2024-06-15T10:00:00+00:00[UTC]", dwellAfter: "PT0S" }] }],
  ["V16", () => scheduleDelivery([{ departure: "2024-06-15T10:00:00Z", duration: "PT1H", timeZone: "UTC" }, { departure: "2024-06-15T12:00:00", duration: "PT1H", timeZone: "UTC" }]), null],
  ["V17", () => scheduleDelivery([{ departure: "2024-06-15T10:00:00Z", duration: "PT1H", timeZone: "UTC" }], { startTimeZone: "Mars/Olympus_Mons" }), null],
  ["V18", () => scheduleDelivery([{ departure: "2024-11-03T01:30:00[America/New_York]", duration: "PT1H", timeZone: "America/New_York" }]),
    { eta: "2024-11-03T01:30:00-05:00[America/New_York]", legTimes: [{ arrival: "2024-11-03T06:30:00Z", localArrival: "2024-11-03T01:30:00-05:00[America/New_York]", dwellAfter: "PT0S" }] }],
  ["V19", () => scheduleDelivery([{ departure: "2024-11-03T01:30:00-05:00[America/New_York]", duration: "PT1H", timeZone: "America/New_York" }]),
    { eta: "2024-11-03T02:30:00-05:00[America/New_York]", legTimes: [{ arrival: "2024-11-03T07:30:00Z", localArrival: "2024-11-03T02:30:00-05:00[America/New_York]", dwellAfter: "PT0S" }] }],
  ["V20", () => scheduleDelivery([{ departure: "2024-03-10T02:30:00[America/New_York]", duration: "PT1H", timeZone: "America/New_York" }]),
    { eta: "2024-03-10T04:30:00-04:00[America/New_York]", legTimes: [{ arrival: "2024-03-10T08:30:00Z", localArrival: "2024-03-10T04:30:00-04:00[America/New_York]", dwellAfter: "PT0S" }] }],
  ["V21", () => scheduleDelivery([{ departure: "2024-11-03T01:30:00", duration: "PT1H", timeZone: "America/New_York" }], { startTimeZone: "America/New_York" }),
    { eta: "2024-11-03T01:30:00-05:00[America/New_York]", legTimes: [{ arrival: "2024-11-03T06:30:00Z", localArrival: "2024-11-03T01:30:00-05:00[America/New_York]", dwellAfter: "PT0S" }] }],
  ["V22", () => scheduleDelivery([{ departure: "2024-06-15T10:00:00Z", duration: "PT1H", timeZone: "UTC", dwellAfter: "PT5H" }]),
    { eta: "2024-06-15T11:00:00+00:00[UTC]", legTimes: [{ arrival: "2024-06-15T11:00:00Z", localArrival: "2024-06-15T11:00:00+00:00[UTC]", dwellAfter: "PT5H" }] }],
  ["V23", () => scheduleDelivery([{ departure: "2024-06-15T10:00:00Z", duration: "PT1H", timeZone: "UTC", dwellAfter: "P1M" }]), null],
  ["V24", () => scheduleDelivery([{ departure: "2024-06-15T10:00:00Z", duration: "PT1H", timeZone: "+09:00" }]),
    { eta: "2024-06-15T20:00:00+09:00[+09:00]", legTimes: [{ arrival: "2024-06-15T11:00:00Z", localArrival: "2024-06-15T20:00:00+09:00[+09:00]", dwellAfter: "PT0S" }] }],
  ["V25", () => scheduleDelivery([{ departure: "2024-06-15T10:00:00Z", duration: "PT1H", timeZone: "UTC", mode: "truck", origin: "CHI", destination: "LAX" }]),
    { eta: "2024-06-15T11:00:00+00:00[UTC]", legTimes: [{ arrival: "2024-06-15T11:00:00Z", localArrival: "2024-06-15T11:00:00+00:00[UTC]", dwellAfter: "PT0S", mode: "truck", origin: "CHI", destination: "LAX" }] }],
  ["V26", () => scheduleDelivery([{ departure: "2024-06-15T10:00:00Z", duration: "PT1H", timeZone: "UTC" }], { startTimeZone: "America/New_York" }),
    { eta: "2024-06-15T11:00:00+00:00[UTC]", legTimes: [{ arrival: "2024-06-15T11:00:00Z", localArrival: "2024-06-15T11:00:00+00:00[UTC]", dwellAfter: "PT0S" }] }],
  ["V27", () => scheduleDelivery([{ departure: "2024-06-14T23:00:00-07:00[America/Los_Angeles]", duration: "PT11H", timeZone: "Asia/Tokyo" }]),
    { eta: "2024-06-16T02:00:00+09:00[Asia/Tokyo]", legTimes: [{ arrival: "2024-06-15T17:00:00Z", localArrival: "2024-06-16T02:00:00+09:00[Asia/Tokyo]", dwellAfter: "PT0S" }] }],
  ["V28", () => scheduleDelivery([{ departure: "2024-06-15T10:00:00-05:00[America/New_York]", duration: "PT1H", timeZone: "UTC" }]), null],
  ["V29", () => scheduleDelivery([{ departure: "2024-06-15T10:00:00Z", duration: "PT1H", timeZone: "UTC", dwellAfter: "-PT1H" }, { duration: "PT1H", timeZone: "UTC" }]), null],
  // the journey (widget presets 1-4, scenario, starter)
  ["V30", () => scheduleDelivery([truck, ship(), rail]),
    { eta: "2024-03-23T01:30:00+09:00[Asia/Tokyo]", legTimes: [LA_TRUCK, { arrival: "2024-03-21T14:00:00Z", localArrival: "2024-03-21T23:00:00+09:00[Asia/Tokyo]", dwellAfter: "PT24H", mode: "ship" }, { arrival: "2024-03-22T16:30:00Z", localArrival: "2024-03-23T01:30:00+09:00[Asia/Tokyo]", dwellAfter: "PT0S", mode: "rail" }] }],
  ["V31", () => scheduleDelivery([truck, ship("2024-03-10T07:30:00[America/Los_Angeles]"), rail]),
    { eta: "2024-03-23T02:00:00+09:00[Asia/Tokyo]", legTimes: [LA_TRUCK, { arrival: "2024-03-21T14:30:00Z", localArrival: "2024-03-21T23:30:00+09:00[Asia/Tokyo]", dwellAfter: "PT24H", mode: "ship" }, { arrival: "2024-03-22T17:00:00Z", localArrival: "2024-03-23T02:00:00+09:00[Asia/Tokyo]", dwellAfter: "PT0S", mode: "rail" }] }],
  ["V32", () => scheduleDelivery([truck, ship("2024-03-10T06:30:00[America/Los_Angeles]"), rail]), null],
  ["V33", () => scheduleDelivery([truck, ship("2024-03-10T07:00:00[America/Los_Angeles]"), rail]),
    { eta: "2024-03-23T01:30:00+09:00[Asia/Tokyo]", legTimes: [LA_TRUCK, { arrival: "2024-03-21T14:00:00Z", localArrival: "2024-03-21T23:00:00+09:00[Asia/Tokyo]", dwellAfter: "PT24H", mode: "ship" }, { arrival: "2024-03-22T16:30:00Z", localArrival: "2024-03-23T01:30:00+09:00[Asia/Tokyo]", dwellAfter: "PT0S", mode: "rail" }] }],
  ["V34", () => scheduleDelivery([truck, ship("2024-03-10T07:30:00"), rail]), null],
  ["V35", () => scheduleDelivery([truck, ZERO]),
    { eta: "2024-03-10T14:00:00+00:00[UTC]", legTimes: [LA_TRUCK, { arrival: "2024-03-10T14:00:00Z", localArrival: "2024-03-10T14:00:00+00:00[UTC]", dwellAfter: "PT0S" }] }],
  ["V36", () => scheduleDelivery([truck, shipNoDwell("2024-03-10T06:30:00[America/Los_Angeles]")]), null],
  ["V37", () => scheduleDelivery([truck, shipNoDwell("2024-03-10T07:30:00[America/Los_Angeles]")]),
    { eta: "2024-03-21T23:30:00+09:00[Asia/Tokyo]", legTimes: [LA_TRUCK, { arrival: "2024-03-21T14:30:00Z", localArrival: "2024-03-21T23:30:00+09:00[Asia/Tokyo]", dwellAfter: "PT0S", mode: "ship" }] }],
  ["V38", () => scheduleDelivery([{ departure: "2024-03-08T08:00:00-06:00[America/Chicago]", duration: "PT46H", timeZone: "America/Los_Angeles", mode: "truck" }, { duration: "P11D", timeZone: "Asia/Tokyo", mode: "ship" }]),
    { eta: "2024-03-21T21:00:00+09:00[Asia/Tokyo]", legTimes: [{ arrival: "2024-03-10T12:00:00Z", localArrival: "2024-03-10T05:00:00-07:00[America/Los_Angeles]", dwellAfter: "PT0S", mode: "truck" }, { arrival: "2024-03-21T12:00:00Z", localArrival: "2024-03-21T21:00:00+09:00[Asia/Tokyo]", dwellAfter: "PT0S", mode: "ship" }] }],
  ["V39", () => scheduleDelivery([{ departure: "2024-06-15T10:00:00Z", duration: "PT1H", timeZone: "UTC" }]),
    { eta: "2024-06-15T11:00:00+00:00[UTC]", legTimes: [{ arrival: "2024-06-15T11:00:00Z", localArrival: "2024-06-15T11:00:00+00:00[UTC]", dwellAfter: "PT0S" }] }],
  ["V40", () => scheduleDelivery([truck, shipNoDwell("2024-03-10T07:30:00")]), null],
  ["V41", () => scheduleDelivery([truck]), { eta: "2024-03-10T05:00:00-07:00[America/Los_Angeles]", legTimes: [LA_TRUCK] }],
  // widget probes: a departure resolved alone; the scheduled departure before the cursor
  ["V42", () => scheduleDelivery([truck, { departure: "2024-03-10T06:30:00[America/Los_Angeles]", ...ZERO }]), null],
  ["V43", () => scheduleDelivery([{ departure: "2024-03-10T06:30:00[America/Los_Angeles]", ...ZERO }]),
    { eta: "2024-03-10T13:30:00+00:00[UTC]", legTimes: [{ arrival: "2024-03-10T13:30:00Z", localArrival: "2024-03-10T13:30:00+00:00[UTC]", dwellAfter: "PT0S" }] }],
  ["V44", () => etaAtZone("2024-03-10T14:00:00Z", "America/Los_Angeles"), "2024-03-10T07:00:00-07:00[America/Los_Angeles]"],
  ["V45", () => etaAtZone("2024-03-10T13:30:00Z", "America/Los_Angeles"), "2024-03-10T06:30:00-07:00[America/Los_Angeles]"],
  // crossingTime JSDoc, verbatim
  ["V46", () => crossingTime("2024-06-15T08:00:00Z", "2024-06-15T17:30:00Z", "Europe/Berlin"), { duration: "PT9H30M", enter: "2024-06-15T10:00:00+02:00[Europe/Berlin]", exit: "2024-06-15T19:30:00+02:00[Europe/Berlin]" }],
  ["V47", () => crossingTime("2024-06-15T10:00:00+09:00", "2024-06-15T12:00:00+09:00", "Asia/Tokyo"), { duration: "PT2H", enter: "2024-06-15T10:00:00+09:00[Asia/Tokyo]", exit: "2024-06-15T12:00:00+09:00[Asia/Tokyo]" }],
  ["V48", () => crossingTime("2024-03-10T05:00:00Z", "2024-03-10T12:00:00Z", "America/New_York"), { duration: "PT7H", enter: "2024-03-10T00:00:00-05:00[America/New_York]", exit: "2024-03-10T08:00:00-04:00[America/New_York]" }],
  ["V49", () => crossingTime("2024-11-03T05:30:00Z", "2024-11-03T06:30:00Z", "America/New_York"), { duration: "PT1H", enter: "2024-11-03T01:30:00-04:00[America/New_York]", exit: "2024-11-03T01:30:00-05:00[America/New_York]" }],
  ["V50", () => crossingTime("2024-06-15T10:00:00Z", "2024-06-15T10:00:00Z", "Asia/Tokyo"), { duration: "PT0S", enter: "2024-06-15T19:00:00+09:00[Asia/Tokyo]", exit: "2024-06-15T19:00:00+09:00[Asia/Tokyo]" }],
  ["V51", () => crossingTime("2024-06-15T22:30:00Z", "2024-06-16T01:00:00Z", "+02:00"), { duration: "PT2H30M", enter: "2024-06-16T00:30:00+02:00[+02:00]", exit: "2024-06-16T03:00:00+02:00[+02:00]" }],
  ["V52", () => crossingTime("2024-06-16T01:00:00Z", "2024-06-15T22:30:00Z", "Europe/London"), null],
  ["V53", () => crossingTime("2024-06-15T22:30:00Z", "2024-06-16T01:00:00Z", "Europe/Londres"), null],
  ["V54", () => crossingTime("2024-06-15T22:30:00", "2024-06-16T01:00:00Z", "Europe/London"), null],
  // crossingTime extras
  ["V55", () => crossingTime("2024-06-15T08:00:00+02:00[Europe/Berlin]", "2024-06-15T17:30:00+02:00[Europe/Berlin]", "America/Panama"), { duration: "PT9H30M", enter: "2024-06-15T01:00:00-05:00[America/Panama]", exit: "2024-06-15T10:30:00-05:00[America/Panama]" }],
  ["V56", () => crossingTime("2024-03-10T05:00:00Z", "2024-03-10T12:00:00Z", "-05:00"), { duration: "PT7H", enter: "2024-03-10T00:00:00-05:00[-05:00]", exit: "2024-03-10T07:00:00-05:00[-05:00]" }],
];

const { resolveLocal } = await import(`${DIST}/instant/convert/index.js`);
const K = (dep, dur, h, onDep, onDur, onZone) => [{ departure: dep, duration: dur, timeZone: "Europe/Amsterdam", dwellAfter: `PT${h}M` }, { departure: onDep, duration: onDur, timeZone: onZone }];
const L = (h) => [{ departure: "2024-03-08T08:00:00-06:00[America/Chicago]", duration: "PT46H", timeZone: "America/Los_Angeles", dwellAfter: `PT${h}M` }, { departure: "2024-03-10T06:30:00[America/Los_Angeles]", duration: "P11D", timeZone: "Asia/Tokyo" }];
const NY = "America/New_York";
const T = (departure, zone, duration, timeZone) => scheduleDelivery([{ departure, duration, timeZone }], { startTimeZone: zone });
const ROME = (h) => ({ eta: "2024-06-16T02:00:00+02:00[Europe/Rome]", legTimes: [{ arrival: "2024-06-15T11:10:00Z", localArrival: "2024-06-15T13:10:00+02:00[Europe/Amsterdam]", dwellAfter: h }, { arrival: "2024-06-16T00:00:00Z", localArrival: "2024-06-16T02:00:00+02:00[Europe/Rome]", dwellAfter: "PT0S" }] });
const one = (arrival, localArrival) => ({ eta: localArrival, legTimes: [{ arrival, localArrival, dwellAfter: "PT0S" }] });
rows.push(
  // Delivery Scheduler: trans-Pacific and fall-back presets
  ["V57", () => scheduleDelivery([{ departure: "2024-06-17T17:00:00+09:00[Asia/Tokyo]", duration: "PT10H", timeZone: "America/Los_Angeles", dwellAfter: "PT3H", mode: "air" }, { duration: "PT44H", timeZone: "America/Chicago", mode: "truck" }]),
    { eta: "2024-06-19T12:00:00-05:00[America/Chicago]", legTimes: [{ arrival: "2024-06-17T18:00:00Z", localArrival: "2024-06-17T11:00:00-07:00[America/Los_Angeles]", dwellAfter: "PT3H", mode: "air" }, { arrival: "2024-06-19T17:00:00Z", localArrival: "2024-06-19T12:00:00-05:00[America/Chicago]", dwellAfter: "PT0S", mode: "truck" }] }],
  ["V58", () => scheduleDelivery([{ departure: "2024-11-02T22:00:00-04:00[America/New_York]", duration: "PT6H", timeZone: NY, dwellAfter: "PT1H", mode: "rail" }, { duration: "PT2H", timeZone: NY, mode: "truck" }]),
    { eta: "2024-11-03T06:00:00-05:00[America/New_York]", legTimes: [{ arrival: "2024-11-03T08:00:00Z", localArrival: "2024-11-03T03:00:00-05:00[America/New_York]", dwellAfter: "PT1H", mode: "rail" }, { arrival: "2024-11-03T11:00:00Z", localArrival: "2024-11-03T06:00:00-05:00[America/New_York]", dwellAfter: "PT0S", mode: "truck" }] }],
  // Connection Checker presets and probes
  ["V59", () => scheduleDelivery(K("2024-06-14T22:10:00+02:00[Europe/Berlin]", "PT15H", 45, "2024-06-15T14:00:00[Europe/Amsterdam]", "PT12H", "Europe/Rome")), ROME("PT45M")],
  ["V60", () => scheduleDelivery(K("2024-06-14T22:10:00+02:00[Europe/Berlin]", "PT15H", 50, "2024-06-15T14:00:00[Europe/Amsterdam]", "PT12H", "Europe/Rome")), ROME("PT50M")],
  ["V61", () => scheduleDelivery(K("2024-06-14T22:10:00+02:00[Europe/Berlin]", "PT15H", 51, "2024-06-15T14:00:00[Europe/Amsterdam]", "PT12H", "Europe/Rome")), null],
  ["V62", () => scheduleDelivery(K("2024-03-30T22:10:00+01:00[Europe/Berlin]", "PT15H", 45, "2024-03-31T14:00:00[Europe/Amsterdam]", "PT12H", "Europe/Rome")), null],
  ["V63", () => scheduleDelivery(K("2024-06-15T12:10:00+01:00[Europe/London]", "PT1H", 45, "2024-06-15T14:00:00[Europe/Amsterdam]", "PT12H", "Europe/Rome")), null],
  ["V64", () => scheduleDelivery(K("2024-06-14T22:10:00+02:00[Europe/Berlin]", "PT15H", 0, "2024-06-15T14:00:00[Europe/Amsterdam]", "PT12H", "Europe/Rome")), ROME("PT0M")],
  ["V65", () => scheduleDelivery([K("2024-06-14T22:10:00+02:00[Europe/Berlin]", "PT15H", 45, "", "", "")[0], ZERO]).legTimes[1].arrival, "2024-06-15T11:55:00Z"],
  ["V66", () => scheduleDelivery([K("2024-03-30T22:10:00+01:00[Europe/Berlin]", "PT15H", 45, "", "", "")[0], ZERO]).legTimes[1].arrival, "2024-03-31T12:55:00Z"],
  ["V67", () => scheduleDelivery([K("2024-06-15T12:10:00+01:00[Europe/London]", "PT1H", 45, "", "", "")[0], ZERO]).legTimes[1].arrival, "2024-06-15T12:55:00Z"],
  ["V68", () => scheduleDelivery([{ departure: "2024-06-15T14:00:00[Europe/Amsterdam]", ...ZERO }]).legTimes[0].arrival, "2024-06-15T12:00:00Z"],
  ["V69", () => scheduleDelivery([{ departure: "2024-03-31T14:00:00[Europe/Amsterdam]", ...ZERO }]).legTimes[0].arrival, "2024-03-31T12:00:00Z"],
  ["V70", () => etaAtZone("2024-03-31T12:55:00Z", "Europe/Amsterdam"), "2024-03-31T14:55:00+02:00[Europe/Amsterdam]"],
  ["V71", () => etaAtZone("2024-06-15T12:55:00Z", "Europe/Amsterdam"), "2024-06-15T14:55:00+02:00[Europe/Amsterdam]"],
  ["V72", () => scheduleDelivery([{ departure: "2024-03-30T22:10:00+01:00[Europe/Berlin]", duration: "PT15H", timeZone: "Europe/Amsterdam", dwellAfter: "PT45M" }, { departure: "2024-03-31T14:00:00[Europe/Amsterdam]", duration: "PT0S", timeZone: "Europe/Amsterdam" }]), null],
  ["V73", () => scheduleDelivery(L(120)), null],
  ["V74", () => scheduleDelivery(L(90)),
    { eta: "2024-03-21T22:30:00+09:00[Asia/Tokyo]", legTimes: [{ arrival: "2024-03-10T12:00:00Z", localArrival: "2024-03-10T05:00:00-07:00[America/Los_Angeles]", dwellAfter: "PT90M" }, { arrival: "2024-03-21T13:30:00Z", localArrival: "2024-03-21T22:30:00+09:00[Asia/Tokyo]", dwellAfter: "PT0S" }] }],
  ["V75", () => scheduleDelivery(L(91)), null],
  // Timetable Reader rows (startTimeZone), their departures (PT0S in the origin zone) and resolveLocal classification
  ["V76", () => T("2024-11-03T00:30:00", NY, "PT1H", NY), one("2024-11-03T05:30:00Z", "2024-11-03T01:30:00-04:00[America/New_York]")],
  ["V77", () => T("2024-11-03T01:30:00", NY, "PT1H", NY), one("2024-11-03T06:30:00Z", "2024-11-03T01:30:00-05:00[America/New_York]")],
  ["V78", () => T("2024-11-03T02:30:00", NY, "PT1H", NY), one("2024-11-03T08:30:00Z", "2024-11-03T03:30:00-05:00[America/New_York]")],
  ["V79", () => T("2024-11-03T01:30:00-05:00[America/New_York]", NY, "PT1H", NY), one("2024-11-03T07:30:00Z", "2024-11-03T02:30:00-05:00[America/New_York]")],
  ["V80", () => T("2024-03-10T01:30:00", NY, "PT1H", NY), one("2024-03-10T07:30:00Z", "2024-03-10T03:30:00-04:00[America/New_York]")],
  ["V81", () => T("2024-03-10T02:30:00", NY, "PT1H", NY), one("2024-03-10T08:30:00Z", "2024-03-10T04:30:00-04:00[America/New_York]")],
  ["V82", () => T("2024-03-10T03:30:00", NY, "PT1H", NY), one("2024-03-10T08:30:00Z", "2024-03-10T04:30:00-04:00[America/New_York]")],
  ["V83", () => T("2024-03-10T02:30:00-05:00[America/New_York]", NY, "PT1H", NY), null],
  ["V84", () => T("2024-10-27T02:30:00", "Europe/Berlin", "PT1H", "Europe/Amsterdam"), one("2024-10-27T01:30:00Z", "2024-10-27T02:30:00+01:00[Europe/Amsterdam]")],
  ["V85", () => T("2024-10-27T02:30:00+01:00[Europe/Berlin]", "Europe/Berlin", "PT1H", "Europe/Amsterdam"), one("2024-10-27T02:30:00Z", "2024-10-27T03:30:00+01:00[Europe/Amsterdam]")],
  ["V86", () => T("2024-11-03T01:30:00", NY, "PT0S", NY).legTimes[0].localArrival, "2024-11-03T01:30:00-04:00[America/New_York]"],
  ["V87", () => T("2024-03-10T02:30:00", NY, "PT0S", NY).legTimes[0].localArrival, "2024-03-10T03:30:00-04:00[America/New_York]"],
  ["V88", () => T("2024-10-27T02:30:00", "Europe/Berlin", "PT0S", "Europe/Berlin").legTimes[0].localArrival, "2024-10-27T02:30:00+02:00[Europe/Berlin]"],
  ["V89", () => [resolveLocal("2024-11-03T01:30:00", NY, { disambiguation: "earlier" }), resolveLocal("2024-11-03T01:30:00", NY, { disambiguation: "later" })], ["2024-11-03T05:30:00Z", "2024-11-03T06:30:00Z"]],
  ["V90", () => [resolveLocal("2024-03-10T02:30:00", NY, { disambiguation: "earlier" }), resolveLocal("2024-03-10T02:30:00", NY, { disambiguation: "later" })], ["2024-03-10T06:30:00Z", "2024-03-10T07:30:00Z"]],
  ["V91", () => [resolveLocal("2024-11-03T00:30:00", NY, { disambiguation: "earlier" }), resolveLocal("2024-11-03T00:30:00", NY, { disambiguation: "later" })], ["2024-11-03T04:30:00Z", "2024-11-03T04:30:00Z"]],
  ["V92", () => [etaAtZone("2024-11-03T05:30:00Z", NY), etaAtZone("2024-03-10T06:30:00Z", NY)], ["2024-11-03T01:30:00-04:00[America/New_York]", "2024-03-10T01:30:00-05:00[America/New_York]"]],
  ["V93", () => [resolveLocal("2024-10-27T02:30:00", "Europe/Berlin", { disambiguation: "earlier" }), resolveLocal("2024-10-27T02:30:00", "Europe/Berlin", { disambiguation: "later" })], ["2024-10-27T00:30:00Z", "2024-10-27T01:30:00Z"]],
  // Crossing Clock starter: wall times read in the zone with "reject"
  ["V94", () => crossingTime("2024-03-10T00:00:00-05:00[America/New_York]", "2024-03-10T08:00:00-04:00[America/New_York]", NY), { duration: "PT7H", enter: "2024-03-10T00:00:00-05:00[America/New_York]", exit: "2024-03-10T08:00:00-04:00[America/New_York]" }],
  // Timetable Reader `leavesAt` (fix loop): the `fall-back` preset's once-only rows either
  // side of the repeated hour, and `offset-picks`' second row with -05:00 written.
  ["V95", () => T("2024-11-03T00:30:00", NY, "PT0S", NY).legTimes[0].localArrival, "2024-11-03T00:30:00-04:00[America/New_York]"],
  ["V96", () => T("2024-11-03T02:30:00", NY, "PT0S", NY).legTimes[0].localArrival, "2024-11-03T02:30:00-05:00[America/New_York]"],
  ["V97", () => T("2024-11-03T01:30:00-05:00[America/New_York]", NY, "PT0S", NY).legTimes[0].localArrival, "2024-11-03T01:30:00-05:00[America/New_York]"],
);

// Naive plain JavaScript, TZ-independent (every parsed string carries Z or an offset, or both sides are zoneless)
const OFFSET_HOURS = { "America/Los_Angeles": -8 };
const departed = Date.parse("2024-03-08T08:00:00-06:00");
const arrived = departed + 46 * 36e5;
const toLocal = (ms) => new Date(ms + OFFSET_HOURS["America/Los_Angeles"] * 36e5).toISOString().slice(0, 16);
const ready = arrived + 2 * 36e5;
const sails = Date.parse("2024-03-10T06:30:00Z") - OFFSET_HOURS["America/Los_Angeles"] * 36e5;
rows.push(
  ["N1a", () => new Date(arrived).toISOString(), "2024-03-10T12:00:00.000Z"],
  ["N1b", () => toLocal(arrived), "2024-03-10T04:00"],
  ["N1c", () => toLocal(ready), "2024-03-10T06:00"],
  ["N1d", () => ready <= sails, true],
  ["N2", () => Date.parse("2024-03-10T13:30:00Z") >= Date.parse("2024-03-10T12:00:00Z"), true],
  ["N3", () => (Date.parse("2024-11-03T01:30:00") - Date.parse("2024-11-03T01:30:00")) / 36e5, 0],
);

let bad = 0;
for (const [id, fn, expected] of rows) {
  const actual = fn();
  if (JSON.stringify(actual) === JSON.stringify(expected)) console.log(`ok ${id}`);
  else { bad++; console.log(`FAIL ${id} ${JSON.stringify(actual)}`); }
}
process.exit(bad ? 1 : 0);
```
