# CORE-109 — Core: Draw the hero's Earth, Sun and Moon from one camera

**Scope:** the Dox home page hero draws the globe and the sky through one pinhole camera at
geostationary distance, so a straight line from a city to the drawn Sun runs along that city's
direction to the Sun. The Moon's position, size and phase are checked as seen from that camera.
Adds no library function. Tracked as #467.

## Gap

The globe is drawn orthographic, as if seen from infinitely far away, and the sky stereographic, as
if seen from about half an Earth radius up. The two agree only at the centre of the disc: near the
edge, a line from a city to the drawn Sun is up to about 28° off. A stereographic sky over a
perspective Earth still errs by 9–15°, so only one lens for both layers is exact.

## Scope

- **One camera.** A pinhole camera 35,786 km above the surface, P ≈ 6.61 Earth radii from the
  centre, for the globe and the sky. The globe keeps its on-screen radius (focal length
  `radius·sqrt(P² − 1)`); zoom narrows the field of view without moving the camera. The visible
  cap reaches acos(1/P) ≈ 81° from the point below the camera.
- **The globe.** Projection and hit testing (`globe/camera.ts`), the WebGPU shaders (per-pixel
  ray–sphere intersection, the atmosphere, the grid lines) and the canvas fallback with its shading
  use the new camera.
- **The sky.** Gnomonic from the camera, with the globe's centre and scale, not the viewport's.
  A Sun or Moon outside the camera's field of view is not drawn.
- **The Moon,** placed, sized and phased as seen from the camera: up to about 6° of parallax and
  about 12% larger when on the camera's side. The bright limb points at the drawn Sun at every zoom
  and rotation. Earthshine and the smallest-disc rule still hold at the new size.

Out of scope: a Dox chat tool, any library function.

## What gmt provides (do not re-implement)

- The hero globe and sky in `apps/dox/src/lib/globe/` and `apps/dox/src/lib/sky-math.ts`
- The hero's visual gates and `apps/dox/scripts/hero-space-check.mjs`

## Verification

- A line from any lit city to the drawn Sun runs along that city's direction to the Sun within 1°,
  at the centre, near the edge and at full zoom.
- Moon position, size, lit fraction and bright-limb angle match JPL Horizons at a set of fixed
  instants, within stated tolerances.
- The hero's visual gates and `hero-space-check` pass with pins updated for the new camera.
- `pnpm run validate` stays green.

## Decisions

1. The camera sits at geostationary distance, the vantage of a weather satellite's full-disc view.
2. The globe and the sky share one gnomonic projection. A stereographic sky was rejected: it still
   bends the city-to-Sun line by 9–15°.
3. Moon values are checked against the Astronomical Almanac or JPL Horizons.
