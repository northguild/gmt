import { Temporal } from "@js-temporal/polyfill";
import type { CalendarSystem } from "../types";

/**
 * Every `CalendarSystem`, by canonical calendar id: the CLDR `common/bcp47/calendar.xml` type,
 * which is also what Temporal's `CanonicalizeCalendar` returns and what RFC 9557's `[u-ca=<id>]`
 * carries. `"iso8601"` plus the Intl Era and Month Code proposal's `table-calendar-types` rows
 * GMT supports (not `"chinese"` or `"dangi"`).
 */
export const calendarSystems: readonly CalendarSystem[] = [
  "iso8601",
  "gregory",
  "hebrew",
  "islamic-civil",
  "islamic-tbla",
  "islamic-umalqura",
  "japanese",
  "buddhist",
  "roc",
  "persian",
  "indian",
  "ethiopic",
  "ethioaa",
  "coptic",
];

const calendarSystemSet: ReadonlySet<string> = new Set(calendarSystems);

/** True when `value` is exactly a canonical `CalendarSystem` id (no alias, no case folding). */
export function isCalendarSystem(value: string): value is CalendarSystem {
  return calendarSystemSet.has(value);
}

/**
 * The `CalendarSystem` a calendar id names, or `null` when GMT does not support it.
 *
 * Canonicalization is Temporal's (`CanonicalizeCalendar`: ASCII-lowercase, then the CLDR alias
 * mapping, so `"ethiopic-amete-alem"` is `"ethioaa"` and `"islamicc"` is `"islamic-civil"`),
 * asked of the polyfill rather than kept as a GMT copy of the alias table. Constructing a
 * `PlainDate` reads no calendar fields, so this is safe for every calendar.
 */
export function canonicalCalendarSystem(id: string): CalendarSystem | null {
  if (typeof id !== "string" || id.length === 0) {
    return null;
  }
  try {
    const canonical = new Temporal.PlainDate(1970, 1, 1, id).calendarId;
    return isCalendarSystem(canonical) ? canonical : null;
  } catch {
    return null;
  }
}

/**
 * The Temporal calendar a `CalendarSystem` computes in. The Ethiopic family (`"ethiopic"`,
 * `"coptic"`) computes in `"ethioaa"`: polyfill 0.5.1 cannot read `"ethiopic"`/`"coptic"` fields
 * under ICU >= 78, and the three calendars share months, days and arithmetic, differing only by a
 * constant year offset (test262 `extreme-dates.js`: ethiopic = ethioaa − 5500, coptic = ethioaa −
 * 5776 at both limits). Strings still carry the
 * requested id; only the computation is routed.
 */
export function computationCalendarId(calendar: CalendarSystem): string {
  return calendar === "ethiopic" || calendar === "coptic"
    ? "ethioaa"
    : calendar;
}
