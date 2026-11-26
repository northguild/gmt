/**
 * The Double Precision Meter's drawing: how far each number drifts from the instant it writes,
 * measured at sample years across the whole range, on one log axis.
 *
 * The y axis runs from 1 ns to 100 µs in decades. A drift of nothing has no place on a log axis,
 * so it sits on a labelled floor band under the 1 ns line. Each series is a step line with its
 * own dash pattern, an end label and a key swatch, so no series is told apart by colour alone.
 * The geometry is fixed once by the axis, never by the data, so the plot does not rescale while
 * the reader drags; the cursor is the one thing that moves.
 *
 * The plot is one named image (`role="img"`) whose label is the summary in words, and the
 * samples are in a table beside it. Pure geometry is split from markup so the tests can ask what
 * the drawing says. Nothing here is a time or a drift: every value is passed in.
 */
import { html, type SafeHtml } from "../../builders/html";
import { gateAttr } from "../../builders/gate";
import styles from "./drift-lanes.module.css";

/** A number as a CSS percentage, to three places. */
export const pct = (n: number): string => `${Math.round(n * 1000) / 1000}%`;

const clamp = (n: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, n));

const round = (n: number): number => Math.round(n * 1000) / 1000;

/** The decades the axis labels: nanoseconds and the words that name them. */
export const DRIFT_TICKS: readonly { ns: number; label: string }[] = [
  { ns: 1, label: "1 ns" },
  { ns: 1_000, label: "1 µs" },
  { ns: 10_000, label: "10 µs" },
  { ns: 100_000, label: "100 µs" },
];

/** The axis runs from 1 ns to 100 µs: five decades. */
const DECADES = 5;

/** The floor band's share of the field, in percent. A drift of nothing sits in its middle. */
export const FLOOR = 16;

/** The year ticks under the field. */
export const YEAR_TICKS: readonly number[] = [2000, 4000, 6000, 8000];

/** The least gap between two end labels, in percent of the field. */
const LABEL_GAP = 12;

/** Where a drift stands on the axis, in percent from the bottom. Zero is the floor band. */
export function levelOf(ns: bigint): number {
  if (ns <= 0n) return FLOOR / 2;
  const decades = clamp(Math.log10(Number(ns)) / DECADES, 0, 1);
  return FLOOR + decades * (100 - FLOOR);
}

export interface DriftPoint {
  year: number;
  ns: bigint;
}

export interface DriftLine {
  key: string;
  name: string;
  series: 1 | 2 | 3 | 4;
  points: readonly DriftPoint[];
}

export interface DriftView {
  lines: readonly DriftLine[];
  /** The reader's year, or `null`. */
  cursorYear: number | null;
  yearMin: number;
  yearMax: number;
  /** The plot's accessible name: the summary in words. */
  label: string;
}

export interface LineGeometry {
  key: string;
  name: string;
  series: 1 | 2 | 3 | 4;
  /** A step path in a 0 to 100 box: each sample holds until the next. */
  path: string;
  /** The level of the last sample. */
  end: number;
  /** Where the end label stands, after the labels are kept apart. */
  label: number;
}

export interface DriftGeometry {
  lines: LineGeometry[];
  yTicks: { level: number; label: string }[];
  floorLevel: number;
  xTicks: { at: number; year: number }[];
  /** The cursor's place along the years, or `null`. */
  cursor: number | null;
}

/**
 * Moves end labels apart so no two are closer than `LABEL_GAP`, keeping their order and
 * staying inside 0 to 100. Deterministic: a sort, one pass up and one pass down.
 */
export function keepApart(levels: readonly number[]): number[] {
  const order = levels
    .map((level, i) => ({ level, i }))
    .sort((a, b) => a.level - b.level || a.i - b.i);
  for (let k = 0; k < order.length; k++) {
    const prev = order[k - 1];
    if (prev !== undefined) {
      order[k]!.level = Math.max(order[k]!.level, prev.level + LABEL_GAP);
    }
  }
  const top = 100;
  for (let k = order.length - 1; k >= 0; k--) {
    const next = order[k + 1];
    const ceiling = next === undefined ? top : next.level - LABEL_GAP;
    order[k]!.level = Math.min(order[k]!.level, ceiling);
  }
  const out = levels.map(() => 0);
  for (const o of order) out[o.i] = round(o.level);
  return out;
}

