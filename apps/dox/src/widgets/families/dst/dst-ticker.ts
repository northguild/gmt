/**
 * dstTicker: the scrubbable local-time strip around one transition.
 *
 * A status line, a track and a row of ticks. The track draws the skipped or repeated span
 * as a hatched band with its start and end times, and the kit's handle sits over it as a
 * `role="slider"` named "Local probe time". The mount writes values only: the band's
 * `--gmt-band-from` and `--gmt-band-to` and each label's `--gmt-at` (percent of the
 * track), the handle's `data-zone` (gap, overlap or none, which tints the thumb) and the
 * ticks. Nothing is positioned by script. A tick is `major` or `minor`: a narrow strip
 * shows only the majors, by a container query on the strip itself, so the fit follows the
 * real width in the docs column and the chat rail alike.
 */
import { html, type SafeHtml } from "../../builders/html";
import { handle, handleTrack } from "../../primitives/handle/handle";
import styles from "./dst-ticker.module.css";

export const DST_HANDLE_LABEL = "Local probe time";

/** The local ids a ticker writes. */
export const tickerIds = {
  root: "ticker",
  status: "ticker-status",
  band: "ticker-band",
  start: "ticker-label-start",
  end: "ticker-label-end",
  handle: "ticker-handle",
  ticks: "ticker-ticks",
  empty: "ticker-empty",
} as const;

interface DstTickerOptions {
  /** The widget's `idScope(idPrefix)`. */
  id: (local: string) => string;
}

/** The scrubbable strip, hidden until the mount has a transition to scrub. */
export function dstTicker(o: DstTickerOptions): SafeHtml {
  return html`<div class="${styles.ticker}" id="${o.id(tickerIds.root)}" hidden>
    <p class="${styles.status}" id="${o.id(tickerIds.status)}"></p>
    <div class="${styles.track}">
      <div class="${styles.band}" id="${o.id(tickerIds.band)}" data-kind="gap"></div>
      <span class="${styles.zoneLabel}" id="${o.id(tickerIds.start)}"></span>
      <span class="${styles.zoneLabel}" id="${o.id(tickerIds.end)}"></span>
      <div class="${styles.handleHost}">${handleTrack(
        handle({
          id: o.id(tickerIds.handle),
          label: DST_HANDLE_LABEL,
          min: 0,
          max: 1439,
          step: 5,
          largeStep: 30,
          value: 0,
          valueText: "",
        }),
      )}</div>
    </div>
    <div class="${styles.ticks}" id="${o.id(tickerIds.ticks)}" aria-hidden="true"></div>
  </div>`;
}

export interface TickMark {
  at: number;
  text: string;
  major: boolean;
}

/** The tick row's contents. */
export function dstTicks(ticks: readonly TickMark[]): SafeHtml {
  return html`${ticks.map(
    (t) =>
      html`<span
        class="${styles.tick}"
        data-rank="${t.major ? "major" : "minor"}"
        style="--gmt-at: ${String(t.at)}%"
        >${t.text}</span
      >`,
  )}`;
}

/** What the strip says when there is nothing to scrub. */
export function dstTickerEmpty(o: DstTickerOptions, text: string): SafeHtml {
  return html`<p class="${styles.empty}" id="${o.id(tickerIds.empty)}" hidden>${text}</p>`;
}
