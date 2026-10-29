/**
 * select: a native `<select>`, restyled and never rebuilt, for use as `field()`'s control.
 *
 * `field()` writes the `<label for>`, so the select's name comes from the field. Pass the
 * `id` and `describedBy` the field hands the control. A `value` that is not one of the
 * options leaves the first option selected, as the browser does.
 */
import { gateAttr, type GateOption } from "./gate";
import { html, type SafeHtml } from "./html";
import styles from "./select.module.css";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectOptions extends GateOption {
  /** The control's id; the field's `<label for>` points at it. */
  id: string;
  options: readonly SelectOption[];
  /** The selected value. */
  value?: string;
  /** The hint's id from `field()`. */
  describedBy?: string | undefined;
}

export function select(o: SelectOptions): SafeHtml {
  return html`<select
    class="${styles.root}"
    id="${o.id}"
    ${o.describedBy === undefined ? "" : html`aria-describedby="${o.describedBy}"`}
    ${gateAttr(o.gate)}
    >${o.options.map(
      (opt) =>
        html`<option value="${opt.value}" ${opt.value === o.value ? html`selected` : ""}>${opt.label}</option>`,
    )}</select
  >`;
}
