# Slice 2 · Sound control

The owner's pick: **Ice fader** (`control` C), in a popover under one header button. The popover
holds a mute button, an 11-notch bevelled fader and a small Aura switch. Its sounds are **Ice
snap** (`toggle` C) on the mute button and the switch, and **Glass tick** (`detent` B) on each
fader notch, ported from `audition.html` unchanged.

## What the reader sees

- **The button, at every width:** one icon button in the header, immediately to the right of the
  theme toggle and before GitHub, with the same look as the Dox button and the theme toggle
  (`gmt-icon-button`). A native `<button popovertarget="gmt-sound-pop">` named "Sound". Its icon
  shows the state: a speaker with waves when on, a slashed speaker when muted, drawn from
  `data-sound` on `<html>` (set before first paint, slice 1), so it is right on the first frame.
  Below 50rem the rest of the right group is in the mobile menu and this button is all the group
  shows, left of the menu button.
- **The popover:** a native `[popover]` anchored under the button with a full bevelled border,
  inside the viewport down to 320 px. Opening moves focus to the mute button; Escape closes it and
  focus returns to the button. It is a top-layer panel, so opening it and dragging the fader move
  nothing in the header.
- **Mute button:** one press toggles mute. A native `<button aria-pressed>` named "Mute sound",
  with the speaker icon; muted it reads pressed, is lit and shows the slashed speaker. The fader
  keeps showing the level it will return to.
