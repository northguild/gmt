# Slice 4 · Natural colours

Part of [DOX-G16](./index.md). Paths are under `apps/dox/`. Builds on slices 1 and 2 (the
painters and the maps) and the shipped Earth look (`built/tier-4-globe.md`, Earth imagery).

## What the reader sees

The drawer's settings keep one look switch, now labelled **Natural colours** in a fieldset
legended **Look** (it was "Natural Earth" under "Earth"; the old label also clashed with the
Natural Earth dataset in the credits). It sets the look of all three bodies at once:

| Body | Default (off) | Natural (on) |
| --- | --- | --- |
| Earth | the duotone photo with the vector overlay (unchanged) | the photograph's own colours, no overlay (unchanged) |
| Moon | the map's brightness tinted to `ICE_TINT` | the map's own colour |
| Sun | the photo's levels tinted to `ICE_TINT` | the photo's own near-white levels, untinted |

The glare is the same in both. A flip recolours every globe and sky on the page in place, the
talk deck's stage included, with no reload. The saved choice is on `<html>` before first paint,
so nothing flashes. Under `prefers-contrast: more` and `forced-colors` the switch is hidden and
the bodies paint the default look whatever is saved, as the Earth photo is already off there:
a hidden switch never leaves a look the reader cannot change.

## Decided

- **(a) Rename, no shim.** `data-earth="natural"` on `<html>` becomes `data-look="natural"`, and
  `dox:earth` becomes `dox:look`. The choice now covers three bodies, and `data-earth` already
  means the Earth imagery URL on the deck's host (`Deck.astro`, read by `slides/stage-boot.ts`),
  so one name carried two meanings. Users are internal: an old `dox:earth` value is ignored, and
  a reader who chose natural picks it once more.
