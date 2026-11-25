# Slice 3 · View Sun and View Moon

Part of [DOX-G16](./index.md). Paths are under `apps/dox/`. Builds on slices 1 and 2; it
builds the owner's decisions 4 to 7 ([index](./index.md#decided)).

## What the reader sees

The zone drawer on `/` (space mode only) gains a **Sky view** row under the "Find a zone"
search: two toggle buttons, "View Sun" and "View Moon", each with its sky glyph
(`SKY_ICON_PATHS.day`, `.night`) and a visible label. Pressing one:

1. sets the lens zoom to the largest of 2, 1.75, 1.5, 1.25 and 1 that keeps the body in clear
   sky (decision 4), and flies the one camera with the usual hop so the body sits beside the
   Earth's limb, inside the hero, clear of the intro copy, the open drawer and the zoom stack;
2. holds it there: the ambient spin does not start while the view is on, and as the body drifts
   (about 15° an hour against the Earth) the camera follows with a short ease;
3. on a stacked phone, closes the sheet first, so the body shows in the sky bay (decision 6).

Pressing the other button switches bodies. Pressing the pressed button releases the view and
leaves the camera where it is (decision 7). Any reader gesture on the globe (drag, pinch, wheel,
tap, key), a zoom-stack button, or picking a zone also releases it; the ambient spin returns
after its usual idle once the globe is back at rest zoom (it never spins zoomed in). Under reduced motion the camera jumps, never flies. Under forced
colours the sky is hidden, so the group is hidden too. If no clear spot fits (a tiny window),
the camera looks past the Earth's centre towards the body, at rest zoom.

## Files

Create:

| File | Layer | Role |
| --- | --- | --- |
| `src/lib/sky-aim.ts` (+ `.test.ts`) | shared, pure | `subBodyPoint(body, instantMs)`; `aimBody(body, instantMs, lens, avoid) → {rotation, zoom} \| null` |
| `src/lib/sky-view.ts` (+ `.test.ts`) | shared | `renderSkyView(id)` markup from kit `button` and `buttonRow`; `mountSkyView({engine, host, avoid, now, reducedMotion, onPress, signal}) → {release(), destroy()}` |
| `src/lib/hero-frame.ts` | shared | `copyEnd` and `frameSpace` moved whole out of `globe-mount.ts`, so that file does not grow |

Modify:

- `src/lib/globe/types.ts`, `src/lib/globe/controller.ts`, and each engine that implements
  `GlobeEngine`: `holdAmbient(hold: boolean)`. Held, the controller clears any scheduled ambient
  start and stops a running spin with its usual ramp; released, it schedules the spin `IDLE_MS`
  later. `options.ambient: false` stays the ceiling (the deck never spins), and reduced motion
  never spins. `controller.ts` grows by this method only, at most 15 lines.
- `src/lib/globe/pinhole.ts`: export `EARTH_HALF_ANGLE_DEG = asin(RIM)` in degrees (`RIM` is
  already `1 / P`). `src/lib/slides/places.ts` drops its `Math.asin(1 / 6.61)` copy and imports
  it and `subBodyPoint` (its sublunar computation moves into `sky-aim.ts`). `moonCameraPoint`
  moves by under 0.001° (P is 6.6107, not 6.61) and `places.test.ts` passes unedited; if it does
  not, stop and report rather than loosen it.
- `src/lib/hero-space.ts`: the meteor's inline `avoid` becomes an exported
  `heroAvoidRects(hero)`; the meteor and the sky view both call it. The view adds the zoom stack
  (`[data-gate="globe-zoom"]`) to its own list.
- `src/lib/globe-mount.ts`: in `renderGlobeTemplate`, `${renderSkyView(id("sky-view"))}` after
  the search field; in `wireSpace`, `mountSkyView` with the engine, `heroAvoidRects`, the sky's
  `now`, and `onPress` that closes the sheet when stacked (`HOME_LOCKED_QUERY` false). Call
  `view.release()` from the existing zoom-stack handler, the zone-pick path and `onInteract`.
  Net line count no higher than on `main` (`git diff --numstat origin/main`).
- `src/lib/zone-filter-ui.ts` or the drawer's CSS module, only if the row needs spacing: use the
  drawer's existing gap tokens. No new card, no accent edge.
- `scripts/hero-space-check.mjs`: the checks below.

## The aim

`aimBody` is pure and uses only `sky-math`:

- `lens` is `{width, height, centre, focalAtRest}` from `engine.getView()`; `avoid` is a list of
  rectangles. Earth's screen radius at zoom z is `z × focalAtRest × tan(EARTH_HALF_ANGLE_DEG)`.
- For each zoom in the list, sixteen candidate targets lie around the Earth's centre at the
  limb plus the body's radius plus 24 px. A target is kept when the body's box (the Sun's
  includes its glare, `GLARE_RADII`) lies 16 px inside the hero and misses every avoid rectangle.
  Candidates are tried nearest-first to the body's current screen direction.
- For a target, Newton's method on `[λ, φ]` with a finite-difference Jacobian (0.01°) moves the
  body onto it. Each step recomputes the body from that camera: `moonFromCamera` for the Moon
  (its parallax is several degrees), `sunRaDec` for the Sun, `bodyOnScreen` for the pixel. Start
  from the antipode of `subBodyPoint`, nudged 10° away from the target's side. Accept within
  2 px in 8 steps, with `|φ| < 89°`; else try the next candidate.
- `null` when nothing fits. `mountSkyView` then flies to the antipode of `subBodyPoint` at zoom 1.

## The view

