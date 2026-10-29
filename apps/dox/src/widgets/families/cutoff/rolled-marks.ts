/**
 * rolledMark and rolledArc: how a cut-off that a business calendar moved is drawn on its lane.
 *
 * `rolledMark` is a hollow marker, a named image, at the place `cutoffAt` with no calendar would
 * have put the cut-off. `rolledArc` is the dashed curve from that place to the cut-off's real
 * one: drawn only, `aria-hidden`, and left out when the two all but coincide. Both are placed by
 * `--gmt-at` and `--gmt-span` (0 to 1 of the axis), the way the timeline marks are, so nothing
 * is measured. The series is a name that picks a token; a reader gets the move from the label.
 */
import { html, type SafeHtml } from "../../builders/html";
import { unit } from "../../builders/timeline";
import styles from "./rolled-marks.module.css";

/** Closer than this share of the axis, the arc is left out: the two markers all but touch. */
export const MIN_ARC_SPAN = 0.015;

export interface RolledMarkOptions {
  /** What it says to a screen reader, such as "gate-in without the calendar: Sat 15 Jun 17:00". Required. */
  label: string;
  at: number;
  series: 1 | 2 | 3 | 4;
}

export function rolledMark(o: RolledMarkOptions): SafeHtml {
  return html`<span class="${styles.hollow}" role="img" aria-label="${o.label}" data-series="${o.series}" style="--gmt-at: ${unit(o.at)}"></span>`;
}

export interface RolledArcOptions {
  /** Where the cut-off would have been, 0 to 1. */
  from: number;
  /** Where the calendar put it, 0 to 1. */
  to: number;
  series: 1 | 2 | 3 | 4;
}

/** The arc, or nothing when the two places are less than `MIN_ARC_SPAN` apart. */
export function rolledArc(o: RolledArcOptions): SafeHtml {
  const span = Math.abs(o.to - o.from);
  if (!Number.isFinite(span) || span <= MIN_ARC_SPAN) return html``;
  // The path runs from the hollow marker to the solid one, so the dashes flow that way.
  const d =
    o.from <= o.to ? "M 0 50 Q 50 -30 100 50" : "M 100 50 Q 50 -30 0 50";
  return html`<svg class="${styles.arc}" aria-hidden="true" focusable="false" viewBox="0 0 100 100" preserveAspectRatio="none" data-series="${o.series}" style="--gmt-at: ${unit(Math.min(o.from, o.to))}; --gmt-span: ${unit(span)}"><path d="${d}"></path></svg>`;
}
