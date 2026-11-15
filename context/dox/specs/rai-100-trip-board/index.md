---
story: RAI-100
issue: 408
status: approved
dox: gtfs-trip-board
---

# RAI-100 · GTFS Trip Board

The reader pastes one trip's `stop_times.txt` rows, with `stop_timezone` joined from `stops.txt`,
plus the service date and `agency_timezone`. For each stop the board shows the instant the feed
means, the platform clock's reading of it, the wrong reading you get by passing `stop_timezone`
to `gtfsToInstant`, and each leg's length. It goes into PR #533 (review by craig-o-curtis). The
library side is done: **do not touch `packages/gmt/`**. The build is in
[s1-trip-board.md](./s1-trip-board.md).

Binding rules: [built.md § Rules](../../built.md#rules-that-bind-every-change), the
**GTFS Service Day Clock** entry in [built.md § Widget tools](../../built.md#widget-tools) (this
tool is its sibling and reuses its module), [§ Test isolation](../../built.md#test-isolation)
and the gate-hooks table in [§ Tier 2](../../built.md#tier-2--widget-platform).

## Names

| What            | Value                                                                    |
| --------------- | ------------------------------------------------------------------------ |
| Page            | `/tools/gtfs-trip-board/`, `src/content/docs/tools/gtfs-trip-board.mdx` |
| Widget root     | `data-widget="gtfs-trip-board"`                                          |
| Permalink kind  | `gtfstrip`                                                               |
| Chat tool       | `showGtfsTripBoard`, `DOX_TOOL_DOCS[58]` (check that 58 is the next one) |
| Args            | `{ stopTimes?, date?, zone?, preset? }`, all strings                     |
| Presets (order) | `border`, `night-train`, `andes-june`, `andes-january`, `no-noon`        |

The key is `stopTimes`, not `rows`: `LONG_STRING_KEYS` in `widget-permalink.ts` is keyed by
argument name for every kind, so a generic name would also lift the 64-character cap on other
tools.

## Decisions

1. **Input: a CSV paste with a header line.** The first line that is not blank is the header.
   It must name `stop_id`, `arrival_time` and `departure_time`. `stop_timezone` is optional.
   Other `stop_times.txt` columns (`trip_id`, `stop_sequence`, …) are accepted and ignored.
   There is no headerless form, because feeds order their columns differently. The parsing
   rules, rejections and messages are in [s1 § Reader](./s1-trip-board.md#reader).
2. **Caps.** At most 12 data rows: past the 12th, rows are counted and named as not read, the
   same cap as the TAI64N reader. Over 150 characters, a line is rejected, never cut. Over
   2,000 characters, the whole paste is refused. Its 2,000-character bound is the same in the
   chat schema, the permalink (`LONG_STRING_KEYS.stopTimes`) and the reader. The textarea has
   no `maxlength`, because a paste cut silently is a wrong answer.
3. **An empty `stop_timezone` uses the agency's zone.** GTFS `stops.txt` § `stop_timezone` says
   a parentless stop with an empty `stop_timezone` inherits `agency.agency_timezone`. A child
   stop takes its parent station's zone; the page tells the reader to join that before pasting.
   The stop cell's zone label reads "agency zone".
4. **One reading is wrong, and words mark it.** The fourth column is headed
   "Read in stop_timezone (wrong)". Each value in it carries a `badge`: "N min later" or
   "N min earlier" (tone `danger`), or "same instant" (`neutral`). No colour alone and no left
   edge.
5. **Library.** `loadTripBoardLib()` is added to `rail-lib.ts`. It is `loadServiceDayLib()` plus
   `convertUtcToPlainDateTime` (`utc/convert`) and `diffDateTime` (`plain/calculate`), typed by
   `pickTyped` from `typeof import(...)`. Both modules are already in `GMT_MODULES`. The type is
   a superset of `ServiceDayLib`, so the sibling's `explainRefusal` takes it unchanged. gmt is
   imported dynamically only. `literal` comes from `lib/literal.ts`. No `Date` and no
   `@js-temporal/polyfill` go in the first-paint chunk.
6. **Layout at 300 px.** The table is a kit `table`, `layout: "fixed"`, with `labelCells`.
   Below a 46rem container it stacks into one block per stop, the precedent in
   `families/stored/audit-table.module.css`. Zoned values break at `<wbr>` (`zonedValue`).
   Every value is a `hold` sized by the widest ghost, so for a given row count a cell never
   changes size. The template renders the `<table>` in static HTML, so `table-fit` finds the
   page.
7. **The calls frame shows one stop.** A whole trip's calls run to more than a hundred lines.
   A "Calls for" `select` (one option per stop that was read) picks a stop. The frame's
   `minLines` come from a stub-library sizer for one row, as in the sibling.
8. **Readouts that hold still.** Two hero plates sit above the table: "Trip, first departure to
   last arrival" and "Stops the wrong zone moves". They are pinned to the row's edges with
   `justify-content: space-between`, carry full bevelled borders, use tabular figures with no
   wrap, and are held by ghosts for `WIDEST_ZONE`. The table and the calls grow with the trip
   by design: they sit inside `grow()`, and readout-still runs with `scope: "above"`.
9. **Review lessons carried over:**
   - the ghosts are for `America/Argentina/Buenos_Aires`;
   - `getDstTransitions` is asked for every year a leg touches, in each zone's own calendar;
   - the prose says "by the size of the change, an hour in most zones";
   - no preset is US-led;
   - gmt loads lazily.

   The board draws no axis, so the rule on date labels for day-long tick steps does not apply.

10. **Where the entries go.** `origin/main` is merged in (IOT-101, #532), so every list now holds
    the PTP Clock Converter right after the Service Day Clock. Put each Trip Board entry right
    after the Service Day Clock's and before PTP's, so the rail tools sit together. The one
    exception is `DOX_TOOL_DOCS`: append it, at index 58, after PTP's 57.
11. **The architect's open questions, settled for this build:**
    - The Andes presets stay, and the preset label says it is a coach timetable. GTFS covers
      coaches, and the pair is what shows a zone pair whose offsets differ in one season only.
    - RFC 4180 quoting is out of scope. A quoted cell refuses its row with a "Line N" note that
      says quoted fields are not read.
    - A child stop's zone is left to the reader, as decision 3 says. No `parent_station` column.

## Files

Create, under `apps/dox/`:

- `src/lib/gtfs-trip-board.ts`, `.test.ts`
- `src/lib/gtfs-trip-board-mount.ts`, `-mount.test.tsx`
- `src/lib/gtfs-trip-board-prose.test.ts`
- `src/components/GtfsTripBoard.astro`
- `src/widgets/tools/gtfs-trip-board.module.css`
- `src/content/docs/tools/gtfs-trip-board.mdx`
- `src/test/trip-board-lib.ts`
- `scripts/gtfs-trip-board-holds.browser.test.ts`

Modify, under `apps/dox/`:

- **Library and sibling:** `src/lib/rail-lib.ts`, and `src/lib/gtfs-service-day-clock.ts`, which
  exports `recorder` and `yearAt` and changes no behaviour.
- **Chat and permalink:** `src/lib/dox-tools.ts`, `worker/tools.ts`, `worker/tools.test.ts`,
  `src/lib/widget-permalink.ts`, `src/lib/widget-permalink.test.ts`,
  `src/components/ask/widget-registry.ts`, `src/lib/chat-constants.ts`.
- **Site lists and graph tests:** `src/lib/mdx-jsx.ts`, `src/lib/industry-overview.ts`,
  `src/components/ask/widget-graph.test.ts`, `src/lib/widget-load-error.test.tsx`.
- **Gate scripts:** `scripts/grow-measure.mjs`, `scripts/html-diff.mjs`,
  `scripts/visual-snapshot.mjs`, `scripts/readout-still.mjs`.
- **Pages that link to the tool:** `src/content/docs/guides/industries/rail-gtfs-service-days.mdx`,
  `src/content/docs/mistakes/rail.mdx`, `src/content/docs/tools/gtfs-service-day-clock.mdx`.
- **Close-out:** `context/dox/built.md`.

`src/content/docs/tools/index.mdx`, `src/generated/*` and the tool list on `industries/rail.mdx`
are regenerated by `pnpm run generate` (part of `test` and `build`), so do not edit them by hand.
There is no changeset, because nothing under `packages/` changes. `tracker.md`'s RAI-100 row is already
Done, so neither it nor `deps:sync` is touched.

## Definition of done

Run from `apps/dox/`. Build under the worktree path, never under `/tmp`. Use `pnpm exec`, not
`npx`. Serve `dist` with `scripts/lib/static-server.mjs` (the gates runner does this), never with
Python. Kill only your own process ids.

1. `pnpm --filter dox test`: green, including every new test in s1 § Tests.
2. `pnpm --filter dox build`: green.
3. `pnpm --filter dox exec vitest run --config vitest.browser.config.ts scripts/gtfs-trip-board-holds.browser.test.ts`:
   green in Chromium and WebKit.
4. `pnpm --filter dox gates --no-build --only readout-still,grow-measure,table-fit,a11y-axe,a11y-tab-walk,contrast-measure --pages /tools/gtfs-trip-board/,/tools/gtfs-service-day-clock/,/guides/industries/rail-gtfs-service-days/,/mistakes/rail/ --browsers chromium,webkit`:
   no FAIL.
5. `node scripts/table-fit.mjs --browsers chromium,webkit`, unscoped, because `gates` samples
   pages: exit 0.
6. `pnpm dox:docs-check` from the repo root reports no new gap, and `pnpm run validate` from the
   repo root is green.
7. `git status` shows no path under `packages/`.
8. Each preset's board matches the expected values in [s1 § Presets](./s1-trip-board.md#presets).
   The unit test asserts them against the real library.
9. The three pages link to the tool with a preset permalink, and the link resolves.
10. `built.md` § Widget tools has a **GTFS Trip Board** entry after the Service Day Clock, in the
    present tense: what the tool reads and why, `loadTripBoardLib`, the input rules and caps, the
    wrong-reading marking and `scope: "above"`, each with a one-line reason and no history.
