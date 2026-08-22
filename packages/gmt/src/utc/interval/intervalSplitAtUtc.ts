import { Temporal } from "@js-temporal/polyfill";
import { isLeapSecond } from "../../plain/validate/isLeapSecond";
import { utcDateTime } from "../../regex/utc-date-time";
import { isValidUtcInterval } from "./validate";

/**
 * Split a UTC interval at arbitrary `points`, producing consecutive sub-intervals.
 *
 * - `points` need not be sorted — they are sorted internally before splitting.
 * - Points outside `[start, end]` are dropped; they cannot introduce a boundary that isn't
 *   inside the interval.
 * - Points exactly on `start` or `end` are dropped too — they would only produce a
 *   zero-length sub-interval at the edge.
 * - Duplicate points collapse to a single boundary.
 * - Returns `[{ start, end }]` (the whole interval, unsplit) when no valid in-range point remains.
 * - Returns `[]` when `points` is not an array, when any element is not a valid ISO UTC
 *   datetime string, or on invalid input (unparseable start/end, `start > end`, leap-second
 *   strings).
 *
 * @param start ISO UTC datetime string for the interval start
 * @param end ISO UTC datetime string for the interval end
 * @param points array of ISO UTC datetime strings to split at
 * @returns array of `{ start, end }` records, or `[]` on invalid input
 *
 * @example intervalSplitAtUtc("2024-01-01T00:00:00Z", "2024-01-10T00:00:00Z", ["2024-01-05T00:00:00Z"]) // [{ start: "2024-01-01T00:00:00Z", end: "2024-01-05T00:00:00Z" }, { start: "2024-01-05T00:00:00Z", end: "2024-01-10T00:00:00Z" }]
 * @example intervalSplitAtUtc("2024-01-01T00:00:00Z", "2024-01-10T00:00:00Z", []) // [{ start: "2024-01-01T00:00:00Z", end: "2024-01-10T00:00:00Z" }]
 * @example intervalSplitAtUtc("invalid", "2024-01-10T00:00:00Z", ["2024-01-05T00:00:00Z"]) // []
 */
export function intervalSplitAtUtc(
  start: string,
  end: string,
  points: string[],
): Array<{ start: string; end: string }> {
  if (!Array.isArray(points)) {
    return [];
  }

  if (isLeapSecond(start) || isLeapSecond(end)) {
    return [];
  }

  if (!isValidUtcInterval(start, end)) {
    return [];
  }

  if (
    !points.every(
      (point) =>
        typeof point === "string" &&
        utcDateTime.test(point) &&
        !isLeapSecond(point),
    )
  ) {
    return [];
  }

  try {
    const startVal = Temporal.Instant.from(start);
    const endVal = Temporal.Instant.from(end);

    const parsedPoints = points.map((point) => Temporal.Instant.from(point));

    const inRangePoints = parsedPoints.filter(
      (point) =>
        Temporal.Instant.compare(point, startVal) > 0 &&
        Temporal.Instant.compare(point, endVal) < 0,
    );

    inRangePoints.sort(Temporal.Instant.compare);

    const uniquePoints = inRangePoints.filter(
      (point, index) => index === 0 || !point.equals(inRangePoints[index - 1]),
    );

    const boundaries = [startVal, ...uniquePoints, endVal];

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
