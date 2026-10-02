# Spec: TRAN-57 charts restyle

Execution spec for `dox-builder`, verified by `dox-tester`. This is a visual change to section 2
of the three TRAN-57 tools: the Departure Board's rail, the Punctuality Board's board and the ETA
Drift Chart's plot. They join the cut-off charts' family (Countdown, Ruler, Stack), so every
transport chart reads as one set. It is not `packages/gmt` work and changes no result a tool
shows.

Read first:

- `context/dox/built.md` § Rules and § Tier 2: the cut-off chart recipes, the TRAN-57 paragraph,
  "Axis and track labels are fitted by measurement", and the six traps.
- `reference/design-system.md`: rules 1, 2 and 6, § Form controls, § Smooth growth,
  § Entrance, § Drawn charts and § Verifying.
- `reference/visual-design.md` § Widget chrome and § Motion.
- `specs/cutoff-charts-restyle.md` §§ 0, 3 and 7. This spec reuses its recipes.
- The look to match: `apps/dox/.visual/cutoff-restyle/after/tool-cutoff-*.png`.

## 0. Binding rules

- **No git operations.** Leave everything unstaged. Do not touch `packages/gmt`.
- **The widget draws the library's results and computes none of them.** Every departure, wait,
  deviation, class, rate, pick and drift comes from a library call. Positions, band edges,
  directions and tick spacing are drawing. Turning an ISO duration into "28 min" is formatting
  (`toleranceText`, `signedText`).
- **Amber is only for the sentinel.** Late, early, on time, made, missed, naive and excluded
  are words and patterns. They are never amber and never a success or error colour.
- **Series colour identifies a series and is never text.** It goes on marks, stems, edges,
  swatches and borders. The series' name, in `--gmt-ice`, carries the meaning.
- **Every text label inside a chart sits on an opaque `--gmt-surface` plate**, in `--gmt-ice`
  or `--gmt-ice-dim`. No glyph sits on a gradient, hatch, glow or line. No glow on text: these
  are static values.
- **No `backdrop-filter` inside a chart.** Glass is tint, hairline and `--gmt-highlight`.
- **Tokens only.** One-off gradient stops are the only exception, written as
  `color(from var(--token) srgb r g b / a)`. Never `color(from currentColor …)`: WebKit support
  is not safe. Never add a `[data-theme="light"]` colour block.
- **Nothing inside a drawn chart is focusable**, except the existing `.gmt-handle`s
  (`handle-after`, `handle-late`, `handle-early`, `handle-compare`). They keep their
  `role="slider"`, keyboard steps, ARIA values and typed-input paths unchanged.
