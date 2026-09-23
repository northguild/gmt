// fallow-ignore-file code-duplication -- cross-family Temporal type clone, by design (rule 5)
import { Temporal } from "@js-temporal/polyfill";
import { isValidDateTimeDurationUnit } from "../../plain/validate";
import { isValidUtc } from "../validate/isValidUtc";
import { resolveDurationUnit, tileByUnit } from "../../internal";
import { exceedsPieceLimit, resolveMaxPieces } from "../../internal/maxPieces";
import { minSlicesForSpan } from "../../internal/splitStep";

/**
 * Split a UTC interval into sub-intervals of `amount × unit`.
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
 * - A step that resolves to the same instant as the previous boundary is skipped, so no empty
 *   slice is produced. A step that goes backwards returns `[]`.
 * - Returns `[{ start, end }]` when `start === end` (zero-length interval).
 * - Returns `[]` on invalid input (unparseable start/end, unsupported unit, non-positive amount,
 *   leap-second strings).
 * - `options.maxPieces` (positive safe integer, default `1_000_000`) bounds the output: a split
 *   into more slices returns `[]`, decided from the span before stepping where it can be, and
 *   otherwise as soon as slice `maxPieces + 1` is due. An invalid `maxPieces` also returns `[]`.
 *
 * @param start ISO UTC datetime string for the interval start
 * @param end ISO UTC datetime string for the interval end
 * @param unit duration unit string — any `DateTimeDurationUnit`
 * @param amount positive number of units per step
 * @param options optional: `maxPieces` (positive safe integer, default `1_000_000`)
 * @returns array of `{ start, end }` records, or [] on invalid input
 *
 * @example splitIntervalByUnitUtc("2024-01-01T00:00:00Z", "2024-01-02T00:00:00Z", "hour", 6) // [{ start: "2024-01-01T00:00:00Z", end: "2024-01-01T06:00:00Z" }, { start: "2024-01-01T06:00:00Z", end: "2024-01-01T12:00:00Z" }, { start: "2024-01-01T12:00:00Z", end: "2024-01-01T18:00:00Z" }, { start: "2024-01-01T18:00:00Z", end: "2024-01-02T00:00:00Z" }]
 * @example splitIntervalByUnitUtc("2024-01-01T00:00:00Z", "2024-01-01T01:30:00Z", "hour", 1) // [{ start: "2024-01-01T00:00:00Z", end: "2024-01-01T01:00:00Z" }, { start: "2024-01-01T01:00:00Z", end: "2024-01-01T01:30:00Z" }]
 * @example splitIntervalByUnitUtc("2024-01-01T00:00:00Z", "2024-01-01T00:00:00Z", "hour", 1) // [{ start: "2024-01-01T00:00:00Z", end: "2024-01-01T00:00:00Z" }]
 * @example splitIntervalByUnitUtc("2024-01-01T00:00:00Z", "2024-01-02T00:00:00Z", "hour", 0) // []
 * @example splitIntervalByUnitUtc("invalid", "2024-01-02T00:00:00Z", "hour", 1) // []
 * @example splitIntervalByUnitUtc("2024-01-01T00:00:00Z", "2024-01-01T01:30:00Z", "hour", 1, { maxPieces: 1 }) // [] (2 slices exceed the limit)
 * @example splitIntervalByUnitUtc("2024-01-01T00:00:00Z", "2024-01-01T01:30:00Z", "hour", 1, { maxPieces: 2 }) // [{ start: "2024-01-01T00:00:00Z", end: "2024-01-01T01:00:00Z" }, { start: "2024-01-01T01:00:00Z", end: "2024-01-01T01:30:00Z" }]
 * @example splitIntervalByUnitUtc("+275760-09-12T23:00:00Z", "+275760-09-13T00:00:00Z", "hour", 2) // [{ start: "+275760-09-12T23:00:00Z", end: "+275760-09-13T00:00:00Z" }] (the step past the last instant is trimmed to `end`)
 */
export function splitIntervalByUnitUtc(
  start: string,
  end: string,
  unit: string,
  amount: number,
  options?: { maxPieces?: number },
): Array<{ start: string; end: string }> {
  try {
    if (typeof start !== "string" || typeof end !== "string") {
      return [];
    }

    if (!isValidUtc(start) || !isValidUtc(end)) {
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
      const startInstant = Temporal.Instant.from(start);
      const endInstant = Temporal.Instant.from(end);

      if (Temporal.Instant.compare(startInstant, endInstant) > 0) {
        return [];
      }

      if (Temporal.Instant.compare(startInstant, endInstant) === 0) {
        return [{ start: startInstant.toString(), end: endInstant.toString() }];
      }

      const spanNs = Number(
        endInstant.epochNanoseconds - startInstant.epochNanoseconds,
      );

      if (
        exceedsPieceLimit(
          minSlicesForSpan(spanNs, resolvedUnit, amount, false),
          maxPieces,
        )
      ) {
        return [];
      }

      const slices = tileByUnit(
        startInstant.toZonedDateTimeISO("UTC"),
        endInstant.toZonedDateTimeISO("UTC"),
        Temporal.ZonedDateTime.compare,
        resolvedUnit,
        amount,
        maxPieces,
      );

      return (slices ?? []).map(([sliceStart, sliceEnd]) => ({
        start: sliceStart.toInstant().toString(),
        end: sliceEnd.toInstant().toString(),
      }));
    } catch {
      return [];
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return [];
  }
}
