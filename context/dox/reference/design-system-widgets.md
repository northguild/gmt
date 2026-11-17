# Dox theme: widget controls

Part of [design-system.md](design-system.md). Rules for the kit's custom elements, form controls
and smooth growth.

## Custom elements and CSS Modules

The kit's custom elements (`gmt-range`, `gmt-handle`, `gmt-readout`, `gmt-preset`, `gmt-chips`,
`gmt-copy`, `gmt-grow`) live in `src/widgets/primitives/<name>/`, each with its module and test.

- **Light DOM, no shadow root.** Global tokens and Starlight theming must reach inside an element.
- **Module class names are stable.** Vite names them `gmt-<file>__<local>` with no hash;
  `localsConvention` is `camelCaseOnly`. Tests and gates never select by these names and a global
  sheet never reaches them.
- **Contrast.** Text is at least 7:1 in both themes, so text uses an `-ink` token. Interactive parts
  need 3:1 against their surroundings.
- **Forced colours.** An element sets no colour the system palette must replace. It draws its focus
  ring with `outline`, never `box-shadow`, and keeps a visible border on thumbs and tracks.
  `gmt-a11y.css` restates the thumb, handle, chip faces and focus rings in system colours and
  returns `.gmt-select` to `appearance: auto`.
- **`prefers-contrast` and reduced motion.** Borders and the ring strengthen under
  `prefers-contrast: more`. Motion reads the duration tokens, which are 0 under
  `prefers-reduced-motion: reduce`.
- **Targets and focus.** Every control is at least 24 x 24 px, and `scroll-padding` keeps a focused
  control clear of sticky chrome.
- **Modern CSS only:** nesting, container queries on the widget root, logical properties,
  `:focus-visible`, `:where()`, `:is()`, `clamp()`, `color-mix()` and the motion and z-index tokens.
  Stylelint enforces Baseline 2024.

## Form controls

Every widget control composes the primitives and builders in `src/widgets/`, and every template
builds them through those builders. A widget sheet only positions them; it never restyles a thumb, a
chip or a label row. Their dimensions are tokens in `gmt-tokens.css` (`--gmt-range-*`, `--gmt-handle-*`).

- **The timeline `mark` takes `emphasis`.** A chosen point is drawn larger inside a ring, so it does
  not rely on colour (WCAG 1.4.1), and it writes `aria-current="true"`. The mark stays a named `role="img"`.
- **`.gmt-field-grid`** holds every row of labelled fields: `repeat(auto-fit, minmax(min(100%,
  11rem), 1fr))`. Each `.gmt-label` spans two rows with `grid-template-rows: subgrid`, so label
  texts share one row and controls the next, and labels never "drop" when one wraps.
  - A label has exactly two children: `labelTextHtml()`'s `.gmt-label-text` span, then the control.
  - An optional field carries the `.gmt-hint-chip` ("optional"), never "(optional)" in its text.
  - `.gmt-field-wide` spans two columns. The grid is a named container (`gmt-field-grid`) and the
    span applies from 23rem, which guarantees two tracks, so the span never creates an implicit
    column. Keep the column gap at 1rem or less.
  - Anything that is not a label (a button, a hint) takes a full row.
  - Without `subgrid` support a label falls back to a flex column.
  - `.gmt-field-grid[hidden]` and a hidden `.gmt-label` inside it restate `display: none`, because
    the grid's own `display` beats the UA `[hidden]` rule.
- **`.gmt-range`** is a real `<input type="range">` built with `rangeFieldHtml()` inside a
  `.gmt-range-field` that also holds the value chip and the end labels.
  - The fill and chip follow `--gmt-range-pct` (unitless 0 to 100), set by `syncRange()`. Call it on
    `input` and after every value, `min`, `max` or `disabled` change the code makes. It also sets `aria-valuetext`.
  - WebKit/Blink and Firefox pseudo-elements (`::-moz-range-progress`) live in separate rule
    blocks: one unknown selector drops the whole list.
  - The chip and ends are `aria-hidden`; the value is announced through `aria-valuetext`. The chip is
    clamped to its field (`translate: calc(var(--gmt-range-pct) * -1%) 0`) so it never scrolls
    sideways at 390px. Keep chip text short.
  - **Trap:** the global reduced-motion reset (`*, *::before, *::after`) cannot reach
    `::-webkit-slider-thumb` or `::-moz-range-thumb`. The thumb's animation and transitions are
    switched off in `range.module.css`'s own `prefers-reduced-motion` block.
