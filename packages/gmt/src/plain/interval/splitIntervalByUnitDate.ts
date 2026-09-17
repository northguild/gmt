import { Temporal } from "@js-temporal/polyfill";
import {
  formatDateInCalendar,
  NANOSECONDS_PER_DAY_NUMBER,
  parseCalendarDatePairForArithmetic,
  plainDateAdd,
  resolveDurationUnit,
  tileByUnit,
} from "../../internal";
import { isValidCalendarDate } from "../validate";
import { exceedsPieceLimit, resolveMaxPieces } from "../../internal/maxPieces";
import { minSlicesForSpan } from "../../internal/splitStep";

/**
 * Split a date interval into sub-intervals of `amount × unit`.
 *
 * - Returns an array of `{ start, end }` records that tile the interval, each record's `end`
 *   equal to the next record's `start`.
 * - The final sub-interval is trimmed so its `end` never exceeds the original `end`.
 * - Each boundary is computed from `start` (`start + k × amount`, as Temporal and Luxon's
 *   `Interval.splitBy` do), not by stepping from the previous boundary, so month-end starts
 *   don't drift: a monthly split from January 31 lands on February 29, March 31, April 30.
 * - A step that resolves to the same date as the previous boundary is skipped, so no empty
 *   slice is produced. A step that goes backwards returns `[]`.
 * - Returns `[{ start, end }]` when `start === end` (zero-length interval).
 * - Returns `[]` on invalid input (unparseable start/end, unsupported unit, non-positive amount,
 *   or a unit that has no effect on `PlainDate`, e.g. `"hours"`).
 * - Accepts GMT calendar-annotated PlainDate strings — E5 (issue #78). When `start` and `end`
 *   carry the *same* calendar tag, stepping (and each slice's boundaries) happens in that
 *   calendar — a Hebrew leap year splits into 13 month-slices, not 12 (E5 decision of record
 *   D5); otherwise (or if either is bare ISO) it falls back to Gregorian. Each boundary's tag is
 *   re-derived from the actual stepped date, never copied — a month-by-month step can cross a
 *   leap-month or era boundary mid-split.
 * - `options.maxPieces` (positive safe integer, default `1_000_000`) bounds the output: a split
 *   into more slices returns `[]`, decided from the span before stepping where it can be, and
 *   otherwise as soon as slice `maxPieces + 1` is due. An invalid `maxPieces` also returns `[]`.
 * - Compatibility: since 1.16.0 a calendar annotation must be a GMT `CalendarSystem` id
 *   (`[u-ca=gregory]` is now invalid input); use the GMT id — see `isValidCalendarDate`.
 *
 * @param start ISO PlainDate string for the interval start, optionally calendar-annotated
 * @param end ISO PlainDate string for the interval end, optionally calendar-annotated
 * @param unit duration unit string — `"years" | "months" | "weeks" | "days"` (time units are ignored by PlainDate and return [])
 * @param amount positive number of units per step
 * @param options optional: `maxPieces` (positive safe integer, default `1_000_000`)
 * @returns array of `{ start, end }` records, or [] on invalid input
 *
 * @example splitIntervalByUnitDate("2024-01-01", "2024-01-10", "day", 2) // [{ start: "2024-01-01", end: "2024-01-03" }, { start: "2024-01-03", end: "2024-01-05" }, { start: "2024-01-05", end: "2024-01-07" }, { start: "2024-01-07", end: "2024-01-09" }, { start: "2024-01-09", end: "2024-01-10" }]
 * @example splitIntervalByUnitDate("2024-01-01", "2024-01-09", "day", 2) // [{ start: "2024-01-01", end: "2024-01-03" }, { start: "2024-01-03", end: "2024-01-05" }, { start: "2024-01-05", end: "2024-01-07" }, { start: "2024-01-07", end: "2024-01-09" }]
 * @example splitIntervalByUnitDate("2024-01-01", "2024-01-01", "day", 2) // [{ start: "2024-01-01", end: "2024-01-01" }]
 * @example splitIntervalByUnitDate("2024-01-01", "2024-01-10", "day", 0) // []
 * @example splitIntervalByUnitDate("invalid", "2024-01-10", "day", 2) // []
 * @example splitIntervalByUnitDate("5784-01-01[u-ca=hebrew]", "5785-01-01[u-ca=hebrew]", "month", 1) // 13 slices, tiling the Hebrew leap year (including Adar I)
 * @example splitIntervalByUnitDate("2024-01-01", "2024-01-10", "day", 2, { maxPieces: 4 }) // [] (5 slices exceed the limit)
 * @example splitIntervalByUnitDate("2024-01-01", "2024-01-10", "day", 2, { maxPieces: 5 }) // [{ start: "2024-01-01", end: "2024-01-03" }, { start: "2024-01-03", end: "2024-01-05" }, { start: "2024-01-05", end: "2024-01-07" }, { start: "2024-01-07", end: "2024-01-09" }, { start: "2024-01-09", end: "2024-01-10" }]
 */
export function splitIntervalByUnitDate(
  start: string,
  end: string,
  unit: string,
  amount: number,
  options?: { maxPieces?: number },
): Array<{ start: string; end: string }> {
  if (typeof start !== "string" || typeof end !== "string") {
    return [];
  }

  if (!isValidCalendarDate(start) || !isValidCalendarDate(end)) {
    return [];
  }

  if (typeof unit !== "string") {
    return [];
  }

  const resolvedUnit = resolveDurationUnit(unit);

  if (!resolvedUnit) {
    return [];
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return [];
  }

  const maxPieces = resolveMaxPieces(options);

  if (maxPieces === null) {
    return [];
  }

  try {
    const {
      calendar,
      a: startVal,
      b: endVal,
    } = parseCalendarDatePairForArithmetic(start, end);

    if (Temporal.PlainDate.compare(startVal, endVal) > 0) {
      return [];
    }

    if (Temporal.PlainDate.compare(startVal, endVal) === 0) {
      return [
        {
          start: formatDateInCalendar(startVal, calendar),
          end: formatDateInCalendar(endVal, calendar),
        },
      ];
    }

    // Counted on the ISO dates: a day count is calendar-independent, and ISO `until` stays clear
    // of the non-ISO polyfill arithmetic that the compat layer routes around near the range edges.
    const spanNs =
      startVal
        .withCalendar("iso8601")
        .until(endVal.withCalendar("iso8601"), { largestUnit: "days" }).days *
      NANOSECONDS_PER_DAY_NUMBER;

    if (
      exceedsPieceLimit(
        minSlicesForSpan(spanNs, resolvedUnit, amount, false),
        maxPieces,
      )
    ) {
      return [];
    }

    const slices = tileByUnit(
      startVal,
      endVal,
      Temporal.PlainDate.compare,
      resolvedUnit,
      amount,
      maxPieces,
      (value, duration) => plainDateAdd(value, duration, "constrain"),
    );

    return (slices ?? []).map(([sliceStart, sliceEnd]) => ({
      start: formatDateInCalendar(sliceStart, calendar),
      end: formatDateInCalendar(sliceEnd, calendar),
    }));
  } catch {
    return [];
  }
}
