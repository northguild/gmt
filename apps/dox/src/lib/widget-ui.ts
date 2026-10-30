/**
 * Shared client-side render helpers for the teaching widgets (DST Inspector,
 * Interval Visualizer).
 *
 * These run in the browser so they must have zero Node/TS-only dependencies.
 */
import { codeToken } from "~/widgets/builders/code-token";

// ---------------------------------------------------------------------------
// Syntax-highlighted call lines
// ---------------------------------------------------------------------------

/**
 * The stroke recipe every inline SVG on this site draws with — one weight
 * across transport modes, code-frame glyphs and the globe's filter switches.
 *
 * It lives in this leaf module rather than beside any one icon set because
 * both `zone-readout.ts` and `zone-filter.ts` need it, and owning it from
 * either end made those two import each other. `zone-filter` builds its icon
 * strings at module scope, so that cycle was not the harmless kind: loading
 * `zone-readout` first threw `Cannot access ICON_STROKE before initialization`
 * and took the tooltip with it.
 */
export const ICON_STROKE =
  'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

/** Escape text for safe use inside innerHTML. */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Escape a value for interpolation into an HTML **attribute**.
 *
 * `escapeHtml` above is not enough here: it leaves `"` and `'` alone, which is
 * fine for text content and useless for `value="…"`, where a quote ends the
 * attribute and everything after it is parsed as markup.
 *
 * This matters because of DOX-C3b. Until the widgets were extracted, their
 * markup was an `.astro` template and **Astro escaped every interpolation for
 * us**. A hand-written template string does not, and the values now flowing
 * into these templates are the least trustworthy the widgets have ever seen:
 * arguments a language model chose, and arguments decoded from a URL a reader
 * may have been handed by anyone. Escaping at the boundary is the cheap,
 * total fix; the schemas and the structural checks in `widget-permalink.ts`
 * are defence in depth on top of it, not instead of it.
 */
export function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Wrap text in a syntax-token span. Colors are sampled from this site's own
 * Shiki output (see gmt-widget-reset.css) so a dynamically-built call line matches
 * every static ```ts fence on the page exactly.
 */
export function codeSpan(cls: "fn" | "str" | "num", text: string): string {
  return codeToken(cls, text).toString();
}

// ---------------------------------------------------------------------------
// Result output — live / sentinel / legitimately-empty
// ---------------------------------------------------------------------------

export type WidgetOutputState = "live" | "sentinel" | "empty";

// ---------------------------------------------------------------------------
// The edge of the supported time range
// ---------------------------------------------------------------------------

/**
 * Whether `error` is a `RangeError`, however it was thrown. The polyfill throws
 * one for an instant outside the supported range, and the library's own output
 * can sit exactly on that edge: a zoned string near the minimum instant carries
 * a minute-rounded offset, so parsing it back lands outside the range.
 */
export function isRangeError(error: unknown): boolean {
  return error instanceof Error && error.name === "RangeError";
}

/** What a chart shows when its values are too near the limit of the time range
 *  to be placed on an axis. The library's own results above it stay. */
export const RANGE_EDGE_TEXT =
  "⟨ NO SIGNAL — too near the limit of the supported time range to draw ⟩";

// ---------------------------------------------------------------------------
// Control system — the range dragger and chip toggles
// ---------------------------------------------------------------------------

/** The fill position of a range as a unitless 0-100 number, clamped. */
export function rangePct(value: number, min: number, max: number): number {
  if (!(max > min)) return 0;
  const pct = ((value - min) / (max - min)) * 100;
  return Math.min(100, Math.max(0, pct));
}

/**
 * The selects whose options are an open-ended list: a zone, a UTC offset, a day
 * count. A seed can name a value the list was never built with (a zone the
 * browser knows and the template's list lacks), and that value is real. Every
 * other select is an enum (a preset, a roll rule, a mode, a basis) and only
 * ever holds one of its own options.
 */
const OPEN_LIST_ROLE =
  /^(?:zone|(?:[a-z]+-)+zone|zone-\d+|offset-\d+|days|convert-(?:source|target))$/;

function isOpenList(select: HTMLSelectElement): boolean {
  return OPEN_LIST_ROLE.test(select.dataset["role"] ?? "");
}

/**
 * Set a control's value from a seed (a permalink, a chat call, a preset).
 *
 * A `<select>` silently drops a value it has no option for, leaving the first
 * option showing and every later read of `.value` wrong. For an open-ended list
 * (`isOpenList`) an option for the value is appended first, labelled with the
 * value itself (or `label`). For an enum select a value it does not offer is
 * refused and the select keeps what it had, so a seed cannot invent a choice.
 * An empty value is never appended; on a select with no blank option it leaves
 * nothing selected (`selectedIndex` -1). Inputs just take the value.
 */
export function setControlValue(
  el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null,
  value: string,
  label?: string,
): void {
  if (!el) return;
  if (el.tagName === "SELECT") {
    const select = el as HTMLSelectElement;
    if (value !== "" && ![...select.options].some((o) => o.value === value)) {
      if (!isOpenList(select)) return;
      const opt = select.ownerDocument.createElement("option");
      opt.value = value;
      opt.textContent = label ?? value;
      select.append(opt);
    }
  }
  el.value = value;
}

/** Point a tool link at `href`, or disable it (`null`: no `href`, `aria-disabled`). */
export function setToolLink(
  link: HTMLElement | null,
  href: string | null,
): void {
  if (!link) return;
  if (href === null) {
    link.removeAttribute("href");
    link.setAttribute("aria-disabled", "true");
  } else {
    link.setAttribute("href", href);
    link.removeAttribute("aria-disabled");
  }
}
