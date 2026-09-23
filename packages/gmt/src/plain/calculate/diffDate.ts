import type { Temporal } from "@js-temporal/polyfill";
import {
  parseCalendarDatePairForArithmetic,
  plainDateAdd,
  plainDateUntil,
} from "../../internal";
import { differenceRecord } from "../../internal/differenceRecord";
import { resolveDurationUnit } from "../../internal/resolveDurationUnit";
import type { DateDurationUnit, RoundingOptions } from "../../types";
import { isValidCalendarDate, isValidDateDurationUnit } from "../validate";
import { getLargestDateDurationUnit } from "./getLargestDateDurationUnit";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return the difference between two PlainDate values using the provided `unit`.
 *
 * - Returns `null` for invalid inputs (negative diffs are valid).
 * - Uses Temporal's `until` semantics (TC39 CalendarDateUntil; for non-ISO calendars the Intl
 *   era/monthCode proposal's NonISODateUntil, e.g. Buddhist Aug 31 to Sep 30 is 30 days, not a
 *   month) and extracts the requested unit.
 * - Accepts RFC 9557 calendar-annotated PlainDate strings (as `convertDateToCalendar` writes them).
 *   When `date1` and `date2` name the *same* calendar, the difference is measured in that
 *   calendar (a Hebrew leap year has 13 months). When they name different calendars (a bare ISO
 *   string names `iso8601`), the result is `null`, as TC39 `DifferenceTemporalPlainDate` throws
 *   when `CalendarEquals` is false.
 * - Compatibility: before 1.16.0 two different calendars were measured in ISO. To get that value,
 *   convert both to one calendar first: `convertDateToCalendar(date, "iso8601")`.
 *
 * `smallestUnit`, `roundingIncrement`, and `roundingMode` control optional rounding of the result,
 * per Temporal's DifferenceOptions — e.g. `{ smallestUnit: "week", roundingMode: "halfExpand" }`
 * rounds the difference to the nearest week before extracting the requested unit.
 * - When `unitArg` is an array, `smallestUnit` must not be coarser than the largest unit in the
 *   array (e.g. `["months", "days"]` with `smallestUnit: "year"`) — this combination is rejected
 *   by Temporal and returns null, same as other invalid input.
 * - With an array of units, the record is the whole difference: the largest listed unit is
 *   Temporal's `largestUnit`, and the amount of each unlisted unit between two listed units is
 *   carried into the next smaller listed unit, measured from the start moved by the larger listed
 *   amounts (so adding the record to the start reaches the end). Units smaller than the smallest
 *   listed unit are truncated, as for a single unit. For example, `["years", "days"]` over
 *   1 year 59 days returns `{ years: 1, days: 59 }`.
 * - Compatibility: since 1.16.0 calendar strings are RFC 9557 (ISO digits, `[u-ca=<id>]`, canonical
 *   calendar ids); see `isValidCalendarDate`.
 *
 * @param date1 ISO PlainDate string for the start, optionally calendar-annotated
 * @param date2 ISO PlainDate string for the end, optionally calendar-annotated
 * @param unitArg date unit or units to measure the difference, singular or plural (`"day"` or
 *   `"days"`); a record result keeps the plural keys
 * @param options optional: smallestUnit, roundingIncrement, roundingMode (Temporal.DifferenceOptions rounding controls); a non-object value (such as `null`) is invalid
 * @returns numeric difference in the requested unit, or null on invalid input
 *
 * @example diffDate("2024-03-10", "2024-03-15", "days") // 5
 * @example diffDate("2024-01-01", "2024-01-08", ["week", "day"]) // { weeks: 1, days: 0 } (singular names, plural keys)
 * @example diffDate("invalid", "2024-03-15", "days") // null
 * @example diffDate("2024-01-01", "2024-01-16", "weeks", { smallestUnit: "week", roundingMode: "halfExpand" }) // 2
 * @example diffDate("2024-02-24[u-ca=hebrew]", "2024-03-25[u-ca=hebrew]", "months") // 1 (measured in Hebrew, 15 Adar I -> 15 Adar II)
 * @example diffDate("2023-08-31[u-ca=buddhist]", "2023-09-30[u-ca=buddhist]", "months") // 0 (30 days, not a month)
 * @example diffDate("2024-10-03[u-ca=hebrew]", "2024-11-03", "days") // null (different calendars)
 * @example diffDate("2024-01-01", "2025-03-01", ["years", "days"]) // { years: 1, days: 59 } (P1Y2M; the 2 months are carried into days)
 */
export function diffDate(
  date1: string,
  date2: string,
  unitArg:
    | DateDurationUnit
    | Temporal.DateUnit
    | Array<DateDurationUnit | Temporal.DateUnit>,
  options?: RoundingOptions<Temporal.DateUnit>,
): number | Record<DateDurationUnit, number> | null {
  try {
    // Temporal GetOptionsObject: options are an object or omitted; null and primitives are invalid.
    if (!isOptionsArgument(options)) {
      return null;
    }
    const validDates = isValidCalendarDate(date1) && isValidCalendarDate(date2);
    // Singular names resolve to their plural (Temporal §13.17); record keys are the plural names.
    const resolved = Array.isArray(unitArg)
      ? unitArg.map((unit) => resolveDurationUnit(unit))
      : resolveDurationUnit(unitArg);
    const isSingleUnit = !Array.isArray(resolved);
    const validUnits = isSingleUnit
      ? isValidDateDurationUnit(resolved)
      : resolved.every(isValidDateDurationUnit);

    if (!validDates || !validUnits) {
      return null;
    }

    try {
      // An empty units list names no largest unit, so there is nothing to measure.
      const largestUnit = isSingleUnit
        ? (resolved as DateDurationUnit)
        : getLargestDateDurationUnit(resolved as DateDurationUnit[]);
      if (largestUnit === "") return null;

      const { a: d1, b: d2 } = parseCalendarDatePairForArithmetic(date1, date2);

      const duration = plainDateUntil(d1, d2, largestUnit, options);

      // craft record for units passed
      if (isSingleUnit) {
        return duration[resolved as DateDurationUnit] ?? 0;
      }

      // An unlisted unit between two listed units is carried into the next smaller listed unit.
      return differenceRecord(d1, duration, resolved as DateDurationUnit[], {
        add: (from, amount) => plainDateAdd(from, amount),
        until: (from, to, unit) => plainDateUntil(from, to, unit),
      });
    } catch {
      return null;
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return null;
  }
}