- **Labels are placed by measurement:** `placeLabels` (`punctuality-widgets.ts`, built on
  `label-fit.ts`'s `placeLabel`), `thinTickLabels` and `onWidthChange`. Never a fixed offset that
  fits one preset.
- **Floors:** 12px minimum text; text contrast of at least 7:1 against the worst pixel behind
  it; no sideways scroll at 390; works in the `/dox` rail at 360 and 300 px. Narrow rules are
  `@container` queries.
- **Motion:** nothing in these charts animates or transitions. No `.gmt-enter`. The charts
  render on mount, as the cut-off charts do. The result regions keep easing through `.gmt-grow`.
  Keep every `data-grow="slot"` where it is. Add no `data-grow` to a chart or a handle host.
- **Keep every existing test assertion unchanged.** New assertions may be added.

## 1. Do not break these

- **Hooks the tests pin.** Keep each exactly as it is.
  - Every `data-role`, and every widget root (`html-diff.mjs` matches the roots).
  - **Departure Board:**
    - nine `.gmt-dep-tick:not(.gmt-dep-tick--made)` and one `.gmt-dep-tick--made` on
      `shuttle-headway`. Never put `gmt-dep-tick` on any other element;
    - six `.gmt-dep-tick` on `ferry-list`;
    - one each of `.gmt-dep-naive`, `.gmt-dep-conn.gmt-punct-hatch`, `.gmt-dep-bracket--from`
      and `.gmt-dep-bracket--to` on `shuttle-headway`, and no `.gmt-dep-bracket` on
      `ferry-list`;
    - these `rail-label-*` texts, character for character: "made: 06:40", "naive", "10 min to
      connect", "to, excluded", "from" and "made: 10:30, naive";
    - the `verdict`, `naive-line`, `rail-summary` and output texts.
  - **Punctuality Board:** the `rate-a` / `rate-b` / `rate-naive` lines and their text, the
    `row-*` roles and their texts, `.gmt-punct-bar-in`, `.gmt-punct-bar-out`, `.gmt-punct-hatch`
    and `.gmt-punct-tag`.
  - **ETA Drift Chart:**
    - `mark-N` carries `gmt-eta-mark--<class>`, and a REQ mark holds an `svg`;
    - exactly as many `.gmt-eta-ring` and `.gmt-eta-ring--dashed` elements as today, and one
      `.gmt-eta-line`. The legend and the table must not use these classes (see § 5);
    - `.gmt-eta-band` is present only with a tolerance;
    - `band-label` and `label-drift` ("↑ +9 h") keep their exact text;
    - the callouts, summary, table cells' text and `note-N` keep their text.
- **Pure helpers whose results are `toEqual`-asserted keep their shape:** `collectDepartureFacts`,
  `railWindow`, `railDepartures`, `barLayout`, `collectBoardFacts`, `collectDriftFacts`,
  `TIMESTAMP_CLASSES`. Add new exports beside them.
- **The cut-off tools must not move a pixel.** Every widened selector (§ 2) still matches the
  three cut-off roots exactly as before. Do not edit `gmt-cutoff-countdown.css`,
  `gmt-cutoff-ruler.css`, `gmt-cutoff-stack.css` or any cut-off `.ts`.
- **Do not touch** `DoxChat.tsx`, `WidgetRail.tsx`, `DoxPage.tsx`, `gmt-hive.css`,
  `chat-constants.ts`, `gmt-tokens.css`, `transport-icons.ts` or `packages/gmt`.

## 2. One family: shared recipes (`gmt-cutoff-widgets.css`)

The cut-off recipes become the family's recipes. They are not copied.

- **Widen every root list.** Each `:is(.gmt-cutoff-stack, .gmt-cutoff-ruler, .gmt-cutoff-countdown)`
  in `gmt-cutoff-widgets.css` becomes
  `:is(.gmt-cutoff-stack, .gmt-cutoff-ruler, .gmt-cutoff-countdown, .gmt-punctuality-board, .gmt-eta-drift, .gmt-departure-board)`.
  This covers the series mapping, `.gmt-cutoff-series-swatch`, `.gmt-cutoff-chip` (with
  `[hidden]` and `--dim`), `.gmt-cutoff-icon`, `.gmt-cutoff-mark` (with `--hollow`),
  `.gmt-cutoff-gate` (with `::before`), `.gmt-cutoff-closed` and the axis-tick rule marks.
  Leave the DST chips and the Stack-only rules alone. Update the header comment: the sheet is
  now the transport charts' recipe sheet.
- **The tick row.** The rule mark adds `padding-top: 9px`, so inside the three TRAN-57 roots
  `.gmt-punct-ticks` becomes `1.9rem` tall, as the cut-off tick rows are.
- **The chart surface.** Add `.gmt-punct-frame` to the chart-surface `:is()` list (the bevelled
  glass panel with the cyan wash, top hairline and inset highlight). Delete its separate rule,
  but keep `overflow-x: auto` on it in a rule after the list.
- **Hatch.** Inside the TRAN-57 roots, `.gmt-punct-hatch` becomes the family hatch: 45°, 2px on
  and 6px off, in a `--hatch` colour that defaults to
  `color(from var(--gmt-cyan-bright) srgb r g b / 0.55)`. It carries no text.
- **New shared recipes in `gmt-punctuality-widgets.css`.** Name nothing with "card" (see the
  built.md trap).
  - **`.gmt-punct-heroes`**: the result row at the top of a frame.
    - A flex row: `flex-wrap: wrap`, `gap: var(--gmt-space-2)`, `align-items: stretch`.
    - `:empty` is `display: none`.
    - It is `aria-hidden="true"`, because each value it shows is already announced: the
      verdict, the rate lines or the callouts.
  - **`.gmt-punct-hero`**: the Countdown hero's plate.
    - The plate: `--gmt-surface`, a `--gmt-border-strong` border, `--gmt-radius-md`, a bevel
      and the inset highlight.
    - With `[data-series]`, a 3px `--series` accent edge on the left, drawn the way
      `.gmt-cutoff-ruler-card` draws it (a background layer inside the bevel, plus 3px more
      inline padding).
    - Children:
      - `-cap`: mono, `--gmt-text-xs`, `all-small-caps`, `--gmt-ice-dim`;
      - `-value`: `--gmt-font-display`, `clamp(1.6rem, 7cqi, 2.4rem)`, `--gmt-ice`,
        `overflow-wrap: anywhere`;
      - `-sub`: mono, `--gmt-text-xs`, `--gmt-ice-dim`.
    - `min-width: 0` and `max-width: 100%`.
    - `[hidden]` gets its own `display: none`.
  - **`.gmt-punct-hero--quiet`**: the same plate with `-value` at `--gmt-text-lg`, for a
    secondary result beside a hero.
- **The class chip and the tag.** `.gmt-punct-chip` and `.gmt-punct-tag` move onto
  `--gmt-surface` with the inset highlight, so they read as `.gmt-cutoff-chip`s. Inside a
  `[data-series]`, the chip's border is `--series`. A tag ("late", "early") keeps a
  `--gmt-border-strong` border and adds a dashed bottom border, so a verdict is a word plus a
  pattern.

## 3. Departure Board (`departure-board-mount.ts`, `departure-board.ts`, `gmt-departure-board.css`)

### 3.1 Pure helpers (`departure-board.ts`, with unit tests)

- **`departureWait(after: string, made: string, lib: PunctualityLib): string`** returns `""`
  when `made` is `""`, and otherwise `lib.scheduleDeviation(after.trim(), made)`. That is the
  exact time from the arrival to the departure made, from the library.
  - Compute every expected value against the real library before typing it, and test
    `shuttle-headway`, `fall-back-hourly` (exact time across the repeated hour) and
    `arrival-at-to` (`""`).
- **`departureIconMode(mode: string): TransportMode | null`**, a display alias only:
  - ship, ferry, vessel and boat give `"ship"`;
  - rail, train, shuttle, tram and metro give `"rail"`;
  - truck, barge and air give themselves;
  - anything else, or blank, gives `null`.

  It is trimmed and case-insensitive. Test it.

### 3.2 The frame (`[data-role=rail-stage]` and its frame)

Server-render `<div class="gmt-punct-heroes" data-role="rail-heroes" aria-hidden="true"></div>`
as the first child of the frame, before the stage.

1. **Hero** (`.gmt-punct-hero`, `data-series="1"`, `data-role="rail-hero"`). Shown when
   `facts.made !== ""`.
   - The cap reads "departure made".
   - The value is `writtenTime(facts.made)`. It is preceded by
     `transportIcon(departureIconMode(s.onwardMode))` as a `.gmt-cutoff-icon` sized about 1em
     and `aria-hidden`, when the mode maps to an icon.
   - The sub line reads "wait <toleranceText(wait)> after arrival · <wait ISO>", for example
     "wait 28 min after arrival · PT28M". It is omitted when the wait is `""`.

   On a correct empty answer (`isEmptyReason`) the value is "none" and the sub line is "no
   departure left". On invalid input the hero is `hidden`: the outputs carry `NO SIGNAL`.
2. **Rail line** (`.gmt-dep-line`): a lit glass track about 6px tall, centred on the rail, with
   these layers:
   - a `--gmt-glass-tint` fill;
   - a `color(from var(--gmt-cyan) srgb r g b / 0.18)` wash;
   - a `--gmt-border-strong` top hairline and the inset highlight.
3. **Service window** (headway form only), a new `.gmt-dep-window` span from `from` to
   `to`.
   - It is about 2.6rem tall, centred on the rail.
   - It is lit glass: a vertical gradient of `--gmt-cyan` from about 0.32 alpha at the top to
     0.10 at the bottom, the inset highlight, and a `--gmt-border-strong` top hairline.
   - **`.gmt-dep-bracket--from`** keeps its class and becomes the closed edge: a 2px
     `--gmt-cyan-bright` line the window's height, with a bevelled cap and a `--gmt-glow`
     shadow.
   - **`.gmt-dep-bracket--to`** keeps its class and becomes the open edge: a 2px dashed
     `--gmt-cyan-bright` line with no cap.
   - **Beyond `to`**, a new `.gmt-dep-beyond` runs from `to` to the rail's end. It is the
     window's height, carries `.gmt-cutoff-closed`, and has no text.
   - The existing labels "from" and "to, excluded" become chips, and keep their text.
4. **Departures** (`.gmt-dep-tick`): glowing ticks.
   - A 2px `--gmt-cyan-bright` line about 1.5rem tall, centred on the rail.
   - A small bevelled head on top.
   - `box-shadow: 0 0 6px var(--gmt-glow)`.
5. **Dense run** (`.gmt-dep-run`, a headway too short to tick): keep it hatched. Inside the
   window it is a fine vertical comb (`repeating-linear-gradient(90deg, …)` in
   `--gmt-cyan-bright` at about 0.5 alpha). Its "every N" label is a chip.
6. **Made** (`.gmt-dep-tick--made`): the family gate, matching `.gmt-cutoff-gate`.
   - Restate the gate's look on this class rather than adding `gmt-cutoff-gate` to the
     element: 3px `--gmt-cyan-bright`, the double `--gmt-glow` shadow and a bevelled cap.
   - It is about 3.4rem tall, centred on the rail.
   - Its "made: HH:MM" label is a chip.
7. **Naive** (`.gmt-dep-naive`): a hollow dashed marker in the `.gmt-cutoff-mark--hollow` look.
   - A `--gmt-surface` fill, a 2px dashed `--gmt-ice-dim` border, no glow.
   - About 14px square, centred on the rail.
   - Its "naive" label is a chip with `--dim`. When made and naive coincide, the single chip
     keeps "made: HH:MM, naive".
8. **Connection bar** (`.gmt-dep-conn.gmt-punct-hatch`): the hatched span from the arrival to
   the earliest feasible departure (the existing `thresholdOf`).
   - About 1.1rem tall, centred on the rail.
   - Its `--hatch` is `color(from var(--gmt-ice) srgb r g b / 0.5)`.
   - A 1px `--gmt-border-strong` border, and a 2px solid `--gmt-ice` right edge that marks the
     threshold.
   - Its "N min to connect" label is a chip.
9. **Arrival handle**: unchanged. It is a `.gmt-handle` in `--gmt-ice`, painted above
   everything on the rail.
10. **Labels.** Every `.gmt-dep-label` also gets the `gmt-cutoff-chip` class, keeping its role
    and text.
    - `placeAll` adds the new shapes to its blocked rectangles: `.gmt-dep-window`'s top and
      bottom edges as thin rects, `.gmt-dep-beyond`, both brackets, every tick, the made gate,
      the naive marker and the handle's hit square.
    - Raise the stage height or the label rows if the chips need it. No label may cover a
      tick, the gate, the naive marker or the handle at 1440, 390, 360 or 300.
    - Re-fit on width change, as today.

## 4. Punctuality Board (`punctuality-board-mount.ts`, `punctuality-board.ts`, `gmt-punctuality-board.css`)

### 4.1 Hero row

Server-render `<div class="gmt-punct-heroes" data-role="rate-heroes" aria-hidden="true"></div>`
as the first child of the frame, before the board grid.

- **Plate A** (`.gmt-punct-hero`, `data-series="1"`, `data-role="rate-hero-a"`), when
  `facts.rateA !== null`:
  - the cap reads "on time";
  - the value is "<onTime> of <total>", for example "4 of 6";
  - the sub line is "late tolerance <toleranceText(late)>", plus ", early
    <toleranceText(early)>" when early is on.
- **Plate B** (`data-series="3"`, `data-role="rate-hero-b"`), when the comparison is on and
  `facts.rateB !== null`. It has the same parts, and the sub line reads "second late tolerance
  <…>".
- **A null rate draws no plate.** The rate line keeps its `NO SIGNAL`.

### 4.2 Tolerance track

- **Lane A** carries `data-series="1"`. **Lane B** carries `data-series="3"`.
- **The band** (`.gmt-punct-band`) is lit glass in its lane's `--series`:
  - a vertical gradient from about 0.32 alpha to 0.10;
  - the inset highlight;
  - 2px solid `--series` inline edges, with a soft `--series` glow
    (`0 0 12px color(from var(--series) srgb r g b / 0.35)`).
- **`--open`** (early off) has no left edge. Its fill fades to transparent over the left 30%,
  so the open end reads as open.
- **`--second`** keeps dashed 2px edges.
- **The handles are the bright grips.** `.gmt-punct-lane > .gmt-handle { color: var(--series) }`.
- **The band text becomes a chip**, keeping the text "on time" or "← early is on time".
  - Lane B gains a chip of its own (`data-role="band-b-text"`), reading
    "<toleranceText(compareLate)> late".
  - Generalise `fitBandText` so both chips hide when they do not fit clear of the handles.
- **The plan line** (`::before` on the lane and on each bar cell) becomes a 1px solid
  `--gmt-border-strong` line with a 1px `--gmt-highlight` beside it.

### 4.3 Bars

- **The band runs down every row.** Set `--band-l` and `--band-r` (percent, from the same
  `pct()`) on `[data-role=board]`.
  - Each `.gmt-punct-bar-cell` paints the band behind its bar: a faint lit stripe of
    `color(from var(--gmt-series-1) srgb r g b / 0.12)` between them.
  - It has 1px `--gmt-series-1` edge lines at both positions, and no left edge when early is
    off.
  - With the comparison on, set `--band-b` and add `gmt-punct-grid--compare`. Each bar cell's
    `::after` is then a 2px dashed `--gmt-series-3` line at `--band-b`.
  - Raise the bar cell to about 1.4rem.
- **A bar is a stem from the plan.**
  - **`.gmt-punct-bar-in`, inside the band:** a solid stem about 0.45rem tall, centred, with a
    horizontal gradient of `--gmt-cyan-bright` from about 0.3 alpha at the plan to full at
    the far end.
  - **`.gmt-punct-bar-out`, outside the band:** the same height, the family hatch
    (`.gmt-punct-hatch`, `--hatch` in `--gmt-ice` at about 0.6 alpha), and a 1px dashed
    `--gmt-border-strong` outline.
  - Add `gmt-punct-bar--neg` to both segments when the deviation is negative, which flips the
    gradient.
  - Add `gmt-punct-bar--end` to the segment whose far end is the deviation. On an in-band end,
    its `::after` is a bevelled 10px cap in `--gmt-cyan-bright` with the `.gmt-cutoff-mark`
    glow. On an out-of-band end it is a hollow cap: a `--gmt-surface` fill and a 2px dashed
    `--gmt-ice` border. A zero deviation draws only the cap, at the plan.
  - Inside and outside differ by solid against hatched, filled cap against hollow cap, and the
    word.
- **Row words.** "late" and "early" stay `.gmt-punct-tag`s (§ 2). "on time" stays a plain word.
  The naive wall-clock line keeps its dashed outline.
- **Narrow** (`@container (max-width: 30rem)`): the per-cell band keeps working, because it
  lives in the cell. The hero row wraps.

## 5. ETA Drift Chart (`eta-drift-mount.ts`, `eta-drift.ts`, `gmt-eta-drift.css`)

### 5.1 Class series (`eta-drift.ts`, with a unit test)

`export const CLASS_SERIES: Readonly<Record<TimestampClass, 1 | 2 | 3 | 4>>`:

| Class | Series      | Shape          | Why                                                                       |
| ----- | ----------- | -------------- | ------------------------------------------------------------------------- |
| EST   | 1 (cyan)    | hollow circle  | The estimates carry the join line, the chord and the band                 |
| PLN   | 2 (spring)  | filled square  |                                                                           |
| REQ   | 3 (purple)  | triangle       |                                                                           |
| ACT   | 4 (teal)    | filled diamond | Not green: the most authoritative class must not read as a success colour |

The four shapes stay. A shape plus a word always names a class, so the colour only repeats it.

### 5.2 Marks, chips, legend, table

- **Every plot mark** (`mark-N`) carries `data-series`. In its `--series`:
  - ACT, PLN and REQ are filled; EST is a 2px ring on a `--gmt-surface` fill;
  - each has a 2px `--gmt-surface` outer ring;
  - each has the `.gmt-cutoff-mark` glow.
- **A shared glyph recipe.** Add `.gmt-eta-glyph` with `--act`, `--pln`, `--est` and `--req`
  modifiers. It has the same shapes, inline and static, about 0.7rem.
  - The legend and the table use it. They never use `gmt-eta-mark` or `gmt-eta-ring`.
  - Share the shape rules between `.gmt-eta-mark--x` and `.gmt-eta-glyph--x` with `:is()`.
  - The REQ glyph holds the same inline triangle `svg`.
- **The class chip.** Every `chip(code)` in the plot labels and the table is wrapped in or
  carries `data-series` for its class, so its border is the series colour. Its text stays the
  code.
- **The legend.** Under the plot, before `band-label`, server-render
  `<ul class="gmt-eta-legend" data-role="legend" aria-hidden="true"></ul>`.
  - Fill it with one `<li data-series>` per class present in the events, in
    `TIMESTAMP_CLASSES` order.
  - Each entry is a glyph, the code chip and the word ("estimated"), in `--gmt-ice-dim`.
  - It is a flex row with wrap.
- **The table.** The Class cell is a glyph followed by the chip, with `data-series` on the
  cell. Restyle `.gmt-punct-table` inside the TRAN-57 roots to read with the chart, as the
  Stack's table does:
  - a bevelled frame;
  - a header row on `--gmt-surface`;
  - `--gmt-border` row hairlines;
  - 10px or more of inline padding on the first and last cells (the bevel trap).

  It keeps `display: block; overflow-x: auto`.

### 5.3 The plot

- **The area** (`.gmt-eta-area`) is the inner panel:
  - `--gmt-border` with a `--gmt-border-strong` top edge, a bevel, and the inset highlight;
  - a very faint `--gmt-fill-subtle` fill;
  - grid lines in `--gmt-hairline-faint`.
- **The tolerance band** (`.gmt-eta-band`) is lit glass:
  - a vertical gradient of `--gmt-cyan` at about 0.10, 0.22 and 0.10 alpha;
  - 1px `--gmt-cyan-bright` block edges with a soft glow;
  - no text inside it.

  Its words stay in `band-label` under the plot.
- **The lines.**
  - The EST join line is 1.5px of `--gmt-series-1` at about 0.7 alpha.
  - The chord stays the dashed `--gmt-ice` 2px line.
  - Under the chord, add a soft glow line: a duplicate polyline, 6px of `--gmt-glow`, behind
    it. It stays the one `.gmt-eta-line`: name the glow `.gmt-eta-line-glow`.
- **Best available** (`.gmt-eta-ring`): a bright ring.
  - 2px `--gmt-cyan-bright`, a `--gmt-surface` gap ring, and the `.gmt-cutoff-mark` glow.
  - About 1.5rem across.
- **Naive** (`.gmt-eta-ring--dashed`): about 2rem across, a 1.5px dashed `--gmt-ice-dim` ring,
  no glow.
- **Labels.**
  - Each `.gmt-eta-label` also gets `gmt-cutoff-chip` styling (opaque, bevelled), keeping its
    text.
  - The drift label is a chip.
  - `placeAll` adds the band's two edges as horizontal `lines` segments (y at
    `band.highMs` and `band.lowMs`, x from 0 to 100). A chip then never sits on a band edge,
    which fixes today's EST chip on the band line.
  - Add every mark and both rings as `blocked` rects, at their rendered size plus 2px.
  - Keep `markPx` as it is or smaller, and keep the second, no-lines pass.

