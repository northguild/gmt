# Slice 9b — six #429 widgets with handles and tables

This slice moves dwell-ledger, stored-time-audit, dst-inspector, interval-visualizer,
duration-parser-bench and connection-checker onto the kit. Three of them hand-type a slider
handle. Follow the [migration recipe](./09a-gnss-ids-bridge.md#2--migration-recipe-every-widget-in-9a10f).

## Current state (verified)

| Widget | Mount | Test | Sheet | What changes |
|---|---|---|---|---|
| dwell-ledger | 748 | 497 | 95 | `role="slider"` hand-typed at `:122`; preset, readouts ×5, asides ×3 |
| stored-time-audit | 763 | 1422 | 642 | chips, preset, readouts ×6, asides ×4; module counter |
| dst-inspector | 791 | 455 | 218 | ticker handle at `:153`; empty-cell padding `!important` cause (`gmt-dst-inspector.css:71`) |
| interval-visualizer | 636 | 463 | 173 | handles at `:68` on `.gmt-interval-track`; copy ×3 |
| duration-parser-bench | 455 | 217 | 360 | test `:162` reads `td:nth-child(2)` |
| connection-checker | 431 | 288 | 96 | range ×2; its asides already sit in a grow slot (slice 4, cause 9a) |

Two outliers sit outside these widgets' own tests:

- `src/components/ask/rail-keyboard.test.tsx:34-50` (`stubTrackGeometry`) queries
  `.gmt-interval-track` and stubs `getBoundingClientRect`. The interval visualizer's handles
  move to `<gmt-handle>`, so this test moves in this slice.
- `duration-parser-bench-mount.test.tsx:162` selects the human column with `td:nth-child(2)`.

## Files and changes

- **Three handles become `<gmt-handle>`** (dwell-ledger, dst-inspector, interval-visualizer).
  - The interval visualizer's two thumbs on one track follow the APG Multi-Thumb Slider: each
    is bounded by the other, and each has its own `aria-label` ("Interval start", "Interval
    end") and an `aria-valuetext` with the written instant.
  - Each mount passes a `formatValue` that returns the same text it shows today.
- **Tables go through `table()`** with typed columns. The duration bench's "human" column is
  `{ key: "human", header: …, numeric: false }`.
  - The test finds that column by its header: `within(table).getAllByRole("cell")` filtered by
    `columnheader` index from `getAllByRole("columnheader")`. Add a kit helper,
    `cellsInColumn(table, headerName)`, in `render-widget.ts` with its own test. It replaces
    any other column-by-position lookup.
- **dst-inspector.** The empty cell is a module class: `.emptyCell` in
  `dst-inspector.module.css`, unlayered, so it wins over `.gmt-widget td` without a flag.
  Delete the interim 8b rule.
- **stored-time-audit.** Its chips become `<gmt-chips>`, and the selected ink is the
  element's own (cause 8). It has 1422 test lines: keep every case, query by role and name,
  and drive the chips with `user.click`.
- **connection-checker.** Its asides become `aside()` inside a `<gmt-grow>`, which keeps slice
  4's fix through the kit.
- **`rail-keyboard.test.tsx`.** Delete `stubTrackGeometry`. Drive the handle with
  `user.keyboard` after focusing `screen.getByRole("slider", { name: "Interval start" })`.
  Geometry-dependent drags are covered by `readout-still` in Chromium, and by the node test of
  `valueAt` (8a).

## Traps

- dst-inspector's ticker handle scrubs through the transitions of a year, and its
  `aria-valuetext` must name the instant and the offset, not a percentage.
- Arrow keys on a handle must not scroll the page. Call `preventDefault` only for the keys the
  element handles, so that Tab and the screen-reader keys still pass.
- The duration bench re-draws only the `formatDuration` cells on a locale change. The test
  still checks that the other cells keep their text; use the `cellsInColumn` helper on both.
- Removing `.gmt-interval-track` also removes the selector that `readout-still` or another gate
  may use. Before deleting, run `rg -n 'gmt-interval-track|gmt-handle' apps/dox/scripts`.
  Every gate locator is role and name based since slice 3. Fix any that is not.

## Definition of done

1. From `apps/dox`: `pnpm test`, `pnpm check` and `pnpm lint` pass, and the legacy lists are
   shorter by these six widgets and `rail-keyboard.test.tsx`.
2. `rg -n 'role="slider"' apps/dox/src/lib` lists none of these three widgets.
3. Run every gate in Chromium, both themes, at 390 and 1440, on the six tool pages and on
   `/dox/` with the interval visualizer in the rail.
   - `readout-still` shows no movement under drag.
   - `a11y-tab-walk` reaches each thumb in order.
   - `contrast-measure` lists each #429 pair at 7:1 or more.
4. **Keyboard.** On each handle, Home, End, PageUp, PageDown and the arrows move the value, and
   the two interval thumbs never cross. A jsdom test covers each, and one Chromium run of
   `a11y-tab-walk` covers the order.
5. **Chat rail** mount and abort for each of the six, with no console error and no leaked
   listener.
6. **Permalink** round trip for each of the six.
7. `html-diff`: every `✗` is named, and the baseline is captured again.
8. No card has a left-border-only accent.
9. `node scripts/verdict.mjs validate` passes.
