import { Temporal } from "@js-temporal/polyfill";
import {
  isValidAmount,
  resolveBusinessCalendar,
  stepBusinessDates,
} from "../../internal";
import type { BusinessCalendar } from "../../types";
import { isValidDate } from "../validate";

/**
 * Return a PlainDate ISO string with `amount` working days subtracted from `value`.
 *
 * - `calendar` names the weekend days and holidays to skip. Omit it and GMT keeps its original
 *   fixed Monday–Friday week with no holidays. Pass one anywhere the weekend is not
 *   Saturday–Sunday — much of the Middle East is Friday–Saturday.
 * - Negative `amount` behaves identically to `addBusinessDays(value, Math.abs(amount), cal)`.
 * - `amount` of 0 returns `value` unchanged — including when `value` is not itself a working
 *   day. Use `rollDate` to move a non-working day onto one.
 * - `value` is never counted, so subtracting 1 from a holiday lands on the working day before
 *   it.
 * - `value` and `calendar.holidays` are local dates; `calendar.timeZone` is not read. A caller
 *   holding an instant reduces it to a local date first, with `floorToZone`.
 * - Returns "" on invalid input — including a fractional `amount`, which names no whole
 *   number of working days — on an invalid `calendar`, and when the walk runs past
 *   200,000 calendar days (about 547 years) without finishing.
 *
 * @param value ISO PlainDate string
 * @param amount whole number of working days to subtract; negative walks forwards
 * @param calendar optional BusinessCalendar; defaults to Monday–Friday with no holidays
 * @returns ISO PlainDate string after subtracting working days, or "" on invalid input
 *
 * @example subtractBusinessDays("2024-03-18", 1) // "2024-03-15" (Monday back to Friday)
 * @example subtractBusinessDays("2024-03-17", 1) // "2024-03-15" (from a Sunday)
 * @example subtractBusinessDays("2024-03-18", 0) // "2024-03-18"
 * @example subtractBusinessDays("2024-07-05", 1, { weekend: [6, 7], holidays: ["2024-07-04"], timeZone: "America/New_York" }) // "2024-07-03" (skips the holiday)
 * @example subtractBusinessDays("2024-07-05", -1, { weekend: [6, 7], holidays: [], timeZone: "America/New_York" }) // "2024-07-08"
 * @example subtractBusinessDays("2024-07-07", 1, { weekend: [5, 6], holidays: [], timeZone: "Asia/Riyadh" }) // "2024-07-04" (Friday–Saturday weekend)
 * @example subtractBusinessDays("invalid", 1) // ""
 * @example subtractBusinessDays("2024-03-18", 1, { weekend: [6, 7], holidays: [], timeZone: "Invalid/Zone" }) // "" (bad calendar)
 */
export function subtractBusinessDays(
  value: string,
  amount: number,
  calendar?: BusinessCalendar,
): string {
  const resolved = resolveBusinessCalendar(calendar);

  if (
    !isValidDate(value) ||
    !isValidAmount(amount) ||
    !Number.isInteger(amount) ||
    resolved === null
  ) {
    return "";
  }

  if (amount === 0) {
    return value;
  }

  try {
    const date = Temporal.PlainDate.from(value);
    const direction = amount > 0 ? -1 : 1;
    const result = stepBusinessDates(
      date,
      direction,
      Math.abs(amount),
      resolved,
    );

    return result === null ? "" : result.toString();
  } catch {
    return "";
  }
}