### 5.4 Hero row

Server-render `<div class="gmt-punct-heroes" data-role="drift-heroes" aria-hidden="true"></div>`
as the first child of the frame, before `.gmt-eta-plot`.

- **Drift plate** (`.gmt-punct-hero`, `data-role="drift-hero"`), when `facts.drift !== null`:
  - the cap reads "estimate drift";
  - the value is `signedText(drift.drift)`, for example "+9 h";
  - the sub line reads "<drift.drift> · over <revisions> estimates", plus " · exceeds
    ±<toleranceText(tolerance)>: yes|no" when `exceedsTolerance !== null`.
- **Best plate** (`.gmt-punct-hero.gmt-punct-hero--quiet`, `data-role="best-hero"`), when
  `facts.best !== null`. It carries `data-series` for the best pick's class.
  - The cap is the class glyph plus "best available".
  - The value is "<classifier> · <labelOf(best.at)>".

## 6. Forced colours (`gmt-a11y.css`)

Re-read the file immediately before editing it, and keep each edit local.

- **Widen the cut-off forced-colours block's `:is()` lists** to the six roots, so chips, marks,
  gates, the closed hatch and swatches are restated for TRAN-57 as well.
- **Rewrite the TRAN-57 block for the new parts.** Keep it small.
  - The hero plates and the legend keep their text on `Canvas` with a `CanvasText` border, and
    never take `forced-color-adjust: none`.
  - Bands, window, stems and caps:
    - `.gmt-punct-band`, `.gmt-dep-window` and the bar-cell band become `Canvas` with
      `CanvasText` edges (dashed for `--second` and for the B line);
    - the in-band stem is solid `CanvasText` with a filled `CanvasText` cap;
    - the out-of-band stem is the `CanvasText` hatch with a hollow dashed cap.
  - Departure Board marks:
    - the made gate is `Highlight`;
    - a departure tick is `CanvasText`;
    - the naive marker is `Canvas` with a dashed `CanvasText` border;
    - `.gmt-dep-beyond` is `Canvas` with a dashed `CanvasText` border;
    - the connection bar is the `CanvasText` hatch.
  - ETA Drift marks:
    - every glyph keeps its shape in `CanvasText` (EST hollow, on `Canvas`);
    - the best ring is `Highlight`;
    - the naive ring is a dashed `CanvasText` ring;
    - the band is transparent with dashed `CanvasText` edges, as today;
    - `.gmt-eta-line-glow` is `display: none`.
