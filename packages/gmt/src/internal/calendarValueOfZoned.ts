import type { CalendarSystem } from "../types";
import { canonicalCalendarSystem } from "./calendarSystemIds";
import { hasCalendarAnnotation } from "./hasCalendarAnnotation";
import { zonedDateTimeFrom } from "./zonedWallClock";

/**
 * Determine which CalendarSystem a GMT ZonedDateTime string is expressed in: `"iso8601"` for a
 * string with no `u-ca` annotation, the canonical id of the calendar Temporal reads from the
 * annotations otherwise (as `convertZonedToCalendar` writes them; in `[u-ca=hebrew][u-ca=roc]` the
 * first annotation wins), or `null` when the string does not parse or GMT does not support that
 * calendar.
 *
 * Kept as its own file rather than an overload of `calendarValueOfDate.ts` because the parse
 * differs: a zoned string goes to `zonedDateTimeFrom`. The offset is ignored for this read (the
 * calendar does not depend on it), so a caller's own `offset` option still decides whether the
 * value itself is accepted.
 *
 * Does not itself validate the value — pair with `parseCalendarZonedValue` (which throws on
 * invalid input) for full validation. Callers are expected to have already confirmed `value` is
 * valid (e.g. via `isValidCalendarZonedDateTime`) before relying on this.
 *
 * Part of E7 (issue #152)'s calendar-aware `zoned/` gate.
 */
export function calendarSystemOfZonedValue(
  value: string,
): CalendarSystem | null {
  if (!hasCalendarAnnotation(value)) {
    return "iso8601";
  }
  try {
    return canonicalCalendarSystem(
      zonedDateTimeFrom(value, { offset: "ignore" }).calendarId,
    );
  } catch {
    return null;
  }
}

/**
 * N-ary generalization of `calendarSystemOfZonedValue` for list-form functions
 * (`mergeIntervalsZoned`, `intervalXorAllZoned`, `intervalSplitAtZoned`'s `points`, and the
 * four-endpoint pairwise set operations): returns the shared CalendarSystem when every value
 * names the same calendar, or `null` on any mismatch or unsupported identifier. An empty list is
 * treated as `"iso8601"` (the identity/no-op case).
 *
 * This is E7's D4-zoned reject gate for the eight value-returning interval set operations. A
 * "winning endpoint's tag survives" policy was considered and rejected: four of the eight return
 * ARRAYS, so a per-element copied tag would produce a result set whose members disagree about
 * which calendar they are in — unreadable as a set. `intervalUnionZoned`'s existing "winning
 * endpoint's time zone wins" behavior is not precedent for this; that is about the zone, which is
 * a property of the surviving point, not about the calendar, which is a property of the answer.
 */
export function calendarOfAllZonedValues(
  values: readonly string[],
): CalendarSystem | null {
  if (values.length === 0) {
    return "iso8601";
  }
  const first = calendarSystemOfZonedValue(values[0]);
  if (!first) {
    return null;
  }
  return values.every((value) => calendarSystemOfZonedValue(value) === first)
    ? first
    : null;
}
