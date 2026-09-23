// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { Temporal } from "@js-temporal/polyfill";
import {
  calendarOfAllZonedValues,
  formatZonedInCalendar,
  halfOpenXor,
  parseCalendarZonedValue,
} from "../../internal";
import { isValidCalendarZonedInterval } from "./validate";

/**
 * Return the symmetric difference across a list of zoned intervals — the set of instants
 * covered by an odd number of the input intervals.
 *
 * - List-form generalization of `intervalXorZoned`, which is pairwise only.
 * - Intervals are half-open `[start, end)`. The result is every maximal run of instants where the
 *   coverage count is odd, so touching runs join and an empty interval (`start` and `end` the same
 *   instant) changes nothing. Every boundary is an input's own `start` or `end`; none is stepped
 *   by a nanosecond, so an interval may end on the last representable instant. For two intervals
 *   this is exactly `intervalXorZoned`'s pairwise result.
 * - Output boundaries carry the time zone of whichever input interval contributed them (the
 *   earlier one in the list on a tie).
 * - Order of the input list does not matter; the result is sorted by start instant.
 * - Returns `[]` for an empty list, and `[]` when every instant is covered an even number of
 *   times (e.g. two identical intervals cancel out).
 * - Returns `[]` when `intervals` is not an array, when any element is not a
 *   `{ start, end }` record of valid ISO ZonedDateTime strings, or when any element has
 *   `start > end` or a leap-second string.
 * - Accepts RFC 9557 calendar-annotated zoned strings (as produced by `convertZonedToCalendar`) as
 *   well as bare ISO ones — E7 (issue #152) — but **rejects a mismatched set**: every endpoint in
 *   the list must name the same calendar system (E7's D4-zoned). This function returns *values*
 *   the caller reads back as datetimes, and an array whose elements carried different calendar
 *   tags would be unreadable as a set. A mismatch returns `[]`.
 * - Output boundaries are re-derived in the resolved calendar via `formatZonedInCalendar`, never
 *   copied from an input string (E7's D7-zoned).
 *
 * @param intervals array of `{ start, end }` records
 * @returns array of `{ start, end }` records covered an odd number of times, or `[]` on invalid input
 *
 * @example intervalXorAllZoned([{ start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-01-10T00:00:00+00:00[UTC]" }, { start: "2024-01-05T00:00:00+00:00[UTC]", end: "2024-01-15T00:00:00+00:00[UTC]" }]) // [{ start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-01-05T00:00:00+00:00[UTC]" }, { start: "2024-01-10T00:00:00+00:00[UTC]", end: "2024-01-15T00:00:00+00:00[UTC]" }]
 * @example intervalXorAllZoned([]) // []
 */
export function intervalXorAllZoned(
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
          typeof interval.start === "string" &&
          typeof interval.end === "string" &&
          isValidCalendarZonedInterval(interval.start, interval.end),
      )
    ) {
      return [];
    }

    // D4-zoned reject gate: every endpoint across every interval must agree on a calendar, or there
    // is no calendar to express the returned boundaries in.
    const calendar = calendarOfAllZonedValues(
      intervals.flatMap((interval) => [interval.start, interval.end]),
    );
    if (!calendar) {
      return [];
    }

    try {
      const parsed = intervals.map((interval) => ({
        start: parseCalendarZonedValue(interval.start),
        end: parseCalendarZonedValue(interval.end),
      }));

      // Ordering and grouping use `Temporal.ZonedDateTime.compare`, which compares epoch nanoseconds
      // only — calendar- and zone-blind, unlike `ZonedDateTime.prototype.equals`. Each boundary stays
      // the ZonedDateTime of the input that contributed it, so it is formatted in that input's zone.
      return halfOpenXor(parsed, Temporal.ZonedDateTime.compare).map(
        ({ start, end }) => ({
          start: formatZonedInCalendar(start, calendar),
          end: formatZonedInCalendar(end, calendar),
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