- **Only marks, stems, edges and hatches** take `forced-color-adjust: none`. Never a plate that
  holds text.

## 7. Files

Modify:

- `apps/dox/src/styles/gmt-cutoff-widgets.css` (§ 2)
- `apps/dox/src/styles/gmt-punctuality-widgets.css`
- `apps/dox/src/styles/gmt-departure-board.css`
- `apps/dox/src/styles/gmt-punctuality-board.css`
- `apps/dox/src/styles/gmt-eta-drift.css`
- `apps/dox/src/styles/gmt-a11y.css` (the cut-off and TRAN-57 forced-colours blocks only)
- `apps/dox/src/lib/departure-board-mount.ts` and `departure-board.ts`
- `apps/dox/src/lib/punctuality-board-mount.ts` (and `punctuality-board.ts` only if a pure
  helper is needed)
- `apps/dox/src/lib/eta-drift-mount.ts` and `eta-drift.ts`
- the tests beside each, with additions only.

Tests to add:

- **Departure Board:**
  - `departureWait` and `departureIconMode` (unit tests);
  - `rail-hero` shows "06:40" and the wait sub line on `shuttle-headway`;
  - `rail-hero` shows "none" on `arrival-at-to`, and is hidden on an invalid arrival;
  - `.gmt-dep-window` and `.gmt-dep-beyond` exist on `shuttle-headway` and not on
    `ferry-list`.
