/**
 * clockPlot: the Demurrage Clock's drawing, over the ledger lane's day columns.
 *
 * Three pieces, all pure markup the mount writes with `setHtml`:
 * - `clockPlot(id, lanes)` is the group that holds the events rail, the four clock lanes
 *   and the empty-state line. Its parts have ids `<id>-rail`, `<id>-lanes` and `<id>-empty`.
 * - `clockRail(events)` is the rail's items: a diamond on the scale and a chip with the
 *   event's word (and its local time). The chip is `aria-hidden`; the item's `aria-label`
 *   says it all. The mount places each chip against the rail's measured width.
 * - `clockLanes(lanes)` is the four lanes: label chip, half-open bar, and the reason chip
 *   for a clock the library returned null for. A lane that is not the chosen one is dimmed.
 *
 * `CLOCK_PLOT_HEIGHT` is the track height to pass to `ledgerLane({ height })`.
 */
import { html, type SafeHtml } from "../../builders/html";
import styles from "./clock-plot.module.css";

/** The height of the track the plot fills: head, rail and four lanes. Matches the module. */
export const CLOCK_PLOT_HEIGHT = "calc(2.9rem + 8rem + 4 * 4.6rem)";

export interface ClockLaneView {
  /** The lane's number, 1 to 4: its series colour. */
  n: number;
  scope: string;
  /** The label chip's text. */
  label: string;
  /** What a screen reader hears for the lane. */
  aria: string;
  chosen: boolean;
  /** The half-open bar as percentages of the scale, or null when there is none. */
  bar: { from: number; to: number } | null;
  /** The reason chip's text, or null when the clock has an interval. */
  why: string | null;
}

export interface RailEventView {
  n: number;
  type: string;
  word: string;
  /** The instant on the terminal clock, or "". */
  local: string;
  /** Percent of the scale. */
  pct: number;
  aria: string;
}

export function clockRail(events: readonly RailEventView[]): SafeHtml {
  return html`${events.map(
    (
      e,
    ) => html`<div class="${styles.event}" role="listitem" data-type="${e.type}" aria-label="${e.aria}"
      ><i class="${styles.diamond}" aria-hidden="true" style="--at: ${String(e.pct)}%"></i
      ><span class="${styles.chip}" aria-hidden="true" data-event-chip data-x="${String(e.pct)}" style="--at: ${String(e.pct)}%"
        ><span>${e.word}</span>${e.local === "" ? "" : html`<span class="${styles.time}">${e.local}</span>`}</span
      ></div
    >`,
  )}`;
}

export function clockLanes(lanes: readonly ClockLaneView[]): SafeHtml {
  return html`${lanes.map(
    (
      l,
    ) => html`<div class="${styles.lane}" role="listitem" data-series="${String(l.n)}" data-scope="${l.scope}" data-chosen="${String(l.chosen)}" aria-label="${l.chosen ? `${l.aria}, the chosen clock` : l.aria}"
      ><span class="${styles.label}" aria-hidden="true">${l.label}</span
      >${
        l.bar === null
          ? ""
          : html`<div class="${styles.bar}" aria-hidden="true" style="--from: ${String(l.bar.from)}; --to: ${String(l.bar.to)}"></div>`
      }${
        l.why === null
          ? ""
          : html`<span class="${styles.why}" aria-hidden="true">${l.why}</span>`
      }</div
    >`,
  )}`;
}

interface ClockPlotOptions {
  id: string;
  /** The text for the empty state, or "" when the plot has events. */
  empty: string;
  events: readonly RailEventView[];
  lanes: readonly ClockLaneView[];
}

export function clockPlot(o: ClockPlotOptions): SafeHtml {
  return html`<div class="${styles.plot}" role="group" aria-label="Events and the four clocks over the terminal's local days"
    ><div class="${styles.rail}" id="${o.id}-rail" role="list" aria-label="Events">${clockRail(o.events)}</div
    ><div class="${styles.lanes}" id="${o.id}-lanes" role="list" aria-label="Clocks">${clockLanes(o.lanes)}</div
    ><p class="${styles.empty}" id="${o.id}-empty" ${o.empty === "" ? "hidden" : ""}>${o.empty}</p
  ></div>`;
}
