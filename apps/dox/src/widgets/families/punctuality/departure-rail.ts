/**
 * The departure rail: a timetable on a time line, for the Departure Board.
 *
 * A lit glass line with a glowing tick for each departure, the service window, the
 * connection bar and the made and naive departures. The made departure is a gate; the naive
 * one a hollow dashed marker. The start of a service window is a closed edge, the end a
 * dashed open one, and the time past it is hatched. Each also says so in words, on an opaque
 * chip.
 *
 * The rail is a picture: `departureStage` names it from the summary the widget writes, and
 * the arrival's own `<gmt-handle>` sits over it. Nothing here is a success or an error hue.
 * Amber is the sentinel's alone.
 *
 * The chips are placed by the mount, which measures them (`data-label`, `data-x`, `data-y`
 * say where each wants to sit) and marks the shapes a chip must clear with `data-block`.
 * The mount sets `data-placed` once a chip has its place.
 */
import { html, type SafeHtml } from "../../builders/html";
import { gateAttr, type GateOption } from "../../builders/gate";
import hatch from "./punct-hatch.module.css";
import styles from "./departure-rail.module.css";

/** A span along the rail, in percent of its width. */
export interface RailSpan {
  left: number;
  width: number;
}

export interface RailLabel {
  text: string;
  /** Where the chip is centred along the rail, in percent. */
  x: number;
  /** Where it is centred down the rail, in percent. */
  y: number;
  /** The naive reading's chip is quieter. */
  dim?: boolean;
}

export interface RailMarks {
  /** The connection bar, from the arrival to the earliest feasible departure. */
  conn?: RailSpan;
  /** A headway too dense to tick: a fine comb across the span. */
  run?: RailSpan;
  /** Each listed departure, in percent. */
  ticks: readonly number[];
  /** The service window of a headway timetable. */
  window?: RailSpan;
  /** The closed stretch past the window's end. */
  beyond?: RailSpan;
  /** The window's closed start and open end, in percent. */
  from?: number;
  to?: number;
  naive?: number;
  made?: number;
  labels: readonly RailLabel[];
}

const r2 = (n: number): number => Math.round(n * 100) / 100;
const box = (s: RailSpan): string =>
  `left: ${r2(s.left)}%; width: ${r2(s.width)}%`;

/** The inside of the rail: every mark, painted back to front. */
export function departureRail(m: RailMarks): SafeHtml {
  return html`<span class="${styles.line}" data-block="true"></span
    >${
      m.window === undefined
        ? ""
        : html`<span class="${styles.window}" data-window="true" style="${box(m.window)}"></span>`
    }${
      m.beyond === undefined
        ? ""
        : html`<span class="${styles.beyond}" data-block="true" style="${box(m.beyond)}"></span>`
    }${
      m.conn === undefined
        ? ""
        : html`<span class="${styles.conn} ${hatch.hatch}" data-block="true" style="${box(m.conn)}"></span>`
    }${
      m.run === undefined
        ? ""
        : html`<span class="${styles.run}" data-block="true" style="${box(m.run)}"></span>`
    }${m.ticks.map(
      (t) =>
        html`<span class="${styles.tick}" data-block="true" style="left: ${r2(t)}%"></span>`,
    )}${
      m.from === undefined
        ? ""
        : html`<span class="${styles.from}" data-block="true" style="left: ${r2(m.from)}%"></span>`
    }${
      m.to === undefined
        ? ""
        : html`<span class="${styles.to}" data-block="true" style="left: ${r2(m.to)}%"></span>`
    }${
      m.naive === undefined
        ? ""
        : html`<span class="${styles.naive}" data-block="true" style="left: ${r2(m.naive)}%"></span>`
    }${
      m.made === undefined
        ? ""
        : html`<span class="${styles.tick} ${styles.made}" data-block="true" style="left: ${r2(m.made)}%"></span>`
    }${m.labels.map(
      (l) =>
        html`<span
          class="${styles.chip}"
          data-dim="${String(l.dim === true)}"
          data-label="true"
          data-x="${r2(l.x)}"
          data-y="${r2(l.y)}"
          style="left: ${r2(l.x)}%; top: ${r2(l.y)}%"
          >${l.text}</span
        >`,
    )}`;
}

export interface DepartureStageOptions extends GateOption {
  /** Ids the mount writes into. */
  railId: string;
  ticksId: string;
  /** The id of the summary that names the rail. */
  summaryId: string;
  /** The id of the box the handle sits in, so the mount can hide it. */
  handleBoxId: string;
  /** The arrival's `handleTrack(handle(...))`. */
  handle: SafeHtml;
}

/** The stage the rail and the handle share, and the tick labels under it. */
export function departureStage(o: DepartureStageOptions): SafeHtml {
  return html`<div class="${styles.stage}" ${gateAttr(o.gate)}
      ><div
        class="${styles.rail}"
        id="${o.railId}"
        role="img"
        aria-labelledby="${o.summaryId}"
      ></div
      ><div class="${styles.handleBox}" id="${o.handleBoxId}">${o.handle}</div></div
    ><div class="${styles.ticks}" id="${o.ticksId}" aria-hidden="true"></div>`;
}

/** The labels along the bottom of the rail, each hung from its tick. */
export function departureTicks(
  ticks: readonly { at: number; label: string }[],
): SafeHtml {
  return html`${ticks.map(
    (t) =>
      html`<span class="${styles.tickLabel}" data-tick="true" style="left: ${r2(t.at)}%"
        >${t.label}</span
      >`,
  )}`;
}
