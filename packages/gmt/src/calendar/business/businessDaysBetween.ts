import { Temporal } from "@js-temporal/polyfill";
import { parseBusinessCalendar } from "../../internal";
import { isValidDate } from "../../plain/validate";
import type { BusinessCalendar } from "../../types";

const DAYS_PER_WEEK = 7;

/**
 * Count the business days in `(from, to]`, given `from` is not after `to`.
 *
 * Whole weeks contribute one of each weekday, so only the remainder is walked and the count
 * costs the same for a range of days as for one of centuries.
 */
function countBusinessDates(
  from: Temporal.PlainDate,
  to: Temporal.PlainDate,
  weekend: Set<number>,
  holidays: Set<string>,
): number {
  const days = from.until(to, { largestUnit: "day" }).days;
  const wholeWeeks = Math.floor(days / DAYS_PER_WEEK);
  const businessDaysPerWeek = DAYS_PER_WEEK - weekend.size;

  let count = wholeWeeks * businessDaysPerWeek;

  for (let offset = wholeWeeks * DAYS_PER_WEEK + 1; offset <= days; offset++) {
    if (!weekend.has(from.add({ days: offset }).dayOfWeek)) {
      count += 1;
    }
  }

  for (const holiday of holidays) {
    const date = Temporal.PlainDate.from(holiday);
    const insideRange =
      Temporal.PlainDate.compare(date, from) > 0 &&
      Temporal.PlainDate.compare(date, to) <= 0;

    if (insideRange && !weekend.has(date.dayOfWeek)) {
      count -= 1;
    }
  }

  return count;
}

/**
 * Count the working days between two local dates, **excluding `start` and including `end`**.
 *
 * - The convention is stated, not inferred: the range is `(start, end]`. Counting from Monday
 *   to Friday of the same week gives 4, not 5 — Monday itself is not counted.
 * - That makes it the exact inverse of `addBusinessDays`: if `end` is `addBusinessDays(start,
 *   n, calendar)`, this returns `n`.
 * - `end` before `start` returns a negative count, so swapping the arguments negates the
 *   result and `businessDaysBetween(d, d, calendar)` is 0 for any `d`.
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
 * @example businessDaysBetween("2024-07-01", "2024-07-05", { weekend: [6, 7], holidays: ["2024-07-04"], timeZone: "America/New_York" }) // 3 — Tue, Wed, Fri
 * @example businessDaysBetween("2024-07-05", "2024-07-08", { weekend: [6, 7], holidays: [], timeZone: "UTC" }) // 1 — Monday, over the weekend
 * @example businessDaysBetween("2024-07-01", "2024-07-31", { weekend: [6, 7], holidays: [], timeZone: "UTC" }) // 22 — July's 23 weekdays less the 1st
 * @example businessDaysBetween("2024-07-01", "2024-07-01", { weekend: [6, 7], holidays: [], timeZone: "UTC" }) // 0
 * @example businessDaysBetween("2024-07-05", "2024-07-01", { weekend: [6, 7], holidays: ["2024-07-04"], timeZone: "America/New_York" }) // -3 — reversed
 * @example businessDaysBetween("2024-07-01", "2024-07-08", { weekend: [5, 6], holidays: [], timeZone: "Asia/Riyadh" }) // 5 — Friday–Saturday weekend
 * @example businessDaysBetween("invalid", "2024-07-05", { weekend: [6, 7], holidays: [], timeZone: "UTC" }) // null
 * @example businessDaysBetween("2024-07-01", "2024-07-05", { weekend: [6, 7], holidays: [], timeZone: "Invalid/Zone" }) // null
 */
export function businessDaysBetween(
  start: string,
  end: string,
  calendar: BusinessCalendar,
): number | null {
  const resolved = parseBusinessCalendar(calendar);

  if (!isValidDate(start) || !isValidDate(end) || resolved === null) {
    return null;
  }

  try {
    const startDate = Temporal.PlainDate.from(start);
    const endDate = Temporal.PlainDate.from(end);
    const reversed = Temporal.PlainDate.compare(startDate, endDate) > 0;
    const count = countBusinessDates(
      reversed ? endDate : startDate,
      reversed ? startDate : endDate,
      resolved.weekend,
      resolved.holidays,
    );

    return reversed ? -count : count;
  } catch {
    return null;
  }
}
