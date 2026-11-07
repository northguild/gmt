/**
 * badge: a short static label (a cut-off chip, a status word). Text, not a
 * control: it takes no focus and has no role of its own, so its meaning is in
 * its words and never in its colour alone.
 *
 * `tone` is a typed union. Each tone's ink is a `--gmt-*-ink` token, which holds
 * 7:1 on `--gmt-surface-widget` in both themes; the tone colour paints only the
 * border. Amber is the sentinel's alone (invariant 8), so there is no amber tone.
 * `dim` is the quiet variant for a secondary label. `wrap` lets a badge that sits in a table cell
 * break at its spaces, so the column is as wide as its longest word; it never breaks inside a word.
 * `icon` puts a 14px Octicon before the word and `fill` tints the whole pill with its tone, as a
 * state badge reads on GitHub. The word still names the state; the icon is decoration.
 */
import { html, type SafeHtml } from "./html";
import { octicon, type OcticonName } from "../../lib/octicons";
import styles from "./badge.module.css";

export type BadgeTone = "neutral" | "cyan" | "spring" | "purple" | "danger";

export interface BadgeOptions {
  /** What it says. Required. */
  text: string;
  tone: BadgeTone;
  dim?: boolean;
  wrap?: boolean;
  icon?: OcticonName;
  fill?: boolean;
}

export function badge(o: BadgeOptions): SafeHtml {
  return html`<span class="${o.fill ? `${styles.root} ${styles.fill}` : styles.root}" data-tone="${o.tone}" data-dim="${String(o.dim === true)}" data-wrap="${String(o.wrap === true)}"
    >${o.icon && octicon(o.icon, 14)}${o.text}</span
  >`;
}
