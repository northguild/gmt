/**
 * storedFigure: the two lanes the selected line is drawn on, and the legend under them.
 *
 * The first lane is the zone's own clock: a day with the skipped or repeated hour as a band and
 * the stored time as a pin (a day strip), or two plates that set the zone's offset against the
 * stored one (a since strip). The second is the exact timeline in UTC: the clock change as a
 * gate and each reading as a mark. Both lanes keep one reserved height, so a gap, an overlap
 * and a since strip are the same size, and so is a line with nothing to draw.
 *
 * The builders take numbers, never a library result: a position is a percentage along the
 * lane, 0 to 100. A chip hangs from its point by an anchor (start, mid, end) so a point near an
 * edge does not push its chip out of the lane. The band, the pin and the break are named
 * images; the ticks, the baseline and the marklines are drawing only, and the chips carry the
 * words. The legend always holds its five items. An item that does not apply keeps its place
 * and is hidden, so the figure never changes size.
 */
import { html, type HtmlValue, type SafeHtml } from "../../builders/html";
import styles from "./stored-lanes.module.css";

export type LegendId = "gap" | "overlap" | "gate" | "mark" | "break";

export const LEGEND: readonly { id: LegendId; text: string }[] = [
  { id: "gap", text: "skipped hour" },
  { id: "overlap", text: "repeated hour" },
  { id: "gate", text: "clock change" },
  { id: "mark", text: "a reading" },
  { id: "break", text: "time not drawn" },
];

/** The most readings the exact lane has a row for. */
const MARK_TIERS = 3;

/** A position as the style value: two decimals at most. */
function pct(n: number): string {
  return String(Math.round(n * 100) / 100);
}

function anchorOf(x: number): "start" | "mid" | "end" {
  return x < 22 ? "start" : x > 78 ? "end" : "mid";
}

type ChipKind = "gap" | "overlap" | "pin" | "gate" | "mark";

interface ChipOptions {
  kind: ChipKind;
  x: number;
  text: string;
  tier?: number;
  series?: number;
  title?: string;
}

function chip(o: ChipOptions): SafeHtml {
  const tier = o.tier === undefined ? "" : `;--tier:${o.tier}`;
  return html`<span
    class="${styles.chip}"
    data-kind="${o.kind}"
    ${o.series === undefined ? "" : html`data-series="${String(o.series)}"`}
    data-anchor="${anchorOf(o.x)}"
    ${o.title === undefined ? "" : html`title="${o.title}"`}
    style="--x:${pct(o.x)}${tier}"
    >${o.text}</span
  >`;
}

interface DayTick {
  /** Along the day, 0 to 100. */
  x: number;
  /** The drawn label, such as `06:00`. */
  label: string;
}

interface DayClockOptions {
  kind: "gap" | "overlap";
  /** The band's chip, such as the skipped hour's range. */
  bandText: string;
  /** The band's left edge and width, 0 to 100. */
  bandLeft: number;
  bandWidth: number;
  /** The stored time's place, 0 to 100, and its words. */
  pinX: number;
  pinText: string;
  ticks: readonly DayTick[];
}

/** The zone's clock for a day with a clock change. */
export function dayClock(o: DayClockOptions): SafeHtml {
  const mid = o.bandLeft + o.bandWidth / 2;
  return html`<div class="${styles.chiprow}"
      >${chip({ kind: o.kind, x: mid, text: o.bandText })}</div
    ><div class="${styles.daytrack}"
      ><span
        class="${styles.band}"
        role="img"
        aria-label="${o.bandText}, on the zone's day"
        data-kind="${o.kind}"
        style="--x:${pct(o.bandLeft)};--w:${pct(o.bandWidth)}"
      ></span
      >${o.ticks.map(
        (t) =>
          html`<span class="${styles.tick}" aria-hidden="true" style="--x:${pct(t.x)}"></span>`,
      )}<span
        class="${styles.pin}"
        role="img"
        aria-label="${o.pinText}"
        style="--x:${pct(o.pinX)}"
      ></span></div
    ><div class="${styles.tickrow}" aria-hidden="true"
      >${o.ticks.map(
        (t) =>
          html`<span class="${styles.ticklabel}" data-anchor="${anchorOf(t.x)}" style="--x:${pct(t.x)}">${t.label}</span>`,
      )}</div
    ><div class="${styles.pinrow}"
      >${chip({ kind: "pin", x: o.pinX, text: o.pinText })}</div
    >`;
}