- **Punctuality Board:**
  - `rate-hero-a` reads "<n> of <m>", using the counts the existing tests already assert for
    each preset;
  - `rate-hero-b` exists with `data-series="3"` only when the comparison is on;
  - exactly one `.gmt-punct-bar--end` per non-sentinel row.
- **ETA Drift Chart:**
  - `CLASS_SERIES` (unit test);
  - `mark-N`, its table cell and its legend entry share one `data-series`;
  - the legend lists only the classes present;
  - `drift-hero` reads "+9 h" on `vessel-slide`, and is absent wherever `facts.drift` is
    `null`;
  - `best-hero` exists.
- **All three:** the chart (`departure-rail`, `board`, `drift-plot`) has no focusable
  descendant other than the named handles, and every `.gmt-punct-heroes` is `aria-hidden`.

## 8. Definition of done (`dox-tester` runs each line)

`$SP` is
`/private/tmp/claude-501/-Users-craigcurtis-workbench-northguild-gmt-worktrees-feature-259-tran-57-schedule-deviation-punctuality-plnestreqact-nextdeparture/3c2a50e7-e634-4143-a3b8-fdc70ab56f9b/scratchpad/t57r`.

- `$SP/dist-before` is the before build, from HEAD `7596233` on a clean tree.
- `$SP/gmt-src.sha` is the `packages/gmt` hash.
- Put every script and every intermediate file under `$SP`. Adapt the cut-off scripts in the
  parent folder (`shot.mjs`, `sweep.mjs`, `contrast.mjs`, `forced.mjs`) by copying them into
  `$SP`. Never edit the originals.

