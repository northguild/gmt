# Spec: the Dox control system (shared field grid, faceted-grip dragger, chip toggles)

Execution spec for `dox-builder`, verified by `dox-tester`. This is not `packages/gmt` work.
Nothing here edits `packages/gmt`, `.changeset/`, `context/domination/` or the generated
corpus and stats. The binding source is Part C of the owner-approved plan (C1 primitives, C2
per-tool retrofit, C3 docs of record, and its Verification section). Where this spec is more
precise than the plan, the reason is given inline.

Every tool gets the same controls: labels line up in rows, a draggable value is a faceted
grip, a boolean is a bevelled chip, and a select has a chevron. The primitives are built so the
three TRAN-57 tools (Punctuality Board, ETA Drift Chart, Departure Board) can compose them
without new CSS for their controls. **Those three tools are not built here.**

---

## 0. Binding rules

- **Restyle native controls; never rebuild them from `div`s.** The dragger is a real
  `<input type="range">`; a toggle is a real `<input type="checkbox">` or `type="radio"`; a
  select is a real `<select>`. Custom `role="slider"` handles already exist in four widgets and
  stay custom; they only change their paint (`.gmt-handle`).
- **Tokens only.** No colour literals in any rule (gradient stops built from tokens with
  `color(from var(--gmt-…) srgb r g b / a)` or `color-mix(in srgb, currentColor N%, transparent)`
  are fine). An accent used as text uses its `-ink` token. Amber is only for `NO SIGNAL`.
- **No `clip-path` on any control or handle.** Bevels are `border-radius` + `corner-shape:
  bevel`; browsers without `corner-shape` get plain radius. `clip-path` clips the glow and the
  box-shadow focus ring.
- **Text floor 12px** (`font-floor.test.ts`). The value chip, end labels and the `optional`
  chip use `--gmt-text-xs` (0.75rem) or larger.
- **Values the reader is reading never animate.** The value chip and fill follow the thumb with
  no transition. Hover/active/focus transitions on the thumb itself are fine and are removed by
  the global reduced-motion reset in `gmt-controls.css`.
- **`escapeAttr` / `escapeHtml` on every template interpolation.**
- **Do not rebuild `packages/gmt/dist`.** A pristine `dist` exists. A driver agent is changing
  `packages/gmt/src` concurrently; `pnpm build` and `pnpm test` run `generate`, which reads that
  source. If a Dox test, `generate` or `astro build` fails because of an in-flight library
  change (a failure outside the files this spec touches, e.g. a corpus count, a reference page,
  a type error under `packages/gmt`), **stop, record the failure verbatim, wait a few minutes
  and retry**. Never work around it, never edit or revert a generated file, never touch
  `packages/gmt`.
- **Per-tool test loop.** After each tool, run from the repo root:
  `eval "$(fnm env)" && fnm use && pnpm --filter @gmt/dox exec vitest run` (the suite without
  `generate`, so the loop does not rewrite driver-owned generated files). Green before the next
  tool. The full `pnpm --filter @gmt/dox test` runs once at the end (section D).
- **No git operations of any kind.** Everything stays unstaged.
- **Baselines exist.** `apps/dox/.visual/before/` (pixel) and `apps/dox/.visual/html-before/`
  (markup) were captured from a clean tree before any change. Do not delete or re-capture them.

Load these `context/dox/built.md` sections: "Rules that bind every change", "Tier 2 · Widget
platform", "Tier 3 · HUD chrome". Load `context/dox/reference/design-system.md`,
`visual-design.md` and `style-guide.md` in full.

---

## C1. Shared primitives

### C1.1 Tokens (`src/styles/gmt-tokens.css`, custom properties only)

Add, in the dimensions area (not the colour block; they do not change per theme):

