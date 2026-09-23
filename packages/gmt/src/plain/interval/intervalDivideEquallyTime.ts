// fallow-ignore-file code-duplication -- cross-family Temporal type clone, by design (rule 5)
import { Temporal } from "@js-temporal/polyfill";
import { isValidTimeInterval } from "./validate";
import { divisionBoundary } from "../../internal/divisionBoundary";
import { exceedsPieceLimit, resolveMaxPieces } from "../../internal/maxPieces";

/**
 * Split a time interval into `n` equal-length sub-intervals.
 *
 * - Returns an array of `n` `{ start, end }` records that tile the original interval, each
 *   record's `end` equal to the next record's `start`.
 * - Every piece is half-open `[start, end)`: a boundary belongs only to the piece that starts
 *   there, so the pieces share no value and together cover the interval exactly once (the rule
 *   CORE-6's `splitIntervalAt` uses).
 * - Time units are fixed-length, so each boundary is `start + round((end - start) · i / n)` in
 *   integer nanoseconds, computed in `bigint`: the split is exact whenever the total divides
 *   evenly by `n`, and within half a nanosecond of the exact cut otherwise (an exact half rounds
 *   up).
 * - `n === 1` returns the original interval unchanged, as a single-element array.
 * - A zero-length interval (`start === end`) returns `n` identical zero-length sub-intervals.
 * - Returns `[]` when `n` is not a positive integer, or on invalid input (unparseable
 *   start/end, `start > end`).
 * - `options.maxPieces` (positive safe integer, default `1_000_000`) bounds the output: when `n`
 *   exceeds it, or exceeds the longest possible array (2^32 - 1), the function returns `[]`
 *   before building any piece. An invalid `maxPieces` also returns `[]`.
 *
 * @param start ISO PlainTime string for the interval start
 * @param end ISO PlainTime string for the interval end
 * @param n number of equal sub-intervals to produce (positive integer)
 * @param options optional: `maxPieces` (positive safe integer, default `1_000_000`)
 * @returns array of `n` `{ start, end }` records, or `[]` on invalid input
 *
 * @example intervalDivideEquallyTime("09:00:00", "17:00:00", 4) // [{ start: "09:00:00", end: "11:00:00" }, { start: "11:00:00", end: "13:00:00" }, { start: "13:00:00", end: "15:00:00" }, { start: "15:00:00", end: "17:00:00" }]
 * @example intervalDivideEquallyTime("09:00:00", "17:00:00", 3) // [{ start: "09:00:00", end: "11:40:00" }, { start: "11:40:00", end: "14:20:00" }, { start: "14:20:00", end: "17:00:00" }]
 * @example intervalDivideEquallyTime("09:00:00", "17:00:00", 1) // [{ start: "09:00:00", end: "17:00:00" }]
 * @example intervalDivideEquallyTime("09:00:00", "17:00:00", 0) // []
 * @example intervalDivideEquallyTime("invalid", "17:00:00", 3) // []
 * @example intervalDivideEquallyTime("09:00:00", "17:00:00", 3, { maxPieces: 2 }) // [] (3 pieces exceed the limit)
 * @example intervalDivideEquallyTime("09:00:00", "17:00:00", 3, { maxPieces: 3 }) // [{ start: "09:00:00", end: "11:40:00" }, { start: "11:40:00", end: "14:20:00" }, { start: "14:20:00", end: "17:00:00" }]
 */
export function intervalDivideEquallyTime(
  start: string,
  end: string,
  n: number,
  options?: { maxPieces?: number },
): Array<{ start: string; end: string }> {
  try {
    if (typeof n !== "number" || !Number.isInteger(n) || n <= 0) {
      return [];
    }

    const maxPieces = resolveMaxPieces(options);

    if (maxPieces === null || exceedsPieceLimit(n, maxPieces)) {
      return [];
    }

    if (!isValidTimeInterval(start, end)) {
      return [];
    }

    try {
      const startVal = Temporal.PlainTime.from(start);
      const endVal = Temporal.PlainTime.from(end);

      if (startVal.equals(endVal)) {
        return Array.from({ length: n }, () => ({
          start: startVal.toString(),
          end: endVal.toString(),
        }));
      }

      // Under a day of nanoseconds (< 2^53), so the total itself is exact; the quotient is not.
      const totalNs = BigInt(
        startVal
          .until(endVal, { largestUnit: "nanosecond" })
          .total("nanosecond"),
      );

      const boundaries: Temporal.PlainTime[] = [startVal];
      for (let i = 1; i < n; i++) {
        boundaries.push(
          startVal.add({
            nanoseconds: Number(divisionBoundary(totalNs, i, n)),
          }),
        );
      }
      boundaries.push(endVal);

      const result: Array<{ start: string; end: string }> = [];
      for (let i = 0; i < boundaries.length - 1; i++) {
        result.push({
          start: boundaries[i].toString(),
          end: boundaries[i + 1].toString(),
        });
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
