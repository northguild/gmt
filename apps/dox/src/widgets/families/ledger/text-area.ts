/**
 * textArea: the native multi-line field, restyled to sit beside the kit's text input.
 *
 * Kept native so IME composition, autofill, the mobile keyboard and the screen reader all
 * work. The field holds machine text, one value per line, so spell check, autofill and
 * automatic capitals are off. The field's `<label for>`
 * (from `field()`) names it. The kit has no multi-line builder, so it lives in this family;
 * another widget that needs one can lift it.
 */
import { gateAttr, type GateOption } from "../../builders/gate";
import { html, type SafeHtml } from "../../builders/html";
import styles from "./text-area.module.css";

interface TextAreaOptions extends GateOption {
  /** The control's id; the field's `<label for>` points at it. */
  id: string;
  value?: string;
  rows?: number;
  /** The hint's id from `field()`. */
  describedBy?: string | undefined;
}

export function textArea(o: TextAreaOptions): SafeHtml {
  return html`<textarea
    class="${styles.root}"
    id="${o.id}"
    rows="${String(o.rows ?? 2)}"
    spellcheck="false"
    autocomplete="off"
    autocapitalize="off"
    ${o.describedBy === undefined ? "" : html`aria-describedby="${o.describedBy}"`}
    ${gateAttr(o.gate)}
  >${o.value ?? ""}</textarea
  >`;
}