Build and serve:

```sh
eval "$(fnm env)" && fnm use
cd apps/dox && DOX_VITE_CACHE_DIR=$SP/vite-cache-after pnpm run generate \
  && DOX_VITE_CACHE_DIR=$SP/vite-cache-after pnpm exec astro build --outDir $SP/dist-after
python3 -m http.server 48292 --bind 127.0.0.1 --directory $SP/dist-before   # before
python3 -m http.server 48291 --bind 127.0.0.1 --directory $SP/dist-after    # after
```

Never use port 4321 or `apps/dox/dist`. Stop both servers when done.

1. **Tests.** `pnpm --filter @gmt/dox test` is green, including generate and
   `font-floor.test.ts`. `git diff` on the six TRAN-57 test files shows additions only.
2. **Check and lint.** `pnpm --filter @gmt/dox check` and `pnpm --filter @gmt/dox lint` are
   green.
3. **Validate.** `pnpm run validate` is green.
   - An `ERR_MODULE_NOT_FOUND` under `dist/.prerender` is a concurrent-build race: re-run, and
     report it if it persists.
   - `packages/gmt` is unchanged: `$SP/gmt-src.sha` matches a fresh
     `find packages/gmt/src packages/gmt/skills packages/gmt/README.md -type f -print0 | sort -z | xargs -0 shasum | shasum`.
