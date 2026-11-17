# Slice 1 · Engine and sonar ping

The plumbing every later slice fires into, plus the first audible cue: the **Sonar** ping
(`click` A) on a button press. Read [index § Rules for every slice](./index.md#rules-for-every-slice).

## Files

Create (each module with a `.test.ts` beside it):

- `src/lib/sound/settings.ts`: one `localStorage` key, `dox:sound`, holding
  `{ "level": 1–11, "muted": boolean, "aura": boolean }`. Exports `readSound()`, `writeSound()`,
  `onSoundChange(fn)` (same document, and other tabs through the `storage` event) and
  `SOUND_KEY`. Same pattern as `dox:earth` (`src/lib/earth-look.ts`). See [Settings](#settings).
- `src/lib/sound/cue.ts`: the only sound module on every page's critical path.
  - `type CueName` = the picks table's events (`click`, `open`, `close`, `entrance`, `toggle`,
    `copy`, `detent`, `key`, `send`, `stream`, `done`, `loading`, `ready`, `error`), plus the loops
    `aura` and `thinking` started through `loop(name)`, which returns a stop function.
  - `cue(name)` dispatches `CustomEvent("gmt:cue", { detail: { name } })` on `document`. With no
    engine listening (muted, not yet loaded or not unlocked) the event is unheard: dropped.
  - Unlock (below), and `import("./engine")` on `requestIdleCallback` (fallback `setTimeout(…, 1)`)
    unless muted.
- `src/lib/sound/kit.ts`: `hz`, `rand`, `noiseBuffer`, `envelope`, `biquad`, `tone`, `noise`,
  `bell`, `hall`, `echo`, `sharedFx`, `sonarEcho`, `scheduler`, ported from the audition's kit
  section as it stands, typed. `sharedFx` caches one hall, echo and noise buffer per context.
- `src/lib/sound/voices.ts`: `VOICES: Record<CueName, Voice | null>` where
  `Voice = (ctx, out, t) => void`. This slice ports **Sonar** (`click` A: a `tone` into
  `sonarEcho`) unchanged; each later slice adds its own picks.
- `src/lib/sound/engine.ts`: owns the `AudioContext`, the master gain and the voices.
  - Level → gain: `(level / 11) * 0.6`; muted ramps to 0 over 0.05 s, then suspends the context.
  - On `gmt:cue`: look up the voice, drop it if the same cue fired less than its minimum gap
    ago on `ctx.currentTime` (default 30 ms; `stream` 60 ms, `key` 25 ms, `ready` 400 ms), else play at
    `ctx.currentTime + 0.005`, or at the previous cue's start when it read the clock less than
    0.005 s earlier.
  - `navigator.audioSession.type = "ambient"` where the property exists (feature-detected).
  - `visibilitychange`: hidden → `ctx.suspend()`; visible → `resume()` if unlocked and not muted.
  - `destroy()`: removes every listener, stops loops, closes the context. Tests and the gate use it.
- `src/test/fake-audio.ts`: a fake `AudioContext` for jsdom: `currentTime` the test advances,
  `state`, `resume`/`suspend`/`close`, and node fakes that record `connect`, `start`, `stop` and
  every `AudioParam` automation call so tests assert on the schedule, never on sound.
- `scripts/sound-check.mjs` + its `scripts/gates/registry.mjs` entry (tier `pr`, chromium, webkit,
  firefox). An `addInitScript` wraps `AudioContext` to log construction, `state` changes and each
  voice's first node `start(t)` into `window.__sound`.

Modify:

- `src/lib/sonar.ts`: a second delegated `click` listener calls `cue("click")` for a press on
  `button`, `[role="button"]`, `[role="tab"]`, `summary`, any `<a href>` (one that goes to
  another page too; the page change may cut the tail), or anything the existing `SONAR_SELECTOR`
  matches, focused or not. Two exceptions:
  - an element with `[data-cue]` fires its own cue (slices 2 and 3 set it on the mute chip, the
    arrow, copy buttons, drawer and menu toggles): never both;
  - a `data-quiet-focus` hand-over is focus, not a press: no cue.
- `src/components/Head.astro`: import `~/lib/sound/cue` beside `~/lib/sonar`.
- `src/components/ThemeProvider.astro`: the inline pre-paint script reads `dox:sound` (in
  try/catch), applies [Settings](#settings), and sets `data-sound="on" | "off"` on `<html>`, so
  slice 2's chip paints right on the first frame.
- `src/lib/date-ban.test.ts` needs no change; `client-graph.test.ts` walks `src/lib/sound/` itself.

## Settings

- Default when nothing is saved: `{ level: 5, muted: true, aura: true, track: "ice" }`, for
  every visitor. Sound is opt-in; no media query reads into it.
- The record is `{ v: 1, … }`. No record, corrupt JSON, another `v` or a field of the wrong type
  reads as that field's default, so a bad record never turns sound on.
- `readSound()` and the pre-paint script apply the same rule; a test holds them equal.
- The key is written **only** on a reader's choice (the mute button, the fader, the Aura switch,
  the track). Nothing writes it at load.
- A write storage refuses keeps the choice for the rest of the page. A page restored from the
  back/forward cache reads the key again on `pageshow`.
- Every read and write is in try/catch (private windows throw); a bad value reads as the
  default; a `level` out of 1–11 clamps.

## Unlock

1. Muted: no context, no engine import. Unmuting is itself a gesture, so it unlocks.
2. Not muted: `cue.ts` adds capture-phase listeners on `window` for `pointerdown`, `pointerup`,
   `keydown` and `touchend` (the activation-triggering events). The first one calls `unlock()`
   **synchronously**: create the context if none (`new AudioContext({ latencyHint: "interactive" })`),
   call `resume()`, hand the context to the engine (or hold it until the engine module arrives),
   and remove the listeners once `state === "running"`. Safari does not count a resume after an
   `await`, so nothing awaits before `resume()`.
3. After an in-site arrival (`navigation.activation.from` same-origin, as `arrival.ts` reads it),
   try `unlock()` at load unless `navigator.getAutoplayPolicy?.("audiocontext")` answers something
   other than `"allowed"`. Chrome has no such API but lets a document reached by a same-origin
   navigation after a gesture start audio; where it refuses (Safari) the context stays suspended,
   the gesture listeners of step 2 keep waiting, and no console error is logged.
4. The gesture's own cue (the ping) is fired by its hook after unlock, in the same task, so it plays.
   If the engine module has not arrived yet, that one cue is dropped like any other early cue.
5. A cue fired before unlock is dropped. Nothing queues.

## Traps

- `cue.ts` must not import `engine.ts` statically; the size budget and LCP depend on it.
- A suspended `AudioContext` makes Chrome log a **warning**; gates fail only on console errors.
  Never create a context outside `unlock()` (that is what draws the warning).
- One context per document. View transitions are cross-document, so each page makes its own.
- jsdom has no `AudioContext`; every test installs `fake-audio.ts` and removes it in `afterEach`.
- The new click listener must not replace or reorder the existing re-ping; both stay in `sonar.ts`.

## Tests

- `settings.test.ts`: the muted default with and without reduced motion; a record with no
  version or another version reads muted; round trip with `v`; corrupt JSON; throwing storage
  (reads muted, keeps an unsaved choice for the page, drops it once a write lands); clamping;
  `storage` sync; `pageshow` from the cache; nothing is written by a read.
- `cue.test.ts`: no context before a gesture; the first `pointerdown` creates and resumes it
  synchronously; muted → no context and no engine import; a pre-unlock cue is dropped;
  listeners are gone once running.
- `engine.test.ts`: level → gain; mute ramps then suspends; the per-cue gap on the fake clock;
  hidden → suspend; `destroy()` leaves no listener and `vi.getTimerCount() === 0`.
- `kit.test.ts`: each helper schedules its envelope and stops its source after the release;
  `sharedFx` builds once per context.
- `sonar.test.ts` (new): button → `click`; tab and summary → `click`; navigating link →
  nothing; `#` link → `click`; `[data-cue]` → nothing from sonar; quiet focus → nothing; the
  re-ping still runs. Spy on `cue`, no audio; the listener goes with an abort signal in `afterEach`.
- Lifetimes: fake timers; every test calls `destroy()` and restores the globals in `afterEach`.

## `sound-check` (this slice's part)

On `/` and `/tools/zoned-earth/`, with storage empty: no context is ever constructed and
`data-sound="off"`. With sound saved on: no `AudioContext` is running before a gesture; the
first press runs one; a button press then starts the Sonar voice once; a navigating link press
starts nothing before unload. With sound saved on and reduced motion emulated: the press plays.
A saved mute survives a reload. No console error.

## Definition of done

- [Gates every slice passes](./index.md#gates-every-slice-passes) are green.
- `cue.ts` + `settings.ts` ≤ 1.5 KB gzipped and engine + kit + voices ≤ 8 KB in `pnpm dox:build`
  output; the engine chunk is absent from the first-paint requests on `/`.
- Listening pass: Chrome on macOS, the window filling the laptop screen. The owner presses
  buttons, tabs and a sidebar `<summary>` on a guide and hears the Sonar ping after the first
  press, and silence on a link. Record the size here: `innerWidth`×`innerHeight` = ____ × ____.
  Every later pass runs at that size.
- `built/tier-3-sound.md` holds: modules, the key and its default rule,
  unlock, the audio-clock rule, the press hook and its exceptions, traps.
