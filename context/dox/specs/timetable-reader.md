# Spec: Timetable Reader

This spec states the Timetable Reader (`/tools/timetable-reader/`, widget kind `timetable`,
chat tool `showTimetableReader`) as it is built: its layout, the day track with one handle per
row, the row frames, the two-clocks chart and the table. A change to the tool is planned
against it and verified with section H. The tool is not `packages/gmt` work, and it computes
none of the results it shows.

`tran-9-multi-leg-scheduling.md` § C-d governs the state model, the presets, the chat
registration and the permalinks (section E). This spec governs everything the reader sees.

Read with it:

- `context/dox/built.md` § Rules and § Tier 2: the control system, the cut-off chart recipes,
  "Axis and track labels are fitted by measurement", every trap, "Result regions ease through
  `.gmt-grow`" and "Gates".
- `reference/design-system.md`: rules 1, 2 and 6, § Form controls, § Smooth growth, § Drawn
  charts, § Verifying.
- `reference/visual-design.md`: § Panels; § Corners, borders, focus; § Controls; § Widget
  chrome; § Motion; § Layout stability.
- The two patterns the tool follows: the `.gmt-handle` slider in
  `src/lib/interval-visualizer-mount.ts`, and the chart that refits only when a drag settles
  in `src/lib/departure-board-mount.ts`.

Every value in this spec is computed against `packages/gmt/dist`. Section 9 holds the table
and appendix Z the script that checks it. Do not type a result that is not in section 9 or in
the tests.

---

## 0. Binding rules

- **No git operations.** Leave everything unstaged. Change nothing under `packages/gmt`.
- **The widget draws the library's results and computes none of them.** Every instant,
  arrival, classification, band boundary and offset on screen comes from a library call
  (C0). Positions, snapping, tick instants and the chart window are drawing.
  `@js-temporal/polyfill` is imported for drawing only, as `transport-widgets.ts` does.
- **gmt is imported through `GMT_MODULES` at module granularity.** A failed import throws
  `WidgetLoadError`. React stays inside `/dox`.
- **The tool composes the control system.** `.gmt-field-grid`, `labelTextHtml()`,
  `.gmt-input`, `.gmt-select`, `.gmt-handle`, `setControlValue`. Its sheet adds no control
  CSS, with the one exception in C5. Real `<select>`, `<input>` and `<fieldset>` elements.
- **`escapeAttr` or `escapeHtml` on every template interpolation.**
- **Sentinels go through `renderWidgetOutput(el, "NO SIGNAL", "sentinel")`.** Amber is only
  for that sentinel.
- **Tests never read the real clock or the network.**
- **Every Astro or Vite command sets `DOX_VITE_CACHE_DIR` to a private folder** (built.md
  § Tier 6, Runbooks).

---

## A. What the tool is

1. Section 1 spans the full width: one line of controls, one day track with a handle per row,
   then four bevelled row frames with corner brackets.
2. Section 2 spans the full width under it: the two-clocks chart, then the table, which fills
   its panel.
3. Section 3 spans the full width under that: the call for one row, and its result.
4. `scripts/readout-still.mjs` and `scripts/grow-measure.mjs` cover the handles.
5. A printed time on a date the zone skipped whole is `skipped`: `classify` asks
   `classifyLocal`. Rows C3 and C4 of section 9 show why comparing `HH:MM` cannot tell a
   skipped day from a repeated hour.

This spec does not govern the widget kind, the chat tool, its schema, its docs entry, its
starter, the permalink keys, the presets or the tool page's prose. Those are TRAN-9's
(section E).

The tool shares three things with other tools, each through one rule:

- the corner-bracket frame, with the Delivery Scheduler's legs (F4);
- the chart recipes of `gmt-cutoff-widgets.css`, with the six other drawn charts (F5);
- the disabled look of `.gmt-input` and `.gmt-select`, with every tool that disables one
  (`gmt-form-controls.css`; design-system.md § Form controls). The tool's sheet does not
  style the state.

---

## B. Layout

### B1. How the three sections sit

Each of the three `.gmt-widget-section`s carries `gmt-widget-section--wide`, so each takes the
whole row at every width. They stack: 1, 2, 3.

The class is the rule `.gmt-widget-card > .gmt-widget-section.gmt-widget-section--wide`
(`gmt-widget.css`). A bare `.gmt-widget-section--wide` loses to the card's span rules from
80rem; this selector ties the `:first-child` and `:nth-child(2)` rules and wins on order (F6).

Sections 1 and 2 each hold one `.gmt-timetable-split` of `.gmt-timetable-pane`s, after the
`<h4>`, in this DOM order (which is the reading and Tab order at every width):

| Section | Whole-row children of the split | Pane 1 (pictures) | Pane 2 (values) |
| --- | --- | --- | --- |
| 1 | the controls line, the preset's description | the day track, then its hint | the four row frames |
| 2 | none | the two-clocks chart (caption, legend) | the table, then the DST Inspector pointer |

Stacked, a split and a pane are columns with the section's own `gap`, so the layout is the
one the tool had before the panes. In the two-column band (B2) a split is a two-column grid.

### B2. Bands

All layout rules are `@container` queries, never viewport queries. They are queried by name,
because `.gmt-field-grid` is a container too and an unnamed query on a control resolves to the
field grid, not the section. Two names: the section, for the controls line and the two-column
band, and the pane, for everything inside a pane.

```css
.gmt-timetable > .gmt-widget-card > .gmt-widget-section { container-name: gmt-timetable-section; }
.gmt-timetable-pane { container: gmt-timetable-pane / inline-size; }
```

A pane is the section's width when stacked and a column's width in the band, so the track,
frame, chart and table breakpoints (below, and C2, C5, D2, D4) are written once, against the
pane, and hold in both.

`w` is the section's content width (the widget root less 34px). The measured widths (Chromium,
the built page):

| Viewport | Root | `w` | Band |
| --- | --- | --- | --- |
| 2560 | 1912 | 1878 | two columns |
| 2000 | 1352 | 1318 | two columns |
| 1920 | 1272 | 1238 | two columns (18px over) |
| 1902 | 1254 | 1220 | two columns (the first) |
| 1536 | 888 | 854 | wide |
| 1440 | 792 | 758 | compact four |
| 1024 | 692 | 658 | two by two |
| 768 | 736 | 702 | two by two |
| 390 | 358 | 324 | stacked |
| `/dox` rail, root forced to 360 and 300 | 360, 300 | 326, 266 | stacked |

A 1440px viewport leaves a 792px pane: the sidebar and the table of contents take the rest.

**The two-column band** starts at `w` = 76.25rem (1220px): the narrowest section that holds
the right column's minimum, the left column's floor and the gap.

| Part | Width | Why |
| --- | --- | --- |
| Right column minimum | 47.25rem (756px) | The table's four columns without a broken value (D4). The 2 × 2 frames need less: a frame holds its two fields side by side at 350px (two 10rem tracks, a 12px gap, 8px padding, borders), so 708px. |
| Left column floor | 28rem (448px) | The track and chart work at 324px; the floor is legibility. At 448px the lanes are 396px, so a track hour is 16.5px, track ticks fall every third hour, and the chart (374px for 6 hours) ticks every hour. |
| Gap | 1rem | The seam. A gap only: no border on either column, no divider. |
| Band start | 28 + 1 + 47.25 = 76.25rem | |

The columns are `minmax(28rem, 1fr) minmax(47.25rem, 1fr)`, held in `--tt-cols` on the widget
root and used by both splits. The right column keeps 47.25rem until half the row is wider, and
the left column takes the rest; with more room the two are equal. Sections 1 and 2 are
separate cards, so a subgrid cannot span them; they share the template instead, and since
their width, border and padding match and every track has a fixed minimum, both resolve to the
same two columns, so the seam is one line through both.

Row frames, by pane width `p` (the band is two by two at every `p`):

| Band | Row frames |
| --- | --- |
| band, `p` under 49.25rem | 2 × 2, compact (C5), fields side by side |
| band, `p` 49.25rem and up | 2 × 2, full size, fields side by side |
| wide (`w` 52rem to under 76.25rem) | four in a row |
| compact four (45.5rem to under 52rem) | four in a row, compact (C5) |
| two by two (26rem to under 45.5rem) | two rows of two, fields stacked or side by side by the field grid's own `auto-fit` |
| stacked (under 26rem) | one per row |

Chart caption row: one line from a pane of 30rem (a caption of 452px and a chip of 199px need
480px), two lines under it. Day status line: one line from a pane of 34.75rem (the longest
caption 311px, the longest chip 203px, 32px of padding), two lines under it.

The controls line and the table each have a boundary of their own. Each is derived from a
measured width, and the derivation is written out beside its rule in
`gmt-timetable-reader.css` (C2, D4). The sheet is the source for every number; this spec
states the rule each number follows.

### B3. The wide stacked form (1536, `w` 52rem to under 76.25rem)

```text
┌ 1. THE TIMETABLE ──────────────────────────────────────────────────────────────────┐
│ Preset [▾ New York's fall-back night…      ]  Printed in [▾]  Run time [PT1H]  Arrives in [▾] │
│ New York's fall-back night, printed as three timetable rows. …                      │
│ ┌ day ───────────────────────────────────────────────────────────────────────────┐ │
│ │ Local day 2024-11-03 in America/New_York            [01:00–02:00 happens twice] │ │
│ │   ▒▒▒                                                                            │ │
│ │ ▮[1 · 00:30]                                                                     │ │
│ │   ▒▮[2 · 01:30 twice]                                                            │ │
│ │   ▒▒▒ ▮[3 · 02:30]                                                               │ │
│ │   ▒▒▒  [4 · click to add]                                                        │ │
│ │ 00:00   02:00   04:00   06:00   …                                       22:00    │ │
│ └──────────────────────────────────────────────────────────────────────────────────┘ │
│ Drag a handle, or focus it and use the arrow keys. …                                │
│ ⌜ ROW 1 ───────────┐ ⌜ ROW 2 ───────────┐ ⌜ ROW 3 ───────────┐ ⌜ ROW 4 ───────────┐ │
│ │ Printed  Offset   │ │ Printed  Offset   │ │ …                 │ │ …                 │ │
│ │ [……………] [None ▾]  │ │ [……………] [None ▾]  │ │                   │ │                   │ │
│ └──────────────────⌟ └──────────────────⌟ └──────────────────⌟ └──────────────────⌟ │
└──────────────────────────────────────────────────────────────────────────────────────┘
┌ 2. WHAT EACH PRINTED TIME MEANS ────────────────────────────────────────────────────┐
│ ┌ two clocks ─────────────────────────────────────────────────────────────────────┐ │
│ │ Printed clock · America/New_York                 [01:00–02:00 happens twice]     │ │
│ │ 00:00      01:00      02:00      03:00      04:00      05:00      06:00          │ │
│ │ ──●────────▓▓▓●▓▓▓▓▓▓▓─────●──────────────────────────────────────────────       │ │
│ │   │        │▒▒▒│▒▒▒╲▒▒▒╲     ╲                                                    │ │
│ │   │        │▒▒▒│▒▒▒▒▒╲▒▒╲     ╲                                                   │ │
│ │ ──●────────┴───●──────┴────────●──────────────────────────────────────────       │ │
│ │ 04:00Z     05:00Z     06:00Z     07:00Z     08:00Z     09:00Z     10:00Z         │ │
│ │ Exact time · UTC          [UTC−04:00]            [UTC−05:00]                     │ │
│ │ 1 ▬▬▬▬▬▬▬▬▬▬ [01:30 -04:00]                                                      │ │
│ │ 2            ▬▬▬▬▬▬▬▬▬▬ [01:30 -05:00]                                           │ │
│ │ 3                               ▬▬▬▬▬▬▬▬▬▬ [03:30 -05:00]                        │ │
│ │ Arrival times are in America/New_York.                                           │ │
│ │ ─ printed time to its instant  ┄ a skipped time, read forward  ▬ run time to     │ │
│ │ arrival  ▒ an hour that repeats  ▨ an hour that is skipped                       │ │
│ └──────────────────────────────────────────────────────────────────────────────────┘ │
│ PRINTED            │ LEAVES (EXACT)          │ NOTE                │ LOCAL ARRIVAL    │
│ ■ 1 2024-11-03T…   │ 00:30 -04:00  full…     │                     │ 01:30 -04:00 …   │
│ ■ 2 2024-11-03T…   │ 01:30 -04:00  full…     │ Occurs twice: …     │ 01:30 -05:00 …   │
│ ■ 3 2024-11-03T…   │ 02:30 -05:00  full…     │                     │ 03:30 -05:00 …   │
│ For the general rule … see the DST Inspector.                                        │
└──────────────────────────────────────────────────────────────────────────────────────┘
┌ 3. WHAT scheduleDelivery RETURNS ───────────────────────────────────────────────────┐
│ Show the call for [▾ Row 1 (2024-11-03T00:30:00)]                                    │
│ scheduleDelivery([{ departure: "…", duration: "PT1H", timeZone: "…" }], { … })   [⧉] │
│ { eta: "…", legTimes: [ … ] }                                                        │
│ (Why null, only when the picked row returns null)                                    │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

A frame's two fields share one row where the frame's own field grid fits two tracks, and
stack where it does not. That is the control system's `auto-fit`, not a rule of this sheet.

### B4. The two-column band (`w` 76.25rem and up)

```text
┌ 1. THE TIMETABLE ──────────────────────────────────────────────────────────────────┐
│ Preset [▾ New York's fall-back night…      ]  Printed in [▾]  Run time  Arrives in [▾] │
│ New York's fall-back night, printed as three timetable rows. …                      │
│ ┌ day ─────────────────────────────┐   ⌜ ROW 1 ──────────┐  ⌜ ROW 2 ──────────┐   │
│ │ Local day 2024-11-03 …  [twice]  │   │ Printed   Offset  │  │ Printed   Offset  │   │
│ │ four lanes, ticks                │   └───────────────────⌟  └───────────────────⌟   │
│ └──────────────────────────────────┘   ⌜ ROW 3 ──────────┐  ⌜ ROW 4 ──────────┐   │
│ Drag a handle, or …                    └───────────────────⌟  └───────────────────⌟   │
└──────────────────────────────────────────────────────────────────────────────────────┘
┌ 2. WHAT EACH PRINTED TIME MEANS ────────────────────────────────────────────────────┐
│ ┌ two clocks ──────────────────────┐   PRINTED    LEAVES    NOTE     LOCAL ARRIVAL    │
│ │ caption, ticks, fan, offsets,    │   1 …        …         …        …                │
│ │ journeys, legend                 │   2 …                                           │
│ └──────────────────────────────────┘   For the general rule … see the DST Inspector.  │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

- **Pictures left, values right, one seam.** The day track sits above the two-clocks chart
  and the frames above the table, with the same gap between the columns in both sections.
- **Tops line up.** The frames' pane is pulled up 10.5px (half its legend, because a
  fieldset's border runs through the legend) so the frame edge meets the track's; the table
  drops its 8px top margin so its header meets the chart's frame. Nothing is stretched: the
  shorter pane keeps its height (measured gaps are in H).
- **The chart's caption reserves two lines** under a 41.5rem pane (the longest two-zone
  caption is 641px), so a zone change moves nothing.
