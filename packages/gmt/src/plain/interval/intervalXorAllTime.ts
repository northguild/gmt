import { Temporal } from "@js-temporal/polyfill";
import { closedXorSweep } from "../../internal";
import { isValidTimeInterval } from "./validate";

/**
 * Return the symmetric difference across a list of time intervals — the set of clock times
 * covered by an odd number of the input intervals.
 *
 * - List-form generalization of `intervalXorTime`, which is pairwise only.
 * - Implemented as a closed-interval coverage sweep: each interval opens at its start and closes
 *   at its end, and the result is every maximal run where the coverage count is odd. No boundary
 *   is computed past an end, so an interval ending at `23:59:59.999999999` never wraps to midnight.
 *   For two overlapping intervals this reduces to exactly `intervalXorTime`'s pairwise result.
 * - Order of the input list does not matter; the result is sorted by start.
 * - Returns `[]` for an empty list, and `[]` when every clock time is covered an even number of
 *   times (e.g. two identical intervals cancel out).
 * - Returns `[]` when `intervals` is not an array, when any element is not a
 *   `{ start, end }` record of valid ISO PlainTime strings, or when any element has
 *   `start > end`.
 *
 * @param intervals array of `{ start, end }` records
 * @returns array of `{ start, end }` records covered an odd number of times, or `[]` on invalid input
 *
 * @example intervalXorAllTime([{ start: "09:00:00", end: "12:00:00" }, { start: "11:00:00", end: "15:00:00" }]) // [{ start: "09:00:00", end: "10:59:59.999999999" }, { start: "12:00:00.000000001", end: "15:00:00" }]
 * @example intervalXorAllTime([]) // []
 */
export function intervalXorAllTime(
  intervals: Array<{ start: string; end: string }>,
): Array<{ start: string; end: string }> {
  if (!Array.isArray(intervals) || intervals.length === 0) {
    return [];
  }

  if (
    !intervals.every(
      (interval) =>
        interval &&
        typeof interval === "object" &&
        isValidTimeInterval(interval.start, interval.end),
    )
  ) {
    return [];
  }

  try {
    const parsed = intervals.map((interval) => ({
      start: Temporal.PlainTime.from(interval.start),
      end: Temporal.PlainTime.from(interval.end),
    }));

    return closedXorSweep(parsed, {
      compare: Temporal.PlainTime.compare,
      stepUp: (value) => value.add({ nanoseconds: 1 }),
      stepDown: (value) => value.subtract({ nanoseconds: 1 }),
    }).map(({ start, end }) => ({
      start: start.toString(),
      end: end.toString(),
    }));
  } catch {
    return [];
  }
}