| Token                    | Value  | Why it is a token                                                        |
| ------------------------ | ------ | ------------------------------------------------------------------------ |
| `--gmt-range-hit-h`      | `28px` | Native input height (the hit height).                                    |
| `--gmt-range-track-h`    | `10px` | Channel height.                                                          |
| `--gmt-range-thumb-w`    | `16px` | Thumb width. Read by the Countdown axis so thumb and "now" marker align. |
| `--gmt-range-thumb-h`    | `26px` | Thumb height (tall grip, fits inside the 28px hit height).               |
| `--gmt-handle-w`         | `14px` | Custom handle grip width.                                                |
| `--gmt-handle-h`         | `24px` | Custom handle grip height.                                               |
| `--gmt-handle-hit`       | `44px` | Fixed, centred hit square of every `.gmt-handle`.                        |

The builder may tune the four grip dimensions by up to ±4px after looking at the Chromium,
Firefox and WebKit renders; the hit sizes (28px, 44px) are fixed.

### C1.2 `src/styles/gmt-form-controls.css`

This sheet owns every rule below. Keep its existing `.gmt-label`, `.gmt-input`, `.gmt-select`,
focus and `.gmt-label-required` rules and extend them.

**a. `.gmt-field-grid`**

```text
.gmt-field-grid            display:grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 11rem), 1fr));
                           column-gap: var(--gmt-space-3); row-gap: var(--gmt-space-3);
                           container: gmt-field-grid / inline-size;   (see note 1)
.gmt-field-grid > .gmt-label
                           display:grid; grid-row: span 2; grid-template-rows: subgrid;
                           row-gap: var(--gmt-space-1); align-items: end (label row) / start (control row)
.gmt-field-grid > :not(.gmt-label)   grid-column: 1 / -1   (anything else takes a full row)
.gmt-field-grid .gmt-input, .gmt-select, .gmt-range, .gmt-range-field, .gmt-label-wide
                           min-width: 0; width: 100%
.gmt-field-grid > .gmt-label-wide   flex: none (the 220px flex basis from gmt-widget.css must not apply)
@container gmt-field-grid (min-width: 23rem) { .gmt-field-grid > .gmt-field-wide { grid-column: span 2 } }
@supports not (grid-template-rows: subgrid) {
  .gmt-field-grid > .gmt-label { display:flex; flex-direction:column; grid-row:auto }
}
```

Note 1: the grid is its own named container. `span 2` on a one-column grid creates an implicit
second column and overflows. Measured on the grid itself, 23rem guarantees two 11rem tracks plus
a gap of at most 1rem; measured on the widget root it would not, because the card adds padding.
Keep `column-gap` ≤ 1rem for that reason.

Label markup inside a field grid is exactly two children:

```html
<label class="gmt-label [gmt-field-wide]">
  <span class="gmt-label-text">Onward duration <span class="gmt-hint-chip">optional</span></span>
  <input class="gmt-input" …>        <!-- or select, or .gmt-range-field -->
</label>
```

- `.gmt-label-text`: the whole label text in one span, so the subgrid row holds one box.
  `display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--gmt-space-1)`.
- `.gmt-hint-chip`: a small bevelled chip, `text-transform: none`, `font-family: var(--gmt-font-mono)`,
  `font-size: var(--gmt-text-xs)`, `letter-spacing: normal`, `color: var(--gmt-ice-dim)`,
  1px `var(--gmt-border)` border, `border-radius: var(--gmt-radius-sm); corner-shape: bevel`,
  padding `0 var(--gmt-space-1)`. It replaces every "(optional)" / "(OPTIONAL)" in label text.
  Screen readers read "optional" as part of the label, which is what we want.

**b. `.gmt-range`, the faceted-grip dragger** (moves here from `gmt-connection-checker.css`;
the duplicate in `gmt-scrubber.css` is deleted in C2)

Markup, produced by `rangeFieldHtml()` (C1.3):

```html
<span class="gmt-range-field" style="--gmt-range-pct: 50">
  <input class="gmt-range" type="range" data-role="…" min max step value aria-valuetext="…">
  <span class="gmt-range-chip" data-role="…-value" aria-hidden="true">14:05</span>
  <span class="gmt-range-ends" aria-hidden="true"><span>−60 min</span><span>+60 min</span></span>
</span>
```