- **Frames.** Two by two, each with its two fields side by side, the Offset select showing
  its longest label whole, the reason slot reserved, the corner brackets drawn.

### B4a. As the section narrows

- **Controls.** The four share one line from 64.25rem. Under it the preset has a row of its
  own and the other three share the next row; in the stacked band there is one field per row
  (C2).
- **Row frames.** Four in a row, then two by two, then one per row, by the bands of B2. In
  the compact-four band the frames are about 183px wide (measured at 1440), which is why
  that band alone sets the frame's two controls to `--gmt-text-xs` (C5).
- **Day track.** Always the pane's full width. Its ticks thin by measurement, and its status
  line becomes two lines in a pane under 34.75rem (C3).
- **Chart.** Always the pane's full width. In a pane under 30rem the fan is shorter and the
  two captions take two lines (D2).
- **Table.** Four columns down to the table's boundary, stacked rows under it, and the label
  above its value in the narrowest rail (D4).

### B5. 390 and the `/dox` rail (stacked)


```text
┌ 1 ──────────────────────────────┐
│ Preset [▾ …]                    │
│ Printed in [▾ …]                │
│ Run time [PT1H]                 │
│ Arrives in [▾ …]                │
│ description                     │
│ ┌ day ────────────────────────┐ │
│ │ Local day 2024-11-03 in     │ │
│ │ America/New_York            │ │
│ │ [01:00–02:00 happens twice] │ │
│ │ four lanes, 28px each       │ │
│ │ 00:00   06:00  12:00  18:00 │ │
│ └─────────────────────────────┘ │
│ hint                            │
│ ⌜ ROW 1 ─────────────────────┐  │
│ └────────────────────────────⌟  │
│ ⌜ ROW 2 … ROW 3 … ROW 4         │
└─────────────────────────────────┘
┌ 2: chart, then stacked rows ────┐
┌ 3 ──────────────────────────────┐
```

The track fits the width; nothing scrolls sideways. A day is 24 hours in about 270px, so a
repeated hour is about 11px wide. That is why each row has its own lane (C3), why the pointer
snaps more coarsely on a short track (C4), and why the chart shows a window rather than the
whole day (D1): at 390 an hour in the chart is about 40px.

---

## C. Section 1

### C0. The library and the pure helpers

**`src/lib/transport-lib.ts`** has `loadTimetableLib(): Promise<TimetableLib>`. It awaits
`loadTransportLib()`, `GMT_MODULES["zoned/get"]()` and `GMT_MODULES["instant/convert"]()`
together and adds `getDstTransitions` and `classifyLocal`. `loadTransportLib` and
`TransportLib` hold neither, so the other three TRAN-9 widgets do not load them.

**`src/lib/timetable-reader.ts`** is pure: no DOM, no gmt import, and the polyfill for drawing
only. Its header says which helpers are drawing.

```ts
export interface DstTransition { instant: string; offsetBefore: string; offsetAfter: string }
export interface TimetableLib extends TransportLib {
  getDstTransitions(timeZone: string, year: number): DstTransition[];
  classifyLocal(localDateTime: string, timeZone: string):
    "unique" | "ambiguous" | "nonexistent" | null;
}
```

The library calls, and what each one is for:

| What is shown | Call |
| --- | --- |
| Whether a printed time happens once, twice or never | `classifyLocal(printed, startTimeZone)` |
| The clock changes on the track's date | `getDstTransitions(startTimeZone, year)` |
| The two wall readings at a change (the band's edges) | `etaAtZone(t.instant, t.offsetBefore)` and `etaAtZone(t.instant, t.offsetAfter)` |
| The instant a row leaves | `leavesAt` (a zero-length `scheduleDelivery` leg) |
| The arrival and the local arrival | `rowResult` (the row's own `scheduleDelivery` call) |
| The two offsets of a repeated or skipped time | `offsetChoices` (`resolveLocal` and `etaAtZone`) |
| The start of the local day, and of the next | `resolveLocal(date + "T00:00:00", startTimeZone)`, default disambiguation (D1) |
| Where a band lands in exact time | `resolveLocal(band.startWall, zone, { disambiguation: "earlier" })`, the transition's `instant`, `resolveLocal(band.endWall, zone)` |
| The length of the run, for the chart's tail | `transitTime(dayStart, duration)` |

No table of DST dates exists anywhere in the tool.

Classification:

- `RowClass` is `"once" | "twice" | "skipped" | "invalid"`.
- `classify(printed, zone, lib: TimetableLib)` returns `once` for `unique`, `twice` for
  `ambiguous`, `skipped` for `nonexistent` and `invalid` for `null`. It makes one call.
- `offsetChoices` returns the single "None" choice for `once` and for `invalid`.
  `rowBadge("invalid", …)` is `null`.

The drawing helpers. Each has unit tests (F2).

- `STEP_MINUTES = 5`, `BIG_STEP_MINUTES = 60`, `MAX_MINUTE = 1435`.
- **`trackDate(state, lib): string | null`**: the ISO date of the first row, in row order,
  whose trimmed `departure` passes `lib.isValidDateTime`. Read with
  `Temporal.PlainDateTime.from`. `null` when no row has one.
  *Why the first row:* the reader can say which date the track shows by reading one line of
  the status text.
- **`rowMinute(printed): number | null`**: minutes after 00:00, seconds dropped.
- **`withMinute(date, minute): string`**: `` `${date}T${HH}:${MM}:00` ``. This is the form the
  presets use, so a handle dragged back to a preset's time matches the preset again.
- **`laneState(state, i, date, lib)`**:
  `{ state: "blank" } | { state: "invalid" } | { state: "off"; date: string } | { state: "on"; minute: number; kind: RowClass }`.
  `off` is a valid time on another date.
- **`dayBands(zone, date, lib): DayBand[]`**, where `DayBand` is
  `{ kind: "twice" | "skipped"; startMinute; endMinute; from; to; startWall; endWall; instant; offsetBefore; offsetAfter }`:
  1. Take the transitions of the date's year. Add the next year's when the date is
     31 December, and the previous year's when it is 1 January: a change is listed under the
     year of its later wall reading, so a change at midnight on 1 January can shade
     31 December (row B11).
  2. For each transition, `before` is the first 19 characters of
     `etaAtZone(t.instant, t.offsetBefore)` and `after` the same of
     `etaAtZone(t.instant, t.offsetAfter)`.
  3. `after < before` (compared as strings) is `twice`, from `after` to `before`.
     `after > before` is `skipped`, from `before` to `after`. Equal is no band.
  4. Keep a band that overlaps the date, and clip it to the date. `startMinute` and
     `endMinute` are 0 to 1440, start inclusive, end exclusive. `from` and `to` are the
     `HH:MM` of the two unclipped readings, so a band that ends at the next midnight reads
     `23:00` to `00:00` and never a made-up `24:00`.
  5. Return `[]` for a year outside 1 to 9999, an invalid zone or an invalid date.
- **`bandAt(minute, bands): DayBand | null`**.
- **`bandChipText(bands)`**: the words for a day's bands, shared by the track's chip and the
  chart's (C3).
- **`pointerStep(trackPx): 5 | 10 | 15 | 30`**: the smallest of the four whose width on the
  track is at least 2.5px (`trackPx * step / 1440 >= 2.5`), else 30. So 5 from 720px, 10 from
  360px, 15 from 240px. Every preset time is a multiple of 30.
- **`minuteAtPointer(clientX, left, width, step)`**: the pointer's minute, rounded to `step`,
  clamped to 0 and `MAX_MINUTE`.
- **`stepMinute(minute, direction)`**: the next multiple of 5 in that direction, clamped to 0
  and `MAX_MINUTE`. From 01:32, right gives 01:35 and left gives 01:30.
- **`jumpMinute(minute, direction)`**: 60 minutes later or earlier, clamped the same way. From
  00:30, later gives 01:30. It keeps the minutes, so "an hour" means an hour.
- **`tickStepHours(pxPerHour, labelPx): 1 | 2 | 3 | 6 | 12`**: the smallest step whose pitch is
  at least `labelPx`, else 12.
- **`handleValueText(hhmm, kind, offset, leaves)`** and **`tagText(n, hhmm, kind)`** (C4).
- **`arrivalChipText(iso, date)`** and **`arrivalChipPlacement(…)`** (D2).
- **`chartLayout(state, lib, facts?, memo?)`, `chartWindow(layout)`, `chartSummary(layout)`**
  (D1, D3), with `rowFacts`, `newChartMemo` and `bandsFor`, which let the mount make each
  row's two library calls once per render and keep what does not change while a handle moves.
- **`LONGEST_BADGE`**: the longest of `rowBadge("twice", false)`, `rowBadge("twice", true)`
  and `rowBadge("skipped", false)`, computed, so it cannot drift from them.
- **`zonedParts(text)`** and **`shapeOf`** (D4, D5).

### C1. Markup, in order

```text
<div class="gmt-timetable gmt-widget not-content">
 <div class="gmt-widget-card">
  <div class="gmt-widget-section gmt-widget-section--wide">
    <h4>1. The timetable</h4>
    <div class="gmt-field-grid gmt-timetable-top">        preset, start-zone, duration, zone
    <p class="gmt-widget-hint" data-role="preset-description" data-grow="slot">
    <div class="gmt-timetable-day" data-role="day">        the track (C3)
    <p class="gmt-widget-hint">                           static (C4)
    <div class="gmt-timetable-rowset" data-role="rowset"> four frames (C5)
  </div>
  <div class="gmt-widget-section gmt-widget-section--wide">   section 2 (D)
  <div class="gmt-widget-section gmt-widget-section--wide">   section 3 (D6)
 </div>
</div>
```

The `data-role`s that TRAN-9's tests and the chat rail rely on: `preset`,
`preset-description`, `start-zone`, `duration`, `zone`, `departure-1…4`, `offset-1…4`,
`row-1…4` (the fieldsets), `rows`, `rows-body`, `row-N-display`, `badge-N`, `reason-aside`,
`row-pick`, `call-timetable`, `copy-timetable`, `timetable-output`.

The server renders the frames with their values, and the track and the chart as empty
skeletons at their final height. The mount fills them. Nothing in section 1 changes height at
mount.

### C2. The controls line

Four labels in one `.gmt-field-grid.gmt-timetable-top`, in this order: Preset, Printed in,
Run time, Arrives in. The preset label carries `gmt-timetable-preset`.

- **The preset shares the line with the other three only where the line can show its longest
  label whole.** A select cannot wrap, and the preset is the main control. The boundary is
  the measured width of the longest preset label in the control's face, plus the select's
  padding and border, plus three field-grid tracks and three gaps. From there the grid is one
  row: a preset column with that width as its floor, and three equal columns.
- **Under the boundary the preset takes a row of its own** (`grid-column: 1 / -1`), and the
  other three share the next row, in three equal columns while that row holds three
  field-grid tracks. Narrower than that, the field grid's own `auto-fit` places them: two to
  a row, then one.
- These rules set `grid-template-columns` on the grid and `grid-column` on the preset label,
  and nothing else. No control is restyled.
- The boundary follows the presets' labels. A longer label is measured again, and the rule
  and its comment in the sheet are updated with it.

### C3. The day track

One frame, one axis, one band, one tick row, and a lane per row.

*Why lanes:* two rows can print the same time. The `offset-picks` preset prints 01:30 twice,
and on one line the two handles would sit on one pixel. Fixed lanes also keep close handles
separately grabbable at 390.

*Why always four lanes:* section 1 is never a `.gmt-grow` host, so a lane that came and went
with its row would be an un-eased jump on a preset change.

*The span:* the local calendar day of `trackDate`, 00:00 to 24:00 on the wall clock of
"Printed in", linear in wall minutes. `left` is `minute / 1440 * 100` percent.

```html
<div class="gmt-timetable-day" data-role="day">
  <div class="gmt-timetable-day-status">
    <span class="gmt-timetable-day-caption" data-role="day-caption"></span>
    <span class="gmt-cutoff-chip gmt-cutoff-chip--dim" data-role="band-chip"></span>
  </div>
  <div class="gmt-timetable-lanes" data-role="day-track" role="group"
       aria-label="Printed times on the local day">
    <div class="gmt-timetable-bands" data-role="bands" aria-hidden="true"></div>
    <!-- n = 1…4 -->
    <div class="gmt-timetable-lane" data-role="lane-n" data-series="n">
      <div class="gmt-handle" data-role="handle-n" tabindex="0" role="slider"
           aria-orientation="horizontal" aria-label="Row n printed time"
           aria-valuemin="0" aria-valuemax="1435" hidden></div>
      <span class="gmt-cutoff-chip gmt-timetable-tag" data-role="tag-n" aria-hidden="true" hidden></span>
    </div>
  </div>
  <div class="gmt-timetable-day-ticks" data-role="day-ticks" aria-hidden="true"></div>
</div>
```

- **The frame** (`.gmt-timetable-day`) is in the chart-surface list of
  `gmt-cutoff-widgets.css` (F5): bevelled, tinted, hairline, inset highlight, no
  `backdrop-filter`. Its inline padding is `calc(var(--gmt-space-3) + 4px)`, as
  `.gmt-punct-frame`'s, so a handle's hit area at either end stays inside it.
- **The status line** is one fixed line: `justify-content: space-between`, the caption at the
  start and the chip at the end. Under 26rem it is a column of two fixed lines. A
  `min-block-size` holds its height in both forms.
  - Caption: `Local day <date> in <zone>`. With no track date: `Type a printed departure in a
    row to draw its day.`
  - Chip, from `bandChipText`: `<from>–<to> happens twice` or `<from>–<to> never shows`. A
    band that covers the whole day reads `This date never shows on the clock`. With no band
    the chip is `gmt-cutoff-chip--dim` and reads `No clock change this day`. Two bands on one
    day join with `; `. With one band the chip carries `data-kind` and takes that band's edge
    (below). With no track date the chip is hidden; the line keeps its height.
- **The lanes** (`.gmt-timetable-lanes`): `position: relative`, inset by
  `calc(var(--gmt-handle-w) / 2 + 2px)` on each side so a handle at 00:00 or 23:55 is whole.
  Each lane is `1.75rem` tall, `position: relative`, with a 1px `--gmt-hairline-faint` bottom
  border and a 1px centre line in its series colour at 0.35 alpha. The lanes element sets
  `--gmt-handle-hit: 1.75rem`, so the hit squares tile lane to lane and never overlap. 28px is
  over the 24px minimum.
- **The band** (`.gmt-timetable-band`, one per `DayBand`, inside `bands`, which covers all four
  lanes): `left` and `width` in percent from `startMinute` and `endMinute`. Its colours are
  the family's: purple marks a repeated hour and gold a skipped one (built.md § Tier 2, "The
  DST colours").
  - `data-kind="twice"`: a `--gmt-dst-purple` wash at 0.16 alpha, and a `3px double`
    `--gmt-dst-purple` border on both inline edges.
  - `data-kind="skipped"`: the DST Inspector's gap hatch (45°, `--gmt-dst-gold` at 0.18 and
    0.05 alpha) and a `1px dashed` `--gmt-dst-gold` border on both inline edges.
  - Row 3 is the same purple (series 3). A band is told from a row's mark by form: a
    translucent region between its own edges, named by the chip above, against a solid
    numbered mark. The two kinds are told apart by edge, by pattern and by the chip's words,
    never by colour alone.
  - It holds no text. Tint a hatched element with `background-color`, never the shorthand.
- **The ticks** (`.gmt-cutoff-axis-tick` spans in a `position: relative` row `1.9rem` tall,
  the family's height): at every `tickStepHours(trackPx / 24, 44)` hours, labelled `HH:MM`.
  `thinTickLabels(row)` then drops a label that runs past the edge. They are refitted by
  `onWidthChange(track, …)` and once when `document.fonts.ready` resolves; `destroy` disposes
  the watcher.

### C4. Handles

The `.gmt-handle` pattern of the Interval Visualizer, exactly: a `div` with `tabindex="0"`,
`role="slider"`, `aria-orientation="horizontal"`; `pointerdown`, `pointermove`, `pointerup`
and `pointercancel` delegated on the root; `setPointerCapture` on the handle (in a
`try`/`catch`: it can throw); `keydown` delegated on the root. `lostpointercapture` on the
root is a second way out of a drag. No listener is on `document` or `window`, so dropping the
subtree is a complete teardown.

A handle is shown for a row whose `laneState` is `on`, and `hidden` otherwise. It is placed
with `left` only. Its `color` is `var(--series)`.

| Lane state | Handle | Tag (`gmt-cutoff-chip`, `aria-hidden`) |
| --- | --- | --- |
| `on` | shown at `minute` | rides the handle: `tagText` |
| `blank`, with a track date | hidden | pinned at the lane's start, `--dim`: `n · click to add` |
| `blank`, no track date | hidden | hidden |
| `off` | hidden | pinned at the start, `--dim`: `n · on <date>` |
| `invalid` | hidden | pinned at the start, `--dim`: `n · not a date and time` |

- **`tagText(n, hhmm, kind)`**: `1 · 00:30`, `2 · 01:30 twice`, `2 · 02:30 skipped`. The tag
  carries `data-kind`. For `twice` its border is `3px double var(--gmt-dst-purple)`; for
  `skipped`, `1px dashed var(--gmt-dst-gold)`. Its text stays `--gmt-ice`. It sits to the
  right of its handle and flips to the left when it would leave the track (`placeLabel` from
  `label-fit.ts`; `data-side`).
- **ARIA**: `aria-valuemin="0"`, `aria-valuemax="1435"`, `aria-valuenow` the minute,
  `aria-valuetext` from `handleValueText`:
  - `once`: `00:30`
  - `twice`, no offset: `01:30, happens twice, read as the earlier pass`
  - `twice`, offset written: `01:30, happens twice, offset -05:00 written`
  - `skipped`, no offset: `02:30, never shows on the clock, read as 03:30` (the `HH:MM` of
    `leavesAt`)
  - `skipped`, offset written: `02:30, never shows on the clock, no instant`
- **Pointer**: the minute is `minuteAtPointer(clientX, track.left, track.width,
  pointerStep(track.width))`, with the rect of `[data-role="day-track"]`.
- **Keyboard**:

  | Key | Move |
  | --- | --- |
  | ArrowRight, ArrowUp | `stepMinute(m, +1)` |
  | ArrowLeft, ArrowDown | `stepMinute(m, -1)` |
  | PageUp, Shift + ArrowRight or ArrowUp | `jumpMinute(m, +1)` |
  | PageDown, Shift + ArrowLeft or ArrowDown | `jumpMinute(m, -1)` |
  | Home | 00:00 |
  | End | 23:55 |

  Each handled key calls `preventDefault()`.
- **A move changes one thing: the row's printed time.** It writes
  `withMinute(trackDate, minute)` into `departure-n`, calls `syncPreset()` and renders. It
  never changes the row's offset.
  *Why:* the offset is the reader's own choice, and a time that no longer agrees with it
  returns `null`, which is what the library does (rows L6 to L8).
- **Typing moves the handle.** The delegated `input` listener renders, so a valid time on the
  track's date places the handle at once, and anything else hides it.
- **An empty lane adds its row.** `pointerdown` on a lane whose row is `blank`, with a track
  date, writes `withMinute(trackDate, minute)` for the pointer's minute and carries on as a
  drag of that row. The typed field is the other way in. A press on a lane that has a
  handle, away from the handle, does nothing.
- **The preset description holds its height.** `setPresetDescription` from
  `punctuality-widgets.ts` writes `preset-description` everywhere, so a drag that makes the
  state custom does not move the track under the pointer.
- **Settling.** A drag settles on `pointerup`, `pointercancel` or `lostpointercapture`; a key
  move settles on that key's `keyup` or on the handle's `focusout`; a typed value settles on
  `change`; a preset, a zone, the run time and a seed settle at once. Only a settle refits the
  chart's window (D1).
- The mount memoises `dayBands` and the day's start by zone and date, and the tail by zone,
  date and run time (`newChartMemo`). None of them changes while a handle moves.

Under the track, one static line:

`<p class="gmt-widget-hint">Drag a handle, or focus it and use the arrow keys, to move that row's printed time. Page Up and Page Down move an hour. The shaded hour is where the clock repeats or skips.</p>`

### C5. Row frames

```html
<div class="gmt-timetable-rowset" data-role="rowset">
  <fieldset class="gmt-transport-leg gmt-transport-leg--brackets gmt-timetable-row"
            data-role="row-n" data-series="n">
    <legend><span class="gmt-cutoff-series-swatch" aria-hidden="true"></span>Row n</legend>
    <div class="gmt-field-grid gmt-timetable-fields">
      <label class="gmt-label">…Printed departure… <input class="gmt-input" data-role="departure-n" …></label>
      <label class="gmt-label">…Offset, optional… <select class="gmt-select" data-role="offset-n">…</select></label>
    </div>
  </fieldset>
</div>
```

- **The look is the Delivery Scheduler's leg frame, through shared rules.**
  `.gmt-transport-leg` gives the bevelled border and fill. The corner brackets (top left and
  bottom right) are one rule in `gmt-transport-widgets.css`, whose selector list holds
  `.gmt-delivery-leg-fieldset` and `.gmt-transport-leg--brackets` (F4). The bracket colour is
  `var(--leg-color, var(--series, var(--gmt-cyan)))`. When a bracket frame is right is in
  visual-design.md § Panels.
- **Never a left-only accent.** The frame has a full bevelled border. The brackets are two
  corners. The series is also named: the swatch and "Row n".
- The inputs and selects are built with `labelTextHtml` and `escapeAttr`, with no placeholder.
  Neither label is `gmt-field-wide`, so the two fields share a row wherever the frame's grid
  fits two tracks.
- `.gmt-timetable-row` sets `margin: 0` and `min-width: 0`. The rowset is a grid with
  `gap: var(--gmt-space-2)`: four equal columns from 45.5rem, two from 26rem, one under it.
- **The Offset select is enabled only where it matters.** It is `disabled` when
  `offsetChoices` returns one choice and the row's offset is blank. A row that holds an offset
  keeps the select enabled, with that offset among its options, so the reader can always
  clear it. The options and their labels come from `offsetChoices`, through
  `offsetOptionsHtml`: the blank choice, then the zone's two offsets at that change, each
  with a short word for what it picks. A select cuts off text wider than its text area, so
  no label is longer than `OFFSET_LABEL_MAX` characters, which is what the narrowest
  four-in-a-row frame can show. A disabled select has the control system's shared disabled
  look; the tool's sheet adds nothing to it.
- **The one control-size rule.** In the compact-four band the frame's inline padding is
  `--gmt-space-2` and its two controls take `--gmt-text-xs`:

  ```css
  @container gmt-timetable-section (min-width: 45.5rem) and (max-width: 51.99rem) {
    .gmt-timetable-row { padding-inline: var(--gmt-space-2); }
    .gmt-timetable-row :is(.gmt-input, .gmt-select) { font-size: var(--gmt-text-xs); }
  }
  ```

  *Why:* a 758px section gives each of four frames 183px, and the 19-character value needs
  173px at the control's own 13.6px. At 12px it needs 155px. The Delivery Scheduler makes the
  same kind of exception for its long departure value. 12px is the floor.
- Nothing in a frame changes size when its row's time changes. The frame holds no note: the
  note is in the table, where its slot is reserved (D4).

### C6. States

| State | Track | Chart | Table |
| --- | --- | --- | --- |
| A row with a time that happens once | handle, plain tag | a solid connector, a bar | the row, no note |
| Inside a repeated hour, no offset | handle on the band, `twice` tag, select enabled | the connector goes to the earlier pass | "Occurs twice: the earlier instant" |
| Inside a repeated hour, offset written | the same | the connector goes to the pass the offset names | "Offset written: this pass" |
| Inside a skipped hour, no offset | handle on the band, `skipped` tag, select enabled | a dashed connector to the later instant | "Never shows on the clock: the later instant" |
| Any row whose call returns `null` | handle where its time is | a hollow printed mark, no connector, no bar; a `--dim` "no instant" chip in its lane | `NO SIGNAL` in Leaves and in Local arrival |
| A blank row | empty lane, "click to add" | no lane | no row |
| A row on another date | the `n · on <date>` tag | not drawn; named in the summary | the row |
| No valid row | the empty-state caption | the frame at its height, one `--dim` chip: `Type a printed departure in a row to draw the two clocks.` | the rows that hold text |
| The library fails to load | `showUnavailable` | | |

---

## D. Sections 2 and 3

Section 2, in order: `<h4>2. What each printed time means</h4>`, the chart, the table, then
the static hint with the DST Inspector link. `reason-aside` is in section 3 (D6).

### D1. The chart's numbers (`chartLayout`, pure)

Both axes measure minutes from the start of the local day, at one scale. So an hour of wall
clock and an hour of exact time are the same width, and a connector is vertical until the
clock changes.

- `dayStart = resolveLocal(date + "T00:00:00", zone)`. The default disambiguation is right
  when midnight repeats or is skipped (row D1). `dayEnd` is the same call for the next date
  (`Temporal.PlainDate.from(date).add({ days: 1 })`).
- `dayMinutes` is the exact length of the day: 1380, 1440 or 1500 on the preset dates.
- `tail` is the run rounded up to whole hours, from 60 to 360 minutes. The run is
  `transitTime(dayStart, duration)` minus `dayStart`; an invalid duration gives 60.
- `domainMinutes = max(1440, dayMinutes) + tail`.
- A row's `printedMinute` is on the wall axis. Its `instantMinute` is `leavesAt` minus
  `dayStart`, and its `arrivalMinute` is `rowResult(…).result.legTimes[0].arrival` minus
  `dayStart`, both read with `Temporal.Instant.from`. `open` is true when the arrival is past
  `domainMinutes`. `dashed` is true for a `skipped` row with no offset.
- A fan per `DayBand`:
  - `twice`: the wall span `[startMinute, endMinute]` and three exact minutes: the earlier
    pass's start, the transition, the later pass's end (calls in C0).
  - `skipped`: the wall span and one exact minute, the transition.
- The offset strip: `UTC<offsetBefore>` up to each transition and `UTC<offsetAfter>` after it.
  With no transition, one segment with the offset in `etaAtZone(dayStart, zone)`.
- `others` lists the valid rows on another date, which are not drawn.
- `null` when there is no track date, or the zone cannot start a day.

**`chartWindow(layout): { start; end }`**, in the same minutes:

1. The marks are every on-track row's `printedMinute`, `instantMinute` and
   `min(arrivalMinute, domainMinutes)`. A fan joins them, whole, when its span (wall and exact
   minutes) reaches the span of the marks, so a clock change early in the day does not stretch
   the window of a journey at noon.
2. `start = max(0, floor((min - 30) / 60) * 60)` and
   `end = min(domainMinutes, ceil((max + 30) / 60) * 60)`: half an hour of room, snapped
   outward to whole hours.
3. If that is under 240, raise `end` to `min(domainMinutes, start + 240)`, then lower `start`
   to `max(0, end - 240)`.
4. With no marks, `{ start: 0, end: 360 }`.

*Why a window, and why four hours at least:* the rows of every preset sit in a few hours of a
26-hour domain. Drawn whole, the fan would be 26px wide at 1440 and 9px at 390. The window fits
the marks, so a single journey fills the plot instead of a sixth of it. The label on the
window's last hour sits on the plot's edge and the tick thinning hides it, so a three-hour
window would show three labels; four hours show at least four on every preset at 2560, 1920 and
1440, and four at 390 except on the five-hour `fall-back` window, where the step is two hours and three show.

The window is recomputed only when a change settles (C4). While a handle moves, the chart
keeps its window, and a mark that leaves it is clipped at the plot's edge until the reader
lets go. This is the Departure Board's rule for its rail.

Results on the presets (section 9, rows L1 to L5, and the windows by the rule above):

| Preset | `dayStart` | `dayMinutes` | `domainMinutes` | Rows: printed → instant → arrival | Fan | Window |
| --- | --- | --- | --- | --- | --- | --- |
| `fall-back` | `2024-11-03T04:00:00Z` | 1500 | 1560 | 30 → 30 → 90; 90 → 90 → 150; 150 → 210 → 270 | twice, wall 60–120, exact 60, 120, 180 | 0–300 |
| `offset-picks` | the same | 1500 | 1560 | 90 → 90 → 150; 90 → 150 → 210 | the same | 0–240 |
| `spring-forward` | `2024-03-10T05:00:00Z` | 1380 | 1500 | 90 → 90 → 150; 150 → 150 → 210 (dashed); 210 → 150 → 210 | skipped, wall 120–180, exact 120 | 60–300 |
| `published-local` | `2024-06-15T04:00:00Z` | 1440 | 1500 | 600 → 600 → 660 | none | 540–780 |
| `berlin-fall-back` | `2024-10-26T22:00:00Z` | 1500 | 1560 | 150 → 150 → 210 | twice, wall 120–180, exact 120, 180, 240 | 60–300 |

### D2. The chart's drawing

```html
<div class="gmt-timetable-chart" data-role="two-clocks" role="img" aria-label="…">
  <div class="gmt-timetable-plot" data-role="plot" data-window-start="…" data-window-end="…">
    … rows below …
  </div>
  <p class="gmt-timetable-chart-caption" data-role="chart-caption"></p>
  <ul class="gmt-timetable-legend" data-role="chart-legend">…</ul>
</div>
```

The frame is in the chart-surface list (F5). Plain DOM and one inline SVG, built by the mount.
No chart library. Nothing in it is focusable. Every `x` is
`(minute - window.start) / (window.end - window.start) * 100` percent, and the plot carries
the window as `data-window-start` and `data-window-end`. The plot is `overflow: clip`. Every
row of the plot is the same two-column grid, a `1.75rem` gutter for the lane numbers and the
drawing column, so all rows share one x.

Rows of the plot, top to bottom. Every height is fixed (custom properties on
`.gmt-timetable-chart`), and the plot reserves the height of rows 1 to 7 with a
`min-block-size`, so the frame's height depends only on how many journeys are drawn:

1. **Wall caption** (one line, `--gmt-ice-dim`; two under 26rem): `Printed clock ·
   <startTimeZone>` at the start. At the end, a chip with the same words and the same edge as
   the track's band chip; with no band it is the `--dim` chip `No clock change this day`.
2. **Wall ticks** (`data-role="wall-ticks"`, `.gmt-cutoff-axis-tick`): `HH:MM`, at every
   `tickStepHours(plotPx / windowHours, 52)` hours, only between 00:00 and 24:00. Their
   labels sit above the wall axis and the exact ticks' below the exact axis, so the two read
   as a pair of rulers with the fan between them.
3. **Wall axis** (`data-role="wall-axis"`): a 2px `--gmt-border-strong` line from 00:00 to
   24:00, clipped to the window. On it:
   - `data-role="wall-band"` for each fan, with the track band's wash or hatch and its edges:
     purple and `3px double` for `twice`, gold and dashed for `skipped`;
   - `data-role="printed-n"`: a 9px bevelled square in `var(--series)` with a 2px
     `--gmt-surface` ring, at the row's `printedMinute`. Two rows on one time share the point.
     A row with no instant gets the hollow form: `--gmt-surface` fill, 2px dashed series
     border.
4. **The fan** (`data-role="fan"`): `<svg class="gmt-timetable-fan" viewBox="0 0 1000 100"
   preserveAspectRatio="none" aria-hidden="true" focusable="false">`, `5.5rem` tall (`4rem`
   under 26rem). `y = 0` is the wall axis and `y = 100` the exact axis; `x` is per mille of
   the window.
   - A `twice` fan is two `<polygon class="gmt-timetable-wedge" data-kind="twice">`: the
     earlier pass, from the wall span straight down to exact `[e0, e1]`
     (`data-pass="earlier"`), and the later pass, from the same wall span to exact `[e1, e2]`
     (`data-pass="later"`). One wall hour, two hours of exact time.
   - A `skipped` fan is one polygon from the wall span down to the single point `e0`: an hour
     of wall clock that is no exact time at all.
   - A `twice` wedge has a `--gmt-dst-purple` fill at 0.16 alpha and a 1px solid purple
     stroke. A `skipped` wedge has a `--gmt-dst-gold` fill at 0.14 alpha and a 1px dashed gold
     stroke.
   - A `<line class="gmt-timetable-link" data-role="link-n" data-series="n">` for each row
     with an instant, from `(printedMinute, 0)` to `(instantMinute, 100)`:
     `stroke: var(--series)`, 2px, `vector-effect: non-scaling-stroke`, and
     `gmt-timetable-link--dashed` when `dashed`. It carries `data-instant` (the `leavesAt`
     string) and `data-printed`.
   - Before the change every link is vertical. After a fall-back every link leans right by the
     shift; after a spring-forward, left. On `spring-forward`, rows 2 and 3 end on one point.
5. **Exact axis** (`data-role="exact-axis"`): a 2px line across the whole window. On it
   `data-role="instant-n"`, the same square as `printed-n`, at `instantMinute`. A `twice` fan
   adds a purple underline from `e0` to `e2` with a solid tick at `e1`. A `skipped` fan adds
   one dashed gold tick at `e0`, the point where the clock jumps.
6. **Exact ticks** (`data-role="exact-ticks"`): at the same x as the wall ticks, across the
   whole window. The label is the instant at that x in UTC, `HH:MM` and `Z`
   (`exactTickLabel`). Both tick rows are thinned by `thinTickLabels` and refitted by
   `onWidthChange`.
7. **Exact caption and offset strip** (`data-role="offsets"`): `Exact time · UTC` at the
   start, then one `gmt-cutoff-chip--dim` per segment (`UTC−04:00`, `UTC−05:00`). The mount
   places each chip by measurement: centred on the visible part of its segment, moved right
   to clear the caption, kept inside the segment, and hidden when it does not fit. CSS alone
   cannot do this, because the caption's width and the segment's edges are both needed.
8. **Journeys**: one lane of `1.75rem` for each row that is `on`, in row order
   (`data-role="journey-n"`, `data-series="n"`).
   - In the gutter, a `gmt-cutoff-chip` with the row number.
   - `data-role="bar-n"`: from `instantMinute` to `arrivalMinute`, `0.6rem` tall, lit glass
     in `var(--series)` (a vertical gradient from 0.9 to 0.5 alpha, the inset highlight), at
     least 2px wide, with a bevelled cap at the arrival end. It carries `data-leaves` and
     `data-arrival` (the library strings). A bar whose arrival is past the domain, or past
     the window's end, runs to the plot's edge and ends in a 2px dashed line with no cap
     (`gmt-timetable-bar--open`).
   - `data-role="arrival-n"`: a `gmt-cutoff-chip` after the bar's end, with
     `arrivalChipText`: the `HH:MM ±hh:mm` of `localArrival`, and ` <MM-DD>` added when its
     date is not the track's. `arrivalChipPlacement` puts it after the bar's end. Where it
     would leave the plot there, it goes before the bar's start. Where neither side holds it
     whole, it sits flush with the plot's far edge, over the bar's tail, so it never reaches
     the row number in the gutter (`data-side`: `start`, `end` or `clamp`).
   - A bar starts at the x of its row's instant square, so a connector, its instant and its
     numbered lane line up. Colour is never the only cue. No line is drawn through the tick
     labels.
   - A row with no instant: no bar, and a `gmt-cutoff-chip--dim` reading `no instant` at the
     lane's start.
9. **Caption** (`data-role="chart-caption"`, one reserved line, two under 26rem):
   `Arrival times are in <timeZone>.` When the two zones differ it adds ` The timetable is
   printed in <startTimeZone>.`
10. **Legend** (`data-role="chart-legend"`, static, `--gmt-ice-dim`), five items, each a
    swatch and its words:

    | Swatch | Words |
    | --- | --- |
    | a solid line | `printed time to its instant` |
    | a dashed line | `a skipped time, read forward` |
    | a bar | `run time to arrival` |
    | the repeated-hour band (purple wash, double edges) | `an hour that repeats` |
    | the skipped-hour band (gold hatch, dashed edges) | `an hour that is skipped` |

    The two kinds of band have a swatch each, because they differ in colour, edge and
    pattern. The legend is a `ul`, and its items reset the content-page list rule
    (`.sl-markdown-content ul li`: the dash, the padding, the margin) with
    `.gmt-timetable .gmt-timetable-legend > li`.

The journeys change the chart's height only when a row gains or loses a time, which section
2's `.gmt-grow` eases. A handle never does.

With no track date the plot holds one `--dim` chip, `Type a printed departure in a row to
draw the two clocks.`, which is also the chart's `aria-label`.

Trap: `gmt-timetable-reader.css` loads before `gmt-cutoff-widgets.css` (`customCss` in
`astro.config.mjs`). A rule here that changes a family recipe (`.gmt-cutoff-chip`, the swatch,
a tick) needs one more class than the family's `:is(root) .recipe`, or it loses on source
order.

### D3. The text alternative

`role="img"` with an `aria-label` from **`chartSummary(layout)`**, rewritten on every render.
The table below is the data equivalent. The format, on `fall-back`:

> Two clocks for 2024-11-03 in America/New_York. 01:00 to 02:00 happens twice. Row 1 prints
> 00:30 and leaves at 2024-11-03T00:30:00-04:00[America/New_York], arriving
> 2024-11-03T01:30:00-04:00[America/New_York]. Row 2 prints 01:30, which happens twice; it is
> read as the earlier pass and leaves at 2024-11-03T01:30:00-04:00[America/New_York], arriving
> 2024-11-03T01:30:00-05:00[America/New_York]. Row 3 prints 02:30 and leaves at
> 2024-11-03T02:30:00-05:00[America/New_York], arriving
> 2024-11-03T03:30:00-05:00[America/New_York].

The other sentences:

- no band: `No clock change that day.`
- a skipped band: `02:00 to 03:00 never shows on the clock.`
- a date skipped whole: `This date never shows on the clock.`
- a skipped row: `Row 2 prints 02:30, which never shows on the clock; it is read as the later
  instant and leaves at …, arriving ….`
- an offset written: `Row 2 prints 01:30 with offset -05:00 and leaves at …, arriving ….`
- no instant: `Row 1 prints 02:30 with offset -05:00 and names no instant.` (without the
  offset clause when the row holds none)
- an instant but no arrival: `…leaves at …; the run time gives no arrival.`
- another date: `Row 3 is on 2024-11-04 and is not drawn.`

### D4. The table

**Why a block table stops short.** `gmt-widget.css` makes every table in a widget
`display: block`. A block box is not a table box, so `width: 100%` sizes the box while the
rows inside size to their content. In a 1912px pane the table box is 1396px wide and its
header and rows 1103px (measured). `gmt-upstream.css` carries the same note.

**The rule.** Where the section is wide enough for four columns, the table is a real table
again:

```css
.gmt-timetable-rows { display: table; table-layout: fixed; width: 100%; }
```

- **The boundary is the narrowest section in which every column holds its value.** A column
  holds its value when the date, time and offset sit on one line and the bracketed zone on
  the next. The sheet derives each column's minimum from the widest value in the cell's
  face, the Printed cell's swatch and number, and the cell padding; the Note column takes
  the rest. The sum is the boundary.
- **Fixed layout and a width on the `th`s** are what hold the columns still while a value
  changes. Just above the boundary the three value columns have fixed widths and the Note
  column takes what is left. From the wide band the four widths are percentages that add up
  to 100% and keep each column over its minimum. The numbers are in
  `gmt-timetable-reader.css`.
- Every cell: `font-variant-numeric: tabular-nums`. `.gmt-timetable-time` is `nowrap`.
- **A value never breaks inside itself.** `wbrBeforeOffsetAndBracket` wraps each part of a
  value in a `nowrap` token (`.gmt-timetable-tok`) and puts a `<wbr>` between parts. The
  parts come from `zonedParts`: the date, time and offset together, then the bracketed zone,
  split after each `/`. So the only breaks are before `[` and after a `/`. A browser would
  otherwise also break after a hyphen, inside the date.
- First and last cells keep at least 10px of inline padding (the bevel trap).
- `th:first-child, td:first-child` undo the content-page rule that keeps a first column
  narrow (`white-space: nowrap; width: 1%`).
- Under the boundary the table is stacked rows: each `tr` a bordered block, each `td` a
  two-column grid with its `data-label` drawn by `::before`, the `thead` visually hidden, and
  explicit ARIA table roles throughout. Where even the label and the widest value do not fit
  side by side (the narrowest `/dox` rail), the label sits above its value.

**Cells.** The header texts are Printed, Leaves (exact), Note and Local arrival.

- Printed: one `<span class="gmt-timetable-printed">` holding
  `<span class="gmt-cutoff-series-swatch" aria-hidden="true"></span>`, the row number in a
  `gmt-timetable-rownum` span, then `wbrBeforeOffsetAndBracket(departure + offset)` in a
  `gmt-timetable-printed-text` span. One wrapper, because the stacked form lays each child of
  a cell on its own grid row. The `tr` carries `data-series`.
- Leaves (exact) and Local arrival: `timeCell` (the short `HH:MM ±hh:mm`, then the full
  value in smaller text), or the sentinel. A row whose call returns `null` shows `NO SIGNAL`
  through `renderWidgetOutput(el, "NO SIGNAL", "sentinel")` on the cell's
  `.gmt-timetable-time` span, and no full value.
- Note: the badge (`data-role="badge-N"`), or nothing.
- The three cells after Printed are holds (D5).
- A blank row has no `tr`.

### D5. Holding still

Nothing moves or resizes while a handle moves across the day, through the shaded hour and as
a note comes and goes. This covers the three sections, the controls line, the description,
the track's frame, status line and tick row, every row frame and its fields, the chart's
frame, the table with every row and cell, and section 3's field, code frame and output.

What moves by design: the handles and tags inside the lanes; the marks inside the plot; the
text inside a held cell. One element may appear: `reason-aside`, the last element of the
widget, when the picked row's result becomes `null`. Nothing is below it.

How:

- Fixed heights for the status line, the lanes, the tick rows and every row of the plot.
- Fixed widths: the grid tracks of the frames, and the table's columns.
- **The hold recipe**, one small rule set in the tool's sheet:

  ```html
  <div class="gmt-timetable-hold">
    <span class="gmt-timetable-sizer" aria-hidden="true">…the shape…</span>
    <div class="gmt-timetable-live">…the real content…</div>
  </div>
  ```

  ```css
  .gmt-timetable-hold { display: grid; }
  .gmt-timetable-hold > * { grid-area: 1 / 1; min-width: 0; }
  .gmt-timetable-sizer { visibility: hidden; pointer-events: none; user-select: none; }
  .gmt-timetable-sizer[data-t]::before,
  .gmt-timetable-sizer [data-t]::before { content: attr(data-t); }
  ```

  The sizer takes the space of the tallest thing the cell can hold, at any width, with no
  measured constant. Its text is in `data-t` attributes, drawn by `::before`, so it is never
  in `textContent`, never copied and never read out.
- **The live wrapper stretches.** It is a block in the hold's one grid cell and keeps the
  grid's default `stretch`, so its box is always the sizer's size. It must not be aligned to
  the start: its height would then go from 0 to the content's each time a note or a value
  appears, and `readout:still` measures the wrapper itself (F9).
- **`shapeOf`** builds each sizer:
  - **Note**: one `<span class="gmt-transport-badge" data-t="…">` holding `LONGEST_BADGE`.
  - **A time cell**, for the zone `Z` of its column (`startTimeZone` for Leaves, `timeZone`
    for Local arrival): a `gmt-timetable-time` span with `data-t="00:00 +00:00"`, then a
    `gmt-timetable-time-full` holding `data-t` token spans for `0000-00-00T00:00:00+00:00`
    and `[Z]`, the zone split after each `/` into a token of its own, with a real `<wbr>`
    between every two tokens (`zonedParts`, as a real value). The same character counts and
    the same break points as a real value, so the same wrap. It assumes a four-digit year.
  - **The output**: a `<span class="gmt-widget-output gmt-timetable-sizer">` whose `data-t` is
    `formatSchedule` of a one-leg result in the same shape. The sizer and the `<output>` are
    the hold's two children; the output has no live wrapper, because `renderWidgetOutput`
    writes its text. `eta` and `localArrival` are `0000-00-00T00:00:00+00:00[<timeZone>]`,
    `arrival` is `0000-00-00T00:00:00Z`, `dwellAfter` is `PT0S`.
  - A shape is a placeholder for layout. It is never a value, and nothing shows it.
- `setPresetDescription` for the description (C4).

### D6. Section 3

`<h4>3. What <code>scheduleDelivery</code> returns</h4>`, the `row-pick` field,
`codeFrameHtml("timetable")`, a hold around `timetable-output`, then
`<div class="gmt-transport-reason" data-role="reason-aside"></div>` as the last element.

The call is the picked row's own `scheduleDelivery` call (`scheduleCallSource`,
`renderCallLine`), the output is `formatSchedule` of its result or `NO SIGNAL`, and the "Why
null" aside gives the reason for a `null`.

---

## E. What TRAN-9 § C-d governs

- **Widget kind** `timetable` and its path (`widget-permalink.ts`).
- **Chat tool** `showTimetableReader`: the schema, its `DOX_TOOL_DOCS` entry, `DOX_TOOLS`,
  `ENABLED_TOOL_NAMES` (`dox-tools.ts`), the Worker tool (`worker/tools.ts`) and the registry
  entry (`widget-registry.ts`).
- **The `CHAT_STARTERS` entry** (`chat-constants.ts`).
- **Permalink keys**: `startTimeZone`, `duration`, `timeZone`, `departure1…4`, `offset1…4`,
  all strings, through `readArgs`, `matchPreset`, `permalinkOf`, `applyArgs` and
  `getPermalinkState`.
- **The two permalinks in content**, both in `src/content/docs/tools/timetable-reader.mdx`:
  the spring-forward rows, and an offset written into the skipped hour. They are the only
  `w=timetable` links under `src/content/docs`. The content-permalink test in
  `widget-permalink.test.ts` checks them.
- **The presets**: five ids with their labels, descriptions, zones, run times and rows
  (`TIMETABLE_PRESETS`), and every result in `EXPECTED` (`timetable-reader-mount.test.tsx`).
- **The words**: the three badge texts, `SKIPPED_OFFSET_TEXT`, the table's header texts, the
  three `<h4>`s, the DST Inspector hint.
- **Section 3's call**: `scheduleCallSource`, the row picker, the copy button.

`TimetableReader.astro` is the shell: it server-renders the template and takes `fullbleed`
from the tool page. The widget is mounted on its tool page and in the `/dox` rail, and
nowhere else.

---

## F. Where each part lives

All paths are under `apps/dox/`.

### F1. `src/lib/timetable-reader.ts` and `src/lib/transport-lib.ts`

`transport-lib.ts`: `loadTransportLib` and `loadTimetableLib`. `timetable-reader.ts`: the
state, the presets, `classify`, `offsetChoices`, `rowBadge`, `leavesAt`, `rowResult`, and
after "What the tool draws" the helpers of C0, D1, D3 and D5. `leavesAt` takes a
`TransportLib`.

### F2. `src/lib/timetable-reader.test.ts`

Against the real library, with a `TimetableLib` built from `@northguild/gmt/zoned/get` and
`@northguild/gmt/instant/convert`:

- `classify`: the four values of C1 and of C2 at each band edge; `skipped` for
  `2011-12-30T12:00:00` in `Pacific/Apia` (C3); `invalid` for `not a time` and for an unknown
  zone (C5).
- `trackDate`, `rowMinute`, `withMinute`, `laneState`: every preset; a blank first row; a row
  on another date; a seconds value; text that is not a time.
- `dayBands`: rows B1 to B12, and for each band of B1, B2, B4 and B5 that `classifyLocal` at
  `startWall` is `ambiguous` or `nonexistent` and at `endWall` is `unique`.
  With a stub `lib` whose `getDstTransitions` and `etaAtZone` are fakes: the previous year is
  asked for on 1 January and the next on 31 December, and no other year on any other date.
- `pointerStep`, `minuteAtPointer` (both ends, the clamp, each step), `stepMinute` (on and
  off the grid, both directions, both ends), `jumpMinute` (both directions, both ends),
  `tickStepHours`.
- `handleValueText` and `tagText`: every form in C4.
- `chartLayout`: the five rows of D1's table, and L6 (a row with no instant has `null`
  minutes and no `dashed`).
