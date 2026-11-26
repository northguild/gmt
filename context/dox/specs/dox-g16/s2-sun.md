# Slice 2 · Sun disc

Part of [DOX-G16](./index.md). Paths are under `apps/dox/`. Builds on [slice 1](./s1-moon.md):
every loader, cache and gate hook named there is reused; this slice adds one source row, one
asset, one credit, one `SKY_BODIES` row and one painter.

## What the reader sees

On `/` and on the deck's stage, the Sun's white core becomes a photographed solar disc: brighter
at the centre, darker towards the limb, with the granulation and spots Solar Orbiter's PHI
recorded on 22 March 2023. Solar north points along the Sun's true pole as the camera sees it.
The glare around it is unchanged, and still drops under `prefers-contrast: more` and
`prefers-reduced-transparency`. Until the map loads, or if it fails, today's white core is drawn.
The credits list gains a Sun row that names the date of the image.

## Files

Create:

| File | Layer | Role |
| --- | --- | --- |
| `src/assets/sky-sun.webp`, `src/assets/sky-sun.json` | content | the disc and its sidecar (`license: "CC-BY-SA-3.0-IGO"`, `licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/igo/"`, `observed: "2023-03-22"`) |

Modify:

- `scripts/prepare-sky-bodies.mjs`: the Sun's `SOURCES` row and its disc step (below). The
  body-agnostic parts (read, write WebP, write sidecar, budget) stay shared between the rows.
- `src/lib/body-frame.ts`: `sunPole(instantMs)`, the IAU WGCCRE solar pole (α0 = 286.13°,
  δ0 = 63.87°, ICRF) turned to date with `precessToDate`.
- `src/lib/body-paint.ts`: `paintEmissiveDisc(map, geometry, out)`.
- `src/lib/sky-bodies.ts`: the Sun's `SKY_BODIES` row; the cache key for it is radius and pole
  angle only.
- `src/lib/space-sky.ts`: `SkyInputs` gains `sunMap?`, read by `skyInputsOf`.
- `src/components/HeroSpace.astro`, `src/components/slides/Deck.astro`: `sky-sun.webp?url` as
  `data-sun-map`. No preload link.
- `src/lib/data-credits.ts`: `SUN_IMAGERY`; `SKY_CREDITS = [NIGHT_SKY, MILKY_WAY, SUN_IMAGERY,
  MOON_IMAGERY]`. No list outside `data-credits.ts` changes.
- `scripts/hero-space-check.mjs`: the checks below.

## The disc

