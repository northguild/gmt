# Tier 3: sound

Part of [built/index.md](index.md). Web Audio only, in `src/lib/sound/`; every voice is synthesised, with no samples. Every voice is the owner's pick from a sound audition; its doc comment names the step and variant letter it came from.

## Rules

- **`cue.ts` is the only sound module on every page's critical path** (with `settings.ts`). `cue(name, rank?)` dispatches `gmt:cue` on `document` and returns whether the engine played it; `loop(name)` returns the stop. `cue.ts` reaches `engine.ts` only through `import()` on idle, and only when not muted. A cue with no engine listening is dropped; nothing queues.
- **No `AudioContext` while muted.** Otherwise capture-phase `pointerdown`, `pointerup`, `keydown` and `touchend` listeners on `window` create and `resume()` the context synchronously in the first activation event. Safari does not count a resume after an `await`. Creating a context anywhere else draws Chrome's suspended-context warning.
- **Audio clock only.** Every schedule, gap and fade reads `ctx.currentTime`. `setTimeout` and `setInterval` are a delay or a scheduler tick, never a clock read (`date-ban.test.ts`). The engine plays a cue at `currentTime + 5 ms`, or with the cue before it when that read the clock less than 5 ms earlier (the clock moves in audio blocks of about 2.7 ms, so two cues of one press can read either side of one), and drops one inside its gap (30 ms; `stream` and a zoom step 60, `key` 25, `ready` 400).
- **A suspended context takes a cue only inside a reader's gesture** (`navigator.userActivation.isActive`). A cue scheduled on a stopped clock would play late, in a burst, once it starts.
- **Sound is opt-in.** Every visitor starts muted, whatever the system asks (reduced motion included); only the reader's own mute button or fader turns it on. No system setting or other control reads or writes the choice.
- **The key `dox:sound`** holds `{ v: 1, level: 1–11, muted, aura, track }`. Default: muted, level 5, aura on, track `"ice"`. It fails closed: no record, corrupt JSON, another `v` (`SOUND_VERSION`) or a field of the wrong type reads as that field's default, so a bad record never turns sound on. Raise `SOUND_VERSION` when a field changes meaning. It is written only on a reader's choice. `ThemeProvider.astro` applies the same rule inline and sets `data-sound` on `<html>` before first paint; `settings.test.ts` holds that script equal to `readSound()`.
- **A choice storage cannot keep holds for the page.** Every storage access is in try/catch; a failed write keeps the choice in memory until a write lands or another tab's does. A page restored from the back/forward cache reads the key again on `pageshow`, since it missed `storage` events while frozen.
- **A hidden tab suspends 1.2 s later** (`HIDE_TAIL_MS`), so a link that opens a new tab is heard to the end of its ping, which rings on in its space. `navigator.audioSession.type = "ambient"` where it exists.
- **A control that fires its own cue carries `data-cue`**, so the press hook stays out. The Expressive Code copy button is not ours, so it is excluded by selector.
- **React stays inside `/dox` and the deck's Dox frame.** Chrome cues are plain DOM; `DoxChat.tsx` calls `cue()`.

## Who plays what

| Event | Voice (`CueName`) | Hook |
| --- | --- | --- |
| Link press | Distant sonar, 1050 Hz (`click`) | `sonar.ts`, capture `click` on `document` |
| Any other press: button, tab, `summary` | Distant sonar, the same (`press`) | as above |
| Panel opens or closes: any non-manual `[popover]`, the kit drawer, the mobile menu, the `/dox` rail, the sidebar on arrival | Felt slide, opening or closing: a noise swell with one low tone (`open`, `close`) | `native-panels.ts`, `drawer.ts`, `menu-button.ts`, `DoxPage.tsx`, `sidebar-cue.ts` |
| Landing pieces freeze in; a light crosses a chip | Crystal dust, two or three high glints (`paint`), Steel shing (`glint`) | `entrance.ts`, on `animationstart`; silent on an in-site arrival |
| Any kit switch, the mute button | Ice snap (`toggle`) | `data-cue`, `watchSwitchCue()` |
| Fader step, handle step | Glass tick (`detent`) | `range`, `handle` |
| List step by key or by the reader's scroll | Servo tick, sweeping down or up and pitched by the place in the list (`listNext`, `listPrev`) | `listStep()`/`stepTo()` in `list-step.ts`, called by `listbox`, `combobox`, `roving`, `scroll-ticks.ts` |
| Copy | Distant sonar, the same (`copy`) | `GmtCopy`, `code-copy.ts` |
| Error: chat, `NO SIGNAL` from input, a failed load or copy | Low double buzz (`error`) | `DoxChat.tsx`, `gmt-readout`, `widget-mount.ts`, `showUnavailable` |
| Typing in any text field | Data blip (`key`) | `typing.ts` |
| Chat send, thinking, streaming, done | Sonar launch, Sonar idle (a soft 587 Hz ping every 1.6 s), Morse, Ice bell | `DoxChat.tsx` |
| Widget loading over 150 ms, then ready | Servo spin-up, three rising bursts (`loading`), Lock-in (`ready`) | `startMountCues()` in `widget-mount.ts` |
| A place chosen on a globe or a classed map | Sonar lock (`locate`) | `globe.ts` `lockOn`, `feature-map.ts` |
| Globe zoom step | Lens servo (`zoomIn`, `zoomOut`) | the globe engine's `onZoom` |
| A globe or a feature map comes into view | Steel horizon (`appearGlobe`), Sonar dawn (`appearMap`) | `appear.ts` `cueOnAppear` |
| The landing's aura (loop) | Ice cavern or Deep drone | `aura.ts`, on `/` only |

