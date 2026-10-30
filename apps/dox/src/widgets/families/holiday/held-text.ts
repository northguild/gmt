/**
 * heldText: a line of words that changes (a note, a hint, a result) and never changes the
 * height of what holds it. Every text it can say sits, hidden, in the same grid cell as the
 * live text, so the cell is as tall as the longest at this width, in every engine.
 *
 * `sentinel` is the library's no-result state: amber, in words, in brackets. `note` is a
 * plain remark. `ok` is a quiet, usually blank, line. Amber is the sentinel's alone.
 */
import { gateAttr } from "../../builders/gate";
import { html, type SafeHtml } from "../../builders/html";
import styles from "./held-text.module.css";

export type HeldState = "ok" | "note" | "sentinel";

interface HeldTextOptions {
  /** The text shown now. */
  text: string;
  state: HeldState;
  /** Every text this line can say, to reserve the tallest. */
  sizers: readonly string[];
  /** The live line's id, so a field can point `aria-describedby` at it. */
  id?: string;
  /** Make the line an `aria-live` status. */
  live?: boolean;
  /** The line's name, so a reader and a test can tell one held line from another. */
  label?: string;
  /** A `data-gate` hook the gates read; the live line is its first child. */
  gate?: string;
}

export function heldText(o: HeldTextOptions): SafeHtml {
  return html`<div class="${styles.held}" ${gateAttr(o.gate)}
    ><p
      class="${styles.text}"
      data-state="${o.state}"
      ${o.id === undefined ? "" : html`id="${o.id}"`}
      ${o.live === true ? html`role="status"` : html`role="note"`}
      ${o.label === undefined ? "" : html`aria-label="${o.label}"`}
      >${o.text}</p
    >${[...new Set(o.sizers)].map(
      (sizer) =>
        html`<span class="${styles.ghost}" aria-hidden="true" data-pagefind-ignore>${sizer}</span>`,
    )}</div
  >`;
}
