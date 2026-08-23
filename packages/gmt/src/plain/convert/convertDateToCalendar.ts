import {
  formatCalendarDate,
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
 * - Uses Temporal's built-in calendar support (`PlainDate.prototype.withCalendar`) — the
 *   underlying date never changes, only which calendar's fields it resolves through.
 * - Returns "" on invalid input or an unsupported `calendar`.
 *
 * @param value ISO PlainDate string, optionally calendar-annotated
 * @param calendar target calendar system ("gregorian" | "hebrew")
 * @returns calendar-native ISO-shaped PlainDate string, or "" on invalid input
 *
 * @example convertDateToCalendar("2024-10-03", "hebrew") // "5785-01-01[u-ca=hebrew]"
 * @example convertDateToCalendar("5785-01-01[u-ca=hebrew]", "gregorian") // "2024-10-03"
 * @example convertDateToCalendar("2024-10-03", "gregorian") // "2024-10-03"
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
    return formatCalendarDate(date.withCalendar(temporalCalendarIds[calendar]));
  } catch {
    return "";
  }
}
