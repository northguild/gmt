/**
 * swatch: a small square in a series colour, beside the word that names it.
 *
 * Decorative (`aria-hidden`): the name lives in the adjacent text, so a swatch
 * never carries meaning alone. Series 1 to 4 are the site's series tokens.
 */
import { html, type SafeHtml } from "./html";
import styles from "./swatch.module.css";

export type SwatchSeries = 1 | 2 | 3 | 4;

export interface SwatchOptions {
  series: SwatchSeries;
}

export function swatch(o: SwatchOptions): SafeHtml {
  return html`<span class="${styles.root}" data-series="${o.series}" aria-hidden="true"></span>`;
}