- `--gmt-range-pct` is a **unitless number 0–100** (not a percentage) so it can scale a length:
  the thumb centre is at
  `calc(var(--gmt-range-thumb-w) / 2 + (100% - var(--gmt-range-thumb-w)) * var(--gmt-range-pct, 0) / 100)`.
  Use that exact expression for the fill stop and the chip's `left`. It is set on the input
  and on its `.gmt-range-field` (the chip is a sibling, and pseudo-elements inherit it from the
  input).
- **Input:** `appearance:none; display:block; width:100%; height: var(--gmt-range-hit-h);
  margin:0; background: transparent; cursor: grab;` `:active` → `cursor: grabbing`.
- **Track** (`::-webkit-slider-runnable-track` and `::-moz-range-track`, separate rule blocks —
  one invalid selector in a list drops the whole list): a bevelled glass channel, height
  `var(--gmt-range-track-h)`, 1px `var(--gmt-border-strong)` border,
  `border-radius: var(--gmt-radius-sm); corner-shape: bevel`, an inset shadow for depth, and a
  background that is a cyan-tinted fill up to the thumb centre and `var(--gmt-fill-deep)` after
  (WebKit/Blink via the `--gmt-range-pct` gradient; Firefox's track gets the unfilled
  background only).
- **Fill in Firefox:** `::-moz-range-progress`, the same height, bevel and cyan tint.
- **Thumb** (`::-webkit-slider-thumb`, `::-moz-range-thumb`, separate blocks): width
  `--gmt-range-thumb-w`, height `--gmt-range-thumb-h`; WebKit/Blink needs `appearance:none` and a
  `margin-top` that centres it on the track
  (`calc((var(--gmt-range-track-h) - 2px - var(--gmt-range-thumb-h)) / 2)`).
  `border-radius: var(--gmt-radius-sm); corner-shape: bevel` (NOT `clip-path`).
  Border 1.5px–2px `var(--gmt-cyan)`. Background: three vertical grip ridges drawn with
  `repeating-linear-gradient(90deg, <ridge> 0 1px, transparent 1px 3px)` sized to exactly three
  periods and centred (`center / 7px 45% no-repeat`), over a glass fill (a low-alpha cyan tint
  on `var(--gmt-void)` or `var(--gmt-surface)`; it must be opaque enough that the channel does
  not show through).
- **States:**
  - hover → an outer glow `box-shadow: 0 0 10px color(from var(--gmt-cyan) srgb r g b / 0.55)`;
  - active → solid `var(--gmt-cyan)` fill, ridges in `var(--gmt-void)`;
  - `:focus-visible` → the sonar ring on the thumb (the static 2px + 5px ring from
    `.gmt-input:focus`, plus `animation: gmt-focus-sonar …` where the engine animates the
    pseudo-element). The input itself sets `outline: none` only while the thumb carries the ring;
  - `:disabled` → `cursor: not-allowed`, reduced opacity, border `var(--gmt-ice-dim-fill)`, no
    cyan fill, no glow.
- **Chip** `.gmt-range-chip`: absolutely positioned above the thumb centre
  (`left: <thumb-centre expression>; translate: -50% 0; bottom: calc(100% - …)` or equivalent),
  `font-family: var(--gmt-font-mono); font-size: var(--gmt-text-xs); color: var(--gmt-ice)`,
  bevelled 1px `var(--gmt-cyan)` border, `background: var(--gmt-surface)` (opaque, not glass),
  `white-space: nowrap; pointer-events: none`. No transition. The wrapper reserves room above
  the input for it (`padding-top`), so the chip never overlaps the label text.
  At the ends the chip may overhang its wrapper by half its width; it must never cause
  horizontal page scroll at 390px (clamp its `left` or let the wrapper's parent clip nothing —
  verify at min and max value).
- **End labels** `.gmt-range-ends`: `display:flex; justify-content: space-between;`
  mono, `--gmt-text-xs`, `var(--gmt-ice-dim)`.
- `.gmt-range-field`: `position: relative; display: block; min-width: 0`.

**c. `.gmt-handle`, the same grip for custom `role="slider"` handles**