- `chartWindow`: the five windows of D1's table; no marks; a row at 00:00 and at 23:55 (the window
  ends at `domainMinutes`); one row; rows more than six hours apart; an arrival past midnight;
  a band that touches the marks and one that does not.
- `chartSummary`: the `fall-back` text of D3 word for word; `spring-forward`;
  `published-local` ("No clock change that day."); the no-instant and other-date sentences.
- `shapeOf`: for every preset row with a value, the shape's parts have the same lengths as
  the real `leavesAt` and `localArrival`, and the output shape has the same length as the
  real `formatSchedule` text.
- `LONGEST_BADGE` is at least as long as each `rowBadge` text.

### F3. `src/lib/timetable-reader-mount.ts` and its test

The mount: C1 to C6, D2 to D6. It imports `loadTimetableLib` from `./transport-lib`,
`setPresetDescription` from `./punctuality-widgets` (as the two EDI mounts do), and
`placeLabel`, `thinTickLabels`, `onWidthChange` and `layoutWidth` from `./label-fit`. Its
`destroy` disposes the two `onWidthChange` watchers (the track's and the plot's).

`src/lib/timetable-reader-mount.test.tsx` (jsdom, the real library) covers:

- **Every preset**: each row's Leaves and Local arrival full texts equal the strings of
  section 9 (L1 to L5), and the Note text equals `rowBadge`'s.
