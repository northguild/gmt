import { Temporal } from "@js-temporal/polyfill";
import { isLeapSecond } from "../../plain/validate/isLeapSecond";
import { isValidUtcInterval } from "./validate";

/**
 * Return the symmetric difference across a list of UTC intervals — the set of instants covered
 * by an odd number of the input intervals.
 *
 * - List-form generalization of `intervalXorUtc`, which is pairwise only.
 * - Implemented as a coverage sweep: each interval contributes a `+1` at its start and a `-1`
 *   one nanosecond after its end; the result is every maximal run where the running coverage
 *   count is odd. For two intervals this reduces to exactly `intervalXorUtc`'s pairwise result.
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
    const events: Array<{ point: Temporal.Instant; delta: number }> = [];

    for (const interval of intervals) {
      const start = Temporal.Instant.from(interval.start);
      const closesAfter = Temporal.Instant.from(interval.end).add({
        nanoseconds: 1,
      });

      events.push({ point: start, delta: 1 });
      events.push({ point: closesAfter, delta: -1 });
    }

    events.sort((a, b) => Temporal.Instant.compare(a.point, b.point));

    const grouped: Array<{ point: Temporal.Instant; delta: number }> = [];
    for (const event of events) {
      const last = grouped[grouped.length - 1];
      if (last && last.point.equals(event.point)) {
        last.delta += event.delta;
      } else {
        grouped.push(event);
      }
    }

    const result: Array<{ start: string; end: string }> = [];
    let coverage = 0;
    let runStart: Temporal.Instant | null = null;

    for (const group of grouped) {
      const previousCoverage = coverage;
      coverage += group.delta;

      if (previousCoverage % 2 === 0 && coverage % 2 === 1) {
        runStart = group.point;
      } else if (previousCoverage % 2 === 1 && coverage % 2 === 0 && runStart) {
        result.push({
          start: runStart.toString(),
          end: group.point.subtract({ nanoseconds: 1 }).toString(),
        });
        runStart = null;
      }
    }

    return result;
  } catch {
    return [];
  }
}
