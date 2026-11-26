# Slice 3 · Look at the Sun and the Moon

Part of [DOX-G16](./index.md). Paths are under `apps/dox/`. Builds on slices 1 and 2; it
builds the owner's decisions 4 to 7 and 9 ([index](./index.md#decided)). The aim, the hold and
`holdAmbient` are built and stay; this slice moves the control from the zone drawer to the zoom
stack and makes it one labelled bar.

## What the reader sees

The zoom stack on `/` (space mode only) gains a fourth control below Reset zoom: **Look at**, a
kit `disclosure`, icon only (`SKY_ICON_PATHS.night`; its label "Look at" for assistive
technology), one of the stack's own buttons. It opens a second bar drawn like the stack
(`role="group"` labelled "Look at"), wide enough for words: one button per row of `SKY_BODIES`
in the registry's order (the Sun, the Moon, then the planets outward from the Sun), each its
icon or astronomical symbol and its name, rows as tall as the stack's buttons (2rem, 2.75rem on
touch), 1 px dividers on an opaque ground so no body shines through. No numbers: a magnitude
means nothing to most readers. The bar opens beside the stack, towards the globe, its foot level
with the stack's (above the row on a coarse pointer), never past the hero. The globe's tooltip, a
top-layer popover, hides while it is open. Choosing a body:

1. sets the lens zoom to the largest of 2, 1.75, 1.5, 1.25 and 1 that keeps the body in clear
   sky (decision 4), and flies the one camera with the usual hop so the body sits beside the
   Earth's limb, inside the Earth's area (`[data-space]`), clear of the intro copy (each of its
   cells when stacked), the open drawer and the zoom stack (its open bar included);
2. holds it there: the ambient spin does not start while the view is on, and as the body drifts
   (about 15° an hour against the Earth) the camera follows with a short ease;
3. closes the bar and returns focus to the Look at button; the held body's button is pressed
   (`aria-pressed`), and the Look at button carries `aria-expanded` and stays cyan
   (`data-held`) while a body is held.

Choosing the other body switches. Choosing the held body again releases the view and leaves the
camera where it is (decision 7). Any reader gesture on the globe (drag, pinch, wheel, tap, key), a
zoom button, or picking a zone also releases it; the ambient spin returns after its usual idle
once the globe is back at rest zoom (it never spins zoomed in). Under reduced motion the camera
jumps, never flies. On a stacked phone the zoom stack shows only with the sheet closed, so the
bar opens over the sky bay and the sheet is never touched (decision 6). Under forced colours the
sky is hidden, so Look at is hidden too. If no clear spot fits (a tiny window), the camera looks
past the Earth's centre towards the body, at rest zoom.

Keyboard: kit disclosure behaviour, unchanged. The button toggles; Tab walks the bar's buttons;
Enter or Space chooses; Escape closes the bar in its turn among the page's layers and returns
focus to the button (`wireDisclosure({light: true})`).

## Files

Create:

| File | Layer | Role |
| --- | --- | --- |
| `src/widgets/tools/sky-look.module.css` | tool | the toggle as one of the stack's buttons, the bar's placement, rows and states |

Modify:

- `src/lib/sky-view.ts`: `renderSkyView(idPrefix)` returns kit `disclosure({id: <prefix>-look,
  label: "Look at", icon, gate: "sky-look"})` whose panel is the bar (`data-gate="sky-look-bar"`),
  one `button[data-sky-body]` per `SKY_BODIES` row. `mountSkyView` drops `onPress`; it wires the
  disclosure and one click listener on the bar, and `choose(id)` aims, holds or releases as
  before. The hold, re-aim and release code stays as built. `data-sky-view` on the hero stays.
- `src/widgets/tools/sky-view.module.css` goes; `sky-look.module.css` replaces it. The toggle takes
  the zoom buttons' size and fill from the stack's own module (one home, no copy) and undoes only
  what the disclosure adds. No new card, no accent edge.
- `src/widgets/tools/globe.module.css`: the stack's dividers lie on the button surface (the bar
  uses the same ground); `.zoom` stops clipping while the bar is open; the globe tooltip is hidden
  while it is open.
- `src/lib/hero-space.ts`: `heroAimFrame` measures in the hero's `[data-space]`; stacked, the copy
  is `display: contents`, so `heroAvoidRects` keeps clear of each of its cells.
- `src/lib/globe-mount.ts`: the drawer's `${renderSkyView(...)}` moves inside the zoom stack's
  `role="group"`, after Reset zoom, in space mode only; `mountSkyView` loses `onPress`. Net line
  count no higher than on `main` (`git diff --numstat origin/main`).
- `src/lib/globe-mount.ts` outside-click guard: the zoom stack is already exempt; confirm a click
  inside the open bar neither closes the drawer nor releases the view.
