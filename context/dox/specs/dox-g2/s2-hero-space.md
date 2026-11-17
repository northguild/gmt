# Slice 2 · Frameless hero and zone drawer

[Index](./index.md) · Binding rules: [Tier 4 · Globe](../../built/tier-4-globe.md),
[Tier 3](../../built/tier-3-chrome.md), [ui-audit.md](../../ui-audit.md). Reference: [`proto.css.txt`](./prototype/proto.css.txt),
[`proto.js.txt`](./prototype/proto.js.txt) (port the behaviour, not the stand-ins).

## Goal

The frame and brackets go; the hero becomes one full-bleed dark scene for slice 3's sky. On load
the reader sees the copy and the Earth alone; the "Find a zone" drawer comes in when they work the
globe or press the new magnifier. Zooming grows the Earth across the whole hero, never cut by a
straight edge. Other hosts change only by the combobox fix ([slice 2b](./s2b-zone-drawer.md#kit-changes)). Unchanged: the globe's rendering, controls and zoom
range; `.side`'s contents and behaviour. No date or time picker, no "moment" panel.

## Layout

**The hero.** `.gmt-herostage` loses `gmt-brackets` and the light-theme `border-image` band. It
spans the full viewport width (`margin-inline` breaks out of the splash container), keeps
`background-color: var(--gmt-void)` so axe reads a real colour, and keeps `gmt-theme-dark` in both
themes. The copy is left-aligned at every width, inset `clamp(1rem, 5vw, 5rem)`; in carousel mode
([slice 7](./s7-carousel.md)) the hero is fixed under the header and the column is `--gmt-copy-col`.

**Hero copy.** `HeroCopy` gains an optional `eyebrow`; the words live in `index.mdx`. Eyebrow
"@northguild/gmt" (.75rem, uppercase by CSS); `h1` "Give Me Temporal", `clamp(1.75rem, 2.8vw,
2.5rem)`, two lines (`max-inline-size: 9em`); lede "The most tested and most precise date and time
library for JavaScript. Typed functions from time zones to transport." (`32rem`); a `36rem` column. Actions: "Get
started" (primary, right arrow) to the docs, "Ask Dox" (the Dox mark, `data-dox-cta`), "Prompt"
(copy icon, `data-copy-prompt`, its `aria-label` naming the whole action). Every copy element is
`--gmt-font-display` (Michroma, then its metric-matched fallback). **First paint is final:** one
`h1` rule, the copy's box from SSR CSS alone, the font loaded from its bytes before first paint, and the globe's mount moves nothing.
**No invisible box over the Earth:** each copy box hugs its content (`fit-content`, `inline-flex` or
`inline-grid`); wrappers are `pointer-events: none`, text and buttons `auto`.

**The globe area** replaces the square stage in space mode: at ≥ 80rem the whole right grid
column, full hero height; below 80rem today's column-wide square plus a **sheet bay** under it,
`block-size: 30rem` (today's list height, so the page below does not move), showing sky until the
sheet rises. `.frame` and `.stage` lose bevel, border, background, `overflow: hidden` and brackets; the stage is
an invisible box for hit area, zoom stack and drawer. **The globe layer:** the canvas
moves into `.globe-layer`, `position: absolute; inset: 0` against `.gmt-herostage`, covering the
hero at every width, unmasked, transparent off the Earth. Stacking, bottom to top: sky (slice 3) →
globe layer → copy scrim → hit area → copy, zoom stack, tooltip → drawer and its close. The globe
layer and the scrim have `pointer-events: none`. **No panel behind the copy:** the scrim paints
only under `prefers-contrast: more` (a left-anchored radial void wash, top-anchored below 80rem);
otherwise the eyebrow, title, tagline and buttons carry a tight dark `--gmt-shadow-halo`. Contrast: 7:1 with the Sun behind the copy.

**Earth position.** The hero's `framing` callback: at ≥ 80rem the disc's centre-x is the viewport's
centre, or the nearest x that keeps the 1.06 R atmosphere ≥ 16 px clear of the copy (never left of
it); centre-y is the globe area's middle; `h` is half its shorter side. Below 80rem, today's square
above the bay. Radius at zoom 1: `min(h × 0.94, (h − 16px) / 1.06)`, shrunk only as far as keeps the
disc 8 px off the zoom stack. Zoom scales from it. **The drawer never moves or resizes the Earth.**

## Zone drawer and kit changes

The drawer, its opening and closing rules, motion, the combobox popup fix and the `drawer` and
`edgeControl` kit builders are in [s2b-zone-drawer.md](./s2b-zone-drawer.md).

## Engine changes (opt-in: `GlobeOptions` in `types.ts`, TSDoc each, unset = today's behaviour)

- `framing?: (width, height) => { cx; cy; radius }` sets `camera.centreX/centreY` and `baseScale`
  in `measure()`, read by both renderers. `maxDpr?` (the hero passes 1.5). `pauseWhenHidden?:
  Element` stops the frame loop out of view; `destroy()` disconnects its observer.
- `hitArea?: HTMLElement`: pointer, wheel and keys bind to it across a renderer swap; the engine
  keeps it over the disc (`cx − R, cy − R`, `2R`, round, `touch-action: none`), so touch and wheel
  off the disc reach the page (in carousel mode, slice 7's column).
- `GlobeEngine.onInteract(cb: (kind: "drag" | "pinch" | "wheel" | "tap" | "key") => void)`, via
  `GlobeHost.onInteract`, fires once when a drag or pinch starts, on a tap, a zooming wheel, a key.

In space mode the hit area carries `tabindex="0"`, the globe's `aria-label`, the key handlers and
the focus ring; the canvas is `aria-hidden`, untabbable. The tooltip lives in the globe layer.
`Globe.astro` takes a `space` prop; only `HeroGlobe.astro` sets it. **Card clear of the drawer.**
`GlobeParts.tooltipLimit?: () => number | null` is the close's left edge − 8 px while the
slide-over is open, else `null`. A pure exported `placeTooltip({ x, width, cardWidth, pad, limit
})` clamps the card's x to `min(width − pad, limit) − cardWidth / 2`; a pin at or past the
drawer's edge is `occluded` (`data-occluded`, CSS `visibility: hidden`).

## Constraints and tests

- Other hosts' globe HTML is byte-identical bar the listbox class; WebGPU keeps `alphaMode:
  "premultiplied"` and its transparent clear. `globe-smoke.mjs`: `home` targets the hit area,
  parity cropped to the disc's box. `data-credits-check.mjs`: on `/`, ⓘ is the fifth button.
- `engine.test.ts` / `camera.test.ts`: `framing` sets centre and radius (without it, today's);
  `hitArea` keeps its listeners across a renderer swap, a wheel off the disc is not
  `preventDefault`ed, `destroy()` removes every listener and the observer.
- `controller.test.ts` / `engine.test.ts`: `onInteract` fires once per committed drag, pinch,
  zooming wheel, tap and handled key; not on hover, a sub-threshold move, or a wheel at a limit.
- `drawer.test.ts`: `aria-expanded` and `inert` follow state; Escape and the close return focus to
  the toggle, a combobox-handled Escape does not; the close precedes and controls the region.
  `edge-control.test.ts`: label, `data-step`, mirrored polyline, caption. `combobox.test.ts`: the
  `gmt-listbox` carries `listboxRootClass`. `layout.test.ts`: `labelHidden`.
- `globe-mount` (space): drawer closed and inert, `placement: "below"`; `onInteract` opens it
  without moving focus, except a tap that picks a zone, which opens it with focus on that zone's
  row; after a reader's close only the magnifier (focusing the search) or such a tap reopens it;
  while open the zoom stack is `inert`. `globe.test.ts`: `placeTooltip` clamps to the limit and
  marks a pin past it `occluded`. Tests abort in `afterEach`; fake timers for rAF.

## `hero-space` gate (this slice's checks)

`scripts/hero-space-check.mjs`: Playwright, local tier, GPU; in `scripts/gates/registry.mjs`.

- **No frame.** At 1440×900 and 390×844 the stage has no border, background, box-shadow, `overflow:
  hidden` or bracket pseudo-elements; nothing in the hero carries `gmt-brackets`.
- **Position.** At 390 and 768 px the centre is within 1 px of the stage's (`main`'s within 2 px); at 1280–3008 px centre-x is
  the viewport's ± 1 px where the copy allows (3008×1692), else the copy-clear x ± 1 px (2560×1440: 1284); at zoom 1 the 1.06 R atmosphere clears the copy rect by
  ≥ 16 px. **Zoom stack:** drawer closed, inside the hero's corner and ≥ 8 px off the disc; drawer
  open, `inert`, `visibility: hidden`, skipped by Tab.
- **Copy.** The eyebrow, `h1`, lede and three action names read as above; every copy element's
  computed `font-family` starts with Michroma. The `h1`'s computed size at first paint equals its
  size at 5 s. Layout-shift total over the first 5 s is 0 at 1440×900, 1920×1080 and 390×844, on
  a cold cache and with the font held back 900 ms; checked on a production build. Beside, between
  and below the copy lines `elementFromPoint` is the hit area or the globe layer, and a drag there
  over the disc rotates the Earth (1334×902, 1440×900, 1920×1080, 390×844).
- **Drawer.** On load `inert`, invisible, out of the accessibility tree. One drag opens it, focus
  staying on the hit area; the close and Escape close it, and a drag afterwards does not reopen
  it. The magnifier opens it, focusing the search. At 390×844 it is a sheet below the whole disc.
  Open and close leave the hit area's box unchanged (±0.5 px) at both sizes; CLS 0.
- **Close.** At 1440×900 with the drawer open: centre-y equals the drawer's within 1 px; its right
  edge laps the drawer's left by 1 px (±0.5); width, height and start-side border equal the
  carousel's next chevron's (slice 7); fill is `--drawer-glass`. At 390×844 it laps the sheet's top
  by 1 px at its centre. Closed, it is `visibility: hidden` and Tab skips it. **Card:** drawer
  open, a zone whose pin sits near its edge: card right ≤ close left − 8 px; pin behind it: hidden.
- **Search.** Name "Find a zone", placeholder "Find zone, e.g. Asia/Tokyo", label `gmt-sr-only`.
  Drawer open, "af" typed, at 1440×900 and 390×844: popup between input bottom and drawer bottom. **Combobox popups:** on `/` and `/tools/zone-planner/`
  ("Add a zone"), "a" typed: the open `gmt-listbox` is opaque, `overflow-y: auto`, ≤ 16rem high.
- **Zoom fills the hero.** At 1440×900, 1920×1080, 390×844, maximum zoom: canvas rect = hero rect;
  hero-edge pixels outside the copy rect are opaque Earth.
- **Readable, narrow, fast.** At maximum zoom `contrast-measure` passes for copy and open drawer;
  at 320–2560 px, `scrollWidth === clientWidth`. Spinning at 1440×900: median frame ≤ 17.5 ms over
  120; off screen at 390×844: no frame callbacks for 500 ms.
- **Interaction.** Drag, wheel, + − ⊙, arrow keys and click-to-select work; a click on the Earth
  with the drawer open updates the search and the clocks. A wheel on the copy text never zooms.

## Definition of done

- [ ] Index gates, `globe:smoke`, `data-credits-check`, `hero-space` pass. `html-diff`: other hosts'
      globe markup and `/tools/zone-planner/` change only by the listbox root class.
- [ ] Touch emulator, by hand: pinch zooms and opens the sheet; a swipe off the disc scrolls.
- [ ] `built/tier-4-globe.md` has space mode, engine options, `onInteract`, hit area, drawer and close;
      Tier 3 `drawer`, `edgeControl`, `labelHidden`, and a trap line: compose `listboxRootClass`.
