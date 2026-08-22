import { isValidUnixEpochPair } from "../../internal/resolveUnixTimeZone";

/**
 * Return the symmetric difference across a list of Unix epoch intervals — the set of epoch
 * values covered by an odd number of the input intervals.
 *
 * - List-form generalization of `intervalXorUnix`, which is pairwise only.
 * - Implemented as a coverage sweep: each interval contributes a `+1` at its start and a `-1`
 *   one epoch unit after its end; the result is every maximal run where the running coverage
 *   count is odd. For two intervals this reduces to exactly `intervalXorUnix`'s pairwise result.
 * - Order of the input list does not matter; the result is sorted by start.
 * - Returns `[]` for an empty list, and `[]` when every value is covered an even number of
 *   times (e.g. two identical intervals cancel out).
 * - Returns `[]` when `intervals` is not an array, when any element is not a
 *   `{ start, end }` record of finite numeric (or numeric-string) values, or when any element
 *   has `start > end`.
 *
 * @param intervals array of `{ start, end }` records
 * @returns array of `{ start, end }` records covered an odd number of times, or `[]` on invalid input
 *
 * @example intervalXorAllUnix([{ start: 0, end: 1500000000 }, { start: 1400000000, end: 1700000000 }]) // [{ start: 0, end: 1399999999 }, { start: 1500000001, end: 1700000000 }]
 * @example intervalXorAllUnix([]) // []
 */
export function intervalXorAllUnix(
  intervals: Array<{ start: number | string; end: number | string }>,
): Array<{ start: number; end: number }> {
  if (!Array.isArray(intervals) || intervals.length === 0) {
    return [];
  }

  if (
    !intervals.every(
      (interval) =>
        interval &&
        typeof interval === "object" &&
        (typeof interval.start === "number" ||
          typeof interval.start === "string") &&
        (typeof interval.end === "number" || typeof interval.end === "string"),
    )
  ) {
    return [];
  }

  const parsed = intervals.map((interval) => ({
    start:
      typeof interval.start === "number"
        ? interval.start
        : Number(interval.start),
    end: typeof interval.end === "number" ? interval.end : Number(interval.end),
  }));

  if (
    !parsed.every(
      (interval) =>
        isValidUnixEpochPair(interval.start, interval.end) &&
        interval.start <= interval.end,
    )
  ) {
    return [];
  }

  const events: Array<{ point: number; delta: number }> = [];
  for (const interval of parsed) {
    events.push({ point: interval.start, delta: 1 });
    events.push({ point: interval.end + 1, delta: -1 });
  }

  events.sort((a, b) => a.point - b.point);

  const grouped: Array<{ point: number; delta: number }> = [];
  for (const event of events) {
    const last = grouped[grouped.length - 1];
    if (last && last.point === event.point) {
      last.delta += event.delta;
    } else {
      grouped.push(event);
    }
  }

  const result: Array<{ start: number; end: number }> = [];
  let coverage = 0;
  let runStart: number | null = null;

  for (const group of grouped) {
    const previousCoverage = coverage;
    coverage += group.delta;

    if (previousCoverage % 2 === 0 && coverage % 2 === 1) {
      runStart = group.point;
    } else if (
      previousCoverage % 2 === 1 &&
      coverage % 2 === 0 &&
      runStart !== null
    ) {
      result.push({ start: runStart, end: group.point - 1 });
      runStart = null;
    }
  }

  return result;
}