4. **Screenshots.** Section 2 (`.gmt-widget-section` index 1) of each tool, for every preset,
   in dark and light, at 1440 and 390, before and after. Files go to
   `apps/dox/.visual/tran57-restyle/{before,after}/<tool>-<preset>-<theme>-<width>.png`.
   - Departure Board: `shuttle-headway`, `ferry-list`, `arrival-at-to`, `fall-back-hourly`.
   - Punctuality Board: `fifteen-minute`, `sixty-and-120`, `day-based`, `fall-back`.
   - ETA Drift Chart: `vessel-slide`, `est-after-act`, `req-beats-est`, `one-estimate`.

   Compare every pair by eye, against `apps/dox/.visual/cutoff-restyle/after/tool-cutoff-*.png`.
   Both themes must look designed and of one family with the cut-off charts. The charts must
   read, and nothing may be clipped.
5. **Overlap sweep.** 0 problems on the after build: no text overlap, no text under 12px, no
   clipped text, no sideways scroll, and no focusable element in a chart other than the named
   handles.
   - Run it across all 12 presets × 2 themes × 1440/390/360.
   - Run it again with each widget root forced to 360px and to 300px wide (the `/dox` rail
     widths).
   - Measured roots: the three frames (`.gmt-punct-frame`) and the two tables.
6. **Contrast.** 0 text leaves under 7:1 on the after build, measured against the worst pixel
   behind each glyph box, with the sentinel excluded. It covers all 12 presets, both themes,
   and 1440 and 390. Record the before build's failures as the baseline.
7. **Neighbours.** Section 2 captures of the Cut-off Countdown (`late`), Ruler
   (`new-york-fall-back`) and Stack (`rotterdam-weekend`), the Delivery Scheduler, the
   Connection Checker and the DST Inspector, before and after, in both themes at 1440. Each
   pair differs by 0.2% of pixels or less (pixelmatch).
8. **Structure.** `html-diff.mjs` reads `dist/` relative to its working directory. Run
   `capture` from a folder under `$SP` whose `dist` is a symlink to `dist-before`, then
   `compare` with it pointing at `dist-after`. Only the three TRAN-57 pages may show ✗.
9. **Forced colours.** Each tool's section 2, on one preset each (`shuttle-headway`,
   `sixty-and-120`, `vessel-slide`), under `forcedColors: "active"`, read by eye. Every band,
   window, stem, cap, tick, gate, mark, ring, hatch and chip must be visible. Save the captures
   to `apps/dox/.visual/tran57-restyle/forced/`.
10. **Reduced motion.** After a preset change and a handle keyboard step, no animation runs inside
    the three frames, except the focused handle's shared `gmt-focus-sonar` ping. The sonar is
    the site's focus affordance (visual-design.md § Corners, borders, focus), and the chart
    keeps it. Under `reducedMotion: "reduce"` nothing runs at all, the sonar included.
11. **Handles.** On each tool:
    - Arrow keys move `handle-after`, `handle-late` and `handle-early`, and `handle-compare` on
      `sixty-and-120`;
    - `aria-valuenow` changes, and the typed field follows;
    - the focus ring is visible and not clipped at either end of the track, at 1440 and 390.
12. **WebKit.** Repeat 4 (after, both themes, 1440 and 390, one preset per tool) and 5 (1440 and
    390) in WebKit. Save the captures to `apps/dox/.visual/tran57-restyle/webkit/`.
13. **Smooth growth.** `node scripts/grow-measure.mjs --base http://127.0.0.1:48291 --out $SP/grow`
    passes for the three tool pages: a largest jump of 48px or less, every `.gmt-grow` at rest,
    and a final height equal to the reduced-motion run's.
14. **Firefox** cannot launch on this machine. Record it as blocked and do not bypass the
    sandbox.