- The element is the grip: `position:absolute; top:50%; translate: -50% -50%;
  width: var(--gmt-handle-w); height: var(--gmt-handle-h); box-sizing: border-box;`
  `border: 2px solid currentColor` (the edge stays `currentColor`, so each widget's meaningful
  colour survives), `border-radius: var(--gmt-radius-sm); corner-shape: bevel`, the same
  three-ridge background drawn in `currentColor` over a glass fill (`var(--gmt-void)` with a
  `color-mix(in srgb, currentColor 16%, transparent)` tint), `cursor: grab; touch-action: none`.
- Use the individual `translate` / `scale` properties, never `transform`, so a widget override
  of `top` or `translate` composes.
- `::before` is the hit area and nothing else: `content:""; position:absolute; left:50%;
  top:50%; width: var(--gmt-handle-hit); height: var(--gmt-handle-hit); translate: -50% -50%;`
  no background, no border. No other `::before`/`::after` decoration.
- hover → glow in `currentColor`; `:active` → `cursor: grabbing`, solid `currentColor` fill with
  ridges in `var(--gmt-void)`, `scale: 1.08`; `:focus-visible` → `outline:none` plus the sonar
  ring (cyan, as every other focus on the site).
- No `clip-path`.

**d. `.gmt-chip-toggle`, generalised from `.gmt-globe-filter-toggle`**

Markup (helper `chipToggleHtml()`, C1.3):

```html
<label class="gmt-chip-toggle [gmt-chip-toggle--switch]">
  <input type="checkbox|radio" name? data-role="…" value="…" [checked]>
  <span class="gmt-chip-toggle-face">[<span class="gmt-chip-toggle-track"></span>]Sat</span>
</label>
```

- The input stays in the page, focusable and announced: `position:absolute; opacity:0;
  inline-size:1px; block-size:1px; margin:0; pointer-events:none` (never `display:none`).
- `.gmt-chip-toggle` is `display:inline-flex; position: relative`.
  **`.gmt-chip-toggle[hidden] { display: none }`** — load-bearing, same reason as the globe
  (an author `display` beats the UA `[hidden]` rule).
- The face: bevelled chip, 1px `var(--gmt-border-strong)`, `var(--gmt-fill-subtle)` fill,
  `var(--gmt-ice)` text, mono `--gmt-text-sm`, min height 32px (the input height) so a chip row
  lines up with inputs; `:hover` → `var(--gmt-fill-strong)`.
- Checked (`input:checked + .gmt-chip-toggle-face`): border `var(--toggle-accent)`, fill
  `color(from var(--toggle-accent) srgb r g b / 0.2)`, text `var(--gmt-cyan-ink)`.
  `--toggle-accent` defaults to `var(--gmt-cyan-ink)`. State is also carried by a non-colour cue
  (e.g. a small filled bevel mark or the switch knob), never colour alone.
- `input:focus-visible + .gmt-chip-toggle-face` → the ring on the face (`outline: 2px solid
  var(--gmt-cyan); outline-offset: 2px`, as the globe does).
- `input:disabled + .gmt-chip-toggle-face` → reduced opacity, `cursor: not-allowed`.
- `--switch` modifier: the face leads with `.gmt-chip-toggle-track`, the globe's bevelled
  track + knob (`::after`) geometry, the knob translating when checked. Used for standalone
  booleans ("Use a business calendar").
- `.gmt-chip-group`: a `<fieldset>` holding chips. `display:flex; flex-wrap:wrap;
  gap: var(--gmt-space-1); border:0; padding:0; margin:0; min-width:0`. Its `<legend>` is
  styled like `.gmt-label` text (uppercase, `--gmt-text-xs`, `--gmt-ice-dim`, wide tracking),
  `padding:0; margin-bottom: var(--gmt-space-1)`. Radio segments use the same group with a
  shared `name`; the group needs no ARIA beyond the fieldset/legend.
- The globe's own `.gmt-globe-filter-*` rules and markup are **not** changed. They carry
  per-filter accents and icons; migrating them would move pixels on the landing page and
  `/tools/zoned-earth/`, which are outside this retrofit.

**e. `.gmt-select`**: `appearance: none`, a chevron drawn with two `linear-gradient`s in
`var(--gmt-ice-dim)` (no SVG data URI: it would need a colour literal), positioned right,
`padding-right` enough that the longest option text never runs under it.
`.gmt-select option { background: var(--gmt-surface); color: var(--gmt-ice) }` so the popup
is legible in both themes where the engine honours it.

