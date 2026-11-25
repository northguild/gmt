# Slice 5b · Small bodies

Part of [DOX-G16](./index.md). Paths are under `apps/dox/`. Builds on
[slice 5a](./s5a-planets.md): the same registry (`SKY_BODIES`), layer, generator, faint limit
and the Look at list. It is a slice of its own because it brings a second source, a second orbit
and magnitude law, and elements that age. [5c](./s5c-apophis.md) builds on it.

## What the reader sees

(4) Vesta, the one minor planet that reaches the stars' limit, shows as a star-like point on
the nights it is brighter than magnitude 5.5, at its true place, by the same law and look as the
planets, and is listed in Look at on those nights. The next are around 2029-07-08 (5.41,
Horizons). Outside them nothing changes.

## Decided

- **(a) Which bodies, by slice 5a's rule.** The source is the IAU Minor Planet Center's yearly
  bright minor planets file (`https://www.minorplanetcenter.net/iau/Ephemerides/Bright/<year>/Soft00Bright.txt`).
  A body's brightest possible magnitude is its perihelic opposition, phase 0:
  `H + 5 log10(q(q − 1))`, q its perihelion in au. With the 2026 file (epoch 2025-11-21):
  Vesta 5.21, in; Pallas 6.02, Ceres 6.32 and Eros 6.28, out. The generator applies the rule.
