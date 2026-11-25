# Slice 1 · Moon map and the shared loaders

Part of [DOX-G16](./index.md). Paths are under `apps/dox/`.

## What the reader sees

On `/` and on the deck's stage, the Moon shows its maria and craters once its map has loaded.
The lit part follows the true phase and terminator that `moonFromCamera` already computes; the
face turns with the true libration and the pole's true angle, as the camera sees it. The night
side shows the map faintly by earthshine. Until the map loads, or if it fails, the flat Moon of
today is drawn. The credits list gains a Moon row. Nothing else on the page moves or changes.

## Files

Create:

| File | Layer | Role |
| --- | --- | --- |
| `scripts/prepare-source.mjs` (+ `.test.ts`) | shared | `readPinnedSource({name, url, bytes, sha256, flag})`, `fail(name, message)`: the download, the `--<flag> <file>` override, the size and hash check |
| `scripts/prepare-sky-bodies.mjs` (+ `.test.ts`) | shared | `SOURCES`, one row per body (data); writes each body's WebP and sidecar. Run by hand, refuses any other hash |
| `src/assets/sky-moon.webp`, `src/assets/sky-moon.json` | content | the map and its sidecar, the same fields as `hero-milkyway.json` |
| `src/lib/sky-map.ts` (+ `.test.ts`) | shared | `SkyMap` (the `ImageData` alias moved here), `sampleMap(map, u, v)` |
| `src/lib/sky-bodies.ts` (+ `.test.ts`) | shared | `drawBodies` and the flat painters moved out of `sky.ts`; `SKY_BODIES`; the textured hook and cache |
| `src/lib/body-paint.ts` (+ `.test.ts`) | shared, lazy | `paintLitSphere(map, geometry, out)` |
| `src/lib/body-frame.ts` (+ `.test.ts`) | shared | `moonFrame(instantMs)`: pole and prime-meridian unit vectors, equatorial of date |

Modify:

- `scripts/prepare-hero-milkyway.mjs`, `scripts/prepare-hero-sky.mjs`: drop their own
  `readSource` and `fail`, call `prepare-source.mjs`. Their tests stay green unedited.
- `src/lib/sky.ts`: import from `sky-bodies.ts` and `sky-map.ts`; the band's bilinear lookup
  becomes `sampleMap`. Write `data-sky-maps` on the stars canvas: `flat`, then `ready` or `failed`.
  If `sky.ts` is still over 400 lines, `drawBand` moves to `src/lib/sky-band.ts` too (rule 6).
- `src/lib/sky-math.ts`: export the IAU 1976 precession that `starViewMatrix` applies, as
  `precessToDate(unit, instantMs)`; `starViewMatrix` calls it. No other change.
- `src/lib/space-sky.ts`: `loadSkyMap(src, signal)` from `loadMilkyWay`'s body (fetch,
  `createImageBitmap` with `colorSpaceConversion: "none"`, `getImageData`); the Milky Way calls
  it. `SkyInputs` gains `moonMap?`. After `sky.ready`, `await whenIdle()`, then load the body
  maps and the `body-paint.ts` chunk, then hand both to the sky. Skip all of it when
  `matchMedia("(forced-colors: active)")` matches or the signal is aborted.
- If `hero-space.ts` and `slides/stage-boot.ts` each read the host's `data-*` sky attributes,
  move that read into one `skyInputsOf(host, canvases, signal)` in `space-sky.ts`; both call it.
- `src/components/HeroSpace.astro`, `src/components/slides/Deck.astro`: import
  `sky-moon.webp?url` and set `data-moon-map`. No preload link.
- `src/lib/data-credits.ts`: add `MOON_IMAGERY` and `SKY_CREDITS = [NIGHT_SKY, MILKY_WAY,
  MOON_IMAGERY]`. `globe-mount.ts` lists `[TZ_BOUNDARIES, EARTH_IMAGERY, ...SKY_CREDITS,
  LICENCE_CREDIT]`; `SkyCredits.astro` `[...SKY_CREDITS, EARTH_IMAGERY]`; `Deck.astro`
  `[...SKY_CREDITS, EARTH_IMAGERY, ...credits]`.
- `scripts/sky-size.test.ts`: add `["the body painter", "src/lib/body-paint.ts", 3072]`.
- `scripts/hero-space-check.mjs`: the checks below.