- **`.gmt-handle`** gives a custom `role="slider"` handle the same grip. The edge is `currentColor`.
  `::before` is a fixed, centred 44x44 hit area and nothing else. Position with the individual
  `translate` / `scale` properties, never `transform`, so a widget's own `top` or `translate` composes.
- **`.gmt-chip-toggle`** paints a real checkbox or radio as a bevelled chip. The input stays in the
  page, invisible, focusable and announced; the focus ring rides the face. `[hidden]` needs its own
  `display: none`. A checked chip carries a filled mark, an accent border and tint, but its text
  stays `--gmt-ice` (`--gmt-cyan-ink` on the tint measured 5.9:1 in light). `--switch` adds a track
  and knob. `gmt-chips` is the element for a row of chips.
- **`.gmt-select`** is `appearance: none` with a chevron drawn in two gradients (an SVG data URI
  would need a colour literal). `.gmt-input` and `.gmt-select` set `background-color`, never the
  `background` shorthand, which would wipe the chevron. A select truncates with an ellipsis, because
  iOS WebKit otherwise sizes it to its longest option and widens the page.
- **A disabled `.gmt-input` or `.gmt-select`** has one shared look in the `textInput` and `select`
  builders' modules: the `--gmt-ice-dim` text tier, a dashed border, a transparent fill and
  `cursor: not-allowed`.
  - The border is `color-mix(in srgb, var(--gmt-ice-dim) 65%, transparent)`, at least 3:1 (the
    non-text bar) in both themes. The widget hairline measures 1.2 to 1.4:1.
  - No `opacity`, so the text is never faded below the hint tier. The border changes style as well
    as tone, so the state is never only a shade.
  - The look does not say why a field is off; the widget says the reason in words near the field.
  - Forced colours restate text and border as `GrayText`. A widget never styles the state itself; it
    sets `disabled`. A disabled `.gmt-range` has its own rules in the same sheet.
- **`.gmt-button--pad`** adds padding to a free-standing `.gmt-button`.
- **Every widget root carries `not-content`** and `container-type: inline-size`.
  - `not-content` removes Starlight's prose flow, which also drops table scrolling, link styling and
    inherited line-heights. The zero-specificity `:where(.gmt-widget.not-content)` block in
    `gmt-widget-reset.css` restores table scrolling and link styling.
  - A widget that draws text into a fixed-height cell sets its own `line-height`.
  - Labels on a drawn axis or track are placed by measurement, never by a fixed step
    (`src/lib/label-fit.ts`; the DST Inspector's `selectTickMinutes` for ticks).
  - Space inside a widget comes from `gap`, never from sibling margins.

## Smooth growth

`.gmt-grow` eases the height of a result region. `lib/smooth-height.ts` does the work and
`Head.astro` attaches it to every page. Gate: `pnpm run grow:measure`
(`scripts/grow-measure.mjs`).

- **`smoothHeight(outer, signal?)`** watches the outer's one child with a shared `ResizeObserver`.
  On a height change it pins the outer at the height the reader last saw and sets `data-growing`
  (which clips it); a frame loop walks the pinned height to the inner's height. At rest there is no
  inline height and no `data-growing`. There is no CSS transition: one late frame would move the box
  by everything it missed.
- **`smoothHeights(scope, signal?)`** wraps every widget section after the first in a
  `.gmt-grow-inner` box and every `[data-grow="slot"]` element in a `.gmt-grow-slot` wrapper. It is
  idempotent, keeps node identity and does nothing without `ResizeObserver`.
- **`data-grow="off"`** on a section leaves it unwrapped. **`data-grow="slot"`** wraps that one
  element, in any section. Never put it on a control or a popover host.
- **One step budget.** Each frame a box covers `1 - exp(-dt / 50 ms)` of what is left, and the boxes
  that move the page together never move more than `STEP_BUDGET_PX` (32 px, under the 48 px gate)
  in a frame. A tall grow or a slow frame lasts longer instead of jumping. A box inside a moving
  box does not move the page and takes the same scale as its parent.
- **Heights are read live, deepest box first,** so a section whose slot is easing sees only the
  change the slot does not account for, and a section already moving is never snapped.
- **Snap, not ease,** under `prefers-reduced-motion`, while the page is hidden, while a
  `[aria-expanded="true"]` list is open inside, and on a real resize (`innerWidth` changed). A
  scrollbar appearing is not a resize.
- **`content-box`.** Starlight's reset is `border-box`; a `border-box` outer would sit 17 px short
  of the inner's height.
- The constants are in `smooth-height.ts` and pinned by its tests.
