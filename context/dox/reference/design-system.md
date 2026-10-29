# Dox theme — implementation rules

> The visual language itself ("maximal chrome, disciplined content surface") is
> [visual-design.md](visual-design.md). This file is the implementation.

## The stylesheet stack

The theme is plain CSS custom properties, with no Tailwind outside the chat island. One
`customCss` entry, `src/styles/gmt.css`, sets the layer order and imports every sheet into a
`gmt.*` layer, so a later layer beats Starlight's defaults without `!important`. The core
sheets import in this order:

| #   | File                 | Owns                                                                                                                           |
| --- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `gmt-tokens.css`     | Palette (6 roles), every `--gmt-*` token, `@font-face`, the `[data-theme="light"]` value block. Custom properties only         |
| 2   | `gmt-theme.css`      | Maps `--gmt-*` onto Starlight's `--sl-*`                                                                                       |
| 3   | `gmt-primitives.css` | Reusable recipes: `.gmt-glass*`, `.gmt-brackets`, `.gmt-icon-button`, `.gmt-dox-mark*`, `.gmt-grow`, `.gmt-enter`, sonar focus |
| 4   | `gmt-glass.css`      | Glass on Starlight's own elements (header, sidebar, `pre`, tables, asides, search, dialogs)                                    |
| 5   | `gmt-shell.css`      | Global typography and the layout frame                                                                                         |
| 6   | `gmt-content.css`    | The reading surface (`.sl-markdown-content`), Expressive Code chrome, the search modal                                         |
| 7   | `gmt-controls.css`   | CTA buttons, pagination, `:focus-visible`, `::selection`, scrollbars                                                           |
| 8   | `gmt-light.css`      | Light overrides that are neither a palette re-tint nor adjacent to a base rule                                                 |

Per-widget sheets (`gmt-widget.css`, `gmt-clock-list.css` — before `gmt-map.css`,
`gmt-globe.css` and `gmt-scrubber.css`, which build on its row recipe — `gmt-dst-inspector.css`,
…) load between 7 and 8; `dox.css` and `gmt-a11y.css` load after 8. The config has the full
list.

**The chat's sheets are not in `customCss`.** `gmt-ask-tailwind.css`, `gmt-ask.css` and
`gmt-hive.css` are imported from `src/components/ask/DoxChat.tsx`, so Vite code-splits them into
the `/dox` island and no other page loads them.

Component `<style>` blocks stay in their `.astro` files and consume the tokens; they never
redefine them.

## Tokens

- **Palette:** `--gmt-void / cyan / spring / teal / ice / signal`, each re-tinted in the light
  block.
- **Glass scale:** fills `--gmt-fill-subtle` … `--gmt-fill-deep`; borders `--gmt-border`,
  `--gmt-border-strong`, `--gmt-hairline-faint`; plus `--gmt-glow`, `--gmt-highlight*`,
  `--gmt-signal-fill/-border`, `--gmt-scrollbar-*`.
- `--gmt-glass-tint / -subtle / -scrim` carry extra alpha in light mode. Keep them separate from
  `--gmt-fill-*`.
- **Series tokens** (`--gmt-series-1` … `-4`, each with an `-ink` partner) colour one series
  of a chart: a journey leg in the Delivery Scheduler (`[data-leg]`), or a reading or cut-off
  in the cut-off tools (`[data-series]`). They alias cyan, spring, the DST purple and the teal
  "severity-high" pair, so they re-tint with the theme and need no light block. Series 3
  and 4's inks reach only 5.7–6.7:1 on any surface lighter than `--gmt-void`. So a series
  colour goes on marks, stems, edges and swatches, never on text, and the series' name in
  `--gmt-ice` carries its meaning.
- **Theme-role tokens** (`--gmt-code-surface`, `--gmt-sidebar-link`, …) resolve to a different
  token per theme, so the rule that uses one needs no light block.
- **`-ink` tokens** (`--gmt-cyan-ink`, `--gmt-spring-ink`, `--gmt-purple-ink`, `--gmt-signal-ink`,
  `--gmt-severity-critical-ink`, `--gmt-severity-high-ink`, `--gmt-dst-gold-ink`) are the
  text-safe variant of an accent. See rule 6. A light-theme caution aside's title uses
  `--gmt-signal-ink` (`gmt-light.css`): Starlight's own orange measured 6.49:1 on the tinted
  caution fill.
- **`--gmt-ice-dim`** is the muted/secondary text tier. Every `color:` use clears 7:1 in both
  themes, measured by the worst-pixel method below on every tool page (every preset, plus a
  sentinel state), the home page, Why GMT, a guide, an industry guide, a scenario, a mistakes
  page, two reference pages, the tools index and the `/dox` page with a widget in the rail.
  The tier stays clearly quieter than `--gmt-ice`.
  - Dark `#98b2be`: 7.27:1 on the timetable chart's wash (`#06242e`, the lowest surface),
    7.42:1 on the Free Time Ledger's event cell, 7.96:1 on `--gmt-surface-2`, 8.25:1 on the
    widget card. 20 CIE L* points below `--gmt-ice`.
  - Light `#4b4b4b`: 7.02:1 on the tinted card behind the interval rows (`#d2ebf1`, the lowest
    surface), 8.0:1 on `--gmt-surface`. 22.6 L* points above `--gmt-ice`.
  - A widget never overrides the token for itself. If a surface makes it fall short, fix the
    surface. A chip's border sits clear of its glyphs (`.gmt-hint-chip` has 2px of vertical
    padding, because the font's glyph box is taller than a line-height of 1 and a "p" drew
    over the border), and a label has the width of its text (`--gmt-interval-label-w`).
  - `--gmt-ice-dim-fill` keeps the dimmer, earlier value for the handful of non-text consumers
    (a low-alpha wash or hatch, a disabled thumb), never a rule's `color:`.

