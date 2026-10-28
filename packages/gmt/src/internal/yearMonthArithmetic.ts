import { Temporal } from "./temporal";
import { plainYearMonthOf } from "./inputChecks";
import { readDurationUnits } from "./readDurationUnits";
import { isYearMonthDurationUnit } from "./isYearMonthDurationUnit";
import { yearMonthString } from "./yearMonth";

/**
 * AddDurationToYearMonth for `addYearMonth` and `subtractYearMonth`: move a year-month by years
 * and months and write the result, or `""`.
 *
 * It runs the specification's steps on a `PlainDate` at day 1 (CalendarDateFromFields with
 * `Set fields.[[Day]] to 1`), because polyfill 0.5.1's `PlainYearMonth#add` and `#subtract`
 * predate tc39 `41faca474a` (record Y). Day 1 of `-271821-04` is before the date limit, so the
 * lowest year-month throws, as in the specification, even for a zero amount.
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
    const start = Temporal.PlainDate.from({
      year: yearMonth.year,
      month: yearMonth.month,
      day: 1,
    });
    const moved =
      direction === "add" ? start.add(amounts) : start.subtract(amounts);
    return yearMonthString(moved.toPlainYearMonth());
  } catch {
    return "";
  }
}