- `scripts/hero-space-check.mjs`: the checks below, rewritten for the bar. Known
  defect from the last gate run: `sky-view-release` must read the view's lens zoom from
  `data-sky-camera` (not from a later camera that has moved), and the spin threshold uses the
  check file's `SPIN_DEGREES` constant at 0.6, not a literal. If the spin does not return at rest
  zoom after a release, that is a `holdAmbient` defect: fix it in the controller, not the check.
- `context/dox/built/tier-4-globe.md` "Controls and drawer": Look at replaces the Sky view row.

## The aim

`aimBody` is pure and uses only `sky-math`:

- `lens` is `{width, height, centre, focalAtRest}` from `engine.getView()`; `avoid` is a list of
  rectangles. Earth's screen radius at zoom z is `z × focalAtRest × tan(EARTH_HALF_ANGLE_DEG)`.
- For each zoom in the list, sixteen candidate targets lie around the Earth's centre at the
  limb plus the body's radius plus 24 px. A target is kept when the body's box (the Sun's
  includes its glare, `GLARE_RADII`) lies 16 px inside the Earth's area and misses every avoid rectangle.
  Candidates are tried nearest-first to the body's current screen direction.
- For a target, Newton's method on `[λ, φ]` with a finite-difference Jacobian (0.01°) moves the
  body onto it. Each step recomputes the body from that camera: `moonFromCamera` for the Moon
  (its parallax is several degrees), `sunRaDec` for the Sun, `bodyOnScreen` for the pixel. Start
  from the antipode of `subBodyPoint`, nudged 10° away from the target's side. Accept within
  2 px in 8 steps, with `|φ| < 89°`; else try the next candidate.
- `null` when nothing fits. `mountSkyView` then flies to the antipode of `subBodyPoint` at zoom 1.

## The view

- Choose: the body's button is pressed, the bar closes with focus back on its button,
  `engine.holdAmbient(true)`, solve, `engine.setZoom(zoom)`, then `engine.flyTo(rotation, {hop:
  {durationMs: hopDuration(arc)}})` (the hop returns to the zoom the controller is heading for, so
  the zoom is set first). Reduced motion: the controller snaps.
- Hold: `engine.onFrame` (the globe's 1 s clock tick renders a frame at rest) checks at most
  once per second of `now()`, and not during the flight. If the body has moved over 8 px from its
  target, or its box now meets an avoid rectangle (drawer opened, bar opened, window resized),
  solve again and `flyTo` without a hop.
- Release: no button pressed, `holdAmbient(false)`, stop checking. Never moves the camera.
- Time is the sky's `now` from `loadClock()`; no `Date.now`, no timer of its own.

## Names in the sky

A pointer over bare sky near the Sun, the Moon or a drawn planet shows its name in a small glass
chip above it ("Mars · Planet"), as northguild.dev names its sky; below it near the window's top,
kept 4 px inside the window's sides (`lib/sky-names.ts`, `sky-names.module.css`, a manual popover
like the zone card). Reach past the disc: 12 px for a mouse, 28 px for a touch, whose name stays
until the next tap. It follows its body on globe frames and goes over the copy and controls, under
a drag or any globe gesture but a tap, on scroll or leaving the window, and in forced colours. A
body behind the Earth or a planet behind the Moon is not named. `aria-hidden`: Look at names the
same bodies to every reader. Tests: `sky-names.test.ts`.

## Tests

- `sky-aim.test.ts`: six instants × both bodies × three lenses (1440×900 with a right-hand
  drawer rectangle, 1280×720, 390×844 with a bottom sheet rectangle): the body lands within 2 px
  of the target and clear of every rectangle; the zoom is the largest that fits; a 200×200 lens
  covered by one rectangle gives `null`. The Moon's answer differs from a geocentric aim by over
  1°. `subBodyPoint("sun")` equals `subsolarPoint`; `subBodyPoint("moon")` equals the old
  `places.ts` result at three instants.
- `controller.test.ts`: held, no spin after `2 × IDLE_MS`; released, the spin starts after
  `IDLE_MS`; `ambient: false` or reduced motion never spins.
- `sky-view.test.ts` (fake engine, fake timers, jsdom): the markup is one disclosure in the
  given container holding one bar with a button per `SKY_BODIES` row, in its order; choosing
  Moon calls `holdAmbient(true)`, `setZoom`, then `flyTo` with the hop, closes the bar and
  presses Moon; choosing Sun switches; choosing Moon while it is held releases without a camera
  call; an `aria-disabled` button does nothing; `release()` presses none; a 9 px drift re-aims once without a hop, a 7 px drift does
  not; two frames in one second check once. `afterEach` aborts the signal and calls `destroy()`;
  `vi.getTimerCount()` is 0 and the fake engine holds no callbacks.

## Gate checks (`hero-space`, clock pinned at `SKY_PINS.half`)

