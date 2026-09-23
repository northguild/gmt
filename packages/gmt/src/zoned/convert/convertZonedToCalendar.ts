import {
  canonicalCalendarSystem,
  formatZonedInCalendar,
  parseCalendarZonedValue,
} from "../../internal";
import type { CalendarSystem } from "../../types";
import { isValidCalendarZonedDateTime } from "../validate";

/**
 * Express a zoned datetime in a calendar system: the RFC 9557 string
 * `Temporal.ZonedDateTime#toString()` writes for that instant, zone and calendar.
 *
 * - The instant, the wall time, the UTC offset, the IANA zone and the digits are all unchanged:
 *   the date is always written as ISO 8601. A `[u-ca=<id>]` annotation after the `[timeZone]`
 *   annotation names the calendar (RFC 9557 §3.3, §4.1). Eras and calendar years are never part
 *   of the string.
 * - `"iso8601"` writes a bare ISO zoned string; every other calendar, `"gregory"` included, is
 *   annotated.
 * - Accepts a bare ISO zoned datetime or any calendar-annotated one GMT reads (see
 *   `isValidCalendarZonedDateTime`), so conversions chain between calendars.
 * - `calendar` is a canonical calendar id; like Temporal's `withCalendar`, an alias or another
 *   letter case is canonicalized.
 * - Returns "" on invalid input or an unsupported `calendar`.
 *
 * Compatibility: since 1.16.0 the string is RFC 9557. Earlier releases wrote the calendar's own
 * year, month and day, a `;era=` suffix for `japanese` and `ethiopic`, the calendar annotation
 * before the time zone, and the ids `gregorian`, `taiwan`, `islamic-tabular` and
 * `ethiopic-amete-alem`; those strings are not converted.
 *
 * @param value ISO zoned datetime string, optionally calendar-annotated
 * @param calendar target calendar id ("iso8601" | "gregory" | "hebrew" | "islamic-civil" |
 *   "islamic-tbla" | "islamic-umalqura" | "japanese" | "buddhist" | "roc" | "persian" |
 *   "indian" | "ethiopic" | "ethioaa" | "coptic")
 * @returns RFC 9557 zoned datetime string, or "" on invalid input
 *
 * @example convertZonedToCalendar("2024-10-03T14:30:45-04:00[America/New_York]", "hebrew") // "2024-10-03T14:30:45-04:00[America/New_York][u-ca=hebrew]"
 * @example convertZonedToCalendar("2024-10-03T14:30:45-04:00[America/New_York][u-ca=hebrew]", "iso8601") // "2024-10-03T14:30:45-04:00[America/New_York]"
 * @example convertZonedToCalendar("2024-10-03T14:30:45-04:00[America/New_York]", "japanese") // "2024-10-03T14:30:45-04:00[America/New_York][u-ca=japanese]"
 * @example convertZonedToCalendar("2024-10-03T14:30:45-04:00[America/New_York]", "roc") // "2024-10-03T14:30:45-04:00[America/New_York][u-ca=roc]"
 * @example convertZonedToCalendar("+275760-09-13T00:00:00+00:00[UTC]", "hebrew") // "+275760-09-13T00:00:00+00:00[UTC][u-ca=hebrew]"
 * @example convertZonedToCalendar("2024-10-03T14:30:45-04:00[u-ca=hebrew][America/New_York]", "iso8601") // "" (calendar before zone is not RFC 9557)
 * @example convertZonedToCalendar("invalid", "hebrew") // ""
 */
export function convertZonedToCalendar(
  value: string,
  calendar: CalendarSystem,
): string {
  if (!isValidCalendarZonedDateTime(value)) {
    return "";
  }
  const target = canonicalCalendarSystem(calendar);
  if (!target) {
    return "";
  }

  try {
    return formatZonedInCalendar(parseCalendarZonedValue(value), target);
  } catch {
    return "";
  }
}
