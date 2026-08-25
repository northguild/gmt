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
 * unit): measure in the endpoints' shared calendar when both match, fall back to Gregorian/ISO
 * otherwise, rather than rejecting outright.
 *
 * E5 decision of record D5: unlike D4's value-returning interval set-operations (union,
 * intersection, difference, xor, split, divide, merge — which reject a mismatch via
 * `calendarOfAllDateValues` instead, since there's no principled output calendar to pick for a
 * *value* the caller reads back as a date), ordering and duration math both remain well-defined
 * across mismatched calendars: Temporal's own `compare` is calendar-independent, and falling
 * back to ISO for a genuinely mismatched pair is a reasonable, well-defined answer rather than
 * an arbitrary pick.
 *
 * Throws if either value fails to parse as a valid GMT PlainDate string — callers are expected
 * to have already validated both values (e.g. via `isValidCalendarDate`) before calling this,
 * consistent with GMT's existing gate-then-parse-inside-try structure.
 */
export function parseCalendarDatePairForArithmetic(
  aValue: string,
  bValue: string,
): CalendarDatePair {
  const calendarA = calendarSystemOfDateValue(aValue);
  const calendarB = calendarSystemOfDateValue(bValue);
  const a = parseCalendarDateValue(aValue);
  const b = parseCalendarDateValue(bValue);

  if (calendarA && calendarB && calendarA === calendarB) {
    return { calendar: calendarA, a, b };
  }

  return {
    calendar: "gregorian",
    a: a.withCalendar("iso8601"),
    b: b.withCalendar("iso8601"),
  };
}
