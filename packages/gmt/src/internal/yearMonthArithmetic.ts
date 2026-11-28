import { plainYearMonthOf } from "./inputChecks";
import { readDurationUnits } from "./readDurationUnits";
import { isYearMonthDurationUnit } from "./isYearMonthDurationUnit";
import { yearMonthString } from "./yearMonth";
import { assertMonthsInRange } from "./temporalCompat";

/**
 * AddDurationToYearMonth for `addYearMonth` and `subtractYearMonth`: move a year-month by years
 * and months and write the result, or `""`.
 *
 * `Temporal.PlainYearMonth#add` and `#subtract` run the specification's steps, which start from
 * day 1 of the month (CalendarDateFromFields with `Set fields.[[Day]] to 1`). Day 1 of
 * `-271821-04` is before the date limit, so the lowest year-month throws even for a zero amount.
 *
 * @param value the candidate year-month string
 * @param units the caller's `units` argument
 * @param direction `"add"` or `"subtract"`
 * @returns the canonical year-month string, or `""` on any invalid input
 *
 * @example moveYearMonth("2026-10", { months: 1 }, "add") // "2026-11"
 * @example moveYearMonth("2026-10", { days: 1 }, "add") // ""
 */
export function moveYearMonth(
  value: unknown,
  units: unknown,
  direction: "add" | "subtract",
): string {
  try {
    const yearMonth = plainYearMonthOf(value);
    const amounts = readDurationUnits(units, isYearMonthDurationUnit);
    if (yearMonth === null || amounts === null) {
      return "";
    }
    assertMonthsInRange(amounts.months); // D9
    const moved =
      direction === "add"
        ? yearMonth.add(amounts)
        : yearMonth.subtract(amounts);
    return yearMonthString(moved);
  } catch {
    return "";
  }
}
