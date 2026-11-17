# Slice 5 · Chat cues

Sound for Dox on `/dox`, each voice ported from `audition.html` unchanged:

- **Sonar launch** (`send` C) when the question leaves;
- **Hum pulse** (`thinking` B), a loop while Dox thinks;
- **Morse** (`stream` C) per streamed chunk, **Ice bell** (`done` C) when the answer completes;
- **Low double buzz** (`error` B) on an error, here and everywhere later slices fire `error`;
- **Data blip** (`key` C) on the composer's keys.

React stays inside `/dox`; the component calls `cue()` and `loop()` from `src/lib/sound/cue.ts`,
which has no React import.

## Hooks in `src/components/ask/DoxChat.tsx`

The component already derives `isBusy` (`status` is `submitted` or `streaming`) and `isWaiting`
(`submitted`, or `streaming` while the last message is still the reader's).

| Moment | Cue | Where |
| --- | --- | --- |
| The question is sent | `send` | after `sendMessage(...)` returns in the submit handler |
| Dox is thinking | `loop("thinking")` start | an effect on `isWaiting` turning true |
| The first token arrives | thinking stop (0.15 s fade) | the same effect, `isWaiting` turning false |
| Each streamed chunk | `stream` | an effect on the last assistant message's text length growing; the engine's 60 ms gap thins it |
| The answer completes | `done` | `status` going `streaming` → `ready` with an assistant message last |
| An error banner shows | `error` | `onError`, beside `setWarning(classifyChatError(error))` |
| A key in the composer | `key` | `typing.ts` (below) plays it, as in every text field |
| Stop pressed | thinking stop, no `done` | the stop handler |

Rules:

- One thinking loop at a time; its stop function lives in a ref and runs in the effect's cleanup,
  so an unmount, a route change or a new question always stops it.
- `done` never follows an abort or an error.
- A restored conversation (from storage on load) is silent: cues follow live status changes only.
- Widgets the chat mounts into the rail sound through slice 6; the rail's open and close are
  slice 3.

## Files

- Modify `src/components/ask/DoxChat.tsx` (hooks above), `src/lib/sound/voices.ts` (Sonar
  launch, Morse, Ice bell, Low double buzz, Data blip), `src/lib/sound/engine.ts` (`loop("thinking")`),
  `scripts/sound-check.mjs`.
- Create `src/lib/sound/typing.ts` + test, loaded with the engine: one capture-phase `keydown`
  listener on `document` that fires `key` when the target is a text field (a `<textarea>`, a
  contenteditable element, or an `<input>` of type text, search, email, url, tel or number; never
  a password or read-only field), with no opt-in, for printable keys and Backspace, and Enter only
  where it types a line (a textarea or contenteditable); never while `event.isComposing` (IME),
  never on `repeat`, never with Ctrl or Meta held.
- Create `src/lib/sound/loops.ts` + test if the thinking loop does not fit `engine.ts` cleanly:
  Hum pulse's `start(c, bus)` (110 and 165 Hz through a 400 Hz lowpass, swelling at 1.1 Hz)
  ported unchanged, behind a bus gain that fades in over 0.3 s and out over 0.15 s before the
  voice's own stop function runs.

## Tests

- `DoxChat.sound.test.tsx` (new), with a spy on `cue`/`loop` and a mocked `useChat` status
  sequence: `submitted` starts thinking once; the first assistant token stops it; three text
  growths fire three `stream` cues; `ready` fires `done` once; an error fires `error` and no
  `done`; unmounting mid-stream stops the loop (the stop spy is called). Each test unmounts in
  `afterEach`; no real timers.
- `typing.test.ts`: a key in any text field fires `key`; a password or read-only field, a
  checkbox, a button and Enter in a one-line field fire nothing;
  `isComposing`, `repeat` and Ctrl/Meta chords fire nothing; the listener goes with the abort signal.
- `loops.test.ts` (if created): fake audio clock, fade-in and fade-out ramps, interval cleared on stop.

## Gate additions (`sound-check`)

On `/dox/` with the chat API stubbed by `page.route` to stream a fixed answer in 12 chunks:
Sonar launch once; Hum pulse runs until the first chunk and then stops; Morse starts are at
least 60 ms apart on the audio clock; Ice bell once; a 500 response plays Low double buzz and no
Ice bell. Composer typing plays Data blip; IME composition (`compositionstart` …
`compositionend`) plays none. A copy failure (stubbed `clipboard.writeText` rejecting) on a
tool page plays Low double buzz once.

## Definition of done

- [Gates every slice passes](./index.md#gates-every-slice-passes) are green, plus
  `DoxChat.progress.test.tsx` and the SSR tests unchanged.
- Listening pass at the size recorded in slice 1, Chrome on macOS: the owner asks Dox two
  questions, stops one mid-answer, types in the composer, and opens a widget from an answer.
  `innerWidth`×`innerHeight` = the size recorded in slice 1.
- `built/tier-3-sound.md`: one line on the chat cues and where they hook.
