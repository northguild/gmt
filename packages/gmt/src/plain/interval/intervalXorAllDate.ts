import { Temporal } from "@js-temporal/polyfill";
import { isValidDateInterval } from "./validate";

/**
 * Return the symmetric difference across a list of date intervals — the set of dates covered
 * by an odd number of the input intervals.
 *
 * - List-form generalization of `intervalXorDate`, which is pairwise only.
 * - Implemented as a coverage sweep: each interval contributes a `+1` at its start and a `-1`
 *   the day after its end; the result is every maximal run where the running coverage count is
 *   odd. For two intervals this reduces to exactly `intervalXorDate`'s pairwise result.
 * - Order of the input list does not matter; the result is sorted by start.
 * - Returns `[]` for an empty list, and `[]` when every date is covered an even number of times
 *   (e.g. two identical intervals cancel out).
 * - Returns `[]` when `intervals` is not an array, when any element is not a
 *   `{ start, end }` record of valid ISO PlainDate strings, or when any element has
 *   `start > end`.
 *
 * @param intervals array of `{ start, end }` records
 * @returns array of `{ start, end }` records covered an odd number of times, or `[]` on invalid input
 *
 * @example intervalXorAllDate([{ start: "2024-01-01", end: "2024-01-10" }, { start: "2024-01-05", end: "2024-01-15" }, { start: "2024-01-08", end: "2024-01-20" }]) // [{ start: "2024-01-01", end: "2024-01-04" }, { start: "2024-01-08", end: "2024-01-10" }, { start: "2024-01-16", end: "2024-01-20" }]
 * @example intervalXorAllDate([{ start: "2024-01-01", end: "2024-01-05" }, { start: "2024-01-01", end: "2024-01-05" }]) // [] (identical intervals cancel out)
 * @example intervalXorAllDate([]) // []
 * @example intervalXorAllDate([{ start: "2024-01-10", end: "2024-01-01" }]) // []
 */
export function intervalXorAllDate(
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
        isValidDateInterval(interval.start, interval.end),
    )
  ) {
    return [];
  }

  try {
    const events: Array<{ point: Temporal.PlainDate; delta: number }> = [];

    for (const interval of intervals) {
      const start = Temporal.PlainDate.from(interval.start);
      // The closing event fires the day after `end`, so `end` itself stays covered.
      const closesAfter = Temporal.PlainDate.from(interval.end).add({
        days: 1,
      });

      events.push({ point: start, delta: 1 });
      events.push({ point: closesAfter, delta: -1 });
    }

    events.sort((a, b) => Temporal.PlainDate.compare(a.point, b.point));

    const grouped: Array<{ point: Temporal.PlainDate; delta: number }> = [];
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
    let runStart: Temporal.PlainDate | null = null;

    for (const group of grouped) {
      const previousCoverage = coverage;
      coverage += group.delta;

      if (previousCoverage % 2 === 0 && coverage % 2 === 1) {
        runStart = group.point;
      } else if (previousCoverage % 2 === 1 && coverage % 2 === 0 && runStart) {
        result.push({
          start: runStart.toString(),
          end: group.point.subtract({ days: 1 }).toString(),
        });
        runStart = null;
      }
    }

    return result;
  } catch {
    return [];
  }
}