- **Fader:** levels 1–11, 11 visible notches, starting at 5. Each notch the value crosses plays
  Glass tick. Moving it while muted unmutes at the new level ([index § Decided](./index.md#decided)).
- **Aura switch:** labelled "Aura"; on `/` it starts and stops the aura at once (slice 4 wires
  the live start); elsewhere it only saves the choice.
- Every press saves `dox:sound` (slice 1 § Settings); another tab follows through `storage`.
- GitHub, Discord and the theme toggle keep their northguild.dev pixels at every width.

## Ice fader

Kit `range` gains `look?: "default" | "fader"` (APG Slider; still the native
`<input type="range">`, which owns the role, name, keys and value):

- `min: 1`, `max: 11`, `step: 1`, `label: "Volume"`, `valueText` "Volume 5 of 11" (via
  `formatValue`; muted reads "Volume 5 of 11, muted").
- The fader look hides the riding chip (`data-gate="rider"` span gets `display: none`; the
  number is not shown, the notches are the scale) and the `ends`.
- Track: a bevelled (45°, `corner-shape: bevel` with a `clip-path` octagon fallback) ice-glass
  slot with 11 notch marks drawn by a `repeating-linear-gradient` from `--gmt-range-pct` steps,
  filled to the thumb. Thumb: a bevelled ice block, `::-webkit-slider-thumb` and
  `::-moz-range-thumb`, fixed size. No rounded arcs, no left-border accent.
- A fixed inline size of 8rem, so nothing reflows while dragging.
- The cue: `GmtRange` fires `cue("detent")` on each reader-driven `input` event whose value
  differs from the last one it cued. A value set through the `value`/`min`/`max`/`step` setters is
  silent. This hook lives in the kit, so every tool slider ticks from this slice on; slice 6 adds
  only the handle.

## Mute button and switch

- **Mute button:** kit `button` gains `pressed?: boolean` → `aria-pressed`, an `icon` slot and
  `labelHidden` (icon-only square). Label "Mute sound", hidden but still the name (the state is
  `aria-pressed`). It sits left of the fader, which fills the row; Aura goes below a hairline. `data-cue` so slice
  1's press hook leaves it to `cue("toggle")`.
- **Aura switch:** kit `switchField` gains `size?: "default" | "small"`: the same native checkbox
  `role="switch"`, a smaller bevelled track and knob. The kit fires `cue("toggle")` on a reader
  `change` and sets `data-cue`, so every tool switch snaps from this slice on; a programmatic
  `checked` is silent.
- **Header button:** carries `data-ping="sonar"`, so it plays the Sonar ping like the Dox,
  GitHub and Discord links beside it; slice 3's `native-panels.ts` plays the Steel breath as its
  popover opens and closes.

## One button, one popover

- `SoundControl.astro` renders the header button, then `<div id="gmt-sound-pop" popover>` holding
  the mute button, the fader and the switch. One copy of each, never two.
- It sits in `Header.astro`'s right group, right after `ThemeSelect`. The group shows at every
  width; below 50rem every item but the sound control is hidden by one rule, since they are in
  the mobile menu. The header grid is the one northguild.dev has (`auto minmax(0, 1fr) auto`).
- The popover is anchored under the button (`anchor-name` and `position-area`), with fixed insets
  where anchoring is missing, and `inline-size: min(16rem, 100vw - 2rem)`.
- Being a native `auto` popover, Escape, outside press and focus return are the browser's, and
  `esc-native.ts` enrols it in the Escape order with no new code. Opening it plays the gear's
  Sonar ping and the opening Steel breath; closing plays the closing Steel breath.
- `control.ts` mirrors `aria-expanded` from the `toggle` event and focuses the mute button on open.

## Files

Create:

- `src/components/SoundControl.astro`: the markup above, from kit `button`, `range`
  (`look: "fader"`) and `switchField` (`size: "small"`).
- `src/lib/sound/control.ts` + test: wires the mute button, fader and switch to `settings.ts`;
  fires `cue("toggle")` on the mute button (the switch cues itself); mirrors `aria-expanded`;
  moves focus in on open; all listeners on one `AbortController`, returned as `destroy()`.

Modify:

- `src/components/Header.astro`: `SoundControl` after `ThemeSelect` in the right group; the
  group shows at every width and hides all but the sound control below 50rem.
- `src/widgets/primitives/range/range.ts`, `range.module.css`, `range.test.ts`: `look`, the cue.
- `src/widgets/builders/button.ts` (+ css, test): `pressed`, `icon`.
- `src/widgets/builders/switch-field.ts` (+ css, test): `size`, the cue.
- `src/lib/sound/voices.ts`: **Ice snap** (`toggle` C), **Glass tick** (`detent` B).
- `scripts/sound-check.mjs`; `context/dox/reference/visual-design.md` § Controls (the fader look,
  the small switch, the toggle button).

## Tests

- `range.test.ts`: `look: "fader"` keeps the native range, its name and `aria-valuetext`; a
  reader `input` fires `detent` once per changed value; the setters fire nothing; spy on `cue`.
- `button.test.ts`: `pressed` writes `aria-pressed`; `switch-field.test.ts`: `size: "small"`
  keeps `role="switch"` and the label; a reader change fires `toggle`, a programmatic one nothing.
- `control.test.ts`: the mute button toggles `muted` and `aria-pressed` and keeps `level`; moving
  the fader while muted writes `muted: false` and the new level; the switch writes `aura`; nothing
  is written on mount; a `storage` event from another tab updates all three; the header button
  reads expanded while the popover is open and focus moves to the mute button; `destroy()` aborts
  every listener in `afterEach`.

## Gate additions (`sound-check`, `esc-cascade`, `a11y-*`)

- At 320, 390, 768 and the owner's recorded size: the Sound button is visible, in the tab order and
  inside the bar; from 50rem it sits right after the theme toggle and before GitHub; closed, the
  mute button, fader and switch are not visible; open, the popover is inside the viewport and
  under the button.
- Keyboard: Enter on the button opens the popover and focuses the mute button, Tab reaches the
  fader then the switch, arrow keys move the fader one notch, Escape closes and focus returns to
  the button.
- Mute, reload: still muted, painted muted before the first script runs (`data-sound="off"`, the
  waves not drawn).
- Reduced motion with empty storage: the mute button reads pressed; one press unmutes and plays
  Ice snap.
- **Hold still:** the bounding boxes of the Sound button, every header item and the popover's parts
  are unchanged (±0.5 px) while a scripted drag sweeps the fader 1 → 11 → 1, and while the mute
  button toggles. GitHub and Discord boxes match `main`.
- `readout-still`, `esc-cascade`, `a11y-axe` and `a11y-tab-walk` stay green on the gate pages.

## Definition of done

- [Gates every slice passes](./index.md#gates-every-slice-passes) are green.
- Listening pass at the recorded size, Chrome on macOS: the owner mutes and unmutes from the
  landing, a guide and `/dox`; drags and arrows the fader and hears Glass tick per notch; flips
  the Aura switch and hears Ice snap; opens the popover with the button and with the keyboard at
  a wide and a narrow window, and closes it with Escape. Nothing in the bar moves.
  `innerWidth`×`innerHeight` = the size recorded in slice 1.
- `built.md` Sound section: the control, the fader look, the small switch, the one-popover rule.
