import { Temporal } from "@js-temporal/polyfill";
import { isLeapSecond } from "../../plain/validate/isLeapSecond";
import { isValidZonedDateTime } from "../validate/isValidZonedDateTime";
import { isValidZonedInterval } from "./validate";

/**
 * Split a zoned interval at arbitrary `points`, producing consecutive sub-intervals.
 *
 * - `points` need not be sorted — they are sorted internally (by instant) before splitting.
 * - Comparison and boundary placement use the instant each point represents, so points may
 *   carry a different time zone than `start`/`end`.
 * - Points outside `[start, end]` are dropped; they cannot introduce a boundary that isn't
 *   inside the interval.
 * - Points on the same instant as `start` or `end` are dropped too — they would only produce a
 *   zero-length sub-interval at the edge.
 * - Duplicate points (same instant) collapse to a single boundary.
 * - Returns `[{ start, end }]` (the whole interval, unsplit) when no valid in-range point remains.
 * - Returns `[]` when `points` is not an array, when any element is not a valid ISO
 *   ZonedDateTime string, or on invalid input (unparseable start/end, `start > end`,
 *   leap-second strings).
 *
 * @param start ISO 8601 zoned datetime string for the interval start
 * @param end ISO 8601 zoned datetime string for the interval end
 * @param points array of ISO 8601 zoned datetime strings to split at
 * @returns array of `{ start, end }` records, or `[]` on invalid input
 *
 * @example intervalSplitAtZoned("2024-01-01T00:00:00+00:00[UTC]", "2024-01-10T00:00:00+00:00[UTC]", ["2024-01-05T00:00:00+00:00[UTC]"]) // [{ start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-01-05T00:00:00+00:00[UTC]" }, { start: "2024-01-05T00:00:00+00:00[UTC]", end: "2024-01-10T00:00:00+00:00[UTC]" }]
 * @example intervalSplitAtZoned("2024-01-01T00:00:00+00:00[UTC]", "2024-01-10T00:00:00+00:00[UTC]", []) // [{ start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-01-10T00:00:00+00:00[UTC]" }]
 * @example intervalSplitAtZoned("invalid", "2024-01-10T00:00:00+00:00[UTC]", ["2024-01-05T00:00:00+00:00[UTC]"]) // []
 */
export function intervalSplitAtZoned(
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

  if (!isValidZonedInterval(start, end)) {
    return [];
  }

  if (
    !points.every(
      (point) => typeof point === "string" && isValidZonedDateTime(point),
    )
  ) {
    return [];
  }

  try {
    const startVal = Temporal.ZonedDateTime.from(start);
    const endVal = Temporal.ZonedDateTime.from(end);
    const startInstant = startVal.toInstant();
    const endInstant = endVal.toInstant();

    const parsedPoints = points.map((point) =>
      Temporal.ZonedDateTime.from(point),
    );

    const inRangePoints = parsedPoints.filter((point) => {
      const instant = point.toInstant();
      return (
        Temporal.Instant.compare(instant, startInstant) > 0 &&
        Temporal.Instant.compare(instant, endInstant) < 0
      );
    });

    inRangePoints.sort((a, b) =>
      Temporal.Instant.compare(a.toInstant(), b.toInstant()),
    );

    const uniquePoints = inRangePoints.filter(
      (point, index) =>
        index === 0 ||
        !point.toInstant().equals(inRangePoints[index - 1].toInstant()),
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
