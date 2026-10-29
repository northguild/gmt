/**
 * cutoffGate and cutoffTransitionLine: the two vertical rules a cut-off axis draws.
 *
 * Each is a named image (`role="img"`) placed by `--gmt-at` (0 to 1, as the timeline pieces
 * do), so a reader hears "cut-off 17:00" and a layout never measures a pixel. `cutoffGate` is
 * the cut-off itself: a solid rule. `cutoffTransitionLine` is a clock change: dashed for a
 * gap (the clocks jump forward), dotted for an overlap (an hour that happens twice).
 */
import { html, type SafeHtml } from "../../builders/html";
import { unit } from "../../builders/timeline";
import styles from "./gate.module.css";

export interface CutoffGateOptions {
  /** What it says to a screen reader, such as "cut-off 17:00". Required. */
  label: string;
  /** Position on the axis, 0 to 1. */
  at: number;
}

export function cutoffGate(o: CutoffGateOptions): SafeHtml {
  return html`<span class="${styles.gate}" role="img" aria-label="${o.label}" style="--gmt-at: ${unit(o.at)}"></span>`;
}

export interface CutoffTransitionLineOptions {
  /** The clock change in words, such as "go back 1 h". Required. */
  label: string;
  at: number;
  kind: "gap" | "overlap";
}

export function cutoffTransitionLine(o: CutoffTransitionLineOptions): SafeHtml {
  return html`<span class="${styles.transition}" role="img" aria-label="${o.label}" data-kind="${o.kind}" style="--gmt-at: ${unit(o.at)}"></span>`;
}
