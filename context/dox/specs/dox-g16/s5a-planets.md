# Slice 5a · Planets, the one body registry, and Look at for every body

Part of [DOX-G16](./index.md). Paths are under `apps/dox/`. Builds on slices 1–3 (`body-frame.ts`,
the lazy loader in `space-sky.ts`, `sky-aim.ts`, `sky-view.ts`) and the shipped stars
(`built/tier-4-globe.md`, Night sky). [5b](./s5b-small-bodies.md) and [5c](./s5c-apophis.md) add
rows to the same registry, layer, generator and Look at bar.

## What the reader sees

The planets join the stars on the hero and the deck's stage: Mercury, Venus, Mars, Jupiter,
Saturn, and Uranus on the nights it reaches magnitude 5.5 (first on 2033-12-05). Each is a point
at its true place for the instant and the camera, at its true magnitude, drawn by the stars' own
law: Venus is the brightest point in the sky, its halo wider than Sirius's. A planet behind the
Earth's disc or the Moon does not show; the Sun's disc covers one behind it. The zoom stack's
**Look at** bar (slice 3) lists every registry body, in the registry's order (the Sun, the Moon,
then the planets outward from the Sun); a planet not drawn now is unavailable, and picking one
that is drawn aims the camera exactly as the Sun and the Moon do (decision 9). First paint is unchanged.

## Decided

- **(a) Which bodies: the stars' faint limit.** `prepare-hero-sky.mjs` cuts the catalogue at 5.5
  (`START_LIMIT`). A body enters when its brightest magnitude over the generator's span is 5.5 or
  brighter, and is drawn (and can be chosen) at an instant when its magnitude from the camera then is.
  Measured with Horizons: Uranus peaks at 5.38 (2054-03-29), in; Neptune at 7.67, out. The
  generator applies the rule; a test keeps the registry's point rows equal to its output.
