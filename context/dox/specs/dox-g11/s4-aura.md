# Slice 4 · Home aura

The owner's pick: **Ice cavern** (`aura` D), under the landing (`/`) only. Port its `start(c, bus)`
from the sound audition unchanged: six held sines (1318.5, 1975.5 and 2637 Hz, each at −4 and +4
cents) at gain 0.004 into a 4.5 s `hall`; a 73.4 Hz drone at 0.045; and `bell` glints every
1.6–4 s (`rand`, `hz`, `scheduler`). It returns its own stop function.

## What the reader hears

- Nothing until the first gesture on `/`. Then the aura fades in over 3 s (linear ramp on the
  audio clock) while the gesture's own Sonar ping plays at full level: no burst.
- After an in-site arrival where the browser allows audio at load (slice 1, unlock step 3), the
  aura fades in from the entrance's `t0` instead.
- It sits 12 dB under the cues (`aura` bus gain 0.25 of master), at whatever level the fader holds.
- Leaving the page, hiding the tab, muting, or turning the Aura switch off fades it out over
  0.6 s; returning, unmuting or turning it on fades it back in over 1.5 s.

## Files

Create:

- `src/lib/sound/aura.ts` + test: `startAura(ctx, master): { stop(fade): void }`. The Ice cavern
  `start` body behind its own bus gain. The glints use `kit.scheduler`: a 150 ms `setInterval`
  tick tops up 0.6 s ahead against `ctx.currentTime`, never a wall clock. `stop(fade)` ramps the
  bus to 0 over `fade`, then calls the voice's own stop function, which stops the held sources.

Modify:

- `src/lib/sound/engine.ts`: `loop("aura")` support; on `/` only (the landing's `HeroSpace`
  sets `data-aura` on `<html>`; the engine starts the aura if that attribute is present,
  `settings.aura` is true and `settings.muted` is false). It imports `aura.ts` dynamically, so
  no other page fetches it.
- `src/components/HeroSpace.astro`: the `data-aura` marker.
- `src/lib/sound/control.ts`: the Aura switch starts or stops the aura live on `/` (through
  `onSoundChange`, so another tab's change applies too).
- `scripts/sound-check.mjs`.

## Lifetimes and traps

- `visibilitychange` hidden: `stop(0.6)`, then the engine suspends the context; visible again:
  resume, then a fresh `startAura` with a 1.5 s fade. The scheduler interval never runs while hidden.
- `pagehide`: `stop(0)` and close; a `pageshow` from the back/forward cache with `persisted`
  restarts it after the next gesture, or at once if the context resumes.
- Cross-document view transitions: the old page's aura is cut by unload; the new landing fades
  its own in. No attempt to carry audio across documents.
- `a11y-media` flags infinite *animations* under reduced motion, not audio. Every visitor
  starts muted ([index § Decided](./index.md#decided)), so the aura is silent until the reader
  turns sound on.
- Memory: one shared noise buffer and one hall impulse per context, built once by `sharedFx`.

## Tests

- `aura.test.ts` with `fake-audio.ts` and fake timers: the bus ramps 0 → 0.25 over 3 s from
  the unlock time; six held oscillators at the picked frequencies and one drone start once;
  glint ticks schedule only inside the 0.6 s window and 1.6–4 s apart; `stop(0.6)` ramps to 0,
  stops every source and clears the interval (`vi.getTimerCount() === 0`); a second
  `startAura` after `stop` does not double the sources. Every test calls `destroy()` in `afterEach`.
- Engine: no `aura` import off `/`; switch off → no start; muted → no start; unmuting on `/`
  with the switch on starts it with a 1.5 s fade.

## Gate additions (`sound-check`)

- On `/`: no source before a gesture; after one, the aura bus gain rises over ~3 s; hiding the
  page (`page.evaluate` dispatching `visibilitychange` with `document.hidden` overridden, or a
  second tab) stops scheduling: no new `start(t)` for 2 s; showing it restarts with a fade.
- The Aura switch off then on, at ≥ 50rem inline and below 50rem in the popover: the bus fades
  out and back in, the track hides and shows with it; the saved `dox:sound` holds `aura` across a
  reload.
- On `/tools/zoned-earth/`: the panel shows no Aura switch and no track.
- On `/guides/conversion/databases/`: the aura module is never requested.
- LCP on `/` at 390×844, throttled: no worse than `main` + 100 ms.

## Definition of done

- [Gates every slice passes](./index.md#gates-every-slice-passes) are green.
- Listening pass at the size recorded in slice 1, Chrome on macOS: the owner opens `/`, presses
  once, hears the Ice cavern come in under the ping; switches tabs and back; flips the Aura
  switch; moves the fader; mutes; reloads muted and hears nothing.
  `innerWidth`×`innerHeight` = the size recorded in slice 1.
- `built/tier-3-sound.md`: the aura's bus level, fades, landing-only load and hidden-page stop.
