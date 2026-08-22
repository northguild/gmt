import { Temporal } from "@js-temporal/polyfill";
import { plainTime } from "../../regex";
import { isValidTimeInterval } from "./validate";

/**
 * Split a time interval at arbitrary `points`, producing consecutive sub-intervals.
 *
 * - `points` need not be sorted — they are sorted internally before splitting.
 * - Points outside `[start, end]` are dropped; they cannot introduce a boundary that isn't
 *   inside the interval.
 * - Points exactly on `start` or `end` are dropped too — they would only produce a
 *   zero-length sub-interval at the edge, which `divideEqually`'s zero-length case is the
 *   deliberate way to express, not `splitAt`'s.
 * - Duplicate points collapse to a single boundary.
 * - Returns `[{ start, end }]` (the whole interval, unsplit) when no valid in-range point remains.
 * - Returns `[]` when `points` is not an array, when any element is not a valid ISO PlainTime
 *   string, or on invalid input (unparseable start/end, `start > end`).
 *
 * @param start ISO PlainTime string for the interval start
 * @param end ISO PlainTime string for the interval end
 * @param points array of ISO PlainTime strings to split at
 * @returns array of `{ start, end }` records, or `[]` on invalid input
 *
 * @example intervalSplitAtTime("09:00:00", "17:00:00", ["12:00:00"]) // [{ start: "09:00:00", end: "12:00:00" }, { start: "12:00:00", end: "17:00:00" }]
 * @example intervalSplitAtTime("09:00:00", "17:00:00", ["15:00:00", "11:00:00"]) // [{ start: "09:00:00", end: "11:00:00" }, { start: "11:00:00", end: "15:00:00" }, { start: "15:00:00", end: "17:00:00" }]
 * @example intervalSplitAtTime("09:00:00", "17:00:00", ["09:00:00", "17:00:00", "20:00:00"]) // [{ start: "09:00:00", end: "17:00:00" }]
 * @example intervalSplitAtTime("09:00:00", "17:00:00", []) // [{ start: "09:00:00", end: "17:00:00" }]
 * @example intervalSplitAtTime("invalid", "17:00:00", ["12:00:00"]) // []
 * @example intervalSplitAtTime("09:00:00", "17:00:00", ["not-a-time"]) // []
 */
export function intervalSplitAtTime(
  start: string,
  end: string,
  points: string[],
): Array<{ start: string; end: string }> {
  if (!Array.isArray(points)) {
    return [];
  }

  if (!isValidTimeInterval(start, end)) {
    return [];
  }

  if (!points.every((point) => typeof point === "string")) {
    return [];
  }

  if (!points.every((point) => plainTime.test(point))) {
    return [];
  }

  try {
    const startVal = Temporal.PlainTime.from(start);
    const endVal = Temporal.PlainTime.from(end);

    const parsedPoints = points.map((point) => Temporal.PlainTime.from(point));

    const inRangePoints = parsedPoints.filter(
      (point) =>
        Temporal.PlainTime.compare(point, startVal) > 0 &&
        Temporal.PlainTime.compare(point, endVal) < 0,
    );

    inRangePoints.sort(Temporal.PlainTime.compare);

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
