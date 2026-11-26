# Slice 2b · Zone drawer and kit changes

[Index](./index.md) · Part of [slice 2](./s2-hero-space.md), which has the layout, the engine changes, the tests and the `hero-space` gate.

## Zone drawer

`renderGlobeTemplate({ space: true })` wraps today's `.side` markup, unchanged, in the new kit
`drawer` (Kit changes, below), `id="${id("drawer")}"`, after the stage, `position: absolute` in the globe area.

- **≥ 80rem, slide-over:** at the area's inline-end edge, full height less `var(--gmt-space-4)`
  top and bottom, `inline-size: clamp(18rem, 24vw, 22rem)`.
- **< 80rem, bottom sheet:** fills the bay; the Earth stays whole above it.
- **Glass:** `--drawer-glass` (void at .45), `blur(4px)`, so the Sun shows through; the list adds no
  fill, cards void .55 (AA over white). Full 1px border, panel radius; no left-border-only accent.
- **Search label.** The space template passes `field({ …, labelHidden: true })`: the "Find a zone"
  `<label>` keeps `gmt-sr-only` and the input its name; the placeholder reads "Find zone, e.g.
  Asia/Tokyo". `field` (`layout.ts`) gains `labelHidden?: true` and a test.
- **Suggestions open downward.** The template passes `placement: "below"` for every host; delete
  `EMBEDDED_STACKED` and its listener in `globe-mount.ts` (only `HeroGlobe` set `embedded`). The
  drawer is `container-type: size`; the popup list in it gets `max-block-size: min(16rem, 60cqb)`.

**Opens on** (`GlobeHost.onInteract`): the first drag, wheel or pinch zoom, click or arrow key on
the globe, without moving focus. The + − ⊙ buttons and hover do not open it. **Magnifier:** a zoom-stack
button after ⊙, so ⓘ stays last: `aria-label="Find a zone"`, `aria-controls` the
drawer, `aria-expanded`. It opens the drawer, focusing the search input with its list shut.

**Close.** An `edgeControl` (below), right-pointing, "Close zone list", `aria-controls` the drawer;
no corner ×. A sibling just before the drawer (never scrolls with the list): a tab on the pane at
its vertical midpoint, in the drawer's glass, with no border or bevel on its joining side, lapping
the edge by 1px where the pane's border is masked open for 5rem. Closed: `visibility: hidden`, untabbable.
Open: chevron dimmed, full on hover or focus-visible. On the sheet: top edge, centre, `rotate: 90deg`.

**Closing.** The close and Escape from the drawer or the hit area. With the search list open,
Escape closes the list only (the combobox sets `defaultPrevented`); with it shut, Escape closes
the drawer. Focus inside the drawer goes to the magnifier. After a reader's close only the
magnifier, or a tap on a zone of the Earth, reopens it; nothing is stored. **Closed:** `inert`, then `visibility: hidden` once the exit transition ends; never `display: none` or `hidden`
(the clocks listbox's virtualizer keeps its measured size). Open: a non-modal `role="region"` named
"Zone finder", no focus trap. **Zoom stack:** the hero's bottom inline-end corner, `--gmt-space-4`
in from both edges, clear of the disc. While the drawer is open it is `inert` and `visibility:
hidden` (a token fade, 0 under reduced motion), so it never lies over the globe or the drawer.

**Motion.** Every open slides in (`--gmt-ease-sweep`), then an ice band (`sheen`, .9 s, 24 % peak)
crosses a no-pointer `::after`; the border never changes. The close
fades and slides .35 s from 1rem out, delayed .25 s. Closing: .2 s (drawer), .25 s (close).
Reduced motion: the drawer a .3 s opacity fade, the close opacity only. **Tab order:** copy (or the
open panel and its chevrons), hit area, then the zoom stack, or with the drawer open its close and the drawer.

## Kit changes

**Combobox popup fix (every combobox).** Every popup was transparent and unscrolled: `listbox.ts`
exports `listboxRootClass` (background, border, radius, `overflow-y: auto`) and `combobox.ts` adds
it beside `styles.list` (keeps `max-block-size: 16rem` and the shadow).

**`drawer`** (`src/widgets/builders/drawer.ts` + `.module.css` + test): APG
[Disclosure](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) with a detached panel.
`drawer(o)` renders the close, then the region; `wireDrawer(el, { signal, toggle, onToggle? })`
returns `{ expanded, open(focus?), close() }` and owns `aria-expanded`, `inert`, the close, Escape
and focus return. The globe mount owns which interaction may open it.

**`edgeControl`** (`edge-control.ts` + `.module.css` + test): one look for every chevron, APG
[Button](https://www.w3.org/WAI/ARIA/apg/patterns/button/); the drawer close and slice 7's chevrons
use it. `edgeControl({ id?, label, direction: 1 | -1, controls?, caption? })`: a `button` with
`data-step`, `aria-label`, optional caption `span`, `aria-hidden` SVG polyline (viewBox 16 × 40,
`3,2 13,20 3,38`, mirrored for −1, stroke 1.25, round caps) at .8rem × 2rem. Tokens:
`--gmt-ice-bright: #e6f6ff`, `--gmt-frost: color-mix(in oklab, var(--gmt-ice-bright) 70%, var(--gmt-cyan))`.
Box: 1.5rem × 5rem, ice-bright, 5px radius with `corner-shape: bevel`, no glow; hover and focus-visible
turn it `--gmt-cyan-bright`, brighten the border and fill, and move the SVG 2px along `direction`
(.25 s); focus adds a 1px cyan / .7 outline, offset 2px. Fill, border and hover alphas: `.p-edge` in
[`proto.css.txt`](./prototype/proto.css.txt).
