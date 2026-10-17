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
import {
  callArgs,
  durationText,
  formatValue,
  type EdiCall,
  type WidestGap,
} from "./edi-widgets";
import { codeSpan, escapeHtml, renderWidgetOutput } from "./widget-ui";

/**
 * Writes the calls a widget made into a call frame, one per line, in the order
 * made, and stashes their plain text on the frame's copy button. The line is the
 * call made: its function name and its arguments as passed.
 */
export function renderCalls(
  codeEl: HTMLElement | null,
  calls: readonly EdiCall[],
): void {
  if (!codeEl) return;
  const lines = calls.map((c) => {
    const [html, plain] = callArgs(c.args);
    return {
      html: `${codeSpan("fn", c.fn)}(${html})`,
      plain: `${c.fn}(${plain})`,
    };
  });
  codeEl.innerHTML = lines.map((l) => l.html).join("\n");
  const frame = codeEl.closest(".gmt-codeframe");
  const copyBtn = frame?.querySelector(
    '[data-role^="copy-"]',
  ) as HTMLButtonElement | null;
  if (copyBtn) {
    if (lines.length === 0) delete copyBtn.dataset["copyText"];
    else copyBtn.dataset["copyText"] = lines.map((l) => l.plain).join("\n");
  }
}

/** What the calls returned, one result per line in the order the calls were made. */
export function callResultsText(calls: readonly EdiCall[]): string {
  return calls.map((c) => formatValue(c.result)).join("\n");
}

/** The line a call that gave the library's sentinel prints in the results pane. */
export const NO_SIGNAL_LINE = "NO SIGNAL";

/**
 * Whether a call's own result is the library's refusal (`null` or `""`). Only
 * read once its group has already failed: in a group that read, a `""` is a
 * plain answer (`nextLeapSecond` returns it when no insertion follows).
 */
function refused(call: EdiCall): boolean {
  return call.result === null || call.result === "";
}

/**
 * Writes a group's results into its output pane: one line for each call, in the
 * order the calls were made, so line N answers call line N.
 *
 * `failed` is the group's verdict (the reading is a sentinel). A failed group
 * replaces only the calls that gave `null` or `""` with NO SIGNAL and keeps the
 * value of every other call. When every call refused, or none did (the group
 * failed before any call, or on a check the calls do not show), the pane is the
 * whole-pane NO SIGNAL it always was.
 */
export function renderCallResults(
  out: HTMLElement,
  calls: readonly EdiCall[],
  failed: boolean,
  format: (value: unknown) => string = formatValue,
): void {
  if (!failed) {
    renderWidgetOutput(
      out,
      calls.map((c) => format(c.result)).join("\n"),
      "live",
    );
    return;
  }
  const refusals = calls.filter(refused).length;
  if (refusals === 0) {
    renderWidgetOutput(out, NO_SIGNAL_LINE, "sentinel");
    return;
  }
  if (refusals === calls.length) {
    renderWidgetOutput(
      out,
      calls.map(() => NO_SIGNAL_LINE).join("\n"),
      "sentinel",
    );
    return;
  }
  renderWidgetOutput(out, "", "live");
  out.innerHTML = calls
    .map((c) =>
      refused(c)
        ? `<span class="gmt-result-nosignal">${NO_SIGNAL_LINE}</span>`
        : escapeHtml(format(c.result)),
    )
    .join("\n");
}

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
