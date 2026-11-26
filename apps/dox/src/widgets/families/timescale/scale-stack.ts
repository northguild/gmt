/**
 * The Terrestrial Time Stack's drawing: the three pieces between UTC and TCG laid end to end
 * on one axis of seconds, and under them the lane of TCG − TT against the year.
 *
 * Steps are solid, the constant piece is hatched and the drifting piece is dotted, so the
 * three differ by pattern and not by colour alone. A series colour is on the marks only: the
 * names sit on opaque chips in three fixed slots. A negative drift is drawn back from the end
 * of TT with the dotted fill and an outline.
 *
 * The bar is one named image (`role="img"`) whose label is the reading in words; a
 * visually hidden list beside it says the same values, since an image's children are not
 * read. Pure geometry is split from markup so the tests can ask what the drawing says: the
 * widths are the values passed in as a share of the reach, and nothing here is a time.
 */
import { html, type SafeHtml } from "../../builders/html";
import { gateAttr } from "../../builders/gate";
import styles from "./scale-stack.module.css";

const NBSP = "\u00a0";

export type StackSegmentKey = "steps" | "constant" | "drift";
const KEYS: readonly StackSegmentKey[] = ["steps", "constant", "drift"];

/** The series colour each piece's mark uses. */
const SERIES: Record<StackSegmentKey, 2 | 3 | 4> = {
  steps: 2,
  constant: 3,
  drift: 4,
};

/** The pattern each piece is filled with. */
const PATTERN: Record<StackSegmentKey, "solid" | "hatch" | "dots"> = {
  steps: "solid",
  constant: "hatch",
  drift: "dots",
};

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

/** A number as a CSS percentage, to three places. */
export const pct = (n: number): string => `${Math.round(n * 1000) / 1000}%`;

const clamp = (n: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, n));

/** One piece of the bar, in percent of the reach. */
export interface BarSegment {
  key: StackSegmentKey;
  from: number;
  to: number;
  /** A drift below zero: drawn back from the end of TT. */
  negative: boolean;
}

/**
 * The pieces, end to end from UTC. A piece with no value is left out and does not move the
 * others. A negative drift ends where the constant piece ends and reaches back.
 */
export function barGeometry(
  values: Record<StackSegmentKey, number | null>,
  reach: number,
): BarSegment[] {
  const at = (s: number): number =>
    reach > 0 ? clamp((s / reach) * 100, 0, 100) : 0;
  const out: BarSegment[] = [];
  let edge = 0;
  for (const key of KEYS) {
    const value = values[key];
    if (value === null) continue;
    if (value < 0) {
      out.push({ key, from: at(edge + value), to: at(edge), negative: true });
    } else {
      out.push({ key, from: at(edge), to: at(edge + value), negative: false });
      edge += value;
    }
  }
  return out;
}

/** The axis's ticks in seconds, at a step of 1, 2 or 5 times a power of ten. */
export function barTicks(reach: number): { seconds: number; at: number }[] {
  if (!(reach > 0)) return [{ seconds: 0, at: 0 }];
  const raw = reach / 5;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * power).find((s) => s >= raw)!;
  const ticks: { seconds: number; at: number }[] = [];
  for (let s = 0; s <= reach; s += step) {
    ticks.push({ seconds: s, at: (s / reach) * 100 });
  }
  return ticks;
}

/** The drift lane's drawing, in percent of its field. */
export interface LaneGeometry {
  /** The line's path in a 0 to 100 box, with a gap (a new `M`) where a value is missing. */
  path: string;
  /** The zero line's level. */
  zero: number;
  /** The extreme readings the library returned, with where they stand. */
  min: { level: number; value: number } | null;
  max: { level: number; value: number } | null;
  /** The year ticks, every 1000 years inside the range. */
  ticks: { at: number; year: number; minor: boolean }[];
  /** The reader's year, or `null`. */
  cursor: { at: number; level: number | null } | null;
}

export interface LaneInput {
  points: readonly { year: number; value: number | null }[];
  cursor: { year: number; value: number | null } | null;
  yearMin: number;
  yearMax: number;
}

