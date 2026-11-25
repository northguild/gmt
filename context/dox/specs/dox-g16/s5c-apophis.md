# Slice 5c · Apophis's 2029 pass

Part of [DOX-G16](./index.md). Paths are under `apps/dox/`. Builds on [5a](./s5a-planets.md)
(registry, layer, generator, Look at) and [5b](./s5b-small-bodies.md) (`hgMagnitude`,
`sky-orbits-fresh`). It is a slice of its own because a body inside the camera's orbit needs a
third source, positions from the camera rather than the geocentre, and drawing in front of the
Earth.

## What the reader sees

On 13 April 2029, for the hours around its closest approach (21:46 UTC, 38,011 km from the
Earth's centre, inside the camera's 42,164 km orbit; JPL close-approach data, solution 220),
99942 Apophis shows as a point moving across the stars, by the planets' law and look. Seen from
the geocentre it brightens from 5.75 at 12:00 UTC to 3.19 at 21:00 (Horizons); from the camera it
can be far brighter, as the camera can sit within one Earth radius of it. It hides behind the
Earth, and passes in front of the Earth, the Moon and the Sun when it is nearer than they are.
While it is at 5.5 or brighter, Look at lists it, and choosing it aims and holds the camera
as for any body. Outside the pass nothing changes.

## Decided

