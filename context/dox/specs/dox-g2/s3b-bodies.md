# Slice 3b · Sun and Moon

[Index](./index.md) · Builds on [slice 3](./s3-sky.md): the same camera, clock, projection and
stars canvas. Binding rules: [visual-design.md § Motion](../../reference/visual-design.md#motion).

## Goal

Every body in the hero is true for this moment, from the same camera and the same clock. The
Earth's day and night shading is already real ([`globe/sun.ts`](../../../../apps/dox/src/lib/globe/sun.ts)).
This slice adds the two bodies that can show in the sky behind the Earth:

- **The Moon** at its real position, with its real lit phase, at its real angular size.
- **The Sun's glow.** The Sun is in the frame only when it sits behind the Earth or near its
  edge; the rest of the time it is behind the camera. When it is just behind the Earth, its glow
  spills past the edge like a sunrise seen from orbit. When it is in the frame and not hidden, the
  Sun itself shows with its glare.

Both are drawn on slice 3's stars canvas, under the globe layer, so the opaque Earth hides
whatever is behind it. No hiding logic: the occlusion is the layer order. Both turn with the
camera, spin included, and follow slice 3's redraw rules.

## Maths: in `src/lib/sky-math.ts`

Pure functions with cited constants; no data files, no credit needed.

- **Sun:** `sunRaDec(instantMs)`. Reuse the subsolar point: the Sun is overhead there, so its
  `Dec = subsolar.lat` and `RA = wrap360(siderealDeg(instantMs) + subsolar.lng)`.
- **Moon:** `moonRaDec(instantMs)`, the Astronomical Almanac's low-precision formulae for the
  Moon's geocentric ecliptic longitude and latitude (Section D), converted to RA/Dec with the
  mean obliquity `23.439° − 0.013°·T`. Accuracy is about .3°, about 3 px on a 1440 px hero; the
  formulae are stated for 1900–2100, which a page showing "now" stays inside. Copy each
  coefficient from the source, not from memory, and cite it.
- **Phase:** `moonPhase(sun, moon)` returns the lit fraction `(1 + cos i) / 2`, with the phase
  angle `i = 180° − elongation` (the Sun–Moon angle seen from the Earth's centre), plus the
  direction of the bright limb: toward the Sun along the great circle from the Moon.
- **Sizes:** the Sun's and the Moon's true angular radii (.267° and .259° mean; the Moon's from
  its distance when the formulae give it). Projected with the sky's scale, each radius has a floor
  of 2.5 CSS px, so a phase still reads on a phone.

## Drawing: in `src/lib/sky.ts`

- **Moon:** the lit part only, a disc clipped by the terminator ellipse, with the bright limb
  toward the Sun. Fill: `--gmt-ice`'s value at alpha .9. The dark part shows **earthshine**,
  sunlight thrown back by the Earth: a full disc under the lit part, `--gmt-ice`'s value at alpha
  `.08 × (1 − lit)`, so it is strongest near a new Moon (the Earth looks nearly full from there)
  and gone at a full Moon. No halo.
- **Sun:** one radial gradient at the Sun's projected point. The core is the true disc, white at
  alpha 1; the glare fades to 0 at 90 CSS px from alpha .35, in `--gmt-ice`'s value. Drawn under
  the globe, so when the Sun is behind the Earth only the glare past the edge shows, and it grows
  as the Sun nears the edge. Skip it when the Sun's point lies more than 90 px inside the disc.
- Both are drawn in the same draw as the stars, after them, within slice 3's ≤ 2 ms median.
- `data-sky-bodies="sunX sunY moonX moonY lit"` on the stars canvas, in CSS px within the hero,
  from the last draw.
- **Media:** `forced-colors` hides them with the layer. `prefers-contrast: more` and
  `prefers-reduced-transparency: reduce` drop the Sun's glare and keep its core and the Moon.
  Reduced motion changes nothing: they follow the camera like the stars.

## Tests

- `sky-math.test.ts`:
  - `moonRaDec`: Meeus, *Astronomical Algorithms* example 47.a (1992-04-12 0h TD: RA 134.688470°,
    Dec 13.768368°), within .5°;
  - `sunRaDec`: example 25.a (1992-10-13 0h TD: RA 198.38083°, Dec −7.78507°), within .2°;
  - `moonPhase`: example 48.a (1992-04-12 0h TD: lit fraction .6786), within .02. A new Moon gives
    a lit fraction near 0 and a full Moon near 1; the bright limb points toward the Sun.
- `sky.test.ts` (stub 2D context): the Moon and the Sun are drawn after the stars in the same
  draw; the earthshine alpha is `.08 × (1 − lit)` (.08 at a new Moon, 0 at a full Moon); the Sun
  is skipped deep inside the disc; a radius never drops below 2.5 px;
  `prefers-contrast: more` drops the glare.

## Definition of done

- [ ] Index gates pass, plus `hero-space` with these checks. Each one pins Playwright's clock and
      the time zone, at instants chosen with `sky-math` so each case is on screen:
  - the Moon: a pixel at `data-sky-bodies`'s Moon point is lit on its bright-limb side and dark
    on the other at a half Moon;
  - the Sun just behind the Earth: lit pixels in a ring outside the disc's edge on the Sun's side,
    none on the far side; the Sun in the frame and not hidden: its core pixel is near white;
  - `contrast-measure` passes on `/`, and the hero gate walks the Sun behind every copy line at default motion: 7:1;
  - the sky module (`sky.ts` with `sky-math.ts`) stays ≤ 5 KB min+gzip.
- [ ] `built.md` Tier 4 describes the Sun and Moon, their formulae and sources, and the media
      rules. `visual-design.md` § Motion lists them with the stars' follow-the-camera rule.
