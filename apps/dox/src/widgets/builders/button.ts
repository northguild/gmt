/**
 * button: a native `<button type="button">` for a one-shot action, such as "Check" or
 * "Reset example". It carries no state: the mount listens for its click. A native button
 * turns Enter and Space into a click, so the keyboard needs no handling.
 *
 * `pressed` makes it the APG Button pattern's toggle button
 * (https://www.w3.org/WAI/ARIA/apg/patterns/button/): `aria-pressed` carries the state and the
 * name stays the same. The mount flips the attribute. `icon` is a decorative graphic before the
 * label; with `labelHidden` the icon is all that shows and the label stays the button's name, read
 * by assistive technology only. `cue` says the mount plays a sound of its own for this press, so the press cue stays out
 * (see `src/lib/sonar.ts`).
 */
import { gateAttr, type GateOption } from "./gate";
import { html, type SafeHtml } from "./html";
import { srOnly } from "./sr-only";
import styles from "./button.module.css";

export interface ButtonOptions extends GateOption {
  id: string;
  /** What it says and what it is called. Required. */
  label: string;
  /** The id of text that describes what the action does. */
  describedBy?: string | undefined;
  /** A toggle button: its state, written as `aria-pressed`. Leave out for a plain button. */
  pressed?: boolean | undefined;
  /** Decorative graphic before the label. */
  icon?: SafeHtml | undefined;
  /** Show only the icon; the label is still the button's name. Needs `icon`. */
  labelHidden?: boolean | undefined;
  /** The mount plays this press's sound itself. */
  cue?: boolean | undefined;
}

export function button(o: ButtonOptions): SafeHtml {
  const iconOnly = o.labelHidden === true && o.icon !== undefined;
  return html`<button
    class="${iconOnly ? `${styles.button} ${styles.iconOnly}` : styles.button}"
    type="button"
    id="${o.id}"
    ${o.describedBy === undefined ? "" : html`aria-describedby="${o.describedBy}"`}
    ${o.pressed === undefined ? "" : html`aria-pressed="${o.pressed ? "true" : "false"}"`}
    ${o.cue === true ? html`data-cue` : ""}
    ${gateAttr(o.gate)}
  >${o.icon === undefined ? "" : html`<span class="${styles.icon}" aria-hidden="true">${o.icon}</span>`}${iconOnly ? srOnly(o.label) : o.label}</button>`;
}

/** A row that holds one or more buttons and wraps on a narrow column. */
export function buttonRow(children: SafeHtml): SafeHtml {
  return html`<div class="${styles.row}">${children}</div>`;
}