export function laneGeometry(input: LaneInput): LaneGeometry {
  const { points, cursor, yearMin, yearMax } = input;
  const values = points
    .map((p) => p.value)
    .filter((v): v is number => v !== null);
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  const span = hi - lo;
  const x = (year: number): number =>
    yearMax > yearMin ? ((year - yearMin) / (yearMax - yearMin)) * 100 : 0;
  const level = (v: number): number => (span > 0 ? ((v - lo) / span) * 100 : 0);
  const round = (n: number): number => Math.round(n * 1000) / 1000;

  let path = "";
  let pen = false;
  for (const p of points) {
    if (p.value === null) {
      pen = false;
      continue;
    }
    path += `${pen ? "L" : "M"}${round(x(p.year))} ${round(100 - level(p.value))}`;
    pen = true;
  }

  const ticks: LaneGeometry["ticks"] = [];
  for (let y = Math.ceil(yearMin / 1000) * 1000; y <= yearMax; y += 1000) {
    ticks.push({ at: x(y), year: y, minor: y % 2000 !== 0 });
  }

  return {
    path,
    zero: level(0),
    min: values.length === 0 ? null : { level: level(lo), value: lo },
    max: values.length === 0 ? null : { level: level(hi), value: hi },
    ticks,
    cursor:
      cursor === null
        ? null
        : {
            at: x(cursor.year),
            level: cursor.value === null ? null : level(cursor.value),
          },
  };
}

// ---------------------------------------------------------------------------
// Markup
// ---------------------------------------------------------------------------

/** One chip: the piece's name, its value and the words for how it behaves. */
export interface StackChip {
  key: StackSegmentKey;
  name: string;
  value: string;
  words: string;
}

export interface StackView {
  /** The bar's accessible name: the three values in words. */
  label: string;
  /** The lane's accessible name. */
  laneLabel: string;
  reach: number;
  /** The pieces' seconds as the library gave them; `null` draws nothing for that piece. */
  values: Record<StackSegmentKey, number | null>;
  chips: readonly StackChip[];
  lane: LaneInput;
  /** The axis label for the baseline and for the lane's value axis. */
  axisName: string;
  laneName: string;
  /** Format a number of seconds for a tick or an end label. */
  format(seconds: number): string;
  /** The key's words, one per piece. */
  keyWords: Record<StackSegmentKey, string>;
}

/** The ids the patterns are given, from the widget's scope. */
export type PatternIds = Record<"solid" | "hatch" | "dots", string>;

function patterns(ids: PatternIds): SafeHtml {
  return html`<defs
    ><pattern id="${ids.hatch}" data-series="${SERIES.constant}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"
      ><rect class="${styles.tile}" width="6" height="6" /><line class="${styles.hatchLine}" x1="0" y1="0" x2="0" y2="6" /></pattern
    ><pattern id="${ids.dots}" data-series="${SERIES.drift}" width="6" height="6" patternUnits="userSpaceOnUse"
      ><rect class="${styles.tile}" width="6" height="6" /><circle class="${styles.dot}" cx="3" cy="3" r="1.4" /></pattern
  ></defs>`;
}

function fillOf(key: StackSegmentKey, ids: PatternIds): string {
  const pattern = PATTERN[key];
  return pattern === "solid" ? "" : `url(#${ids[pattern]})`;
}

function bar(v: StackView, ids: PatternIds): SafeHtml {
  const segments = barGeometry(v.values, v.reach);
  const ticks = barTicks(v.reach);
  return html`<div class="${styles.bar}" role="img" aria-label="${v.label}" ${gateAttr("drawn")}
    ><svg class="${styles.barSvg}" width="100%" height="100%" aria-hidden="true" focusable="false"
      >${patterns(ids)}${segments.map(
        (s) =>
          html`<rect
            class="${styles.segment}"
            data-segment="${s.key}"
            data-series="${SERIES[s.key]}"
            data-pattern="${PATTERN[s.key]}"
            data-negative="${String(s.negative)}"
            x="${pct(s.from)}"
            y="0"
            width="${pct(s.to - s.from)}"
            height="100%"
            ${fillOf(s.key, ids) === "" ? "" : html`fill="${fillOf(s.key, ids)}"`}
          />`,
      )}</svg
    ><span class="${styles.baseline}"></span></div
  ><div class="${styles.axis}" aria-hidden="true"
    ><span class="${styles.axisName}">${v.axisName}</span>${ticks.map(
      (t) =>
        html`<span class="${styles.tick}" style="--at: ${pct(t.at)}">${v.format(t.seconds)}</span>`,
    )}</div
  >`;
}

