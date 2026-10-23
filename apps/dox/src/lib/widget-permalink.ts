/**
 * DOX-C3b (#139) — linking to a widget's state from the chat transcript.
 *
 * ## Why a new convention rather than reusing the scrubber's
 *
 * The only URL-state mechanism in the app is `multi-zone-scrubber.ts`'s
 * `encodeState`/`decodeState`, and it cannot serve this:
 *
 *   - Its params (`tz`, `t`) are unnamespaced, and **every** reference page
 *     imports all three widget components, so a bare `?zone=` is ambiguous
 *     about which widget it addresses.
 *   - It always writes the *current* page's pathname. From `/dox` that would
 *     produce `/dox?tz=…`, which no route knows how to rehydrate.
 *   - Its decoder filters zone ids through the globe's coordinate table, so it
 *     is a scrubber decoder, not a general one.
 *
 * The scrubber's existing links stay exactly as they are. Migrating them would
 * break every permalink already shared, and it is not this story's business.
 *
 * ## The shape
 *
 *     <the widget's own /tools page>?w=<kind>&wa=<compact JSON>
 *
 * `w` disambiguates which widget on the page is being addressed. `wa` is the
 * arguments, URL-encoded JSON, validated on the way back in by **the same zod
 * schema as the tool input** — one schema, three consumers (the model's tool
 * call, the rail mount, and this). URL-encoding rather than base64 because a
 * hand-editable link is worth more than a shorter one at this size.
 *
 * `JSON.parse` here is not the dynamic code execution the DoD forbids: it
 * produces data, which is then schema-checked, and the registry's dispatch is a
 * fixed object literal. See `widget-registry.ts`.
 */

import { withBase } from "./site";

export type WidgetKind =
  | "globe"
  | "dst"
  | "interval"
  | "converter"
  | "dwell"
  | "freetime"
  | "billing"
  | "delivery"
  | "connection"
  | "timetable"
  | "crossing"
  | "cutoffstack"
  | "cutoffruler"
  | "cutoffcountdown"
  | "punctuality"
  | "etadrift"
  | "departure"
  | "planner"
  | "dtm"
  | "xtime"
  | "demclock"
  | "bldate"
  | "epcis"
  | "journeysplit"
  | "gnssweek"
  | "satclock"
  | "rollover"
  | "leapline"
  | "elapsed"
  | "storedaudit"
  | "holidays"
  | "observance"
  | "feasts"
  | "canadaclock"
  | "durationbench"
  | "iddecode"
  | "colbridge"
  | "moroccoclock";

/**
 * Where each widget actually lives, so the encoder never guesses a route.
 *
 * Every entry is a `/tools/` page whose whole subject is that widget. Three of
 * these used to point at reference pages that merely embed the widget partway
 * down — which resolved, but landed a reader who clicked "the view I was
 * looking at" on a function's API documentation instead of on the thing they
 * wanted, and needed an anchor to get near it at all. A dedicated page is the
 * better destination and needs no anchor, because the widget *is* the page.
 *
 * A permalink that 404s would violate the same DOX-C rule as a hallucinated
 * citation, so `widget-permalink.test.ts` asserts each of these is a real
 * content file rather than trusting the string.
 */
export const WIDGET_PAGE_PATHS: Record<WidgetKind, string> = {
  globe: "/tools/zoned-earth/",
  dst: "/tools/dst-inspector/",
  interval: "/tools/interval-visualizer/",
  converter: "/tools/converter-bench/",
  dwell: "/tools/dwell-ledger/",
  freetime: "/tools/free-time-ledger/",
  billing: "/tools/billing-deadlines/",
  delivery: "/tools/delivery-scheduler/",
  connection: "/tools/connection-checker/",
  timetable: "/tools/timetable-reader/",
  crossing: "/tools/crossing-clock/",
  cutoffstack: "/tools/cutoff-stack/",
  cutoffruler: "/tools/cutoff-ruler/",
  cutoffcountdown: "/tools/cutoff-countdown/",
  punctuality: "/tools/punctuality-board/",
  etadrift: "/tools/eta-drift/",
  departure: "/tools/departure-board/",
  planner: "/tools/zone-planner/",
  dtm: "/tools/dtm-decoder/",
  xtime: "/tools/x12-time-reader/",
  demclock: "/tools/demurrage-clock/",
  bldate: "/tools/bl-date-stamp/",
  epcis: "/tools/epcis-event-reader/",
  journeysplit: "/tools/journey-split/",
  gnssweek: "/tools/gnss-week-decoder/",
  satclock: "/tools/satellite-clock-converter/",
  rollover: "/tools/gnss-rollover-checker/",
  leapline: "/tools/leap-second-timeline/",
  elapsed: "/tools/elapsed-vs-clock-difference/",
  storedaudit: "/tools/stored-time-audit/",
  holidays: "/tools/holiday-rule-builder/",
  observance: "/tools/observance-comparator/",
  feasts: "/tools/moving-feasts/",
  // `/check` is a directory with no index page of its own, so the built-site guard reads a bare
  // "/check/…" string in the bundle as a request for a public file. The literal sits inside
  // `withBase`, the call the guard accepts; `encodeWidgetPermalink` applies `withBase` again, which
  // leaves a path already under the base alone.
  canadaclock: withBase("/check/canada-2026-clock-change/"),
  durationbench: "/tools/duration-parser-bench/",
  iddecode: "/tools/id-timestamp-decoder/",
  colbridge: "/tools/column-timestamp-bridge/",
  moroccoclock: withBase("/check/morocco-2026-clock-change/"),
};

/** A tool to open and the permalink keys that seed it, for a cross-link. */
export interface ToolHandoff {
  kind: WidgetKind;
  args: Record<string, string>;
}

