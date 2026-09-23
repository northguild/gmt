import type { Temporal } from "@js-temporal/polyfill";
import type { CalendarSystem } from "../types";
import { calendarSystemOfZonedValue } from "./calendarValueOfZoned";
import { parseCalendarZonedValue } from "./calendarZonedString";

export interface CalendarZonedPair {
  calendar: CalendarSystem;
  a: Temporal.ZonedDateTime;
  b: Temporal.ZonedDateTime;
}

/**
 * Parse two GMT ZonedDateTime values for calendar-unit arithmetic (diff, count, length,
 * split-by-unit): both must name the same calendar, which the pair is measured in. The zoned
 * sibling of `calendarDatePairPolicy.ts`'s `parseCalendarDatePairForArithmetic`.
 *
 * Follows TC39 Temporal's `DifferenceTemporalZonedDateTime`: when `CalendarEquals` is false it
 * throws a RangeError, for every `largestUnit`, `"hour"` and `"nanosecond"` included (native
 * Temporal agrees). Calendars are compared by their canonical id; a bare ISO string names
 * `iso8601`. Callers catch the throw and return their sentinel. (Before 1.16.0 the pair fell
 * back to ISO; ordering-only functions still accept mixed calendars, because
 * `Temporal.ZonedDateTime.compare` has no calendar check.)
 *
 * Throws if either value fails to parse as a valid GMT ZonedDateTime string, or if the calendars
 * differ — callers validate both values first (e.g. via `isValidCalendarZonedDateTime`) and wrap
 * this in try-catch, consistent with GMT's gate-then-parse-inside-try structure.
 */
export function parseCalendarZonedPairForArithmetic(
  aValue: string,
  bValue: string,
): CalendarZonedPair {
  const calendarA = calendarSystemOfZonedValue(aValue);
  const calendarB = calendarSystemOfZonedValue(bValue);
  const a = parseCalendarZonedValue(aValue);
  const b = parseCalendarZonedValue(bValue);

  if (!calendarA || calendarA !== calendarB) {
    throw new RangeError(
      `Mismatched calendars: ${String(calendarA)} and ${String(calendarB)}`,
    );
  }

  return { calendar: calendarA, a, b };
}