## The map

- Source: SVS CGI Moon Kit `lroc_color_2k.jpg` (see the [asset table](./index.md#asset-sources)).
  Before pinning, the builder reads the SVS page, confirms the file and its credit, and records
  the URL, byte count and sha256 in `SOURCES`.
- Processing: the source's own colour is kept (slice 4's natural look shows it). Resized to
  1024×512 with Lanczos; one gain for all three channels, from the luminance (linearised sRGB,
  Rec. 709 weights) of the 0.1st and 99.9th percentiles, so the hue holds. RGB WebP by sharp at
  quality 80. Budget 80,000 bytes, checked by the script and by its test.
- Convention: equirectangular, longitude −180° at the left edge, 0° at the centre, north up.
  The builder confirms this against the source and the test proves it on the shipped map:
  Tycho's ray centre (43.3° S, 11.2° W) is the brightest point within 3° of that place, and
  Mare Crisium's centre (17.0° N, 59.1° E) is darker than its rim 4° outward on all four sides.

## The Moon's frame

`moonFrame` follows the IAU WGCCRE report (Archinal et al. 2018, Table 2, the Moon: α0, δ0
and W with the E1 to E13 terms) in ICRF, then `precessToDate` turns the pole and the
prime-meridian vector into the equatorial frame of date that `sky-math` uses.

Pinned to JPL Horizons, target 301, `QUANTITIES='14,17'`, `ANG_FORMAT='DEG'`,
`EXTRA_PREC='YES'`, the query string written in the test's comment as the existing pins are:

- Observer 500@399 (geocentre), three instants a week apart: the sub-observer longitude and
  latitude within 0.2°, the north pole position angle within 0.2°.
- Observer: the same geostationary camera site the `moonFromCamera` pins use
  (`sky-math.test.ts`, the 42,164.137 km block), two of its instants: the same tolerances. The
  sub-observer point here is the Moon-to-camera vector in the Moon's frame; the test proves it
  differs from the geocentric one by more than 3° (the camera's parallax), so the camera is used.

## Painting the Moon

`paintLitSphere` is pure and writes RGBA into a caller's `ImageData`. Geometry comes from what
`drawBodies` already has: the disc centre and radius in device pixels, the unit vector toward
the camera, the camera's right and up axes, the Sun's direction, the frame, and the earthshine
level (`0.08 × (1 − lit)`, unchanged).

- For each pixel inside the disc, the sphere normal `n` comes from the orthographic disc
  (the Moon spans under 0.3°). Selenographic longitude and latitude come from `n` in the
  frame; the albedo `a` from `sampleMap`.
- With `μ = n·view` and `μ0 = n·sun`: lit pixels take `a × 2μ0 / (μ0 + μ)` (Lommel–Seeliger,
  the regolith law; 1 at the sub-solar point of a full Moon); pixels with `μ0 ≤ 0` take
  `a × earthshine`.
- Tone: `a` is the map's luminance over its white (the 99.9th percentile), so a full Moon's
  brightest ground is at most 1 and the half Moon is darker than the full one, as the real one
  is. The level is linear light and its sRGB encoding is the alpha, night side included; the
  flat fallback keeps its own tone. This slice paints the default look only: the map's luminance (via a
  256-entry sRGB-to-linear table) tinted to `ICE_TINT`, a new constant in `sky-bodies.ts` equal
  to `MOON_LIT`. Slice 4 adds the natural look. Edge pixels take
  coverage alpha, as the flat disc's anti-aliasing does.
- `sky-bodies.ts` caches the painted disc in an offscreen canvas keyed by radius (0.5 device
  px), sun direction (0.5°), sub-observer point (0.25°) and pole angle (0.5°), and draws it with
  `drawImage` inside the existing clip at the Earth's disc. Repaints only on a key change.
- Below `MIN_BODY`, and whenever no map is ready, the flat path draws, unchanged.

## Tests

- `prepare-source.test.ts`: a pinned file passes; a wrong size or hash calls `fail` with both
  values in the message; the flag reads a local file and makes no fetch (stubbed `fetch`).
- `prepare-sky-bodies.test.ts`: the shipped map's size, byte budget, sidecar hash and fields,
  and the Tycho and Crisium checks above. No network.
- `sky-map.test.ts`: `sampleMap` matches the band's old values at 20 fixed points (record them
  from `main` first), wraps at u = 0 and 1, clamps at the poles.
