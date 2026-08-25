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
 * split-by-unit): measure in the endpoints' shared calendar when both match, fall back to
 * Gregorian/ISO otherwise, rather than rejecting outright. The zoned sibling of
 * `calendarDatePairPolicy.ts`'s `parseCalendarDatePairForArithmetic` (E5 decision D5).
 *
 * The fallback is MORE load-bearing here than in `plain/`, not less.
 * `Temporal.PlainDate.prototype.until` throws across mismatched calendars only for date units;
 * `Temporal.ZonedDateTime.prototype.until` throws for EVERY `largestUnit` — verified, including
 * `"hour"` and `"nanosecond"`. Without this policy, `diffZoned(hebrewValue, islamicValue,
 * "hours")` would return `null` for a question that has nothing to do with either calendar.
 *
 * **Consume the returned `a`/`b`, never the values you parsed them from.** The returned operands
 * are already normalized to the resolved calendar, and every downstream use — including a
 * `Temporal.Duration.prototype.total` `relativeTo` anchor — has to be the normalized one. Feeding
 * a raw calendar-tagged operand to `relativeTo` while measuring in ISO does NOT throw; it returns
 * a plausible-looking wrong number (verified: 12.586… where the correct ISO answer is 12.5666…
 * and the correct Hebrew answer is 13), which no sanity check would catch.
 *
 * Throws if either value fails to parse as a valid GMT ZonedDateTime string — callers are
 * expected to have already validated both values (e.g. via `isValidCalendarZonedDateTime`) before
 * calling this, consistent with GMT's existing gate-then-parse-inside-try structure.
 */
export function parseCalendarZonedPairForArithmetic(
  aValue: string,
  bValue: string,
): CalendarZonedPair {
  const calendarA = calendarSystemOfZonedValue(aValue);
  const calendarB = calendarSystemOfZonedValue(bValue);
  const a = parseCalendarZonedValue(aValue);
  const b = parseCalendarZonedValue(bValue);

  if (calendarA && calendarB && calendarA === calendarB) {
    return { calendar: calendarA, a, b };
  }

  return {
    calendar: "gregorian",
    a: a.withCalendar("iso8601"),
    b: b.withCalendar("iso8601"),
  };
}
