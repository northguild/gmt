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
 * Return a PlainDate ISO string with `amount` added according to `units`.
 *
 * - Validates `value`, `units`, and `amount` before performing the add.
 * - Accepts a GMT calendar-annotated PlainDate string (as produced by `convertDateToCalendar`,
 *   e.g. `"5784-06-15[u-ca=hebrew]"`), not just a bare ISO string — E5 (issue #78). Calendar-unit
 *   arithmetic ("add 1 month") resolves against that calendar (a Hebrew leap month, a Persian
 *   leap year), and the result is re-formatted in the same calendar — re-derived from the
 *   arithmetic result, never copied from the input tag, since arithmetic can cross a leap-month
 *   or era boundary (e.g. Adar I -> Adar). A bare ISO string is unaffected — always treated as,
 *   and always returns, `"gregorian"`.
 * - Returns "" for invalid inputs.
 *
 * `overflow` ("constrain" (default) | "reject") controls out-of-range results, e.g. adding 1 month
 * to Jan 31: "constrain" clamps to Feb 29/28, "reject" throws (resulting in ""). Whether `reject`
 * actually throws is calendar-dependent: adding 1 year from Hebrew Adar I (a leap-only month)
 * does NOT throw even with `overflow: "reject"` (Temporal remaps to the non-leap year's Adar
 * instead of rejecting), while adding 1 month from the Ethiopic 30-day 12th month into the
 * 5/6-day Pagumen DOES throw.
 *
 * @param value ISO PlainDate string, optionally calendar-annotated
 * @param units Partial<Record<DateDurationUnit, number>> object specifying units to add
 * @param options optional: overflow ("constrain" | "reject")
 * @returns ISO PlainDate string after addition, or "" on invalid input
 *
 * @example addDate("2024-03-10", { days: 5 }) // "2024-03-15"
 * @example addDate("invalid", { days: 5 }) // ""
 * @example addDate("2024-01-31", { months: 1 }, { overflow: "constrain" }) // "2024-02-29"
 * @example addDate("2024-01-31", { months: 1 }, { overflow: "reject" }) // ""
 * @example addDate("5784-06-15[u-ca=hebrew]", { months: 1 }) // "5784-07-15[u-ca=hebrew]" (Adar I -> Adar, both 30 days)
 */
export function addDate(
  value: string /* ISO 8601 date */,
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
    const result = date.add(units, {
      overflow: resolveOverflow(options?.overflow),
    });
    return formatDateInCalendar(result, calendar);
  } catch {
    return "";
  }
}
