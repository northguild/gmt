import { Temporal } from "@js-temporal/polyfill";
import { halfOpenXor } from "../../internal";
import { isValidDateTimeInterval } from "./validate";

/**
 * Return the symmetric difference across a list of datetime intervals — the set of instants
 * covered by an odd number of the input intervals.
 *
 * - List-form generalization of `intervalXorDateTime`, which is pairwise only.
 * - Half-open: an interval holds every `t` with `start <= t < end`. The result is every maximal
 *   run covered an odd number of times, computed as a coverage-parity sweep over the start and
 *   end boundaries. Runs end exactly at a boundary; no boundary is ever stepped by one unit, so
 *   an interval may end on the type's last value without overflow or midnight wrap.
 * - Touching odd runs join into one run; an empty interval (`start === end`) contributes nothing.
 *   For two intervals this is exactly `intervalXorDateTime`'s pairwise result.
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
 * @example intervalXorAllDateTime([{ start: "2024-01-01T00:00:00", end: "2024-01-10T00:00:00" }, { start: "2024-01-05T00:00:00", end: "2024-01-15T00:00:00" }]) // [{ start: "2024-01-01T00:00:00", end: "2024-01-05T00:00:00" }, { start: "2024-01-10T00:00:00", end: "2024-01-15T00:00:00" }]
 * @example intervalXorAllDateTime([]) // []
 */
export function intervalXorAllDateTime(
  intervals: Array<{ start: string; end: string }>,
): Array<{ start: string; end: string }> {
  try {
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

      return halfOpenXor(parsed, Temporal.PlainDateTime.compare).map(
        ({ start, end }) => ({
          start: start.toString(),
          end: end.toString(),
        }),
      );
    } catch {
      return [];
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return [];
  }
}
