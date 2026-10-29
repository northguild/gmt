/**
 * cutoffBands and cutoffScale: the drawn background of a cut-off axis.
 *
 * `cutoffBands` paints stretches of the axis: the open and closed sides of a cut-off, the
 * hour stripes of a close-up, the repeated hour of a clock overlap. A band is placed by
 * `--gmt-at` and `--gmt-span` (both 0 to 1). The stripe tint is a `data-tint` the builder sets
 * from the caller's `tint` flag, never an `nth-*` rule. The group is `aria-hidden`: a band
 * carries a word for the eye ("open", "closed"), and the facts live in the marks and the summary.
 *
 * `cutoffScale` is the tick row under the axis: drawn text, `aria-hidden`. Each tick has a
 * `rank` (0 always shows; 1 hides in a narrow box) and a `day` flag for a date label, so a
 * narrow axis thins its own labels with a container query and the mount measures nothing.
 */
import { html, type SafeHtml } from "../../builders/html";
import { unit } from "../../builders/timeline";
import styles from "./bands.module.css";

export type BandKind = "open" | "closed" | "hour" | "overlap";

export interface Band {
  kind: BandKind;
  /** Start, 0 to 1. */
  from: number;
  /** End, 0 to 1. */
  to: number;
  /** A word drawn in the band, such as "closed". */
  word?: string;
  /** The alternate stripe of an hour ruler. */
  tint?: boolean;
}

export function cutoffBands(bands: readonly Band[]): SafeHtml {
  return html`<span class="${styles.bands}" aria-hidden="true"
    >${bands.map((b) => {
      const from = Number.isFinite(b.from) ? b.from : 0;
      const to = Number.isFinite(b.to) ? b.to : from;
      const start = Math.min(from, to);
      const span = Math.abs(to - from);
      return html`<span
        class="${styles.band}"
        data-kind="${b.kind}"
        data-tint="${String(b.tint === true)}"
        style="--gmt-at: ${unit(start)}; --gmt-span: ${unit(span)}"
        >${b.word ?? ""}</span
      >`;
    })}</span
  >`;
}

export interface ScaleTick {
  at: number;
  /** The drawn text, such as `18:00` or `8 Apr`. */
  label: string;
  /** 0 always shows; 1 hides when the axis is narrow. */
  rank: 0 | 1;
  /** A date, not an hour. Drawn heavier. */
  day?: boolean;
}

export function cutoffScale(ticks: readonly ScaleTick[]): SafeHtml {
  return html`<div class="${styles.scale}" aria-hidden="true"
    >${ticks.map(
      (t) =>
        html`<span
          class="${styles.tick}"
          data-rank="${t.rank}"
          data-day="${String(t.day === true)}"
          style="--gmt-at: ${unit(t.at)}"
          >${t.label}</span
        >`,
    )}</div
  >`;
}