- **The chart matches the table**, for every preset and every drawn row: `link-n`'s
  `data-instant` equals the row's Leaves full text; `bar-n`'s `data-leaves` and `data-arrival`
  equal the Leaves and Local arrival full texts; `arrival-n`'s text is the short form of the
  Local arrival; `link-n`'s `x1` and `x2` and `bar-n`'s `left` and `width` equal the numbers
  from `chartLayout` and `chartWindow`. On `spring-forward`, `link-2` and `link-3` share
  `x2`, and `link-2` is dashed. On `offset-picks`, `link-1` and `link-2` share `x1` and not
  `x2`. On `fall-back` there are two `twice` wedges; on `spring-forward` one `skipped` wedge;
  on `published-local` none.
- **The band**: `fall-back` has one `data-kind="twice"` band at `left: 4.1667%`, `width:
  4.1667%`, and the chip reads `01:00–02:00 happens twice`; `spring-forward` one `skipped`
  band at 8.3333% and `02:00–03:00 never shows`; `published-local` none and `No clock change
  this day`.
- **Handle to input**: on `fall-back`, focus `handle-1` and press ArrowRight:
  `departure-1` is `2024-11-03T00:35:00` and `aria-valuenow` is `35`. PageUp:
  `2024-11-03T01:35:00`. Shift+ArrowLeft: `…T00:35:00` again. Home and End: `…T00:00:00` and
  `…T23:55:00`. Type `2024-11-03T01:32:00`, then ArrowRight: `…T01:35:00`.
