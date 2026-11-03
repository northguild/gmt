# Slice 3 · Real sky

[Index](./index.md) · Binding rules: [built.md § Tier 4 · Data credits](../../built.md#tier-4--globe-and-scrubber),
[visual-design.md § Motion](../../reference/visual-design.md#motion).

## Goal

Behind the Earth is the real night sky, kept quiet. It has real stars at their real positions
and brightness, the Milky Way along its real path, a barely-there colour wash in two corners,
and now and then one faint meteor. No aurora, no comet, no invented stars. The Earth stays the
centrepiece.

## Source and licence

- **Catalogue.** HYG v4.4 (Hipparcos, Yale Bright Star and Gliese catalogues combined), by
  astronexus, licensed **CC BY-SA 4.0**. Versions before 4.0 were CC BY-SA 2.5; use 4.4 only.
  - Repository: `https://codeberg.org/astronexus/hyg`. Pin commit
    `53e3df311869e813ace5f1ad2ec4ce909f13256c`.
  - File: `data/hyg/CURRENT/hyg_v44.csv.gz`. It is stored in Git LFS: download it from
    `https://codeberg.org/astronexus/hyg/media/commit/<sha>/data/hyg/CURRENT/hyg_v44.csv.gz`
    (13,636,362 bytes, sha256 `00b349893b9a53106dd488d8371e8d2fa586043e500bb3cdb8bff3931682197d`).
    The script refuses any other hash.
- **Not used:** the Yale Bright Star Catalogue 5th edition on its own. It has no published
  licence, and the HEASARC "government works" label covers NASA's derived table, not Yale's
  data.
- **Share-alike.** The generated sky is an adaptation, so it is licensed CC BY-SA 4.0 too. The
  sidecar `src/assets/hero-sky.json` says so: source, commit, hash, licence URL, and that the
  repository's MIT licence does not cover the two images. That follows the ODbL precedent of the boundary
  files ([built.md § Boundary data](../../built.md#tier-4--globe-and-scrubber)).
- **Credit.** Add `NIGHT_SKY: DataCredit` to `src/lib/data-credits.ts`:
  - label "Stars";
  - parts: "HYG v4.4" linked to the pinned commit, ", from Hipparcos, Yale Bright Star and
    Gliese (", then "CC BY-SA 4.0" linked to `https://creativecommons.org/licenses/by-sa/4.0/`,
    then ")."
  - It joins the globe stack's ⓘ popup on `/` only, because the sky is only on `/`. The other
    globe hosts keep their credits.

The raw catalogue is not committed. Like `prepare-*-boundaries.py`, the script is run by hand and
its output is committed.

## Generator: `scripts/prepare-hero-sky.mjs`

It downloads the CSV, checks the hash, filters and projects. It draws two SVG layers in memory
and rasterises each in headless Chromium (Playwright, already a devDependency; no new
dependency), exporting with `canvas.toBlob("image/webp", .85)`. It writes:

- `src/assets/hero-sky-stars.webp`, 3600×2250, transparent, the stars;
- `src/assets/hero-sky-band.webp`, 1200×750, transparent, the Milky Way (the blur hides the
  lower resolution);
- `src/assets/hero-sky.json`, the licence sidecar plus the star count, the magnitude limit, each
  image's byte size, and the projected positions of Betelgeuse, Rigel and Sirius.

All blur, gradients and per-star drawing happen here, at build time. The page only decodes two
images; nothing about the sky is computed on the main thread at load.

Run it by hand with `node scripts/prepare-hero-sky.mjs`.

**Sky region: the winter field around Orion.** Centre RA 6h00m (90°), Dec +5°, north up and east
to the left, as the sky looks from the ground. This field:

- sits on the celestial equator, so people in both hemispheres see it;
- is the best-known naked-eye field (Orion, Sirius, Procyon, Gemini, Taurus);
- carries the faint anticentre arm of the Milky Way. The bright galactic centre would compete with
  the Earth.

**Projection: stereographic,** centred on that point. It is conformal, so constellations keep
their shapes across a wide field. Gnomonic stretches badly past 60° from centre, and
equirectangular bends the shapes.

- Work in a `0 0 2400 1500` box; each image scales it to its own size. Scale so the half-width spans 70° of sky:
  `x = 1200 + k·X`, `y = 750 − k·Y`, with `k = 1200 / (2·tan 35°)`.
- Keep stars that land inside the box.
- The page draws both images with `object-fit: cover`, so the sky covers the hero at any shape.

**Stars.** Magnitude ≤ 5.5 (naked eye under a dark sky), skipping the Sun row (`id 0`).

- Radius in viewBox units: `clamp(0.45, 0.45 + 0.42·(5.5 − mag), 2.4)`.
- Alpha: `clamp(.3, .3 + .14·(5.5 − mag), 1)`.
- Colour from B−V (`ci`): < 0 → `#cfe0ff`; 0–0.5 → `#f2f6ff`; 0.5–1.0 → `#fff4e0`; > 1.0 →
  `#ffd9b0`. Then mix each 60 % toward `--gmt-ice`'s value, so the field is cool and quiet.
- Each star is a `<circle>` in the in-memory stars layer. The stars are static: seen from orbit,
  stars do not twinkle.
- Sirius, the brightest, gets a soft halo: a shared `radialGradient`, r 6, alpha .25.

**Milky Way.** Use the galactic plane from the IAU galactic system in its ICRS form, as published
with the Hipparcos catalogue (ESA 1997, Vol. 1 §1.5.3):

- North galactic pole: RA 192.85948°, Dec +27.12825°.
- Galactic longitude of the north celestial pole: 122.93192°.

Sample b = 0 every 1° of l, convert to RA/Dec, and project it. Draw a path with
`stroke-width` equal to the projected span of b = ±7° at that point (the band's visual width),
stroke `--gmt-ice`'s value at opacity .05, through an `feGaussianBlur` with stdDeviation 28. Add a
second narrower stroke (b = ±3°, opacity .04, blur 14) for a soft core. Peak combined alpha must
stay ≤ .06. It is drawn into the band image only. Name the four constants in the script
with that citation.

Budget: stars ≤ 96 KB, band ≤ 24 KB. If the stars miss it, lower the magnitude limit by 0.1 steps
and record the final limit in the sidecar.

## Page layer: `HeroSpace.astro`

`aria-hidden="true"`, `pointer-events: none`, `position: absolute; inset: 0`, `contain: strict`,
behind the globe layer. It renders two `<img alt="">` layers from Astro's asset imports, band
under stars, each with `decoding="async"` and an explicit size, plus a `<link rel="preload"
as="image">` for each on `/` only. Slice 4's sequencer awaits `img.decode()` on both before `t0`,
and fades them separately.

- **Composition.** Set both images' `object-position` so Orion's belt falls in the gap between the copy and the disc, or above the
  disc, at 1440×900. Record the chosen offset in a comment. The owner judges the composition; no
  gate does.
- **Nebula wash.** Two static gradients on the band layer's wrapper, so they fade with the band:
  - `radial-gradient(45% 55% at 0% 0%, rgb(from var(--gmt-cyan) r g b / .05), transparent 70%)`
  - `radial-gradient(45% 55% at 100% 100%, rgb(from var(--gmt-teal) r g b / .06), transparent 70%)`
- **Copy scrim.** Owned by [slice 2](./s2-hero-space.md#layout): it sits above the globe
  layer, so it also covers a zoomed Earth.
- **From black.** Slice 4 fades the sky in from black on arrival.
- **Media.** `forced-colors: active` hides the layer. `prefers-contrast: more` and
  `prefers-reduced-transparency: reduce` hide the Milky Way and the wash, and keep the stars.

## Meteor: `src/lib/space-fx.ts`

One small `<canvas>` inside `HeroSpace.astro`: DPR 1, `aria-hidden`, absolute fill, no pointer
events.

```ts
export interface SpaceFxOptions {
  canvas: HTMLCanvasElement;
  signal: AbortSignal;        // aborting clears every timer, frame, listener and observer
  avoid: () => DOMRect[];     // copy column, the open zone drawer and the disc's bounding box
  random?: () => number;      // injected for tests
  now?: () => number;         // injected for tests
}
export function mountSpaceFx(options: SpaceFxOptions): void;
```

`HeroGlobe.astro`'s client script calls it after the globe mounts, passing the globe's signal. It
loads with the hero's globe mount chunk only.

- **Rare.** Each wait is `−ln(1 − random()) × 45000` ms, clamped to 20–120 s, one `setTimeout`
  at a time. The first wait gets 8 s added, so no meteor crosses the entrance.
- **Brief and faint.** Life 350–550 ms. A straight streak 70–140 px long, 15–40° below
  horizontal, left or right at random. A 1 px head in `--gmt-ice`; the tail a gradient from alpha
  .45 to 0. Length grows then shrinks over the life.
- **Placement.** It draws start points until the whole path misses every `avoid()` rect, and
  gives up after 8 tries.
- **Frames only while one lives.** Between meteors the canvas is clear and no frame is requested.
- **Never when not seen.** No meteor while `document.hidden`, or while the hero is off screen (an
  `IntersectionObserver` on the hero), or under `prefers-reduced-motion: reduce`. It listens for
  each to change and stops or restarts the timer to match.

## Tests

- `prepare-hero-sky.test.ts`, on the committed sidecar and images:
  - `hero-sky.json` names HYG v4.4, the pinned commit, the hash and CC BY-SA 4.0;
  - each image's byte size matches the sidecar and is within budget; each starts with a WebP
    header of the stated dimensions;
  - Betelgeuse, Rigel and Sirius in the sidecar sit within 2 box units of positions recomputed
    from their J2000 catalogue RA/Dec with the same projection, and inside the box.
- A unit test of the projection and galactic conversion: the north galactic pole maps to b = 90°,
  and RA 266.405°, Dec −28.936° (the galactic centre) maps to l ≈ 0°, b ≈ 0°.
- `space-fx.test.ts` (fake timers, stub 2D context, injected `random`/`now`):
  - with `random` = .5, the first meteor is at about 39.2 s and the next about 31.2 s later;
  - a meteor requests frames only during its life;
  - paths crossing `avoid()` are rejected, and after 8 failures nothing spawns;
  - reduced motion, `document.hidden` and an off-screen hero each stop spawning;
  - aborting the signal clears everything;
  - `afterEach` aborts and restores real timers.
- `data-credits.test.ts`: `NIGHT_SKY` renders its two links.

## Definition of done

- [ ] Index gates pass, plus `globe:smoke`, `data-credits-check` and `hero-space`.
- [ ] `hero-space` adds the sky checks:
  - the landing's credit popup contains "HYG v4.4" and "CC BY-SA 4.0";
  - the sky is two decoded `<img>` layers, and no SVG filter or canvas draws the sky at load;
  - with reduced motion, no animation runs in the hero after the entrance (`document.getAnimations()`
    is empty), and the meteor canvas requests no frame for 10 s;
  - `rg -i 'aurora|comet' apps/dox/src apps/dox/scripts` finds nothing.
- [ ] `built.md` Tier 4 describes the sky, its source and licence, the credit and the meteor
      rules. `visual-design.md` § Motion lists the meteor with its reduced-motion rule.