- Press: flip `aria-pressed` on both buttons, `onPress`, `engine.holdAmbient(true)`, solve,
  `engine.setZoom(zoom)`, then `engine.flyTo(rotation, {hop: {durationMs: hopDuration(arc)}})`
  (the hop returns to the zoom the controller is heading for, so the zoom is set first; confirm
  in `controller.ts` and cover it with a test). Reduced motion: the controller snaps.
- Hold: `engine.onFrame` (the globe's 1 s clock tick renders a frame at rest) checks at most
  once per second of `now()`, and not during the press's flight. If the body has moved over 8 px
  from its target, or its box now meets an avoid rectangle (drawer opened, window resized),
  solve again and `flyTo` without a hop.
- Release: both `aria-pressed="false"`, `holdAmbient(false)`, stop checking. Never moves the camera.
- Time is the sky's `now` from `loadClock()`; no `Date.now`, no timer of its own.

## Tests

- `sky-aim.test.ts`: six instants × both bodies × three lenses (1440×900 with a right-hand
  drawer rectangle, 1280×720, 390×844 with a bottom sheet rectangle): the body lands within 2 px
  of the target and clear of every rectangle; the zoom is the largest that fits; a 200×200 lens
  covered by one rectangle gives `null`. The Moon's answer differs from a geocentric aim by over
  1°. `subBodyPoint("sun")` equals `subsolarPoint`; `subBodyPoint("moon")` equals the old
  `places.ts` result at three instants.
- `controller.test.ts`: held, no spin after `2 × IDLE_MS`; released, the spin starts after
  `IDLE_MS`; `ambient: false` or reduced motion never spins.
- `sky-view.test.ts` (fake engine, fake timers, jsdom): a press calls `holdAmbient(true)`,
  `setZoom`, then `flyTo` with the hop; the other button reads false; a second press releases
  without a camera call; `onInteract` releases; a 9 px drift re-aims once without a hop, a 7 px
  drift does not; two frames in one second check once. `afterEach` aborts the signal and calls
  `destroy()`; `vi.getTimerCount()` is 0 and the fake engine holds no callbacks.

## Gate checks (`hero-space`, clock pinned at `SKY_PINS.half`)

- `sky-view`, in Europe/Helsinki and Africa/Nairobi, 1440×900: open the drawer, press View Moon,
  wait for `data-sky-view="moon"` on the hero and the flight's end. From `data-sky-bodies`, the
  Moon's disc is 16 px inside the hero, outside the Earth's disc, and misses the copy, drawer and
  zoom-stack boxes. Repeat for View Sun with its glare radius.
- `sky-view-hold`: after `page.clock.runFor(5_000)` the Moon has moved no more than the sky's own
  turn (360 degrees in 86 164 s, scaled by the lens from the Earth's disc and the Moon's angle off
  the axis, a quarter over, and always under the 8 px re-aim); the ambient spin would move it
  hundreds of pixels (0.002 degrees a millisecond). After `runFor(600_000)` it is in clear sky. A
  drag then sets both buttons to `aria-pressed="false"`; after `runFor(3_000)` the camera has turned
  under 0.6 degrees when the view's lens zoom was above rest zoom (no spin), or 0.6 degrees or more
  when it was rest zoom (a small hero fits only that; the spin is back); read from `data-sky-view`
  because the Moon may have left the hero. After the zoom stack's rest button and `runFor(3_000)` it has turned 0.1 degrees or
  more (the spin is back).
- `sky-view-still`: both buttons' bounding boxes, pressed and released, match within 0.5 px.
- `sky-view-reduced`: under `reducedMotion: "reduce"`, the Moon is in place on the next frame.
- `sky-view-phone`, 390×844: pressing View Moon in the sheet closes it; the Moon is in the sky
  bay, clear of the zoom stack.
- `sky-view-forced`: under `forcedColors: "active"` the group is not rendered visible.

## Duplication pass (dox-tester)

- `rg -n "Math.asin\(1 / 6.61\)" apps/dox/src` → one hit, in `globe/pinhole.ts`.
- `rg -n "<button|aria-pressed=\"" apps/dox/src/lib/sky-view.ts` → no hit (the kit renders them).
- `rg -n "getBoundingClientRect" apps/dox/src/lib/sky-view.ts apps/dox/src/lib/sky-aim.ts` → no
  hit (rectangles arrive as `avoid`).
- `rg -n "\[copy, drawer, stage\]" apps/dox/src` → one hit, in `heroAvoidRects`.
- `rg -n "setInterval|Date\.now" apps/dox/src/lib/sky-view.ts apps/dox/src/lib/sky-aim.ts` → no hit.
- `wc -l` of `sky-aim.ts`, `sky-view.ts`, `hero-frame.ts`: each under 400;
  `git diff --numstat origin/main -- apps/dox/src/lib/globe-mount.ts` adds no more than it removes.

## Definition of done

- `pnpm --filter @gmt/dox test -- sky-aim sky-view controller places hero-space globe-mount` passes;
  `pnpm --filter @gmt/dox lint` and `check` are clean.
- `pnpm --filter @gmt/dox gates --only hero-space,hero-phone,esc-cascade` passes, new checks
  included. No `it.skip`, `it.todo` or `it.fails` added.
- The duplication pass above returns what it says.
- **Owner viewing pass**, at his recorded window size, his own clicks, `pnpm dox:dev` already
  running: on `/`, open the drawer, press View Moon, then View Sun, then the pressed one; drag
  the globe while a view is on; repeat at phone width in the browser's device mode.
- `context/dox/built/tier-4-globe.md` "Controls and drawer": the Sky view group, the aim, the
  hold, the release rules, `holdAmbient`; one-line reason each.
