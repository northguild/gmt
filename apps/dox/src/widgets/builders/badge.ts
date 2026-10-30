/**
 * badge: a short static label (a cut-off chip, a status word). Text, not a
 * control: it takes no focus and has no role of its own, so its meaning is in
 * its words and never in its colour alone.
 *
 * `tone` is a typed union. Each tone's ink is a `--gmt-*-ink` token, which holds
 * 7:1 on `--gmt-surface-widget` in both themes; the tone colour paints only the
 * border. Amber is the sentinel's alone (invariant 8), so there is no amber tone.
 * `dim` is the quiet variant for a secondary label.
 */
import { html, type SafeHtml } from "./html";
import styles from "./badge.module.css";

export type BadgeTone = "neutral" | "cyan" | "spring" | "purple" | "danger";

export interface BadgeOptions {
  /** What it says. Required. */
  text: string;
  tone: BadgeTone;
  dim?: boolean;
}

export function badge(o: BadgeOptions): SafeHtml {
  return html`<span class="${styles.root}" data-tone="${o.tone}" data-dim="${String(o.dim === true)}"
    >${o.text}</span
  >`;
}
