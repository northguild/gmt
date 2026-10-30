/**
 * <gmt-chips>: a group of native radios, checkboxes or switches, painted as chips.
 *
 * Patterns: Radio Group https://www.w3.org/WAI/ARIA/apg/patterns/radio/,
 * Checkbox https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/ and Switch
 * https://www.w3.org/WAI/ARIA/apg/patterns/switch/ (`role="switch"` on a checkbox).
 * A `<fieldset>` with a `<legend>` names the group. The inputs are native, so Tab
 * enters a radio group once and the arrow keys move the selection with no script.
 *
 * `value` is a string for `kind="radio"` and a string array for `checkbox` and
 * `switch`. The element owns the selected colour: `--gmt-selected-ink` on the solid
 * `--gmt-selected-fill` (cause 8), in this module, so no tool overrides it.
 * Re-emits `input`/`change` from the host with `detail.value`.
 */
import { gateAttr, type GateOption } from "../../builders/gate";
import { html, type SafeHtml } from "../../builders/html";
import { KitElement } from "../base";
import styles from "./chips.module.css";

type ChipsKind = "radio" | "checkbox" | "switch";

interface ChipItem {
  value: string;
  label: string;
  checked?: boolean;
  disabled?: boolean;
  /** Where the visible label has no context alone (a bare row number); it should contain the label. */
  ariaLabel?: string;
}

interface ChipsOptions extends GateOption {
  /** The group's name (the `<legend>`). Required. */
  legend: string;
  kind: ChipsKind;
  /** Shared `name` of the inputs; radios need it to form a group. */
  name: string;
  items: readonly ChipItem[];
}

export function chips(o: ChipsOptions): SafeHtml {
  const type = o.kind === "radio" ? "radio" : "checkbox";
  return html`<gmt-chips class="${styles.root}" kind="${o.kind}" ${gateAttr(o.gate)}
    ><fieldset class="${styles.set}"
      ><legend class="${styles.legend}">${o.legend}</legend
      ><div class="${styles.items}"
        >${o.items.map(
          (item) => html`<label class="${styles.chip}"
            ><input
              class="${styles.input}"
              type="${type}"
              ${o.kind === "switch" ? html`role="switch"` : ""}
              name="${o.name}"
              value="${item.value}"
              ${item.ariaLabel ? html`aria-label="${item.ariaLabel}"` : ""}
              ${item.checked ? html`checked` : ""}
              ${item.disabled ? html`disabled` : ""}
            /><span class="${styles.face} ${o.kind === "radio" ? styles.radioFace : o.kind === "switch" ? styles.switchFace : ""}">${item.label}</span></label
          >`,
        )}</div
      ></fieldset
    ></gmt-chips
  >`;
}

export class GmtChips extends KitElement {
  get kind(): ChipsKind {
    const kind = this.getAttribute("kind");
    return kind === "checkbox" || kind === "switch" ? kind : "radio";
  }

  get #inputs(): HTMLInputElement[] {
    return [...this.querySelectorAll<HTMLInputElement>("input")];
  }

  /** The checked value (radio, `""` when none) or values (checkbox, switch). */
  get value(): string | string[] {
    const checked = this.#inputs
      .filter((input) => input.checked)
      .map((input) => input.value);
    return this.kind === "radio" ? (checked[0] ?? "") : checked;
  }
  set value(next: string | readonly string[]) {
    const wanted = new Set(typeof next === "string" ? [next] : next);
    for (const input of this.#inputs) input.checked = wanted.has(input.value);
  }

  protected wire(signal: AbortSignal): void {
    for (const type of ["input", "change"]) {
      this.addEventListener(
        type,
        (event) => {
          // The host's own re-emission has the host as its target: let it through.
          if (!(event.target instanceof HTMLInputElement)) return;
          event.stopPropagation();
          this.dispatchEvent(
            new CustomEvent(type, {
              bubbles: true,
              detail: { value: this.value },
            }),
          );
        },
        { signal },
      );
    }
  }
}
