# Visual design language

> Implementation rules (sheet order, tokens, the visual gate) are in
> [design-system.md](design-system.md).

**Nothing may look like a default HTML control.** No stock `border-radius` buttons, no
system-chrome scrollbars, no browser-default focus rings. The reference is a videogame HUD —
Destiny 2 crossed with Deus Ex: Mankind Divided — not a web app, and deliberately not
Cyberpunk 2077's maximal glitch.

## The core tension

HUDs are built to be glanced at; docs are built to be read. The rule: **maximal chrome,
disciplined content surface.**

- Frames, panels, borders, corners, HUD furniture, meters, motion → go hard.
- Body copy, code, tables, widget values → high contrast, generous line-height, no overlay
  texture, no glow, no letter-spacing tricks.

## Colour

Cool blue→green on a blue-tinted near-black. Everything is a token.

Roles (values in `gmt-tokens.css`): Void (page base), Cyan (primary accent, borders, active state;
**Dox's voice**), Spring (success, live values; **the reader's voice**), Teal (idle borders,
dividers), Ice (**long-form body copy**) and Signal-lost (amber, sentinel returns only).

- **Body copy is Ice, not cyan or green**, and clears **7:1** measured on real rendered pages.
  Glow is decoration, never a contrast mechanism.
- **Amber is reserved for GMT's sentinel contract.** An invalid-input result (`""` / `null` /
  `false` / `[]`) renders as `⟨ NO SIGNAL — invalid input ⟩`, never as a blank field. Its rarity
  is what makes it communicate.
- **A clock change has two colours.** The DST purple marks a repeated hour (a fall-back
  overlap) and the DST gold a skipped hour (a spring-forward gap), in the DST Inspector, the
  Cut-off Ruler and the Timetable Reader. The two also differ in pattern and in words, never
  in colour alone: a double edge is a repeated hour and a dashed edge a skipped one. A new
  chart follows the pair. The Crossing Clock uses the edges but purple for both, and the two
  ledgers flag a short or long day in gold.
- **Role colours in the transcript** resolve from one `--gmt-hive-role` per turn.
- **The Dox mark** (the faceted crystal) is one geometry module (`src/lib/dox-mark.ts`) shared by the
  chat and the header link. It turns clockwise while Dox works and settles square when the answer lands.

## Typography

- **Display** (headings, labels, buttons): a wide technical face, uppercase, wide tracking,
  never below ~13px.
- **Body and code:** JetBrains Mono, ~1.6 line-height, normal tracking.
- Long-form content is **never** set in the display face. Fonts are self-hosted.

## Panels

- Glass: `backdrop-filter: blur(24px) saturate(1.4) brightness(var(--gmt-brightness))` —
  `0.72` in dark, `0.97` in light. The darkening is what holds body text above 7:1 (measured
  11–16:1); do not raise dark above 1.0.
- A low-alpha tinted fill (the contrast floor where `backdrop-filter` is unavailable), a
  hairline gradient border on one or two edges, and a 1px inset top highlight.
- **Corner brackets mark a frame. They do not decorate a panel.** A bracket frame carries two
  L-shaped corners, top left and bottom right. The site has them in two places:
  - **Landmark sections**, in cyan (`.gmt-brackets`): the home page's hero stage, where they sit
    inside the hero's edges, and each `GridSection` cell of the home page's section grid.
  - **A framed group of controls that the reader repeats or compares**: each leg of the
    Delivery Scheduler and each row of the Timetable Reader. Every frame in the set holds the
    same fields for one numbered item, and its brackets take that item's series colour, so the
    frame matches the item's marks in the chart.

  A bracket frame is right for a new tool only in the second case: several frames of the same
  fields that the reader moves between. A single group of fields, a chart surface, a result
  block, a callout and an ordinary panel carry none, because brackets on every panel read as
  noise. In a tool, the brackets sit on a frame that already has its full bevelled border;
  they are never the frame's only edge, and never a one-sided accent.
