---
story: DOX-G11
issue: 515
status: approved
dox: none
---

# DOX-G11 · GMT sound effects

Give the site a sound world, made with the Web Audio API alone: a soft felt slide when a panel
opens or closes, a dust of crystal glints and a steel shing as the landing's pieces ice in and glint, a sonar ping on a button
press, an ice-cavern aura on the landing, and cues for Dox thinking and typing and for the tools'
controls, typing, loading, readiness and errors. Sound is **opt-in**: every visitor starts muted,
whatever their system asks, and the reader turns it on in the settings panel. Once on, nothing
plays before the first press or key, and that gesture brings the sound in without a jolt. A sound button
in the header on every page at every width opens a popover with a mute button, an ice fader and
an Aura switch, and the choice is kept across visits.
Site work in `apps/dox` only: no new Dox tool or chat pill, no `packages/gmt` change, no changeset.

## Phases

One PR. Each phase is a slice that `dox-builder` lands and `dox-tester` verifies before the next.

| # | Slice | What the reader hears or sees |
| --- | --- | --- |
| 1 | [Engine and sonar ping](./s1-engine.md) | The Sonar ping on button presses, after the first gesture; settings, unlock, the `sound-check` gate |
| 2 | [Sound control](./s2-control.md) | One header button, beside the theme toggle, that opens a popover with a mute button, the 11-notch Ice fader and the Aura switch |
| 3 | [Chrome cues](./s3-chrome-cues.md) | Felt slide on every panel open and close, the entrance's Crystal dust and shing, Ice snap toggles, Glass clink on copy |
| 4 | [Home aura](./s4-aura.md) | The Ice cavern aura on `/`, fading in on the first gesture |
| 5 | [Chat cues](./s5-chat-cues.md) | Sonar launch, Sonar idle, Morse, Ice bell, Low double buzz and Data blip keys on `/dox` |
| 6 | [Tool cues](./s6-tool-cues.md) | Glass tick detents, servo list ticks, Data blip typing, Servo spin-up loading, Lock-in ready, Low double buzz errors |

## References

- [`ref-controls.png`](./ref-controls.png): the owner's portfolio controls, inspiration only. The
  Dox control is our own: ice, space, 45° bevelled corners, no rounded arcs.
- The sound audition the picks came from. Each voice is a self-contained function over a small
  kit (`hz`, `rand`, `envelope`, `biquad`, `tone`, `noise`, `bell`, `hall`, `echo`, `scheduler`).
  Slice 1 ported the kit; each slice ported its picked voices' `play` or `start` bodies from it
  **unchanged**, keyed by the step id and letter below.

## Sound picks

The owner's picks. "Audition" is the step id and variant letter in the sound audition.

| Event | Picked voice (audition) | Hook (slice) |
| --- | --- | --- |
| Button, tab, chip or summary press that stays on the page | Sonar (`click` A) | `sonar.ts` delegated click (1) |
| Panel opens: mobile menu, zone drawer, `/dox` rail, any `[popover]`, Settings included | Felt slide (`open`) | kit `drawer`, `menu-button.ts`, `DoxPage.tsx`, popover `toggle` (3) |
| The same panels close | Felt slide, closing (`close`) | as above (3) |
| Landing pieces freeze in; chips and buttons glint | Crystal dust (`paint`), Steel shing (`glint`) | `hero-entrance.ts`, on each `animationstart` (3) |
| Mute button, Aura switch, a tool's switch | Ice snap (`toggle` C) | control and kit `switchField` (2) |
| Ice fader notch; slider or handle step | Glass tick (`detent` B) | kit `range` (2), kit `handle` (6) |
| A step through a list, by key or the reader's scroll | Servo tick by place (`listNext`, `listPrev`) | `list-step.ts` from `listbox`, `combobox`, `roving`, `scroll-ticks.ts` (6) |
| Copy succeeds | Glass clink (`copy` B) | kit `copy` primitive, code-block copy (3) |
| Landing aura (loop) | Ice cavern (`aura` D) | `aura.ts` on `/` only (4) |
| Chat question sent | Sonar launch (`send` C) | `DoxChat.tsx` (5) |
| Dox thinking (loop) | Sonar idle (`thinking`) | `DoxChat.tsx` `isWaiting` (5) |
| Dox typing, per streamed chunk | Morse (`stream` C) | `DoxChat.tsx` (5) |
| Answer complete | Ice bell (`done` C) | `DoxChat.tsx` (5) |
| Typing: every text field (composer, playground, tools, search) | Data blip (`key` C) | `typing.ts` by field kind (5, 6) |
| Widget loading over 150 ms | Servo spin-up (`loading`) | `widget-mount.ts`, `MountedWidget.tsx` (6) |
| Widget ready after a reader action | Lock-in (`ready` A) | as above (6) |
| A place or zone chosen on a globe: a tap, a zone row, a search pick | Sonar lock (`locate` A) | `globe-mount.ts` `onSelect` via `lockOn`, with the pin's rings; not the seeded zone (6) |
| Error: chat banner, NO SIGNAL from input, load failure, copy failure | Low double buzz (`error` B) | `DoxChat.tsx` (5), kit `readout`, `showUnavailable`, kit `copy` (3, 6) |
| Control design | Ice fader (`control` C) | [slice 2](./s2-control.md) |

