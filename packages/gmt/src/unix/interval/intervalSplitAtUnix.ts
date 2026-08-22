import { isValidUnixEpochPair } from "../../internal/resolveUnixTimeZone";

/**
 * Split a Unix epoch interval at arbitrary `points`, producing consecutive sub-intervals.
 *
 * - `points` need not be sorted — they are sorted internally before splitting.
 * - Points outside `[start, end]` are dropped; they cannot introduce a boundary that isn't
 *   inside the interval.
 * - Points exactly on `start` or `end` are dropped too — they would only produce a
 *   zero-length sub-interval at the edge.
 * - Duplicate points collapse to a single boundary.
 * - Returns `[{ start, end }]` (the whole interval, unsplit) when no valid in-range point remains.
 * - Returns `[]` when `points` is not an array, when any element is not a finite number (or
 *   numeric string), or on invalid input (non-finite/non-integer start/end, `start > end`).
 *
 * @param start Unix epoch value (seconds or milliseconds) — interval start
 * @param end Unix epoch value (seconds or milliseconds) — interval end
 * @param points array of Unix epoch values to split at
 * @returns array of `{ start, end }` records, or `[]` on invalid input
 *
 * @example intervalSplitAtUnix(0, 100000, [50000]) // [{ start: 0, end: 50000 }, { start: 50000, end: 100000 }]
 * @example intervalSplitAtUnix(0, 100000, []) // [{ start: 0, end: 100000 }]
 * @example intervalSplitAtUnix(NaN, 100000, [50000]) // []
 */
export function intervalSplitAtUnix(
  start: number | string,
  end: number | string,
  points: Array<number | string>,
): Array<{ start: number; end: number }> {
  if (!Array.isArray(points)) {
    return [];
  }

  if (typeof start !== "number" && typeof start !== "string") {
    return [];
  }

  if (typeof end !== "number" && typeof end !== "string") {
    return [];
  }

  const startMs = typeof start === "number" ? start : Number(start);
  const endMs = typeof end === "number" ? end : Number(end);

  if (!isValidUnixEpochPair(startMs, endMs) || startMs > endMs) {
    return [];
  }

  if (
    !points.every(
      (point) => typeof point === "number" || typeof point === "string",
    )
  ) {
    return [];
  }

  const parsedPoints = points.map((point) =>
    typeof point === "number" ? point : Number(point),
  );

  if (!parsedPoints.every((point) => Number.isFinite(point))) {
    return [];
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
