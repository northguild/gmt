import { Temporal } from "@js-temporal/polyfill";
import { isLeapSecond } from "../../plain/validate/isLeapSecond";
import { isValidZonedInterval } from "./validate";

/**
 * Return the symmetric difference across a list of zoned intervals — the set of instants
 * covered by an odd number of the input intervals.
 *
 * - List-form generalization of `intervalXorZoned`, which is pairwise only.
 * - Implemented as a coverage sweep over instants: each interval contributes a `+1` at its
 *   start instant and a `-1` one nanosecond after its end instant; the result is every maximal
 *   run where the running coverage count is odd. For two intervals this reduces to exactly
 *   `intervalXorZoned`'s pairwise result.
 * - Output boundaries carry the time zone of whichever input interval contributed them.
 * - Order of the input list does not matter; the result is sorted by start instant.
 * - Returns `[]` for an empty list, and `[]` when every instant is covered an even number of
 *   times (e.g. two identical intervals cancel out).
 * - Returns `[]` when `intervals` is not an array, when any element is not a
 *   `{ start, end }` record of valid ISO ZonedDateTime strings, or when any element has
 *   `start > end` or a leap-second string.
 *
 * @param intervals array of `{ start, end }` records
 * @returns array of `{ start, end }` records covered an odd number of times, or `[]` on invalid input
 *
 * @example intervalXorAllZoned([{ start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-01-10T00:00:00+00:00[UTC]" }, { start: "2024-01-05T00:00:00+00:00[UTC]", end: "2024-01-15T00:00:00+00:00[UTC]" }]) // [{ start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-01-04T23:59:59.999999999+00:00[UTC]" }, { start: "2024-01-10T00:00:00.000000001+00:00[UTC]", end: "2024-01-15T00:00:00+00:00[UTC]" }]
 * @example intervalXorAllZoned([]) // []
 */
export function intervalXorAllZoned(
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
        isValidZonedInterval(interval.start, interval.end),
    )
  ) {
    return [];
  }

  try {
    const events: Array<{
      instant: Temporal.Instant;
      boundary: Temporal.ZonedDateTime;
      delta: number;
    }> = [];

    for (const interval of intervals) {
      const startVal = Temporal.ZonedDateTime.from(interval.start);
      const endVal = Temporal.ZonedDateTime.from(interval.end);
      const closesAfter = endVal.toInstant().add({ nanoseconds: 1 });

      events.push({
        instant: startVal.toInstant(),
        boundary: startVal,
        delta: 1,
      });
      events.push({
        instant: closesAfter,
        boundary: closesAfter.toZonedDateTimeISO(endVal.timeZoneId),
        delta: -1,
      });
    }

    events.sort((a, b) => Temporal.Instant.compare(a.instant, b.instant));

    const grouped: typeof events = [];
    for (const event of events) {
      const last = grouped[grouped.length - 1];
      if (last && last.instant.equals(event.instant)) {
        last.delta += event.delta;
      } else {
        grouped.push(event);
      }
    }

    const result: Array<{ start: string; end: string }> = [];
    let coverage = 0;
    let runStart: Temporal.ZonedDateTime | null = null;

    for (const group of grouped) {
      const previousCoverage = coverage;
      coverage += group.delta;

      if (previousCoverage % 2 === 0 && coverage % 2 === 1) {
        runStart = group.boundary;
      } else if (previousCoverage % 2 === 1 && coverage % 2 === 0 && runStart) {
        result.push({
          start: runStart.toString(),
          end: group.instant
            .subtract({ nanoseconds: 1 })
            .toZonedDateTimeISO(group.boundary.timeZoneId)
            .toString(),
        });
        runStart = null;
      }
    }

    return result;
  } catch {
    return [];
  }
}
