import { Temporal } from "../../internal/temporal";
import {
  businessDaysWithin,
  parseBusinessCalendar,
} from "../../internal/businessCalendar";
import { epochDayOfDate } from "../../internal/epochDay";
import { isValidDate } from "../../plain/validate";
import type { BusinessCalendar } from "../../types";

/**
 * Count the working days between two local dates, **excluding `start` and including `end`**.
 *
 * - The convention is stated, not inferred: the range is `(start, end]`. Counting from Monday
 *   to Friday of the same week gives 4, not 5 — Monday itself is not counted.
 * - That makes it the inverse of `addBusinessDays` when `n ≥ 0` or `start` is a business day:
 *   if `end` is `addBusinessDays(start, n, calendar)`, this returns `n`. From a weekend or
 *   holiday `start`, a negative `n` counts one closer to zero, because `start` itself is
 *   excluded and is not a business day.
 * - `end` before `start` returns a negative count, so swapping the arguments negates the
 *   result. An empty range is always `0`, never `-0`, and `businessDaysBetween(d, d, calendar)`
 *   is 0 for any `d`.
 * - The count is computed, not walked, so there is no range limit: whole weeks contribute one
 *   of each weekday and only the holidays are visited individually.
 * - Both dates and `calendar.holidays` are local dates; `calendar.timeZone` is not read. A
 *   caller holding an instant reduces it to a local date first, with `floorToZone`.
 * - Returns `null` when either date is not a valid ISO PlainDate, or `calendar` is not a valid
 *   `BusinessCalendar`. Narrow it with `isValidBusinessCalendar` to tell a misconfigured
 *   calendar apart from a genuine 0.
 *
 * @param start ISO PlainDate string, excluded from the count
 * @param end ISO PlainDate string, included in the count
 * @param calendar BusinessCalendar naming the weekend days and holidays
 * @returns number of working days in `(start, end]`, negative when `end` precedes `start`, or null on invalid input
 *
 * @example businessDaysBetween("2024-07-01", "2024-07-05", { weekend: [6, 7], holidays: ["2024-07-04"], timeZone: "Africa/Kigali" }) // 3 — Tue, Wed, Fri
 * @example businessDaysBetween("2024-07-05", "2024-07-08", { weekend: [6, 7], holidays: [], timeZone: "UTC" }) // 1 — Monday, over the weekend
 * @example businessDaysBetween("2024-07-01", "2024-07-31", { weekend: [6, 7], holidays: [], timeZone: "UTC" }) // 22 — July's 23 weekdays less the 1st
 * @example businessDaysBetween("2024-07-01", "2024-07-01", { weekend: [6, 7], holidays: [], timeZone: "UTC" }) // 0
 * @example businessDaysBetween("2024-07-05", "2024-07-01", { weekend: [6, 7], holidays: ["2024-07-04"], timeZone: "Africa/Kigali" }) // -3 — reversed
 * @example businessDaysBetween("2024-07-06", "2024-07-05", { weekend: [6, 7], holidays: [], timeZone: "UTC" }) // 0 — addBusinessDays("2024-07-06", -1) is "2024-07-05", but Saturday is excluded
 * @example businessDaysBetween("2024-07-01", "2024-07-08", { weekend: [5, 6], holidays: [], timeZone: "Asia/Riyadh" }) // 5 — Friday–Saturday weekend
 * @example businessDaysBetween("invalid", "2024-07-05", { weekend: [6, 7], holidays: [], timeZone: "UTC" }) // null
 * @example businessDaysBetween("2024-07-01", "2024-07-05", { weekend: [6, 7], holidays: [], timeZone: "Invalid/Zone" }) // null
 */
export function businessDaysBetween(
  start: string,
  end: string,
  calendar: BusinessCalendar,
): number | null {
  try {
    const resolved = parseBusinessCalendar(calendar);

    if (!isValidDate(start) || !isValidDate(end) || resolved === null) {
      return null;
    }

    try {
      const startDay = epochDayOfDate(Temporal.PlainDate.from(start));
      const endDay = epochDayOfDate(Temporal.PlainDate.from(end));
      const reversed = startDay > endDay;
      const count = reversed
        ? businessDaysWithin(endDay + 1, startDay, resolved)
        : businessDaysWithin(startDay + 1, endDay, resolved);

      // `0 - count` rather than `-count`: an empty reversed range must be 0, not -0.
      return reversed ? 0 - count : count;
    } catch {
      return null;
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return null;
  }
}
