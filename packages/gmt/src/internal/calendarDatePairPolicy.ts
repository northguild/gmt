import type { Temporal } from "@js-temporal/polyfill";
import type { CalendarSystem } from "../types";
import { parseCalendarDateValue } from "./calendarDateString";
import { calendarSystemOfDateValue } from "./calendarValueOfDate";

export interface CalendarDatePair {
  calendar: CalendarSystem;
  a: Temporal.PlainDate;
  b: Temporal.PlainDate;
}

/**
 * Parse two GMT PlainDate values for calendar-unit arithmetic (diff, count, length, split-by-
 * unit): both must name the same calendar, which the pair is measured in.
 *
 * Follows TC39 Temporal's `DifferenceTemporalPlainDate`: when `CalendarEquals` is false it throws
 * a RangeError, for every `largestUnit`. Calendars are compared by their canonical id, so
 * `ethiopic-amete-alem` and `ethioaa` agree, while `iso8601` and `gregory`, or `ethiopic` and
 * `ethioaa`, do not. A bare ISO string names `iso8601`. Callers catch the throw and return their
 * sentinel. (Before 1.16.0 the pair fell back to ISO; ordering-only functions still accept
 * mixed calendars, because `Temporal.PlainDate.compare` has no calendar check.)
 *
 * Throws if either value fails to parse as a valid GMT PlainDate string, or if the calendars
 * differ — callers validate both values first (e.g. via `isValidCalendarDate`) and wrap this in
 * try-catch, consistent with GMT's gate-then-parse-inside-try structure.
 */
export function parseCalendarDatePairForArithmetic(
  aValue: string,
  bValue: string,
): CalendarDatePair {
  const calendarA = calendarSystemOfDateValue(aValue);
  const calendarB = calendarSystemOfDateValue(bValue);
  const a = parseCalendarDateValue(aValue);
  const b = parseCalendarDateValue(bValue);

  if (!calendarA || calendarA !== calendarB) {
    throw new RangeError(
      `Mismatched calendars: ${String(calendarA)} and ${String(calendarB)}`,
    );
  }

  return { calendar: calendarA, a, b };
}
