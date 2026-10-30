/**
 * The Leap Second Timeline's staircase: TAI - UTC as a step line, a riser for each
 * inserted second, a hatched run where UTC is continuous, the date as a vertical cursor
 * with its readout, the counted span as a band and the checked second 60 as a lit riser or
 * a struck-through ghost.
 *
 * The chart is drawn text and shapes for the eye; the plot is one named image
 * (`role="img"`) whose name is the reading's own summary, and the table and plates beside
 * it carry every fact in words. A place is data: `--at` and `--level` are percentages the
 * module reads with `inset-inline-start` and `inset-block-end`.
 *
 * `leapChart` is one pure function of a view, so the mount redraws the whole chart with
 * one `setHtml` and nothing in it holds state. The parts the mount measures afterwards
 * (the year axis, the chip rows and the two readouts) carry ids from the widget's scope.
 */
import { html, raw, type SafeHtml } from "../../builders/html";
import { badge, type BadgeTone } from "../../builders/badge";
import { swatch } from "../../builders/swatch";
import styles from "./leap-chart.module.css";

/** Which reading lights a mark: 2 is the counted span, 3 the checked second 60. */
export type LeapSeries = 0 | 2 | 3;

export interface LeapRiser {
  x: number;
  y1: number;
  y2: number;
  series: LeapSeries;
}

export interface LeapMark {
  at: number;
  level: number;
  series: LeapSeries;
}

interface LeapChip {
  at: number;
  text: string;
  series: 2 | 3;
}

export interface LeapChartView {
  /** The plot's accessible name: the reading's summary. */
  label: string;
  yTicks: readonly { level: number; text: string }[];
  /** The step line's `points` and the filled area's path. */
  line: string;
  area: string;
  risers: readonly LeapRiser[];
  marks: readonly LeapMark[];
  years: readonly { pct: number; year: number }[];
  chips: readonly LeapChip[];
  pin: { at: number } | null;
  dot: { at: number; level: number } | null;
  pinFlag: { at: number; side: "start" | "end"; text: string } | null;
  band: { from: number; to: number } | null;
  bandFlag: { at: number; text: string } | null;
  ghost: { at: number; level: number; side: "start" | "end" } | null;
  /** A reading was asked for and the library gave no value. */
  sentinel: boolean;
  /** Where continuous UTC begins on the axis, in percent. */
  continuousAt: number;
  continuousText: string;
}

/** The text of the plot's sentinel. */
export const LEAP_NO_SIGNAL = "⟨ NO SIGNAL — invalid input ⟩";

/** The local names of the parts the mount measures, scoped by the widget's `id`. */
export const LEAP_PARTS = {
  axis: "axis",
  chips: "chips",
  continuousRow: "continuous-row",
  continuousFlag: "continuous-flag",
  pinFlag: "pin-flag",
  bandFlag: "band-flag",
  plot: "plot",
} as const;

/** The selectors the mount hands `thinTickLabels`: attributes the chart writes. */
export const LEAP_TICK = "[data-tick]";
export const LEAP_FLAG = "[data-flag]";

const pct = (n: number): string => `${n}%`;

function chartLine(v: LeapChartView): SafeHtml {
  return html`<svg
    class="${styles.line}"
    viewBox="0 0 100 100"
    preserveAspectRatio="none"
    aria-hidden="true"
    focusable="false"
    ><path class="${styles.area}" d="${v.area}"></path
    >${v.risers.map(
      (r) =>
        html`<line
          class="${styles.riser}"
          data-lit="${String(r.series !== 0)}"
          data-series="${r.series === 0 ? "" : r.series}"
          x1="${r.x}"
          x2="${r.x}"
          y1="${r.y1}"
          y2="${r.y2}"
          vector-effect="non-scaling-stroke"
        ></line>`,
    )}<polyline class="${styles.step}" points="${v.line}" fill="none" vector-effect="non-scaling-stroke"></polyline></svg
  >`;
}

