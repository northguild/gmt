/**
 * The punctuality board's pieces: the board grid, a tolerance lane, an arrival row, the
 * axis ticks, the rate and naive lines and the NO SIGNAL span.
 *
 * One grid of three columns (label, axis, result) is shared through subgrid by the tolerance
 * track, every arrival row and the tick row, so a position along any of them is the same
 * moment along all of them. Positions are percentages the mount computes from the library's
 * results; nothing here computes a time.
 *
 * A lane holds its band and up to two handle boxes, one for each half of the axis, so a
 * handle's own bounds (early runs left of the plan, late right of it) are the handle's
 * `min` and `max` and the pointer maps across just that half.
 *
 * Early and late are words, never colours. A bar is a stem from the plan to the deviation:
 * solid inside the band, hatched outside it. State is a `data-*` attribute the mount sets on
 * the board: `data-open` (early is off), `data-compare` (a second tolerance is drawn) and
 * `data-noband` (the late tolerance does not read).
 */
import { gateAttr, type GateOption } from "../../builders/gate";
import { html, type HtmlValue, type SafeHtml } from "../../builders/html";
import hatch from "./punct-hatch.module.css";
import styles from "./punct-board.module.css";

/** The signal-lost mark for a value the library refused, in words. */
export function noSignal(text = "NO SIGNAL"): SafeHtml {
  return html`<span class="${styles.lost}">${text}</span>`;
}

/** One rate line: bordered, tinted, never a one-sided accent. */
export function punctRate(content: HtmlValue): SafeHtml {
  return html`<p class="${styles.rate}">${content}</p>`;
}

/** The wall-clock (naive) reading, outlined and dashed so it never reads as the answer. */
export function punctNaive(content: HtmlValue): SafeHtml {
  return html`<p class="${styles.naive}">${content}</p>`;
}

export interface PunctBoardOptions {
  id: string;
  /** The id of the paragraph that sums the arrivals up. */
  summaryId: string;
  /** The group's accessible name. */
  label: string;
  tolerance: SafeHtml;
  rowsId: string;
  ticksId: string;
}

export function punctBoard(o: PunctBoardOptions): SafeHtml {
  return html`<div
    class="${styles.board}"
    id="${o.id}"
    role="group"
    aria-label="${o.label}"
    aria-describedby="${o.summaryId}"
    data-open="false"
    data-compare="false"
    data-noband="false"
    ><div class="${styles.trackRow}"
      ><span class="${styles.trackLabel}" aria-hidden="true">Tolerance</span
      ><div class="${styles.track}" data-gate="track">${o.tolerance}</div></div
    ><ol class="${styles.rows}" id="${o.rowsId}" role="list" data-gate="drawn"></ol
    ><div class="${styles.axisRow}"
      ><div class="${styles.ticks}" id="${o.ticksId}" aria-hidden="true"></div></div
    ></div
  >`;
}

export interface PunctLaneOptions extends GateOption {
  /** 1 for the first tolerance, 3 for the second. */
  series: 1 | 3;
  /** The lane's own id, so the mount can show and hide it. */
  id?: string;
  bandId: string;
  bandTextId: string;
  /** The second tolerance's band keeps dashed edges. */
  second?: boolean;
  hidden?: boolean;
  /** The handle box for the left half of the axis (the early tolerance). */
  early?: { id: string; hidden: boolean; handle: SafeHtml };
  /** The handle box for the right half of the axis. */
  late: SafeHtml;
}

export function punctLane(o: PunctLaneOptions): SafeHtml {
  return html`<div
    class="${styles.lane}"
    ${o.id === undefined ? "" : html`id="${o.id}"`}
    data-series="${o.series}"
    ${o.hidden === true ? html`hidden` : ""}
    ${gateAttr(o.gate)}
    ><span
      class="${styles.band}"
      id="${o.bandId}"
      data-second="${String(o.second === true)}"
      aria-hidden="true"
      ><span class="${styles.bandText}" id="${o.bandTextId}"></span></span
    >${
      o.early === undefined
        ? ""
        : html`<div
            class="${styles.half} ${styles.halfEarly}"
            id="${o.early.id}"
            ${o.early.hidden ? html`hidden` : ""}
            >${o.early.handle}</div
          >`
    }<div class="${styles.half} ${styles.halfLate}">${o.late}</div></div
  >`;
}

/** A bar's stretch along the axis, in percent of the bar cell. */
export interface BarSpan {
  left: number;
  width: number;
}

export interface PunctRowOptions {
  label: string;
  /** The stem; `null` draws none (no deviation). */
  inside: BarSpan | null;
  outside: BarSpan | null;
  /** The deviation is negative: the gradient and the cap flip to the left. */
  negative: boolean;
  /** The deviation in words, or a NO SIGNAL span. */
  delta: HtmlValue;
  /** The class word: a tag for late or early, else plain. */
  word: HtmlValue;
  /** The second tolerance's word, on its own line; `undefined` when it is off. */
  second?: HtmlValue;
  /** The wall-clock reading's two lines, or `undefined` when it is not drawn. */
  naive?: readonly [string, string];
}

const r2 = (n: number): number => Math.round(n * 100) / 100;
const box = (s: BarSpan): string =>
  `left: ${r2(s.left)}%; width: ${r2(s.width)}%`;

/** A class word as a tag when it says early or late. */
export function punctWord(word: string, tagged: boolean): SafeHtml {
  return tagged
    ? html`<span class="${styles.tag}">${word}</span>`
    : html`${word}`;
}

export function punctRow(o: PunctRowOptions): SafeHtml {
  const outsideEnd = o.outside !== null;
  return html`<li class="${styles.row}"
    ><span class="${styles.rowLabel}">${o.label}</span
    ><span class="${styles.barCell}" aria-hidden="true"
      >${
        o.inside === null
          ? ""
          : html`<span
              class="${styles.barIn}"
              data-negative="${String(o.negative)}"
              data-end="${String(!outsideEnd)}"
              style="${box(o.inside)}"
            ></span>`
      }${
        o.outside === null
          ? ""
          : html`<span
              class="${styles.barOut} ${hatch.hatch}"
              data-negative="${String(o.negative)}"
              data-end="true"
              style="${box(o.outside)}"
            ></span>`
      }</span
    ><span class="${styles.rowText}"
      ><span class="${styles.textLine}">${o.delta}</span
      ><span class="${styles.textLine}">${o.word}</span
      >${
        o.second === undefined
          ? ""
          : html`<span class="${styles.textLine}">${o.second}</span>`
      }${
        o.naive === undefined
          ? ""
          : html`<span class="${styles.rowNaive}"
              ><span class="${styles.textLine}">${o.naive[0]}</span
              ><span class="${styles.textLine}">${o.naive[1]}</span></span
            >`
      }</span
    ></li
  >`;
}

export interface PunctTick {
  /** Where the label hangs from, in percent of the row. */
  at: number;
  label: string;
}

/** The axis labels. The first starts at its tick, the last ends at it, the rest centre on it. */
export function punctTicks(ticks: readonly PunctTick[]): SafeHtml {
  return html`${ticks.map(
    (t, i) =>
      html`<span
        class="${styles.tick}"
        data-tick="true"
        data-hang="${i === 0 ? "start" : i === ticks.length - 1 ? "end" : "mid"}"
        style="left: ${r2(t.at)}%"
        >${t.label}</span
      >`,
  )}`;
}

/** The box round the calls table: its columns keep their widths while a value changes. */
export function punctCalls(children: SafeHtml): SafeHtml {
  return html`<div class="${styles.calls}">${children}</div>`;
}
