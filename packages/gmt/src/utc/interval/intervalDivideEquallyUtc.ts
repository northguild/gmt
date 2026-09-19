// fallow-ignore-file code-duplication -- cross-family Temporal type clone, by design (rule 5)
import { Temporal } from "@js-temporal/polyfill";
import { isValidUtcInterval } from "./validate";
import { divisionBoundary } from "../../internal/divisionBoundary";
import { exceedsPieceLimit, resolveMaxPieces } from "../../internal/maxPieces";

/**
 * Split a UTC interval into `n` equal-length sub-intervals.
 *
 * - Returns an array of `n` `{ start, end }` records that tile the original interval, each
 *   record's `end` equal to the next record's `start`.
 * - Every piece is half-open `[start, end)`: a boundary belongs only to the piece that starts
 *   there, so the pieces share no value and together cover the interval exactly once (the rule
 *   CORE-6's `splitIntervalAt` uses).
 * - Each boundary is `start + round((end - start) · i / n)` in integer epoch nanoseconds, so the
 *   split is exact whenever the span divides evenly by `n` and within half a nanosecond of the
 *   exact cut otherwise, at any span length (no double arithmetic) — no DST is involved, since
 *   UTC has no time zone offset.
 * - `n === 1` returns the original interval unchanged, as a single-element array.
 * - A zero-length interval (`start === end`) returns `n` identical zero-length sub-intervals.
 * - Returns `[]` when `n` is not a positive integer, or on invalid input (unparseable
 *   start/end, `start > end`, leap-second strings).
 * - `options.maxPieces` (positive safe integer, default `1_000_000`) bounds the output: when `n`
 *   exceeds it, or exceeds the longest possible array (2^32 - 1), the function returns `[]`
 *   before building any piece. An invalid `maxPieces` also returns `[]`.
 *
 * @param start ISO UTC datetime string for the interval start
 * @param end ISO UTC datetime string for the interval end
 * @param n number of equal sub-intervals to produce (positive integer)
 * @param options optional: `maxPieces` (positive safe integer, default `1_000_000`)
 * @returns array of `n` `{ start, end }` records, or `[]` on invalid input
 *
 * @example intervalDivideEquallyUtc("2024-01-01T00:00:00Z", "2024-01-04T00:00:00Z", 3) // [{ start: "2024-01-01T00:00:00Z", end: "2024-01-02T00:00:00Z" }, { start: "2024-01-02T00:00:00Z", end: "2024-01-03T00:00:00Z" }, { start: "2024-01-03T00:00:00Z", end: "2024-01-04T00:00:00Z" }]
 * @example intervalDivideEquallyUtc("2024-01-01T00:00:00Z", "2024-01-04T00:00:00Z", 1) // [{ start: "2024-01-01T00:00:00Z", end: "2024-01-04T00:00:00Z" }]
 * @example intervalDivideEquallyUtc("2024-01-01T00:00:00Z", "2024-01-04T00:00:00Z", 0) // []
 * @example intervalDivideEquallyUtc("invalid", "2024-01-04T00:00:00Z", 3) // []
 * @example intervalDivideEquallyUtc("2024-01-01T00:00:00Z", "2024-01-04T00:00:00Z", 3, { maxPieces: 2 }) // [] (3 pieces exceed the limit)
 * @example intervalDivideEquallyUtc("2024-01-01T00:00:00Z", "2024-01-04T00:00:00Z", 3, { maxPieces: 3 }) // [{ start: "2024-01-01T00:00:00Z", end: "2024-01-02T00:00:00Z" }, { start: "2024-01-02T00:00:00Z", end: "2024-01-03T00:00:00Z" }, { start: "2024-01-03T00:00:00Z", end: "2024-01-04T00:00:00Z" }]
 */
export function intervalDivideEquallyUtc(
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

  if (!isValidUtcInterval(start, end)) {
    return [];
  }

  try {
    const startVal = Temporal.Instant.from(start);
    const endVal = Temporal.Instant.from(end);

    if (startVal.equals(endVal)) {
      return Array.from({ length: n }, () => ({
        start: startVal.toString(),
        end: endVal.toString(),
      }));
    }

    const startNs = startVal.epochNanoseconds;
    const totalNs = endVal.epochNanoseconds - startNs;

    const boundaries: Temporal.Instant[] = [startVal];
    for (let i = 1; i < n; i++) {
      boundaries.push(
        Temporal.Instant.fromEpochNanoseconds(
          startNs + divisionBoundary(totalNs, i, n),
        ),
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
