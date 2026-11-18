/**
 * The header's settings control (DOX-G11): one gear button, last in the bar after Dox, GitHub and
 * Discord, that opens a popover with every reader setting. One copy, at every width. `SettingsControl.astro` renders it and the
 * test fixture renders the same markup.
 *
 * The button is a native `<button popovertarget>` named "Settings", so the popover is a native
 * `[popover]`: Escape, outside press and focus return are the browser's, `esc-native.ts` enrols
 * it in the Escape order. The gear plays the Sonar ping (`data-ping="sonar"`), as Dox, GitHub and
 * Discord beside it do, and the panel the Felt slide in and out (`native-panels.ts`), with the
 * slide and sheen every native panel shares (gmt-primitives.css). It is a top-layer
 * panel anchored under the button, so opening it and dragging the fader move nothing in the bar.
 *
 * The panel reads top to bottom: the "Dark theme" switch, a hairline, then sound (the mute button
 * beside the volume fader, the Aura switch, and the aura's track: Ice cavern or Deep drone, a radio
 * pair from the kit's chips). The aura plays on the landing only, so its switch and track show
 * only where `<html>` carries the landing's `data-aura`, and the track only while the switch is
 * on; elsewhere the panel holds theme and volume. `ThemeProvider` sets `data-theme` and
 * `data-sound` on `<html>` before first paint; the mute button's speaker is drawn from
 * `data-sound` in CSS, so a muted visitor never sees it on. `lib/settings-control.ts` wires it.
 */
import {
  button,
  html,
  raw,
  switchField,
  type SafeHtml,
} from "~/widgets/builders";
import { chips } from "~/widgets/primitives/chips/chips";
import { range } from "~/widgets/primitives/range/range";
import styles from "./settings-control.module.css";

/**
 * Lucide's `settings` gear (ISC), filled so it reads as solid as GitHub's and Discord's marks
 * beside it, at the icon buttons' 20 px. The view box is cropped to the gear, so it stands as tall
 * as GitHub's mark (19.5 px), not the 18 px Lucide's padding leaves. The hub is a second subpath
 * of the same path, so the even-odd rule cuts it out of the fill; the stroke keeps the outline's
 * weight.
 */
const GEAR = `<svg viewBox="1 1 22 22" width="20" height="20" fill="currentColor" fill-rule="evenodd" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" focusable="false" aria-hidden="true"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915ZM15 12a3 3 0 1 0-6 0 3 3 0 0 0 6 0Z"/></svg>`;

const SPEAKER = `<svg class="${styles.speaker}" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" focusable="false" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path data-slash d="M16 9.5l5 5M21 9.5l-5 5"/><path data-waves d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/></svg>`;

/** The whole control: the gear button and its popover. */
export function settingsControl(): SafeHtml {
  return html`<div class="${styles.control} print:hidden" data-settings-control>
    <button
      type="button"
      id="gmt-settings-button"
      class="gmt-icon-button gmt-settings-toggle ${styles.toggle}"
      popovertarget="gmt-settings-pop"
      aria-label="Settings"
      title="Settings"
      aria-expanded="false"
      data-ping="sonar"
    >
      ${raw(GEAR)}
    </button>
    <div
      id="gmt-settings-pop"
      class="${styles.pop}"
      popover
      role="group"
      aria-label="Settings"
    >
      <div class="${styles.theme}">
        ${switchField({ id: "gmt-theme-dark", label: "Dark theme", size: "small", checked: true })}
      </div>
      <div class="${styles.sound}">
        ${button({ id: "gmt-sound-mute", label: "Mute sound", labelHidden: true, pressed: true, cue: true, icon: raw(SPEAKER) })}
        ${range({ id: "gmt-sound-fader", label: "Volume", look: "fader", min: 1, max: 11, step: 1, value: 5, valueText: "Volume 5 of 11, muted" })}
      </div>
      <div class="${styles.aura}">
        ${switchField({ id: "gmt-sound-aura", label: "Aura", size: "small", checked: true })}
        <div class="${styles.track}">${chips({
          legend: "Aura track",
          kind: "radio",
          name: "gmt-sound-track",
          items: [
            { value: "ice", label: "Ice cavern", checked: true },
            { value: "deep", label: "Deep drone" },
          ],
        })}</div>
      </div>
    </div>
  </div>`;
}