export function driftGeometry(view: DriftView): DriftGeometry {
  const { yearMin, yearMax } = view;
  const x = (year: number): number =>
    yearMax > yearMin ? ((year - yearMin) / (yearMax - yearMin)) * 100 : 0;
  const lines = view.lines.map((line) => {
    let path = "";
    const pts = line.points;
    pts.forEach((p, i) => {
      const at = round(x(p.year));
      const y = round(100 - levelOf(p.ns));
      path += i === 0 ? `M${at} ${y}` : `H${at}V${y}`;
    });
    const last = pts.at(-1);
    return {
      key: line.key,
      name: line.name,
      series: line.series,
      path,
      end: last === undefined ? FLOOR / 2 : levelOf(last.ns),
    };
  });
  const labels = keepApart(lines.map((l) => l.end));
  return {
    lines: lines.map((l, i) => ({ ...l, label: labels[i]! })),
    yTicks: DRIFT_TICKS.map((t) => ({
      level: levelOf(BigInt(t.ns)),
      label: t.label,
    })),
    floorLevel: FLOOR / 2,
    xTicks: YEAR_TICKS.filter((y) => y > yearMin && y < yearMax).map(
      (year) => ({
        at: x(year),
        year,
      }),
    ),
    cursor:
      view.cursorYear === null
        ? null
        : round(clamp(x(view.cursorYear), 0, 100)),
  };
}

// ---------------------------------------------------------------------------
// Markup
// ---------------------------------------------------------------------------

function field(g: DriftGeometry): SafeHtml {
  return html`<div class="${styles.field}"
    ><svg class="${styles.svg}" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false"
      ><rect class="${styles.floor}" x="0" y="${100 - FLOOR}" width="100" height="${FLOOR}" />${g.yTicks.map(
        (t) =>
          html`<line class="${styles.grid}" x1="0" x2="100" y1="${100 - t.level}" y2="${100 - t.level}" />`,
      )}${g.lines.map(
        (l) =>
          html`<path class="${styles.line}" data-series="${l.series}" data-line="${l.key}" d="${l.path}" />`,
      )}</svg
    >${
      g.cursor === null
        ? ""
        : html`<span class="${styles.guide}" data-gate="moving" style="--at: ${pct(g.cursor)}"></span>`
    }</div
  >`;
}

function yAxis(g: DriftGeometry): SafeHtml {
  return html`<div class="${styles.yAxis}" aria-hidden="true"
    >${g.yTicks.map(
      (t) =>
        html`<span class="${styles.yTick}" style="--level: ${pct(t.level)}">${t.label}</span>`,
    )}<span class="${styles.yTick}" data-floor="true" style="--level: ${pct(g.floorLevel)}">exact</span></div
  >`;
}

function endLabels(g: DriftGeometry): SafeHtml {
  return html`<div class="${styles.ends}" aria-hidden="true"
    >${g.lines.map(
      (l) =>
        html`<span class="${styles.endLabel}" data-series="${l.series}" style="--level: ${pct(l.label)}">${l.name}</span>`,
    )}</div
  >`;
}

function xAxis(g: DriftGeometry, view: DriftView): SafeHtml {
  return html`<div class="${styles.xAxis}" aria-hidden="true"
    >${g.xTicks.map(
      (t) =>
        html`<span class="${styles.xTick}" style="--at: ${pct(t.at)}">${t.year}</span>`,
    )}<span class="${styles.xEnd}" data-end="start">${view.yearMin}</span
    ><span class="${styles.xEnd}" data-end="finish">${view.yearMax}</span></div
  >`;
}

/** The key: a dashed swatch and the series' name, so a line is told apart by pattern. */
export function driftKey(view: DriftView): SafeHtml {
  return html`<ul class="${styles.key}" aria-label="Key"
    >${view.lines.map(
      (l) =>
        html`<li class="${styles.keyItem}"
          ><svg class="${styles.swatch}" width="28" height="10" aria-hidden="true" focusable="false"
            ><line class="${styles.line}" data-series="${l.series}" x1="0" x2="28" y1="5" y2="5" /></svg
          >${l.name}</li
        >`,
    )}</ul
  >`;
}

/**
 * The whole drawing in its frame. Pure: one call redraws all of it, and nothing in it holds
 * state.
 */
export function driftLanes(view: DriftView): SafeHtml {
  const g = driftGeometry(view);
  return html`<div class="${styles.frame}" ${gateAttr("frame")}
    ><div class="${styles.plot}" role="img" aria-label="${view.label}" ${gateAttr("drawn")}
      >${yAxis(g)}${field(g)}${endLabels(g)}${xAxis(g, view)}</div
    >${driftKey(view)}</div
  >`;
}