/** The permalink a handoff opens, or `null` while the link has nothing to send. */
export function handoffHref(handoff: ToolHandoff | null): string | null {
  return handoff === null
    ? null
    : encodeWidgetPermalink(handoff.kind, handoff.args);
}

export function encodeWidgetPermalink(
  kind: WidgetKind,
  args: Record<string, unknown>,
): string {
  const params = new URLSearchParams({ w: kind, wa: JSON.stringify(args) });
  return `${withBase(WIDGET_PAGE_PATHS[kind])}?${params.toString()}`;
}

/**
 * Read a permalink back.
 *
 * Returns the raw parsed args — the caller validates them with the widget's own
 * schema, because that schema is the single source of truth about what a valid
 * call looks like and this module should not hold a second opinion.
 */
export function decodeWidgetPermalink(
  search: string,
): { kind: WidgetKind; args: unknown } | null {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );
  const kind = params.get("w");
  const raw = params.get("wa");
  if (!kind || !raw) return null;
  if (!(kind in WIDGET_PAGE_PATHS)) return null;

  try {
    return { kind: kind as WidgetKind, args: JSON.parse(raw) };
  } catch {
    // A hand-mangled or truncated link is a missing permalink, not an error.
    return null;
  }
}

/**
 * Keys whose value is a list of lines, so 64 characters would drop all but one
 * short line. `values` is the chat schema's own bound (`showStoredTimeAuditInput`);
 * `rules` and `holidays` hold a year's rules or closing dates.
 */
const LONG_STRING_KEYS: Readonly<Record<string, number>> = {
  values: 1000,
  // A rule per line (the Holiday Rule Builder). The bound is the longest list
  // `showHolidayRuleBuilderInput` accepts, so no list the chat sends is dropped
  // from its own link: 12 `dates` rules, each a 64-character name, `;d;`, 60
  // dates of up to 64 characters and 59 commas. A name or date of separators
  // doubles when escaped (`formatRuleLine`), so that is 12 × 7,870 characters
  // and 11 newlines, 94,451. Twelve rules of 60 real dates are about 9,000.
  rules: 95_000,
  // A calendar's dates (the Free Time Ledger and the Cut-off Stack read
  // `holidays` too: a year of closures runs past 64 characters, six dates).
  holidays: 1000,
};

/**
 * Keys whose empty string is a value, an empty list: no weekend (the Holiday
 * Rule Builder, the Observance Comparator, the Free Time Ledger) or no offsets
 * (Moving Feasts). Every other empty string is a missing value, so the widget
 * keeps its default.
 */
const EMPTY_LIST_KEYS: ReadonlySet<string> = new Set(["weekend", "offsets"]);

/**
 * The string bound for the two CORE-56 tools, in place of the default 64: a
 * zoned value runs to about 70 characters, so their fields and links take 96.
 * Other tools keep 64.
 */
const KIND_STRING_CAPS: Readonly<Partial<Record<WidgetKind, number>>> = {
  iddecode: 96,
  colbridge: 96,
};

/**
 * Keys whose empty string is a real answer for one tool: the ID Timestamp
 * Decoder's blank identifier must come back blank, not as the default UUID.
 */
const EMPTY_KEYS_BY_KIND: Readonly<
  Partial<Record<WidgetKind, ReadonlySet<string>>>
> = { iddecode: new Set(["id"]) };

/**
 * Read this page's own permalink, if it carries one for `kind`.
 *
 * Called from each widget's page bootstrap, so a link copied out of the chat —
 * or written by hand into a guide, as `/tools/dst-inspector/` does — arrives
 * showing the state it names rather than the widget's defaults.
 *
 * ## Why the checks here are structural rather than a zod parse
 *
 * The tool path already validates with the real schemas, twice: at the edge in
 * the Worker and again in `widget-registry.ts` before mounting. This is the
 * *other* entrance, and it has a different constraint — it runs on the widget's
 * own page, which must not drag `zod` (and through `dox-tools.ts`, the whole
 * `ai` package) into a documentation page's bundle for the sake of reading four
 * query parameters.
 *
 * So: shapes and ranges are checked here, and everything interpolated into
 * markup is escaped at the template boundary by `escapeAttr` regardless of
 * which entrance it came through. The escaping is what actually makes this
 * safe; these checks stop a nonsense value producing a confusing widget.
 */
export function seedFromLocation(
  kind: WidgetKind,
  search: string = typeof window === "undefined" ? "" : window.location.search,
): Record<string, unknown> {
  const decoded = decodeWidgetPermalink(search);
  if (!decoded || decoded.kind !== kind) return {};
  const args = decoded.args;
  if (typeof args !== "object" || args === null || Array.isArray(args))
    return {};

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args as Record<string, unknown>)) {
    // Strings are capped rather than pattern-matched: the widgets already fall
    // back to a default for anything they cannot use, and a length bound is
    // what stops a hostile link bloating the page. A key that carries a list
    // of lines has its own, larger bound (`LONG_STRING_KEYS`).
    const cap = LONG_STRING_KEYS[key] ?? KIND_STRING_CAPS[kind] ?? 64;
    const least =
      EMPTY_LIST_KEYS.has(key) || EMPTY_KEYS_BY_KIND[kind]?.has(key) ? 0 : 1;
    if (
      typeof value === "string" &&
      value.length >= least &&
      value.length <= cap
    ) {
      out[key] = value;
    } else if (
      typeof value === "number" &&
      Number.isInteger(value) &&
      value >= 1900 &&
      value <= 2100
    ) {
      out[key] = value;
    }
  }
  return out;
}
