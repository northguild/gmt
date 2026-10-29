/**
 * journey-ribbons: a journey's hours drawn on one scale, in two ribbons.
 *
 * "As it happens" lays the legs end to end with each wait where it falls; "gathered" pushes the
 * same segments together, the moving time at the start and the waiting time at the end. Both are
 * a `lane` (a labelled track, named as a whole for a screen reader as one image) holding layers
 * of drawn marks: the segments, number badges over the moving stems, chips under the waits with
 * leader lines up to them, and two brackets with the totals. Every mark is `aria-hidden`; the
 * lane's name says what the picture says.
 *
 * Position is data. A mark writes `--at` and `--span` as percentages of the journey's length and
 * the module reads them with logical properties. The widget's fit pass may nudge a badge or chip
 * with an inline `inset-inline-start` once it has measured the track.
 *
 * A hatch carries the waiting kinds (open for handling, dense for the wait for a scheduled
 * departure) so the meaning never rests on colour alone. Nothing here is a verdict colour; amber
 * is the sentinel's alone.
 */
import { html, type HtmlValue, type SafeHtml } from "../../builders/html";
import styles from "./journey-ribbons.module.css";

export type RibbonKind = "moving" | "handling" | "scheduled";
export type RibbonSeries = 1 | 2 | 3 | 4;

/** `value` as a percent of `span`, to four places: the number the style writes. */
export function pct(value: number, span: number): number {
  return Math.round((value / span) * 1_000_000) / 10_000;
}

export interface RibbonSegment {
  kind: RibbonKind;
  /** The leg it belongs to, from 1. */
  leg: number;
  series: RibbonSeries;
  fromMs: number;
  toMs: number;
}

export type LaneVariant = "happens" | "gathered";

export interface JourneyLaneOptions {
  /** The track's id, so the widget can watch its width. */
  id: string;
  /** The visible label beside the track. */
  label: string;
  /** What the whole track says to a screen reader. Required. */
  name: string;
  variant: LaneVariant;
  /** The layers: `layer` results. */
  children: HtmlValue;
}

/** One lane: the label, and a track that is a single named image. */
export function journeyLane(o: JourneyLaneOptions): SafeHtml {
  return html`<div class="${styles.lane}" data-lane="${o.variant}"
    ><span class="${styles.label}" aria-hidden="true">${o.label}</span
    ><div class="${styles.track}" id="${o.id}" role="img" aria-label="${o.name}">${o.children}</div></div
  >`;
}

export type LayerKind =
  | "badges"
  | "bars"
  | "notes"
  | "leaders"
  | "brackets"
  | "empty";

/** A drawn layer of a track. The widget redraws its content with `setHtml`. */
export function layer(
  kind: LayerKind,
  id: string,
  content: HtmlValue,
): SafeHtml {
  return html`<div class="${styles.layer}" data-layer="${kind}" id="${id}" aria-hidden="true">${content}</div>`;
}

/** The segments of a ribbon, each placed by its share of `spanMs`. */
export function ribbonBars(
  segments: readonly RibbonSegment[],
  spanMs: number,
): SafeHtml {
  return html`${segments.map(
    (s) =>
      html`<div class="${styles.seg}" data-kind="${s.kind}" data-leg="${s.leg}" ${s.kind === "moving" ? html`data-series="${s.series}"` : ""} style="--at: ${pct(s.fromMs, spanMs)}%; --span: ${pct(s.toMs - s.fromMs, spanMs)}%"></div>`,
  )}`;
}

/** A number badge over each moving stem, at the stem's middle. */
export function ribbonBadges(
  segments: readonly RibbonSegment[],
  spanMs: number,
): SafeHtml {
  return html`${segments
    .filter((s) => s.kind === "moving")
    .map((s) => {
      const center = pct((s.fromMs + s.toMs) / 2, spanMs);
      return html`<span class="${styles.badge}" data-series="${s.series}" data-center="${center}" style="--at: ${center}%">${s.leg}</span>`;
    })}`;
}

export interface RibbonNote {
  /** The hand-off's leg: the leg it follows. */
  hop: number;
  /** The wait's middle, as a percent of the journey. */
  center: number;
  /** The row the chip sits on, from 0. */
  row: number;
  text: string;
}

/** The thin lines from each wait down to its chip. */
export function noteLeaders(notes: readonly RibbonNote[]): SafeHtml {
  return html`${notes.map(
    (n) =>
      html`<i class="${styles.leader}" style="--at: ${n.center}%; --row: ${n.row}"></i>`,
  )}`;
}

/** A chip under each wait, one row for each hand-off. */
export function noteChips(notes: readonly RibbonNote[]): SafeHtml {
  return html`${notes.map(
    (n) =>
      html`<span class="${styles.chip} ${styles.note}" data-hop="${n.hop}" data-center="${n.center}" style="--at: ${n.center}%; --row: ${n.row}">${n.text}</span>`,
  )}`;
}

export interface RibbonBrackets {
  /** Where the moving time ends, as a percent of the journey. */
  movingEnd: number;
  movingText: string;
  waitingText: string;
}

/** Two brackets under the gathered ribbon, with the totals on chips beneath. */
export function ribbonBrackets(o: RibbonBrackets): SafeHtml {
  return html`<div class="${styles.bracket}" data-side="moving" style="--at: 0%; --span: ${o.movingEnd}%"></div
    ><div class="${styles.bracket}" data-side="waiting" style="--at: ${o.movingEnd}%; --span: ${Math.round((100 - o.movingEnd) * 10_000) / 10_000}%"></div
    ><div class="${styles.totals}"
      ><span class="${styles.chip}" data-side="moving">${o.movingText}</span
      ><span class="${styles.chip}" data-side="waiting">${o.waitingText}</span></div
    >`;
}

/** The words a ribbon says when there is nothing to draw. */
export function ribbonEmpty(text: string): SafeHtml {
  return text === "" ? html`` : html`<p class="${styles.empty}">${text}</p>`;
}

export interface RibbonTick {
  /** Position, as a percent of the journey. */
  at: number;
  label: string;
}

/** The scale under the lanes: elapsed time from the first departure. Drawn text only. */
export function ribbonAxis(id: string, ticks: readonly RibbonTick[]): SafeHtml {
  return html`<div class="${styles.axis}" id="${id}" aria-hidden="true">${ticks.map(
    (t) =>
      html`<span class="${styles.tick}" data-tick style="--at: ${t.at}%">${t.label}</span>`,
  )}</div>`;
}

export interface LegendItem {
  kind: RibbonKind;
  text: string;
}

/** What each kind of mark means: a swatch of the mark's own look, then the words. */
export function ribbonLegend(items: readonly LegendItem[]): SafeHtml {
  return html`<ul class="${styles.legend}" aria-label="Legend">${items.map(
    (i) =>
      html`<li class="${styles.chip}"><span class="${styles.swatch}" data-kind="${i.kind}" data-series="1" aria-hidden="true"></span>${i.text}</li>`,
  )}</ul>`;
}
