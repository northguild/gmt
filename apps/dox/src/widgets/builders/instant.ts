/**
 * instant: an instant written so it breaks where a person would break it.
 *
 * The date, the time, the fraction of a second and the zone are each unbreakable and a
 * `<wbr>` joins them. A hyphen is otherwise a line-break opportunity, so a narrow plate
 * would split the date itself; and a nanosecond time with an offset is wider than a
 * phone's plate on its own.
 *
 * Every text gets the same four pieces, so a readout that moves between an instant and a
 * word (a NO SIGNAL, a duration) while the reader drags never adds or removes a node. A
 * text that is not an instant keeps its own wrapping: it sits whole in the first piece,
 * marked `data-word` so that it is not held unbreakable. An instant with no fraction
 * leaves the last two pieces empty: its zone stays with its time.
 */
import { gateAttr } from "./gate";
import { html, type SafeHtml } from "./html";
import styles from "./instant.module.css";

const INSTANT = /^(\d{4}-\d{2}-\d{2})(T[^.]*?)(?:(\.\d+)(.*))?$/;

export function instant(text: string): SafeHtml {
  const m = INSTANT.exec(text);
  const pieces = m
    ? [m[1]!, m[2]!, m[3] ?? "", m[4] ?? ""]
    : [text, "", "", ""];
  const word = m ? "" : html`data-word`;
  const piece = (s: string): SafeHtml =>
    html`<span class="${styles.piece}" ${gateAttr("instant")} ${word}>${s}</span>`;
  return html`<span ${gateAttr("instant")}>${piece(pieces[0]!)}<wbr />${piece(pieces[1]!)}<wbr />${piece(pieces[2]!)}<wbr />${piece(pieces[3]!)}</span>`;
}
