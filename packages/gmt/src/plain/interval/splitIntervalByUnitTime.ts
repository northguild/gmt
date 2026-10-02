// fallow-ignore-file code-duplication -- cross-family Temporal type clone, by design (rule 5)
import { Temporal } from "@js-temporal/polyfill";
import { isValidTime, isValidTimeDurationUnit } from "../validate";
import { resolveDurationUnit } from "../../internal";
import { exceedsPieceLimit, resolveMaxPieces } from "../../internal/maxPieces";
import {
  isExactDurationUnit,
  minSlicesForSpan,
} from "../../internal/splitStep";

/**
 * Split a time interval into sub-intervals of `amount × unit`.
 *
 * - Returns an array of `{ start, end }` records that tile the interval, each record's `end`
 *   equal to the next record's `start`.
 * - Every piece is half-open `[start, end)`: a boundary belongs only to the piece that starts
 *   there, so the pieces share no value and together cover the interval exactly once (the rule
 *   CORE-6's `splitIntervalAt` uses).
 * - The final sub-interval is trimmed so its `end` never exceeds the original `end`.
 * - Boundaries lie on the one day between `start` and `end`: `PlainTime` arithmetic wraps at
 *   midnight, but a step that reaches or passes midnight is past `end`, so that slice is trimmed
 *   to `end` (`"12:00"` to `"23:00"` by 12 hours is one slice).
 * - Returns `[{ start, end }]` when `start === end` (zero-length interval).
 * - Returns `[]` on invalid input (unparseable start/end, unsupported unit, non-positive amount,
 *   or a unit that has no effect on `PlainTime`, e.g. `"days"`).
 *
 * @param start ISO PlainTime string for the interval start
 * @param end ISO PlainTime string for the interval end
 * @param unit duration unit string — `"hours" | "minutes" | "seconds" | "milliseconds" | "microseconds" | "nanoseconds"` (calendar units are ignored by PlainTime and return [])
 * @param amount positive number of units per step
 * @param options The limit on the size of the result
 * @returns array of `{ start, end }` records, or [] on invalid input
 *
 * @example splitIntervalByUnitTime("12:00:00", "14:00:00", "hour", 1) // [{ start: "12:00:00", end: "13:00:00" }, { start: "13:00:00", end: "14:00:00" }]
 * @example splitIntervalByUnitTime("12:00:00", "14:30:00", "hour", 1) // [{ start: "12:00:00", end: "13:00:00" }, { start: "13:00:00", end: "14:00:00" }, { start: "14:00:00", end: "14:30:00" }]
 * @example splitIntervalByUnitTime("20:00:00", "23:00:00", "hour", 5) // [{ start: "20:00:00", end: "23:00:00" }] (20:00 + 5 hours is past midnight)
 * @example splitIntervalByUnitTime("12:00:00", "12:00:00", "hour", 1) // [{ start: "12:00:00", end: "12:00:00" }]
 * @example splitIntervalByUnitTime("12:00:00", "14:00:00", "hour", 0) // []
 * @example splitIntervalByUnitTime("invalid", "14:00:00", "hour", 1) // []
 * @example splitIntervalByUnitTime("12:00:00", "14:30:00", "hour", 1, { maxPieces: 2 }) // [] (3 slices exceed the limit)
 * @example splitIntervalByUnitTime("12:00:00", "14:30:00", "hour", 1, { maxPieces: 3 }) // [{ start: "12:00:00", end: "13:00:00" }, { start: "13:00:00", end: "14:00:00" }, { start: "14:00:00", end: "14:30:00" }]
 */
export function splitIntervalByUnitTime(
  start: string,
  end: string,
  unit: string,
  amount: number,
  options?: {
    /**
     * The most slices the result may hold. A split into more returns `[]`, decided from the
     * span before stepping. A value that is not a positive safe integer also returns `[]`.
     *
     * @defaultValue `1_000_000`
     */
    maxPieces?: number;
  },
): Array<{
  /**
   * The clock time the interval begins at, as an ISO 8601 time string with no date, offset or time
   * zone.
   */
  start: string;
  /**
   * The first clock time after the interval, in the same format as `start`. It is exclusive: the
   * interval holds everything from `start` up to but not including this value. It can equal
   * `start`, which makes the interval empty.
   */
  end: string;
}> {
  try {
    if (typeof start !== "string" || typeof end !== "string") {
      return [];
    }

    if (!isValidTime(start) || !isValidTime(end)) {
      return [];
    }

    if (typeof unit !== "string") {
      return [];
    }

    const resolvedUnit = resolveDurationUnit(unit);

    // An unknown unit is invalid whatever the span, a zero-length one included.
    if (!isValidTimeDurationUnit(resolvedUnit)) {
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
      const startVal = Temporal.PlainTime.from(start);
      const endVal = Temporal.PlainTime.from(end);

      if (Temporal.PlainTime.compare(startVal, endVal) > 0) {
        return [];
      }

      if (Temporal.PlainTime.compare(startVal, endVal) === 0) {
        return [{ start: startVal.toString(), end: endVal.toString() }];
      }

      // PlainTime.add ignores calendar units, so no step would advance.
      if (!isExactDurationUnit(resolvedUnit)) {
        return [];
      }

      const spanNs = startVal.until(endVal).total("nanoseconds");
      const stepNs = Temporal.Duration.from({ [resolvedUnit]: amount }).total(
        "nanoseconds",
      );

      if (
        exceedsPieceLimit(
          minSlicesForSpan(spanNs, resolvedUnit, amount, false),
          maxPieces,
        )
      ) {
        return [];
      }

      const result: Array<{ start: string; end: string }> = [];

      // Progress is measured in elapsed nanoseconds, not by comparing times: PlainTime.add wraps at
      // midnight, and a step that reaches or passes midnight is past `end`, so it ends the split.
      for (
        let elapsedNs = stepNs, current = startVal;
        elapsedNs - stepNs < spanNs;
        elapsedNs += stepNs
      ) {
        const sliceEnd =
          elapsedNs >= spanNs
            ? endVal
            : current.add({ [resolvedUnit]: amount });

        if (result.length === maxPieces) {
          return [];
        }

        result.push({
          start: current.toString(),
          end: sliceEnd.toString(),
        });

        current = sliceEnd;
      }

      return result;
    } catch {
      return [];
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return [];
  }
}
