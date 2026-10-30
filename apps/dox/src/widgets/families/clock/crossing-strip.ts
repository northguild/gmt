/**
 * crossingBar: the proportional strip under the Crossing Clock's two faces.
 *
 * One bar from the entry to the exit, drawn to the real elapsed time. Hour ticks give it a
 * scale; a marker stands only where the zone's offset changes (a skipped hour dashed, a
 * repeated hour doubled, the DST purple the clock faces use). Beneath it sits one written
 * line for each change, or one quiet sentence when the crossing has none, and a legend for
 * the kinds that occur.
 *
 * The bar is `role="img"` named by the summary, so a reader hears one sentence and not the
 * ticks. Every value comes from `crossingStrip` in `src/lib/crossing-clock.ts`, itself read
 * from the library's `crossingTime` result; nothing here is computed.
 *
 * Three views. `blank` is the strip before the first reading: it keeps its box and its
 * one-line legend, so a reading arriving moves nothing. `edge` is a crossing at the very edge
 * of the supported range, whose zoned strings cannot be placed on a bar: the sentinel, in
 * words. `drawn` is a reading.
 */
import { html, type SafeHtml } from "../../builders/html";
import type { CrossingChangeMarker, CrossingStrip } from "~/lib/crossing-clock";
import styles from "./crossing-strip.module.css";

export type CrossingBarView =
  | { kind: "blank" }
  | { kind: "edge"; text: string }
  | { kind: "drawn"; strip: CrossingStrip };

const NBSP = " ";

const LEGEND_TEXT: Record<CrossingChangeMarker["kind"], string> = {
  skip: "Purple dashed marker: an hour the clock never showed (matches the clock face highlight).",
  repeat:
    "Purple doubled marker: an hour the clock showed twice (matches the clock face highlight).",
};

const QUIET_TEXT =
  "No clock change during the crossing — every hour showed once.";

function pct(n: number): string {
  return `${Math.round(n * 100) / 100}%`;
}

function track(view: CrossingBarView): SafeHtml {
  if (view.kind !== "drawn") return html``;
  const { ticks, changes } = view.strip;
  return html`${ticks.map((t) =>
    t.label
      ? html`<span class="${styles.tick}" data-labeled="true" data-label="${t.label}" style="inset-inline-start: ${pct(t.percent)}"></span>`
      : html`<span class="${styles.tick}" data-labeled="false" style="inset-inline-start: ${pct(t.percent)}"></span>`,
  )}${changes.map(
    (c) =>
      html`<span class="${styles.marker}" data-kind="${c.kind}" style="inset-inline-start: ${pct(c.percent)}"></span>`,
  )}`;
}

function changes(view: CrossingBarView): SafeHtml {
  if (view.kind === "edge") {
    return html`<output class="${styles.lost}">${view.text}</output>`;
  }
  if (view.kind === "blank") return html``;
  const list = view.strip.changes;
  if (list.length === 0)
    return html`<p class="${styles.quiet}">${QUIET_TEXT}</p>`;
  return html`<ul class="${styles.changes}">${list.map(
    (c) =>
      html`<li class="${styles.change}" data-kind="${c.kind}"><span class="${styles.mark}" aria-hidden="true"></span>${c.label}</li>`,
  )}</ul>`;
}

function legend(view: CrossingBarView): string {
  if (view.kind !== "drawn") return "";
  const kinds = Array.from(new Set(view.strip.changes.map((c) => c.kind)));
  return kinds.map((k) => LEGEND_TEXT[k]).join(" ");
}

/** The strip, in the view it is in. */
export function crossingBar(view: CrossingBarView): SafeHtml {
  const drawn = view.kind === "drawn";
  const summary = drawn ? view.strip.summary : "Crossing strip, not drawn";
  return html`<div class="${styles.wrap}" data-view="${view.kind}">
    <div class="${styles.bar}" role="img" aria-label="${summary}">
      <span class="${styles.end}">${drawn ? view.strip.entryLabel : NBSP}</span>
      <div class="${styles.track}">${track(view)}</div>
      <span class="${styles.end}">${drawn ? view.strip.exitLabel : NBSP}</span>
    </div>
    <div class="${styles.slot}">${changes(view)}</div>
    <p class="${styles.legend}">${legend(view) || NBSP}</p>
  </div>`;
}
