/**
 * utcDatetimeInput: a native `<input type="datetime-local">`, restyled and never rebuilt, for
 * use as `field()`'s control.
 *
 * `field()` writes the `<label for>`, so the input's name comes from the field. The planner
 * reads and writes the value as UTC wall-clock text (`YYYY-MM-DDTHH:MM`); `step` is in
 * seconds, the unit the platform uses, so the browser's own stepper agrees with the slider.
 * A `textInput` is `type="text"` only, which is why this lives beside the planner.
 */
import {
  gateAttr,
  html,
  type GateOption,
  type SafeHtml,
} from "~/widgets/builders";
import styles from "./utc-datetime-input.module.css";

interface UtcDatetimeInputOptions extends GateOption {
  /** The control's id; the field's `<label for>` points at it. */
  id: string;
  /** `YYYY-MM-DDTHH:MM`, or nothing before the mount sets it. */
  value?: string;
  /** Seconds between steps. */
  step: number;
  /** The hint's id from `field()`. */
  describedBy?: string | undefined;
}

export function utcDatetimeInput(o: UtcDatetimeInputOptions): SafeHtml {
  return html`<input
    class="${styles.root}"
    type="datetime-local"
    id="${o.id}"
    step="${String(o.step)}"
    ${o.value === undefined ? "" : html`value="${o.value}"`}
    ${o.describedBy === undefined ? "" : html`aria-describedby="${o.describedBy}"`}
    ${gateAttr(o.gate)}
  />`;
}