- No grain overlay: it reads as noise.
- One layer of glass, never glass within glass. Under `prefers-reduced-transparency`, a
  near-opaque fill and no blur.

## Corners, borders, focus

- `corner-shape: bevel` + `border-radius`; browsers without `corner-shape` fall back to plain
  radius. Focus rings are `box-shadow`, which `corner-shape` never clips.
- Focus is **more visible than default, never less**: a 2px cyan ring plus the sonar ping — one
  outward emit on focus (`gmt-focus-sonar`). Only the focused element animates; idle panels keep
  a static border.
- **No left-border-only accent on any card, callout, row or result block.** A coloured left
  stripe as the only accent (`border-left`, `border-inline-start`, a left `inset` shadow, a left
  `::before` bar) is the tell-tale of AI design, and the site does not use it. An accent edge is
  a bottom border; otherwise the card has a full bevelled border with a tinted fill.

## Controls — the one hard engineering rule

**Restyle native elements. Never rebuild them from `div`s.** Keep real `<textarea>`, `<button>`,
`<input type="range">` and `<select>`, neutralised with `appearance: none`. Rebuilding loses IME
composition (all CJK input), autofill, mobile keyboards, form semantics and screen reader
support — none of which is visible while developing on a US-English desktop.

- **A draggable value is a faceted grip; never a flat or round thumb.** The grip is a tall
  bevelled handle with a glass fill, a coloured edge and three grip ridges. It sits in a
  bevelled glass channel filled up to it, with a value chip riding above it and labelled ends.
  It glows on hover and fills solid while held; the cursor is grab and grabbing.
  - A native range and a custom `role="slider"` handle look the same.
  - Bevels come from `corner-shape`, never `clip-path`, which would clip the glow and focus ring.
- **Labelled fields line up.** Fields sit in a grid whose label row and control row are shared
  across the row, so a wrapped label never pushes its control out of line with its
  neighbours. "Optional" is a small chip beside the label, not words in it.
- **A boolean is a bevelled chip**, lit and marked when on, never a stock checkbox. A row of
  them (weekdays, a segmented choice) sits in one labelled group.
- **A select has a chevron**, never the system arrow.
- Scrollbars keep the chunky `::-webkit-scrollbar` treatment. Do not add `scrollbar-color`: in
  Chromium it overrides the webkit styling wholesale.
- Blocky caret via `caret-color`.

## Widget chrome

- **In a data widget, the plotted values are content.** Bars, markers and clock readings get
  body-copy discipline; the axis, frame, grid, handles and labels are housing.
- **Live values glow; static values do not.**
- **Sentinel treatment is mandatory in every widget.**
- **Distinguish the sentinel from a legitimately empty result.** An interval intersection
  returning `[]` for intervals that do not overlap is a correct answer, not invalid input.
- **Never animate a value the reader is trying to read.**
- **Drag is never the only affordance.** Every draggable handle has a keyboard path and a typed
  input.

## Motion

Only these things move. Anything not listed stays still.

- **The sonar focus ping** (`lib/sonar.ts`).
- **The globe's spin.**
- **The arrival gesture** (`.gmt-enter`, `lib/enter.ts`): one fade from 92% scale over 0.5 s on
  the spring curve, used by the globe canvas, the globe's zone list, the Crossing Clock's faces, the
  `/dox` crystal and the numbered cards of every tool widget. It plays once, when the content is
  ready, and never on a value change. See design-system-motion.md § Entrance.
- **Cross-document view transitions** (`gmt-view-transitions.css`). The header and sidebar swap
  in place; only the content cross-fades. From northguild.dev the NorthGuild mark and wordmark
  stay perfectly still, the rest of the bar dissolves over 240 ms and the page over 600 ms while the
  landing's freeze plays in it. Reduced motion has no transition.
- **The homepage scroll reveal** (`gmt-reveal.css`, `lib/scroll-reveal.ts`). Content is visible
  by default. The hidden state exists only under `html.gmt-reveal-ready`, which the script adds
  when it is about to observe, so a stalled or missing script never hides anything. It reveals
  elements, never characters.
