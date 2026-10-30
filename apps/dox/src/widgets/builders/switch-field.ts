/**
 * switchField: one on/off setting, a native checkbox with `role="switch"` in its label.
 *
 * Pattern: Switch https://www.w3.org/WAI/ARIA/apg/patterns/switch/. The input is real, so
 * Space toggles it, a screen reader says "switch, on" and a form can read it. The label wraps
 * the input, so the whole row is the target. `detail` is extra text inside the name, such as a
 * count. `tone` picks the accent the track takes when on; it is a name, never a colour.
 */
import { gateAttr, type GateOption } from "./gate";
import { html, type SafeHtml } from "./html";
import styles from "./switch-field.module.css";

export type SwitchTone = "cyan" | "purple" | "gold";

export interface SwitchFieldOptions extends GateOption {
  /** The switch's name. Required. */
  label: string;
  id?: string;
  name?: string;
  value?: string;
  checked?: boolean;
  disabled?: boolean;
  /** Extra text after the label, inside the name (a count). */
  detail?: string;
  /** Decorative graphic before the label. */
  icon?: SafeHtml;
  tone?: SwitchTone;
  describedBy?: string;
}

export function switchField(o: SwitchFieldOptions): SafeHtml {
  return html`<label class="${styles.root}" data-tone="${o.tone ?? "cyan"}" ${gateAttr(o.gate)}
    ><input
      class="${styles.input}"
      type="checkbox"
      role="switch"
      ${o.id === undefined ? "" : html`id="${o.id}"`}
      ${o.name === undefined ? "" : html`name="${o.name}"`}
      ${o.value === undefined ? "" : html`value="${o.value}"`}
      ${o.checked === true ? html`checked` : ""}
      ${o.disabled === true ? html`disabled` : ""}
      ${o.describedBy === undefined ? "" : html`aria-describedby="${o.describedBy}"`}
    /><span class="${styles.track}" aria-hidden="true"></span
    >${o.icon === undefined ? "" : html`<span class="${styles.icon}" aria-hidden="true">${o.icon}</span>`}<span
      class="${styles.text}"
      >${o.label}</span
    >${o.detail === undefined ? "" : html` <span class="${styles.detail}" data-detail>${o.detail}</span>`}</label
  >`;
}

/** Change a switch's detail text (its count) in place, without rebuilding the switch. */
export function setSwitchDetail(input: HTMLInputElement, text: string): void {
  const detail = input.labels?.[0]?.querySelector("[data-detail]");
  if (detail && detail.textContent !== text) detail.textContent = text;
}