- `sky-view`, in Europe/Helsinki and Africa/Nairobi, 1440×900: open Look at, choose Moon, wait
  for `data-sky-view="moon"` on the hero and the flight's end. From `data-sky-bodies`, the Moon's
  disc is 16 px inside the Earth's area, outside the Earth's disc, and misses the copy, drawer and
  zoom-stack boxes. Repeat for Sun with its glare radius. The panel is closed and focus is on the
  Look at button.
- `sky-view-hold`: after `page.clock.runFor(5_000)` the Moon has moved no more than the sky's own
  turn (360 degrees in 86 164 s, scaled by the lens from the Earth's disc and the Moon's angle off
  the axis, a quarter over, and always under the 8 px re-aim). After `runFor(600_000)` it is in
  clear sky.
- `sky-view-release`: a drag presses no body and `data-sky-view`; after `runFor(3_000)` the
  camera has turned under `SPIN_DEGREES` (0.6) when the view's lens zoom, read from
  `data-sky-camera` before the drag, was above rest zoom (no spin), or `SPIN_DEGREES` or more when
  it was rest zoom (the spin is back). After the zoom stack's rest button and `runFor(3_000)` it
  has turned 0.1 degrees or more.
- `sky-view-again`: choosing the held body again clears `data-sky-view` and the camera's rotation
  is unchanged within 0.01 degrees over the next frame.
- `sky-view-still`: the Look at button's bounding box, closed, open and with a body held, matches
  within 0.5 px, and the other zoom buttons do not move; the open bar lies inside the hero and
  the window, off the zoom stack, and no shown tooltip covers it (`barPlacement`, also run by
  `sky-view-phone`).
- `sky-view-reduced`: under `reducedMotion: "reduce"`, the Moon is in place on the next frame.
- `sky-view-phone`, 390×844, sheet closed: Look at opens over the sky bay inside the hero;
  choosing Moon, then Sun, puts each in the sky bay above the fold, clear of the zoom stack and
  every copy cell; the sheet stays closed.
- `sky-view-keys`: Tab to Look at, Enter opens, Tab reaches the Sun's button; Escape closes the
  bar and focus returns to the toggle; reopen, Tab twice and Enter press Moon.
- `sky-view-forced`: under `forcedColors: "active"` Look at is not rendered visible.
- `sky-names`, 1440×900: hovering the held Moon, the Sun, then a planet chosen in the bar shows
  its name centred above it in the top layer, inside the window, the planet's with " · Planet";
  over the copy it goes. `sky-names-phone`, 390×844: a tap 20 px off the Moon names it.

## Duplication pass (dox-tester)

- `rg -n "Math\.asin\((1 / |RIM)" apps/dox/src --glob '!*.test.ts'` → one hit, `EARTH_HALF_ANGLE_DEG` in `globe/pinhole.ts`.
- `rg -n "role=\"(listbox|option)\"|aria-(expanded|selected)=" apps/dox/src/lib/sky-view.ts`
  → no hit (the kit renders the disclosure; the bar's buttons are written as the stack's are).
- `rg -n "getBoundingClientRect" apps/dox/src/lib/sky-view.ts apps/dox/src/lib/sky-aim.ts`
  → no hit (rectangles arrive as `avoid`).
- `rg -n "function heroAvoidRects|heroAvoidRects\(" apps/dox/src --glob '!*.test.ts'` → defined once in `hero-space.ts`; the meteor and `heroAimFrame` both call it.
- `rg -n "setInterval|Date\.now" apps/dox/src/lib/sky-view.ts apps/dox/src/lib/sky-aim.ts` → no hit.
- `rg -n "View Sun|View Moon|Sky view" apps/dox/src apps/dox/scripts` → no hit.
- `wc -l` of `sky-aim.ts`, `sky-view.ts`, `hero-frame.ts`: each under 400;
  `git diff --numstat origin/main -- apps/dox/src/lib/globe-mount.ts` adds no more than it removes.

## Definition of done

- `pnpm --filter @gmt/dox test -- sky-aim sky-view controller places hero-space globe-mount disclosure`
  passes; `pnpm --filter @gmt/dox lint` and `check` are clean.
- `pnpm --filter @gmt/dox gates --only hero-space,hero-phone,esc-cascade` passes, new checks
  included. No `it.skip`, `it.todo` or `it.fails` added.
- The duplication pass above returns what it says.
- **Owner viewing pass**, at his recorded window size, his own clicks, `pnpm dox:dev` already
  running: on `/`, open Look at, choose Moon, then Sun, then Sun again; drag the globe while a
  view is on; repeat at phone width in the browser's device mode with the sheet closed.
- `context/dox/built/tier-4-globe.md` "Controls and drawer": Look at in the zoom stack, the aim,
  the hold, the release rules, `holdAmbient`; one-line reason each.
