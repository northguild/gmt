/**
 * dwellTimeline, dwellLane and dwellAxis: the Dwell Ledger's drawing, as three builders.
 *
 * A lane is a labelled row (`role="group"`, named by its label) over a track. The track
 * holds the `cells` list (the day columns, written by `dayColumns`), the elapsed bar and,
 * on the first row, the two entry and exit handles in an overlay that sits on the bar.
 * The mount only writes values: the lane's `data-series`, the bar's `--gmt-from` and
 * `--gmt-to` (0 to 100) and its `data-state`, and the label text. Nothing is positioned
 * by script, and a bar that has no valid ends is `hidden`.
 *
 * The timeline is the container the lanes and the axis answer to, so the label column
 * folds above its track, and the axis drops its middle date, by the widget's own width in
 * the docs column and the chat rail alike.
 */
import { gateAttr } from "../../builders/gate";
import { html, type SafeHtml } from "../../builders/html";
import styles from "./dwell-lane.module.css";

/** The ids a lane writes, derived from the widget's `idScope`. */
export type LaneName = "dwell" | "compare";

interface DwellLaneOptions {
  /** The widget's `idScope(idPrefix)`. */
  id: (local: string) => string;
  name: LaneName;
  series: 1 | 2;
  hidden?: boolean;
  /** The gate part(s) the track carries. */
  gate: string;
  /** The `handleTrack` over the bar, on the row that has handles. */
  handles?: SafeHtml;
}

/** The local ids of a lane's parts, which the mount finds them by. */
export const laneIds = (name: LaneName) => ({
  row: `${name}-row`,
  label: `${name}-label`,
  cells: `${name}-cells`,
  bar: `${name}-bar`,
});

export function dwellLane(o: DwellLaneOptions): SafeHtml {
  const ids = laneIds(o.name);
  return html`<div
    class="${styles.lane}"
    id="${o.id(ids.row)}"
    role="group"
    aria-labelledby="${o.id(ids.label)}"
    data-series="${String(o.series)}"
    ${o.hidden === true ? html`hidden` : ""}
  ><span class="${styles.label}" id="${o.id(ids.label)}"></span
  ><div class="${styles.track}" ${gateAttr(o.gate)}
    ><div class="${styles.cells}" id="${o.id(ids.cells)}" role="list" aria-labelledby="${o.id(ids.label)}"></div
    ><div class="${styles.bar}" id="${o.id(ids.bar)}" data-state="valid" aria-hidden="true" hidden></div
    >${o.handles === undefined ? "" : html`<div class="${styles.handles}">${o.handles}</div>`}</div
  ></div
  >`;
}

/** The three dates under the timeline: the canvas's start, middle and end. */
export function dwellAxis(id: (local: string) => string): SafeHtml {
  return html`<div class="${styles.axis}" aria-hidden="true"
    ><span id="${id("axis-start")}"></span
    ><span class="${styles.mid}" id="${id("axis-mid")}"></span
    ><span id="${id("axis-end")}"></span></div
  >`;
}

/** The container the lanes and the axis sit in. `children` are `dwellLane` and `dwellAxis` results. */
export function dwellTimeline(children: SafeHtml): SafeHtml {
  return html`<div class="${styles.timeline}">${children}</div>`;
}
