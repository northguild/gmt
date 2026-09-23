import { neighbourBusinessDayValue } from "../../internal/businessDayValues";
import type { BusinessCalendar } from "../../types";

/**
 * Return the last working day **strictly before** `value`.
 *
 * - Strictly before: called on a working day it returns the previous one, never `value`
 *   itself. For the on-or-before behaviour — leave a working day alone, move a non-working one
 *   backward — use `rollDate(value, "preceding", calendar)`.
 * - Equivalent to `subtractBusinessDays(value, 1, calendar)` for any valid calendar, but the
 *   calendar is **required** here: there is no Saturday–Sunday default to fall back on,
 *   because a weekend is never assumed.
 * - `value` may be any local date, working or not: being called from a weekend or a holiday is
 *   the normal case, not an error.
 * - `value` and `calendar.holidays` are local dates; `calendar.timeZone` is not read. A caller
 *   holding an instant reduces it to a local date first, with `floorToZone`.
 * - Returns `""` when `value` is not a valid ISO PlainDate, when `calendar` is not a valid
 *   `BusinessCalendar`, and when the walk runs past 200,000 calendar days without finding a
 *   working day.
 *
 * @param value ISO PlainDate string to start from, excluded from the search
 * @param calendar BusinessCalendar naming the weekend days and holidays
 * @returns ISO PlainDate string of the previous working day, or "" on invalid input
 *
 * @example previousBusinessDay("2024-07-05", { weekend: [6, 7], holidays: ["2024-07-04"], timeZone: "America/New_York" }) // "2024-07-03" — skips the holiday
 * @example previousBusinessDay("2024-07-04", { weekend: [6, 7], holidays: ["2024-07-04"], timeZone: "America/New_York" }) // "2024-07-03" — from the holiday itself
 * @example previousBusinessDay("2024-07-08", { weekend: [6, 7], holidays: [], timeZone: "UTC" }) // "2024-07-05" — Monday back over the weekend
 * @example previousBusinessDay("2024-07-07", { weekend: [5, 6], holidays: [], timeZone: "Asia/Riyadh" }) // "2024-07-04" — Friday–Saturday weekend
 * @example previousBusinessDay("invalid", { weekend: [6, 7], holidays: [], timeZone: "UTC" }) // ""
 * @example previousBusinessDay("2024-07-05", { weekend: [6, 7], holidays: [], timeZone: "Invalid/Zone" }) // ""
 */
export function previousBusinessDay(
  value: string,
  calendar: BusinessCalendar,
): string {
  try {
    return neighbourBusinessDayValue(value, -1, calendar);
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
