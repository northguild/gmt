import { Temporal } from "@js-temporal/polyfill";
import { plainDateTime } from "../../regex";
import { isValidDateTimeInterval } from "./validate";

/**
 * Split a datetime interval at arbitrary `points`, producing consecutive sub-intervals.
 *
 * - `points` need not be sorted — they are sorted internally before splitting.
 * - Points outside `[start, end]` are dropped; they cannot introduce a boundary that isn't
 *   inside the interval.
 * - Points exactly on `start` or `end` are dropped too — they would only produce a
 *   zero-length sub-interval at the edge, which `divideEqually`'s zero-length case is the
 *   deliberate way to express, not `splitAt`'s.
 * - Duplicate points collapse to a single boundary.
 * - Returns `[{ start, end }]` (the whole interval, unsplit) when no valid in-range point remains.
 * - Returns `[]` when `points` is not an array, when any element is not a valid ISO
 *   PlainDateTime string, or on invalid input (unparseable start/end, `start > end`).
 *
 * @param start ISO PlainDateTime string for the interval start
 * @param end ISO PlainDateTime string for the interval end
 * @param points array of ISO PlainDateTime strings to split at
 * @returns array of `{ start, end }` records, or `[]` on invalid input
 *
 * @example intervalSplitAtDateTime("2024-01-01T00:00:00", "2024-01-10T00:00:00", ["2024-01-05T00:00:00"]) // [{ start: "2024-01-01T00:00:00", end: "2024-01-05T00:00:00" }, { start: "2024-01-05T00:00:00", end: "2024-01-10T00:00:00" }]
 * @example intervalSplitAtDateTime("2024-01-01T00:00:00", "2024-01-10T00:00:00", []) // [{ start: "2024-01-01T00:00:00", end: "2024-01-10T00:00:00" }]
 * @example intervalSplitAtDateTime("invalid", "2024-01-10T00:00:00", ["2024-01-05T00:00:00"]) // []
 * @example intervalSplitAtDateTime("2024-01-01T00:00:00", "2024-01-10T00:00:00", ["not-a-datetime"]) // []
 */
export function intervalSplitAtDateTime(
  start: string,
  end: string,
  points: string[],
): Array<{ start: string; end: string }> {
  if (!Array.isArray(points)) {
    return [];
  }

  if (!isValidDateTimeInterval(start, end)) {
    return [];
  }

  if (!points.every((point) => typeof point === "string")) {
    return [];
  }

  if (!points.every((point) => plainDateTime.test(point))) {
    return [];
  }

  try {
    const startVal = Temporal.PlainDateTime.from(start);
    const endVal = Temporal.PlainDateTime.from(end);

    const parsedPoints = points.map((point) =>
      Temporal.PlainDateTime.from(point),
    );

    const inRangePoints = parsedPoints.filter(
      (point) =>
        Temporal.PlainDateTime.compare(point, startVal) > 0 &&
        Temporal.PlainDateTime.compare(point, endVal) < 0,
    );

    inRangePoints.sort(Temporal.PlainDateTime.compare);

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
