import { Temporal } from "@js-temporal/polyfill";
import { isValidTimeInterval } from "./validate";

/**
 * Return the symmetric difference across a list of time intervals — the set of clock times
 * covered by an odd number of the input intervals.
 *
 * - List-form generalization of `intervalXorTime`, which is pairwise only.
 * - Implemented as a coverage sweep: each interval contributes a `+1` at its start and a `-1`
 *   one nanosecond after its end; the result is every maximal run where the running coverage
 *   count is odd. For two intervals this reduces to exactly `intervalXorTime`'s pairwise result.
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
    const events: Array<{ point: Temporal.PlainTime; delta: number }> = [];

    for (const interval of intervals) {
      const start = Temporal.PlainTime.from(interval.start);
      const closesAfter = Temporal.PlainTime.from(interval.end).add({
        nanoseconds: 1,
      });

      events.push({ point: start, delta: 1 });
      events.push({ point: closesAfter, delta: -1 });
    }

    events.sort((a, b) => Temporal.PlainTime.compare(a.point, b.point));

    const grouped: Array<{ point: Temporal.PlainTime; delta: number }> = [];
    for (const event of events) {
      const last = grouped[grouped.length - 1];
      if (last && last.point.equals(event.point)) {
        last.delta += event.delta;
      } else {
        grouped.push({ point: event.point, delta: event.delta });
      }
    }

    const result: Array<{ start: string; end: string }> = [];
    let coverage = 0;
    let runStart: Temporal.PlainTime | null = null;

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
