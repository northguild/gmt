/**
 * modeIcon: the small outline picture of a transport mode, drawn beside the word that names it.
 *
 * The paths are the site's one icon set (`TRANSPORT_ICON_PATHS`). A mode the set has no icon
 * for (a caller's own free-text tag, which `scheduleDelivery` never validates) draws the
 * generic cargo icon, so no mode is ever blank. The icon is decorative unless a `label` is
 * given: the mode is named in the text beside it.
 */
import { TRANSPORT_ICON_PATHS } from "~/lib/transport-icons";
import { html, raw, type SafeHtml } from "../../builders/html";
import styles from "./transport-icon.module.css";

const FALLBACK_KEY = "generic";

export interface ModeIconOptions {
  /** The icon's accessible name. Left out, the icon is `aria-hidden`. */
  label?: string;
  /** Width and height in CSS pixels. */
  size?: number;
}

/** The icon key for a caller's mode tag: trimmed, lower-cased, else the generic one. */
export function iconKey(mode: string): string {
  const key = mode.trim().toLowerCase();
  return Object.hasOwn(TRANSPORT_ICON_PATHS, key) ? key : FALLBACK_KEY;
}

export function modeIcon(mode: string, o: ModeIconOptions = {}): SafeHtml {
  const size = o.size ?? 16;
  const inner = raw(TRANSPORT_ICON_PATHS[iconKey(mode)]!);
  return o.label === undefined
    ? html`<svg class="${styles.icon}" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${inner}</svg>`
    : html`<svg class="${styles.icon}" viewBox="0 0 24 24" width="${size}" height="${size}" role="img" aria-label="${o.label}">${inner}</svg>`;
}