- **(b) Positions: truncated VSOP87B** (IMCCE, Bretagnon and Francou 1988,
  [files](https://ftp.imcce.fr/pub/ephem/planets/vsop87/)); no IAU or IERS body publishes a
  compact series. JPL's approximate elements (national peer) are rejected: 400″ off for Jupiter,
  600″ for Saturn (1 px ≈ 84″ at 1440×900). A term is kept when its amplitude times the span's
  reach in millennia to its power passes ε (4e-6 Earth, 2e-5 the rest): about 316 terms, every
  body within 30″ of the full series (Mercury 9.5″ … Mars 28.8″), about 0.36 px.
- **(c) The span rolls:** the run instant ± 200 years, from gmt's clock; the JSON records the span
  and each body's measured worst error. No constant that ages.
- **(d) Frame:** astrometric, as Horizons QUANTITIES 1: one light-time step, no aberration or
  nutation, J2000 equator, then `precessToDate` and the camera's offset. Instants as TDB; the 69 s
  moves Mercury under 0.2 px. (5c's close body converts; see there.)
- **(e) Magnitudes: Mallama and Hilton 2018** (Astronomy and Computing 25), the Almanac's laws.
  Saturn's rings and Uranus's sub-latitude read the pole through `bodyFrame`.
- **(f) Look: the stars' law and class colour**, B−V from Mallama, Krobusek and Pavlov 2017, mixed
  `ICE_MIX` toward the tint. Halo reach `6 · dots · 10^(0.1 · (SIRIUS − mag))`, `SIRIUS` the
  decoded −1.45: Sirius unchanged to the byte, Venus at −4.5 about twice as far.
- **(g) One registry: `SKY_BODIES`, moved and extended.** It moves from `space-sky.ts` to its own
  module `src/lib/sky-registry.ts`, keeping its name, and absorbs slice 3's `AIM_BODIES`
  (`sky-aim.ts`) and `SKY_VIEWS` (`sky-view.ts`), both deleted. One row per body:
  `{id, name, kind: "disc" | "point", place, reach, map?, make?, view?}`, where `place(instantMs,
  rotation?)` is slice 3's `raDec`, `view` is `{label, icon}` for a body with its own button,
  and `SkyBodyId` is the union of the ids. Columns too heavy for the eager chunk live beside it,
  keyed by its ids and typed `satisfies Partial<Record<SkyBodyId, …>>`, so a stray key fails the
  type check: the WGCCRE rotations in `body-rotation.ts` (one named export per body, so a painter
  chunk imports only its own), the laws in `magnitude.ts`, the series in `sky-orbits.json`. A point
  row's `place` reads the ephemeris the lazy layer provides (`providePoints`), null until then.
  `sky-aim.ts`'s `SUN_GLARE_RADII` goes: `sky-bodies.ts` exports `GLARE_RADII`.
- **(h) Planetary times are prepared, not built.** `bodyFrame` computes any rotation's pole and
  prime meridian and replaces `moonFrame` and slice 2's `sunPole`; future `packages/gmt` work reads
  the data and maths through the library pipeline.
- **(i) Credit:** one `SKY_CREDITS` data row, "Planet positions: VSOP87, Bretagnon and Francou,
  IMCCE." If IMCCE's page forbids shipping derived coefficients, stop and report.

## Look at grows (kit pieces only)

- **Markup.** None new: slice 3's disclosure and bar, one button per `SKY_BODIES` row. No kit
  change.
- **Rows.** Fixed, in the registry's order: a planet's button is its astronomical symbol and its
  name, and no number (a magnitude means nothing to most readers). On open, a point row not in
  `points.drawn(now(), rotation)` (V ≤ 5.5 from the camera now, on screen or not) is
  `aria-disabled` with "Venus: too faint to see now" in its `title`; a disabled button does
  nothing. A held point that drops below 5.5 is released.
- **Keyboard.** Kit disclosure behaviour, unchanged (slice 3); Tab walks the bar.
- **Choosing** a point calls the view's own `choose(id)`: same aim, hold, drift check and release
  rules, no new aim code. Choosing the held body releases.
- **Loading.** Before the layer loads, every planet's button is `aria-disabled` with "Venus: the
  planets are still loading" in its `title`.
- **Still while it works.** Opening, choosing and holding never move or resize the zoom stack's
  controls; the rows never come and go, so the bar never jumps.

## Files

Create: `src/lib/sky-registry.ts` (+ test; `SKY_BODIES`, `SkyBodyId`, `providePoints`,
`pointSource`); `src/lib/body-rotation.ts` (WGCCRE rows, one export per body);
`src/lib/ephemeris.ts` (+ test; `vsopPosition`, `bodyFromCamera(id, instantMs, camera) → {unit,
delta, r, phase} | null`); `src/lib/magnitude.ts` (+ test); `src/lib/sky-planets.ts` (+ test,
lazy chunk; `createPlanetLayer(): SkyLayer & PointSource`, writes `data-sky-planets`);
`scripts/prepare-sky-orbits.ts` (+ test; reads the eight VSOP87B files through
`readPinnedSource`, truncates by measurement, selects by (a) with the runtime laws from
`src/lib`); `src/assets/sky-orbits.json` (generated, with its sidecar); `scripts/lib/sky-planet-pins.json`.

Modify:

- `space-sky.ts`: `SKY_BODIES` leaves; `loadBodyMaps` reads the registry rows with `map`, loads
  `./sky-planets` in the same `sky.ready` + `whenIdle()` wait (whatever the maps do; never under
  forced colours or after abort), calls `sky.maps(painters, layer)` and `providePoints(layer)`,
  and `providePoints(null)` on abort.
- `sky-aim.ts`: `AIM_BODIES` and `SUN_GLARE_RADII` go; `place` and `boxRadius` read the row;
  a point row's box is `POINT_BOX` px, covering Venus's halo at its brightest.
- `sky-view.ts`: `SKY_VIEWS` goes; the bar is the registry's rows; on open it marks the point
  rows not drawn now `aria-disabled`; `choose` takes any `SkyBodyId`. Under 400 lines.
- `sky.ts`: `maps(painters, layer?)`; `layer?.(starsCtx, lens, m, frame, rotation, instantMs,
  tint)` runs between `drawStars` and `drawBodies`, inside the Earth clip, before the Moon's erase.
- `sky-bodies.ts`: the `SkyLayer` type; exports `GLARE_RADII`; `BodyPainters` keyed by registry ids.
- `sky-stars.ts`: exports `FAINT`, `dotRadius`, `dotStep`, `haloReach`, `classColour`; same pixels.
- `sky-math.ts`: `cameraAt(rotation, instantMs) → Vec3` and `AU`; `moonFromCamera` calls it (393 lines).
- `body-frame.ts`: `bodyFrame(rotation, instantMs)` replaces `moonFrame` and `sunPole`; `daysFromJ2000`.
- `body-paint.ts`, `sun-paint.ts`: `bodyFrame(MOON_ROTATION, …)`, `bodyFrame(SUN_ROTATION, …)`.
- `widgets/tools/sky-look.module.css`: the disabled row's look.
- `scripts/prepare-sky-bodies.mjs`: its comment names `sky-registry.ts`.
- `data-credits.ts`: the VSOP87 row. `scripts/hero-space-check.mjs`: the pins and checks below.
- `scripts/sky-size.test.ts`: `sky.ts` to its measure after the hook rounded up to 32 B, at most
  5,248 (owner's approval; over it, stop); rows `["the Sun painter", "src/lib/sun-paint.ts", 2560]`
  (kept if slice 2 lands it) and `["the planets", "src/lib/sky-planets.ts", 7168]`.

## Tests

Pins from JPL Horizons, each query in the test comment, instants as epoch-ms literals; camera site
`CENTER='coord@399' COORD_TYPE='CYLINDRICAL'` from `cameraAt`.

- `ephemeris.test.ts`: per planet, six instants over 2026–2029 and the span's ends: unit within
  45″ of QUANTITIES 1 from the camera site, Δ within 0.02 % of QUANTITIES 20; Venus at its closest
  matches both a geocentric and a camera pin.
- `magnitude.test.ts`: each law against QUANTITIES 9 within 0.05 mag, plus the paper's worked
  examples; a gap over 0.1 is a stop and report, never a looser tolerance.
- `body-frame.test.ts`: the Moon and Sun pins pass unchanged; each planet's sub-camera point
  within 0.1° of QUANTITIES 14.
- `sky-registry.test.ts`: ids unique; every `body-rotation`, `magnitude` and JSON key is an id;
  the point rows equal the JSON's bodies; `place` of a point row is null before `providePoints`.
- `sky-planets.test.ts`: V 5.6 not drawn, 5.4 drawn; inside the disc listed `earth`; the dataset
  format; `drawn()` returns exactly the bodies at 5.5 or brighter; the pins' screen points equal
  `skyToScreen` of their Horizons RA/Dec at 1440×900 within 0.1 px.
- `sky-view.test.ts` (jsdom, fake source, fake timers): the bar is every registry row in its
  order; before the layer every planet is `aria-disabled` with the loading reason, after it only
  those not drawn, with the faint reason; a disabled button does nothing; a held point that drops
  below 5.5 is released; abort removes every listener.
- `sky-aim.test.ts` and `sky-view.test.ts`: slice 3's cases pass through the registry; a point
  row aims within 2 px, its box clear of the avoid rectangles.
- `sky-stars`, `sky`, `space-sky`, `prepare-sky-orbits`: same pixels per byte magnitude; the
  layer's order and clip; loading rules; truncation and the 5.5/5.51 selection.
- Lifetimes: `afterEach` aborts each mount and calls `providePoints(null)`; `vi.getTimerCount()` 0.

## Gate checks (`hero-space`)

- `planets-place`: 2028-11-09 in Nairobi (Venus and Jupiter 1.2° apart, 32° from the Sun), 1440×900,
  dark; both within 1.5 px of the pins, V within 0.1. `planets-behind`: the same day, both inside
  the disc, listed `earth`, alpha 0 within 3 px. `planets-bright`: Venus's halo outshines Sirius's.
  `planets-late`: no `data-sky-planets` on the first frame, set after the idle load, never under
  forced colours.
- `sky-view-planet`: at the `planets-place` instant open Look at: the Sun, the Moon, Mercury,
  Venus, Mars, Jupiter, Saturn, Uranus; Venus and Jupiter are available; choose Jupiter by
  keyboard; it lands within 2 px of the aim's target and holds after
  `page.clock.runFor(5_000)`; Escape returns focus. `sky-view-still`: the zoom stack's controls
  and the open bar's box match within 0.5 px before and after the layer loads, and holding.

## Duplication pass (dox-tester)

- `rg -n "AIM_BODIES|SKY_VIEWS|SOLAR_BODIES|SUN_GLARE_RADII|moonFrame|sunPole" apps/dox` → no hit.
- `rg -n "id: \"(sun|moon|venus)\"" apps/dox/src --glob '!*.test.ts'` → only `sky-registry.ts`:
  a second table of bodies is a defect.
- `rg -n "0\.45 \+ 0\.42|0\.3 \+ 0\.14" apps/dox/src` → one hit each, `sky-stars.ts`.
- `rg -n "mercury|venus|jupiter|saturn" -i apps/dox/src/lib --glob '!sky-registry*' --glob '!body-rotation*' --glob '!magnitude*' --glob '!*.test.ts'` → no hit.
- `rg -n "role=\"(listbox|option)\"|aria-expanded" apps/dox/src/lib/sky-view.ts` → no hit: the kit renders the disclosure.
- `wc -l` of every touched file under 400.

## Definition of done

- `pnpm --filter @gmt/dox test -- sky-registry ephemeris magnitude body-frame body-paint sun-paint sky-planets sky-aim sky-view sky-stars sky space-sky prepare-sky-orbits sky-size`
  passes; `lint` and `check` clean; `sky-size` records each measure in its comment.
- `pnpm --filter @gmt/dox gates --only hero-space,data-credits-check,esc-cascade,readout-still`
  passes. No `it.skip`, `it.todo` or `it.fails`. Any chunk over its cap: stop.
- **Owner viewing pass**, his window size, his clicks: on `/`, find Venus and Jupiter and compare
  with a planetarium; Venus outshines Sirius; a planet vanishes behind the limb; open Look at,
  choose Saturn by mouse and Mars by keyboard; Escape; the deck's stage shows them.
- Close-out: `built/tier-4-globe.md` "Night sky" and "Controls and drawer": the planets, the rule,
  VSOP87 and its span, `SKY_BODIES` as the one registry and its lazy columns, `bodyFrame`, the
  layer hook, Look at with the planets, the caps and checks, one-line reason each; the generator's runbook.
