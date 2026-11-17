# Slice 3 · Chrome cues

The cues every page shares, each ported from `audition.html` unchanged:

- **Steel breath** (`open` K) when a panel opens, **Steel breath in reverse** (`close` K) when it closes;
- **Steel whisper** (`paint`) as each landing piece freezes in, **Steel shing** (`glint`) as the light
  crosses a chip or button, each shing a touch higher (they replaced the audition's Freeze crackle);
- **Ice snap** (`toggle` C) on tool switches (slice 2's kit hook); the theme toggle plays the
  Sonar press ping like any button;
- **Glass clink** (`copy` B) when a copy succeeds.

The press ping is slice 1's; this slice only marks the elements that fire their own cue.

## Files

Modify:

- `src/lib/sound/voices.ts`: `open`, `close`, `paint`, `glint`, `copy` (`toggle` is slice 2's).
- `src/widgets/builders/drawer.ts` (`wireDrawer`): `cue("open")`/`cue("close")` when
  `data-open` changes by the reader's action (button, Escape, outside press), not on mount; the
  drawer's toggle button gets `data-cue`.
- `src/lib/menu-button.ts`: the mobile sidebar fires `open`/`close` on its state change; the
  toggle gets `data-cue`.
- `src/components/ask/DoxPage.tsx`: the `/dox` widget rail fires `open` when `railWidget` goes
  from null to a widget, `close` when it returns to null; swapping one widget for another is
  `ready` (slice 6), not open. The buttons that open and close it get `data-cue`.
- `src/lib/sound/native-panels.ts` + test, imported by the engine: one capture-phase `toggle`
  listener on `document` fires `open`/`close` for every `[popover]` (the sound popover, data
  credits, licence popover). The buttons with `popovertarget` get `data-cue`. `<details>` are not
  panels: their summary press is the ping.
- `src/lib/hero-entrance.ts`: as it sets `run`, start `entranceSounds(root)` (below); stop it when
  the entrance ends or aborts. On a first visit `t0` comes before any gesture and the engine is not
  running, so the entrance is silent; after an in-site arrival with sound already allowed it plays.
- `src/components/ThemeSelect.astro`: no cue of its own and no `data-cue`; the press ping covers it.
- `src/widgets/primitives/copy/*`: on `COPIED_TEXT` fire `cue("copy")`; on `FAILED_TEXT`
  fire `cue("error")` (the voice arrives in slice 5; until then the event is unheard). The copy
  button gets `data-cue`.
- `src/lib/sound/sidebar-cue.ts`, called from `cue.ts` and tested in `cue.test.ts`: the left sidebar's arrival cue.
  A page that shows Starlight's sidebar after one that did not plays `open`; the reverse plays
  `close`; staying plays nothing. The previous page is a `sessionStorage` flag every page writes at
  load and on a back/forward-cache restore; only a shown (wide) sidebar counts; another origin,
  reduced motion and muted are silent. The cue waits for a running context and is dropped after
  1.5 s. Slice 1's unlock tries at load after any in-site arrival, so Chrome plays it.
- `src/lib/sound/code-copy.ts` + test, imported by the engine: a delegated `click` on
  `.expressive-code .copy button` (Starlight's code-block copy, whose markup we do not own)
  fires `cue("copy")`. Slice 1's press hook adds that selector to its `[data-cue]` exception.
- `src/lib/sound/entrance.ts` + test: `entranceSounds(root)`.
- `src/lib/sound/link-hold.ts` + test, called from the press hook: a same-tab link whose ping was
  heard navigates 350 ms later, so the page change does not cut the ping.

## Entrance timing: the animations' own starts

The entrance offsets live in `src/styles/gmt-entrance-freeze.css` and are neither read nor
restated. `entranceSounds` listens for `animationstart` while `data-entrance="run"`: a freeze,
frost, pop or sweep is a whisper, `ng-glint` a shing, `ng-fade` only on the pager and
`ng-freeze-fly-left` only on the first panel. The events of one frame make one whisper and one
shing at most. Reduced motion is silent.

## Rules

- A cue doubles a visible change, never replaces one; it fires after the state change is
  committed, so a cancelled action is silent.
- A panel opened by script on load (a restored state) is silent; only reader actions sound.
- Escape closing a layer fires that layer's `close` once (the cascade closes one layer per press).
- Sidebar navigation links and pagination links are links: the ping on press.
- Every element that fires its own cue carries `data-cue`, so slice 1's ping never doubles it.

## Tests

- `sonar.test.ts`: each element this slice marks plays its own cue and no `click`.
- `drawer.test.ts`, `MobileMenuToggle.test.ts`: open and close cues on reader actions, none on mount.
- `native-panels.test.ts`: a popover `toggle` event fires `open`/`close`; listener removed by
  the abort signal in `afterEach`.
- `code-copy.test.ts`: a code-block copy press fires `copy` and no `click`; listener aborted in `afterEach`.
- `entrance.test.ts`: one whisper per frame; glint ranks rise; the pager and first panel heard, the
  sky's fade and a later page turn not; silent once done, after stop and under reduced motion.
- `link-hold.test.ts`: same-tab links wait 350 ms; new tab, download, hash jump, no-referrer,
  modifier keys and a handled press are left to the browser; the newest of two presses wins.
- `DoxPage` render test: null → widget is `open`, widget → null is `close`, widget → widget is neither.

## Gate additions (`sound-check`)

- `sidebar arrival` (Chromium, no autoplay flag): a click from `/` to a guide starts a running context
  and opening Steel breath on the guide; the Home link back starts closing Steel breath.
- After unlock on `/guides/conversion/databases/`: the mobile menu at 390 px plays opening
  then closing Steel breath (button and Escape); the theme toggle plays the Sonar ping once.
- Below 50rem, the Settings gear plays the Sonar ping and its panel the opening Steel breath;
  Escape closing it plays the closing Steel breath.
- On `/` after an in-site arrival in Chromium with autoplay allowed by flag: a whisper within 40 ms
  of each painted piece's delay and a shing of each glinted one, glint pitch rising; with reduced
  motion, none.
- On `/tools/zoned-earth/`: a copy button plays Glass clink once; on a guide, a code-block copy
  plays Glass clink once and no Sonar.

## Definition of done

- [Gates every slice passes](./index.md#gates-every-slice-passes) are green.
- Listening pass at the size recorded in slice 1, Chrome on macOS: the owner opens and closes
  the mobile menu, the zone drawer, the `/dox` rail and the data credits; toggles the theme;
  copies a code block; and navigates from a guide back to the landing to hear the entrance.
  `innerWidth`×`innerHeight` = the size recorded in slice 1.
- `built/tier-3-sound.md`: which hook fires which cue, the `data-cue` rule, entrance timing
  read from computed style.
