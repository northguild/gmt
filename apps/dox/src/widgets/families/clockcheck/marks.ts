/**
 * marks: the small pieces every clock-change checker draws in a table cell or a readout.
 *
 * - `markOk` / `markBad`: the tick and the cross of a verdict. The glyph is drawn only; the words
 *   beside it carry the meaning.
 * - `noSignal`: the sentinel a cell or readout shows for a value that could not be read, never a
 *   blank (amber, the one place amber is used).
 * - `zoneId`: an IANA zone id that breaks after each slash and never inside a segment.
 *
 * The page's pre-paint probe script writes the same marks into the table, so it takes their
 * markup from these builders (`probeInlineSource`) and the two can never differ.
 */
import { html, raw, type SafeHtml } from "../../builders/html";
import styles from "./marks.module.css";

/** The sentinel's words. A tooltip on a readout that has lost its signal is `SIGNAL_LOST`. */
export const NO_SIGNAL_TEXT = "NO SIGNAL";

export const markOk = (): SafeHtml =>
  html`<span class="${styles.ok}" aria-hidden="true">✓</span>`;

export const markBad = (): SafeHtml =>
  html`<span class="${styles.bad}" aria-hidden="true">✗</span>`;

export const noSignal = (): SafeHtml =>
  html`<span class="${styles.sentinel}">${NO_SIGNAL_TEXT}</span>`;

/** `Africa/El_Aaiun` as `Africa/<wbr>El_Aaiun`, each segment kept whole. */
export function zoneId(zone: string): SafeHtml {
  const parts = zone
    .split("/")
    .map((segment) => html`<span class="${styles.segment}">${segment}</span>`);
  return html`${parts.flatMap((part, i) => (i === 0 ? [part] : [raw("/<wbr>"), part]))}`;
}