- **(a) Which passes: 5a's rule, generically.** The generator asks JPL's close-approach API
  (`https://ssd-api.jpl.nasa.gov/cad.api`) for Earth approaches within 0.002 au, from its run
  instant (gmt's clock) to 3,650 days later. For each, the brightest the body could be from any
  camera point is H + 5 log10(r · Δmin), Δmin = max(|d − 42,164 km|, 1,000 km), phase 0; an
  approach enters when that reaches 5.5. Its window is every instant where the bound is 6.0 or
  brighter (0.5 margin), plus 30 minutes each side. Today that is Apophis alone. No hand-kept
  list, no date in code: a test keeps the registry's rows equal to the JSON's passes.
- **(b) Source, under the authority order.** The orbit is JPL's Small-Body Database solution
  (today JPL#220: epoch 2021-01-01.0 TDB, solved 2024-06-25, 7,370 observations, with a
  Yarkovsky term), labelled as a **national peer** (NASA JPL). The IAU Minor Planet Center
  (international) publishes elements for Apophis but no ephemeris through an encounter at six
  Earth radii, where the Earth bends the path by tens of degrees; using its elements would need
  an n-body integrator here and a planetary ephemeris that is itself national (JPL DE or IMCCE
  INPOP). So positions are JPL Horizons' integration of that solution. The JSON records the
  solution id, epoch and date, each query, and H 19.09 and G 0.24 from the same record.
- **(c) Positions: tabulated geocentric state vectors.** Horizons `EPHEM_TYPE=VECTORS`,
  `CENTER='500@399'`, `REF_PLANE=FRAME`, `VEC_TABLE=2`, `OUT_UNITS=KM-S`, `VEC_CORR=NONE`,
  `TIME_TYPE=UT`, 10-minute steps over the window; cubic Hermite between rows (position and
  velocity). UT rows put Horizons' leap-second table in the data, not a constant in code: 5a's
  TDB shortcut fails here, as 69 s is about 500 km at 7.4 km/s. One light-time step `p − v·Δ/c`.
  API answers carry a timestamp, so they are not sha-pinned: the sidecar records the queries and
  solution, and the generator's test runs on recorded answers in `scripts/fixtures/sky-orbits/`.
- **(d) From the camera, never the geocentre.** Rows are ICRF J2000; `precessToDate`, then minus
  `cameraAt(rotation, instantMs)` in km: direction, Δ and phase angle all from the camera, the
  Sun from Earth's VSOP87 vector plus the geocentric row. Parallax between the geocentre and the
  camera reaches tens of degrees near closest approach. V is 5b's `hgMagnitude`; at one Earth
  radius from the camera it is about four magnitudes brighter than from the geocentre, and the
  stars' halo law applies unchanged.
- **(e) Behind the camera.** `projectDirection` returns false for a direction behind the image
  plane (`pinhole.ts`); the layer lists the body `behind` and does not draw it. Look at still
  lists it by V, and the aim turns the camera to it.
- **(f) The Earth, the Moon and the Sun: occlusion by geometry.** `earthCover(camera, body)`
  answers `behind` when the camera's ray meets the Earth's sphere before the body (not drawn,
  listed `earth`), `front` when the body is inside the disc but nearer than the near surface, else
  null. A body nearer the camera than the Moon draws on a new **near canvas** above the globe
  (`<canvas data-sky-canvas="near" aria-hidden="true">`, `pointer-events: none`, below the scrim
  and copy), over the Earth, the Moon and the Sun; any other body draws as in 5a. Planets are never
  nearer than the Moon, so no branch names a body. The layer sizes the near canvas to the stars
  canvas on each draw, so `sky.ts` gains no bytes.
- **(g) When drawn:** only inside a window, then by the 5.5 rule from the camera. Outside, `place`
  and `bodyFromCamera` return null and `drawn()` omits it.
- **(h) Freshness: 5b's `sky-orbits-fresh`, two more rules.** Weekly tier only: it fails when
  SBDB's current solution id for a tabulated body (`https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=<id>`)
  differs from the recorded one, and when a shipped window has ended. Its message names the
  runbook (re-run the generator). The pull-request tier reads neither the date nor the network.
- **(i) In Look at** Apophis is one more point row, `{id: "apophis", name: "Apophis"}`, sorted
  by V with the planets, so near closest approach it can head the list. Its `place(instantMs,
  rotation)` is camera-centred, so slice 3's Newton solve handles the parallax as it does for the
  Moon; its box is `POINT_BOX`; the 9 px drift check re-aims as it moves.
- **(j) Credit:** `SKY_CREDITS` gains "Close-approach positions: NASA JPL Small-Body Database and
  Horizons.", present exactly while the JSON ships a pass (a test holds the two together).

## Files

Create:

| File | Layer | Role |
| --- | --- | --- |
| `src/lib/pass-table.ts` (+ `.test.ts`) | shared | `tableState(pass, instantMs) → {p, v} \| null`: cubic Hermite in km and km/s, null outside the window |
| `scripts/fixtures/sky-orbits/` | data | recorded CAD, SBDB and Horizons answers for the generator's and the gate's tests |
| `scripts/sky-at.mjs` | shared, dev | opens a headed Chromium on the dev server at a given ISO instant (parsed with gmt) and window size, `page.clock.install`, and leaves it for the owner's clicks |

Modify:

- `scripts/prepare-sky-orbits.ts` (+ test): the CAD, SBDB and Horizons queries; rule (a); writes
  `passes: {<id>: {solution, h, g, startMs, stepMs, rows}}`; the planets and Vesta unchanged.
- `src/assets/sky-orbits.json`: regenerated.
- `src/lib/sky-registry.ts`: the Apophis row (`kind: "point"`, colour class 1, no B−V published).
- `src/lib/ephemeris.ts`: the `table` kind through `tableState`; the camera subtraction in km;
  `earthCover`. Stays under 400 lines.
- `src/lib/sky-planets.ts`: `createPlanetLayer({near})`; draws `front` and nearer-than-Moon
  bodies on `near`, clears it each draw; lists `behind` and `earth`.
- `src/lib/space-sky.ts`: `SkyInputs.near` from `[data-sky-canvas="near"]`, passed to the layer.
- `src/components/HeroGlobe.astro`, `src/components/slides/Deck.astro`: the near canvas after the
  globe layer.
- `src/lib/data-credits.ts`: the row in (j). `scripts/gates/registry.mjs` and the freshness check:
  rules (h). `scripts/hero-space-check.mjs`: the checks below.
- `scripts/sky-size.test.ts`: `sky-planets.ts` keeps 7,168; over it, stop and report.

## Tests

Pins from Horizons, each query in the comment, instants as epoch-ms literals (2029-04-13T20:00Z is
`1870804800000`, 21:00Z `1870808400000`, 06:00Z `1870754400000`); camera sites `CENTER='coord@399'
COORD_TYPE='CYLINDRICAL'` from `cameraAt`, three rotations: far side, within one Earth radius of
Apophis, and with the Earth between.

- `pass-table.test.ts`: a cubic is reproduced exactly; against Horizons vectors at five past each
  hour from 12:05 to 23:05, including 21:45, within 1 km; null one step outside the window.
- `ephemeris.test.ts`: at each site, unit within 90″ of QUANTITIES 1 and Δ within 2 km of
  QUANTITIES 20; at the near site geocentric and camera directions differ by over 20°.
  `earthCover`: behind, front and null on the three sites.
- `magnitude.test.ts`: `hgMagnitude` with Apophis's H and G against APmag (QUANTITIES 9) at the
  three sites, within 0.05 mag.
- `sky-planets.test.ts`: from the near site at 20:00Z it draws on `near`, not the stars canvas;
  behind the image plane it is listed `behind`; at the far-side Earth pin `earth`; at 06:00Z it is
  absent from `drawn()`; at 20:00Z present. `sky-picker.test.ts`: Apophis sorted by V among them.
- `prepare-sky-orbits.test.ts`: on the recorded answers, rule (a) keeps Apophis 2029 and drops a
  recorded 0.0019 au approach of an H 25 body; the window's bounds; every sidecar field.
- The freshness check's test, recorded answers and a fixed clock: same id passes; a changed id
  fails; an ended window fails; no network.
- `data-credits.test.ts`: the row is present exactly when the JSON has a pass.
- Lifetimes as in 5a: abort each mount and `providePoints(null)` in `afterEach`; timer count 0.

## Gate checks (`hero-space`)

- `apophis-place`: clock at 20:00Z, 1440×900, the far-side rotation: `data-sky-planets` places it
  within 2 px of the pin's screen point, V within 0.1.
- `apophis-front`: the near rotation: the near canvas has alpha above 0 within 2 px of the pin,
  over the Earth's disc. `apophis-behind`: listed `earth`, both canvases alpha 0 within 3 px.
- `apophis-pick`: Look at lists Apophis; choosing it lands it within 2 px of the aim's target,
  held after `page.clock.runFor(60_000)`. At 06:00Z it is not listed.

## Duplication pass (dox-tester)

- `rg -n "apophis" -i apps/dox/src/lib --glob '!*.test.ts'` → only `sky-registry.ts`.
- `rg -n "99942|2029-04|1870[0-9]{9}" apps/dox/src --glob '!*.test.ts'` → no hit: the pass is data.
- `rg -n "ssd-api\.jpl\.nasa\.gov" apps/dox` → the generator, its fixtures, the sidecar and the
  freshness check only.
- `rg -n "Hermite|h00|h10" -i apps/dox/src/lib --glob '!*.test.ts'` → `pass-table.ts` only.
- `rg -n "id: \"(sun|moon|venus|apophis)\"" apps/dox/src --glob '!*.test.ts'` → `sky-registry.ts` only.
- `wc -l` of every touched file under 400.

## Definition of done

- `pnpm --filter @gmt/dox test -- pass-table ephemeris magnitude sky-planets sky-picker sky-registry prepare-sky-orbits data-credits sky-size`
  passes; `lint` and `check` clean.
- `pnpm --filter @gmt/dox gates --only hero-space,data-credits-check,sky-orbits-fresh` passes. No
  `it.skip`, `it.todo` or `it.fails`.
- **Owner viewing pass**, his window size, his clicks: `node scripts/sky-at.mjs 2029-04-13T20:00Z
  <his size>`; find Apophis among the stars; drag until it passes in front of the Earth, then behind
  it; open Look at, choose Apophis, watch it hold; the same at 06:00Z shows no Apophis.
- Close-out: `built/tier-4-globe.md` "Night sky": the pass rule, the source and why it is a
  national peer, camera-centred positions, the near canvas, the freshness rules and the refresh
  runbook, `sky-at.mjs`; one-line reason each. Then the story's
  [final gates](./index.md#gates-every-slice-passes), once.
