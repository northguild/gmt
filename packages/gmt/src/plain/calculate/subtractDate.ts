import {
  calendarSystemOfDateValue,
  formatDateInCalendar,
  isValidAmount,
  parseCalendarDateValue,
  resolveOverflow,
} from "../../internal";
import type { DateDurationUnit, Overflow } from "../../types";
import { isValidCalendarDate, isValidDateDurationUnit } from "../validate";

/**
 * Return a PlainDate ISO string with `units` subtracted from `value`.
 *
 * - Validates `value`, `units`, and `amount` before performing the subtract.
 * - Accepts a GMT calendar-annotated PlainDate string (as produced by `convertDateToCalendar`),
 *   not just a bare ISO string — E5 (issue #78). See `addDate`'s JSDoc for the full calendar-unit
 *   arithmetic rationale (leap months/years, era transitions, the `overflow` asymmetry); this
 *   function is the mirror image (`.subtract` instead of `.add`).
 * - Returns "" for invalid inputs.
 *
 * `overflow` ("constrain" (default) | "reject") controls out-of-range results, e.g. subtracting
 * 1 month from Mar 31: "constrain" clamps to Feb 29/28, "reject" throws (resulting in "").
 *
 * @param value ISO PlainDate string, optionally calendar-annotated
 * @param units Partial<Record<DateDurationUnit, number>> object specifying units to subtract
 * @param options optional: overflow ("constrain" | "reject")
 * @returns ISO PlainDate string after subtraction, or "" on invalid input
 *
 * @example subtractDate("2024-03-15", { day: 5 }) // "2024-03-10"
 * @example subtractDate("invalid", { day: 5 }) // ""
 * @example subtractDate("2024-03-31", { months: 1 }, { overflow: "reject" }) // ""
 * @example subtractDate("5784-07-15[u-ca=hebrew]", { months: 1 }) // "5784-06-15[u-ca=hebrew]" (Adar -> Adar I)
 */
export function subtractDate(
  value: string,
  units: Partial<Record<DateDurationUnit, number>>,
  options?: { overflow?: Overflow },
): string {
  const validDate = isValidCalendarDate(value);
  const validUnits = Object.keys(units).every(isValidDateDurationUnit);
  const validAmounts = Object.values(units).every(isValidAmount);

  if (!validDate || !validUnits || !validAmounts) {
    return "";
  }

  try {
    const calendar = calendarSystemOfDateValue(value);
    if (!calendar) {
      return "";
    }
    const date = parseCalendarDateValue(value);
    const result = date.subtract(units, {
      overflow: resolveOverflow(options?.overflow),
    });
    return formatDateInCalendar(result, calendar);
  } catch {
    return "";
  }
}
