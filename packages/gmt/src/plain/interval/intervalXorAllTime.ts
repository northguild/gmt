import { Temporal } from "@js-temporal/polyfill";
import { halfOpenXor } from "../../internal";
import { isValidTimeInterval } from "./validate";

/**
 * Return the symmetric difference across a list of time intervals — the set of clock times
 * covered by an odd number of the input intervals.
 *
 * - List-form generalization of `intervalXorTime`, which is pairwise only.
 * - Half-open: an interval holds every `t` with `start <= t < end`. The result is every maximal
 *   run covered an odd number of times, computed as a coverage-parity sweep over the start and
 *   end boundaries. Runs end exactly at a boundary; no boundary is ever stepped by one unit, so
 *   an interval may end on the type's last value without overflow or midnight wrap.
 * - Touching odd runs join into one run; an empty interval (`start === end`) contributes nothing.
 *   For two intervals this is exactly `intervalXorTime`'s pairwise result.
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
 * @example intervalXorAllTime([{ start: "09:00:00", end: "12:00:00" }, { start: "11:00:00", end: "15:00:00" }]) // [{ start: "09:00:00", end: "11:00:00" }, { start: "12:00:00", end: "15:00:00" }]
 * @example intervalXorAllTime([{ start: "22:00:00", end: "23:59:59.999999999" }, { start: "23:00:00", end: "23:30:00" }]) // [{ start: "22:00:00", end: "23:00:00" }, { start: "23:30:00", end: "23:59:59.999999999" }]
 * @example intervalXorAllTime([]) // []
 */
export function intervalXorAllTime(
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

      return halfOpenXor(parsed, Temporal.PlainTime.compare).map(
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
