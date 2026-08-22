import { Temporal } from "@js-temporal/polyfill";
import { plainDate } from "../../regex";
import { isValidDateInterval } from "./validate";

/**
 * Split a date interval at arbitrary `points`, producing consecutive sub-intervals.
 *
 * - `points` need not be sorted — they are sorted internally before splitting.
 * - Points outside `[start, end]` are dropped; they cannot introduce a boundary that isn't
 *   inside the interval.
 * - Points exactly on `start` or `end` are dropped too — they would only produce a
 *   zero-length sub-interval at the edge, which `divideEqually`'s zero-length case is the
 *   deliberate way to express, not `splitAt`'s.
 * - Duplicate points collapse to a single boundary.
 * - Returns `[{ start, end }]` (the whole interval, unsplit) when no valid in-range point remains.
 * - Returns `[]` when `points` is not an array, when any element is not a valid ISO PlainDate
 *   string, or on invalid input (unparseable start/end, `start > end`).
 *
 * @param start ISO PlainDate string for the interval start
 * @param end ISO PlainDate string for the interval end
 * @param points array of ISO PlainDate strings to split at
 * @returns array of `{ start, end }` records, or `[]` on invalid input
 *
 * @example intervalSplitAtDate("2024-01-01", "2024-01-10", ["2024-01-05"]) // [{ start: "2024-01-01", end: "2024-01-05" }, { start: "2024-01-05", end: "2024-01-10" }]
 * @example intervalSplitAtDate("2024-01-01", "2024-01-10", ["2024-01-07", "2024-01-03"]) // [{ start: "2024-01-01", end: "2024-01-03" }, { start: "2024-01-03", end: "2024-01-07" }, { start: "2024-01-07", end: "2024-01-10" }]
 * @example intervalSplitAtDate("2024-01-01", "2024-01-10", ["2024-01-01", "2024-01-10", "2024-06-01"]) // [{ start: "2024-01-01", end: "2024-01-10" }] (start, end, and out-of-range points all drop)
 * @example intervalSplitAtDate("2024-01-01", "2024-01-10", []) // [{ start: "2024-01-01", end: "2024-01-10" }]
 * @example intervalSplitAtDate("invalid", "2024-01-10", ["2024-01-05"]) // []
 * @example intervalSplitAtDate("2024-01-01", "2024-01-10", ["not-a-date"]) // []
 */
export function intervalSplitAtDate(
  start: string,
  end: string,
  points: string[],
): Array<{ start: string; end: string }> {
  if (!Array.isArray(points)) {
    return [];
  }

  if (!isValidDateInterval(start, end)) {
    return [];
  }

  if (!points.every((point) => typeof point === "string")) {
    return [];
  }

  if (!points.every((point) => plainDate.test(point))) {
    return [];
  }

  try {
    const startVal = Temporal.PlainDate.from(start);
    const endVal = Temporal.PlainDate.from(end);

    const parsedPoints = points.map((point) => Temporal.PlainDate.from(point));

    const inRangePoints = parsedPoints.filter(
      (point) =>
        Temporal.PlainDate.compare(point, startVal) > 0 &&
        Temporal.PlainDate.compare(point, endVal) < 0,
    );

    inRangePoints.sort(Temporal.PlainDate.compare);

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
