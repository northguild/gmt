import { Temporal } from "@js-temporal/polyfill";
import { isValidDateTimeInterval } from "./validate";
import { divisionBoundary } from "../../internal/divisionBoundary";
import { exceedsPieceLimit, resolveMaxPieces } from "../../internal/maxPieces";

const NANOSECONDS_PER_DAY = 86_400_000_000_000n;

/**
 * Split a datetime interval into `n` equal-length sub-intervals.
 *
 * - Returns an array of `n` `{ start, end }` records that tile the original interval, each
 *   record's `end` equal to the next record's `start`.
 * - Each boundary is `start + round((end - start) · i / n)` in integer nanoseconds, computed in
 *   `bigint`: the split is exact whenever the total divides evenly by `n`, and within half a
 *   nanosecond of the exact cut otherwise (an exact half rounds up), at any span length — the
 *   whole PlainDateTime range included.
 * - `n === 1` returns the original interval unchanged, as a single-element array.
 * - A zero-length interval (`start === end`) returns `n` identical zero-length sub-intervals.
 * - Returns `[]` when `n` is not a positive integer, or on invalid input (unparseable
 *   start/end, `start > end`).
 * - `options.maxPieces` (positive safe integer, default `1_000_000`) bounds the output: when `n`
 *   exceeds it, or exceeds the longest possible array (2^32 - 1), the function returns `[]`
 *   before building any piece. An invalid `maxPieces` also returns `[]`.
 *
 * @param start ISO PlainDateTime string for the interval start
 * @param end ISO PlainDateTime string for the interval end
 * @param n number of equal sub-intervals to produce (positive integer)
 * @param options optional: `maxPieces` (positive safe integer, default `1_000_000`)
 * @returns array of `n` `{ start, end }` records, or `[]` on invalid input
 *
 * @example intervalDivideEquallyDateTime("2024-01-01T00:00:00", "2024-01-04T00:00:00", 3) // [{ start: "2024-01-01T00:00:00", end: "2024-01-02T00:00:00" }, { start: "2024-01-02T00:00:00", end: "2024-01-03T00:00:00" }, { start: "2024-01-03T00:00:00", end: "2024-01-04T00:00:00" }]
 * @example intervalDivideEquallyDateTime("2024-01-01T00:00:00", "2024-01-04T00:00:00", 1) // [{ start: "2024-01-01T00:00:00", end: "2024-01-04T00:00:00" }]
 * @example intervalDivideEquallyDateTime("2024-01-01T00:00:00", "2024-01-04T00:00:00", 0) // []
 * @example intervalDivideEquallyDateTime("invalid", "2024-01-04T00:00:00", 3) // []
 * @example intervalDivideEquallyDateTime("2024-01-01T00:00:00", "2024-01-04T00:00:00", 3, { maxPieces: 2 }) // [] (3 pieces exceed the limit)
 * @example intervalDivideEquallyDateTime("2024-01-01T00:00:00", "2024-01-04T00:00:00", 3, { maxPieces: 3 }) // [{ start: "2024-01-01T00:00:00", end: "2024-01-02T00:00:00" }, { start: "2024-01-02T00:00:00", end: "2024-01-03T00:00:00" }, { start: "2024-01-03T00:00:00", end: "2024-01-04T00:00:00" }]
 */
export function intervalDivideEquallyDateTime(
  start: string,
  end: string,
  n: number,
  options?: { maxPieces?: number },
): Array<{ start: string; end: string }> {
  if (typeof n !== "number" || !Number.isInteger(n) || n <= 0) {
    return [];
  }

  const maxPieces = resolveMaxPieces(options);

  if (maxPieces === null || exceedsPieceLimit(n, maxPieces)) {
    return [];
  }

  if (!isValidDateTimeInterval(start, end)) {
    return [];
  }

  try {
    const startVal = Temporal.PlainDateTime.from(start);
    const endVal = Temporal.PlainDateTime.from(end);

    if (startVal.equals(endVal)) {
      return Array.from({ length: n }, () => ({
        start: startVal.toString(),
        end: endVal.toString(),
      }));
    }

    // A PlainDateTime has no DST, so every day is 86,400 s. The span is read in whole fields
    // (days, then time below a day), each an exact integer, and summed in bigint.
    const span = startVal.until(endVal, { largestUnit: "day" });
    const totalNs =
      BigInt(span.days) * NANOSECONDS_PER_DAY +
      BigInt(span.hours) * 3_600_000_000_000n +
      BigInt(span.minutes) * 60_000_000_000n +
      BigInt(span.seconds) * 1_000_000_000n +
      BigInt(span.milliseconds) * 1_000_000n +
      BigInt(span.microseconds) * 1_000n +
      BigInt(span.nanoseconds);

    const boundaries: Temporal.PlainDateTime[] = [startVal];
    for (let i = 1; i < n; i++) {
      const offsetNs = divisionBoundary(totalNs, i, n);
      boundaries.push(
        startVal.add({
          days: Number(offsetNs / NANOSECONDS_PER_DAY),
          nanoseconds: Number(offsetNs % NANOSECONDS_PER_DAY),
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
}