- **Input to handle**: type `2024-11-03T03:15:00` into `departure-1`: `handle-1` has
  `aria-valuenow="195"` and `left: 13.5417%`. Type `nonsense`: the handle is `hidden` and the
  tag reads `1 · not a date and time`. Type a time on `2024-11-04` into `departure-3`: its
  handle is `hidden` and its tag reads `3 · on 2024-11-04`.
- **Entering and leaving the repeated hour** by keyboard, on `fall-back`: `handle-1` PageUp
  once (01:30): `offset-1` is enabled with three options, the row's Note reads "Occurs twice:
  the earlier instant", the tag reads `1 · 01:30 twice`, `aria-valuetext` is the `twice`
  form. PageUp again (02:30): `offset-1` is disabled, the Note is empty, the tag is plain.
- **The pointer**, with `day-track`'s `getBoundingClientRect` stubbed (left 0, width 1440).
  On `fall-back`: `pointerdown` on `handle-2`, `pointermove` to `clientX: 75`: `departure-2`
  is `2024-11-03T01:15:00`. Move to 130: `…T02:10:00`, and `offset-2` is disabled. A
  `pointermove` no handle started changes nothing. A `setPointerCapture` that throws does not
  stop the drag.
- **An offset is kept**: on `offset-picks`, `handle-2` PageDown (00:30): `offset-2` still
  holds `-05:00` and is enabled, the row's Leaves cell is the sentinel, and there is no
  `link-2` or `bar-2`. PageUp: the row reads `2024-11-03T01:30:00-05:00[America/New_York]`
  again.
- **A result returning** (L8): seed the page's second "Worth trying" link, press PageDown on
  `handle-1` (01:30): `timetable-output` is not `NO SIGNAL` and `reason-aside` is empty.
- **An empty lane adds its row**: on `fall-back`, `pointerdown` on `lane-4` at `clientX: 720`
  sets `departure-4` to `2024-11-03T12:00:00` and shows `handle-4`.
- **Settling**: on `fall-back`, hold `handle-3` and move it to 12:00 by pointer: `plot`'s
  `data-window-start` and `data-window-end` stay `0` and `300` until `pointerup`; after it
  they are `0` and `900` (the row then leaves at minute 780 and arrives at 840). A key move
  refits on `keyup`.
- **Structure**: `reason-aside` is the last element child of the third section; the chart has
  `role="img"` and an `aria-label` equal to `chartSummary`; nothing inside `two-clocks` is
  focusable; the only focusable elements inside `day` are the visible handles; no sizer's
  text is in the root's `textContent`; each of the three sections carries
  `gmt-widget-section--wide`.
- TRAN-9's tests: the seed, the permalink round-trip, the abort and the double destroy.

### F4. `src/styles/gmt-transport-widgets.css` and `gmt-delivery-scheduler.css`

The corner-bracket rule is in `gmt-transport-widgets.css`, after the
`.gmt-transport-leg > legend` rule, under the selector list
`.gmt-delivery-leg-fieldset, .gmt-transport-leg--brackets` (and the matching `::before` and
`::after` lists): `position: relative` on the frame, and two 12px L-shaped pseudo-elements at
`-1px`, with 2px borders, `opacity: 0.8` and
`border-color: var(--leg-color, var(--series, var(--gmt-cyan)))`.
`gmt-delivery-scheduler.css` holds no bracket rule of its own.

**What this touches.** The Delivery Scheduler's fieldsets and the Timetable Reader's rows,
and nothing else. The Cut-off Stack and the ETA Drift Chart use `.gmt-transport-leg` without
the `--brackets` class and have no brackets.

### F5. `src/styles/gmt-cutoff-widgets.css`

`.gmt-timetable` is in these root lists and in no others: the four series mappings, the
swatch, the chip with its `[hidden]` and `--dim` rules, and the four axis-tick rules.
`.gmt-timetable-day` and `.gmt-timetable-chart` are in the chart-surface list. The header
says seven roots.

### F6. `src/styles/gmt-widget.css`

`.gmt-widget-card > .gmt-widget-section.gmt-widget-section--wide { grid-column: 1 / -1; }`
(B1). The Timetable Reader is the only tool that uses the class.

### F7. `src/styles/gmt-timetable-reader.css`

The container names (B2); the split, the pane and the two-column band (B1, B2, B4); the bands; `.gmt-timetable-preset`; the day frame, status line,
lanes, band, tags and ticks; the rowset and the compact rule; the hold recipe; the chart; the
legend; the table (D4). Tokens only. No `backdrop-filter`, no `clip-path`, no `transition` or
`animation`, no `[data-theme="light"]` block, no class containing `card`, and no
`border-left` or `border-inline-start`.

Two traps. This sheet loads before `gmt-cutoff-widgets.css`, so the tag's border and any other
change to a family recipe is written with one more class than the family's rule
(`.gmt-timetable .gmt-timetable-lane .gmt-timetable-tag[data-kind]`). And every band rule is
the named query of B2: an unnamed one on a control resolves to its field grid.

### F8. `src/styles/gmt-a11y.css`

- `.gmt-timetable` is in the four cut-off lists that restate the chip border, the chip's
  `forced-color-adjust: auto`, the swatch and the tick rule mark.
- One block of its own, forced colours only:
  - `.gmt-timetable-band`, the wall band and the two band swatches:
    `forced-color-adjust: none; background-color: Canvas; background-image: none`, with
    `CanvasText` inline edges, double for `twice` and dashed for `skipped`.
  - `.gmt-timetable-lane`: a `CanvasText` bottom border; its centre line off.
  - The fan: `forced-color-adjust: none`; `.gmt-timetable-wedge` has `fill: none; stroke:
    CanvasText` (dashed for `skipped`); `.gmt-timetable-link` has `stroke: CanvasText`, and
    keeps its dashes.
  - The axis lines, the exact underline and its ticks, the printed and instant squares, the
    bar and its cap, and the line and bar swatches are `CanvasText` marks; the hollow square
    and the open bar end keep a dashed `CanvasText` border on `Canvas`.
  - The tag's and the status chip's in-band border: `CanvasText`, still double or dashed.
  - Handles and their focus ring are restated for every tool. Plates that hold text never
    opt out.
- The sheet states no `border-left-color` for `.gmt-delivery-leg-fieldset`: that frame has no
  left accent, so there is nothing to restate.
- A disabled `.gmt-input` or `.gmt-select` is `GrayText` on a `GrayText` border, for every
  tool.

### F9. `scripts/readout-still.mjs`

The tool is the fourth `TOOLS` entry. An entry may carry `frame`, `scope`, `drawn` and
`pointerSteps`; the other three entries use the defaults.

```js
{
  slug: "timetable-reader",
  root: ".gmt-timetable",
  presets: ["fall-back", "offset-picks", "spring-forward", "published-local", "berlin-fall-back"],
  controls: [
    { sel: '[data-role="handle-1"]' },
    { sel: '[data-role="handle-2"]', optional: true, requiredIn: ["fall-back", "offset-picks", "spring-forward"] },
    { sel: '[data-role="handle-3"]', optional: true, requiredIn: ["fall-back", "spring-forward"] },
    { sel: '[data-role="handle-4"]', optional: true },
  ],
  track: '[data-role="day-track"]',
  frame: '[data-role="two-clocks"]',
  scope: "widget",
  drawn: '[data-role="day-track"], [data-role="plot"], .gmt-timetable-live',
  pointerSteps: 48,
}
```

