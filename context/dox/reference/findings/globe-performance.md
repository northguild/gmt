# DOX-E1a globe — performance verification

> Records the measurements behind `DOX-E.md`'s E1a DoD items (a) bundle isolation,
> (b) tab-hidden pause, (d) homepage Lighthouse "not meaningfully worse" than a
> reference page. Measured 2026-09-09 against a local `astro build && astro preview`
> (production build, no dev-server overhead).

## (a) Bundle isolation — globe/scrubber JS never reaches `/install`

Built `dist/install/index.html`'s referenced `<script>` chunks
(`page.*.js`, `Search.astro_*.js`, `MobileTableOfContents.astro_*.js`,
`TableOfContents.astro_*.js`, `ec.*.js`) were grepped for `d3-geo`, `world-atlas`,
`topojson`, `globe`, `multi-zone-scrubber` — none matched any chunk.

Cross-checked live: `astro preview`, Playwright navigated to `/install/` and read
`browser_network_requests`. The only scripts that loaded were `page`, `Search`,
`MobileTableOfContents`, `TableOfContents`, `starlight-toc`, `preload-helper`,
`ui-core` — no globe/scrubber/d3-geo chunk, confirming the `IntersectionObserver`
lazy-mount on both islands keeps their JS off every page that doesn't render them.

## (b) Tab-hidden pause — rAF and the 1 s clock tick both stop

On `/tools/zoned-earth`, instrumented `window.requestAnimationFrame` to count calls,
then dispatched a synthetic `visibilitychange` with `document.hidden = true` (the same
event `globe.ts`'s `onVisibility` listens for, wired at mount and torn down on
`destroy`):

- rAF count before hiding: climbing steadily (~750/s, the ambient-spin loop).
- rAF count 2 s after hiding: **frozen at the exact value captured at the hide event**
  — zero further calls.
- A clock row's live time text (`tickClocks`, driven by the 1 s `setInterval`) was also
  frozen across the same window — the interval is cleared alongside the rAF loop, not
  just throttled by the browser's own background-tab heuristics.

Confirms `globe.ts`'s `onVisibility` handler (registered at mount, listening for
`visibilitychange`) actually cancels both the animation loop and the clock-tick
interval, rather than relying on browser backgrounding to mask an uncancelled loop.

## (d) Lighthouse — `/` vs `/install`, 3 runs each, median

`npx lighthouse <url> --only-categories=performance --chrome-flags="--headless" --output=json`,
against `astro preview` (production build), 3 runs per page, median reported (not
installed as a project dependency — fetched once via `npx` for this one-off measurement,
consistent with the plan's "no new npm deps" constraint).

| Page       | Perf score | LCP     | TBT   | CLS | Total transfer |
| ---------- | ---------- | ------- | ----- | --- | --------------- |
| `/` (hero) | 1.00       | 1354 ms | 88 ms | 0   | 338 KB          |
| `/install` | 0.99       | 1654 ms | 0 ms  | 0   | 105 KB          |

The homepage's own LCP is actually *lower* than `/install`'s (page-content
differences, not the globe — the globe lazy-mounts after first paint via
`IntersectionObserver` and isn't in the LCP/TBT-critical path for the hero's initial
render). The ~230 KB delta is the globe/scrubber JS + `d3-geo` bundle, loaded only once
the hero scrolls into view. Perf score difference (1.00 → 0.99) is not meaningfully
worse — **DoD (d) passes.**

## Related correction

`globe-rendering-approach.md`'s decision record described the implementation as
"rendered as SVG through the existing `@tanstack/charts` `geoShape` pipeline." That is
stale — the shipped `globe.ts` renders to a `<canvas>` via `d3-geo`'s `geoPath(projection,
ctx)` (canvas-2D context), not SVG, and does not go through `@tanstack/charts` at all.
Corrected in that file; the underlying decision (`d3-geo` `geoOrthographic`, not WebGL)
is unaffected — canvas-2D never requests a WebGL context, so DoD item (c) "degrade
cleanly where WebGL is unavailable" holds by construction, the same as the SVG path
would have.
