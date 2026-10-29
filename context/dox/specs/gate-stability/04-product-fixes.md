# Slice 4 — product fixes for causes 1, 4 and 9a

These three causes are confirmed on macOS Chromium. Each fix is in `apps/dox/src/`.

- Rebuild once before you judge anything: run `pnpm gates` without `--no-build`. That builds
  `apps/dox` only.
- Every confirm command here runs Chromium only (owner decision). WebKit and Firefox coverage
  comes from the weekly run.

## 1 · Content-table `table-layout` beats widget tables (confirmed)

**Cause.** The rule `.sl-markdown-content table { table-layout: auto }` (`gmt-content.css:214`)
has specificity (0,1,1). It beats `.gmt-gnss-table { table-layout: fixed }`
(`gmt-gnss-widgets.css:312`, (0,1,0)), so the columns reflow on every drag:

- the week-slider `th` goes from 287 to 312 px and its `td` from 138 to 86 px (1440);
- the rollover `th` goes from 184 to 292 px.

**Same trap, not yet hit.** `.gmt-timetable-rows` (`gmt-timetable-reader.css:914`, (0,1,0),
inside `@container gmt-timetable-pane (min-width: 47.25rem)`). The cron, dbench, iddecode, leap,
obs and stored tables already avoid the trap with (0,2,0) selectors.

**Fix.** Take the `table-layout` declaration out of that rule and scope it:

```css
.sl-markdown-content table:not(:where(.not-content *)) { table-layout: auto; }
```

`:where` keeps the specificity at (0,1,1), so content tables do not change. Leave every other
content-table declaration as it is: `width`, `border-*`, and the `th` font, colour and padding
at `gmt-content.css:611-634` style about 18 widget tables on purpose. Slice 8b puts the global
sheets in `@layer`, and slice 11 removes the widget table rules.

Then remove the (0,2,0) `table-layout` overrides that exist **only** to beat line 214:

- `grep -n 'table-layout' apps/dox/src/styles/*.css`
- Keep any override that sets a value for another reason.

**Bounding-box check.** This is definition of done item 7. Add a `readout-still` assertion for
the gnss-week-decoder, gnss-rollover-checker, satellite-clock-converter and timetable-reader
rows: every `th` and `td` box in the drawn table keeps its width, to within 0.5 px, across the
PageUp and drag passes. It must fail before the fix and pass after.

**Confirm.**

```sh
pnpm gates --no-build --only readout-still --pages /tools/gnss-week-decoder/,/tools/gnss-rollover-checker/,/tools/satellite-clock-converter/,/tools/timetable-reader/ --browsers chromium --themes dark,light
```

Firefox also showed a 1–2 px `above:wbr` shift. Expect the same reflow. Slice 9a applies the
readout rule (`<gmt-readout>` with a reserved width) to these widgets, and slice 11's local
Firefox run confirms the shift is gone.

## 4 · Canada check page scrolls sideways at 375 (confirmed, fresh HEAD build)

**Cause.** `table.gmt-clockcheck-stored-table` overflows the viewport.

- Rendered by `clock-change-stored.ts`.
- CSS at `clock-change.css:1722`, with the stacked form near line 1880.
- Chromium: the table is 343.03 px wide and its right edge is at 376.03 px, in a 375 px viewport.
- WebKit (from the earlier probe): the right edge is at 384.16 px against a `clientWidth` of 355.
  The stacked `td` cells (`code`, `details`, `dl`, `dd`) are 323 px wide.

**Reproduce.** About 7 s:

```sh
pnpm gates --no-build --only canada-clock-still --pages /check/canada-2026-clock-change/ --browsers chromium --retries 0
```

**Fix.**

1. Find the widest unbreakable descendant with slice 3's computed-style rule. The slice-3 message
   names it.
2. In the stacked form, make the table fit its box at 375:
   - the table, `tbody`, `tr` and `td` take `display: block`, `min-inline-size: 0` and
     `max-inline-size: 100%`;
   - `border-spacing` has no inline part.
3. A code token that is still too wide takes the `gmt-codebreak` break points
   (`src/lib/code-break.ts`), as #422 set for tables. Never use `overflow-wrap: anywhere` on code.

**Confirm.** `canada-clock-still`, `canada-stored-still`, `canada-layout-check` and `table-fit`
pass on the page in Chromium, both themes.

## 9a · connection-checker, `jump-over-limit` 77–80 px (confirmed)

**Cause.** In `connection-checker-mount.ts`, three parts change height on a preset change, and
none of them is inside a grow slot:

- the `reason-aside` (line 143, filled by `renderAside` at lines 276–288);
- the `disagrees` badge (lines 255–261);
- `naive-detail`.

**Fix.** Put each of them inside a grow slot, the pattern the other tools use
(`smooth-height.ts` `smoothHeight` / `smoothHeights`;
[built.md § Tier 2](../../built.md#tier-2--widget-platform), Gates). Do not reserve the aside's
height while it is empty. That leaves a hole the reader sees.

**Confirm.** It fails before the fix at 1440 and 390, and passes after:

```sh
pnpm gates --no-build --only grow-measure --pages /tools/connection-checker/ --browsers chromium --themes dark,light
```

**Accent rule.** No card restyled here may take a left-border-only accent
([persona rule](../../../../.agents/dox-architect.md)).