- `frame` is the chart frame to record (default: `.gmt-punct-frame`).
- `drawn` is the list of containers whose insides move by design (default: the punctuality
  tools' list). The container itself is still measured.
- `scope: "widget"` measures every element in the widget root, in every section, before and
  after the control, and the control's ancestors too. The default, `"above"`, measures what
  comes before the control in its section.
- `extraWidths` lists viewports checked for that tool alone, on top of `--widths`. The Timetable
  Reader's are `[1920, 2000]`, the two-column band's lower edge and middle.
- `pointerSteps` is the number of steps in a pointer sweep (default 20). 48 steps are 30
  minutes each, so every sweep enters a 60-minute band.
- The keyboard sweep is the same for every tool: Home, PageUp until the value stops, PageDown
  back.
- The pass/fail decisions are in `scripts/gate-checks.mjs`.

### F10. `scripts/grow-measure.mjs`

The `timetable-reader` row drags `[data-role="handle-1"]`. The handle's parent is its lane,
which is the track's width, so the script's own rule for a handle's track holds.

---

## G. Design constraints

1. **No left-border-only accent, anywhere.** No frame, row, callout, chip, cell or result
   block carries a coloured left edge as its only accent: no `border-left`, no
   `border-inline-start`, no left `inset` shadow, no left `::before` bar. A frame has a full
   bevelled border; an accent edge is a bottom edge. A band's two inline edges and a chart's
   lines are drawn marks, not accents.
2. **Readouts hold still** (D5). H5 and H6 test it by bounding box.
3. **Amber is the sentinel's alone.** A repeated hour is `--gmt-dst-purple` and a skipped one
   `--gmt-dst-gold`. No note, tag or mark is amber, and none is a success or error colour.
4. **A series colour goes on marks only**: handles, lane lines, connectors, squares, bars,
   swatches, brackets, chip borders. Never on text. Each row is also named by its number.
5. **Every label in the track and the chart sits on an opaque `--gmt-surface` chip**, or is
   plain `--gmt-ice` or `--gmt-ice-dim` text on the chart surface. No glyph touches the band,
   a wedge, a line or a bar.
6. **Text is at least 12px and at least 7:1** in both themes, against the worst pixel behind
   its glyph box.
7. **Tokens only.** No colour literal. One-off stops are `color(from var(--token) srgb r g b
   / a)`, never `color(from currentColor …)`. No `[data-theme="light"]` colour block.
8. **Nothing animates.** No `transition` or `animation` on a value, a mark, a tag or a chip.
   The handle keeps the control system's hover, press and focus sonar, which reduced motion
   already stops. Heights ease only through `.gmt-grow`. No `data-grow` on the track, the
   chart or a frame.
9. **Bevels come from `corner-shape`**, never `clip-path`. No `backdrop-filter` inside the
   tool. No class containing `card` but the `.gmt-widget-card` wrapper.
10. **The root keeps `not-content`**, and `container-type: inline-size` through the transport
    sheet's root list. Layout bands are container queries. Space comes from `gap`.
11. **Focus order** is the visual order: the four controls, the visible handles 1 to 4, then
    each frame's two fields, then the row picker and the copy button. Nothing in the chart
    takes focus. A disabled Offset select is skipped.
12. **No horizontal page scroll** at any width, and none inside the track or the chart.

---

## H. Verification (`dox-tester`: run each line literally)

`$WT` is the repo root and `$SP` the session scratchpad. **Every command is prefixed
`eval "$(fnm env)" && fnm use &&`.** Scratch scripts live in `$SP`, never in the repo. Never
use port 4321. Every Astro or Vite command sets `DOX_VITE_CACHE_DIR=$SP/vite-cache`, and the
library is built only when no one is reading a dev page (built.md § Tier 6, Runbooks). After
a change, the structural and pixel gates run against a baseline as the baseline runbook in
built.md says; the Timetable Reader is the only page such a change may alter.

1. `eval "$(fnm env)" && fnm use && pnpm -C $WT --filter @gmt/dox test` passes, including
   `timetable-reader`, `timetable-reader-mount`, `widget-permalink` (with the
   content-permalink test), `widget-load-error`, `widget-graph`, `client-graph`,
   `lib-module-graph`, `font-floor`, `date-ban`, `gate-checks`, `delivery-scheduler-mount`,
   `cutoff-stack-mount` and `eta-drift-mount`. It needs a built `packages/gmt/dist`.
2. `eval "$(fnm env)" && fnm use && DOX_VITE_CACHE_DIR=$SP/vite-cache pnpm -C $WT --filter @gmt/dox check`
   reports 0 errors, then `eval "$(fnm env)" && fnm use && pnpm -C $WT --filter @gmt/dox lint`
   passes.
3. **Every value against dist.** Save appendix Z as `$SP/ttr-values.mjs`. Then
   `eval "$(fnm env)" && fnm use && DIST=$WT/packages/gmt/dist node $SP/ttr-values.mjs` prints
   `all ok`, and again with `TZ=America/Los_Angeles` and `TZ=Asia/Tokyo`. Every expected
   literal in the two test files is a row of section 9, a TRAN-9 value, or a number derived
   from one by a rule this spec states.
4. **Build and serve.**
   `eval "$(fnm env)" && fnm use && (cd $WT/apps/dox && DOX_VITE_CACHE_DIR=$SP/vite-cache pnpm run generate && DOX_VITE_CACHE_DIR=$SP/vite-cache pnpm exec astro build --outDir $SP/dist-ttr)`
   succeeds. Serve it statically:
   `python3 -m http.server 48412 --bind 127.0.0.1 --directory $SP/dist-ttr`. A scratch
   Playwright script screenshots `/tools/timetable-reader/`, full page, on every preset and on
   both "Worth trying" links, in both themes, at 2560, 2000, 1920, 1536, 1440, 1024, 768 and 390 wide, and the
   widget root forced to 360 and 300. Save to
   `$WT/apps/dox/.visual/timetable-reader/<preset>-<theme>-<width>.png`. Read each **as a long
   page, not as a thumbnail**: the three sections are full width and stacked; from 1902 wide
   (2560, 2000, 1920) sections 1 and 2 are two columns with one seam, the track above the chart
   and the frames, two by two, above the table, their tops level; the frames are four in a row
   at 1536 and 1440, two by two at 1024 and 768, and stacked at 390; the table
   reaches both edges of its panel; nothing overlaps or is clipped; nothing is amber but a
   `NO SIGNAL`; no element has a coloured left edge; a repeated hour is purple and a skipped
   one gold.
5. **Layout, by measurement** (the same script, every preset, each of the five widths):
   - the three `.gmt-widget-section`s share `left` and `width`, and each is as wide as the
     root;
   - the number of row frames that share the first frame's `top` is 4, 4, 2, 2 and 1;
   - the four controls of the top line share one `top` where the section is at least the
     controls boundary of C2 (2560 is), and there no preset option is wider than the select's
     text area; under the boundary the preset is alone on the first line;
   - every `departure-n` has `scrollWidth <= clientWidth`;
   - where the section is at least the table's boundary of D4 (2560 is), the table's computed
     `display` is `table`, and its `thead` and `tbody` are as wide as the table (±2px); under
     the boundary (390 is) it is the stacked form; at every width no value in the table
     breaks inside its date, time or offset;
   - no option of an enabled Offset select is cut off in its select;
   - every visible handle's `::before` is at least 24px by 24px, and no two hit squares
     intersect, also on `offset-picks`, where two handles share a time;
   - `document.documentElement.scrollWidth <= window.innerWidth`;
   - no two visible text boxes inside `day` or `two-clocks` intersect;
   - no legend item has a `::before` box or a left padding.
6. **Readouts hold still.**
   `eval "$(fnm env)" && fnm use && (cd $WT/apps/dox && node scripts/readout-still.mjs --base http://127.0.0.1:48412)`
   exits 0: all four tools, Chromium and WebKit, at 1440, 390, 360 and 300, and this tool also at
   1920 and 2000 (its `extraWidths`, the two-column band). In WebKit
   `--keyboard-only` is enough if pointer drags are flaky. Then a scratch script for the one
   state the presets do not reach: open the page's second "Worth trying" link, record the
   rects (from the root's corner, rounded) of the three sections, the table, every `tr` and
   `td`, `two-clocks`, every row frame, `row-pick`, the code frame and the hold around
   `timetable-output`; press PageDown on `handle-1` once (01:30, row L8).
   `timetable-output` is no longer `NO SIGNAL`, `reason-aside` is empty, and every recorded
   rect is equal except the third section's height.
7. **`grow:measure`.**
   `eval "$(fnm env)" && fnm use && (cd $WT/apps/dox && node scripts/grow-measure.mjs --base http://127.0.0.1:48412 --out $SP/grow --only timetable-reader,delivery-scheduler,interval-visualizer)`
   passes in Chromium and WebKit at 1440 and 390: HTTP 200, the root matches, the preset
   switch and the drag both happened, no painted jump over 48px, every `.gmt-grow` at rest,
   and the final height equal to the reduced-motion run's.
8. **The shared rules, by computed style.** On `/tools/delivery-scheduler/`, the first
   `.gmt-delivery-leg-fieldset` has `position: relative`, and its `::before` is 12px by 12px
   at `top: -1px; left: -1px` with 2px top and left borders and `opacity: 0.8`, in both
   themes. The first `.gmt-timetable-row` has the same, in its series colour. A disabled
   Offset select has a dashed border, a transparent fill and `cursor: not-allowed`.
9. **Keyboard only** (no mouse), on the tool page and in the `/dox` rail through the
   starter:
   - Tab reaches, in order, the four controls, each visible handle, each frame's two fields,
     the row picker and the copy button, and nothing in the chart.
   - On `fall-back`, focus `handle-1`. ArrowRight seven times takes it from 00:30 to 01:05:
     the tag reads `1 · 01:05 twice`, the Offset select of row 1 is enabled, the Note reads
     "Occurs twice: the earlier instant", and the chart's connector for row 1 ends inside
     the fan's first half. Choose `-05:00` in the select: the connector ends an hour later,
     in the second half, and the Note reads "Offset written: this pass". Go back to the
     handle; ArrowRight eleven more times reaches 02:00: the tag is plain, the row still
     holds `-05:00`, and the row reads `2024-11-03T02:00:00-05:00[America/New_York]`.
   - PageUp and PageDown move an hour; Home and End go to 00:00 and 23:55.
   - On `spring-forward`, moving `handle-1` to 02:15 shows the `skipped` tag and a dashed
     connector, and the row leaves at `03:15 -04:00`.
   - Typing a time in a frame moves its handle; clearing it removes the handle.
   - A disabled Offset select is skipped by Tab and announced as unavailable.
   - The focus ring is whole at both ends of the track, in both themes, at 1440 and 390.
10. **Reduced motion and forced colours.** Under `prefers-reduced-motion: reduce` nothing on
    the page animates or transitions when a preset changes or a handle moves, and
    `[data-growing]` never appears. Without it, the only animation in the tool after a handle
    key is the focused handle's `gmt-focus-sonar`. Under `forced-colors: active` (Chromium),
    on `fall-back` and `spring-forward`: the band, its two edges, the four lanes, every
    handle, every tag, the brackets, the wedges, every connector (dashed where it is), every
    square, every bar and every chip are visible, all text is a system colour, and a disabled
    Offset select is `GrayText`. Save to
    `$WT/apps/dox/.visual/timetable-reader/forced-<preset>.png`.
11. **Contrast and size**, on the rendered page in both themes, on `fall-back`,
    `spring-forward` and `published-local`, at 1440 and 390: every text leaf in the widget is
    at least 12px and at least 7:1 against the worst pixel behind its glyph box, a disabled
    select's text included, the sentinel excluded and sizers skipped (they are invisible).
12. **Greps**, each printing nothing. In the first, a hit inside a comment is read and
    ignored; a hit in a selector or a declaration fails:
    - `grep -nE "border-left|border-inline-start|clip-path|backdrop-filter|transition|animation|data-theme|#[0-9a-fA-F]{3,8}\b|rgba?\(" $WT/apps/dox/src/styles/gmt-timetable-reader.css`
    - `grep -noE 'class="[^"]*card[^"]*"' $WT/apps/dox/src/lib/timetable-reader-mount.ts | grep -v "gmt-widget-card"`
    - `grep -nE "Date\.parse|new Date\(|Date\.now" $WT/apps/dox/src/lib/timetable-reader.ts $WT/apps/dox/src/lib/timetable-reader-mount.ts`
    - `grep -rniE "luxon|date-fns|moment|day\.?js" $WT/apps/dox/src/lib/timetable-reader*.ts*`
    - In the build, the scripts `tools/timetable-reader/index.html` references pull in no
      `zod`, `ai` or `dox-tools` chunk, and no React.
13. `eval "$(fnm env)" && fnm use && DOX_VITE_CACHE_DIR=$SP/vite-cache pnpm -C $WT run validate`
    exits 0, run when no one is reading a dev page. An `ERR_MODULE_NOT_FOUND` under
    `dist/.prerender` is a concurrent-build race: re-run, and report it if it stays.
14. `git -C $WT status --short` shows nothing staged.

---

## J. Decisions

| Decision | Reason |
| --- | --- |
| The track is the whole local day of the first valid row | One line of status text tells the reader which day it is, and row 1 chooses it |
| A row on another date gets no handle; its lane and the summary say so | The band is that day's, so a handle from another date over it would mislead |
| Four fixed lanes in one track | Two rows can print one time, and a lane that came and went would jump section 1 |
| Arrow keys go to the next 5 minutes; Shift, PageUp and PageDown move 60 | 5 is fine enough to walk through a 30-minute band; 60 crosses a day in 24 keys |
| The pointer snaps to the finest of 5, 10, 15 or 30 minutes that is 2.5px wide | A step narrower than that cannot be aimed; every preset time stays reachable |
| A blank row is an empty field and an empty lane; a click on the lane adds it | No new control and no box that comes and goes |
| A repeated hour is purple and a skipped hour gold | The DST Inspector's pair, which the Cut-off Ruler also follows: one meaning for each colour across the chart family |
| A band differs from row 3's purple marks by form, and the two kinds by edge, pattern and words | Series 3 is the DST purple, and colour is never the only cue |
| The band's edges are `etaAtZone` at the transition's two offsets | Two library readings, right for 30-minute shifts, midnight changes and skipped days |
| `classify` calls `classifyLocal` | One call, and right on a date the zone skipped whole, where comparing `HH:MM` cannot tell skipped from repeated |
| A handle never changes a row's offset | The offset is the reader's choice; a time that disagrees with it returns `null`, as the library does |
| The Offset select is disabled only when it has one choice and holds no offset | A written offset must always be clearable |
| A disabled field takes the control system's shared look, and the tool styles nothing | One look for the state in every tool that disables a field |
| The chart's axes share one scale and one origin, the local midnight | Then the only thing that leaves vertical is the clock change itself |
| The chart draws a fitted window and refits on settle | The marks fit in a few hours of a 26-hour domain; whole, the fan is 9px wide at 390 |
| Exact-axis labels are UTC | "Exact" must not depend on a zone's clock |
| The offset chips are placed by the mount, by measurement | A chip must clear the caption and stay inside its segment; CSS cannot read both |
| The legend has a swatch for each kind of band | The two kinds differ in colour, edge and pattern, so one swatch cannot show both |
| The preset shares the controls line only where its longest label shows whole; under that it has its own row | A select cannot wrap, and a cut-off preset label hides what the preset is |
| The table is a real table only where every column holds its value on two lines; under that it is stacked rows | A value that breaks inside its date or time cannot be read |
| An Offset option's label is at most `OFFSET_LABEL_MAX` characters | The narrowest frame's select cuts off anything longer |
| Four frames in a row from 45.5rem, with 12px controls up to 52rem | A 1440px viewport leaves a 758px section; the value needs 173px at the control's own size |
| The note is in the table, not in the frames | One reserved slot, and the frames stay short |
| Cells hold their size with a hidden sizer, and the live wrapper stretches over it | Exact at every width and for every zone, with no measured constant; a wrapper aligned to the start would resize with its content |
| `reason-aside` is the last element of section 3 | It may appear while a handle moves, and nothing is below it |
| The bracket rule is one rule in the transport sheet, under a selector list | Two tools draw the same frame, and the Delivery Scheduler's markup needs no new class |

---

## 9. Verified values (run against `packages/gmt/dist`)

| Row | Call or rule | Result |
| --- | --- | --- |
| T1 | `getDstTransitions("America/New_York", 2024)` | `07:00:00Z` on 10 March, `-05:00` to `-04:00`; `06:00:00Z` on 3 November, `-04:00` to `-05:00` |
| T2 | `etaAtZone("2024-11-03T06:00:00Z", "-04:00")`, then `"-05:00"` | `2024-11-03T02:00:00-04:00[-04:00]`, `2024-11-03T01:00:00-05:00[-05:00]` |
| T3 | `etaAtZone("2024-03-10T07:00:00Z", "-05:00")`, then `"-04:00"` | `2024-03-10T02:00:00-05:00[-05:00]`, `2024-03-10T03:00:00-04:00[-04:00]` |
| T4 | `getDstTransitions("Europe/Berlin", 2024)[1]` | `2024-10-27T01:00:00Z`, `+02:00` to `+01:00` |
| B1 | `dayBands`, New York, 2024-11-03 | twice, 60–120, `01:00`–`02:00` |
| B2 | New York, 2024-03-10 | skipped, 120–180, `02:00`–`03:00` |
| B3 | New York, 2024-06-15 | none |
| B4 | Berlin, 2024-10-27 | twice, 120–180, `02:00`–`03:00` |
| B5 | `Australia/Lord_Howe`, 2024-04-07 | twice, 90–120, `01:30`–`02:00` |
| B6 | `Pacific/Apia`, 2011-12-30 | skipped, 0–1440, `00:00`–`00:00` |
| B7 | `America/Santiago`, 2024-04-06 | twice, 1380–1440, `23:00`–`00:00` |
| B8 | `America/Santiago`, 2024-04-07 | none |
| B9 | `America/Havana`, 2024-11-03 | twice, 0–60, `00:00`–`01:00` |
| B10 | `Asia/Beirut`, 2024-03-31 | skipped, 0–60, `00:00`–`01:00` |
| B11 | `Asia/Singapore`, 1981-12-31 (the change is listed under 1982) | skipped, 1410–1440, `23:30`–`00:00` |
| B12 | `UTC`, 2024-11-03 | none |
| C1 | `classifyLocal`, New York, 2024-11-03, at 00:59, 01:00, 01:59, 02:00 | `unique`, `ambiguous`, `ambiguous`, `unique` |
| C2 | New York, 2024-03-10, at 01:59, 02:00, 02:59, 03:00 | `unique`, `nonexistent`, `nonexistent`, `unique` |
| C3 | `classifyLocal("2011-12-30T12:00:00", "Pacific/Apia")` | `nonexistent` |
| C4 | `etaAtZone(resolveLocal("2011-12-30T12:00:00", "Pacific/Apia", { disambiguation: "earlier" }), "Pacific/Apia")` | `2011-12-29T12:00:00-10:00[Pacific/Apia]`: the printed `HH:MM`, on another day |
| C5 | `classifyLocal("not a time", …)`, `classifyLocal(…, "Nope/Zone")` | `null`, `null` |
| L1–L5 | the five presets | D1's table; each row's Leaves and Local arrival strings are in appendix Z |
| L6 | `2024-03-10T02:30:00` with `-05:00`, New York | `null` |
| L7 | `2024-11-03T00:55:00` with `-05:00`; `2024-11-03T02:30:00` with `-05:00` | `null`; leaves `2024-11-03T02:30:00-05:00[America/New_York]` |
| L8 | `2024-03-10T01:30:00` with `-05:00`; `2024-03-10T03:30:00` with `-05:00` | leaves `2024-03-10T01:30:00-05:00[America/New_York]`; `null` |
| F1 | New York fall-back, the band in exact minutes | 60, 120, 180 |
| F2 | New York spring-forward | 120 |
| F3 | Berlin fall-back | 120, 180, 240 |
| D1 | `resolveLocal` of 00:00: Havana 2024-11-03; Beirut 2024-03-31; Apia 2011-12-30 | `2024-11-03T04:00:00Z`; `2024-03-30T22:00:00Z`; `2011-12-30T10:00:00Z` |

---

## Appendix Z. The values script (`$SP/ttr-values.mjs`)

```js
// Timetable Reader: every library value the spec states. DIST=<repo>/packages/gmt/dist node ttr-values.mjs
// A scratch script, so Date.parse is allowed here; the app reads instants with Temporal.Instant.
const DIST = process.env.DIST;
const { scheduleDelivery, transitTime } = await import(`${DIST}/transport/calculate/index.js`);
const { etaAtZone } = await import(`${DIST}/transport/convert/index.js`);
const { resolveLocal, classifyLocal } = await import(`${DIST}/instant/convert/index.js`);
const { getDstTransitions } = await import(`${DIST}/zoned/get/index.js`);
let bad = 0;
const eq = (id, got, want) => { const a = JSON.stringify(got), b = JSON.stringify(want); if (a !== b) { bad++; console.log(`FAIL ${id}\n  got  ${a}\n  want ${b}`); } };
const ms = (iso) => Date.parse(iso.replace(/\[.*\]$/, ""));
const next = (d) => new Date(Date.parse(`${d}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
const wall = (z) => z.slice(0, 19);
const NY = "America/New_York";

// T1-T4: the band's two wall readings come from etaAtZone at each fixed offset.
eq("T1", getDstTransitions(NY, 2024), [{ instant: "2024-03-10T07:00:00Z", offsetBefore: "-05:00", offsetAfter: "-04:00" }, { instant: "2024-11-03T06:00:00Z", offsetBefore: "-04:00", offsetAfter: "-05:00" }]);
eq("T2", [etaAtZone("2024-11-03T06:00:00Z", "-04:00"), etaAtZone("2024-11-03T06:00:00Z", "-05:00")], ["2024-11-03T02:00:00-04:00[-04:00]", "2024-11-03T01:00:00-05:00[-05:00]"]);
eq("T3", [etaAtZone("2024-03-10T07:00:00Z", "-05:00"), etaAtZone("2024-03-10T07:00:00Z", "-04:00")], ["2024-03-10T02:00:00-05:00[-05:00]", "2024-03-10T03:00:00-04:00[-04:00]"]);
eq("T4", getDstTransitions("Europe/Berlin", 2024)[1], { instant: "2024-10-27T01:00:00Z", offsetBefore: "+02:00", offsetAfter: "+01:00" });

function bands(zone, date) {
  const y = Number(date.slice(0, 4));
  const years = [y]; if (date.endsWith("-12-31")) years.push(y + 1); if (date.endsWith("-01-01")) years.unshift(y - 1);
  const dayStart = `${date}T00:00:00`, dayEnd = `${next(date)}T00:00:00`, out = [];
  for (const yr of years) for (const t of getDstTransitions(zone, yr)) {
    const before = wall(etaAtZone(t.instant, t.offsetBefore)), after = wall(etaAtZone(t.instant, t.offsetAfter));
    if (before === after) continue;
    const kind = after < before ? "twice" : "skipped";
    const start = after < before ? after : before, end = after < before ? before : after;
    if (end <= dayStart || start >= dayEnd) continue;
    const s = start < dayStart ? dayStart : start, e = end > dayEnd ? dayEnd : end;
    const min = (w) => (w === dayEnd ? 1440 : Number(w.slice(11, 13)) * 60 + Number(w.slice(14, 16)));
    out.push([kind, min(s), min(e), start.slice(11, 16), end.slice(11, 16)]);
  }
  return out;
}
// B1-B12: dayBands
eq("B1", bands(NY, "2024-11-03"), [["twice", 60, 120, "01:00", "02:00"]]);
eq("B2", bands(NY, "2024-03-10"), [["skipped", 120, 180, "02:00", "03:00"]]);
eq("B3", bands(NY, "2024-06-15"), []);
eq("B4", bands("Europe/Berlin", "2024-10-27"), [["twice", 120, 180, "02:00", "03:00"]]);
eq("B5", bands("Australia/Lord_Howe", "2024-04-07"), [["twice", 90, 120, "01:30", "02:00"]]);
eq("B6", bands("Pacific/Apia", "2011-12-30"), [["skipped", 0, 1440, "00:00", "00:00"]]);
eq("B7", bands("America/Santiago", "2024-04-06"), [["twice", 1380, 1440, "23:00", "00:00"]]);
eq("B8", bands("America/Santiago", "2024-04-07"), []);
eq("B9", bands("America/Havana", "2024-11-03"), [["twice", 0, 60, "00:00", "01:00"]]);
eq("B10", bands("Asia/Beirut", "2024-03-31"), [["skipped", 0, 60, "00:00", "01:00"]]);
eq("B11", bands("Asia/Singapore", "1981-12-31"), [["skipped", 1410, 1440, "23:30", "00:00"]]);
eq("B12", bands("UTC", "2024-11-03"), []);

// C1-C10: classifyLocal at each band edge, and the day the old HH:MM test misread.
eq("C1", ["00:59", "01:00", "01:59", "02:00"].map((t) => classifyLocal(`2024-11-03T${t}:00`, NY)), ["unique", "ambiguous", "ambiguous", "unique"]);
eq("C2", ["01:59", "02:00", "02:59", "03:00"].map((t) => classifyLocal(`2024-03-10T${t}:00`, NY)), ["unique", "nonexistent", "nonexistent", "unique"]);
eq("C3", classifyLocal("2011-12-30T12:00:00", "Pacific/Apia"), "nonexistent");
eq("C4", etaAtZone(resolveLocal("2011-12-30T12:00:00", "Pacific/Apia", { disambiguation: "earlier" }), "Pacific/Apia"), "2011-12-29T12:00:00-10:00[Pacific/Apia]"); // same HH:MM as printed: why the HH:MM test said "twice"
eq("C5", [classifyLocal("not a time", NY), classifyLocal("2024-11-03T01:30:00", "Nope/Zone")], [null, null]);

function layout(zone, date, duration, tz, rows) {
  const t0 = resolveLocal(`${date}T00:00:00`, zone), t1 = resolveLocal(`${next(date)}T00:00:00`, zone);
  const day = (ms(t1) - ms(t0)) / 60000;
  const runEnd = transitTime(t0, duration);
  const run = runEnd === "" ? 60 : (ms(runEnd) - ms(t0)) / 60000;
  const tail = Math.min(360, Math.max(60, Math.ceil(run / 60) * 60));
  return { t0, day, domain: Math.max(1440, day) + tail, rows: rows.map(([dep, off]) => {
    const text = off ? `${dep}${off}[${zone}]` : dep;
    const leaves = scheduleDelivery([{ departure: text, duration: "PT0S", timeZone: zone }], { startTimeZone: zone })?.legTimes[0]?.localArrival ?? null;
    const r = scheduleDelivery([{ departure: text, duration, timeZone: tz }], { startTimeZone: zone });
    return [leaves, leaves ? (ms(leaves) - ms(t0)) / 60000 : null, r ? (ms(r.legTimes[0].arrival) - ms(t0)) / 60000 : null, r?.legTimes[0]?.localArrival ?? null];
  }) };
}
// L1-L7: day start, exact day length, domain, and each row's instant and arrival in minutes from the day start.
eq("L1 fall-back", layout(NY, "2024-11-03", "PT1H", NY, [["2024-11-03T00:30:00"], ["2024-11-03T01:30:00"], ["2024-11-03T02:30:00"]]), { t0: "2024-11-03T04:00:00Z", day: 1500, domain: 1560, rows: [
  ["2024-11-03T00:30:00-04:00[America/New_York]", 30, 90, "2024-11-03T01:30:00-04:00[America/New_York]"],
  ["2024-11-03T01:30:00-04:00[America/New_York]", 90, 150, "2024-11-03T01:30:00-05:00[America/New_York]"],
  ["2024-11-03T02:30:00-05:00[America/New_York]", 210, 270, "2024-11-03T03:30:00-05:00[America/New_York]"]] });
eq("L2 offset-picks", layout(NY, "2024-11-03", "PT1H", NY, [["2024-11-03T01:30:00"], ["2024-11-03T01:30:00", "-05:00"]]).rows, [
  ["2024-11-03T01:30:00-04:00[America/New_York]", 90, 150, "2024-11-03T01:30:00-05:00[America/New_York]"],
  ["2024-11-03T01:30:00-05:00[America/New_York]", 150, 210, "2024-11-03T02:30:00-05:00[America/New_York]"]]);
eq("L3 spring-forward", layout(NY, "2024-03-10", "PT1H", NY, [["2024-03-10T01:30:00"], ["2024-03-10T02:30:00"], ["2024-03-10T03:30:00"]]), { t0: "2024-03-10T05:00:00Z", day: 1380, domain: 1500, rows: [
  ["2024-03-10T01:30:00-05:00[America/New_York]", 90, 150, "2024-03-10T03:30:00-04:00[America/New_York]"],
  ["2024-03-10T03:30:00-04:00[America/New_York]", 150, 210, "2024-03-10T04:30:00-04:00[America/New_York]"],
  ["2024-03-10T03:30:00-04:00[America/New_York]", 150, 210, "2024-03-10T04:30:00-04:00[America/New_York]"]] });
eq("L4 published-local", layout(NY, "2024-06-15", "PT1H", "UTC", [["2024-06-15T10:00:00"]]), { t0: "2024-06-15T04:00:00Z", day: 1440, domain: 1500, rows: [["2024-06-15T10:00:00-04:00[America/New_York]", 600, 660, "2024-06-15T15:00:00+00:00[UTC]"]] });
eq("L5 berlin-fall-back", layout("Europe/Berlin", "2024-10-27", "PT1H", "Europe/Amsterdam", [["2024-10-27T02:30:00"]]), { t0: "2024-10-26T22:00:00Z", day: 1500, domain: 1560, rows: [["2024-10-27T02:30:00+02:00[Europe/Berlin]", 150, 210, "2024-10-27T02:30:00+01:00[Europe/Amsterdam]"]] });
eq("L6 offset in a skipped hour", layout(NY, "2024-03-10", "PT1H", NY, [["2024-03-10T02:30:00", "-05:00"]]).rows, [[null, null, null, null]]);
eq("L7 offset outside its hour", layout(NY, "2024-11-03", "PT1H", NY, [["2024-11-03T00:55:00", "-05:00"], ["2024-11-03T02:30:00", "-05:00"]]).rows, [[null, null, null, null], ["2024-11-03T02:30:00-05:00[America/New_York]", 210, 270, "2024-11-03T03:30:00-05:00[America/New_York]"]]);
eq("L8 an offset that agrees again", layout(NY, "2024-03-10", "PT1H", NY, [["2024-03-10T01:30:00", "-05:00"], ["2024-03-10T03:30:00", "-05:00"]]).rows, [["2024-03-10T01:30:00-05:00[America/New_York]", 90, 150, "2024-03-10T03:30:00-04:00[America/New_York]"], [null, null, null, null]]);
// F1-F3: where a band lands on the exact axis (minutes from the day start).
const exact = (zone, date, i) => (ms(i) - ms(resolveLocal(`${date}T00:00:00`, zone))) / 60000;
eq("F1", [resolveLocal("2024-11-03T01:00:00", NY, { disambiguation: "earlier" }), "2024-11-03T06:00:00Z", resolveLocal("2024-11-03T02:00:00", NY)].map((i) => exact(NY, "2024-11-03", i)), [60, 120, 180]);
eq("F2", exact(NY, "2024-03-10", "2024-03-10T07:00:00Z"), 120);
eq("F3", [resolveLocal("2024-10-27T02:00:00", "Europe/Berlin", { disambiguation: "earlier" }), "2024-10-27T01:00:00Z", resolveLocal("2024-10-27T03:00:00", "Europe/Berlin")].map((i) => exact("Europe/Berlin", "2024-10-27", i)), [120, 180, 240]);
// D1-D3: the day start is resolveLocal's default reading of 00:00, also when midnight repeats or is skipped.
eq("D1", [resolveLocal("2024-11-03T00:00:00", "America/Havana"), resolveLocal("2024-03-31T00:00:00", "Asia/Beirut"), resolveLocal("2011-12-30T00:00:00", "Pacific/Apia")], ["2024-11-03T04:00:00Z", "2024-03-30T22:00:00Z", "2011-12-30T10:00:00Z"]);
console.log(bad === 0 ? "all ok" : `${bad} failed`);
process.exit(bad === 0 ? 0 : 1);
```