interface SinceClockOptions {
  /** What the zone says now, such as `Zone offset since 2016-03-27: +03:00`. */
  zone: string;
  /** What was stored, such as `Stored offset: +02:00`. */
  stored: string;
}

/** The zone's clock when the offsets, not a day, are the point: two plates. */
export function sinceClock(o: SinceClockOptions): SafeHtml {
  return html`<div class="${styles.plates}"
    ><span class="${styles.plate}" data-series="1">${o.zone}</span
    ><span class="${styles.plate}" data-series="2">${o.stored}</span></div
  >`;
}

export interface ExactMark {
  /** Along the lane, 0 to 100. */
  x: number;
  text: string;
  /** The instant, shown as the chip's tooltip. */
  title: string;
}

export interface ExactGate {
  kind: "gap" | "overlap" | "since";
  x: number;
  text: string;
}

interface ExactTrackOptions {
  gate: ExactGate | null;
  /** The time between the clock change and the readings is not drawn to scale. */
  broken: boolean;
  marks: readonly ExactMark[];
}

/** The exact timeline: the clock change on the first row, then up to three readings. */
export function exactTrack(o: ExactTrackOptions): SafeHtml {
  const gate = o.gate;
  return html`<span class="${styles.baseline}" aria-hidden="true"></span>${
    o.broken
      ? html`<span class="${styles.break}" role="img" aria-label="Time not drawn" style="--x:18;--w:14"></span>`
      : ""
  }${
    gate === null
      ? ""
      : html`<span class="${styles.gate}" aria-hidden="true" data-kind="${gate.kind}" style="--x:${pct(gate.x)};--tier:0"></span
        >${chip({
          kind: gate.kind === "since" ? "gate" : gate.kind,
          x: gate.x,
          text: gate.text,
          tier: 0,
        })}`
  }${o.marks.slice(0, MARK_TIERS).map((m, i) => {
    const series = (i % 3) + 1;
    return html`<span
        class="${styles.markline}"
        aria-hidden="true"
        data-series="${String(series)}"
        style="--x:${pct(m.x)};--tier:${String(i + 1)}"
      ></span
      >${chip({ kind: "mark", x: m.x, text: m.text, tier: i + 1, series, title: m.title })}`;
  })}`;
}

interface StoredFigureOptions {
  /** The whole figure in one sentence: the group's accessible name. */
  label: string;
  /** `dayClock`, `sinceClock` or nothing. */
  clock: HtmlValue;
  /** `exactTrack`. */
  exact: HtmlValue;
  /** The legend items that apply. */
  legend: ReadonlySet<LegendId>;
}

export function storedFigure(o: StoredFigureOptions): SafeHtml {
  return html`<div class="${styles.figure}" role="group" aria-label="${o.label}"
    ><div class="${styles.lane}" role="group" aria-label="On the zone's clock"
      ><span class="${styles.laneName}" aria-hidden="true">On the zone's clock</span
      ><div class="${styles.trackClock}">${o.clock}</div></div
    ><div class="${styles.lane}" role="group" aria-label="On the exact timeline, in UTC"
      ><span class="${styles.laneName}" aria-hidden="true">On the exact timeline, in UTC</span
      ><div class="${styles.trackExact}">${o.exact}</div></div
    ><ul class="${styles.legend}" role="list" aria-label="Legend"
      >${LEGEND.map((item) => {
        const on = o.legend.has(item.id);
        return html`<li
          class="${styles.legendItem}"
          data-legend="${item.id}"
          data-off="${String(!on)}"
          ${on ? "" : html`aria-hidden="true"`}
          ><i class="${styles.swatch}" data-swatch="${item.id}" aria-hidden="true"></i>${item.text}</li
        >`;
      })}</ul
    ></div
  >`;
}
