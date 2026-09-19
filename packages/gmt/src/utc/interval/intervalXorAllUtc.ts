import { Temporal } from "@js-temporal/polyfill";
import { halfOpenXor } from "../../internal";
import { isValidUtcInterval } from "./validate";

/**
 * Return the symmetric difference across a list of UTC intervals — the set of instants covered
 * by an odd number of the input intervals.
 *
 * - List-form generalization of `intervalXorUtc`, which is pairwise only.
 * - Half-open: an interval holds every `t` with `start <= t < end`. The result is every maximal
 *   run covered an odd number of times, computed as a coverage-parity sweep over the start and
 *   end boundaries. Runs end exactly at a boundary; no boundary is ever stepped by one unit, so
 *   an interval may end on the type's last value without overflow or midnight wrap.
 * - Touching odd runs join into one run; an empty interval (`start === end`) contributes nothing.
 *   For two intervals this is exactly `intervalXorUtc`'s pairwise result.
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
 * @example intervalXorAllUtc([{ start: "2024-01-01T09:00:00Z", end: "2024-01-01T13:00:00Z" }, { start: "2024-01-01T12:00:00Z", end: "2024-01-01T17:00:00Z" }]) // [{ start: "2024-01-01T09:00:00Z", end: "2024-01-01T12:00:00Z" }, { start: "2024-01-01T13:00:00Z", end: "2024-01-01T17:00:00Z" }]
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

    return halfOpenXor(parsed, Temporal.Instant.compare).map(
      ({ start, end }) => ({
        start: start.toString(),
        end: end.toString(),
      }),
    );
  } catch {
    return [];
  }
}
