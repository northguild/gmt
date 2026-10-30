/**
 * dateInput: a native `<input type="date">`, for use as `field()`'s control.
 *
 * The kit's `textInput` is always `type="text"`, so a date field would have to rebuild the
 * control. This writes the native one and takes the text input's look, so the two sit in one
 * grid as a pair. The browser's own picker, keyboard model and locale format are kept. A value
 * the control refuses (`2024-02-30`) leaves it empty; the mount keeps the refused string.
 */
import { gateAttr, type GateOption } from "../../builders/gate";
import { html, type SafeHtml } from "../../builders/html";
import styles from "../../builders/text-input.module.css";

interface DateInputOptions extends GateOption {
  /** The control's id; the field's `<label for>` points at it. */
  id: string;
  /** `YYYY-MM-DD`, or blank. */
  value?: string;
  /** The hint's id from `field()`. */
  describedBy?: string | undefined;
}

export function dateInput(o: DateInputOptions): SafeHtml {
  return html`<input
    class="${styles.root}"
    type="date"
    id="${o.id}"
    ${o.value === undefined || o.value === "" ? "" : html`value="${o.value}"`}
    ${o.describedBy === undefined ? "" : html`aria-describedby="${o.describedBy}"`}
    ${gateAttr(o.gate)}
  />`;
}
