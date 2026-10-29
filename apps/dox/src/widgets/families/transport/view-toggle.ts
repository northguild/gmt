/**
 * viewToggle: a named group of buttons that choose one of a few views of the same data.
 *
 * Each is a native `<button>` with `aria-pressed` (the APG Button pattern, toggle form), and
 * exactly one is pressed. The group's name says what is being chosen. The mount owns the
 * state: it sets `aria-pressed` on the buttons and shows the matching panel.
 */
import { html, type SafeHtml } from "../../builders/html";
import styles from "./view-toggle.module.css";

export interface ViewToggleView {
  /** The id the button takes, so the mount can find it. */
  id: string;
  label: string;
  pressed: boolean;
}

export interface ViewToggleOptions {
  /** The group's accessible name, such as "Chart view". Required. */
  label: string;
  views: readonly ViewToggleView[];
}

export function viewToggle(o: ViewToggleOptions): SafeHtml {
  return html`<div class="${styles.root}" role="group" aria-label="${o.label}"
    >${o.views.map(
      (v) =>
        html`<button class="${styles.button}" type="button" id="${v.id}" aria-pressed="${String(v.pressed)}">${v.label}</button>`,
    )}</div
  >`;
}