## Maintenance rules

1. **Never add a `[data-theme="light"]` block for a colour.** Use the re-tinted token, or add a
   theme-role token in `gmt-tokens.css`. A light rule is only for a non-colour effect (a
   `backdrop-filter`, a scrollbar tweak), and goes in `gmt-light.css` unless a base rule for the
   same selector lives elsewhere.
2. **No colour literals in rules.** One-off gradient stops are the only exception.
3. **Widgets compose primitives** and never touch a Starlight-override sheet.
4. **Respect the layer order.** Which layer a rule sits in decides what it beats, not bundle
   order. Moving a rule to another layer can change the winner — verify with the visual gate
   below.
5. **The layer order is fixed in `gmt.css`.** It reads `starlight, theme, base, components,
   utilities, vendor, gmt.tokens, gmt.base, gmt.shell, gmt.content, gmt.controls, gmt.tools,
   gmt.chat, gmt.thirdparty, gmt.a11y`. Unlayered rules beat every layer, so CSS Modules and
   Astro component styles win over every global rule without `!important`.
6. **An accent used as text uses its `-ink` theme-role token; the bright accent is for fills,
   borders and non-text only.** `--gmt-cyan`, `--gmt-cyan-bright`, `--gmt-spring`, `--gmt-signal`
   and `--gmt-dst-purple` are tuned to read well as a *fill* or a *border* against the page — a
   3:1 bar — and several of their light-theme re-tints fall to ~2.5–3.7:1 once painted as
   `color:` on a light surface, under this site's 7:1 text floor
   (`context/dox/reference/verification-and-risks.md`). Each has an `-ink` sibling in
   `gmt-tokens.css`: dark value an alias onto the base token (pixel-identical, unchanged), light
   value the same hue darkened until every surface it sits on clears 7:1.
   `--gmt-cyan-bright` reuses `--gmt-cyan-ink` rather than getting its own token — the two land
   within a few hex digits of each other once both are darkened for 7:1, so a second token would
   only have duplicated it. `--gmt-severity-critical-ink` (an alias onto `--gmt-cyan-ink`),
   `--gmt-severity-high-ink` and `--gmt-dst-gold-ink` are the same pattern one level down, for
   the two tokens whose own base value is already a fill/border colour
   (`--gmt-severity-high` is `--gmt-teal`; the DST inspector's gap/overlap badges pair
   `--gmt-dst-gold`/`--gmt-dst-purple` with their own wash). A drag handle, an SVG icon glyph or
   any other non-text use of an accent stays on the bright token — a focus ring only needs 3:1,
   and `--gmt-cyan` already clears it (3.38:1 against `#f5f5f5`). `--gmt-ice-dim` is the one
   token retuned directly rather than split: it is overwhelmingly a `color:` use (captions, table
   headers, idle sidebar links, and the tokens that alias it — Starlight's `--sl-color-gray-2`,
   Pagefind's `--pagefind-ui-text`, shadcn's `--muted-foreground`), so the base value is the
   text-safe one and `--gmt-ice-dim-fill` keeps the dimmer value for the few non-text consumers.

## Custom elements and CSS Modules

The kit's custom elements (`gmt-range`, `gmt-handle`, `gmt-readout`, `gmt-preset`, `gmt-chips`,
`gmt-copy`, `gmt-grow`) live in `src/widgets/primitives/<name>/`, each with its module and test.

- **Light DOM, no shadow root.** Global tokens and Starlight theming must reach inside an
  element, and a shadow root would block both.
- **Module class names are stable.** Vite names them `gmt-<file>__<local>` with no hash, so a
  name is predictable in the DOM. `localsConvention` is `camelCaseOnly`. Tests and gates never
  select by these names; a global sheet never reaches them.
- **Contrast.** Text is at least 7:1 in both themes, so text uses an `-ink` token. Interactive
  parts need 3:1 against their surroundings.
- **Forced colours.** An element sets no colour the system palette must replace. It draws its
  focus ring with `outline`, never `box-shadow`, and keeps a visible border on thumbs and
  tracks.
- **`prefers-contrast` and reduced motion.** Borders and the ring strengthen under
  `prefers-contrast: more`. Motion reads the duration tokens, which are 0 under
  `prefers-reduced-motion: reduce`.
- **Targets and focus.** Every control is at least 24 × 24 px, and `scroll-padding` keeps a
  focused control clear of sticky chrome.
- **Modern CSS only.** Use nesting, container queries on the widget root, logical properties,
  `:focus-visible`, `:where()` and `:is()`, `clamp()`, `color-mix()`, and the motion and
  z-index tokens. Stylelint enforces Baseline 2024.