- Source: ESA, "PHI's view of the Sun in visible light" ([asset table](./index.md#asset-sources)).
  Before pinning, the builder reads the ESA page and confirms three things: the licence line
  offers CC BY-SA 3.0 IGO, the credit is "ESA & NASA/Solar Orbiter/PHI Team", and the caption or
  the file's metadata says where solar north points in the image. **If any of the three is
  missing, or the file is false-coloured rather than one grey band, stop and report to the main
  session.** Do not guess the orientation and do not switch
  source. Record the full-size file's URL, bytes and sha256 in `SOURCES`.
- Processing: find the disc (threshold at 10 % of the median on-disc level, then the centroid
  and the radius from the area); turn the image so solar north is up, using the angle from the
  caption; crop a square of 1.02 radii around the disc; resize to 256×256 with Lanczos; keep
  the single 617 nm grey band (slice 4's natural look shows it as it is). Divide out the 25
  tiles' vignetting, about 2 %, which shows as a grid: each pixel over its ring's median (the
  limb darkening, kept), median over 0.06 radii with spots and faculae left out (`flattenDisc`).
  Scale the disc's white (its 99.9th percentile) to 255. Pixels outside the disc are 0. WebP
  near-lossless at 60 (lossy WebP's blocks show as a grid on a smooth disc), budget 16,000
  bytes, checked by the script and its test. The sidecar's `changes` lists each step, and the disc's fitted centre and radius
  in source pixels.
- The disc is not limb-corrected: its limb darkening is the real one and is what the reader sees.

## Painting the Sun

`paintEmissiveDisc` is pure and writes RGBA into a caller's `ImageData`:

- Each pixel inside the disc maps to the disc image by its offset from the centre, rotated by
  the pole's screen angle. The angle comes from projecting `sunPole` through the same view the
  sky draws with, so it is the camera's, not a separate model.
- Tone, default look (the owner's decision 3): a map byte over 255 is the share of `ICE_TINT`
  (slice 1), the same ice white the Moon takes, so the map's white is full strength and nothing
  clips. Reads stay two map pixels inside the limb, so the black past it never darkens the edge. Slice 4 adds the natural look. Edge pixels take coverage alpha. The flat
  fallback core stays `SUN_CORE`.
- The glare is drawn as today, from the same centre and radius, after the disc.
- Below `MIN_BODY`, or with no map, the flat core draws, unchanged.

## Tests

- `prepare-sky-bodies.test.ts`, the Sun row: the shipped disc is 256×256 and within budget; its
  sidecar hash, licence and date fields match; the four pixels at 0.98 radii on the axes are
  darker than the centre by at least 25 % (the limb darkening survived); the corners are 0;
  each 16 px block inside 0.85 radii, over its rings' medians, is within 1.5 % of 1 (no tile
  grid); the disc's white is 255. `flattenDisc` takes out a 2 % step and keeps a spot.
- `body-frame.test.ts`, `sunPole`: pinned to JPL Horizons, target 10, observer 500@399,
  `QUANTITIES='17'`, three instants a season apart, the query in the test's comment: the north
  pole position angle within 0.2°.
- `body-paint.test.ts`, `paintEmissiveDisc` with a synthetic map:
  - a uniform disc fills the expected pixel count within 2 %;
  - a dot at the image's top centre lands on the side the pole angle gives, within 10°, at
    pole angles 0°, 90° and 200°;
  - a map byte of 255 paints `ICE_TINT` within 1/255, and 128 paints half of it, unclipped;
  - a uniform disc that is black past the limb paints no covered pixel darker than its centre.
- `sky-bodies.test.ts`: with both maps set, a draw that moves only the Moon repaints the Moon and
  not the Sun (spy on both painters).
- `space-sky.test.ts`: both maps load in one idle wait; one failing leaves the other textured and
  `data-sky-maps="ready"`; both failing leaves `failed`. Same teardown rules as slice 1.

## Gate checks (`hero-space`)

- `sky-maps-late` and `sky-maps-fallback` cover `sky-sun` too (one extra route pattern).
- `sky-sun-face`: at `SKY_PINS.clear` with maps ready, the Sun's luminance at 0.85 radii, on
  the four axes, is below its centre luminance by at least 8/255. Record the flat core's values
  (equal within 2/255) and the textured ones in the check's comment.
- The existing glare checks at `SKY_PINS.rim` run after `data-sky-maps` leaves `flat` and pass
  unedited.

## Duplication pass (dox-tester)

- `rg -n "createImageBitmap" apps/dox/src` → still one hit.
- `rg -n "SUN_IMAGERY" apps/dox/src` → the definition and `SKY_CREDITS` only, both in
  `data-credits.ts` (plus its test).
- `rg -n "fetch\(" apps/dox/scripts/prepare-sky-bodies.mjs` → no hit (downloads go through
  `readPinnedSource`).
- `rg -n "286\.13" apps/dox/src` → one hit, in `body-frame.ts`.
- `rg -n "dataset\[\"sunMap\"\]" apps/dox/src` → one hit.
- `wc -l` of `prepare-sky-bodies.mjs`, `body-paint.ts`, `body-frame.ts`, `sky-bodies.ts`: each
  under 400.

## Definition of done

- `pnpm --filter @gmt/dox test -- body-paint body-frame sky-bodies space-sky prepare-sky-bodies`
  and `scripts/sky-size.test.ts` pass (`body-paint.ts` still within 3,072 bytes);
  `pnpm --filter @gmt/dox lint` and `check` are clean.
- `pnpm --filter @gmt/dox gates --only hero-space,data-credits-check` passes.
- The duplication pass above returns what it says. No `it.skip`, `it.todo` or `it.fails` added.
- **Owner viewing pass**, at his recorded window size, his own clicks: the deck's "Engines
  disagree" slide (the Sun lapse) and `/` when the Sun is in view. `dox-tester` hands him the
  gate's `sky-sun-face` crop at 1× and 4× scale, with and without `prefers-contrast: more`.
- `context/dox/built/tier-4-globe.md` "Night sky": the Sun disc, its source and date, `sunPole`,
  the credits row; one-line reason each.
