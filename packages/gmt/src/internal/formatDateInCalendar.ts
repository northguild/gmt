import type { Temporal } from "@js-temporal/polyfill";
import type { CalendarSystem } from "../types";

/**
 * Write a Temporal.PlainDate as a GMT PlainDate string in `calendar`: exactly
 * `Temporal.PlainDate#toString()` for that date in that calendar. That is Temporal's
 * `TemporalDateToString` with `calendarName: "auto"` — the ISO date (`PadISOYear`: four digits,
 * or a sign and six) followed by `FormatCalendarAnnotation`, which is empty for `"iso8601"` and
 * `[u-ca=<id>]` for every other calendar, `"gregory"` included.
 *
 * The calendar is passed in, not read from `date.calendarId`, because `"ethiopic"` and
 * `"coptic"` compute in `"ethioaa"` (`computationCalendarId`); the ISO date is the same whichever
 * calendar it was computed in.
 *
 * @param date Temporal.PlainDate to write, in any calendar
 * @param calendar the CalendarSystem the string names
 * @returns the RFC 9557 PlainDate string
 *
 * @example formatDateInCalendar(Temporal.PlainDate.from("2024-10-03").withCalendar("hebrew"), "hebrew") // "2024-10-03[u-ca=hebrew]"
 * @example formatDateInCalendar(Temporal.PlainDate.from("2024-10-03"), "iso8601") // "2024-10-03"
 * @example formatDateInCalendar(Temporal.PlainDate.from("+275760-09-13"), "roc") // "+275760-09-13[u-ca=roc]"
 */
export function formatDateInCalendar(
  date: Temporal.PlainDate,
  calendar: CalendarSystem,
): string {
  const iso = date.withCalendar("iso8601").toString();
  return calendar === "iso8601" ? iso : `${iso}[u-ca=${calendar}]`;
}
