/**
 * blPlot: the B/L Date Stamp's drawing: lanes of local days on one time axis, with one gate line
 * that cuts every lane.
 *
 * Each lane is a `listitem` of the "Calendars" list: a label (a number badge and the zone's
 * name) and a track that holds the lane's own `Local days` list, written empty for the mount to
 * fill with `dayColumns`, and a note for a lane with nothing to draw. The gate is one element
 * in a layer laid over the tracks, so a single line cuts every lane; the layer and the badges
 * are drawn only, and the day columns carry the dates.
 *
 * Lane 0 is UTC, read naively: its days are hollow and dashed, and shape, not colour, tells it
 * apart. Lanes 1 to 4 take the series colours. The gate's place is a percent of a track,
 * written by the mount as `--gmt-gate-at`; the chip's side is `data-edge`.
 *
 * Ids: `<id>-lane-N`, `-lane-label-N`, `-track-N`, `-cells-N`, `-note-N`, and `-plot`, `-gate`,
 * `-gate-chip`. The ledger frame, axis and legend around it are the ledger family's.
 */
import { gateAttr } from "../../builders/gate";
import { html, type SafeHtml } from "../../builders/html";
import styles from "./bl-plot.module.css";

interface BlPlotOptions {
  /** `idScope` of the widget. */
  id: (local: string) => string;
  /** How many lanes. Lane 0 is the hollow UTC lane. */
  lanes: number;
}

function lane(id: (local: string) => string, index: number): SafeHtml {
  const series = index >= 1 && index <= 4 ? String(index) : "";
  return html`<div class="${styles.lane}" role="listitem" id="${id(`lane-${index}`)}" data-lane="${String(index)}" ${series === "" ? "" : html`data-series="${series}"`}
    ><span class="${styles.label}"
      >${index === 0 ? "" : html`<i class="${styles.badge}" aria-hidden="true">${String(index)}</i>`}<span id="${id(`lane-label-${index}`)}"></span></span
    ><div class="${styles.track}" id="${id(`track-${index}`)}"
      ><div class="${styles.days}" id="${id(`cells-${index}`)}" role="list" aria-label="Local days"></div
      ><span class="${styles.note}" id="${id(`note-${index}`)}" hidden></span></div
  ></div>`;
}

export function blPlot(o: BlPlotOptions): SafeHtml {
  const lanes = Array.from({ length: o.lanes }, (_, i) => lane(o.id, i));
  return html`<div class="${styles.plot}" id="${o.id("plot")}" ${gateAttr("drawn")}
    ><div class="${styles.lanes}" role="list" aria-label="Calendars, one lane each">${lanes}</div
    ><div class="${styles.gateLayer}" aria-hidden="true"
      ><div class="${styles.gate}" id="${o.id("gate")}" data-edge="start" hidden
        ><span class="${styles.chip}" id="${o.id("gate-chip")}"></span></div></div
  ></div>`;
}
