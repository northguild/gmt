/**
 * crossingConnector: the strip of text between the Crossing Clock's two faces.
 *
 * The real elapsed time sits in an `<output>`, a line below it, and the naive wall-clock
 * reading under that. All three start blank (a non-breaking space keeps the two-line box), and
 * the mount writes the elapsed text and the naive sentence once the library has answered.
 * The `area` is the grid cell the host layout places it in.
 */
import { html, type SafeHtml } from "../../builders/html";
import styles from "./crossing-connector.module.css";

const NBSP = " ";

interface CrossingConnectorOptions {
  elapsedId: string;
  naiveId: string;
  /** The `data-area` the host grid places this in. */
  area: string;
}

export function crossingConnector(o: CrossingConnectorOptions): SafeHtml {
  return html`<div class="${styles.connector}" data-area="${o.area}"><output class="${styles.elapsed}" id="${o.elapsedId}">${NBSP}</output><div class="${styles.line}" aria-hidden="true"></div><p class="${styles.naive}" id="${o.naiveId}">${NBSP}</p></div>`;
}