**f. `.gmt-button--pad`**: `padding: var(--gmt-space-2) var(--gmt-space-3)`. The base
`.gmt-button` (in `gmt-primitives.css`) is unchanged.

### C1.3 Helpers (`src/lib/widget-ui.ts`) and their tests (`src/lib/widget-ui.test.ts`, new)

Pure string builders plus one DOM sync. No gmt import, no `dox-tools`, no `zod`, no `ai`.

```ts
export function labelTextHtml(text: string, opts?: { optional?: boolean }): string;
// <span class="gmt-label-text">{escapeHtml(text)}[ <span class="gmt-hint-chip">optional</span>]</span>

export interface RangeFieldOptions {
  role: string;            // data-role of the input
  chipRole?: string;       // data-role of the chip; default `${role}-value`
  min: number; max: number; step: number; value: number;
  valueText: string;       // initial aria-valuetext and chip text
  ends?: readonly [string, string];
  label?: string;          // aria-label when the range is not inside a <label>
  disabled?: boolean;
}
export function rangeFieldHtml(o: RangeFieldOptions): string; // markup in C1.2b, SSR --gmt-range-pct

export function rangePct(value: number, min: number, max: number): number; // 0–100, clamped; max<=min → 0

export function syncRange(input: HTMLInputElement, valueText?: string): void;
// sets --gmt-range-pct on the input and its closest .gmt-range-field; sets aria-valuetext and
// the chip's textContent when valueText is given. Call on every `input` event AND after every
// value/min/max/disabled change the code makes itself.

export function chipToggleHtml(o: {
  type: "checkbox" | "radio"; role: string; value: string; label: string;
  checked?: boolean; name?: string; switch?: boolean;
}): string;
```

Tests (Vitest, jsdom where DOM is needed): escaping in all three builders (a `"` and `<` in
label text, role and value); `rangePct` at min, max, mid, clamped out of range, and `max ===
min`; `rangeFieldHtml` SSR style value matches `rangePct`; `syncRange` sets the property on both
elements, writes aria-valuetext and chip text, and leaves them alone when `valueText` is
omitted; `chipToggleHtml` emits `checked`, `name` and the switch track only when asked.

### C1.4 `src/styles/gmt-a11y.css`

- Add `.gmt-range:focus-visible`, `.gmt-handle:focus-visible` and
  `.gmt-chip-toggle input:focus-visible + .gmt-chip-toggle-face` to the forced-colors outline
  list (`outline: 2px solid Highlight`). Remove `.gmt-dwell-handle` / `.gmt-freetime-handle`
  from it once those classes are gone.
- Forced colours: range thumb `ButtonText`, track border `ButtonText`, progress/fill
  `Highlight`; `.gmt-handle` border `ButtonText`, background `Canvas`, active `Highlight`;
  chip toggle face border `ButtonText`, checked face `Highlight` / `HighlightText`, the switch
  track as the globe's; `.gmt-select { appearance: auto; background-image: none }`;
  `.gmt-hint-chip` border `CanvasText`.

---

## C2. Retrofit, one tool at a time

For **every** tool below:
- Its root element gets `not-content` (Starlight's opt-out, as the globe stage does at
  `globe-mount.ts:87`) and `container-type: inline-size` (already true for the seven roots in
  `gmt-transport-widgets.css:21-29`; add the rest).
  **Trap:** `not-content` also drops Starlight's styling for descendant headings, paragraphs,
  links, lists and code, and the 1rem sibling margin. After adding it, compare the tool against
  its `.visual/before` screenshot. Spacing that disappeared is restored with `gap` on the
  widget's own flex/grid containers, never by re-adding sibling margins; a link inside a widget
  must still read as a link (`--gmt-cyan-ink`, underline). Delete the now-redundant
  "Starlight gives every block a top margin, so margin: 0" resets only where they no longer do
  anything.
- Every row of `.gmt-label`s becomes a `.gmt-field-grid`; every label's text goes through
  `labelTextHtml()`; every "(optional)" becomes the hint chip. Buttons and hints stay outside
  the grid (or take a full row).
