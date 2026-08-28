import type { Temporal } from "@js-temporal/polyfill";
import { parseCalendarDatePairForArithmetic } from "../../internal";
import type { DateDurationUnit, RoundingOptions } from "../../types";
import { isValidCalendarDate, isValidDateDurationUnit } from "../validate";
import { getLargestDateDurationUnit } from "./getLargestDateDurationUnit";

/**
 * Return the difference between two PlainDate values using the provided `unit`.
 *
 * - Returns `null` for invalid inputs (negative diffs are valid).
 * - Uses Temporal.PlainDate.until and extracts the requested unit.
 * - Accepts GMT calendar-annotated PlainDate strings (as produced by `convertDateToCalendar`) —
 *   E5 (issue #78). When both `date1` and `date2` carry the *same* calendar tag, the difference
 *   is measured in that calendar (a Hebrew leap year is `P12M12D`, not `P1Y`, in month/day
 *   units — see the roadmap's E5 decisions of record, D5). When they carry different tags (or
 *   either is a bare, untagged ISO string), the difference falls back to measuring in Gregorian.
 *
 * `smallestUnit`, `roundingIncrement`, and `roundingMode` control optional rounding of the result,
 * per Temporal's DifferenceOptions — e.g. `{ smallestUnit: "week", roundingMode: "halfExpand" }`
 * rounds the difference to the nearest week before extracting the requested unit.
 * - When `unitArg` is an array, `smallestUnit` must not be coarser than the largest unit in the
 *   array (e.g. `["month", "day"]` with `smallestUnit: "year"`) — this combination is rejected
 *   by Temporal and returns null, same as other invalid input.
 *
 * @param date1 ISO PlainDate string for the start, optionally calendar-annotated
 * @param date2 ISO PlainDate string for the end, optionally calendar-annotated
 * @param unitArg DateDurationUnit | DateDurationUnit[] to measure the difference
 * @param options optional: smallestUnit, roundingIncrement, roundingMode (Temporal.DifferenceOptions rounding controls)
 * @returns numeric difference in the requested unit, or null on invalid input
 *
 * @example diffDate("2024-03-10", "2024-03-15", "day") // 5
 * @example diffDate("invalid", "2024-03-15", "day") // null
 * @example diffDate("2024-01-01", "2024-01-16", "week", { smallestUnit: "week", roundingMode: "halfExpand" }) // 2
 * @example diffDate("5784-06-15[u-ca=hebrew]", "5784-07-15[u-ca=hebrew]", "months") // 1 (measured in Hebrew, Adar I -> Adar)
 */
export function diffDate(
  date1: string,
  date2: string,
  unitArg: DateDurationUnit | DateDurationUnit[],
  options?: RoundingOptions<Temporal.DateUnit>,
): number | Record<DateDurationUnit, number> | null {
  const validDates = isValidCalendarDate(date1) && isValidCalendarDate(date2);
  const isSingleUnit = !Array.isArray(unitArg);
  const validUnits = isSingleUnit
    ? isValidDateDurationUnit(unitArg)
    : (unitArg as DateDurationUnit[]).every(isValidDateDurationUnit);

  if (!validDates || !validUnits) {
    return null;
  }

  try {
    const { a: d1, b: d2 } = parseCalendarDatePairForArithmetic(date1, date2);

    const duration = d1.until(d2, {
      largestUnit: isSingleUnit
        ? unitArg
        : getLargestDateDurationUnit(unitArg as DateDurationUnit[]),
      smallestUnit: options?.smallestUnit,
      roundingIncrement: options?.roundingIncrement,
      roundingMode: options?.roundingMode,
    });

    // craft record for units passed
    if (isSingleUnit) {
      return duration[unitArg as DateDurationUnit] ?? 0;
    }

    return (unitArg as DateDurationUnit[]).reduce(
      (result, unit) => {
        result[unit] = duration[unit] ?? 0;
        return result;
      },
      {} as Record<DateDurationUnit, number>,
    );
  } catch {
    return null;
  }
}
