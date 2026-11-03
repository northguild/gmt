# Slice 2 · Frameless hero and zone drawer

[Index](./index.md) · Binding rules: [built.md § Tier 4 · Globe](../../built.md#tier-4--globe-and-scrubber),
[built.md § Tier 3](../../built.md#tier-3--hud-chrome), [ui-audit.md](../../ui-audit.md). Reference:
[`proto.css.txt`](./prototype/proto.css.txt), [`proto.js.txt`](./prototype/proto.js.txt) (port the behaviour, not the stand-ins).

## Goal

The frame and brackets go; the hero becomes one full-bleed dark scene for slice 3's sky. On load
the reader sees the copy and the Earth alone; the "Find a zone" drawer comes in when they work the
globe or press the new magnifier. Zooming grows the Earth across the whole hero, never cut by a
straight edge. Other hosts change only by the combobox fix (below). Unchanged: the globe's
rendering, controls and zoom range; `.side`'s contents and behaviour; `HeroCopy`. No date or time picker,
no "moment" panel.

## Layout

**The hero.** `.gmt-herostage` loses `gmt-brackets` and the light-theme `border-image` band. It
spans the full viewport width (`margin-inline` breaks out of the splash container), keeps
`background-color: var(--gmt-void)` so axe reads a real colour, and keeps `gmt-theme-dark` in both
themes. The copy column keeps its place and size; in carousel mode ([slice 7](./s7-carousel.md))
the hero is fixed under the header and the column is `--gmt-copy-col`.

**The globe area** replaces the square stage in space mode: at ≥ 80rem the whole right grid
column, full hero height; below 80rem today's column-wide square plus a **sheet bay** under it,
`block-size: 30rem` (today's list height, so the page below does not move), showing sky until the
sheet rises. `.frame` and `.stage` lose bevel, border, background, `overflow: hidden`, brackets;
the stage is an invisible box for hit area, zoom stack and drawer. **The globe layer:** the canvas
moves into `.globe-layer`, `position: absolute; inset: 0` against `.gmt-herostage`, covering the
hero at every width, unmasked, transparent off the Earth. Stacking, bottom to top: sky (slice 3) →
globe layer → copy scrim → hit area → copy, zoom stack, tooltip → drawer and its close. The globe
layer and the scrim have `pointer-events: none`. **Copy scrim:** `radial-gradient(60% 80% at 0%
50%, rgb(from var(--gmt-void) r g b / .85), transparent 70%)`; below 80rem a top-anchored
`linear-gradient`. Contrast: at maximum zoom.

**Earth position.** The hero's `framing` callback places the disc in the globe area, never under
the drawer. Centre: the area's (≥ 80rem) or the square's above the bay (< 80rem, today's). Radius
at zoom 1: `min(areaW, areaH) / 2 × 0.94`, capped so the 1.06 R atmosphere stays ≥ `1rem` clear
of the copy column (larger than today at 80–100rem). Zoom scales from it as today; the disc may
pass every edge. **Opening or closing the drawer never moves or resizes the Earth.**

## Zone drawer

`renderGlobeTemplate({ space: true })` wraps today's `.side` markup, unchanged, in the new kit
`drawer` (below), `id="${id("drawer")}"`, after the stage, `position: absolute` in the globe area.

- **≥ 80rem, slide-over:** at the area's inline-end edge, full height less `var(--gmt-space-4)`
  top and bottom, `inline-size: clamp(18rem, 24vw, 22rem)`.
- **< 80rem, bottom sheet:** fills the bay, full column width; the Earth stays whole above it.
- **Glass:** `background: rgb(from var(--gmt-void) r g b / .72)`, `backdrop-filter: blur(4px)`,
  a full 1px `--gmt-line` border with the panel radius; no left-border-only accent; no header row.
- **Search label.** The space template passes `field({ …, labelHidden: true })`: the "Find a zone"
  `<label>` stays with `gmt-sr-only`, so the input keeps its name; the placeholder reads "Find
  zone, e.g. Asia/Tokyo". `field` (`layout.ts`) gains `labelHidden?: true` and a test.
- **Suggestions open downward.** The template passes `placement: "below"` for every host; delete
  `EMBEDDED_STACKED` and its listener in `globe-mount.ts` (only `HeroGlobe` set `embedded`). The
  drawer is `container-type: size`; the popup list in it gets `max-block-size: min(16rem, 60cqb)`.

**Opens on** (`GlobeHost.onInteract`): the first drag, wheel or pinch zoom, click or arrow key on
the globe, without moving focus. The + − ⊙ buttons and hover do not open it. **Magnifier:** a new
zoom-stack button after ⊙, so ⓘ stays last: `aria-label="Find a zone"`, `aria-controls` the
drawer, `aria-expanded`. It toggles the drawer; opening by it focuses the search input.

**Close.** An `edgeControl` (below), right-pointing, `aria-label="Close zone list"`, `aria-controls`
the drawer; no corner ×. A sibling just before the drawer, so it never scrolls with the list:
`position: absolute`, centred on the drawer's vertical midpoint (`translate: 0 -50%`),
`inset-inline-end: calc(<drawer inline-size> - .75rem)`, straddling its inline-start edge. Closed:
`visibility: hidden`, untabbable. Open: opacity .55, .95 on hover or focus-visible. On the sheet it
straddles the top edge at its centre, `rotate: 90deg`.

**Closing.** The close and Escape (from the drawer, the magnifier or the hit area; an Escape the
combobox handled, `event.defaultPrevented`, is ignored). Focus returns to the opener. After a
reader's close only the magnifier reopens it for the page view; nothing is stored. **Closed:**
`inert`, then `visibility: hidden` once the exit transition ends; never `display: none` or `hidden`
(the clocks listbox's virtualizer keeps its measured size). Open: a non-modal `role="region"` named
"Zone finder", no focus trap. **Zoom stack:** bottom inline-end corner, shifted clear of the open
slide-over by `transform: translateX(-(drawer inline-size + space-2))`; below 80rem above the bay.

**Motion.** Every open is the prototype's sweep: .9 s, `--ease-sweep`, `--mask-r` with
`translate: 2.5rem 0 → 0` (the sheet: `--mask-b`, from 2.5rem below), border flash to
`--gmt-ice-bright` / .9 at 75%. The close has no keyframes: a .35 s `opacity` and `translate`
transition from 1rem out, delayed .25 s so it lands after the sweep. Closing is a .2 s transition
(drawer) and .25 s (close). Reduced motion: the drawer a .3 s opacity fade, the close opacity only.
**Tab order:** copy (or the open panel and its chevrons), hit area, zoom stack, close, drawer.

## Kit changes

**Combobox popup fix (every combobox).** `combobox.ts` gives its `<gmt-listbox>` only
`styles.list`, never the listbox root class, so every popup (globe search, Zone Planner "Add a
zone") is transparent and unscrolled. `listbox.ts` exports `listboxRootClass` (its module's
`root`: background, border, radius, `overflow-y: auto`); `combobox.ts` adds it beside
`styles.list` (keeps `max-block-size: 16rem` and the shadow). No copy in `combobox.module.css`.

**`drawer`** (`src/widgets/builders/drawer.ts` + `.module.css` + test, in the builders index): APG
[Disclosure](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) with a detached panel (the
`disclosure` builder needs button and panel in one root and uses `hidden`). `drawer({ id, label,
closeLabel, children })` renders the close, then the region. `wireDrawer(panel, { signal, toggle:
HTMLButtonElement, onToggle? })` returns `{ readonly open; open(by: { focus: HTMLElement | null;
returnTo: HTMLElement }); close() }` and owns `aria-expanded`, `inert`, the close, Escape and
focus return. The globe mount owns which interaction may open it.

**`edgeControl`** (`edge-control.ts` + `.module.css` + test): one look for every chevron button,
APG [Button](https://www.w3.org/WAI/ARIA/apg/patterns/button/); the drawer close and slice 7's
chevrons use it, each placement with its own visibility. `edgeControl({ id?, label, direction:
1 | -1, controls?, caption? })`: a `button` with `data-step`, `aria-label`, optional caption
`span`, `aria-hidden` SVG polyline (viewBox 16 × 40, `3,2 13,20 3,38`, mirrored for −1, stroke
1.25, round caps) at .8rem × 2rem. New tokens: `--gmt-ice-bright: #e6f6ff`, `--gmt-frost:
color-mix(in oklab, var(--gmt-ice-bright) 70%, var(--gmt-cyan))` (slice 4's `--ice`, `--frost`).

- **Box.** 1.5rem × 5rem, grid, centred, colour `--gmt-ice-bright`; fill `linear-gradient(180deg,
  ice-bright / .07, ice-bright / .02)`; full 1px border ice-bright / .16; 5px radius plus
  `corner-shape: bevel` (no clip-path fallback); `box-shadow: inset 0 1px 0` white / .08. No glow.
- **Hover and focus-visible.** Colour `--gmt-cyan-bright`, border `--gmt-frost` / .45, fill
  ice-bright / .10 → cyan / .05; the SVG moves 2px along `direction` (`translate`, .25 s).
  Focus-visible adds a 1px cyan / .7 outline, offset 2px. Caption: 12px.

## Engine changes (opt-in: `GlobeOptions` in `types.ts`, TSDoc each, unset = today's behaviour)

- `framing?: (width, height) => { cx; cy; radius }`: `measure()` uses it for `camera.centreX/
  centreY` and `baseScale`. Check that WebGPU reads those, and fix it if it uses `width / 2`.
- `hitArea?: HTMLElement`: pointer, wheel and keyboard bind to it, not the canvas, across a
  renderer swap. On each `camera.radius` change the engine places it over the disc (`transform`
  to `cx − R, cy − R`, size `2R`, clipped to the layer), `border-radius: 50%`, `touch-action:
  none`. Touch and wheel off the disc reach the page (in carousel mode, slice 7's column).
- `maxDpr?: number` (default `MAX_DPR`; the hero passes 1.5); `pauseWhenHidden?: Element` (an
  `IntersectionObserver` stops the frame loop out of view; `destroy()` disconnects it).
- `GlobeEngine.onInteract(cb: (kind: "drag" | "pinch" | "wheel" | "tap" | "key") => void)`, passed
  through by `GlobeHost.onInteract`. It fires when a gesture commits: a move that starts a drag or
  pinch (`controller.pointerMove` returns which, once per gesture), a tap, a zooming wheel, a key.

In space mode the hit area carries `tabindex="0"`, the globe's `aria-label` and the key handlers;
the canvas is `aria-hidden="true"`, untabbable. Focus ring: Tier 3's plus sonar on the hit area. The
tooltip lives in the globe layer, so it lands under the pointer at zoom 1 and maximum. `Globe.astro`
takes a `space` prop; only `HeroGlobe.astro` sets it. **Card clear of the drawer.** `GlobeParts`
gains `tooltipLimit?: () => number | null`: the space mount returns the close's host-relative left
edge − 8 px while the slide-over is open, else `null` (on the sheet the card sits above a pin that
is above the sheet). `positionTooltip` (per frame) takes x from a new exported pure `placeTooltip({
x, width, cardWidth, pad, limit })`: upper clamp `min(width − pad, limit) − cardWidth / 2`; a pin at
or past the drawer's left edge is `occluded`, set as `data-occluded` and hidden by CSS `visibility:
hidden` (the inline opacity and slice 4's rule untouched).

## Constraints and tests

- Other hosts' globe HTML is byte-identical bar the listbox class; WebGPU keeps `alphaMode:
  "premultiplied"` and its transparent clear. `globe-smoke.mjs`: `home` targets the hit area,
  parity cropped to the disc's box. `data-credits-check.mjs`: on `/`, ⓘ is the fifth button.
- `engine.test.ts` / `camera.test.ts`: `framing` sets centre and radius (without it, today's);
  `hitArea` holds the listeners across a renderer swap, a wheel off the disc is not
  `preventDefault`ed, `destroy()` removes every listener and the observer.
- `controller.test.ts` / `engine.test.ts`: `onInteract` fires once per committed drag, pinch,
  zooming wheel, tap and handled key; not on hover, a sub-threshold move, or a wheel at a limit.
- `drawer.test.ts`: `aria-expanded`, `inert` follow state; Escape and the close return focus to
  `returnTo`, a combobox-handled Escape does not; the close precedes and controls the region, and is
  `visibility: hidden` while closed. `edge-control.test.ts`: label, `data-step`, mirrored polyline
  for −1, caption. `combobox.test.ts`: the rendered `gmt-listbox` carries `listboxRootClass`.
- `globe-mount` (space): layer, hit area, drawer closed and inert, magnifier's `aria-controls`;
  `placement` is `below`; a simulated `onInteract` opens it without moving focus, and after a user
  close only the magnifier reopens it, focusing the search input. `globe.test.ts`: `placeTooltip`
  without a limit is today's clamp; with one, the card's right ≤ limit; a pin past it is `occluded`.
- Every test calls `destroy()` or aborts its signal in `afterEach`, with fake timers driving rAF.

## `hero-space` gate (this slice's checks)

`scripts/hero-space-check.mjs`: Playwright, local tier, GPU; in `scripts/gates/registry.mjs`.

- **No frame.** At 1440×900 and 390×844 the stage has no border, background, box-shadow, `overflow:
  hidden` or bracket pseudo-elements; nothing in the hero carries `gmt-brackets`.
- **Position.** At 390, 768, 1280, 1440 and 1920 px the disc centre is within 1 px of the globe area's
  (< 80rem: the square's, also `main`'s within 2 px); at zoom 1 the 1.06 R atmosphere clears the
  copy rect by ≥ 16 px.
- **Drawer.** On load `inert`, invisible, out of the accessibility tree. One drag opens it, focus
  staying on the hit area; the close and Escape close it, and a drag afterwards does not reopen
  it. The magnifier opens it, focusing the search. At 390×844 it is a sheet below the whole disc.
  Open and close leave the hit area's box unchanged (±0.5 px) at both sizes; CLS 0.
- **Close.** At 1440×900 with the drawer open: centre-y equals the drawer's within 1 px; the box
  spans the drawer's left edge (left < edge < right); computed width, height, border colour,
  border radius and background equal the carousel's next chevron's (slice 7). At 390×844 it
  spans the sheet's top edge. Closed, it is `visibility: hidden` and Tab skips it. **Card:** drawer
  open, a zone whose pin sits near its edge: card right ≤ close left − 8 px; pin behind it: hidden.
- **Search.** Accessible name "Find a zone", placeholder "Find zone, e.g. Asia/Tokyo", the label
  the `gmt-sr-only` 1×1 clip. Drawer open, "af" typed, at 1440×900 and 390×844: popup top ≥
  input bottom, popup bottom ≤ drawer bottom. **Combobox popups:** on `/` and `/tools/zone-planner/`
  ("Add a zone"), "a" typed: the open `gmt-listbox` is opaque, `overflow-y: auto`, ≤ 16rem high.
- **Zoom fills the hero.** At 1440×900, 1920×1080, 390×844, maximum zoom: canvas rect = hero rect;
  every sampled hero-edge pixel outside the copy rect is opaque Earth.
- **Readable, narrow, fast.** At maximum zoom `contrast-measure` passes for copy and open drawer;
  at 320–2560 px, `scrollWidth === clientWidth`. Spinning at 1440×900, median frame ≤ 17.5 ms
  over 120; off screen at 390×844, no frame callbacks for 500 ms.
- **Interaction.** Drag, wheel, + − ⊙, arrow keys and click-to-select work; clicking the Earth
  with the drawer open updates the search value and the clocks selection. A wheel on the copy
  never zooms; it scrolls the page, or the About panel in carousel mode.

## Definition of done

- [ ] Index gates, `globe:smoke`, `data-credits-check`, `hero-space` pass. `html-diff`: other hosts'
      globe markup and `/tools/zone-planner/` change only by the listbox root class.
- [ ] Touch emulator, by hand: pinch zooms and opens the sheet; a swipe off the disc scrolls.
- [ ] `built.md` Tier 4 describes space mode, the engine options, `onInteract`, the hit area, the
      drawer and its close; Tier 3 lists `drawer`, `edgeControl`, `field`'s `labelHidden` and the
      combobox popup's shared listbox root class (with a trap line: compose the root class).
