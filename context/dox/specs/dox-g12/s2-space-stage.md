# Slice 2 · Space stage

[Index](./index.md) · Binding rules: [Tier 4 · Engine](../../built/tier-4-globe.md#engine-srclibglobe),
[Tier 4 · Night sky](../../built/tier-4-globe.md#night-sky-landing-only),
[Tier 4 · Earth imagery](../../built/tier-4-globe.md#earth-imagery),
[visual-design.md § Motion](../../reference/visual-design.md#motion).

## Goal

The Earth and the real sky sit behind the deck's stage. Each slide names a place; moving to it,
the camera lifts, flies the great circle and comes down. WASD flies freely; the next step returns
to the slide's place. The route between places is drawn as raised arcs. The same tour runs on the
canvas-2D renderer, and the slides stay readable on the void when neither renderer or the sky
loads.

## Places: `src/lib/slides/places.ts`

`Slide`'s `place` prop is a string; `resolvePlace(place)` turns it into one of:
- `{ kind: "zone", zone }` for an IANA name, looked up in `TZ_COORDINATES`
  (`src/lib/tz-coordinates.ts`: Helsinki, Tehran, Tokyo, Kolkata, Shanghai,
  Manila). A zone missing from the table is a build error, never a silent default.
- `{ kind: "point", lng, lat, label, source }` for a place with no zone of its own: Galicia
  (Santiago de Compostela) and Greenwich (the Airy transit circle). The coordinates and a cited
  source sit beside each entry; a test asserts every point has a source.
- `{ kind: "moon" }`: the camera's sub-point is the antipode of the sublunar point at the current
  instant (`moonRaDec` and `siderealDeg` in `sky-math.ts`), offset 15° along the terminator so the
  Moon clears the limb (the Earth's half-angle from 6.61 radii is 8.7°). The Moon shows its real
  phase; the slide text never depends on it.
- `{ kind: "overview" }`: zoom 1, the camera over the mean of every pinned place, every pin and
  arc lit.
- `{ kind: "wall" }` (slides 2 and 3): the overview camera with the ice wall in front
  ([slice 2b](./s2b-ice-wall.md)); `{ kind: "planet" }` (slides 4 and 5): the camera centred on
  the `PLANET_ZONES` pins, the matrix zones among them ([slice 4c](./s4c-zone-matrix.md)).
- Rotation for a point is `[-lng, -lat]` ([`GlobeOptions.initialRotation`](../../built/tier-4-globe.md#engine-srclibglobe)).
- Tests: every place used by every deck resolves; antipode maths against a fixed instant from
  `Temporal.Instant.from(...).epochMilliseconds`; the moon sub-point keeps the Moon outside the disc.

## Kit additions: controller and engine

All opt-in; the landing, `/tools/zoned-earth/` and the `/dox` rail keep their behaviour and tests.

- `GlobeOptions.ambient?: boolean` (default `true`). `false` never schedules the ambient spin, so
  the globe is still at rest and draws no frames.
- `flyTo(rotation, { hop?: { durationMs, dipZoom } })`. With `hop`, the controller runs a timed
  ease-in-out (cubic, zero velocity at both ends) on rotation and a zoom curve that dips to
  `dipZoom` at the midpoint and returns to the goal zoom. Without `hop`, today's exponential
  `FOCUS_EASE` path, timed per 16 ms so it runs at the same speed at any frame rate. Under reduced
  motion both snap. Rotation takes the short way round in longitude. `durationMs` scales with arc
  length: 2000 ms for ≤ 30°, up to 4000 ms at 180°, slow enough for a room to follow.
- `steer(vector: { lng, lat, zoom })`: a continuous rate in degrees and zoom units per second,
  held until the next `steer({0,0,0})`. Stepped on the controller's clock like drag inertia; it
  clamps latitude and zoom to the existing ranges. A drag or `flyTo` cancels it.
- `src/lib/globe/globe-theme.ts`: `readTheme`, `labelFont` and `rendererOverride` move here from
  `globe.ts` (moved, not copied) and are exported; `globe.ts` imports them.
- Tests in `controller.test.ts`: `ambient: false` never sets a due time; a hop reaches its goal at
  exactly `durationMs` on a stepped clock, its zoom is lowest at the midpoint, and it snaps under
  reduced motion; `steer` moves at its rate and stops; a drag cancels both. All on the
  controller's injected `now`, no real time.

## Shared sky: `src/lib/space-sky.ts`

`hero-space.ts`'s sky loading and following (`loadClock`, `loadMilkyWay`, `startHeroSky`,
`skyWithoutGlobe`, the follow loop inside `followGlobe`) move into `space-sky.ts`, taking
`{ root, stars, band, host, src, milkyWay, signal }` rather than reading the hero's DOM. The
signal is the caller's: the deck aborts it on `destroy()`; the landing passes a signal it never
aborts, as today. `hero-space.ts` keeps the landing-only parts (the meteor, the entrance, the
drawer and copy keep-outs) and calls `space-sky.ts`. The `hero-space` gate and its tests stay
green with no change to what the landing does.

## The stage: `src/lib/slides/stage.ts`

`mountSpaceStage(root, { signal })` returns `{ goTo(place, { hop }), overview(open), steer,
returnHome(), destroy() }`.
- Layers bottom to top: sky (stars and band canvases), the globe canvas, the slide stage.
  The canvases are `aria-hidden`; the globe's hit area covers the void around the stage only and
  is never focusable, so its own arrow-key handling never runs. Drag orbits.
- Globe options: `renderer` from `rendererOverride()` (`?globe=webgpu|canvas2d`), `ambient: false`,
  `maxDpr: 1.5`, `pauseWhenHidden: true`, `framing` that keeps the Earth in the stage's right
  third at zoom 1 and centred behind a `layout="full"` slide, `imageryUrl` as on the landing,
  `sunInstant` and the sky clock from gmt `unix/get` (dynamic import, after first paint).
- Mount order: slide text paints first (SSR); then the sky, then the globe; the stage never waits
  for either. If the globe fails both renderers, `space-sky.ts` draws the sky once without it; if
  the sky fails too, the void stays. Neither failure is an error the reader sees.
- Pins: one `GlobeMarker` per place-bearing slide, the current one lit. Arcs: one `GlobeArc` per
  consecutive pair of distinct places, `altitude` 0.15, drawn in the order the talk visits them;
  past legs in Teal, the leg being flown in Cyan.
- Overview (the `O` dialog and the `scoreboard` slide):
  `goTo({ kind: "overview" })`
  with every pin and arc lit; closing returns to the slide's place.
- Free flight: W/S tilt north and south, A/D turn west and east, Q/E zoom out and in, each held
  key a `steer` rate (60°/s, 1 zoom/s); key-up stops it. R and the next step call `returnHome()`,
  which flies back to the slide's place with a hop. Shift doubles the rate. Slice 1's keys module
  routes these keys here.

## Fallbacks and venue hardening

- Canvas-2D renders the same pins, arcs and flights; the WebGPU-only imagery is absent there.
- Reduced motion: every `goTo` snaps, the slide change is a fade, no meteor; drag and free flight
  stay because they are the presenter's own motion.
- No frames at rest: after a flight settles the engine stops requesting frames
  ([Tier 4](../../built/tier-4-globe.md#engine-srclibglobe)).
- Preload on the deck page only: `hero-sky.bin`, `hero-milkyway.webp` and the Earth imagery,
  through `<link rel="preload">` in the page head, so a dropped Wi-Fi after load loses nothing.
- The sky credits (HYG CC BY-SA, ESO CC BY) and the Earth imagery credit sit in the deck's info
  menu, under its tools, on every slide (`deckControls`; a deck adds its own through `Deck`'s
  `credits`). The deck index carries them in the site's data-credits form.

## Panels on the stage

Slide panels are opaque `--gmt-surface-widget`, full bevelled border, bottom-border accent only,
no `backdrop-filter`, so the moving Earth never re-samples under text and contrast never depends
on what is behind. No left-only stripe.

## Gate changes

- `scripts/slides-check.mjs` (canvas-2D): after each step, the flight settles within 5 s, the
  globe's `getRotation()` matches the slide's place within 0.5°, and no frame is requested 500 ms
  after settling. Frame timing over one full tour: median ≤ 17.5 ms, none over 34 ms.
- `scripts/globe-smoke.mjs` (local, needs a GPU) gains the deck page, so WebGPU parity is checked
  on the owner's machine.

## Tests

- `places.test.ts`, `controller.test.ts` additions (pure, stepped clock).
- `stage.test.ts`: jsdom with the engine replaced by a fake that records calls (`vi.mock`, so the
  file runs in the `isolated` project). Each test builds its own `AbortController` and calls
  `destroy()` and `abort()` in `afterEach`; the fake engine's `destroy` is asserted called.
  Keys held and released stop `steer`; a failed engine falls back to the sky without throwing.
- `space-sky.test.ts`: the moved code's tests, moved with it; the landing's tests unchanged.

## Definition of done

- Stepping through the placeholder deck flies between at least four places with visible hops and
  arcs on WebGPU and on `?globe=canvas2d`; WASD/QE fly; R and the next step return.
- With reduced motion on, every move is a cut. With both renderers blocked, the slides read on the
  void.
- `hero-space`, `globe-smoke` (local) and the landing look unchanged.
- Own tests, `pnpm dox:lint` and `pnpm dox:check` green; the owner's listening pass.