- Mount tests that assert label text, "(optional)", class names or the old structure are
  updated to the new markup — never deleted. Behaviour assertions stay as they are.
- Run the per-tool test loop (section 0). Check the tool at 390px and 1440px in the dev
  server or a fresh build: no sideways scroll, every label row lines up.

1. **Cut-off Stack** (`cutoff-stack-mount.ts`, `gmt-cutoff-stack.css`, `gmt-cutoff-widgets.css`)
   - Each cut-off fieldset's `.gmt-transport-leg-grid` (5 columns for 3 fields) → field grid.
   - Weekday checkboxes → `.gmt-chip-toggle` in a `.gmt-chip-group` fieldset (legend
     "Weekend"), keeping each input's `data-role="weekday-<n>"` and `value`.
   - The Closed-days fieldset gets the same bevelled fieldset chrome as `.gmt-transport-leg`
     (border, fill, legend style); its holidays and roll fields go in a field grid.
   - "Use a business calendar" → `.gmt-chip-toggle--switch`, keeping `data-role="calendar"`.
   - Delete `.gmt-cutoff-weekday`, `.gmt-cutoff-weekdays`, `.gmt-checkbox-label`, and
     `.gmt-transport-leg-grid` if nothing else uses it (grep first).
2. **Cut-off Ruler** (`cutoff-ruler-mount.ts`): field grid.
3. **Cut-off Countdown** (`cutoff-countdown-mount.ts`, `gmt-cutoff-countdown.css`)
   - Field grid for the preset/cut-off/clock/now fields.
   - The "Drag now" slider → `rangeFieldHtml()` with chip role `now-value` (the old
     `<output data-role="now-value">` outside the label is removed; its text is now the chip,
     inside the label). End labels are the window's start and end local times. `syncRange()`
     runs after every `render()` that sets `min`/`max`/`value`/`disabled`, and on `input`.
     aria-valuetext is the local time plus the signed offset from the cut-off.
   - "Use my clock" and "Now = the cut-off" get `gmt-button--pad`.
   - Delete the `.gmt-cutoff-countdown-drag { flex: none }` workaround.
   - **Thumb lines up with the axis "now" marker:** the axis track and the range are the same
     width and stacked; give the axis `margin-inline: calc(var(--gmt-range-thumb-w) / 2)` (or
     inset the marker positions by the same amount) so the thumb centre and the dashed "now"
     marker share an x within 1px at the minimum, middle and maximum values.
4. **Connection Checker** (`connection-checker-mount.ts`, `gmt-connection-checker.css`)
   - Handling slider → `rangeFieldHtml()`, chip role `handling-value`, ends "0 min" / "240
     min", aria-valuetext "N minutes".
   - Field rows → field grid; the departure field is `gmt-field-wide`. The two "(optional)"
     labels use the hint chip.
   - Delete the moved `.gmt-range` rules (lines 14–44), the flex field rules (52–84), and drop
     `.gmt-range` from the `animation: none` rule (163–168), which otherwise kills the thumb's
     sonar focus. Keep the 26rem small-text rule (93–99) only if a 41-character zoned string
     still overruns at 390px without it (measure).
5. **Crossing Clock** (`crossing-clock-mount.ts`): field grid (`.gmt-crossing-fields` rules
   that the grid replaces are deleted).
6. **Timetable Reader** (`timetable-reader-mount.ts`): field grid.
7. **Delivery Scheduler** (`delivery-scheduler-mount.ts`, `gmt-delivery-scheduler.css`): check
   `.gmt-delivery-leg-grid` against the field grid. Migrate it when its labels are plain
   label + control pairs; keep the per-leg accent (`legAccentAttr`). If a leg label cannot be
   a two-child label (e.g. it carries a composite control), keep its own grid and record why in
   the handback.
