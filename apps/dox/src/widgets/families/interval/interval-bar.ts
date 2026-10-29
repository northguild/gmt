/**
 * intervalBar: one of the two typed intervals, drawn as a bar on a timeline lane.
 *
 * It is a named image (`role="img"`), so a reader hears "Interval A, 2024-01-01 00:00:00 to ..."
 * and not a bare coloured box. Position and width are data (`--gmt-at`, `--gmt-span`, each 0 to 1)
 * that the module reads, so nothing uses `transform` for layout and right-to-left mirrors itself.
 *
 * `valid: false` is the library's refusal for this interval (unparseable, or its start after its
 * end). That is the one amber state: the bar keeps its place and says so in its name, in words,
 * so the colour is never the only signal.
 */
import { html, type SafeHtml } from "../../builders/html";
import styles from "./interval-bar.module.css";

export interface IntervalBarOptions {
  /** What the bar says to a screen reader. Required. */
  label: string;
  /** Left edge, 0 to 1. */
  at: number;
  /** Width, 0 to 1. */
  span: number;
  series: 1 | 2;
  /** False when the interval fails the library's own validation. */
  valid: boolean;
}

/** The narrowest a bar is drawn, as a share of the lane, so a one-instant interval stays visible. */
export const MIN_BAR_SPAN = 0.005;

/** The custom properties that carry a bar's position and width, for a test to read. */
export const BAR_AT_PROPERTY = "--gmt-at";
export const BAR_SPAN_PROPERTY = "--gmt-span";

const unit = (n: number): string =>
  Number.isFinite(n) ? String(Math.min(1, Math.max(0, n))) : "0";

export function intervalBar(o: IntervalBarOptions): SafeHtml {
  const span = Math.max(MIN_BAR_SPAN, o.span);
  return html`<span
    class="${styles.bar}"
    role="img"
    aria-label="${o.label}"
    data-series="${o.series}"
    data-valid="${String(o.valid)}"
    style="${BAR_AT_PROPERTY}: ${unit(o.at)}; ${BAR_SPAN_PROPERTY}: ${unit(span)}"
  ></span>`;
}