- **(b) When the switch is offered.** `lookSwitchOffered({imagery, renderer, skyTextured,
  contrast, forced})` is true when the WebGPU Earth photo is drawn (`renderer === "webgpu"` and
  `imagery > 0`, today's rule) **or** a body's map is drawn on this page's sky (`skyTextured`),
  and always false under raised contrast or forced colours. So the canvas-2D fallback on `/` now
  offers it once the body maps are ready; `/tools/zoned-earth/` (no sky) behaves as today.

## Files

Rename (`git mv`; contents edited as below):

- `src/lib/earth-look.ts` → `src/lib/look.ts`, and its test. Exports `Look = "ice" | "natural"`,
  `LOOK_ATTRIBUTE = "data-look"`, `LOOK_STORAGE_KEY = "dox:look"`, `currentLook(root?)`,
  `setLook(look, root?)`. `storedEarth` is dropped: only its own test reads it (rule 8).

Modify:

- `src/components/ThemeProvider.astro`: the inline pre-paint read uses `'dox:look'` and sets
  `dataset.look`; its comment points at `src/lib/look.ts`.
- `src/styles/gmt-tokens.css` (about line 622): the selectors and comment use `data-look` and
  "Natural colours". If the deck's stage re-declares the two imagery tokens on its own island,
  as the hero's does, name it in the selector list too.
- `src/lib/globe/globe-theme.ts` (185 lines, already home of `readTheme`): `THEME_ATTRIBUTES`
  moves here from `globe.ts` (line 184), now `["data-theme", LOOK_ATTRIBUTE]`, with
  `watchTheme(callback, signal)`: one `MutationObserver` on `<html>` for those attributes,
  disconnected when the signal aborts. `globe.ts` lines 815-822 become one call.
- `src/lib/globe.ts`: its observer becomes `watchTheme`; `earthSwitchOffered` becomes
  `lookSwitchOffered` (decision b) and `syncEarthSwitch` `syncLookSwitch`. `GlobeParts` gains
  optional `skyTextured: () => boolean`; the frame-loop sync already re-checks every frame.
- `src/lib/hero-space.ts`: passes `skyTextured` from the sky handle (`data-sky-maps="ready"`).
- `src/lib/slides/stage-boot.ts`: `watchTheme` re-reads the theme, calls `engine.setTheme`, and
  repaints the sky. Today the stage reads the theme once at boot, so the deck missed a flip.
- `src/lib/space-sky.ts` / `src/lib/sky.ts`: the sky takes `watchTheme` too; a change clears the
  body cache and redraws once.
- `src/lib/sky-bodies.ts`: the cache key gains the look; `currentLook()` is read per paint key,
  and forced to `"ice"` under `(prefers-contrast: more)`.
- `src/lib/body-paint.ts`: both painters take `look`. Moon, natural: the map's RGB through the
  256-entry sRGB-to-linear table, times the shading, back to sRGB; the night side the same times
  earthshine. Sun, natural: the grey level as neutral white (r = g = b). Ice: as slices 1 and 2.
- `src/lib/zone-filter-ui.ts`: `setEarthAvailable` becomes `setLookAvailable`; the switch's
  axis `name` becomes `"look"`. `src/widgets/families/zones/zone-filters.ts`: legend "Look",
  label "Natural colours".
- Tests that name the old pieces: `zone-filter-ui.test.tsx`, `globe.test.ts` if it covers the
  offer, `src/test/stage-fixture.ts` only if it sets the `<html>` attribute (its deck-host
  `data-earth` is the imagery URL and stays).
- `scripts/hero-space-check.mjs`: the checks below.

## Tests

- `look.test.ts`: set and read both looks; a throwing `localStorage` leaves the page attribute
  right and throws nothing; `ice` removes the attribute and the key.
- `globe-theme.test.ts`: `watchTheme` fires once per `data-look` or `data-theme` change, never
  for another attribute, and never after its signal aborts.
- `globe.test.ts` (or the offer's own file): `lookSwitchOffered` over the eight combinations of
  photo drawn, sky textured, contrast and forced colours; true only with photo or sky, and
  neither media query.
- `body-paint.test.ts`: a red synthetic Moon map paints red pixels in `natural` (r over g and b
  by at least 40/255) and `ICE_TINT`'s hue in `ice`; the Sun's centre in `natural` has
  r = g = b within 1/255; under `ice` both match slices 1 and 2 byte for byte.
- `sky-bodies.test.ts`: a look change repaints each body once; under raised contrast (stubbed
  `matchMedia`) a `natural` page paints `ice`.
- `zone-filter-ui.test.tsx`: `getByRole("switch", {name: "Natural colours"})` inside a group named
  "Look"; flipping it sets `data-look` and `dox:look`; `setLookAvailable(false)` hides the
  fieldset and moves focus out of it, as today.
- A `stage-boot` test on `src/test/stage-fixture.ts`: flipping `data-look` calls the engine's
  `setTheme` once and repaints the sky; aborting the deck's signal disconnects the observer.
- Lifetimes: every test aborts its controller in `afterEach`; observers are disconnected and
  `vi.getTimerCount()` is 0.

## Gate checks (`hero-space`)

- `look-flip`: `/` at 1440×900, dark, the clock at `SKY_PINS.half`, maps ready, Look at › Moon
  held. Flip "Natural colours" by click: within two frames the Moon's mean lit-pixel
  (b − r) drops by at least 6/255, the Sun (at `SKY_PINS.clear`, Look at › Sun) reads r = g = b within
  2/255 at its centre, and the globe canvas changes; `performance.timeOrigin` is unchanged (no
  reload). Flip back: all three return within 2/255 of the first reading.
- `look-first-paint`: with `dox:look=natural` set by `addInitScript`, `<html>` carries
  `data-look="natural"` in the first `requestAnimationFrame` callback, and the first sky frame
  with maps ready paints the natural Moon. With nothing stored, no `data-look` at that frame.
- `look-offered`: the switch is visible on `/` with WebGPU; with WebGPU off (the canvas-2D
  fallback) it is hidden until `data-sky-maps="ready"`, then visible; hidden under
  `contrast: "more"` and `forcedColors: "active"`; on `/tools/zoned-earth/` exactly as on `main`.
- `look-still`: the switch row's bounding box, on and off, matches within 0.5 px.

## Duplication pass (dox-tester)

- `rg -n "data-earth=\"natural\"|dox:earth|earth-look|EarthLook|setEarth|earthSwitchOffered" apps/dox/src context/dox/built` → no hit.
- `rg -n "new MutationObserver" apps/dox/src/lib/globe.ts apps/dox/src/lib/slides apps/dox/src/lib/space-sky.ts apps/dox/src/lib/sky.ts apps/dox/src/lib/sky-bodies.ts`
  → no hit (one observer, in `globe-theme.ts`).
- `rg -n "dox:look" apps/dox/src` → two hits: `look.ts` and `ThemeProvider.astro`.
- `rg -n "Natural Earth" apps/dox/src/widgets apps/dox/src/lib/zone-filter-ui.ts apps/dox/src/lib/globe.ts apps/dox/src/styles`
  → no hit (the dataset credit in `data-credits.ts` keeps its name).
- `wc -l` of every file this slice touches that was under 400 on `main` stays under 400.

## Definition of done

- `pnpm --filter @gmt/dox test -- look globe-theme globe body-paint sky-bodies zone-filter-ui stage-boot`
  passes; `pnpm --filter @gmt/dox lint` and `check` are clean.
- `pnpm --filter @gmt/dox gates --only hero-space,a11y-media` passes, the four checks above
  included. No `it.skip`, `it.todo` or `it.fails` added.
- The attribute flip recolours the Earth, the Moon and the Sun without a reload (`look-flip`).
- The saved choice applies before first paint with no flash (`look-first-paint`).
- The label reads "Natural colours" in a group named "Look" (`zone-filter-ui.test.tsx`).
- The switch is offered exactly per decision (b) (`look-offered`, the offer's truth table).
- **Owner viewing pass**, at his recorded window size, his own clicks: on `/`, Look at › Moon, flip
  Natural colours on and off, then Look at › Sun and the same; reload with it on and watch for a
  flash. Then open the deck's "A day off" slide, build 2: the Moon shows the saved look. (A flip
  in another tab does not repaint an open page; no storage listener is added.)
- Close-out: `context/dox/built/tier-4-globe.md` line 57 is rewritten for "Natural colours",
  `data-look`, `dox:look`, `watchTheme` and the offer rule, one-line reason each;
  `built/tier-4-zones.md` line 19 names "Natural colours" and `setLookAvailable`.