- **The meteor** on the landing's night sky (`lib/space-fx.ts`): a faint streak about once a
  minute, never over the copy, an open drawer or the Earth. Under reduced motion none falls.
- **The landing entrance** (`lib/hero-entrance.ts`, `gmt-entrance-freeze.css`): the hero opens as
  plain void with the copy on it, and one sequence brings the rest in at `t0` (sky drawn and globe
  ready, or 800 ms after navigation at the latest).
  - **The copy freezes over text already there,** at full opacity from first paint, so the largest
    text never waits for the sky. Buttons and the header freeze into place; the Earth dawns from
    black, then spins; the location card pops last on a spring that overshoots a little.
  - Only opacity, a mask sweep, colour, border colour, the card's scale and the glint's translate
    animate: no blur, filter or shadow. Timings and order are in the stylesheet and its gate
    ([design-system-motion.md](design-system-motion.md)).
  - **Reduced motion** shows the copy still and fades the rest in the same order; the Earth is lit
    at once. **Forced colours** keep the sweep and drop the frost colour.
- **The stars follow the camera** (`lib/sky.ts`): they are the real sky behind the Earth for the
  clock and the camera, so a drag moves them the other way at the Earth's speed, the ambient spin
  carries them, and at rest they turn once a day. They are drawn only when the view moves. A drag
  is the reader's own motion, so reduced motion keeps it; a fly-to snaps. The Sun and the Moon
  are on the same sky: the Moon with its phase, the Sun a near-white core with a glare that the
  contrast and transparency settings drop.
- **Live clocks tick on the second, text only; a reader can pause each one, and reduced motion
  starts it paused** (the PTP "PTP now" readout, the Cutoff Countdown and the
  Expiry Calculator, each with a "Live clock" switch).
- **Height easing through `.gmt-grow`** in tool result regions. Height only: never opacity or
  transform on a value, and never a value the reader is reading.

No boot sequence, no scanlines, no typewriter reveal for chat replies (Streamdown renders
progressive markdown itself).

The Pulse next-run dot (`/pulse/`): one slow dot beside each card's next run, opacity and
`transform` only, in a fixed box. It appears once the mount computes the next run, and it is static
under reduced motion. Nothing else on the page moves.

Everything is gated behind `prefers-reduced-motion`, `prefers-reduced-transparency` and
`prefers-contrast` (`gmt-a11y.css`).

## Layout stability

A tool's result regions fill after the page loads and change as the reader types. Content below
them must not jump.

- **Reserve single-line slots.** A slot that is empty at first keeps one line
  (`:empty::before { content: "\200b" }`), so text arriving later moves nothing.
- **Ease height changes in result regions** with `.gmt-grow` (design-system-widgets.md § Smooth growth).
- **Keep `.gmt-grow` inert without JS.** At rest it is `height: auto`; the wrapper is added at
  runtime, so a reader without JS sees the page as the server rendered it.
- **Keep section 1 unwrapped.** It holds the controls, and their popovers and focus rings must
  not clip.
- **Mark a slot above a draggable surface `data-grow="slot"`,** so a bar does not move under the
  pointer while a result line above it changes height.
- **Readouts hold still while the reader drags.** A card whose value updates under a handle never
  moves or resizes itself or a neighbour. Pin paired cards to opposite edges
  (`justify-content: space-between`), reserve the width of the longest value with tabular figures
  and no wrap, and test that the bounding boxes do not change across the handle's range.
- **A cell whose content comes and goes keeps its size with a hidden sizer.** The sizer has the
  shape of the largest thing the cell can hold and shares one grid cell with the live content,
  so the cell needs no measured height (design-system-charts.md).

## Performance

- The globe renders on the landing page, `/tools/zoned-earth/` and the `/dox` rail only — never
  behind panels.
- Cap blurred surfaces: each `backdrop-filter` re-samples what is behind it every frame.
