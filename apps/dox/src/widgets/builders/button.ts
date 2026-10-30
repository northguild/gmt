/**
 * button: a native `<button type="button">` for a one-shot action, such as "Check" or
 * "Reset example". It carries no state: the mount listens for its click. A native button
 * turns Enter and Space into a click, so the keyboard needs no handling.
 */
import { gateAttr, type GateOption } from "./gate";
import { html, type SafeHtml } from "./html";
import styles from "./button.module.css";

export interface ButtonOptions extends GateOption {
  id: string;
  /** What it says and what it is called. Required. */
  label: string;
  /** The id of text that describes what the action does. */
  describedBy?: string | undefined;
}

export function button(o: ButtonOptions): SafeHtml {
  return html`<button
    class="${styles.button}"
    type="button"
    id="${o.id}"
    ${o.describedBy === undefined ? "" : html`aria-describedby="${o.describedBy}"`}
    ${gateAttr(o.gate)}
  >${o.label}</button>`;
}

/** A row that holds one or more buttons and wraps on a narrow column. */
export function buttonRow(children: SafeHtml): SafeHtml {
  return html`<div class="${styles.row}">${children}</div>`;
}