- **(b) Not from this file, one line each.** Comets: no fixed elements, and their brightness
  follows activity, not a law; excluded. Near-Earth objects (q < 1.3 au, the MPC's definition):
  a close approach defeats two-body elements, so they reach the sky only as 5c's tabulated passes.
- **(c) Magnitudes: the IAU H,G system** (IAU Commission 20, 1985; Bowell et al. 1989, Asteroids
  II), H and G from the file (every row there has G = 0.15).
- **(d) Positions: two-body Kepler from the MPC elements,** heliocentric J2000 ecliptic, then
  slice 5a's frame unchanged. Measured against Horizons for Vesta: within 0.010° (0.4 px) for
  360 days of the elements' epoch, 0.035° (1.5 px) at 720 days, 0.1–0.5° from 3 to 5 years.
- **(e) Elements age, so validity is relative.** The JSON records each element set's epoch; the
  layer draws a small body only within 720 days of it (`ELEMENT_DAYS`, measured above). Rule:
  no constant that ages. The 2029 nights need a file published for 2029.
- **(f) Refresh.** The generator fetches the file for the year of its run instant (gmt's clock)
  and pins its bytes and sha256 in the sidecar. A weekly-tier gate, `sky-orbits-fresh`, fails
  once the run instant is within 90 days of an element set's end of validity and names the
  runbook. The pull-request tier never reads the date.
- **(g) Rotation.** `body-rotation.ts` gains `VESTA_ROTATION`, its WGCCRE model (Archinal et al. 2018); the builder
  copies it from the report and checks it against Horizons. A body the report omits has none.
- **(h) Credits.** No image. `SKY_CREDITS` gains one data row: "Vesta's orbit: IAU Minor Planet
  Center." (the MPC asks for acknowledgement of its data).

## Files

Create:

| File | Layer | Role |
| --- | --- | --- |
| `src/lib/kepler.ts` (+ `.test.ts`) | shared | `keplerPosition(elements, jd) → Vec3` (au, J2000 ecliptic); Newton on Kepler's equation, elliptic orbits only |

Modify:

- `scripts/prepare-sky-orbits.ts` (+ test): a second pinned source, the MPC file; parses its
  fixed columns; applies (a) and (b); writes `smallBodies` rows: elements, epoch, H, G.
- `src/assets/sky-orbits.json`: regenerated; the planets' part unchanged byte for byte.
- `src/lib/sky-registry.ts`: the Vesta row in `SKY_BODIES` (`kind: "point"`, name "Vesta");
  colour class 1 (no B−V in the file: the stars' own rule for a missing index).
- `src/lib/ephemeris.ts`: `bodyFromCamera` dispatches on the JSON entry's kind (`vsop87` or
  `kepler`) to `vsopPosition` or `keplerPosition`, and returns null outside the validity.
- `src/lib/magnitude.ts`: `hgMagnitude(H, G, view) → V`, the two-phase-function form.
- `src/lib/data-credits.ts`: the MPC row in `SKY_CREDITS`.
- `scripts/gates/registry.mjs` and its check: `sky-orbits-fresh`, weekly tier.
- `scripts/sky-size.test.ts`: the planets row keeps its 7,168-byte cap.

## Tests

Pins from Horizons, each query in the comment, instants as epoch-ms literals.

- `kepler.test.ts`: a circular orbit returns its radius at every anomaly; e = 0.9 converges in
  under 10 steps; Vesta's MPC 2026 elements at their epoch, +180 and +360 days match Horizons'
  heliocentric vector (`CENTER='500@10'`, `EPHEM_TYPE=VECTORS`, `REF_PLANE=ECLIPTIC`) within
  0.010°.
- `ephemeris.test.ts`: Vesta from the camera site within 45″ of Horizons QUANTITIES 1 inside
  360 days, within 1.5 px-equivalent (126″) at 700 days; null at 721 days.
- `magnitude.test.ts`: `hgMagnitude` against Horizons APmag for Vesta at five instants, within
  0.05 mag; at α = 0 it returns H + 5 log10(rΔ) exactly.
- `sky-planets.test.ts`: with a fixture row built from Horizons' osculating elements for
  2029-07-01 (query in the comment), Vesta at 2029-07-08 is drawn at 5.41 ± 0.05; with the
  shipped 2026 elements at the same instant it is not (outside validity). `drawn()` lists it
  exactly when it is drawn, so `sky-picker.test.ts` shows it in the list with that fixture.
- `prepare-sky-orbits.test.ts`: the parser on three fixed-column lines copied from the file;
  the bound keeps 5.5, drops 5.51; a q < 1.3 row and a comet designation are dropped.
- The freshness check's own test: within 90 days fails, beyond passes, with a fixed clock.
- Lifetimes as in slice 5a: abort in `afterEach`, `vi.getTimerCount()` 0.

## Gate checks

- `hero-space` `planets-place` and `planets-behind` still pass unchanged; Vesta is not on screen
  at those pins (asserted: no `vesta` entry).
- No `hero-space` pin for Vesta: no night within the shipped elements' validity reaches 5.5.
  The 2029-07-08 fixture test stands in, and the next refresh adds a pin if its window has one.
- `sky-orbits-fresh` (weekly) passes today.

## Duplication pass (dox-tester)

- `rg -n "Math\.atan2|Math\.hypot" apps/dox/src/lib/kepler.ts apps/dox/src/lib/ephemeris.ts`
  → the frame turn and light time appear once, in `ephemeris.ts`; `kepler.ts` only solves.
- `rg -n "vesta" -i apps/dox/src/lib --glob '!*.test.ts'` → only `sky-registry.ts` and
  `body-rotation.ts`.
- `rg -n "Soft00Bright|minorplanetcenter" apps/dox` → only the generator and its sidecar.
- `wc -l` of every file this slice touches stays under 400.

## Definition of done

- `pnpm --filter @gmt/dox test -- kepler ephemeris magnitude sky-planets sky-registry sky-picker prepare-sky-orbits sky-size`
  passes; `lint` and `check` are clean.
- `pnpm --filter @gmt/dox gates --only hero-space,data-credits-check,sky-orbits-fresh` passes.
  No `it.skip`, `it.todo` or `it.fails` added.
- **Owner viewing pass**, at his recorded window size, his own clicks: on `/`, the planets
  unchanged from slice 5a; the credits list both data rows.
- Close-out: `built/tier-4-globe.md` "Night sky" gains the small-body rule, the exclusions,
  the H,G law, the validity rule, and the yearly refresh runbook with `sky-orbits-fresh`.