- `body-frame.test.ts`: the Horizons pins above.
- `body-paint.test.ts` (synthetic maps, no files):
  - a uniform map: the lit-pixel fraction matches `moonFromCamera`'s `lit` within 0.03 at five
    phases (0.05, 0.25, 0.5, 0.75, 0.98);
  - a single bright dot at the sub-observer point lands within 1 px of the disc centre;
  - a dot at the north pole lands on the side the pole angle gives, within 10°;
  - night-side pixels equal the sRGB encoding of `a × earthshine` within 1/255;
  - under 1 % of the lit pixels saturate at phase 0.98 for a map shaped like the real one;
  - a pixel's alpha is the sRGB encoding of its linear level within 1/255.
- `sky-bodies.test.ts`: the flat path's output is byte-identical to `main` for three fixtures
  when no map is set; with a map set, a second draw at the same key repaints nothing (spy on
  the painter); a key change repaints once.
- `space-sky.test.ts`: the body maps start only after `ready` and the idle wait (fake timers,
  stubbed `requestIdleCallback`); no fetch under forced colours; abort before the idle wait
  means no fetch; a 404 or a decode throw leaves `data-sky-maps="failed"` and no throw. Every
  test aborts its controller in `afterEach` and asserts `vi.getTimerCount()` is 0.

## Gate checks (`hero-space`)

- The existing `sky-bodies` checks wait for `data-sky-maps` to leave `flat`, then run unedited.
- `sky-maps-late`: on a fresh load of `/` at 1440×900, the request for `sky-moon` starts after
  the `largest-contentful-paint` entry's `startTime`; no `link[rel=preload]` names it. Under
  `forcedColors: "active"`, no request for it at all.
- `sky-moon-face`: at `SKY_PINS.half` with maps ready, the lit Moon pixels' luminance has a
  standard deviation of at least 10/255 (the flat disc measures under 2/255; record both).
- `sky-maps-fallback`: with `**/sky-moon*.webp` routed to abort, `data-sky-maps="failed"`, the
  `sky-bodies` half-Moon checks pass, and there is no `pageerror` or console error.

## Duplication pass (dox-tester)

- `rg -n "createImageBitmap" apps/dox/src` → one hit, in `space-sky.ts`.
- `rg -n "async function readSource|function fail\(" apps/dox/scripts/prepare-*.mjs` → hits only
  in `prepare-source.mjs`.
- `rg -n "NIGHT_SKY, MILKY_WAY" apps/dox/src` → one hit, in `data-credits.ts`.
- `rg -n "dataset\[\"milkyWay\"\]|dataset\[\"moonMap\"\]" apps/dox/src` → one hit each.
- `rg -n "export function sampleMap" apps/dox/src` → one hit;
  `rg -n "const u0 = Math.floor|const v0 = " apps/dox/src/lib` → hits only in `sky-map.ts`.
- `wc -l` of `sky.ts`, `sky-bodies.ts`, `body-paint.ts`, `body-frame.ts`, `space-sky.ts`: each
  under 400.

## Definition of done

- `pnpm --filter @gmt/dox test -- sky-map sky-bodies body-paint body-frame space-sky prepare-`
  and `scripts/sky-size.test.ts` pass; `pnpm --filter @gmt/dox lint` and `check` are clean.
- `pnpm --filter @gmt/dox gates --only hero-space,data-credits-check` passes, the new checks
  included.
- The duplication pass above returns what it says.
- No `it.skip`, `it.todo` or `it.fails` added.
- **Owner viewing pass**, at his recorded window size, his own clicks, `pnpm dox:dev` already
  running: the deck's "A day off" slide, build 2 (the camera goes to the Moon at the new moon),
  shows the dark Moon's maria by earthshine; `/` shows the textured Moon when it is in view.
  `dox-tester` also hands him the gate's `sky-moon-face` crop at 1× and 4× scale.
- `context/dox/built/tier-4-globe.md` "Night sky": the Moon map, `loadSkyMap`, `sampleMap`,
  `moonFrame`, the lazy painter and cache, `SKY_CREDITS`; one-line reason each.
