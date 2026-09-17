import { parseUnixEpochInterval } from "../../internal";
import { divisionBoundary } from "../../internal/divisionBoundary";
import { exceedsPieceLimit, resolveMaxPieces } from "../../internal/maxPieces";

/**
 * Split a Unix epoch interval into `n` equal-length sub-intervals.
 *
 * - Returns an array of `n` `{ start, end }` records that tile the original interval, each
 *   record's `end` equal to the next record's `start`.
 * - Each boundary is `start + round((end - start) · i / n)` in integer milliseconds, taken in
 *   `bigint` so no product past 2^53 loses a millisecond: the split is exact whenever the total
 *   divides evenly by `n`, and within half a millisecond of the exact cut otherwise (an exact
 *   half rounds up). No time zone is involved.
 * - `n === 1` returns the original interval unchanged, as a single-element array.
 * - A zero-length interval (`start === end`) returns `n` identical zero-length sub-intervals.
 * - Returns `[]` when `n` is not a positive integer, or on invalid input (`start`/`end` that is
 *   not a safe integer or numeric string of one — fractions, empty strings and values beyond
 *   ±(2^53 − 1) are invalid — or `start > end`).
 * - `options.maxPieces` (positive safe integer, default `1_000_000`) bounds the output: when `n`
 *   exceeds it, or exceeds the longest possible array (2^32 - 1), the function returns `[]`
 *   before building any piece. An invalid `maxPieces` also returns `[]`.
 *
 * @param start Unix epoch value, in the one unit all epoch arguments share — interval start
 * @param end Unix epoch value, in the one unit all epoch arguments share — interval end
 * @param n number of equal sub-intervals to produce (positive integer)
 * @param options optional: `maxPieces` (positive safe integer, default `1_000_000`)
 * @returns array of `n` `{ start, end }` records, or `[]` on invalid input
 *
 * @example intervalDivideEquallyUnix(0, 90000000, 3) // [{ start: 0, end: 30000000 }, { start: 30000000, end: 60000000 }, { start: 60000000, end: 90000000 }]
 * @example intervalDivideEquallyUnix(0, 100000000, 3) // [{ start: 0, end: 33333333 }, { start: 33333333, end: 66666667 }, { start: 66666667, end: 100000000 }]
 * @example intervalDivideEquallyUnix(0, 90000000, 1) // [{ start: 0, end: 90000000 }]
 * @example intervalDivideEquallyUnix(0, 90000000, 0) // []
 * @example intervalDivideEquallyUnix(NaN, 90000000, 3) // []
 * @example intervalDivideEquallyUnix(0, 90000000, 3, { maxPieces: 2 }) // [] (3 pieces exceed the limit)
 * @example intervalDivideEquallyUnix(0, 90000000, 3, { maxPieces: 3 }) // [{ start: 0, end: 30000000 }, { start: 30000000, end: 60000000 }, { start: 60000000, end: 90000000 }]
 */
export function intervalDivideEquallyUnix(
  start: number | string,
  end: number | string,
  n: number,
  options?: { maxPieces?: number },
): Array<{ start: number; end: number }> {
  if (typeof n !== "number" || !Number.isInteger(n) || n <= 0) {
    return [];
  }

  const maxPieces = resolveMaxPieces(options);

  if (maxPieces === null || exceedsPieceLimit(n, maxPieces)) {
    return [];
  }

  const interval = parseUnixEpochInterval(start, end);

  if (interval === null) {
    return [];
  }

  const { start: startMs, end: endMs } = interval;

  if (startMs === endMs) {
    return Array.from({ length: n }, () => ({ start: startMs, end: endMs }));
  }

  // Integer milliseconds in bigint: a span near ±8.64e15 times `i` passes 2^53.
  const totalMs = BigInt(endMs) - BigInt(startMs);

  const boundaries: number[] = [startMs];
  for (let i = 1; i < n; i++) {
    boundaries.push(Number(BigInt(startMs) + divisionBoundary(totalMs, i, n)));
  }
  boundaries.push(endMs);

  const result: Array<{ start: number; end: number }> = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    result.push({ start: boundaries[i], end: boundaries[i + 1] });
  }

  return result;
}
