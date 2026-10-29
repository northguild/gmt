/**
 * The shared UTC timeline (INT-15): one axis, a pin for each zone's instant, a bracket for the
 * widest gap. When a value states its own offset the same axis shows the one stated instant, a
 * pin with no number. With nothing to place the box keeps its size and says so in words, never in
 * amber: nothing here is a refused call.
 *
 * `timelineLayout` and `timelineAria` come from `~/lib/edi-picture`; this file draws them. The
 * box has a fixed minimum height (the plot, a two-line caption, padding), so a state change
 * moves nothing and no hold is needed.
 */
import {
  timelineAria,
  timelineLayout,
  type TimelineInput,
  type TimelineLayout,
} from "~/lib/edi-picture";
import { durationText, type WidestGap } from "~/lib/edi-widgets";
import { html, type SafeHtml } from "../../builders/html";
import styles from "./edi-timeline.module.css";

/** What the timeline draws. */
export type TimelineSpec =
  | { kind: "empty"; text: string }
  | { kind: "stated"; instant: string }
  | {
      kind: "marks";
      rows: readonly TimelineInput[];
      gap: WidestGap | null;
    };

function plot(
  layout: TimelineLayout,
  stated: boolean,
  gap: string,
  aria: string,
): SafeHtml {
  const ticks = layout.ticks.map(
    (t) =>
      html`<span class="${styles.tick}" data-major="${t.label === "" ? "0" : "1"}" style="--x:${t.at.toFixed(3)}%"
        >${
          t.label === ""
            ? ""
            : html`<span class="${styles.label}">${t.label}${t.day === "" ? "" : html`<span class="${styles.day}">${t.day}</span>`}</span>`
        }</span
      >`,
  );
  const marks = layout.marks.map(
    (m) =>
      html`<span class="${styles.mark}" data-series="${stated ? "stated" : String(m.n)}" style="--x:${m.at.toFixed(3)}%;--lane:${m.lane}"
        ><span class="${styles.pin}">${stated ? "" : m.n}</span></span
      >`,
  );
  const bracket =
    layout.span === null
      ? ""
      : html`<span class="${styles.bracket}" style="--from:${layout.span.from.toFixed(3)}%;--to:${layout.span.to.toFixed(3)}%"
          ><span class="${styles.gap}">${gap}</span></span
        >`;
  return html`<div class="${styles.plot}" role="img" aria-label="${aria}"
    ><span class="${styles.axis}"></span
    ><span class="${styles.ticks}">${ticks}</span
    ><span class="${styles.marks}">${marks}</span>${bracket}</div
  >`;
}

/** The box's content for a state: what the mount writes into the slot. */
export function timelineContent(spec: TimelineSpec): SafeHtml {
  if (spec.kind === "empty") {
    return html`<div class="${styles.box}" data-state="empty"
      ><p class="${styles.empty}">${spec.text}</p></div
    >`;
  }
  if (spec.kind === "stated") {
    const layout = timelineLayout([{ n: 1, instant: spec.instant }])!;
    return html`<div class="${styles.box}" data-state="stated"
      >${plot(layout, true, "", timelineAria([], "", spec.instant))}<p class="${styles.caption}"
        >Stated by the value: <span class="${styles.value}">${spec.instant}</span></p
      ></div
    >`;
  }
  const placed = spec.rows.filter((r) => r.instant !== "");
  if (placed.length === 0) {
    return timelineContent({
      kind: "empty",
      text:
        spec.rows.length === 0
          ? "Choose a zone to place the value."
          : "No chosen zone gives an instant.",
    });
  }
  const layout = timelineLayout(placed)!;
  const gap = spec.gap === null ? "" : durationText(spec.gap.duration);
  return html`<div class="${styles.box}" data-state="marks"
    >${plot(layout, false, gap, timelineAria(placed, spec.gap === null ? "" : spec.gap.text, ""))}<p class="${styles.caption}"
      >All times in UTC.</p
    ></div
  >`;
}

/** The timeline's slot: the mount writes `timelineContent` into the element with this id. */
export function ediTimeline(o: { id: string; spec: TimelineSpec }): SafeHtml {
  return html`<div id="${o.id}">${timelineContent(o.spec)}</div>`;
}
