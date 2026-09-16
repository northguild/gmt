import { Temporal } from "@js-temporal/polyfill";
import { isBusinessDate, resolveBusinessCalendar } from "../../internal";
import type { BusinessCalendar } from "../../types";
import { isValidDate } from "../validate";

/**
 * Return true when `value` is a working day in `calendar`.
 *
 * - `calendar` names the weekend days and holidays that make a date non-working. Omit it and
 *   GMT keeps its original fixed Monday–Friday week with no holidays.
 * - **Pass a calendar anywhere the weekend is not Saturday–Sunday.** Much of the Middle East
 *   is Friday–Saturday and some markets keep a one-day weekend; the no-calendar form assumes
 *   Saturday–Sunday and is wrong for them.
 * - `value` and `calendar.holidays` are local dates. `calendar.timeZone` is not read: it
 *   records which locality the calendar describes, so that a caller holding an *instant* knows
 *   which zone to reduce it in — with `floorToZone` or `getZonedDateTimeFields` — before
 *   asking this question.
 * - Returns false if `value` is not a valid ISO PlainDate, or `calendar` is not a valid
 *   `BusinessCalendar`. Narrow a calendar first with `isValidBusinessCalendar` to tell a
 *   misconfigured calendar apart from a genuine non-working day.
 *
 * This is the locale-agnostic complement to the locale-aware `isWeekend`: `isWeekend` resolves
 * weekend days per locale via `Intl.Locale.prototype.weekInfo`, whereas `isBusinessDay` uses
 * the weekend the caller states, or Monday–Friday when they state none.
 *
 * @param value ISO PlainDate string
 * @param calendar optional BusinessCalendar; defaults to Monday–Friday with no holidays
 * @returns true if `value` is a working day, false on invalid input
 *
 * @example isBusinessDay("2024-02-05") // true (Monday)
 * @example isBusinessDay("2024-02-10") // false (Saturday)
 * @example isBusinessDay("2024-07-04", { weekend: [6, 7], holidays: ["2024-07-04"], timeZone: "America/New_York" }) // false (holiday)
 * @example isBusinessDay("2024-07-05", { weekend: [6, 7], holidays: ["2024-07-04"], timeZone: "America/New_York" }) // true
 * @example isBusinessDay("2024-07-07", { weekend: [5, 6], holidays: [], timeZone: "Asia/Riyadh" }) // true (Sunday is a working day there)
 * @example isBusinessDay("2024-07-05", { weekend: [5, 6], holidays: [], timeZone: "Asia/Riyadh" }) // false (Friday is weekend there)
 * @example isBusinessDay("invalid") // false
 * @example isBusinessDay("2024-02-05", { weekend: [6, 7], holidays: [], timeZone: "Invalid/Zone" }) // false (bad calendar)
 */
export function isBusinessDay(
  value: string,
  calendar?: BusinessCalendar,
): boolean {
  const resolved = resolveBusinessCalendar(calendar);

  if (!isValidDate(value) || resolved === null) return false;

  try {
    return isBusinessDate(Temporal.PlainDate.from(value), resolved);
  } catch {
    return false;
  }
}
