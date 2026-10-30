/**
 * textInput: a native `<input type="text">`, restyled and never rebuilt, for use as
 * `field()`'s control.
 *
 * `field()` writes the `<label for>`, so the input's name comes from the field. The
 * attributes that matter to a typed value are options, so the mobile keyboard and
 * autofill behave: `inputMode` picks the keyboard, `autocomplete` and `spellcheck` quiet
 * the browser's help where it would mangle a code or a timestamp. `spellcheck: false`
 * marks such a value, so it also turns off the on-screen keyboard's capitals.
 * `maxLength` caps what can be typed; the tool's parser states the same cap.
 */
import { gateAttr, type GateOption } from "./gate";
import { html, type SafeHtml } from "./html";
import styles from "./text-input.module.css";

export type TextInputMode =
  | "none"
  | "text"
  | "decimal"
  | "numeric"
  | "tel"
  | "search"
  | "email"
  | "url";

export interface TextInputOptions extends GateOption {
  /** The control's id; the field's `<label for>` points at it. */
  id: string;
  value?: string;
  inputMode?: TextInputMode;
  autocomplete?: string;
  /**
   * Only `false` is written, with `autocapitalize="off"`: the value is a code, a
   * timestamp or a zone id, not prose. Leave it out to keep the browser's defaults.
   */
  spellcheck?: false;
  /** The most characters the field takes: a whole number, 1 or more. */
  maxLength?: number;
  placeholder?: string;
  /** The hint's id from `field()`. */
  describedBy?: string | undefined;
}

export function textInput(o: TextInputOptions): SafeHtml {
  if (
    o.maxLength !== undefined &&
    (!Number.isInteger(o.maxLength) || o.maxLength < 1)
  ) {
    throw new RangeError(
      `textInput maxLength must be a whole number from 1: ${o.maxLength}`,
    );
  }
  return html`<input
    class="${styles.root}"
    type="text"
    id="${o.id}"
    ${o.value === undefined ? "" : html`value="${o.value}"`}
    ${o.inputMode === undefined ? "" : html`inputmode="${o.inputMode}"`}
    ${o.autocomplete === undefined ? "" : html`autocomplete="${o.autocomplete}"`}
    ${o.spellcheck === false ? html`spellcheck="false" autocapitalize="off"` : ""}
    ${o.maxLength === undefined ? "" : html`maxlength="${String(o.maxLength)}"`}
    ${o.placeholder === undefined ? "" : html`placeholder="${o.placeholder}"`}
    ${o.describedBy === undefined ? "" : html`aria-describedby="${o.describedBy}"`}
    ${gateAttr(o.gate)}
  />`;
}
