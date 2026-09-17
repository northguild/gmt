import { neighbourBusinessDayValue } from "../../internal/businessDayValues";
import type { BusinessCalendar } from "../../types";

/**
 * Return the first working day **strictly after** `value`.
 *
 * - Strictly after: called on a working day it returns the next one, never `value` itself.
 *   For the on-or-after behaviour — leave a working day alone, move a non-working one forward
 *   — use `rollDate(value, "following", calendar)`.
 * - Equivalent to `addBusinessDays(value, 1, calendar)` for any valid calendar, but the
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
 * @returns ISO PlainDate string of the next working day, or "" on invalid input
 *
 * @example nextBusinessDay("2024-07-03", { weekend: [6, 7], holidays: ["2024-07-04"], timeZone: "America/New_York" }) // "2024-07-05" — skips the holiday
 * @example nextBusinessDay("2024-07-04", { weekend: [6, 7], holidays: ["2024-07-04"], timeZone: "America/New_York" }) // "2024-07-05" — from the holiday itself
 * @example nextBusinessDay("2024-07-05", { weekend: [6, 7], holidays: [], timeZone: "UTC" }) // "2024-07-08" — Friday over the weekend
 * @example nextBusinessDay("2024-07-04", { weekend: [5, 6], holidays: [], timeZone: "Asia/Riyadh" }) // "2024-07-07" — Friday–Saturday weekend
 * @example nextBusinessDay("invalid", { weekend: [6, 7], holidays: [], timeZone: "UTC" }) // ""
 * @example nextBusinessDay("2024-07-03", { weekend: [6, 7], holidays: [], timeZone: "Invalid/Zone" }) // ""
 */
export function nextBusinessDay(
  value: string,
  calendar: BusinessCalendar,
): string {
  return neighbourBusinessDayValue(value, 1, calendar);
}