## Form controls

Every widget control composes the primitives in `gmt-form-controls.css`, and every template
builds them through the helpers in `src/lib/widget-ui.ts`. A widget sheet only positions them;
it never restyles a thumb, a chip or a label row. Their dimensions are tokens in
`gmt-tokens.css` (`--gmt-range-*`, `--gmt-handle-*`).

- **`.gmt-field-grid`** holds every row of labelled fields:
  `repeat(auto-fit, minmax(min(100%, 11rem), 1fr))`. Each `.gmt-label` spans two rows with
  `grid-template-rows: subgrid`, so label texts share one row and controls share the next.
  That is what stops labels "dropping" when one wraps.
  - A label has exactly two children: `labelTextHtml()`'s single `.gmt-label-text` span, then
    the control.
  - An optional field carries the `.gmt-hint-chip` ("optional"), never "(optional)" in its text.
  - `.gmt-field-wide` spans two columns. The grid is its own named container
    (`gmt-field-grid`) and the span applies from 23rem: measured on the grid itself, that
    guarantees two tracks, so the span can never create an implicit column. Keep the column gap
    at 1rem or less.
  - Anything that is not a label (a button, a hint) takes a full row.
  - Under `@supports not (grid-template-rows: subgrid)` a label falls back to a flex column.
  - `.gmt-field-grid[hidden]` and a hidden `.gmt-label` inside it restate `display: none`,
    because the grid's own `display` beats the UA `[hidden]` rule. A widget that swaps one
    set of fields for another (the Departure Board's list and headway forms) relies on it.
- **`.gmt-range`, the faceted-grip dragger**, is a real `<input type="range">`, built with
  `rangeFieldHtml()` inside a `.gmt-range-field` that also holds the value chip and the end
  labels.
  - The fill and the chip follow `--gmt-range-pct`, a unitless 0–100 number that
    `syncRange()` sets. Call `syncRange()` on `input` and after every value, `min`, `max` or
    `disabled` change the code makes itself. It also sets `aria-valuetext`.
  - Firefox draws the fill with `::-moz-range-progress`.
  - WebKit/Blink and Firefox pseudo-elements live in separate rule blocks: one unknown
    selector in a list drops the whole list.
  - The chip and the ends are `aria-hidden`; the value is announced through
    `aria-valuetext`.
  - The chip is clamped to its field: `translate: calc(var(--gmt-range-pct) * -1%) 0`
    puts its left edge on the thumb at the minimum and its right edge there at the
    maximum, so it never causes sideways scroll at 390px. Keep chip text short; the long
    form belongs in `aria-valuetext`.
  - **Trap: the global reduced-motion reset cannot reach the thumb.** `*, *::before,
    *::after` does not select `::-webkit-slider-thumb` or `::-moz-range-thumb`. The thumb's
    sonar animation and transitions are switched off in their own
    `prefers-reduced-motion` block in `gmt-form-controls.css`.
- **`.gmt-handle`** gives a custom `role="slider"` handle the same grip.
  - The edge is `currentColor`, so a widget colours a handle by setting `color`.
  - `::before` is a fixed, centred 44×44 hit area and nothing else.
  - Position with the individual `translate` / `scale` properties, never `transform`, so a
    widget's own `top` or `translate` composes with them. The DST Inspector's `top: 10px`
    does.
- **`.gmt-chip-toggle`** paints a real checkbox or radio as a bevelled chip, generalised from
  the globe's filter switch. The globe keeps its own rules, for its per-filter accents and
  icons.
  - The input stays in the page, invisible, focusable and announced. The focus ring rides the
    face.
  - `[hidden]` needs its own `display: none`, because an author `display` beats the UA rule.
  - A checked chip carries a filled mark and an accent border and tint, but its text stays
    `--gmt-ice`. `--gmt-cyan-ink` on the tinted fill measured 5.9:1 in light, under the 7:1
    floor. `--switch` adds a track and knob, for a standalone boolean.
  - `.gmt-chip-group` is the fieldset for a row of chips: weekday sets, radio segments.
- **`.gmt-select`** is `appearance: none` with a chevron drawn in two gradients. An SVG data
  URI would need a colour literal. `.gmt-input` and `.gmt-select` set `background-color`,
  never the `background` shorthand, which would wipe the chevron. A select truncates with an
  ellipsis (`overflow: hidden; text-overflow: ellipsis`), because iOS WebKit otherwise sizes it
  to its longest option and widens the page.
- **A disabled `.gmt-input` or `.gmt-select`** has one shared look in `gmt-form-controls.css`: the
  `--gmt-ice-dim` text tier, a dashed border, a transparent fill and `cursor: not-allowed`.
  The border is `color-mix(in srgb, var(--gmt-ice-dim) 65%, transparent)`, not the widget
  hairline: the hairline measures 1.2 to 1.4:1, and an empty disabled field (the X12 Time
  Reader's "Window starts in") has nothing else to show where it is. The border measures 3.2:1
  or more against its surface in dark and light (the 3:1 non-text bar).
  - There is no `opacity`, so the text stays in the same tier as hints and labels and is never
    faded below it.
  - The border changes style as well as tone, so the state is never only a shade.
  - The rule sets `background-color`, never `background`, so a select keeps its chevron.
  - The look does not say why a field is off. The widget says the reason in words near the
    field.
  - Forced colours restate the text and the border as `GrayText` (`gmt-a11y.css`).
  - A widget never styles the state itself; it sets `disabled` and the rule does the rest. The
    tools that do are listed in built.md § Tier 2, "One control system for every widget".
  - A disabled `.gmt-range` has its own rules in the same sheet.
- **`.gmt-button--pad`** adds padding to a free-standing `.gmt-button`. The base padding is
  unchanged.
- **Every widget root carries `not-content`** and `container-type: inline-size`.
  - `not-content` removes Starlight's prose flow from the widget, which also drops Starlight's
    table scrolling, link styling and inherited line-heights.
  - The zero-specificity `:where(.gmt-widget.not-content)` block in `gmt-widget.css` restores
    table scrolling and link styling.
  - A widget that draws text into a fixed-height cell sets its own `line-height`.
  - Labels on a drawn axis or track are placed by measurement, never by a fixed step:
    `src/lib/label-fit.ts` (`thinSpans`, `placeLabel`, `pickLabelLeft`, `thinTickLabels`,
    `onWidthChange`) drops or flips a label that would collide or overflow, and re-runs on a
    width change. The DST Inspector's `selectTickMinutes` does the same for its ticks.
  - Space inside a widget comes from `gap`, never from sibling margins.
- **Forced colours** (`gmt-a11y.css`): the thumb, handle, chip faces and focus rings are
  restated in system colours, and `.gmt-select` returns to `appearance: auto`.

## Smooth growth

`.gmt-grow` eases the height of a result region. `lib/smooth-height.ts` does the work and
`Head.astro` attaches it to every page.

- **`smoothHeight(outer, signal?)`** watches the outer's one child (the inner box) with one shared
  `ResizeObserver`. On a height change it pins the outer at the height the reader last saw and sets
  `data-growing` (which clips it); a frame loop then walks the pinned height to the inner's height,
  and cleanup returns the outer to `height: auto`. At rest there is no inline height and no
  `data-growing`. There is no CSS transition: a transition is a function of time, so one late frame
  moves the box by everything it missed, and one dropped frame doubles the step.
- **`smoothHeights(scope, signal?)`** wraps every widget section after the first in a
  `.gmt-grow-inner` box, and every `[data-grow="slot"]` element in a `.gmt-grow-slot` wrapper. It
  attaches static hosts such as the Zone Planner's. It is idempotent, keeps node identity, and does
  nothing without `ResizeObserver`.
- **`data-grow="off"`** on a section leaves it unwrapped. **`data-grow="slot"`** wraps that one
  element, in any section including section 1. Never put it on a control or a popover host.
- **One step budget.** Each frame a box covers `1 - exp(-dt / 50 ms)` of what is left (an ease-out
  with no duration, so a retarget never restarts it), and the boxes that move the page, together,
  never move more than `STEP_BUDGET_PX` (40 px, under the 48 px gate) in a frame, however late the
  frame is. A tall grow, or a slow frame, therefore lasts longer instead of jumping. A box inside a
  moving box does not move the page and takes the same scale as the box around it.
- **Heights are read live, deepest box first.** A slot is pinned before the section around it reads
  its height, so a section whose slot is easing sees only the change the slot does not account for:
  it follows the slot, and eases anything else. A section already moving keeps heading for the
  inner's height when a slot inside it starts to ease; it is never snapped.
- **Snap, not ease,** under `prefers-reduced-motion`, while the page is hidden, while a
  `[aria-expanded="true"]` list is open inside, and on a real resize (the window's `innerWidth`
  changed). A scrollbar appearing is not a resize.
- **`content-box`.** Starlight's reset is `border-box` and a later section has padding and a
  border, so a `border-box` outer would sit 17 px short of the inner's height.
- **No tokens.** The constants (`STEP_BUDGET_PX`, `FOLLOW_TAU_MS`, `SETTLE_PX`, `MAX_GROW_MS`) are in
  `smooth-height.ts` and are pinned by its tests.
- **Gate:** `pnpm run grow:measure`.

## Entrance

The site has one arrival gesture: a fade from 92% scale over 0.5 s on the spring curve, first
performed by the globe. Five things use it: the globe canvas, the globe's zone list, the Crossing
Clock's two faces, the `/dox` crystal, and every card of a tool widget.
A landmark visual that appears once its content is ready uses it, and so does each card of a
teaching widget; nothing else does, and it never replays on a value change.

- **Cards** (`card()` in `builders/layout.ts`): a card carries a valueless `data-enter`, and
  `card(children, { enter: n })` also writes `style="--gmt-enter-i: n"`, its index in the widget. The
  stylesheet runs the entrance itself on `[data-enter]:not([data-enter="pending"])`, with the delay
  `calc(var(--gmt-enter-i, 0) * var(--gmt-motion-stagger))` and `animation-fill-mode: backwards`. No
  script is involved, so a server-rendered card's first paint is the animation's first frame, a page
  without script shows the card, and a chat-rail widget that connects later enters the same way. The
  index is written into the markup and never changed, because a delay that changes after the
  animation starts makes it jump. Only `transform` and `opacity` move, so the entrance never changes
  a page's height and stays clear of `<gmt-grow>`'s height easing.

- **CSS** (`gmt-primitives.css`): the `gmt-enter` keyframes, the `.gmt-enter` class that plays
  them, the `[data-enter]` rule above, and `[data-enter="pending"]`, which hides an element held
  for its moment.
  `--gmt-enter-transform` keeps an element's own transform through the entrance (the crystal's
  `rotateX(10deg)`).
- **JS** (`lib/enter.ts`):
  - `enter(el, { delayMs, onEntered })` plays it once and leaves the element with
    `data-entered` and without the class.
  - `holdEntrance(el)` hides an element whose content is ready early and returns its release.
    The globe holds its zone list and releases it 80 ms after the canvas. The Crossing Clock
    enters each face when it first appears, the exit face 80 ms after the entry face.
  - A timer finishes or releases either one if `animationend` never comes, so a stall never
    leaves anything hidden.
- **Pure CSS use:** server-rendered markup that enters on first paint (the crystal) uses
  `animation: gmt-enter var(--gmt-enter-duration) var(--gmt-enter-easing) both` directly.
- **Nothing hidden before script:** only `lib/enter.ts` sets the class or the pending attribute.
- **Reduced motion:** `.gmt-enter` and a card's `[data-enter]` are `animation: none`; `enter()` marks the element entered at
  once and runs `onEntered`, and `holdEntrance()` does not hold.
- **Tokens** (`gmt-tokens.css`): `--gmt-enter-duration`, `--gmt-enter-easing`,
  `--gmt-enter-scale`.

## Drawn charts

The recipes in `gmt-cutoff-widgets.css` are the pattern for every drawn transport chart: the
three cut-off tools; the Departure Board, Punctuality Board and ETA Drift Chart, whose
`.gmt-punct-frame` surface joins the same `:is()` lists; and the Timetable Reader, whose day
track and two-clocks chart join them too. The ledgers, the B/L Date Stamp and the five GNSS
and leap-second tools list their roots in the same sheets. All of them read as one family:

- **Every label sits on an opaque `--gmt-surface` plate** (`.gmt-cutoff-chip`), in
  `--gmt-ice` or `--gmt-ice-dim`. Then no glyph ever touches a gradient, hatch, glow or line,
  and the 7:1 floor holds over any fill under it.
- **Glow goes on marks** (`box-shadow`, `drop-shadow`), never on text. The one exception is
  a value that is live (the Countdown hero in live mode).
- **No `backdrop-filter` inside a chart.** The widget card is already the one layer of
  glass. A chart surface is tint, hairline and the inset highlight.
- **"Closed" is a pattern plus a word:** the `.gmt-cutoff-closed` hatch and a "closed"
  chip, never colour alone.
- **Forced colours:** only marks, stems, edges and hatches opt out with
  `forced-color-adjust: none`. A plate that holds text never does, or its text keeps a theme
  colour on `Canvas`.
- **Motion:** a chart animates nothing, with one exception, a connector that is not a value.
  That is the Stack's dashed arc, and it stops in its own `prefers-reduced-motion` block. A
  drag handle inside a chart keeps the site's focus sonar.
- **An accent edge is a bottom edge.** Hero plates (`.gmt-punct-hero[data-series]`) and the
  Ruler's result cards paint their series colour as a 3px bar at `left bottom / 100% 3px`. No
  card carries a left-only accent (visual-design.md § Corners, borders, focus).
- **A two-lane strip with a reserved height** (Stored Time Audit): the zone's clock over the
  exact timeline, each lane a fixed `rem` tall with four tier rows, so a gap, an overlap, a
  since strip and no strip are the same box. Chips hang from their point by `data-anchor`
  (`start`, `mid`, `end`) so none leaves the lane. The legend always holds five items and hides
  an unused one with `visibility: hidden`.
- **The slashed-edge badge is "the rule changed".** An `offsetMismatch` badge carries the
  slashed break (`linear-gradient(115deg …)` in `--gmt-ice-dim`), the same mark the exact lane
  uses for time not drawn. A skipped hour is gold, dashed and hatched; a repeated hour is a
  purple double edge. Never one colour alone.
- **Hero plates hold still while a handle moves.** `.gmt-punct-heroes` is
  `justify-content: space-between`; each plate is `flex: 0 0 auto` with a reserved value and
  sub-line width (measured across each handle's whole range on every preset), `tabular-nums`
  and `nowrap`. Sub-lines are fixed `.gmt-punct-hero-line` spans, and a line above a dragged
  control reserves its measured line count with `min-block-size` in `lh`.
  `setPresetDescription` keeps the preset description's height once a drag makes the state
  custom. Gate: `pnpm --filter @gmt/dox run readout:still` (`scripts/readout-still.mjs`), which
  drags every handle of the Departure Board, the Punctuality Board, the ETA Drift Chart, the
  Timetable Reader, the Free Time Ledger, the Dwell Ledger, the B/L Date Stamp and the five GNSS
  and leap-second tools by keyboard and pointer in Chromium and WebKit at 1440, 390, 360 and 300
  and fails if a plate, the frame, the dragged control or anything above it moves or resizes.
  For the Timetable Reader and the tools with `scope: "widget"` it measures every element in
  the widget; only the drawing itself may change.
- **A cell whose content comes and goes holds its size with a hidden sizer** stacked in the
  same grid cell (`.gmt-timetable-hold`, the Timetable Reader's note, time cells and output).
  - The hold is a one-cell grid. Its two children are the sizer and the live wrapper
    (`.gmt-timetable-live`; for the result, the `<output>` itself), both in
    `grid-area: 1 / 1`.
  - The sizer has the shape of the largest thing the cell can hold: the longest note, or a
    value with the same character counts and break points as a real one, so it wraps the same
    way at every width, and no height is a measured constant.
  - The sizer's text lives in `data-t` attributes drawn by `::before`, and the sizer is
    `visibility: hidden` and `aria-hidden`. So the text is never in `textContent`, never
    copied and never read out.
  - The live wrapper keeps the grid's default stretch, so its box is the sizer's size
    whatever it holds. Aligned to the start, it would grow from nothing each time its content
    appears.
- **In these charts a clock change is purple for a repeated hour and gold for a skipped one**
  (`--gmt-dst-purple`, `--gmt-dst-gold`; the Cut-off Ruler and the Timetable Reader), with a
  pattern and a word as well. On the Timetable Reader that is a double edge, or a dashed edge
  and a hatch, and a chip that says "happens twice" or "never shows". Series 3 is the same
  purple, so a DST mark never has the form of a series mark.
- **Class and series colours never say "good".** The ETA Drift Chart's classes are EST cyan,
  PLN spring, REQ purple and ACT teal. The Punctuality Board's two tolerances are series 1 and
  series 3, so the on-time band never reads as success. Late, early, made and missed are
  words and patterns.
- **The GNSS and leap-second tools each have one signature drawing** on the shared
  `.gmt-gnss-frame` (`gmt-gnss-widgets.css`, then each tool's own sheet):
  - GNSS Week Decoder: an odometer ring, one lap per era, with era plates in the legend.
  - Satellite Clock Converter: a TAI ladder, eight clocks as rungs on one scale of seconds
    ahead of UTC with TAI as the top rail. Clocks off the drawn scale sit in a group of compact
    rows (`--clad-off-n` reserves their count), and NO SIGNAL is a pill in the flow under the
    stage.
  - GNSS Rollover Checker: a fuse timeline per counter, with its group headings above the
    check-date line.
  - Leap Second Timeline: a staircase, TAI − UTC stepping up at each inserted second.
  - Elapsed vs. Clock Difference: vernier rulers, the UTC clock face against the seconds that
    passed, the second ruler longer by each inserted second.
  - The family's rules, from the cut-off recipes: text on a `--gmt-surface` plate in
    `--gmt-ice` or `--gmt-ice-dim`; a series colour on a mark, edge or fill, never on text; "your
    reading", "today", "next to wrap", "inserted" and the rest are words and patterns, never a
    verdict colour; amber (`--gmt-signal-*`) is the NO SIGNAL state alone; a chosen lane or row
    is lit glass, a hatch and a chip, with any accent edge on the bottom. Nothing in a drawing is
    focusable, and nothing animates: the decoder ring turns to its new reading in one frame.
    Each drawing is `role="img"` with an `aria-label`
    and a visually hidden list. Narrow rules are named container queries (`gmt-gnss-frame`,
    `gmt-gnss-table`, a tool's own root).
  - They hold still by reserving space: every region is as big as the
    tallest thing it can show (hidden sizers, fixed slot counts, a NO SIGNAL slot that is only
    made visible), and the server HTML hides the fields the initial state hides (built.md §
    Gates).
- **The industry chart on `/why-gmt` never counts a function twice.** Each industry's bar is its
  own namespace as a solid spring segment, then each module it draws on as a hatched tint of the
  same series (`barHatchId("spring")`, `shaded`), so a shared layer reads as borrowed, not owned.
  Totals sum own counts only (`industryFunctions`), the tooltip says "draws on X (owner)", and
  the legend's words carry the meaning, never the hatch alone (`industrySegments` in
  `why-gmt-charts.ts`).

## `/dox` and the header

- `src/pages/dox.astro` wraps `<StarlightPage>` so the chat keeps the site's `customCss`;
  `data-dox-shell` hides only Starlight's `<h1>` for a full-bleed page, and the hive shell
  starts at `--sl-nav-height`, below the site header. `noindex`, `pagefind: false`.
- `Header.astro` adds the "Chat with Dox" link: a plain `<a>` carrying `DoxMark.astro`, no
  JavaScript. On `/dox` it has `aria-current="page"`, shown by a 2px bar along its bottom
  edge (WCAG 2.2 SC 1.4.1), never a left one. The bar is an `::after` drawn over the box on
  `/dox` only, so the button matches its neighbours' size and forced colours show it on that
  page alone.
- `Header.astro` also adds the NorthGuild mark link (#424) before the site title: a plain
  `<a>`, not `ButtonLink`, in the same tab, named by an sr-only span, with
  `NorthGuildMark.astro` `aria-hidden`. Its fills are in `gmt-primitives.css`, because a
  scoped style does not reach an imported SVG's paths. A hairline divider separates it from
  the title.
  - The shield's five path strings and its `viewBox` are the owner's drawing, unchanged; only
    the fills became `gmt-ng-*` classes. The file lives at `src/assets/northguild-logo.svg`
    and is inlined, never served by URL, because an SVG loaded through `<img>` or
    `background-image` cannot follow the reader's `data-theme` choice.
  - The link's name "NorthGuild home" comes from the sr-only span plus a matching `title`; the
    SVG is `aria-hidden` and not focusable, so the name is not read twice (WCAG 2.2 SC 4.1.2).
  - The link box is at least 24x24 CSS px (SC 2.5.8) and takes `.gmt-sonar-focus`. In forced
    colours it gets a real `Highlight` outline, the body paths use `LinkText`, and the field
    and glyph paths use `Canvas` with `forced-color-adjust: none` on the SVG.
  - The URL is absolute and in the same tab: it is the same site one level up, and a
    root-relative `/` would fail the `/gmt` dist guard.
- The `/dox` strip under the header keeps only the clock and the Live/Local badge, at its end.
  It is a `<div>`, not a `<header>`, so the page has one banner landmark.
- The title is a `SiteTitle.astro` override: "Give Me Temporal" from `50rem` up, "GMT" below.
  Only one form is displayed, so the link's name is the visible text (WCAG 2.2 SC 2.5.3).
  Starlight's `title` stays `@northguild/gmt` for tabs, search results and social cards.
- `Header.astro` composes Starlight's parts via `virtual:starlight/components/*`, not
  `@astrojs/starlight/components/*.astro`. The direct path resolves Starlight's defaults and
  silently bypasses this repo's `SocialIcons` and `ThemeSelect` overrides. Types for the virtual
  modules live in `src/virtual-starlight.d.ts`; re-check it on every Starlight upgrade.

## The composer control bar

- The brain menu (Radix `DropdownMenu`, `menuitemradio`) and the reset clock (Popover + cmdk) sit
  in `PromptInputTools`, left of Send, and both open upward. The `/dox` strip holds the header
  clock and the Live/Local badge; the site header gives the way back.
- The brain menu groups brains by provider, each heading showing that provider's reset.
- The reset chip shows whatever refills next (`src/lib/quota-resets.ts`). Every format is one gmt
  call (`src/lib/reset-formats.ts`), shown with its reference link, opened in a new tab.
- **Dates render after mount only.** The reader's zone and locale are not the server's (#418).
  Picks persist in `localStorage` (`dox:reset-zone`, `dox:reset-format`).
- **Nothing implies "unlimited".** The dev cookie exempts its holder from the per-visitor cap,
  never from the shared pool.

## The `/dox` examples rail

- The starter questions are cards in the widget rail, not pills in the chat: bevelled
  `<button>`s grouped under area headings, each with a chip naming the widget it opens
  (`ExamplesPanel.tsx`, `gmt-hive.css`). An area is an industry, and its heading carries the
  industry's icon, `aria-hidden`, beside the label. The panel body scrolls inside the rail
  (`overflow-y: auto`, `min-height: 0`); the header stays put.
- **Card text is `--gmt-ice` in every state.** `--gmt-cyan-ink` on the tinted hover fill is under
  7:1 in light, so hover and focus change the border and fill only. The chip is
  `--gmt-ice-dim` with its own bevelled border, distinct from the card's. Long text wraps with
  `overflow-wrap: anywhere`; nothing scrolls sideways at 390px.
- **Phone:** below 60rem, once a conversation has started, a collapsed rail is `display: none`
  (`[data-collapsed]`) and the `Examples · N` bar is shown above the composer. The bar is
  `display: none` by default and switched on only inside that query, in a block placed after
  its base rule. Before the first message the sheet stays open and the bar hidden, except on a
  short phone (below).
- **Empty phone layout:** `.gmt-hive-body[data-empty]` (set by `DoxPage` with no conversation and
  no widget) sizes the chat to its content and gives the rail `flex: 1 1 0` with a 7rem floor,
  so the crystal, status line and prompt are never clipped. The 55% sheet applies otherwise.
- **Short phone (below 44rem tall):** the empty state starts folded too (bar shown, sheet
  hidden) and drops its block padding. Measured: at 320px wide the open sheet hits its floor
  at about 688px tall. **Below 35rem** (landscape phones, 540px portraits) the body keeps a
  30rem floor and `.gmt-hive-shell` scrolls as a page, rather than leaving the transcript a
  sliver beside a 210px composer.
- **Fine print on a phone:** below 60rem the accuracy note and `.gmt-hive-licence` are hidden;
  `.gmt-hive-info` (44px, first in the composer's control bar, Send stays last) opens both in
  one `popover="auto"` panel anchored above it, falling back to the bottom edge without anchor
  positioning.
- **Focus:** the widget title (`tabIndex={-1}`, focused after a card opens it) draws a cyan
  `:focus-visible` outline. In forced colours the cards, bar and title use a `Highlight` outline;
  the card and bar rules double `.gmt-sonar-focus` to out-rank `.gmt-sonar-focus:focus { outline: none }`.
- **Motion:** the chevron's rotation and the card transitions are off under
  `prefers-reduced-motion`; the rail's view-transition block covers the list-to-widget swap.
- **Forced colours:** cards are `ButtonFace`/`ButtonText` with a solid border, chips a dashed
  `ButtonText` border, the bar a 2px `ButtonText` border, area headings `CanvasText`, and focus
  a real `outline` in `Highlight`, because forced colours drop the `box-shadow` sonar ring.
- No colour literals, no amber, no light-theme colour block, and bevels from `corner-shape`,
  never `clip-path`.

## Tailwind in the chat island

AI Elements needs Tailwind CSS 4, and it must not reach any other page:

1. **No Preflight, no automatic content scan** (`gmt-ask-tailwind.css`):

   ```css
   @layer theme, base, components, utilities;
   @import "tailwindcss/theme.css" layer(theme);
   /* preflight.css deliberately NOT imported */
   @import "tailwindcss/utilities.css" layer(utilities) source(none);

   @source "../components/ai-elements";
   @source "../components/ui";
   @source "../components/ask";
   @source "../../node_modules/streamdown/dist/*.js";
   /* …plus each installed @streamdown/* plugin's dist */
   ```

   Streamdown ships utility classes in its compiled output, so its `dist` needs `@source` lines.
2. **Import that sheet from the island's entry module, never from `customCss`.**
3. **Unlayered GMT rules beat every Tailwind utility.** `gmt-ask.css` ships a scoped `.gmt-ask`
   reset for the six collision groups: `h1`–`h6` (typography), `textarea` / `input` /
   `[contenteditable]` (caret), `header` (`backdrop-filter`), `dialog` / `[role="dialog"]`
   (matches every Radix overlay), `::selection`, and `body`.
4. **Bridge the palette.** shadcn's variables (`--background`, `--primary`, `--border`, `--ring`,
   …) map onto `--gmt-*`; `--gmt-danger` backs `--destructive`. Amber stays reserved for the
   sentinel.

- **`dark:` follows `data-theme`, not the OS:**
  `@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));`. Without it,
  Shiki's `dark:`-gated token colours pick the wrong theme for anyone whose OS and site theme
  differ.
- **Streamdown is styled through `.gmt-ask-response`**, a class passed to every `MessageResponse`,
  with unlayered overrides in `gmt-ask.css`. Streamdown emits a single `data-streamdown`
  attribute (`table-wrapper`), so there are no attribute hooks to style against.

## Verifying a change is visually safe

From `apps/dox`:

```sh
pnpm build && pnpm visual:before   # baseline, on a clean tree
# ... make the change ...
pnpm build && pnpm visual:after
pnpm visual:diff                   # exits non-zero over threshold
```

- The captured pages — landing, a dense reference page, the tool pages, one page per teaching
  widget — plus the search modal and mobile menu, in both themes at 1440×900 and 390×844.
- A perceptual pixel diff (pixelmatch), not a hash: GPU blur re-encodes differently on every
  capture. `MAX_DIFF_PIXEL_RATIO` is 0.2%.
- Masked: live clock text and the globe canvas (the day/night terminator moves with time).
  `prefers-reduced-motion` emulation stops the globe's ambient spin.
- A page whose height changed reports `ERROR (size mismatch)`: pixelmatch cannot compare
  images of different sizes. Judge those pairs by eye. Also run an overlap and sideways-scroll
  sweep at 390 and 1440, because the pixel gate cannot see either on those pages.
- The `/dox` mobile captures can cross the threshold from the header clock text alone, and
  which theme does so changes between runs. Before treating it as a regression, confirm with
  html-diff and a repeat capture.
- **`scripts/html-diff.mjs`** is the structural gate for widget markup the pixel diff cannot
  see — a dropped `selected`, a missing `data-role`: `capture <dir>`, then `compare <dir>`. It
  separates "the widget changed" (✗) from "only the page around it changed" (~).
- A diff over threshold is a regression unless it is the deliberate change — then re-baseline
  and say so. Never loosen the threshold.
- **Measure text contrast against the worst pixel behind the glyphs.** `pnpm run contrast:measure`
  (`scripts/contrast-measure.mjs`, against a served build) does it for every element whose
  colour is `--gmt-ice-dim`, in both themes, and fails under 7:1. Screenshot twice, as the page
  is and with every glyph transparent (`-webkit-text-fill-color`, which leaves borders and
  `currentColor` surfaces alone). The pixels that differ are the glyphs. Compose the text
  colour over the transparent-glyph pixel at each glyph pixel and one pixel around it. That
  covers gradients, hatches and glows a flat swatch misses. The same figure over the whole
  glyph box is printed beside it; it also reaches a neighbouring border the glyphs never
  touch, so the two should agree.
  - Measure a text node from its first to its last visible character, with whole pixels only:
    a leading space, or a half-covered edge pixel, reaches the border of an adjacent chip.
  - Skip text in a closed `<details>`: it keeps its geometry and is not painted.
  - Hide fixed and sticky chrome first, because it lands in clip screenshots.
  - Skip text inside a 1px visually hidden box (an `sr-only` `thead`). A text range reports
    its full glyph rect even when an ancestor clips it, so it gives false overlaps and false
    failures.