8. **Free Time Ledger** (`free-time-ledger-mount.ts`, `gmt-free-time-ledger.css`)
   - Field grid; weekend checkboxes → chip toggles in a `.gmt-chip-group` (keep
     `data-role="weekend"` and `value`); delete `.gmt-freetime-weekday` (merged into
     `.gmt-chip-toggle` with the Cut-off Stack's).
   - Handles: add `gmt-handle` to the handle markup; delete the round-dot rules
     (`.gmt-freetime-handle` size/radius/border/`::before`/active/focus), keeping only what is
     widget-specific (`left` at first/last child, the `margin: 0` reset if still needed, the
     colour that `currentColor` reads).
9. **Dwell Ledger** (`dwell-ledger-mount.ts`, `gmt-dwell-ledger.css`): field grid;
   `.gmt-handle` as above. It has no weekday controls.
10. **Interval Visualizer** (`interval-visualizer-mount.ts`, `gmt-interval-visualizer.css`):
    `.gmt-handle`; keep `.gmt-interval-bar--a/--b .gmt-interval-handle { color }`. Field grid
    for its inputs. It gains the 44px hit area it lacks.
11. **DST Inspector** (`dst-inspector-mount.ts`, `gmt-dst-inspector.css`): `.gmt-handle`. The
    `className` assignment at `dst-inspector-mount.ts:294` must keep `gmt-handle`. The handle
    keeps `top: 10px` (with `translate: -50% 0`), its cyan edge by default, and the gold /
    purple edge and glow in `--gap` / `--overlap` (edge via `color`, so `currentColor` carries
    it). Field grid for its inputs. It gains the 44px hit area.
12. **Multi-zone scrubber** (`multi-zone-scrubber.ts`, `gmt-scrubber.css`): its slider becomes
    `.gmt-range` inside a `.gmt-range-field` with a chip (the signed offset, e.g. "+1 h 15 min")
    and end labels; `syncRange()` on input and after the code sets `slider.value`
    (`multi-zone-scrubber.ts:227` and any other assignment). Delete `gmt-scrubber.css:96-125`
    (the duplicate range rules). Keep the existing `aria-label`; add aria-valuetext.
13. **Billing Deadlines** (`billing-deadlines-mount.ts`): field grid inside each
    `.gmt-billing-group` fieldset; its three "(optional)" labels use the hint chip.
14. **Converter Bench** (`converter-bench-mount.ts`): field grid.
15. **`PlaygroundForm.astro`** (rendered on every reference page): field grid; `gmt-pf-wide`
    maps to `gmt-field-wide`. Its client behaviour and `PlaygroundForm.test.ts` must stay
    green; `playground-templates.test.ts` too.

After step 15: every `.gmt-select` on the site has the chevron, and `grep -rn
"(optional)\|(OPTIONAL)" apps/dox/src/lib apps/dox/src/components` finds no label text.

---

## C3. Docs of record

`dox-architect` writes these at close-out (not the builder): `context/dox/reference/design-system.md`,
`context/dox/reference/visual-design.md`, `context/dox/built.md`.

---

## D. Definition of done (`dox-tester`: run each line literally, from the repo root, each
Node command prefixed `eval "$(fnm env)" && fnm use &&`)

1. `pnpm --filter @gmt/dox exec vitest run` passes. Then `pnpm --filter @gmt/dox test`
   (with `generate`) passes, or its only failures are attributable to in-flight
   `packages/gmt` changes (report them verbatim; retry once after a wait).
2. `pnpm --filter @gmt/dox lint` and `pnpm --filter @gmt/dox check` pass.
3. `node scripts/api-surface.mjs check` and `node scripts/stats.mjs check` (repo root) pass,
   or fail only on in-flight library changes (reported).
4. From `apps/dox`: `pnpm build && pnpm visual:after && pnpm visual:diff`. Every page over
   threshold is one of the tool pages or widget-hosting reference pages this spec retrofits
   (plus reference pages whose `PlaygroundForm` changed). **Review each over-threshold pair by
   eye** (open before/after PNGs) and list them. Any other page over threshold (landing,
   install, `zoned-earth`, `dox`, search, mobile menu) is a failure unless it is solely the
   `.gmt-select` chevron and says so.
5. From `apps/dox`: `node scripts/html-diff.mjs compare .visual/html-before`. Every ✗ is a
   retrofitted widget; no ~ page shows a non-widget change.