/** The chart: a y axis, the plot, the year axis and two rows of chips. */
export function leapChart(
  v: LeapChartView,
  id: (local: string) => string,
): SafeHtml {
  return html`<div class="${styles.chart}"
    ><div class="${styles.yaxis}" aria-hidden="true"
      >${v.yTicks.map(
        (t) =>
          html`<span class="${styles.ytick}" style="--level: ${pct(t.level)}">${t.text}</span>`,
      )}</div
    ><div
      class="${styles.plot}"
      id="${id(LEAP_PARTS.plot)}"
      data-gate="drawn"
      role="img"
      aria-label="${v.label}"
      ><span
        class="${styles.span} ${styles.continuous}"
        style="--from: ${pct(v.continuousAt)}; --to: 100%"
      ></span
      >${
        v.band === null
          ? ""
          : html`<span
            class="${styles.span} ${styles.band}"
            data-series="2"
            style="--from: ${pct(v.band.from)}; --to: ${pct(v.band.to)}"
          ></span>`
      }<div class="${styles.field}"
        ><div class="${styles.grid}"
          >${v.yTicks.map(
            (t) =>
              html`<span class="${styles.gridline}" style="--level: ${pct(t.level)}"></span>`,
          )}</div
        >${chartLine(v)}${
          v.dot === null
            ? ""
            : html`<span
              class="${styles.guide}"
              data-series="1"
              style="--at: ${pct(v.dot.at)}; --level: ${pct(v.dot.level)}"
            ></span>`
        }<div class="${styles.marks}"
          >${v.marks.map(
            (m) =>
              html`<span
                class="${styles.mark}"
                data-lit="${String(m.series !== 0)}"
                data-series="${m.series === 0 ? "" : m.series}"
                style="--at: ${pct(m.at)}; --level: ${pct(m.level)}"
              ></span>`,
          )}</div
        >${
          v.ghost === null
            ? ""
            : html`<span
              class="${styles.ghost}"
              data-series="3"
              data-side="${v.ghost.side}"
              style="--at: ${pct(v.ghost.at)}; --level: ${pct(v.ghost.level)}"
              ><i></i><b>never inserted</b></span
            >`
        }${
          v.dot === null
            ? ""
            : html`<span
              class="${styles.dot}"
              data-series="1"
              style="--at: ${pct(v.dot.at)}; --level: ${pct(v.dot.level)}"
            ></span>`
        }</div
      >${
        v.pin === null
          ? ""
          : html`<span
            class="${styles.pin}"
            data-series="1"
            style="--at: ${pct(v.pin.at)}"
          ></span>`
      }${
        v.pinFlag === null
          ? ""
          : html`<span
            class="${styles.tag}"
            id="${id(LEAP_PARTS.pinFlag)}"
            data-series="1"
            data-side="${v.pinFlag.side}"
            style="--at: ${pct(v.pinFlag.at)}"
            >${v.pinFlag.text}</span
          >`
      }${
        v.bandFlag === null
          ? ""
          : html`<span
            class="${styles.tag} ${styles.tagBand}"
            id="${id(LEAP_PARTS.bandFlag)}"
            data-series="2"
            data-side="mid"
            style="--at: ${pct(v.bandFlag.at)}"
            >${v.bandFlag.text}</span
          >`
      }${
        v.sentinel
          ? html`<span class="${styles.nosignal}">${LEAP_NO_SIGNAL}</span>`
          : ""
      }</div
    ><div class="${styles.axis}" id="${id(LEAP_PARTS.axis)}" aria-hidden="true"
      >${v.years.map(
        (t) =>
          html`<span class="${styles.tick}" data-tick style="--at: ${pct(t.pct)}">${t.year}</span>`,
      )}</div
    ><div class="${styles.row}" id="${id(LEAP_PARTS.chips)}" aria-hidden="true"
      >${v.chips.map(
        (c) =>
          html`<span class="${styles.flag}" data-flag style="--at: ${pct(c.at)}"
            ><span class="${styles.chip}" data-series="${c.series}">${c.text}</span></span
          >`,
      )}</div
    ><div class="${styles.row}" id="${id(LEAP_PARTS.continuousRow)}" aria-hidden="true"
      ><span
        class="${styles.flag}"
        id="${id(LEAP_PARTS.continuousFlag)}"
        data-side="start"
        style="--at: ${pct(v.continuousAt)}"
        ><span class="${styles.chip}">${v.continuousText}</span></span
      ></div
    ></div
  >`;
}

/** The words under the chart's caption: which axis, which risers. */
export function leapCaption(): SafeHtml {
  return html`<p class="${styles.caption}" aria-hidden="true"
    ><span>TAI − UTC, in seconds</span><span>each riser is one inserted second</span></p
  >`;
}

const LEGEND: readonly { series: 1 | 2 | 3 | null; words: string }[] = [
  { series: null, words: "an inserted second" },
  { series: 1, words: "the date" },
  { series: 2, words: "counted between the two dates" },
  { series: 3, words: "your second 60" },
];

/** What each colour means, always beside its words. */
export function leapLegend(): SafeHtml {
  return html`<ul class="${styles.legend}" aria-label="Legend"
    >${LEGEND.map(
      (l) =>
        html`<li class="${styles.legendItem}"
          >${
            l.series === null
              ? html`<span class="${styles.plain}" aria-hidden="true"></span>`
              : swatch({ series: l.series })
          }${l.words}</li
        >`,
    )}</ul
  >`;
}

const TAG_TONE: Record<2 | 3, { tone: BadgeTone; text: string }> = {
  2: { tone: "spring", text: "counted" },
  3: { tone: "purple", text: "your second 60" },
};

/**
 * The table's first cell: the inserted second on one line and its tag on the next. The tag
 * line always has its height, so a row is the same size whether or not the second is
 * lit, and a reading never moves the table.
 */
export function insertionCell(insertion: string, series: LeapSeries): SafeHtml {
  const tag = series === 0 ? null : TAG_TONE[series];
  return html`<span class="${styles.cellLine}">${insertion === "" ? raw("&nbsp;") : insertion}</span
    ><span class="${styles.cellTag}"
      >${tag === null ? raw("&nbsp;") : badge({ text: tag.text, tone: tag.tone })}</span
    >`;
}

/** The value cell: one line, held to its height when blank. */
export function offsetCell(text: string): SafeHtml {
  return html`<span class="${styles.cellLine}">${text === "" ? raw("&nbsp;") : text}</span
    ><span class="${styles.cellTag}">${raw("&nbsp;")}</span>`;
}
