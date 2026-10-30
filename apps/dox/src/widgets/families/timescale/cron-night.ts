/**
 * The pieces of Cron in a Zone's night: its legend, two axes, a lane of marks for each
 * policy, the parsed fields and a run's kind.
 *
 * A mark's place is data (`--gmt-at`, 0 to 1), read by the module with
 * `inset-inline-start`. The kind of a mark is a `data-kind` the module draws three ways
 * (a solid stem, a dashed stem on hatching, a double stem), and its words are always on
 * screen beside it or in the lane's accessible name, so the drawing never carries the
 * kind alone. A mark's `×N` count past `COUNT_FLIP_PCT` of the axis carries `data-end`, which puts it
 * on the stem's left, inside the track.
 */
import { badge, html, type BadgeTone, type SafeHtml } from "../../builders";
import { unit } from "../../builders/timeline";
import {
  FIELD_LABELS,
  KIND_WORD,
  type FieldRow,
  type Mark,
} from "~/lib/cron-in-a-zone";
import type { CronLibPolicy, CronLibRun } from "~/lib/cron-lib";
import styles from "./cron-night.module.css";

type Kind = CronLibRun["classification"];

/** Past this share of the axis a mark's `×N` label sits left of its stem. */
const COUNT_FLIP_PCT = 90;

const KIND_TONE: Record<Kind, BadgeTone> = {
  unique: "neutral",
  nonexistent: "cyan",
  ambiguous: "purple",
};

interface CronAxisOptions {
  /** The axis row's id, so the mount can thin its labels to fit. */
  id: string;
  caption: string;
  ticks: readonly { at: number; label: string }[];
}

export function cronAxis(o: CronAxisOptions): SafeHtml {
  const last = o.ticks.length - 1;
  return html`<div class="${styles.axisRow}"><span class="${styles.axisCap}" aria-hidden="true">${o.caption}</span
    ><div class="${styles.axis}" id="${o.id}" data-gate="drawn" aria-hidden="true">${o.ticks.map(
      (t, i) =>
        html`<span class="${styles.tick}" data-tick data-edge="${i === 0 ? "first" : i === last ? "last" : "mid"}" style="--gmt-at: ${unit(t.at)}">${t.label}</span>`,
    )}</div></div>`;
}

function cronMarks(marks: readonly Mark[]): SafeHtml {
  return html`${marks.map(
    (m) =>
      html`<span class="${styles.mark}" data-gate="drawn" data-kind="${m.classification}" style="--gmt-at: ${unit(m.pct / 100)}"><span class="${styles.stem}"></span>${m.count > 1 ? html`<span class="${styles.count}" ${m.pct > COUNT_FLIP_PCT ? html`data-end` : ""}>×${m.count}</span>` : ""}</span>`,
  )}`;
}

interface CronLaneOptions {
  policy: CronLibPolicy;
  /** The one-line rule the policy follows. */
  line: string;
  /** What the lane says in one phrase, such as `2 runs, 1 in a skipped time`. */
  plate: string;
  marks: readonly Mark[];
}

export function cronLane(o: CronLaneOptions): SafeHtml {
  return html`<div class="${styles.lane}">
    <div class="${styles.head}">
      <div class="${styles.name}"><code>${o.policy}</code><span class="${styles.rule}">${o.line}</span></div>
      <span class="${styles.plate}">${o.plate}</span>
    </div>
    <div class="${styles.track}" role="img" aria-label="${o.policy}: ${o.plate}">
      <span class="${styles.change}"></span>
      <div class="${styles.marks}" data-gate="drawn">${cronMarks(o.marks)}</div>
    </div>
  </div>`;
}

interface CronPlotOptions {
  /** The change in words, such as `clock change, +00:00 → +01:00`. */
  chip: string;
  utc: CronAxisOptions;
  wall: CronAxisOptions;
  lanes: readonly CronLaneOptions[];
}

/** The night: the change chip, the UTC and wall axes, and a lane for each policy. */
export function cronPlot(o: CronPlotOptions): SafeHtml {
  return html`<div class="${styles.plot}"
    ><div class="${styles.chipRow}">${badge({ text: o.chip, tone: "cyan" })}</div
    >${cronAxis(o.utc)}${cronAxis(o.wall)}<div class="${styles.lanes}">${o.lanes.map(cronLane)}</div></div
  >`;
}

/** The parsed fields, one row for each of the five. */
export function cronFieldList(rows: readonly FieldRow[]): SafeHtml {
  return html`<dl class="${styles.fields}">${FIELD_LABELS.map(
    ([key, label]) => {
      const row = rows.find((r) => r.key === key);
      return html`<div class="${styles.field}"><dt class="${styles.fieldName}">${label}</dt
      ><dd class="${styles.fieldValue}"><code class="${styles.values}">${row?.text ?? ""}</code>${row?.star === true ? badge({ text: "star", tone: "neutral", dim: true }) : ""}</dd></div>`;
    },
  )}</dl>`;
}

/** The sentinel pill and its note, for a line outside the grammar. */
export function cronNoSignal(text: string, note: SafeHtml): SafeHtml {
  return html`<p class="${styles.noSignal}"><span class="${styles.pill}">${text}</span><span class="${styles.note}">${note}</span></p>`;
}

/** A kind cell: the kind in words, and the "only under" line when only one policy gives the run. */
export function kindCell(kind: Kind, only: CronLibPolicy | null): SafeHtml {
  return html`${badge({ text: KIND_WORD[kind], tone: KIND_TONE[kind] })}${only === null ? "" : html`<span class="${styles.only}">only under <code>${only}</code></span>`}`;
}