## The settings control

- `SettingsControl.astro` renders `components/settings-control.ts`: a solid gear (Lucide `settings` with an even-odd hub, its view box cropped so it stands 19.5 px like GitHub's mark), last in the right group, named "Settings", with `popovertarget` on one `[popover]`. It replaces Starlight's `ThemeSelect`: there is no override and no copy in the mobile menu.
- The panel reads: a "Dark theme" switch, a hairline, the mute button beside an 11-notch fader (`range`, `look: "fader"`), the Aura switch, and the "Aura track" radio pair (`chips`, `kind: "radio"`) as one segmented control. The aura plays on the landing only, so the Aura switch and track show only where `<html>` carries `data-aura` (CSS in `settings-control.module.css`), and the track only while the switch is on; elsewhere the panel holds theme and volume.
- The gear is a northguild.dev item, so it carries `data-ping="sonar"` and pings like the links beside it; the panel breathes like every popover. Opening moves focus to the theme switch; Escape returns it through `esc-native.ts`.
- The mute button's speaker is drawn in CSS from `data-sound` on `<html>`, so it is right on the first frame. The panel is a top-layer box anchored under the button, right-aligned or centred where that would cross the 1rem gutter (`position-try-fallbacks`), so nothing in the bar moves.
- `theme.ts` saves a theme only while it differs from the system's and removes the key when it matches, so a reader who never chose follows the system live. A press always flips the shown theme.

## Native panel motion

Every non-manual `[popover]` (Settings, Data credits, the hive's info panel) comes and goes like the drawer (`gmt-primitives.css`, "Native panels: in and out"): a fade and a slide from `--gmt-panel-from` over 240 ms, with `@starting-style` and `display`/`overlay` held by `allow-discrete` so the close fades too. A `::after` sheen crosses on open and again on close; its name flips between `gmt-panel-sheen` and `gmt-panel-sheen-out` so each change restarts it. The same sheen layer ("The sheen of a panel that appears") crosses every `data-sheen` box: each floating disclosure panel as it shows (so the hero's Look at bar), and the hero's folded control stack each time it grows open. Reduced motion keeps the fade only; forced colours and more contrast drop the sheen.

## Behaviour code cannot show

- **A link waits for its ping.** Every route change is a full page load, which ends the audio. `holdLink()` (`link-hold.ts`) runs in a `window` bubble listener after every handler: if nothing took the press and it leaves this document in this tab, it cancels the click and calls `location.assign(href)` after 600 ms (`LINK_HOLD_MS`, the ping and the swell of its space). A modifier key, another `target`, `download`, a non-http(s) URL and a same-page hash go to the browser. Muted, nothing waits.
- **The press hook reads `composedPath()`, not `target.closest`.** A control that swaps its own icon in its handler detaches the clicked node. It listens in the capture phase because Starlight's Search stops its click from bubbling.
- **An in-site arrival has no entrance.** A landing reached from another page of this site starts `static` (`arrival.ts`): the reader has seen the buttons, so nothing freezes in and nothing plays. A reload, another site and northguild.dev get the whole entrance; in practice it is heard on an arrival from northguild.dev, whose same-origin activation unlocks audio at load.
- **The entrance restates no timing.** `entranceSounds()` hears each `animationstart`, so pieces that arm late are heard on their own start and a view-transition arrival's still header is silent. The copy is never heard: its freeze runs from the first paint, and the tagline's 0.12 s delay can end either side of `t0`, so its animations (`ng-freeze-text`, `ng-sweep-text`) are not listened for. At most one sparkle and one shing per frame; each shing a rank (4%) higher.
- **Sidebar arrival** reads and then writes `sessionStorage["dox:sidebar"]` as each page loads or is restored, so the flag holds the page just left. A `pagehide` write was rejected: mobile browsers that kill a page skip it.
- **The aura** sits behind one bus 12 dB under the cues, built once per context; each track has its own gain, so a track change crossfades over 1.5 s and Deep drone's ringing pads do not return with the next fade in. `DEEP_TRIM` keeps Deep drone's peak under Ice cavern's. `HeroSpace.astro` sets `data-aura` on `<html>`, and only there does the engine import `aura.ts` (about 1.3 KB gzipped). `pagehide` suspends the context; closing it would strand `cue.ts`'s reference.
- **Typing** counts printable keys and Backspace, and Enter only in a textarea or contenteditable. Never a password field (the sound would tell the room its length), a read-only field, `isComposing`, `repeat` or a Ctrl/Meta chord.
- **An aborted chat answer never rings the bell** (`endedEarlyRef`). A restored conversation never changes status, so it is silent.
- **Page shells mount before a gesture**, so their `loading` and `ready` cues are dropped by the engine; only `MountedWidget` (the `/dox` rail) uses `startMountCues()`.
- **The globe lock** rings one ripple per ping and per echo heard (`lockPulses()`: each pass keeps 38%, an echo 36 dB under a ping is lost). It plays at once when the pin is in sight, otherwise once the flight brings it near the centre, or at once if the reader moves first. The zone a widget is seeded with is silent.
- **Arrival cues** stay silent for an element in view before the reader's first gesture: a swell on the first click would sound like the click's. `APPEAR_GAP` (1.2 s) makes a globe and a map arriving together one sound.
- **Scroll ticks** arm only on the reader's own `wheel`, `touchstart` or `pointerdown` on the scroller (or a scroll key the browser handles); a key move's `scrollIntoView` is silent. Panes (the chat rail, the mobile menu, tables) do not tick.

## Gates

- `sound-check` (tier `pr`, three engines) logs `AudioContext` construction, state changes and oscillator starts through an init script. Its scenarios cover unlock, reduced motion, the control's placement and stillness at 320 to 1440 px, chrome cues, the entrance, the aura, chat (with `/api/chat` stubbed), tool cues, list ticks and the globe lock. `--only <name>` runs a subset. The rules that need running audio (`unlock`, `click`, `link`, `link-hold`, `chrome-cue`, `control-pop`, `control-still`) run on every engine on a Mac and on Chromium only when `CI=true`, because CI's Linux Firefox and WebKit have no audio sink and a context there never runs (`RUNNING_AUDIO` and `sinkless` in `scripts/lib/sound-scope.mjs`, tested by `sound-scope.test.ts`). The mute and no-autoplay rules hold on every engine in CI. The local WebKit run stands in for Safari.
- `rail-stored-still` (tier `pr`, `/dox/`) holds the saved rail width still from the first frame (`rail-prepaint.ts` paints it on `<html>` before hydration) and a double-click reset.
- `sound-peaks.browser.test.ts` renders the new voices in Chromium's `OfflineAudioContext` (20 seeded runs) and fails a voice louder than the audition sound the owner chose.

## Traps

- A test that needs to hear anything saves an opted-in record first (`saveSound()` in `src/test/sound-storage.ts`); `sound-check` does the same through an init script, except in scenarios marked `sound: "default"`.
- A test file that installs `src/test/fake-audio.ts` is isolated (`vi.stubGlobal`); tests assert on the recorded schedule, never on sound.
- jsdom's `localStorage` queues a timer per write under fake timers, so a test asserting `vi.getTimerCount() === 0` uses `installMemoryStorage()`.
- WebKit reports an `AudioContext` as `interrupted` for the moment the press that created it is starting it. `live()` in `engine.ts` treats `interrupted` like `suspended`: a gesture plays its own cue. Without that, a saved unmute played no voice on its first press in Safari.
- `control-keys` fails on macOS WebKit, whose Tab skips buttons. It is a result of this Mac's browser, not of the site, so a local WebKit run of `sound-check` reports it and every other rule passes. Do not weaken the rule for it.
- The leak guard fails a file that leaves a `window` or `document` listener, so each test tears `startCue()` and `createEngine()` down.
- `sound-check` reads a noise voice by its filter, since noise has no oscillator start: the Servo spin-up by its last burst's ramp to 1950 Hz, a list's servo tick by its burst and rising ramp target. A Felt slide is read by its low tone's fall (170 to 140 Hz opening, 150 to 120 Hz closing), a Crystal dust sparkle by tones of 5200 to 8000 Hz, and the Sonar idle by its 587 Hz pings, kept apart from the chat's cues.
