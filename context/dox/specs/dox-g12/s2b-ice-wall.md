# Slice 2b · Ice wall: one clock becomes the whole planet

[Index](./index.md) · Binding rules: [Tier 4 · Engine](../../built/tier-4-globe.md#engine-srclibglobe),
[visual-design.md § Motion](../../reference/visual-design.md#motion). Builds on [slice 2](./s2-space-stage.md).

## Goal

The talk's spine in one move. On slides 2 and 3 a wall of six captured landing pages (Moment.js,
Luxon, date-fns, Day.js, Spacetime, @internationalized/date), each as captured, hangs in orbit between the camera
and the Earth. Stepping to slide 4 flies the camera through it: the panes shatter into ice shards,
twelve of them fly out and settle as clock pins on twelve zones, and the Earth turns once beneath,
every pin labelled with its local time. One clock becomes the whole planet. The wall is
presented neutrally, as the libraries people reach for; no text on the slide judges them, and
their marks appear only inside the captured, captioned snapshots, never as the deck's own art.

## Captures: `scripts/capture-wall.ts`

Run by hand with Node's type stripping, never in CI; its output is committed, like `hero-sky.bin`.
- Entries, in wall order: `momentjs.com`, `moment.github.io/luxon/#/`, `date-fns.org`,
  `day.js.org`, `spacetime.how`, `react-aria.adobe.com/internationalized/date/`. Each has a `clip` rectangle the owner sets so the site's clock emblem sits inside
  the frame. Playwright Chromium at 1280×800, DPR 1, `prefers-color-scheme` left as the site serves.
- `sharp` writes `public/slides/give-me-temporal/wall/<id>.webp` at 1024×640, quality 80 (budget
  ≤ 90 kB each). `src/slides/give-me-temporal/wall.json` gets `{ id, title, url, capturedAt,
  image, clock }`: `title` from the page's `<title>`, `capturedAt` an instant from gmt
  `getUtcNow` (`@northguild/gmt/utc/get`), `clock` the owner's yes or no after looking at the
  frame. Nothing in the JSON is typed by hand except `clock`.
- **No clock:** if a captured page shows no clock in its mark (Spacetime and @internationalized/date show none), the pane still hangs in the wall with
  `clock: false`, and the notes speak of the clocks on the others. The script never draws a
  clock onto a capture.
- A test (`wall.test.ts`) reads `wall.json`: every image exists and is within budget, every
  `url` is `https`, every `capturedAt` parses as an instant.

## In the slide

Slide 2's section holds a `<figure>` per pane: the same `.webp` as an `<img>` with alt text
("Landing page of momentjs.com, captured 2026-…") and a `<figcaption>` with the URL and the
capture date (gmt `formatZonedDateTime`, date only). This is the no-JS and print form, and on the
stage the captions sit in one row under the wall, in pane order. The 3D wall is drawn on its own
`aria-hidden` canvas; the figures are the accessible content.

## Kit addition: `getView()` on the engine

A read-only `getView(): { distance, focalPx, centre }` (the camera's 6.61 radii, the pinhole's
focal length in CSS pixels, the Earth's centre on the canvas), so the wall layer projects with
the globe's own lens. Nothing else in the engine changes for this slice.

## The wall layer: `src/lib/slides/ice-wall/`

- `voronoi.ts` (pure): `cells(seed, count)` returns convex polygons tiling the unit rectangle,
  built by clipping the rectangle by half-planes for each site (n² for n = 24; no new dependency).
  Sites come from a seeded generator (mulberry32 on the pane id), denser near the pane centre
  where the impact lands, so the shards there are small and the edges large: how ice breaks.
- `shards.ts` (pure): `shardPose(cell, seed, t)` returns position, rotation and opacity at `t`
  ms after impact as closed-form motion, with no integration state: outward from the impact plus
  toward the camera, spin about a seeded axis, velocity decaying as `e^(-t/600)`, fading out by
  1400 ms. Pinned shards (below) follow a second phase. Because the pose is a pure function of
  `t`, a replay is exact and a reset is `t0 = null`.
- `wall.ts`: `mountIceWall(layer, { engine, panes, signal })` returns `{ setDepth(z), breakAll(now),
  breakAt(x, y, now), reset(), destroy() }`. The wall sits in camera space, three 16:10
  panes down each side edge, perpendicular to the view axis, the centre left clear; it never moves with a globe hop.
- **WebGPU** when the globe runs on WebGPU: one pipeline drawing instanced thin prisms, the pane's
  texture on the front face, a frost tint and a fresnel edge highlight in the ice colours of the
  DOX-G2 freeze (`--gmt-ice`, the frost token), no blur. **Canvas-2D** otherwise and under
  `?globe=canvas2d`: each shard is a `Path2D` clip of the pane image, placed by the affine that
  maps three of its projected corners (small shards keep the perspective error under a pixel),
  with the edge drawn as a 1 px ice line.
- **Shard count:** 24 per pane, 96 in all: one instanced draw in WebGPU; 96 clipped `drawImage`
  calls in canvas-2D, measured by the gate. `SHARDS_PER_PANE` is one constant; if the canvas-2D
  frame budget fails, it drops to 16 and the gate runs again.

## Triggers and reset

- **Step to slide 4:** the hop from the wall's place to the twelve-zone view drives `setDepth`
  from the wall's resting depth to the near plane over the hop; at the moment the camera reaches
  the wall, `breakAll(now)`.
- **Free flight on slides 2 and 3:** E and Q move the wall nearer and farther along with the
  zoom. When the wall passes the break depth, the pane under the screen centre breaks alone
  (`breakAt`); the others stay until slide 4.
- **Reset:** the wall's state is `{ [pane]: t0 | null }`, derived from the deck state. Entering
  slide 2 or 3 from either side resets every pane to whole. From slide 5 on, or by a deep link to
  `#temporal`, the wall is not drawn and the pins are already lit. Stepping back from 4 to 3
  flies back out and the wall stands whole again.

## One clock becomes many: the pins

`PLANET_ZONES` in `places.ts`: the matrix zones read from `zone-matrix.json`
([slice 4c](./s4c-zone-matrix.md)) except `UTC`, which has no place, plus Helsinki, Madrid,
Lagos, Nairobi, Tehran, Tokyo, Manila, São Paulo and Mexico City, so the pins circle the planet
and the experiment slides after it reuse the same pins (a test holds every zone in `TZ_COORDINATES`). The
twelve-zone view centres the camera so twelve sit on the visible side.
- Twelve shards, the three largest of each pane, turn at 500 ms from ballistic flight onto a
  curve towards their zone's point (`engine.project`, read each frame because the Earth turns),
  shrink into a dot and hand over to the zone's `GlobeMarker` on arrival (by 1400 ms).
- Each marker's `label` is the city and local time, `Tokyo 03:14`, from gmt `getZonedNow(zone)`
  formatted `HH:MM`, refreshed on the minute, never animated. Labels hide while the globe moves,
  as the engine already does.
- Then the Earth turns once in 12 s (a one-off `steer`, then still), so the far-side pins come
  round lit. It does not repeat.
- **Worth it:** yes. It is the talk's thesis in one image, it costs one extra curve per pinned
  shard on paths that already exist (`project`, markers, labels), and it degrades to pins simply
  appearing.

## Reduced motion

No flying shards and no turn. On slide 4 the cell edges draw as ice-white cracks over the
panes for 150 ms, the wall fades over 200 ms, and every pin appears lit at once. Free
flight still breaks a pane, the same way.

## Tests

- `voronoi.test.ts`: the cells tile the rectangle (areas sum to 1 within 1e-9), each is convex
  and holds its site, and the same seed gives the same cells.
- `shards.test.ts`: pose at 0 is the cell at rest; opacity is 0 at 1400 ms; a pinned shard ends
  on its target point; the poses are deterministic.
- `wall.test.ts`: jsdom with a fake engine and canvas (`vi.mock`, `isolated` project); fake
  timers for the frame clock; `destroy()` and `abort()` in `afterEach` and no timer or
  animation-frame callback left after destroy; break, reset and deep-link states follow the deck
  state; reduced motion takes the crack-and-fade path.
- `slides-check.mjs` (canvas-2D): the shatter's frames stay within budget (median ≤ 17.5 ms, none
  over 34 ms); after 1.5 s no shard is drawn and twelve markers are lit; stepping back to slide 3
  shows the whole wall (a pixel probe at each pane centre matches its capture).
- `globe-smoke.mjs` (local, GPU): the same on WebGPU.

## Definition of done

- Slide 2 shows six captioned panes (three down each side edge, each caption on its own pane, the centre clear; the clocks in view where a page has one);
  slide 4 breaks them on the clicker, and the pins settle with local times on both renderers.
- Back and forward replay the shatter exactly; deep links land in the right state.
- Notes on slides 2 and 4 carry the line "one clock against the whole planet".
- Own tests, `pnpm dox:lint` and `pnpm dox:check` green; the owner's listening pass.
