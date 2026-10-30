/**
 * timeline: a lane of marks on a 0 to 1 scale, and the axis under it.
 *
 * A lane is `role="group"` named by its required `label`, and holds its marks.
 * Each mark is a named image (`role="img"`), so a reader hears "08:30 gate closes"
 * and not a bare coloured box. The axis and its ticks are drawn text for the eye
 * (`aria-hidden`); the marks carry the facts.
 *
 * Position is data, not layout code. A builder writes `--gmt-at: <0..1>` (and
 * `--gmt-span: <0..1>` for a mark with width) and the module reads it with
 * `inset-inline-start: calc(var(--gmt-at) * 100%)`, so nothing uses `transform`
 * for layout, and right-to-left flips for free. A value outside 0..1 is clamped and
 * a non-finite one reads as 0.
 */
import { gateAttr, type GateOption } from "./gate";
import { html, type HtmlValue, type SafeHtml } from "./html";
import styles from "./timeline.module.css";

export type TimelineSeries = 1 | 2 | 3 | 4;

/** A position on the lane, 0 (start) to 1 (end), as the style value. Exported for its unit test. */
export function unit(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return String(Math.min(1, Math.max(0, n)));
}

export interface LaneOptions extends GateOption {
  /** The lane's name, read by the group and shown beside it. Required. */
  label: string;
}

/** `children` are `mark` and `tick` results. */
export function lane(o: LaneOptions, children: HtmlValue): SafeHtml {
  return html`<div class="${styles.lane}" role="group" ${gateAttr(o.gate)} aria-label="${o.label}"
    ><span class="${styles.label}" aria-hidden="true">${o.label}</span
    ><div class="${styles.track}">${children}</div></div
  >`;
}

export interface MarkOptions {
  /** What the mark says to a screen reader. Required. */
  label: string;
  /** Position, 0 to 1. */
  at: number;
  /** Width, 0 to 1. Omit for a point. */
  span?: number;
  series?: TimelineSeries;
}

export function mark(o: MarkOptions): SafeHtml {
  const span = o.span === undefined ? "" : `; --gmt-span: ${unit(o.span)}`;
  return html`<span
    class="${styles.mark}"
    role="img"
    aria-label="${o.label}"
    data-kind="${o.span === undefined ? "point" : "range"}"
    data-series="${o.series ?? 1}"
    style="--gmt-at: ${unit(o.at)}${span}"
  ></span>`;
}

/** A labelled position on the axis. */
export interface TickOptions {
  at: number;
  /** The drawn text, for example `00:00`. */
  label: string;
}

export function tick(o: TickOptions): SafeHtml {
  return html`<span class="${styles.tick}" style="--gmt-at: ${unit(o.at)}">${o.label}</span>`;
}

/** The scale under a lane. `children` are `tick` results. Drawn text only. */
export function axis(children: HtmlValue): SafeHtml {
  return html`<div class="${styles.axis}" aria-hidden="true">${children}</div>`;
}
