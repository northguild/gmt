/**
 * <gmt-preset>: a labelled native `<select>` and the description of the chosen option.
 *
 * Pattern: the native select, which APG recommends over a custom listbox where it
 * suffices (APG Combobox, "Select-Only" note:
 * https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-select-only/).
 * The `<label for>` names it and `aria-describedby` joins the description. Every
 * option's description also sits, hidden, in the description's grid cell, so the
 * height is that of the tallest and a preset never moves what is below it.
 *
 * Re-emits the select's `input`/`change` from the host with `detail.value` (the
 * option value). Replaces `descriptionHoldHtml` and `setPresetDescription`.
 */
import { gateAttr, type GateOption } from "../../builders/gate";
import { html, type SafeHtml } from "../../builders/html";
import { KitElement, relay } from "../base";
import styles from "./preset.module.css";

export interface PresetOption {
  value: string;
  label: string;
  description: string;
}

export interface PresetOptions extends GateOption {
  id: string;
  /** The visible label and the select's name. Required. */
  label: string;
  options: readonly PresetOption[];
  /** The selected value; defaults to the first option. */
  value?: string;
}

export function preset(o: PresetOptions): SafeHtml {
  const selected =
    o.options.find((opt) => opt.value === o.value) ?? o.options[0];
  const descId = `${o.id}-description`;
  return html`<gmt-preset class="${styles.root}" ${gateAttr(o.gate)}
    ><label class="${styles.label}" for="${o.id}">${o.label}</label
    ><select class="${styles.select}" id="${o.id}" aria-describedby="${descId}"
      >${o.options.map(
        (opt) =>
          html`<option
            value="${opt.value}"
            data-description="${opt.description}"
            ${opt === selected ? html`selected` : ""}
            >${opt.label}</option
          >`,
      )}</select
    ><div class="${styles.hold}"
      ><p class="${styles.description}" id="${descId}">${selected?.description ?? ""}</p
      >${o.options.map(
        (opt) =>
          html`<span class="${styles.ghost}" aria-hidden="true">${opt.description}</span>`,
      )}</div
    ></gmt-preset
  >`;
}

export class GmtPreset extends KitElement {
  get select(): HTMLSelectElement | null {
    return this.querySelector("select");
  }

  get value(): string {
    return this.select?.value ?? "";
  }
  set value(next: string) {
    const select = this.select;
    if (!select) return;
    if (![...select.options].some((opt) => opt.value === next)) return;
    select.value = next;
    this.#describe();
  }

  #describe(): void {
    const select = this.select;
    const target = this.querySelector("p");
    if (!select || !target) return;
    target.textContent =
      select.selectedOptions[0]?.getAttribute("data-description") ?? "";
  }

  protected wire(signal: AbortSignal): void {
    const select = this.select;
    if (!select) return;
    this.#describe();
    for (const type of ["input", "change"]) {
      this.addEventListener(
        type,
        (event) => {
          if (event.target === select) this.#describe();
          relay(this, event, select, () => select.value);
        },
        { signal },
      );
    }
  }
}
