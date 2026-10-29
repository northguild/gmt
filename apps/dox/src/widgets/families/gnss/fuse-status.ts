/**
 * countdown and verdictBadge: the two answers beside the fuse timeline.
 *
 * `countdown` is a captioned figure that shows the time left as fixed cells (days, hours,
 * minutes, seconds) with the library's own words kept as text for a reader who cannot see
 * them. Its box holds still: the cells have fixed widths and an empty countdown keeps their
 * height. `verdictBadge` says what the receiver reports in words, with an icon and a pattern
 * that differ for right, early and late, so colour is never the only signal.
 *
 * Neither is amber: the signal-lost state is not theirs to draw.
 */
import { html, type SafeHtml } from "../../builders/html";
import { srOnly } from "../../builders/sr-only";
import type { Countdown } from "~/lib/gnss-rollover-checker";
import styles from "./fuse-status.module.css";

const NBSP = " ";
const pad2 = (n: number): string => String(n).padStart(2, "0");

export interface CountdownOptions {
  /** The countdown in parts, or `null` while there is none. */
  parts: Countdown | null;
  /** The library's words for it ("4419 days 23 h 59 min 42 s"). */
  words: string;
  /** The line under it ("until it reports an early date"). */
  line: string;
  /** What is shown while there is no countdown. */
  none: string;
  /** Every line it can show, to hold the box. */
  lineSamples?: readonly string[];
  gate?: string;
}

function cell(value: string, unit: string): SafeHtml {
  return html`<span class="${styles.cell}" data-unit="${unit}"><b>${value}</b><i>${unit}</i></span>`;
}

export function countdown(o: CountdownOptions): SafeHtml {
  const c = o.parts;
  return html`<figure class="${styles.count}" data-empty="${String(c === null)}" data-past="${String(c?.past === true)}" data-gate="${o.gate ?? "hero"}"
    ><figcaption class="${styles.caption}">${c?.past ? "Past by" : "Time left"}</figcaption
    >${
      c === null
        ? html`<p class="${styles.none}" data-gate="instant">${o.none}</p>`
        : html`${srOnly(o.words)}<span class="${styles.digits}" aria-hidden="true"
          >${cell(String(c.days), "days")}${cell(pad2(c.hours), "h")}${cell(pad2(c.minutes), "min")}${cell(pad2(c.seconds), "s")}</span
        >`
    }<span class="${styles.lines}"
      ><span class="${styles.line}">${o.line === "" ? NBSP : o.line}</span
      >${(o.lineSamples ?? []).map((s) => html`<span class="${styles.ghost}" aria-hidden="true">${s}</span>`)}</span
    ></figure
  >`;
}

export type Verdict = "right" | "early" | "late" | "none";

export interface VerdictBadgeOptions {
  verdict: Verdict;
  /** What the receiver reports, in words; empty keeps the badge's two lines. */
  text: string;
}

const icon = (shown: boolean, path: string): SafeHtml =>
  html`<svg class="${styles.icon}" ${shown ? html`data-shown` : ""} viewBox="0 0 16 16" aria-hidden="true"><path d="${path}" /></svg
  >`;

export function verdictBadge(o: VerdictBadgeOptions): SafeHtml {
  return html`<p class="${styles.badge}" data-verdict="${o.verdict}"
    >${icon(o.verdict === "right", "M3 8.5 6.5 12 13 4.5")}${icon(o.verdict === "early", "M8 3 3 8l5 5M13 3 8 8l5 5")}${icon(o.verdict === "late", "m8 3 5 5-5 5M3 3l5 5-5 5")}<span class="${styles.badgeText}">${o.text === "" ? NBSP : o.text}</span></p
  >`;
}
