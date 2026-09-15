import { Temporal } from "@js-temporal/polyfill";
import { closedXorSweep } from "../../internal";
import { isValidDateTimeInterval } from "./validate";

/**
 * Return the symmetric difference across a list of datetime intervals — the set of instants
 * covered by an odd number of the input intervals.
 *
 * - List-form generalization of `intervalXorDateTime`, which is pairwise only.
 * - Implemented as a closed-interval coverage sweep: each interval opens at its start and closes
 *   at its end, and the result is every maximal run where the coverage count is odd. No boundary
 *   is computed past an end, so an interval may end on the last representable value. For two
 *   overlapping intervals this reduces to exactly `intervalXorDateTime`'s pairwise result.
 * - Order of the input list does not matter; the result is sorted by start.
 * - Returns `[]` for an empty list, and `[]` when every instant is covered an even number of
 *   times (e.g. two identical intervals cancel out).
 * - Returns `[]` when `intervals` is not an array, when any element is not a
 *   `{ start, end }` record of valid ISO PlainDateTime strings, or when any element has
 *   `start > end`.
 *
 * @param intervals array of `{ start, end }` records
 * @returns array of `{ start, end }` records covered an odd number of times, or `[]` on invalid input
 *
 * @example intervalXorAllDateTime([{ start: "2024-01-01T00:00:00", end: "2024-01-10T00:00:00" }, { start: "2024-01-05T00:00:00", end: "2024-01-15T00:00:00" }]) // [{ start: "2024-01-01T00:00:00", end: "2024-01-04T23:59:59.999999999" }, { start: "2024-01-10T00:00:00.000000001", end: "2024-01-15T00:00:00" }]
 * @example intervalXorAllDateTime([]) // []
 */
export function intervalXorAllDateTime(
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
        isValidDateTimeInterval(interval.start, interval.end),
    )
  ) {
    return [];
  }

  try {
    const parsed = intervals.map((interval) => ({
      start: Temporal.PlainDateTime.from(interval.start),
      end: Temporal.PlainDateTime.from(interval.end),
    }));

    return closedXorSweep(parsed, {
      compare: Temporal.PlainDateTime.compare,
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
