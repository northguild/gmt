/**
 * The DOM half of the EDI pictures (INT-15), shared by the DTM Decoder and the
 * X12 Time Reader: it writes `edi-picture.ts`'s markup into the two regions every
 * state keeps, the value taken apart and the shared UTC timeline.
 *
 * A region is never removed. An empty state is words inside the same box at the
 * same size, never an amber sentinel: nothing here is a refused call.
 */
import {
  takenApartHtml,
  timelineAria,
  timelineHtml,
  timelineLayout,
  partsHtml,
  type PicHalf,
  type PicPart,
  type TimelineInput,
} from "./edi-picture";
import { durationText, type WidestGap } from "./edi-widgets";
import { escapeHtml } from "./widget-ui";

/** What the "value taken apart" region draws. `empty` is the words it shows when
 *  there is nothing to take apart. */
export type FigureSpec =
  | { kind: "empty"; text: string }
  | {
      kind: "value";
      /** The row of parts the value arrived in, above the breakdown. */
      parts: readonly PicPart[];
      halves: readonly PicHalf[];
      separator: string;
      closing: string;
      aria: string;
    };

/** Writes the picture into `[data-role="figure"]`. */
export function drawFigure(el: HTMLElement | null, spec: FigureSpec): void {
  if (!el) return;
  if (spec.kind === "empty") {
    el.dataset["state"] = "empty";
    el.innerHTML = `<p class="gmt-edi-fig-empty">${escapeHtml(spec.text)}</p>`;
    el.setAttribute("aria-label", spec.text);
    return;
  }
  el.dataset["state"] = "value";
  el.dataset["scale"] = spec.halves.length === 1 ? "lg" : "md";
  el.innerHTML =
    partsHtml(spec.parts) +
    takenApartHtml(spec.halves, spec.separator, spec.closing);
  el.setAttribute("aria-label", spec.aria);
}

/** What the timeline draws. */
export type TimelineSpec =
  | { kind: "empty"; text: string }
  | { kind: "stated"; instant: string }
  | {
      kind: "marks";
      rows: readonly { n: number; zone: string; instant: string }[];
      gap: WidestGap | null;
    };

/** Writes the timeline into `[data-role="timeline"]`. */
export function drawTimeline(el: HTMLElement | null, spec: TimelineSpec): void {
  if (!el) return;
  if (spec.kind === "empty") {
    el.dataset["state"] = "empty";
    el.innerHTML = `<p class="gmt-edi-tl-empty">${escapeHtml(spec.text)}</p>`;
    el.setAttribute("aria-label", spec.text);
    return;
  }
  if (spec.kind === "stated") {
    const layout = timelineLayout([{ n: 1, instant: spec.instant }])!;
    el.dataset["state"] = "stated";
    el.innerHTML =
      `<div class="gmt-edi-tl-plot">${timelineHtml(layout, { stated: true, gap: "" })}</div>` +
      `<p class="gmt-edi-tl-caption">Stated by the value: <span class="gmt-edi-tl-value">${escapeHtml(spec.instant)}</span></p>`;
    el.setAttribute("aria-label", timelineAria([], "", spec.instant));
    return;
  }
  const placed: TimelineInput[] = spec.rows.filter((r) => r.instant !== "");
  if (placed.length === 0) {
    drawTimeline(el, {
      kind: "empty",
      text:
        spec.rows.length === 0
          ? "Choose a zone to place the value."
          : "No chosen zone gives an instant.",
    });
    return;
  }
  const layout = timelineLayout(placed)!;
  const gap = spec.gap === null ? "" : durationText(spec.gap.duration);
  el.dataset["state"] = "marks";
  el.innerHTML =
    `<div class="gmt-edi-tl-plot">${timelineHtml(layout, { stated: false, gap })}</div>` +
    `<p class="gmt-edi-tl-caption">All times in UTC.</p>`;
  el.setAttribute(
    "aria-label",
    timelineAria(placed, spec.gap === null ? "" : spec.gap.text, ""),
  );
}
