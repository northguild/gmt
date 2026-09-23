import {
  canonicalCalendarSystem,
  formatDateInCalendar,
  parseCalendarDateValue,
} from "../../internal";
import type { CalendarSystem } from "../../types";
import { isValidCalendarDate } from "../validate";

/**
 * Express a PlainDate in a calendar system: the RFC 9557 string
 * `Temporal.PlainDate#toString()` writes for that date in that calendar.
 *
 * - The date never changes, and neither do its digits: they are always the ISO 8601 date.
 *   The calendar is carried by a `[u-ca=<id>]` annotation (RFC 9557 §3.3), and eras, calendar
 *   years and month codes are never part of the string.
 * - `"iso8601"` writes a bare ISO date; every other calendar, `"gregory"` included, is annotated.
 * - Accepts a bare ISO date or any calendar-annotated date GMT reads (see `isValidCalendarDate`),
 *   so conversions chain between calendars.
 * - `calendar` is a canonical calendar id; like Temporal's `withCalendar`, an alias or another
 *   letter case is canonicalized (`"ethiopic-amete-alem"` writes `[u-ca=ethioaa]`).
 * - **Only one of CLDR's four legacy calendar aliases works, and that is Temporal's rule, not
 *   GMT's.** `ethiopic-amete-alem` canonicalizes to `ethioaa`; `gregorian`, `islamic-tabular` and
 *   `taiwan` return `""`. Chromium 153 and `@js-temporal/polyfill` both throw `RangeError` for
 *   those three: `gregorian` is nine letters, past the 8-character limit on a Unicode
 *   locale-extension `type` subtag, and the other two are absent from ECMA-402's
 *   `AvailableCanonicalCalendars`. Use `gregory`, `islamic-tbla` and `roc`.
 * - Returns "" on invalid input or an unsupported `calendar`.
 *
 * Compatibility: since 1.16.0 the string is RFC 9557. Earlier releases wrote the calendar's own
 * year, month and day (`"5785-01-01[u-ca=hebrew]"` for ISO 2024-10-03), a `;era=` suffix for
 * `japanese` and `ethiopic`, and the ids `gregorian`, `taiwan`, `islamic-tabular` and
 * `ethiopic-amete-alem`; those strings are not converted.
 *
 * @param value ISO PlainDate string, optionally calendar-annotated
 * @param calendar target calendar id ("iso8601" | "gregory" | "hebrew" | "islamic-civil" |
 *   "islamic-tbla" | "islamic-umalqura" | "japanese" | "buddhist" | "roc" | "persian" |
 *   "indian" | "ethiopic" | "ethioaa" | "coptic")
 * @returns RFC 9557 PlainDate string, or "" on invalid input
 *
 * @example convertDateToCalendar("2024-10-03", "hebrew") // "2024-10-03[u-ca=hebrew]"
 * @example convertDateToCalendar("2024-10-03", "japanese") // "2024-10-03[u-ca=japanese]"
 * @example convertDateToCalendar("1000-01-01", "roc") // "1000-01-01[u-ca=roc]"
 * @example convertDateToCalendar("+275760-09-13", "hebrew") // "+275760-09-13[u-ca=hebrew]"
 * @example convertDateToCalendar("2024-10-03[u-ca=hebrew]", "iso8601") // "2024-10-03"
 * @example convertDateToCalendar("2024-10-03", "gregory") // "2024-10-03[u-ca=gregory]"
 * @example convertDateToCalendar("2024-10-03", "ethiopic-amete-alem" as never) // "2024-10-03[u-ca=ethioaa]"
 * @example convertDateToCalendar("0006-10-03[u-ca=japanese;era=reiwa]", "iso8601") // "" (not RFC 9557)
 * @example convertDateToCalendar("2024-10-03", "gregorian" as never) // "" (a CLDR alias Temporal does not accept; use "gregory")
 * @example convertDateToCalendar("2024-10-03", "taiwan" as never) // "" (a CLDR alias Temporal does not accept; use "roc")
 * @example convertDateToCalendar("invalid", "hebrew") // ""
 */
export function convertDateToCalendar(
  value: string,
  calendar: CalendarSystem,
): string {
  if (!isValidCalendarDate(value)) {
    return "";
  }
  const target = canonicalCalendarSystem(calendar);
  if (!target) {
    return "";
  }

  try {
    return formatDateInCalendar(parseCalendarDateValue(value), target);
  } catch {
    return "";
  }
}
