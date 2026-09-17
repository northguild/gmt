// fallow-ignore-file code-duplication -- cross-family Temporal type clone, by design (rule 5)
import { Temporal } from "@js-temporal/polyfill";
import { isValidDateTime, isValidDateTimeDurationUnit } from "../validate";
import { resolveDurationUnit, tileByUnit } from "../../internal";
import { exceedsPieceLimit, resolveMaxPieces } from "../../internal/maxPieces";
import { minSlicesForSpan } from "../../internal/splitStep";

/**
 * Split a date-time interval into sub-intervals of `amount × unit`.
 *
 * - Returns an array of `{ start, end }` records that tile the interval, each record's `end`
 *   equal to the next record's `start`.
 * - Every piece is half-open `[start, end)`: a boundary belongs only to the piece that starts
 *   there, so the pieces share no value and together cover the interval exactly once (the rule
 *   CORE-6's `splitIntervalAt` uses).
 * - The final sub-interval is trimmed so its `end` never exceeds the original `end`.
 * - Calendar-unit boundaries (years, months, weeks, days) are computed from `start`
 *   (`start + k × amount`, as Temporal and Luxon's `Interval.splitBy` do), so month-end starts
 *   don't drift: a monthly split from January 31 lands on February 29, March 31, April 30.
 * - Exact-unit boundaries (hours and smaller) step from the previous boundary. Exact units never
 *   clamp, and stepping keeps nanosecond precision where `k × amount` would pass
 *   `Number.MAX_SAFE_INTEGER`.
 * - A step that resolves to the same value as the previous boundary is skipped, so no empty
 *   slice is produced. A step that goes backwards returns `[]`.
 * - Returns `[{ start, end }]` when `start === end` (zero-length interval).
 * - Returns `[]` on invalid input (unparseable start/end, unsupported unit, non-positive amount).
 * - `options.maxPieces` (positive safe integer, default `1_000_000`) bounds the output: a split
 *   into more slices returns `[]`, decided from the span before stepping where it can be, and
 *   otherwise as soon as slice `maxPieces + 1` is due. An invalid `maxPieces` also returns `[]`.
 *
 * @param start ISO PlainDateTime string for the interval start
 * @param end ISO PlainDateTime string for the interval end
 * @param unit duration unit string — any `DateTimeDurationUnit`
 * @param amount positive number of units per step
 * @param options optional: `maxPieces` (positive safe integer, default `1_000_000`)
 * @returns array of `{ start, end }` records, or [] on invalid input
 *
 * @example splitIntervalByUnitDateTime("2024-01-01T12:00:00", "2024-01-01T14:00:00", "hour", 1) // [{ start: "2024-01-01T12:00:00", end: "2024-01-01T13:00:00" }, { start: "2024-01-01T13:00:00", end: "2024-01-01T14:00:00" }]
 * @example splitIntervalByUnitDateTime("2024-01-01T12:00:00", "2024-01-01T14:30:00", "hour", 1) // [{ start: "2024-01-01T12:00:00", end: "2024-01-01T13:00:00" }, { start: "2024-01-01T13:00:00", end: "2024-01-01T14:00:00" }, { start: "2024-01-01T14:00:00", end: "2024-01-01T14:30:00" }]
 * @example splitIntervalByUnitDateTime("2024-01-01T12:00:00", "2024-01-01T12:00:00", "hour", 1) // [{ start: "2024-01-01T12:00:00", end: "2024-01-01T12:00:00" }]
 * @example splitIntervalByUnitDateTime("2024-01-01T12:00:00", "2024-01-01T14:00:00", "hour", 0) // []
 * @example splitIntervalByUnitDateTime("invalid", "2024-01-01T14:00:00", "hour", 1) // []
 * @example splitIntervalByUnitDateTime("2024-01-01T12:00:00", "2024-01-01T14:00:00", "hour", 1, { maxPieces: 1 }) // [] (2 slices exceed the limit)
 * @example splitIntervalByUnitDateTime("2024-01-01T12:00:00", "2024-01-01T14:00:00", "hour", 1, { maxPieces: 2 }) // [{ start: "2024-01-01T12:00:00", end: "2024-01-01T13:00:00" }, { start: "2024-01-01T13:00:00", end: "2024-01-01T14:00:00" }]
 */
export function splitIntervalByUnitDateTime(
  start: string,
  end: string,
  unit: string,
  amount: number,
  options?: { maxPieces?: number },
): Array<{ start: string; end: string }> {
  if (typeof start !== "string" || typeof end !== "string") {
    return [];
  }

  if (!isValidDateTime(start) || !isValidDateTime(end)) {
    return [];
  }

  if (typeof unit !== "string") {
    return [];
  }

  const resolvedUnit = resolveDurationUnit(unit);

  // An unknown unit is invalid whatever the span, a zero-length one included.
  if (!isValidDateTimeDurationUnit(resolvedUnit)) {
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
    const startVal = Temporal.PlainDateTime.from(start);
    const endVal = Temporal.PlainDateTime.from(end);

    if (Temporal.PlainDateTime.compare(startVal, endVal) > 0) {
      return [];
    }

    if (Temporal.PlainDateTime.compare(startVal, endVal) === 0) {
      return [{ start: startVal.toString(), end: endVal.toString() }];
    }

    const spanNs = startVal
      .until(endVal, { largestUnit: "hours" })
      .total("nanoseconds");

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
      Temporal.PlainDateTime.compare,
      resolvedUnit,
      amount,
      maxPieces,
    );

    return (slices ?? []).map(([sliceStart, sliceEnd]) => ({
      start: sliceStart.toString(),
      end: sliceEnd.toString(),
    }));
  } catch {
    return [];
  }
}
