# Slice 6 · Tool cues

Sound for the tools and playgrounds. Three new voices, ported from `audition.html` unchanged:
**Scan sweep** (`loading` B), **Lock-in** (`ready` A) and **Sonar lock** (`locate` A). The rest are already in: **Glass tick**
(`detent` B, slice 2), **Data blip** (`key` C) and **Low double buzz** (`error` B, slice 5).
Every hook is in a kit piece or shared mount code, so every tool gains it at once and no tool's
own file changes.

## Hooks

| Moment | Cue | Where |
| --- | --- | --- |
| A slider's value changes by the reader | `detent` | already in kit `range` (slice 2) |
| A drag handle crosses a step | `detent` | kit `handle` primitive, on each step change during a drag or arrow key |
| A key moves a list's active option (not at an end); the reader's own scroll passes a row | `detent` | kit `listbox` (keys and scroll) and `combobox` (its arrow keys); a scroll made by code is silent |
| A key in a playground or a tool's text field | `key` | `typing.ts` (slice 5) plays it for every text field; no field opts in |
| A client mount takes longer than 150 ms | `loading` | `widget-mount.ts` and `MountedWidget.tsx`: a 150 ms `setTimeout` (a delay only) fires `loading` unless the mount resolved first |
| A widget mounts after a reader action | `ready` | the same two places, on resolve; the engine's gap for `ready` is 400 ms, so a page of maps rings once |
| A readout falls to NO SIGNAL from reader input | `error` | kit `readout` primitive: in `#show`, a change from `live` to `sentinel` after the element's first render; never on the first render, never sentinel → sentinel |
| A widget fails to load | `error` | `showUnavailable` in `widget-mount.ts` |
| A copy fails | `error` | already wired in slice 3 |
| The reader chooses a place or zone on a globe: a tap, a zone row, a search pick | `locate` | `globe-mount.ts` `host.onSelect`, when `chosen`, through `host.lockOn`, so it sounds with the pin's lock rings (one per ping and echo heard, `sound/sonar-lock.ts`); the seeded zone and a cleared choice are silent |

Widgets mounted as the page loads come before any gesture, so their `loading` and `ready` are
dropped by the engine: the page is not noisy on arrival.

## Files

Modify:

- `src/widgets/primitives/handle/handle.ts`, `src/widgets/primitives/readout/readout.ts`
  (+ their tests).
- `src/widgets/builders/text-input.ts` (+ test): the typing test.
- `src/lib/widget-mount.ts` (+ test), `src/components/ask/MountedWidget.tsx` (+ test).
- `src/lib/sound/voices.ts`: Scan sweep, Lock-in.
- `scripts/sound-check.mjs`.

## Rules and traps

- A value set by script (a permalink restore, a preset, a linked control following another) is
  silent; only the control the reader moves sounds. The primitives already tell these apart
  where they dispatch `input` versus `change`; the cue goes with the reader-driven path.
- Readouts hold still: the cue changes nothing in layout. `readout-still` stays green.
- A drag across many steps in one frame fires one `detent` per frame at most (the engine's
  30 ms gap); the sound never lags the handle.
- The 150 ms loading timer is cleared on resolve, reject and the mount's abort signal.
- The primitives do not import the engine: they call `cue()` from `cue.ts`, which is already on
  the page.

## Tests

- `handle.test.ts`: a reader step fires `detent`; a programmatic set fires nothing; spy on `cue`.
- `readout.test.ts`: first render as sentinel → nothing; live → sentinel → `error` once;
  sentinel → sentinel → nothing.
- `widget-mount.test.ts`, `MountedWidget.test.tsx`: fake timers; a 100 ms mount fires `ready`
  only; a 300 ms mount fires `loading` then `ready`; a failure fires `loading` then `error`;
  aborting clears the timer (`vi.getTimerCount() === 0` after `afterEach` teardown).

## Gate additions (`sound-check`)

- `/tools/zoned-earth/` after unlock: an arrow key on a handle plays Glass tick once per step;
  typing an invalid date into a field plays Low double buzz once when the readout turns to NO
  SIGNAL and not again while it stays there; typing plays Data blip.
- A playground page: typing plays Data blip; IME composition plays nothing.
- `/dox/` with a widget opened from a stubbed answer: Lock-in once; with its chunk request
  delayed by `page.route`, Scan sweep then Lock-in.

## Definition of done

- [Gates every slice passes](./index.md#gates-every-slice-passes) are green.
- Listening pass at the size recorded in slice 1, Chrome on macOS: the owner drags a handle,
  arrows a slider, types in a playground, makes a readout show NO SIGNAL, opens a widget from
  Dox. `innerWidth`×`innerHeight` = the size recorded in slice 1.
- `built.md` Sound section: tool hooks, the reader-driven rule, the 150 ms loading delay; Tier 2
  kit entries for `range`, `handle`, `readout` and `textInput` mention their cue.
