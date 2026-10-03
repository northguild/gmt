// fallow-ignore-file code-duplication -- cross-family Temporal type clone, by design (rule 5)
import { parseUnixEpochInterval } from "../../internal";
import { divisionBoundary } from "../../internal/divisionBoundary";
import { exceedsPieceLimit, resolveMaxPieces } from "../../internal/maxPieces";

/**
 * Split a Unix epoch interval into `n` equal-length sub-intervals.
 *
 * - Returns an array of `n` half-open `[start, end)` records that tile the original interval: each
 *   record's `end` is the next record's `start` and belongs only to that next record, so the
 *   pieces share no value and together cover `[start, end)` exactly once.
 * - Each boundary is `start + round((end - start) · i / n)` in integers of the arguments' own epoch
 *   unit (there is no `epochUnit` option: seconds in give seconds out, milliseconds give
 *   milliseconds), taken in `bigint` so no product past 2^53 loses a unit: the split is exact
 *   whenever the total divides evenly by `n`, and within half a unit of the exact cut otherwise (an
 *   exact half rounds up). No time zone is involved.
 * - When `n` is larger than the number of whole epoch units in the interval, some pieces are empty (their
 *   `start` equals their `end`): the result always has exactly `n` pieces.
 * - `n === 1` returns the original interval unchanged, as a single-element array.
 * - A zero-length interval (`start === end`) returns `n` identical zero-length sub-intervals, each
 *   an empty `[start, start)` that holds no instant.
 * - Returns `[]` when `n` is not a positive integer, or on invalid input (`start`/`end` that is
 *   not a safe integer or numeric string of one — fractions, empty strings and values beyond
 *   ±(2^53 − 1) are invalid — or `start > end`).
 * - Returns `[]` before building any piece when `n` exceeds `options.maxPieces` or the longest
 *   possible array (2^32 - 1).
 *
 * @param start Unix epoch value, in the one unit all epoch arguments share — interval start
 * @param end Unix epoch value, in the one unit all epoch arguments share — interval end
 * @param n number of equal sub-intervals to produce (positive integer)
 * @param options optional: the limit on the number of pieces
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
  options?: {
    /**
     * The most records the result may hold. A result that would hold more, or more than the longest
     * possible array (2^32 - 1 elements), returns `[]` and none is built. A value that is not a
     * positive safe integer also returns `[]`.
     *
     * @defaultValue `1_000_000`
     */
    maxPieces?: number;
  },
): Array<{
  /** The instant the interval begins at, as a Unix epoch number in the unit the arguments share. */
  start: number;
  /**
   * The first instant after the interval, in the same unit as `start`. It is exclusive: the
   * interval holds everything from `start` up to but not including this value. It can equal
   * `start`, which makes the interval empty.
   */
  end: number;
}> {
  try {
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
      boundaries.push(
        Number(BigInt(startMs) + divisionBoundary(totalMs, i, n)),
      );
    }
    boundaries.push(endMs);

    const result: Array<{ start: number; end: number }> = [];
    for (let i = 0; i < boundaries.length - 1; i++) {
      result.push({ start: boundaries[i], end: boundaries[i + 1] });
    }

    return result;
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return [];
  }
}
