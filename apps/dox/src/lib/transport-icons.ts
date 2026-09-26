/**
 * Inline SVG icons for transport modes (TRAN-9), shared across every
 * multi-leg scheduling widget (Delivery Scheduler, Connection Checker,
 * Timetable Reader, Crossing Clock) and the reference/MDX site.
 *
 * One consistent set: 24x24 viewBox, stroke-based (`fill="none"`,
 * `stroke="currentColor"`, 2px stroke, round caps/joins — the same weight
 * `code-frame.ts`'s copy/check glyphs use), legible at 16px. Each export
 * below is the icon's *inner* markup only, with no `<svg>` wrapper of its
 * own, so it drops straight into `src/components/Icon.astro`'s
 * `BuiltInIcons` dictionary (that component supplies the wrapper and its
 * `viewBox`/`fill` defaults, which a `<g>` here overrides locally).
 * `transportIcon()` wraps the same markup into a standalone `<svg>` string
 * for the plain-DOM widgets, which render raw HTML and have no Astro
 * component to reach for.
 *
 * This module is generic on purpose: no import from any `delivery-*` file,
 * so every transport widget — present or future — can share it without
 * pulling in another widget's state.
 */

import { escapeAttr } from "./widget-ui";

const STROKE =
  'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

/** The modes with a dedicated icon, in the order every mode picker lists
 *  them. `generic` is the fallback, never a selectable option. */
export const TRANSPORT_MODES = [
  "truck",
  "rail",
  "ship",
  "barge",
  "air",
] as const;

export type TransportMode = (typeof TRANSPORT_MODES)[number];

const FALLBACK_ICON_KEY = "generic";

/** Icon inner-markup, keyed by mode. `generic` is the fallback for a mode
 *  with no icon of its own — an opaque tag `scheduleDelivery` never
 *  validates, so the widgets must render *something* for a custom one. */
export const TRANSPORT_ICON_PATHS: Readonly<Record<string, string>> = {
  truck: `<g ${STROKE}><path d="M2 7h10v9H2z"/><path d="M12 11h4l4 3v2h-2"/><path d="M2 16h1"/><circle cx="6" cy="18" r="1.75"/><circle cx="16" cy="18" r="1.75"/><path d="M8 18h6"/></g>`,
  rail: `<g ${STROKE}><rect x="5" y="3" width="14" height="13" rx="2"/><path d="M5 9h14"/><path d="M9 3v6M15 3v6"/><circle cx="8.5" cy="19" r="1.5"/><circle cx="15.5" cy="19" r="1.5"/><path d="M4 21h16"/></g>`,
  ship: `<g ${STROKE}><path d="M4 14h16l-1.8 5.2a1 1 0 0 1-.95.68H6.75a1 1 0 0 1-.95-.68L4 14Z"/><path d="M8 14V6a1 1 0 0 1 1-1h4l3 4"/><path d="M8 9h6"/><path d="M2 21c1.6 1 3.2 1 4.8 0s3.2-1 4.8 0 3.2 1 4.8 0 3.2-1 4.8 0"/></g>`,
  barge: `<g ${STROKE}><path d="M3 15h18l-1.6 4.6a1 1 0 0 1-.94.66H5.54a1 1 0 0 1-.94-.66L3 15Z"/><rect x="6.5" y="9" width="4.5" height="6"/><rect x="13" y="9" width="4.5" height="6"/><path d="M2 21c1.6 1 3.2 1 4.8 0s3.2-1 4.8 0 3.2 1 4.8 0 3.2-1 4.8 0"/></g>`,
  air: `<g ${STROKE}><path d="M3 12.5 20.5 4 15 20l-3.5-7.2L3 12.5Z"/><path d="M11.5 12.8 20.5 4"/></g>`,
  [FALLBACK_ICON_KEY]: `<g ${STROKE}><path d="M12 3 20 7.5v9L12 21 4 16.5v-9L12 3Z"/><path d="M12 3v9M4 7.5l8 4.5 8-4.5"/></g>`,
};

/** Normalizes a caller's mode tag to a known icon key — trimmed and
 *  lower-cased, falling back to the generic cargo icon for anything else
 *  (blank, unrecognized, or a caller's own free-text tag). */
function iconKeyFor(mode: string): string {
  const key = mode.trim().toLowerCase();
  return Object.hasOwn(TRANSPORT_ICON_PATHS, key) ? key : FALLBACK_ICON_KEY;
}

export interface TransportIconOptions {
  /** Accessible name. Omitted (the default): the icon is decorative
   *  (`aria-hidden="true"`), for use beside text that already says the mode. */
  label?: string;
  /** Extra classes on the `<svg>`. */
  className?: string;
  /** `width`/`height`, in CSS pixels. Defaults to 16, legible at that size. */
  size?: number;
}

/**
 * A standalone `<svg>` string for `mode`, for the plain-DOM widget
 * templates. Unknown modes get the generic fallback rather than nothing, so
 * a caller's own free-text `mode` tag — which `scheduleDelivery` never
 * validates — still draws an icon.
 */
export function transportIcon(
  mode: string,
  options: TransportIconOptions = {},
): string {
  const inner = TRANSPORT_ICON_PATHS[iconKeyFor(mode)]!;
  const size = options.size ?? 16;
  const a11y = options.label
    ? `role="img" aria-label="${escapeAttr(options.label)}"`
    : 'aria-hidden="true"';
  const cls = options.className
    ? ` class="${escapeAttr(options.className)}"`
    : "";
  return (
    `<svg${cls} viewBox="0 0 24 24" width="${size}" height="${size}" ${a11y}>` +
    inner +
    `</svg>`
  );
}
