/**
 * numberInput: a native `<input type="number">`, for a whole number a reader steps with the
 * arrow keys (a year). It reads as a spin button, which a typed text field does not.
 *
 * It wears the kit's text input, so the two sit side by side in one field grid. Pass the
 * `id` and `describedBy` that `field()` hands its control.
 */
import { gateAttr, html, type GateOption, type SafeHtml } from "../../builders";
import styles from "../../builders/text-input.module.css";

interface NumberInputOptions extends GateOption {
  id: string;
  value: string;
  min: number;
  max: number;
  step: number;
  describedBy?: string | undefined;
}

export function numberInput(o: NumberInputOptions): SafeHtml {
  return html`<input
    class="${styles.root}"
    type="number"
    id="${o.id}"
    inputmode="numeric"
    min="${String(o.min)}"
    max="${String(o.max)}"
    step="${String(o.step)}"
    value="${o.value}"
    ${o.describedBy === undefined ? "" : html`aria-describedby="${o.describedBy}"`}
    ${gateAttr(o.gate)}
  />`;
}
