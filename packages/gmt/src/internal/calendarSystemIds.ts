import { Temporal } from "./temporal";
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
