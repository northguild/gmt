/**
 * gnssLane: one era (or counter) of the GNSS legend, and the blank slot that keeps its box.
 *
 * A labelled group whose name is the lane's whole sentence, holding the era's name, the
 * instant the library gave for it and a row of flags. In the track form (a RINEX week does
 * not wrap) the kit timeline lane and marks draw the pin and today's mark on a track; in
 * the ring form the track is left to the ring beside the legend and an `eraPin` stands in.
 *
 * Four slots are always drawn, so the frame keeps one height: a blank slot is the same box
 * with its text hidden. A gap before a lane is a dashed top edge. The reading's own lane
 * has a full border and a tint, never a single lit edge.
 */
import { badge } from "../../builders/badge";
import { html, raw, type SafeHtml } from "../../builders/html";
import { lane, mark } from "../../builders/timeline";
import { eraPin } from "./era-pin";
import styles from "./gnss-lane.module.css";

export type GnssLaneForm = "ring" | "track";

export interface GnssLaneOptions {
  form: GnssLaneForm;
  /** The era or counter, such as `era 2` or `GPS-LNAV`. */
  label: string;
  /** The instant the library gave, or the words for no result. */
  value: string;
  /** The lane in one sentence: the group's accessible name. */
  sentence: string;
  /** Where the pin sits, 0 to 100, or `null` when there is no result. */
  pin: number | null;
  /** Where today sits on this lane, 0 to 100, or `null`. */
  today: number | null;
  /** The reading's own lane. */
  chosen: boolean;
  /** The eras between this and the one before are not drawn. */
  gap: boolean;
  /** Words such as `your reading`, `nearest today`. */
  flags: readonly string[];
}

const pct = (n: number): number => n / 100;

function track(o: GnssLaneOptions): SafeHtml {
  return lane(
    { label: o.label },
    html`${
      o.pin === null
        ? ""
        : mark({
            label: `${o.label} reading`,
            at: pct(o.pin),
            series: o.chosen ? 1 : 2,
          })
    }${
      o.today === null
        ? ""
        : mark({ label: `${o.label} holds today`, at: pct(o.today), series: 3 })
    }`,
  );
}

export function gnssLane(o: GnssLaneOptions): SafeHtml {
  const empty = o.pin === null;
  return html`<div
    class="${styles.slot}"
    role="group"
    aria-label="${o.sentence}"
    data-form="${o.form}"
    data-chosen="${String(o.chosen)}"
    data-gap="${String(o.gap)}"
    data-empty="${String(empty)}"
    ><div class="${styles.row}"
      >${
        o.form === "track"
          ? track(o)
          : html`<span class="${styles.name}"
            >${eraPin({ chosen: o.chosen, empty })}${o.label}</span
          >`
      }<span class="${styles.value}">${o.value}</span></div
    ><div class="${styles.flags}"
      >${o.flags.map((text) => badge({ text, tone: "neutral" }))}</div
    ></div
  >`;
}

/** An unused slot: the same box, nothing in it for anyone to read. */
export function blankGnssLane(form: GnssLaneForm): SafeHtml {
  return html`<div class="${styles.slot}" data-form="${form}" data-blank="true" aria-hidden="true"
    ><div class="${styles.row}"
      ><span class="${styles.name}">${raw("&nbsp;")}</span
      ><span class="${styles.value}">${raw("&nbsp;")}</span></div
    ><div class="${styles.flags}"></div></div
  >`;
}
