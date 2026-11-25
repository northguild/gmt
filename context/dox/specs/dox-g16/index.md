---
story: DOX-G16
issue: 578
status: approved
dox: none
---

# DOX-G16 · Sun and Moon textures, the sky views, and the solar system

The story maps imagery onto the Sun and Moon, adds a **Look at** menu (Sun, Moon, planets) to
the globe's zoom stack, makes the look switch (**Natural colours**) set all three bodies, and draws every
solar-system body bright enough to show among the stars. Site work only: no `packages/gmt` change,
changeset, Dox tool or chat pill. Paths are under `apps/dox/` unless they start with `context/`.

## Phases

One PR. Each phase is a slice that `dox-builder` lands and `dox-tester` verifies before the next.

| # | Slice | What the reader sees |
| --- | --- | --- |
| 1 | [Moon map and the shared loaders](./s1-moon.md) | The Moon's maria and craters, lit by the true phase and turned to the true face; flat Moon until the map loads |
| 2 | [Sun disc](./s2-sun.md) | A photographed solar disc, limb-darkened, solar north on its true pole; the glare unchanged |
| 3 | [Look at the Sun and Moon](./s3-views.md) | A Look at button in the zoom stack whose list turns the camera to the Sun or the Moon and holds it in view |
| 4 | [Natural colours](./s4-look.md) | One switch sets all three bodies: ice-tinted by default, the imagery's own colours when on |
| 5a | [Planets, the registry, View planet](./s5a-planets.md) | Mercury to Saturn, and Uranus when it reaches 5.5, as star-like points at true place and magnitude; the Look at list adds the bodies drawn now, brightest first, and aims at the one picked |
| 5b | [Small bodies](./s5b-small-bodies.md) | Vesta as a point on the nights it reaches 5.5; split from 5a for its second source, second laws and ageing elements |
| 5c | [Apophis's 2029 pass](./s5c-apophis.md) | Apophis on 13 April 2029, inside the camera's orbit: placed from the camera, in front of or behind the Earth, listed in Look at |
| 6 | [Hashed names for the large site files](./s6-cache.md) | The Earth imagery and boundary files cached for good after the first visit, like the rest of the build |

## Boundary with DOX-G2 and DOX-G3

DOX-G2 (#447) shipped the bodies (`sky-math`, `drawBodies`, terminator, earthshine, glare); DOX-G3
(#467) put them under one pinhole camera (`moonFromCamera`, the Earth clip). DOX-G16 keeps all of
it, repaints the discs, adds the point bodies, and aims with the lens zoom (decision 4).

## Sources

International authority first. ESA's Solar Orbiter (multinational) carries the Sun. No international
or multinational body publishes a lunar mosaic, so the Moon uses a **national peer, labelled as one**:
NASA's visualisation of LRO data. Orientation: **IAU WGCCRE** (Archinal et al. 2018). Positions and magnitudes: [5a](./s5a-planets.md#decided), [5b](./s5b-small-bodies.md#decided), [5c](./s5c-apophis.md#decided).

| Body | Source | Licence | Source resolution | Shipped asset | Credit line |
| --- | --- | --- | --- | --- | --- |
| Sun | ESA, "PHI's view of the Sun in visible light", Solar Orbiter PHI/FDT, 22 March 2023, 617 nm ([page](https://www.esa.int/ESA_Multimedia/Images/2024/11/PHI_s_view_of_the_Sun_in_visible_light)) | CC BY-SA 3.0 IGO | disc about 8000 px across, 58.4 MB | `src/assets/sky-sun.webp`, 256×256 disc in the photo's one grey band, budget 16 KB; shared under CC BY-SA 3.0 IGO | "Sun: ESA & NASA/Solar Orbiter/PHI Team, CC BY-SA 3.0 IGO. Cropped, turned and scaled." |
| Moon | NASA Scientific Visualization Studio, CGI Moon Kit, `lroc_color_2k.jpg` ([page](https://svs.gsfc.nasa.gov/4720)), from the LRO LROC WAC mosaic (national peer) | Public domain under NASA's media guidelines; credit asked, no endorsement implied | 2048×1024 equirectangular | `src/assets/sky-moon.webp`, 1024×512 colour map, budget 80 KB | "Moon: NASA's Scientific Visualization Studio, CGI Moon Kit, from Lunar Reconnaissance Orbiter LROC data. Scaled." |

Rejected: SOHO (non-commercial); JAXA Kaguya (stricter terms); SDO/HMI and USGS LRO WAC only on the
owner's word. If the PHI page no longer states CC BY-SA 3.0 IGO at fetch, stop and report.

## Reuse

Existing pieces, by path: `src/lib/space-sky.ts` (`loadMilkyWay`, `loadClock`, `followGlobe`),
`sky.ts` (`drawBodies`, the band's lookup), `sky-math.ts` (`moonFromCamera`, `sunRaDec`,
`bodyOnScreen`, `limbOnScreen`, `skyLens`, `skyToScreen`, `precessToDate`), `sky-stars.ts`,
`scripts/prepare-hero-sky.mjs` (`colourClass`), `yield-to-main.ts` (`whenIdle`), `data-credits.ts`,
`hero-space.ts` (`avoid`), `zone-sky.ts` (`SKY_ICON_PATHS`), `src/lib/globe/` (`flyTo`,
`hopDuration`, `setZoom`, `getView`, `onInteract`, `pinhole.ts`), kit `button`, `drawer`.

New shared pieces, each with its home and one-line interface:

| Piece | Home | Interface |
| --- | --- | --- |
| `readPinnedSource` | `scripts/prepare-source.mjs` | `({name, url, bytes, sha256, flag}) → Buffer`; every prepare script uses it |
| `loadSkyMap` | `src/lib/space-sky.ts` | `(src, signal) → Promise<SkyMap \| undefined>`; `loadMilkyWay` becomes a call to it |
| `sampleMap` | `src/lib/sky-map.ts` | `(map, u, v) → number`, bilinear, wraps in u; the band and both bodies use it |
| `SKY_CREDITS` | `src/lib/data-credits.ts` | the ordered sky rows, images and data; `globe-mount.ts`, `SkyCredits.astro`, `Deck.astro` read it |
| `SKY_BODIES`, `SkyBodyId`, `providePoints` | `src/lib/sky-registry.ts` (5a moves it from `space-sky.ts`) | the one list of bodies, `{id, name, kind, place, reach, map?, make?, view?}`; heavier columns sit in lazy modules keyed by its ids |
| `paintLitSphere`, `paintEmissiveDisc`; `ICE_TINT` | `body-paint.ts`, `sun-paint.ts` (lazy chunks); `sky-bodies.ts` | `(map, geometry, out: ImageData) → void`; the default look's tint |
| `SUN_ROTATION`, `MOON_ROTATION` … | `src/lib/body-rotation.ts` | IAU WGCCRE rows, one export per body, so each chunk imports only its own |
| `bodyFrame` | `src/lib/body-frame.ts` | `(rotation, instantMs) → {pole, prime}` of date, any WGCCRE row; replaces `moonFrame` and `sunPole` |
| `bodyFromCamera`, `earthCover`; `cameraAt`, `AU` | `src/lib/ephemeris.ts`; `sky-math.ts` | `(id, instantMs, camera) → {unit, delta, r, phase} \| null`, VSOP87, Kepler or a pass table; `(rotation, instantMs) → Vec3`, of date |
| `dotRadius`, `dotStep`, `haloReach`, `classColour`; `SkyLayer` | `sky-stars.ts`; `sky-bodies.ts`, `sky.ts` | the star law by magnitude, for stars and bodies; `maps(painter, layer?)`, a lazy layer inside the Earth clip, before the Sun and Moon |
| `prepare-sky-orbits.ts` | `scripts/` (tsx) | VSOP87B, MPC and JPL close-approach sources → `src/assets/sky-orbits.json`, bodies chosen by rule |
| `aimBody`, `subBodyPoint`; `EARTH_HALF_ANGLE_DEG`, `heroAvoidRects` | `src/lib/sky-aim.ts`; `globe/pinhole.ts`, `hero-space.ts` | `(body, instantMs, lens, avoid) → {rotation, zoom} \| null`, sublunar and subsolar points; the Earth's half-angle from `RIM`; the meteor's avoid list, shared with the view |
| `holdAmbient` | `src/lib/globe/controller.ts`, `GlobeEngine` | `(hold: boolean) → void`; a held engine never starts the ambient spin |
| `Look`, `currentLook`, `setLook` | `src/lib/look.ts` (was `earth-look.ts`) | `"ice" \| "natural"`; `data-look` on `<html>`, `dox:look` in storage |
| `watchTheme`, `THEME_ATTRIBUTES` | `src/lib/globe/globe-theme.ts` | `(callback, signal) → void`; the one observer for theme and look, used by globe, sky and deck |
| `lookSwitchOffered` | `src/lib/globe.ts` (was `earthSwitchOffered`) | `({imagery, renderer, skyTextured, contrast, forced}) → boolean` |
| `mountSkyView`, `renderSkyView`; `wireBodyList` | `src/lib/sky-view.ts`; `sky-picker.ts` | `({engine, host, avoid, now, reducedMotion, signal}) → {release(), destroy()}`; the zoom stack's Look at, from kit `disclosure` and `listbox` |

Layers: all shared. Content (sources, crops, credits, orbits, rotation and magnitude terms) is
data in the prepare scripts, `src/assets/sky-*.json` and `SKY_BODIES`; `slides/places.ts` imports.

**Second-instance test.** A planet with imagery adds a source row in `prepare-sky-bodies.mjs`,
its asset and sidecar, a `SKY_CREDITS` row and its `map` on its `SKY_BODIES` row. A body or close
approach that reaches 5.5 needs one registry row; the generator adds its data. A second page with a globe and a sky
(the deck's stage) gets textures from `data-sun-map` and `data-moon-map`, bodies from
`loadBodyMaps`, views from `mountSkyView` with its host and `avoid`, the look from `watchTheme`.

## Kit pieces

**Look at:** kit `disclosure` (APG Disclosure; icon only, its label for assistive technology) in the
zoom stack's `role="group"`, holding kit `listbox` (APG Listbox). **Natural colours:** the kit
switch (APG Switch). No kit change.

## Budgets and rules every slice keeps

- **First paint:** maps and the planets' layer load after `sky.ready` and `whenIdle()`, no preload,
  none under forced colours; a failed fetch or decode keeps the flat bodies, no console error.
- **Code size** (`sky-size.test.ts`): `sky.ts` 5,216, 5a at most 5,248 (owner); lazy `body-paint.ts` 3,200, `sun-paint.ts` 2,048, `sky-planets.ts` 7,168.
- **Draw time:** discs cached by rounded radius, phase, face, pole angle and look, redrawn on a
  key change; `data-sky-ms` within the gate's limit. **Time:** gmt's `loadClock()` only.
- **Media:** raised contrast and reduced transparency drop the glare; forced colours hide the sky
  and the Look at button; raised contrast or forced colours: no look switch, the default look.
- **Styling:** no new card; kit buttons and switch, full borders, bevelled panel, no left-border accent.
- **Test lifetimes:** every test that mounts the sky, loader, view or observer aborts its signal or
  calls `destroy()` in `afterEach`, on `vi.useFakeTimers()`, then `vi.getTimerCount()` is 0.

## Gates every slice passes

Per slice: its own tests, dox `lint` and `check`, the `hero-space` gate, and the owner's viewing
pass (his window size, his clicks). Once, after the last slice (5c) and before the finalizer:

- `eval "$(fnm env)" && fnm use && pnpm run validate`.
- `pnpm --filter @gmt/dox gates --only hero-space,hero-phone,data-credits-check,sky-orbits-fresh,readout-still,esc-cascade,a11y-axe,a11y-tab-walk,a11y-media`,
  both themes, on `/` and `/tools/zoned-earth/`.
- `html-diff` and `visual-diff` against a `main` baseline taken before slice 1. Expected diffs:
  the bodies and planets on `/` and the deck's stage, the credits rows, the zoom stack's Look at
  button and list, the switch's label and legend.
- `slides-check` and `table-fit` run in CI only. The `ui-standards` skill over the branch, and
  dox-tester's duplication pass (each slice lists its greps).

## Decided

1. "Lunar and Solar times" means the true Sun and Moon at any instant: the hero, plus the deck's
   new-moon build ("A day off", build 2) and its Sun time-lapse ("Engines disagree").
2. The Sun is ESA's Solar Orbiter PHI photo.
3. Default look: Moon and Sun tinted toward `ICE_TINT`. **Natural colours** (the renamed Earth
   switch) shows the Moon's map colour and the Sun's near-white disc; glare unchanged. Rename to
   `data-look` / `dox:look`, no shim; offered whenever any body's imagery is drawn, never under
   raised contrast or forced colours ([slice 4](./s4-look.md#decided)).
4. View zoom: the largest zoom up to 2 that keeps the body clear.
5. The views live in one **Look at** list in the zoom stack, beside the camera controls; the drawer keeps zone search.
6. On a phone the zoom stack shows only with the sheet closed, so Look at opens over the sky bay.
7. Choosing the held body again releases the view and leaves the camera where it is.
8. Every solar-system body reaching the stars' limit (5.5) is a point at true place and magnitude,
   stars' look; one registry, `SKY_BODIES`, keeps IAU rotations for future gmt planetary times.
9. Look at lists the Sun, the Moon, then the bodies drawn now (5.5 or brighter), brightest first; picking one aims and holds as 3–7.
10. Apophis's 2029 pass is planned in, placed from the camera; JPL's solution as a national peer.

## Close-out

Each slice updates its `context/dox/built/` section (`tier-4-globe.md`; slice 4 also
`tier-4-zones.md` line 19), present tense, one-line reason per decision. The finalizer sets this
story Done in `tracker.md`, runs `pnpm deps:sync`, deletes this folder, and fixes what planning found:

1. `tracker.md`: DOX-G2 (#447, merged b15b3899) and DOX-G11 (#515) are closed but read Todo.
2. `specs/index.md` lists `dox-g2` in progress; delete `specs/dox-g2/` and its row ([pipeline](../../../../.agents/skills/pipeline/SKILL.md)).
3. `src/lib/sky.ts` was 652 lines, over rule 6's 400; slice 1 split the bodies out, the rest is backlog.
