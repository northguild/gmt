import { stepBusinessDaysValue } from "../../internal/businessDayValues";
import type { BusinessCalendar } from "../../types";

/**
 * Return a PlainDate ISO string with `amount` working days added to `value`.
 *
 * - `calendar` names the weekend days and holidays to skip. Omit it and GMT keeps its original
 *   fixed Monday–Friday week with no holidays. Pass one anywhere the weekend is not
 *   Saturday–Sunday — much of the Middle East is Friday–Saturday.
 * - Negative `amount` walks backwards, so `addBusinessDays(value, -3, cal)` and
 *   `subtractBusinessDays(value, 3, cal)` agree.
 * - `amount` of 0 returns `value` unchanged — including when `value` is not itself a working
 *   day. Use `rollDate` to move a non-working day onto one.
 * - `value` is never counted, so adding 1 from a holiday lands on the next working day after
 *   it.
 * - `value` and `calendar.holidays` are local dates; `calendar.timeZone` is not read. A caller
 *   holding an instant reduces it to a local date first, with `floorToZone`.
 * - Returns "" on invalid input — including a fractional `amount`, which names no whole
 *   number of working days — on an invalid `calendar`, and when the walk runs past
 *   200,000 calendar days (about 547 years) without finishing.
 *
 * @param value ISO PlainDate string
 * @param amount whole number of working days to add; negative walks backwards
 * @param calendar optional BusinessCalendar; defaults to Monday–Friday with no holidays
 * @returns ISO PlainDate string after adding working days, or "" on invalid input
 *
 * @example addBusinessDays("2024-03-15", 1) // "2024-03-18" (Friday to Monday)
 * @example addBusinessDays("2024-03-16", 1) // "2024-03-18" (from a Saturday)
 * @example addBusinessDays("2024-03-15", 0) // "2024-03-15"
 * @example addBusinessDays("2024-07-03", 1, { weekend: [6, 7], holidays: ["2024-07-04"], timeZone: "America/New_York" }) // "2024-07-05" (skips the holiday)
 * @example addBusinessDays("2024-07-03", -1, { weekend: [6, 7], holidays: ["2024-07-02"], timeZone: "America/New_York" }) // "2024-07-01"
 * @example addBusinessDays("2024-07-04", 1, { weekend: [5, 6], holidays: [], timeZone: "Asia/Riyadh" }) // "2024-07-07" (Friday–Saturday weekend)
 * @example addBusinessDays("invalid", 1) // ""
 * @example addBusinessDays("2024-03-15", 1, { weekend: [6, 7], holidays: [], timeZone: "Invalid/Zone" }) // "" (bad calendar)
 */
export function addBusinessDays(
  value: string,
  amount: number,
  calendar?: BusinessCalendar,
): string {
  try {
    return stepBusinessDaysValue(value, amount, 1, calendar);
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