A link pings on press like a button, and so does the theme toggle. A link to another page in this
tab waits 350 ms for its ping (`link-hold.ts`); one that opens a new tab keeps sounding in the hidden
tab. Pressing a `<summary>` in the sidebar is a press (the ping), not a panel.

## Kit pieces

- **`range` gains `look: "fader"`** (APG Slider, still the native `<input type="range">`): an
  11-notch bevelled track and a bevelled thumb, no riding chip ([s2](./s2-control.md#ice-fader)).
- **`switchField` gains `size: "small"`** (APG Switch, native checkbox `role="switch"`) for the
  Aura switch.
- **`button` gains `pressed`** (APG Button, toggle: `aria-pressed`) and an `icon`; the popover's
  mute button uses them.
- **Sound popover:** a native `[popover]` opened by the header button's `popovertarget`, like the
  data credits, so `esc-native.ts` enrols it. **Not kit:** the engine, cue bus and voices (`src/lib/sound/`).

## Rules for every slice

- **Audio clock only.** Every schedule, throttle and fade reads `AudioContext.currentTime`.
  No `Date`, `performance.now` or `event.timeStamp` (`date-ban.test.ts` holds the first two).
  `setTimeout`/`setInterval` only as a delay or a scheduler tick, never as a clock read.
- **Autoplay.** No `AudioContext` is created while muted. Unlock creates or resumes the context
  synchronously inside the first activation event (`pointerdown`, `pointerup`, `keydown`,
  `touchend`, capture phase). Cues before unlock are dropped, never queued. The gesture's own
  cue plays; the aura fades in over 3 s. Detail: [s1 § Unlock](./s1-engine.md#unlock).
- **Starting state.** Muted, for every visitor; no system setting turns sound on or off. Level 5
  of 11; aura on, 12 dB under the cues. The reader's choice is saved in a versioned `dox:sound`
  record that fails closed ([s1 § Settings](./s1-engine.md#settings)).
- **Off first paint.** `cue.ts` is the only module on every page's critical path; the engine and
  voices load on idle or on the first gesture; the aura loads on `/` only.
- **Hold still.** The header's items, the sound button and the popover keep their boxes while the reader drags.
- **No left-border accents; bevelled 45° corners** on the track, thumb, mute button and popover.
- **React stays inside `/dox`.** Chrome cues are plain DOM; `DoxChat.tsx` calls `cue()`.

## Performance budget

- `cue.ts` + `settings.ts` ≤ 1.5 KB gzipped; engine + kit + voices ≤ 8 KB; `aura.ts` ≤ 3 KB.
- LCP on `/` at 390×844, throttled, no worse than `main` + 100 ms; CLS stays 0.
- Every source node stops after its release; the aura schedules nothing while the page is hidden.

## Accessibility budget

- The header button is a native `<button popovertarget>` named "Sound" with `aria-expanded`; in
  the popover the mute button is a native `<button aria-pressed>` named "Mute sound", the fader a
  native range named "Volume" with `aria-valuetext`, and the switch a native `role="switch"`
  named "Aura". All reachable by Tab, with visible focus, at every width; opening moves focus
  to the mute button and Escape returns it to the header button.
- Every cue doubles a visible change; reduced motion drops cues of animations it removes.

## Gates every slice passes

- `pnpm run validate`, run after `eval "$(fnm env)" && fnm use`.
- `pnpm --filter @gmt/dox gates --only sound-check,readout-still,esc-cascade,a11y-axe,a11y-tab-walk,a11y-media`;
  the a11y gates on `/`, `/guides/conversion/databases/`, `/tools/zoned-earth/`, `/dox/`, both themes.
- `html-diff` and `visual-diff` against a `main` baseline (`visual:before`) taken before slice 1;
  the only expected diff is the header's sound group.
- Test lifetimes: every test that mounts the engine, the aura, the control or a scheduler uses
  `src/test/fake-audio.ts` and fake timers, and calls `destroy()` in `afterEach`, which clears
  intervals, removes listeners and closes the context; `vi.getTimerCount()` is 0 after it.
- **The owner's listening pass:** Chrome on macOS, the window filling his laptop screen, his own
  clicks. The first pass records `innerWidth`×`innerHeight` in slice 1's done list; every later
  pass, his and `dox-tester`'s, runs at that size.

## Decided

- Reduced motion starts muted; the saved choice wins after the first one. No other system
  setting changes the default; iOS's silent switch is honoured by `navigator.audioSession.type
  = "ambient"` where supported.
- Aura on the landing only, with its own switch saved in `dox:sound`.
- Moving the fader while muted unmutes at the new level: moving the volume asks to hear it.
- A cue before the first press is dropped. A link pings on press, wherever it goes.

## Close-out

`built/tier-3-sound.md` holds the sound tier (engine, cue bus, unlock, settings key, voices,
gate, traps) and its "Not doing" entry on audio stays. `reference/visual-design.md` § Controls
gains the fader look. The finalizer folds Decided into `issues/DOX-G11.md` and deletes this
folder. Tracker Status changes only at close.
