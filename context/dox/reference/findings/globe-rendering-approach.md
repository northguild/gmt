# DOX-E1a globe — rendering approach decision

> The spec (`issues/DOX-E.md`, "How should it render?") requires this decision to be
> **made and recorded, not inherited**. This is the record.

**Decision (2026-09-04): `d3-geo` `geoOrthographic`, rendered as SVG through the existing
`@tanstack/charts` `geoShape` pipeline. Not WebGL / three.js.**

## Requirements weighed

Spin + drag · momentum/inertia physics · **Google-Earth-style scroll-wheel zoom** · click
a zone → popup with live local time / offset / DST · **full keyboard path for all of it** ·
day/night terminator · meridian + latitude rings · static fallback under
`prefers-reduced-motion` · **clean degradation where WebGL is unavailable** (hard DoD) ·
pause when tab hidden · `mount(host)` entry point for Tier 6 · **homepage Lighthouse not
meaningfully worse than a reference page** (hard DoD).

## Why d3-geo SVG won

| Factor | d3-geo SVG | WebGL (three.js) |
| --- | --- | --- |
| Keyboard path for zone selection | near-free (SVG DOM focus order + `@tanstack/charts` `focus.navigation` + the zone list) | not free — all selection driven programmatically through the list |
| WebGL-unavailable fallback (hard DoD) | **N/A — it is SVG, always works** | must build a separate fallback → you ship part of the SVG version anyway |
| New JS on the homepage (a route shipping ~0 JS today) | ~35–50 KB gz (d3-geo + topojson-client + `land-110m` + app), lazy-loaded on scroll | ~170–250 KB gz (three subset + controls + app) + optional texture + the fallback |
| Reuse | same `geoShape` / `mountChart` code as `TimezoneMap`; `DOX-C3b` `showGlobe` mounts it like the map | new rendering stack, nothing reused |
| Hit-testing + tooltip | already built in `@tanstack/charts` `focus` config | raycast sphere → lat/lng → nearest zone, built from scratch |
| Aesthetic fit | matches `visual-design.md` "videogame HUD / wireframe / futuristic grid" | photoreal sphere — **explicitly not wanted** (user, 2026-09-04) |
| `@octanejs/*` adapters | n/a | pre-1.0, spec warns against depending on them for this story |

WebGL's one clear advantage is **zoom feel** via `OrbitControls`. The user confirmed
(2026-09-04) the globe should be a **futuristic grid globe, not photoreal**, and that
"zoom" means scroll-wheel enlarge in/out. On an orthographic globe that is
`projection.scale() × factor` bound to the wheel — adequate, and the aesthetic call
removes the main reason to pay WebGL's weight.

## Consequences / implementation notes

- Zoom = a `zoom` scalar in `[1, 5]` multiplying the fitted projection scale; wheel +
  pinch + `+`/`−`/reset buttons (the buttons are the keyboard path) all drive `setZoom`.
  `host` gets `overflow: hidden` so the sphere clips past 1×. Dragging while zoomed pans
  (you are turning a sphere).
- Every path re-projects per frame on drag/zoom. Keep the land mesh at **`land-110m`**;
  coarsen or skip the graticule during an active drag if profiling shows jank on
  low-end mobile. Optional later enhancement: swap to `land-50m` at `zoom ≥ 2.5` for
  crisper coastlines — do **not** build this unless the plain version reads as too coarse
  when enlarged.
- If a future story genuinely needs zoom-into-geography (regional detail, place labels),
  that is a different projection (Mercator + vector tiles) and a different story — not a
  reason to revisit this one.

## When to revisit

Only if: profiling shows the SVG re-projection can't hold 60 fps during drag on a
mid-range phone at 1× zoom even after coarsening, **or** a later story adds a hard
requirement d3-geo demonstrably cannot meet (per-fragment lighting, a texture-mapped
surface, tens of thousands of animated points). Re-verify `@octanejs/*` maturity before
depending on it.