function chips(v: StackView): SafeHtml {
  return html`<div class="${styles.chips}" aria-hidden="true"
    >${v.chips.map(
      (c) =>
        html`<span class="${styles.chip}" data-series="${SERIES[c.key]}" data-slot="${c.key}"
          ><span class="${styles.chipName}">${c.name}</span
          ><span class="${styles.chipValue}">${c.value}</span
          ><span class="${styles.chipWords}">${c.words}</span></span
        >`,
    )}</div
  >`;
}

function lane(v: StackView): SafeHtml {
  const g = laneGeometry(v.lane);
  const cursor = g.cursor;
  return html`<div class="${styles.laneBox}"
    ><span class="${styles.laneName}" aria-hidden="true">${v.laneName}</span
    ><div class="${styles.lane}" role="img" aria-label="${v.laneLabel}" ${gateAttr("drawn")}
      ><span class="${styles.yLabel}" data-end="max" data-state="${g.max === null ? "off" : "on"}" aria-hidden="true"
        >${g.max === null ? NBSP : v.format(g.max.value)}</span
      ><span class="${styles.yLabel}" data-end="min" data-state="${g.min === null ? "off" : "on"}" aria-hidden="true"
        >${g.min === null ? NBSP : v.format(g.min.value)}</span
      ><div class="${styles.field}"
        ><svg class="${styles.laneSvg}" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false"
          ><line class="${styles.zero}" x1="0" x2="100" y1="${100 - g.zero}" y2="${100 - g.zero}" /><path class="${styles.laneLine}" d="${g.path}" /></svg
        >${
          cursor === null
            ? ""
            : html`<span class="${styles.guide}" data-gate="moving" style="--at: ${pct(cursor.at)}"></span>`
        }${
          cursor === null || cursor.level === null
            ? ""
            : html`<span class="${styles.cursorDot}" data-gate="moving" style="--at: ${pct(cursor.at)}; --level: ${pct(cursor.level)}"></span>`
        }</div
      ></div
    ><div class="${styles.laneAxis}" aria-hidden="true"
      >${g.ticks.map(
        (t) =>
          html`<span class="${styles.tick}" data-minor="${String(t.minor)}" style="--at: ${pct(t.at)}">${t.year}</span>`,
      )}</div
    ></div
  >`;
}

/** The three patterns in words, each with a small swatch of its fill. */
export function stackKey(v: StackView, ids: PatternIds): SafeHtml {
  return html`<ul class="${styles.key}" aria-label="Key"
    >${KEYS.map(
      (key) =>
        html`<li class="${styles.keyItem}"
          ><svg class="${styles.keySwatch}" width="20" height="14" data-series="${SERIES[key]}" aria-hidden="true" focusable="false"
            ><rect class="${styles.segment}" data-pattern="${PATTERN[key]}" data-series="${SERIES[key]}" width="100%" height="100%" ${fillOf(key, ids) === "" ? "" : html`fill="${fillOf(key, ids)}"`} /></svg
          >${v.keyWords[key]}</li
        >`,
    )}</ul
  >`;
}

/** The values as a list for assistive technology, beside the named image. */
function valuesList(v: StackView): SafeHtml {
  return html`<ul class="gmt-sr-only"
    >${v.chips.map((c) => html`<li>${c.name} ${c.value}, ${c.words}</li>`)}</ul
  >`;
}

/**
 * The whole drawing in its frame. Pure: one call redraws all of it, and nothing in it holds
 * state.
 */
export function scaleStack(v: StackView, ids: PatternIds): SafeHtml {
  return html`<div class="${styles.frame}" ${gateAttr("frame")}
    >${chips(v)}${bar(v, ids)}${valuesList(v)}${lane(v)}${stackKey(v, ids)}</div
  >`;
}
