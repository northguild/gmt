# Slice 3 · Real sky

[Index](./index.md) · Binding rules: [built.md § Tier 4 · Data credits](../../built.md#tier-4--globe-and-scrubber),
[visual-design.md § Motion](../../reference/visual-design.md#motion).

## Goal

Behind the Earth is the real night sky, kept quiet: real stars at their real positions and
brightness, the Milky Way on its real path, a faint wash in two corners, a rare faint meteor. No
aurora, no comet, no invented stars. The Earth stays the centrepiece.

**The real sky, now.** The stars shown are the ones really behind the Earth, from the camera, at
this moment. The camera circles the Earth (the day and night line turns with the ground), so the
stars turn with every camera move, the ambient spin included, at the globe's rate and opposite the
ground. At rest nothing moves. The opening view differs per reader and per moment.

## Source and licence

- **Catalogue.** HYG v4.4 (Hipparcos, Yale Bright Star and Gliese catalogues combined), by
  astronexus, licensed **CC BY-SA 4.0**. Versions before 4.0 were CC BY-SA 2.5; use 4.4 only.
  - Repository: `https://codeberg.org/astronexus/hyg`. Pin commit
    `53e3df311869e813ace5f1ad2ec4ce909f13256c`.
  - File: `data/hyg/CURRENT/hyg_v44.csv.gz`, from Git LFS:
    `https://codeberg.org/astronexus/hyg/media/commit/<sha>/data/hyg/CURRENT/hyg_v44.csv.gz`
    (13,636,362 bytes, sha256 `00b349893b9a53106dd488d8371e8d2fa586043e500bb3cdb8bff3931682197d`).
    The script refuses any other hash.
- **Share-alike.** The star list is an adaptation, so it is licensed CC BY-SA 4.0 too. The sidecar
  `src/assets/hero-sky.json` says so: source, commit, hash, licence URL, and that the repository's
  MIT licence does not cover `hero-sky.bin`. That follows the ODbL precedent of the boundary files
  ([built.md § Boundary data](../../built.md#tier-4--globe-and-scrubber)); `scripts/licences.test.ts`
  covers it the same way.
- **Credit.** `NIGHT_SKY` in `src/lib/data-credits.ts` (built): label "Stars"; "HYG v4.4" linked to
  the pinned commit, ", from Hipparcos, Yale Bright Star and Gliese (", "CC BY-SA 4.0" linked to
  the licence, ")". It joins the globe stack's ⓘ popup in space mode only, so only on `/`.

## Generator: `scripts/prepare-hero-sky.mjs`

Run by hand (`node scripts/prepare-hero-sky.mjs`); the output is committed, the raw catalogue
never. It downloads the CSV to a temporary folder, checks the hash, filters and packs.

- **Filter:** the whole sky, magnitude ≤ 5.5 (naked eye under a dark sky), skipping the Sun
  (`id 0`). Sorted faintest first, so brighter stars paint on top.
- **`src/assets/hero-sky.bin`**, 6 bytes per star, little-endian, no header:
  `uint16` RA as `round(ra° / 360 × 65536) mod 65536`; `int16` Dec as `round(dec° / 90 × 32767)`;
  `uint8` magnitude as `round((mag + 2) × 20)`; `uint8` colour class from B−V (`ci`): 0 below 0,
  1 for 0–0.5, 2 for 0.5–1.0, 3 above 1.0 (a missing `ci` is 1).
- **`src/assets/hero-sky.json`**: the licence fields above, the star count, the magnitude limit,
  the byte size and sha256 of `hero-sky.bin`.
- Budget: `hero-sky.bin` ≤ 24 KB. If it misses, lower the magnitude limit by 0.1 steps and
  record the final limit in the sidecar.

## Sky maths: `src/lib/sky-math.ts`

Pure functions, shared by the page and the tests.

- **Galactic plane:** the IAU galactic system in its ICRS form, as published with the Hipparcos
  catalogue (ESA 1997, Vol. 1 §1.5.3): north galactic pole RA 192.85948°, Dec +27.12825°; galactic
  longitude of the north celestial pole 122.93192°. Named constants with that citation;
  `toGalactic` and `fromGalactic`.
- **Projection: stereographic,** north up, east to the left, as the sky looks from the ground. It
  keeps constellation shapes across a wide field. Work in a `0 0 2400 1500`
  box: `x = 1200 + k·X`, `y = 750 − k·Y`, with `k = 1200 / (2·tan 35°)`, so the half-width spans
  70° of sky. Points more than 100° from the centre return null.
- **Sidereal time.** `siderealDeg(instantMs)`: Greenwich mean sidereal time in degrees, Meeus,
  *Astronomical Algorithms* (2nd ed.), eq. 12.4: `280.46061837 + 360.98564736629·d +
  0.000387933·T² − T³/38710000`, `d` days from J2000.0, `T = d / 36525`, wrapped to [0, 360). It
  takes UTC for UT1; the gap is under a second, under .005°. Reuse `sun.ts`'s epoch constants.
- **View from the camera.** `skyCentre(rotation, instantMs)` returns the direction straight behind
  the Earth. The globe's `rotation [λ, φ]` (d3 convention) puts the camera over longitude −λ,
  latitude −φ, so the point behind is longitude 180° − λ, latitude φ, and
  `RA = wrap360(siderealDeg(instantMs) + 180° − λ)`, `Dec = clamp(φ, −89°, 89°)`. Delete
  `SKY_PARALLAX`, the rest view and its Orion rationale.
- **Placement.** The view's centre sits at the Earth's centre on screen, so the stars straight
  behind it are the ones the disc hides. Scale `max(w / 2400, h / 1500)` times `k`, as today; raise
  the null cut-off from 100° until every hero corner is covered from 390 to 2560 px wide.
  `SKY_ANCHOR` stays only as the centre when the globe failed to mount.

## The camera: no engine change

The sky reads what the engine already exposes: `getRotation()` for the camera, and
`project([−λ, −φ])` for the Earth's centre in the globe host's CSS pixels (offset by the host's
box within the hero). Remove `turned`, `getTurned()` and their tests from the controller, the
engine, `types.ts` and `globe.ts`; other hosts see no change.

## Page layer: `HeroSpace.astro` and `src/styles/gmt-space.css`

`aria-hidden`, no pointer, `position: absolute; inset: 0`, `contain: strict`, under the globe layer
([slice 2 § Layout](./s2-hero-space.md#layout)). **Black until true:** both layers start at
`opacity: 0` in CSS; they show at the hero's `data-sky="ready"` (below), with a .6 s fade that
slice 4 retimes. Bottom to top:

- **Band layer:** a wrapper with the Milky Way `<canvas>` inside. Wash, two static gradients on it:
    `radial-gradient(45% 55% at 0% 0%, rgb(from var(--gmt-cyan) r g b / .05), transparent 70%)` and
    `radial-gradient(45% 55% at 100% 100%, rgb(from var(--gmt-teal) r g b / .06), transparent 70%)`.
  - Backing store a quarter of the hero's CSS size, stretched by CSS. It draws the galactic plane
    every 1° of l: a band of b = ±7° and a core of b = ±3°, each a few strokes of falling width so
    the edges fade, in `--gmt-ice`'s value; alpha .05 band, .04 core, peak ≤ .06. No filters.
- **Stars layer:** a `<canvas>` at `min(devicePixelRatio, 1.5)`.
  - Radius in box units `clamp(0.45, 0.45 + 0.42·(5.5 − mag), 2.4)`, times the cover scale.
  - Alpha `clamp(.3, .3 + .14·(5.5 − mag), 1)`, in steps of .1.
  - Colour by class: `#cfe0ff`, `#f2f6ff`, `#fff4e0`, `#ffd9b0`, each mixed 60 % toward
    `--gmt-ice`'s value (read once). Cool and quiet.
  - One `Path2D` per colour and alpha step, so a draw is at most 32 fills. Sirius gets a soft halo:
    one radial gradient, r 6 box units, alpha .25. Stars do not twinkle: seen from orbit, they don't.
- **Meteor canvas** (below), on top. The landing preloads the star list (`<link rel="preload"
  as="fetch" crossorigin>`), on `/` only.

## Sky drawing: `src/lib/sky.ts`

```ts
export interface SkyOptions {
  stars: HTMLCanvasElement;
  band: HTMLCanvasElement;
  host: HTMLElement;          // the hero; its size sets both canvases
  data: ArrayBuffer;          // hero-sky.bin
  signal: AbortSignal;        // aborting disconnects the observer and cancels a pending frame
}
export interface Sky {
  /** Draw the sky behind the Earth; does nothing if the view centre moved under .01° and the
   *  Earth's screen centre under .5 px since the last draw. */
  view(rotation: readonly [number, number], centre: { x: number; y: number }, instantMs: number): void;
}
export function mountSky(options: SkyOptions): Sky;
```

`HeroGlobe.astro`'s client script fetches the list and, once the globe is mounted and measured,
makes the first draw from `getRotation()`, `project()` and the globe's own clock (`getUnixNow`, the
instant the sun shading uses), without waiting for a globe frame. Only then does it set
`data-sky="ready"` on the hero and resolve `sky.ready`; no draw happens from a guessed view. It
then wires `globe.onFrame` to `sky.view`. It loads with the hero's globe mount chunk only. If the
globe fails to mount, the first draw uses the start rotation at `SKY_ANCHOR`.

- **No animation loop of its own.** It draws on mount, inside the globe's frames when the view
  moved (so on every frame of the ambient spin), and once per resize (a coalesced
  `ResizeObserver`). At rest the stars drift .25° a minute, so one timer chain checks once a minute
  and redraws if the view moved; it stops while hidden or aborted.
- **Cheap per draw.** It decodes the list once into unit vectors; each draw projects them, skips
  stars outside the box, and fills the paths. Median ≤ 2 ms per draw at 1440×900, DPR 1.5. A layer
  hidden by the media rules (`checkVisibility()` false) is not drawn. Each draw counts up
  `data-sky-draws` on the stars canvas.

## Meteor: `src/lib/space-fx.ts` (built)

One small `<canvas>` in `HeroSpace.astro`: DPR 1, absolute fill. `mountSpaceFx({ canvas, signal,
avoid, random?, now? })`, called by the same client script after the globe mounts, with the
globe's signal. `avoid()` returns the copy column, the open zone drawer and the disc's box.

- **Rare.** Each wait is `−ln(1 − random()) × 45000` ms, clamped to 20–120 s, one `setTimeout`
  at a time; the first wait gets 8 s more, so none crosses the entrance.
- **Brief and faint.** 350–550 ms; a straight streak 70–140 px, 15–40° below horizontal, left or
  right; a 1 px `--gmt-ice` head, the tail fading from alpha .45 to 0.
- **Placement** misses every `avoid()` rect, or gives up after 8 tries. **Frames** only while one
  lives. **Never when not seen:** not while `document.hidden`, the hero is off screen, or
  `prefers-reduced-motion: reduce`; it follows each change.

## Media

- `forced-colors: active` hides the whole layer.
- `prefers-contrast: more` and `prefers-reduced-transparency: reduce` hide the band layer (Milky
  Way and wash) and keep the stars.
- `prefers-reduced-motion: reduce`: no meteor, no spin; the stars still follow the camera.

## Tests

- `prepare-hero-sky.test.ts`, on the committed files: the sidecar names HYG v4.4, the pinned
  commit, the catalogue hash, CC BY-SA 4.0 and the MIT exclusion; `hero-sky.bin`'s size is 6 × the
  star count, matches the sidecar and is ≤ 24 KB; its sha256 matches; every record decodes to a
  magnitude ≤ the limit; Betelgeuse, Rigel and Sirius decode within .01° of their J2000 RA/Dec.
- `sky-math.test.ts`: the north galactic pole maps to b = 90°; RA 266.405°, Dec −28.936° (the
  galactic centre) maps to l ≈ 0°, b ≈ 0°; the conversions round-trip; the centre lands mid-box,
  east left, north up; far points return null. `siderealDeg`: Meeus examples 12.a (1987-04-10
  00:00 UT → 197.693195°) and 12.b (19:21:00 UT → 128.7378734°), each within .0001°.
  `skyCentre([0, 0], 12.a)` is RA 17.693195°, Dec 0; `[90, 30]` gives RA 287.693195°, Dec 30;
  Dec clamps at ±89°; RA wraps.
- `sky.test.ts` (stub 2D context and observer, fake timers): one draw on mount; `view` with a
  change under the thresholds draws nothing, a larger one draws once; a later instant alone moves
  the view; the minute check redraws once after the stars drift and stops on abort; a hidden band
  is not drawn; aborting disconnects and cancels. `afterEach` aborts. `space-fx` and
  `data-credits` tests are built.

## Definition of done

- [ ] Index gates pass, plus `globe:smoke`, `data-credits-check` and `hero-space`.
- [ ] `hero-space` adds the sky checks:
  - the landing's credit popup contains "HYG v4.4" and "CC BY-SA 4.0";
  - before `data-sky="ready"` both layers compute `opacity: 0` and `data-sky-draws` is 0; at it,
    one draw, whose `data-sky-view="ra dec instantMs"` matches the globe's rotation (±.05°) and
    whose instant is within 5 s of the page's clock;
  - at rest before the spin, and for 4 s with reduced motion, `data-sky-draws` does not change;
    through 6 s of ambient spin it rises, never more than once per globe frame, the spin's median
    frame stays ≤ 17.5 ms, and the sky's draws a median ≤ 2 ms;
  - a scripted 200 px drag to the right lowers the view's RA by the globe's λ change (±.5°), and
    the brightest star on screen moves left;
  - with reduced motion, no animation runs in the hero after the entrance
    (`document.getAnimations()` is empty), and the meteor canvas requests no frame for 10 s;
  - `space-fx` and the sky (`sky.ts` with `sky-math.ts`) are each ≤ 4 KB min+gzip;
  - `rg -i 'aurora|comet' apps/dox/src apps/dox/scripts` finds nothing.
- [ ] `built.md` Tier 4 describes the sky, its source and licence, the credit, how the view
      follows the camera and the sidereal time, and the meteor rules. `visual-design.md` § Motion
      lists the meteor with its reduced-motion rule and the sky's follow-the-camera rule.