6. At 390×844 and 1440×900, both themes, on every retrofitted tool page:
   `document.documentElement.scrollWidth <= window.innerWidth` (no sideways scroll), and in each
   `.gmt-field-grid` every label in the same rendered row has the same `.gmt-label-text` top
   and the same control top (±1px).
7. **Dragger in three engines.** A scratch Playwright script (in the tester's scratchpad, not
   the repo) loads `/tools/connection-checker/` and `/tools/cutoff-countdown/` from
   `astro preview` in Chromium, Firefox and WebKit and screenshots the range field (element
   screenshot) at rest, hovered, focused (keyboard Tab) and mid-drag (mouse down), dark
   theme, plus rest in light theme. Save to
   `apps/dox/.visual/engines/<engine>-<tool>-<state>-<theme>.png`. Check: bevelled thumb corners
   in Chromium, rounded fallback in Firefox and WebKit; three grip ridges, the fill up to the
   thumb, the value chip over the thumb and the end labels in all three.
8. Countdown alignment: at slider min, middle and max, the thumb centre
   (`rect.left + thumbW/2 + (rect.width - thumbW) * frac`) and the "now" marker's x differ by
   ≤ 1px (Chromium).
9. Keyboard-only pass on every retrofitted tool: Tab reaches every range, handle and chip
   toggle; arrows, Shift+arrows (where the widget supports it) and Home/End move each range and
   handle; Space toggles each chip; each handle still has its typed input; the focus ring is
   visible on the thumb/handle/chip face.
10. Hit area: each `.gmt-handle`'s `::before` computes 44×44 and is centred on the grip
    (Interval Visualizer, DST Inspector, Dwell Ledger, Free Time Ledger).
11. Contrast ≥ 7:1 (both themes) for `.gmt-label-text`, `.gmt-hint-chip`, `.gmt-range-chip`,
    `.gmt-range-ends` and checked/unchecked chip-toggle text, measured on rendered pages.
12. `forced-colors: active` (Chromium emulation): the thumb, handle, checked vs unchecked chip
    and focus rings are distinguishable; the select shows a native arrow. Screenshot to
    `apps/dox/.visual/engines/chromium-forced-*.png`.
13. `prefers-reduced-motion: reduce`: no animation runs on focus of a range, handle or chip.
14. No `clip-path` in any rule matching `.gmt-range`, `.gmt-handle` or `.gmt-chip-toggle`
    (grep `apps/dox/src/styles`). No colour literal added (diff the styles for `#[0-9a-f]{3,8}`,
    `rgb(`, `hsl(` outside token definitions).
15. No `zod`, `ai` or `dox-tools` chunk is loaded on any retrofitted tool page (network or
    built-chunk inspection); `lib-module-graph.test.ts` and `client-graph.test.ts` pass.
16. `pnpm run validate` (repo root) is green, or its only failures are in `packages/gmt` from
    the in-flight TRAN-57 work (reported, not fixed).
17. `git status --short` shows no change under `packages/gmt`, `.changeset`,
    `context/domination` from the builder, and nothing staged.

---

## E. Files

Created: `src/lib/widget-ui.test.ts`.
Modified: `src/styles/gmt-tokens.css`, `gmt-form-controls.css`, `gmt-a11y.css`,
`gmt-connection-checker.css`, `gmt-scrubber.css`, `gmt-cutoff-widgets.css`,
`gmt-cutoff-countdown.css`, `gmt-cutoff-stack.css`, `gmt-transport-widgets.css`,
`gmt-free-time-ledger.css`, `gmt-dwell-ledger.css`, `gmt-interval-visualizer.css`,
`gmt-dst-inspector.css`, `gmt-crossing-clock.css`, `gmt-timetable-reader.css`,
`gmt-delivery-scheduler.css`, `gmt-billing-deadlines.css`, `gmt-converter-bench.css`,
`gmt-playground-form.css`, `gmt-widget.css` (as needed); `src/lib/widget-ui.ts`; each
`src/lib/<tool>-mount.ts` in C2 and its `*-mount.test.tsx`; `src/lib/multi-zone-scrubber.ts`;
`src/components/PlaygroundForm.astro`. All paths under `apps/dox/`.
