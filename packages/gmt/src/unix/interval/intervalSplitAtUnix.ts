import { parseUnixEpochInterval, parseUnixEpochValue } from "../../internal";

/**
 * Split a Unix epoch interval at arbitrary `points`, producing consecutive sub-intervals.
 *
 * - `points` need not be sorted — they are sorted internally before splitting.
 * - Points before `start` or after `end` are dropped; they cannot introduce a boundary that
 *   isn't inside the interval.
 * - Points exactly on `start` or `end` are dropped too — they would only produce a
 *   zero-length sub-interval at the edge.
 * - Duplicate points collapse to a single boundary.
 * - Returns consecutive half-open `[start, end)` records, the same tiling as `splitIntervalAt`:
 *   each record's `end` is the next record's `start` and belongs only to that next record, so the
 *   pieces share no value and together cover `[start, end)` exactly once.
 * - Returns `[{ start, end }]` (the whole interval, unsplit) when no valid in-range point remains.
 * - Returns `[]` when `points` is not an array, or when `start`, `end` or any point is not a safe
 *   integer (or numeric string of one) — fractions, empty strings and values beyond ±(2^53 − 1)
 *   are invalid even when they would fall outside the interval — or when `start > end`.
 *
 * @param start Unix epoch value, in the one unit all epoch arguments share — interval start
 * @param end Unix epoch value, in the one unit all epoch arguments share — interval end
 * @param points array of Unix epoch values to split at
 * @returns array of `{ start, end }` records, or `[]` on invalid input
 *
 * @example intervalSplitAtUnix(0, 100000, [50000]) // [{ start: 0, end: 50000 }, { start: 50000, end: 100000 }]
 * @example intervalSplitAtUnix(0, 100000, []) // [{ start: 0, end: 100000 }]
 * @example intervalSplitAtUnix(NaN, 100000, [50000]) // []
 * @example intervalSplitAtUnix(0, 100000, [50000.5]) // [] (fractional point)
 */
export function intervalSplitAtUnix(
  start: number | string,
  end: number | string,
  points: Array<number | string>,
): Array<{ start: number; end: number }> {
  if (!Array.isArray(points)) {
    return [];
  }

  const interval = parseUnixEpochInterval(start, end);

  if (interval === null) {
    return [];
  }

  const { start: startMs, end: endMs } = interval;

  const parsedPoints: number[] = [];
  for (const point of points) {
    const parsed = parseUnixEpochValue(point);

    if (parsed === null) {
      return [];
    }

    parsedPoints.push(parsed);
  }

  const inRangePoints = parsedPoints.filter(
    (point) => point > startMs && point < endMs,
  );

  inRangePoints.sort((a, b) => a - b);

  const uniquePoints = inRangePoints.filter(
    (point, index) => index === 0 || point !== inRangePoints[index - 1],
  );

  const boundaries = [startMs, ...uniquePoints, endMs];

  const result: Array<{ start: number; end: number }> = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    result.push({ start: boundaries[i], end: boundaries[i + 1] });
  }

  return result;
}
