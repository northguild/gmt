import { Temporal } from "@js-temporal/polyfill";
import { parseBusinessCalendar } from "../../internal/businessCalendar";
import type { BusinessCalendar } from "../../types";

/**
 * Compose several jurisdictions' calendars into one whose working days are those they all
 * share.
 *
 * - A date is a working day in the result only if it is a working day in **every** input: the
 *   weekend days union and so do the holidays, so a closure anywhere closes the merged
 *   calendar.
 * - This is why the business-day engine is core rather than finance. FX settlement needs both
 *   currencies' calendars, an intermodal move the origin port's and the destination port's,
 *   and a cross-border rail path both national calendars — one implementation, four consumers.
 * - `weekend` and `holidays` come back sorted ascending and de-duplicated, so the result is
 *   stable whatever order the inputs arrive in. Holidays sort chronologically, not
 *   lexicographically, so an expanded year such as `"+010000-01-01"` lands where it belongs.
 * - `timeZone` is the **first** calendar's. The merged calendar spans localities that may
 *   disagree, and GMT does not invent a zone for it; the field records locality only and no
 *   business-day function reads it.
 * - Returns `null` for an empty list — there is no `timeZone` to take — when `calendars` is
 *   not an array, when any element is not a valid `BusinessCalendar`, and when the merged
 *   weekend swallows all seven weekdays, leaving a calendar with no working day at all.
 *   `isValidBusinessCalendar` tells a legitimate result apart from that sentinel.
 *
 * @param calendars array of BusinessCalendar records to compose
 * @returns merged BusinessCalendar, or null on invalid input
 *
 * @example mergeCalendars([{ weekend: [6, 7], holidays: ["2024-07-04"], timeZone: "America/New_York" }, { weekend: [6, 7], holidays: ["2024-05-06"], timeZone: "Europe/London" }]) // { weekend: [6, 7], holidays: ["2024-05-06", "2024-07-04"], timeZone: "America/New_York" }
 * @example mergeCalendars([{ weekend: [6, 7], holidays: [], timeZone: "UTC" }, { weekend: [5, 6], holidays: [], timeZone: "Asia/Riyadh" }]) // { weekend: [5, 6, 7], holidays: [], timeZone: "UTC" } — only Sunday to Thursday survive
 * @example mergeCalendars([{ weekend: [6, 7], holidays: ["2024-07-04"], timeZone: "UTC" }]) // { weekend: [6, 7], holidays: ["2024-07-04"], timeZone: "UTC" }
 * @example mergeCalendars([]) // null
 * @example mergeCalendars([{ weekend: [1, 2, 3, 4], holidays: [], timeZone: "UTC" }, { weekend: [5, 6, 7], holidays: [], timeZone: "UTC" }]) // null — no working day left
 * @example mergeCalendars([{ weekend: [6, 7], holidays: [], timeZone: "Invalid/Zone" }]) // null
 */
export function mergeCalendars(
  calendars: BusinessCalendar[],
): BusinessCalendar | null {
  try {
    if (!Array.isArray(calendars) || calendars.length === 0) {
      return null;
    }

    const weekend = new Set<number>();
    const holidays = new Set<string>();

    for (const calendar of calendars) {
      const resolved = parseBusinessCalendar(calendar);

      if (resolved === null) {
        return null;
      }

      for (const day of resolved.weekend) {
        weekend.add(day);
      }

      for (const holiday of resolved.holidays) {
        holidays.add(holiday);
      }
    }

    const merged = {
      weekend: [...weekend].sort((a, b) => a - b),
      // Chronological, not lexicographic: a bare `.sort()` compares as strings, which puts the
      // "+" and "-" of an expanded year below every digit.
      holidays: [...holidays].sort((a, b) => Temporal.PlainDate.compare(a, b)),
      timeZone: calendars[0].timeZone,
    };

    // The union can close every weekday even when no input does, which is not a calendar.
    return parseBusinessCalendar(merged) === null ? null : merged;
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return null;
  }
}
