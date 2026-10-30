/**
 * The ledger's frame and lane: the drawn surface that holds the plates and a labelled lane of
 * local-day columns, with the half-open bar, the expiry gate, the axis and the legend.
 *
 * - `ledgerFrame` is the `frame` the stillness gate records, a named container, so the narrow
 *   rules read its width and not the card's.
 * - `ledgerLane` is a mono label beside a track (`drawn track`) that holds the `cells` list
 *   (`role="list"`, written empty; the mount fills it with `dayColumns`) and what the tool adds:
 *   a gate, a bar, the handles.
 * - `ledgerBar` is the half-open bar: a solid start edge and a dashed end edge. It is drawn
 *   only; the handles on its edges carry the name, the value and the keys.
 * - `ledgerHandles` lays the kit's handle track over the lane, so a handle's percent is the
 *   canvas's percent.
 * - `ledgerGate` is a vertical line with a chip that flips to the other side near the edge.
 * - `axisTicks` and `ledgerLegend` are drawn text for the eye.
 *
 * Positions are data: the mount writes `--gmt-bar-from`, `--gmt-bar-to` and `--gmt-gate-at`
 * (a percent of the track), and the module reads them.
 */
import { gateAttr, type GateOption } from "../../builders/gate";
import { html, type HtmlValue, type SafeHtml } from "../../builders/html";
import { grow } from "../../primitives/grow/grow";
import { handleTrack } from "../../primitives/handle/handle";
import styles from "./ledger-lane.module.css";

/** In a `<gmt-grow>`: the plates, the lane and the legend are written at mount, so the frame
 *  eases to its height and does not push the page. */
export function ledgerFrame(children: HtmlValue, o: GateOption = {}): SafeHtml {
  return grow(
    html`<div class="${styles.frame}" ${gateAttr(o.gate)}>${children}</div>`,
  );
}

interface LedgerLaneOptions {
  /** Scope for the lane's parts: `<id>-label`, `<id>-track`, `<id>-cells`. */
  id: string;
  /** The label beside the track, such as the zone's name. */
  label: string;
  /** The list's accessible name. */
  daysLabel: string;
  /** Reserve a row above the days for a gate's chip. */
  gateRow?: boolean;
  /** The lane's series colour, 1 to 4. */
  series?: 1 | 2 | 3 | 4;
  /** A CSS length for the days' height when the lane holds more than one row, such as `calc(2rem + 4 * 4rem)`. */
  height?: string;
}

/** `children` follow the (empty) days list: a gate, a bar, the handles. */
export function ledgerLane(
  o: LedgerLaneOptions,
  children: HtmlValue,
): SafeHtml {
  return html`<div class="${styles.lane}" data-series="${String(o.series ?? 1)}"
    ${o.height === undefined ? "" : html`style="--gmt-ledger-lane-h: ${o.height}"`}
    ><span class="${styles.label}" id="${o.id}-label">${o.label}</span
    ><div class="${styles.track}" id="${o.id}-track" data-gate="drawn track" data-gate-row="${String(o.gateRow === true)}"
      ><div class="${styles.days}" id="${o.id}-cells" role="list" aria-label="${o.daysLabel}"></div
      >${children}</div
    ></div
  >`;
}

interface LedgerBarOptions {
  id: string;
}

export function ledgerBar(o: LedgerBarOptions): SafeHtml {
  return html`<div class="${styles.bar}" id="${o.id}" data-invalid="false" aria-hidden="true" hidden></div>`;
}

interface LedgerGateOptions {
  id: string;
  /** The chip's first text, before the local time. */
  label: string;
}

export function ledgerGate(o: LedgerGateOptions): SafeHtml {
  return html`<div class="${styles.gate}" id="${o.id}" data-edge="start" hidden
    ><span class="${styles.gateChip}" id="${o.id}-chip">${o.label}</span></div
  >`;
}

/** The handles' own box, over the whole track. `handles` are `handle()` results. */
export function ledgerHandles(handles: SafeHtml): SafeHtml {
  return html`<div class="${styles.overlay}">${handleTrack(handles)}</div>`;
}

/** The axis: the track's own element, which the mount fills with `axisTicks`. */
export function ledgerAxis(id: string, labels: readonly string[]): SafeHtml {
  return html`<div class="${styles.axis}" id="${id}" aria-hidden="true">${axisTicks(labels)}</div>`;
}

/** The text of the axis, one span per label. */
export function axisTicks(labels: readonly string[]): SafeHtml {
  return html`${labels.map((text) => html`<span>${text}</span>`)}`;
}

type LedgerSwatch = "lit" | "dim" | "hatched" | "closed" | "plain" | "event";

interface LedgerLegendItem {
  text: string;
  swatch: LedgerSwatch;
}

export function ledgerLegend(items: readonly LedgerLegendItem[]): SafeHtml {
  return html`<ul class="${styles.legend}" aria-label="Legend"
    >${items.map(
      (item) =>
        html`<li class="${styles.legendItem}"><i class="${styles.swatch}" data-state="${item.swatch}" aria-hidden="true"></i>${item.text}</li>`,
    )}</ul
  >`;
}
