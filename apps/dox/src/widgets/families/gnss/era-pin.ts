/**
 * eraPin: the small round marker that stands for one era in the GNSS legend.
 *
 * It matches the lap it names on the odometer ring: ringed for any era, filled for the
 * reading's own, dashed when the library gave that era no instant. It is drawn only
 * (`aria-hidden`); the era's name and instant sit beside it as text, so a marker is
 * never the only carrier of "your reading" or "no result".
 */
import { html, type SafeHtml } from "../../builders/html";
import styles from "./era-pin.module.css";

interface EraPinOptions {
  /** The reading's own era. */
  chosen: boolean;
  /** The library gave this era no instant. */
  empty: boolean;
}

export function eraPin(o: EraPinOptions): SafeHtml {
  return html`<span
    class="${styles.root}"
    data-chosen="${String(o.chosen)}"
    data-empty="${String(o.empty)}"
    aria-hidden="true"
  ></span>`;
}
