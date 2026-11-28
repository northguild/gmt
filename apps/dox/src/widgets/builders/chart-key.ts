/**
 * chartKey and chartSummary: the two notes under a chart.
 *
 * `chartKey` is a list named "Key". Each item is a swatch (a mark, hidden from assistive
 * technology) beside the words that carry the meaning. `chartSummary` is each bar's counts in
 * words for a reader who cannot see the bars; it is visually hidden but not removed from the
 * accessibility tree.
 */
import { html, type SafeHtml } from "./html";
import styles from "./chart-key.module.css";

export type ChartKeyKind = "own" | "shared";

/** The series colour of a swatch: spring unless the chart names another. */
export type ChartKeyHue = "spring" | "polyfill-shipped" | "polyfill-previous";

export interface ChartKeyItem {
  kind: ChartKeyKind;
  /** The series colour; `spring` when omitted. */
  hue?: ChartKeyHue;
  /** What the swatch stands for. Required. */
  words: string;
}

export function chartKey(items: readonly ChartKeyItem[]): SafeHtml {
  // Page prose draws a dash before each list item; Starlight's opt-out works only on an ancestor.
  return html`<div class="not-content"><ul class="${styles.key}" aria-label="Key">${items.map(
    (item) =>
      html`<li><span class="${styles.swatch}" data-kind="${item.kind}"${item.hue && item.hue !== "spring" ? html` data-hue="${item.hue}"` : ""} aria-hidden="true"></span><span>${item.words}</span></li>`,
  )}</ul></div>`;
}

export function chartSummary(lines: readonly string[]): SafeHtml {
  return html`<ul class="${styles.summary}">${lines.map((line) => html`<li>${line}</li>`)}</ul>`;
}
