import { Temporal } from "@js-temporal/polyfill";
import { closedXorSweep } from "../../internal";
import { isLeapSecond } from "../../plain/validate/isLeapSecond";
import { isValidUtcInterval } from "./validate";

/**
 * Return the symmetric difference across a list of UTC intervals — the set of instants covered
 * by an odd number of the input intervals.
 *
 * - List-form generalization of `intervalXorUtc`, which is pairwise only.
 * - Implemented as a closed-interval coverage sweep: each interval opens at its start and closes
 *   at its end, and the result is every maximal run where the coverage count is odd. No boundary
 *   is computed past an end, so an interval may end on the last representable instant. For two
 *   overlapping intervals this reduces to exactly `intervalXorUtc`'s pairwise result.
 * - Order of the input list does not matter; the result is sorted by start.
 * - Returns `[]` for an empty list, and `[]` when every instant is covered an even number of
 *   times (e.g. two identical intervals cancel out).
 * - Returns `[]` when `intervals` is not an array, when any element is not a
 *   `{ start, end }` record of valid ISO UTC datetime strings, or when any element has
 *   `start > end` or a leap-second string.
 *
 * @param intervals array of `{ start, end }` records
 * @returns array of `{ start, end }` records covered an odd number of times, or `[]` on invalid input
 *
 * @example intervalXorAllUtc([{ start: "2024-01-01T00:00:00Z", end: "2024-01-10T00:00:00Z" }, { start: "2024-01-05T00:00:00Z", end: "2024-01-15T00:00:00Z" }]) // [{ start: "2024-01-01T00:00:00Z", end: "2024-01-04T23:59:59.999999999Z" }, { start: "2024-01-10T00:00:00.000000001Z", end: "2024-01-15T00:00:00Z" }]
 * @example intervalXorAllUtc([]) // []
 */
export function intervalXorAllUtc(
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
        typeof interval.start === "string" &&
        typeof interval.end === "string" &&
        !isLeapSecond(interval.start) &&
        !isLeapSecond(interval.end) &&
        isValidUtcInterval(interval.start, interval.end),
    )
  ) {
    return [];
  }

  try {
    const parsed = intervals.map((interval) => ({
      start: Temporal.Instant.from(interval.start),
      end: Temporal.Instant.from(interval.end),
    }));

    return closedXorSweep(parsed, {
      compare: Temporal.Instant.compare,
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
