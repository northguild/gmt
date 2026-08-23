import {
  formatCalendarDate,
  formatEthiopicFamilyDate,
  isEthiopicFamilyCalendar,
  parseCalendarDateValue,
  temporalCalendarIds,
} from "../../internal";
import type { CalendarSystem } from "../../types";
import { isValidCalendarDate } from "../validate";

/**
 * Convert a PlainDate to the same date expressed in a different calendar system.
 *
 * - Accepts a plain ISO date ("2024-10-03") or a calendar-annotated date previously
 *   produced by this function ("5785-01-01[u-ca=hebrew]"), so conversions can chain
 *   between calendar systems.
 * - The output for "gregorian" is always a bare, unannotated ISO string, matching every
 *   other GMT PlainDate string. Any other calendar returns its own native year/month/day
 *   (e.g. Hebrew year 5785, not the ISO year), tagged with `[u-ca=<identifier>]` — this
 *   diverges from Temporal's own `[u-ca=...]` string convention (which keeps ISO digits
 *   and only annotates the calendar) specifically so the calendar's native fields are
 *   visible in GMT's string contract, not hidden behind calendar-aware accessors.
 * - Uses Temporal's built-in calendar support (`PlainDate.prototype.withCalendar`) for every
 *   calendar except the Ethiopic family ("ethiopic" / "ethiopic-amete-alem" / "coptic"),
 *   which is computed with GMT-owned arithmetic instead — see
 *   `internal/ethiopicFamilyCalendar.ts` for why. Either way, the underlying date never
 *   changes, only which calendar's fields it resolves through.
 * - Returns "" on invalid input or an unsupported `calendar`.
 *
 * "japanese" and "ethiopic" are the two calendars tagged with an era instead of a plain
 * native year — see the README's calendar-systems section for why.
 *
 * @param value ISO PlainDate string, optionally calendar-annotated
 * @param calendar target calendar system ("gregorian" | "hebrew" | "islamic-civil" |
 *   "islamic-tabular" | "islamic-umalqura" | "japanese" | "buddhist" | "taiwan" |
 *   "persian" | "indian" | "ethiopic" | "ethiopic-amete-alem" | "coptic")
 * @returns calendar-native ISO-shaped PlainDate string, or "" on invalid input
 *
 * @example convertDateToCalendar("2024-10-03", "hebrew") // "5785-01-01[u-ca=hebrew]"
 * @example convertDateToCalendar("5785-01-01[u-ca=hebrew]", "gregorian") // "2024-10-03"
 * @example convertDateToCalendar("2024-10-03", "gregorian") // "2024-10-03"
 * @example convertDateToCalendar("2024-10-03", "islamic-umalqura") // "1446-03-30[u-ca=islamic-umalqura]"
 * @example convertDateToCalendar("2024-10-03", "japanese") // "0006-10-03[u-ca=japanese;era=reiwa]"
 * @example convertDateToCalendar("2024-10-03", "buddhist") // "2567-10-03[u-ca=buddhist]"
 * @example convertDateToCalendar("2024-10-03", "taiwan") // "0113-10-03[u-ca=taiwan]"
 * @example convertDateToCalendar("2024-10-03", "persian") // "1403-07-12[u-ca=persian]"
 * @example convertDateToCalendar("2024-10-03", "indian") // "1946-07-11[u-ca=indian]"
 * @example convertDateToCalendar("2024-10-03", "ethiopic") // "2017-01-23[u-ca=ethiopic;era=ethiopic]"
 * @example convertDateToCalendar("2024-10-03", "ethiopic-amete-alem") // "7517-01-23[u-ca=ethiopic-amete-alem]"
 * @example convertDateToCalendar("2024-10-03", "coptic") // "1741-01-23[u-ca=coptic]"
 * @example convertDateToCalendar("invalid", "hebrew") // ""
 */
export function convertDateToCalendar(
  value: string,
  calendar: CalendarSystem,
): string {
  if (!isValidCalendarDate(value) || !(calendar in temporalCalendarIds)) {
    return "";
  }

  try {
    const date = parseCalendarDateValue(value);
    if (isEthiopicFamilyCalendar(calendar)) {
      return formatEthiopicFamilyDate(date, calendar);
    }
    return formatCalendarDate(date.withCalendar(temporalCalendarIds[calendar]));
  } catch {
    return "";
  }
}