15. **Readouts hold still** (§ 9.1). `pnpm --filter @gmt/dox run readout:still -- --base http://127.0.0.1:48291`
    exits 0 in Chromium and WebKit. In WebKit, keyboard steps alone are enough if pointer
    drags are flaky.
16. **No left-only accent** (§ 9.2). Grep `apps/dox/src/styles` and report every remaining
    left-edge rule with a one-word reason: chart mark, connector, grid cell, bracket, Starlight's
    own, or the focus sonar. Capture the Cut-off Ruler's section 2 for every preset, both themes,
    1440 and 390, before and after, into `apps/dox/.visual/tran57-restyle/{before,after}/`.
    Capture an injected `.gmt-ask-response blockquote` on `/dox`, both themes, after only.
    Compare by eye. The Ruler cards' series edge is at the bottom, and nothing else in the
    Ruler moved.

## 9. Owner amendments (binding; they override anything above)

### 9.1 Readouts hold still while the reader drags

See visual-design.md § Layout stability.

- **Layout.** Each `.gmt-punct-heroes` row is `justify-content: space-between`. Each plate is
  `flex: 0 0 auto` and pinned to its own edge, so one plate's width never moves another. A
  single plate sits at the start.
- **A stable box for every changing value.**
  - `font-variant-numeric: tabular-nums` on every value and sub line. The display font may not
    have tabular figures, so also reserve the width of the longest value the tool can produce:
    measure it across each handle's whole range on every preset, and set `min-inline-size` in
    `ch` (mono) or `em` (display) from that measurement.
  - `white-space: nowrap`.
  - A fixed line count: a sub line that would not fit at 300 px is split into fixed spans, one
    per line, and does not wrap.
  - Cap each plate at `max-inline-size: 100%`.
- **Plates:**
  - **Departure Board:** the hero, while `handle-after` is dragged across the rail. Its value
    swaps between a time and "none"; both live in the same reserved box.
  - **Punctuality Board:** A and B, while `handle-late`, `handle-early` and `handle-compare`
    are dragged.
  - **ETA Drift Chart:** the drift and best plates, while the tolerance range is dragged.
- **Nothing above the dragged control moves.** That covers the rate lines over the Punctuality
  Board frame, the callouts over the ETA plot, and `band-label`, which sits above the ETA
  tolerance slider. A line whose text changes on drag reserves its tallest wrapped height at
  every container width (`min-block-size` in `lh`, from a measurement), so the frame and the
  control under the pointer never shift.
- **The gate:** a new committed script, `apps/dox/scripts/readout-still.mjs`, run as the
  package script `readout:still`. It is modelled on `grow-measure.mjs`: the same `--base`,
  `--browsers` and `--widths` arguments, against a static build, never 4321.
  - For each of the three tool pages, every preset, 1440 and 390, and each widget root forced
    to 360 and 300 wide, it does two things for each handle and range named above:
    - steps it by keyboard across its whole range, from the minimum to the maximum and back;
    - pointer-drags it end to end in about 20 steps.
  - After every step it records `getBoundingClientRect()` of:
    - every `.gmt-punct-hero`;
    - the `.gmt-punct-frame`;
    - the dragged control;
    - every element in the section above that control.
  - It exits non-zero if any rect changes, rounded to the whole pixel. It prints the element,
    the step and the two rects.
  - Document it in the script's header comment, as `grow-measure.mjs` does.

### 9.2 No left-border-only accent

See visual-design.md § Corners, borders, focus.

- **`.gmt-punct-hero[data-series]`:** the accent is the 3px series edge along the bottom. This
  is already done.
- **`.gmt-cutoff-ruler .gmt-cutoff-ruler-card`** (`gmt-cutoff-ruler.css`): move the series bar
  from `left top / 3px 100%` to a bottom edge, `left bottom / 100% 3px`. Give the padding back
  on the left and add 3px at the bottom. Restate the matching forced-colours rule in
  `gmt-a11y.css` the same way. This is a deliberate Ruler change. Keep every Ruler test
  assertion unchanged.
- **`.gmt-ask-response blockquote`** (`gmt-ask.css`): replace the 2px left border with a full
  1px `--gmt-border` bevelled border, a `--gmt-fill-subtle` tint and `--gmt-radius-sm`. Its text
  keeps `--gmt-ice-dim`, which must still measure at least 7:1 on the tint. Change nothing else
  in `gmt-ask.css`.
- **Leave these alone:** drawn chart marks and connectors (gates, plan lines, DST lines, expiry
  lines, the Delivery Scheduler's itinerary spine), grid cells, `.gmt-brackets` corners, and
  Starlight's own `blockquote` and `details` rules. The site overrides Starlight's asides to a
  full border in `gmt-glass.css`.

### 9.3 Keep the focus sonar

Remove the `.gmt-punct-frame .gmt-handle` / `:focus-visible` rule that sets `animation: none`
and `transition: none`. A chart handle keeps the site's focus ring and its one sonar ping, like
every other `.gmt-handle`. Reduced motion already stops the ping in `gmt-form-controls.css`.
