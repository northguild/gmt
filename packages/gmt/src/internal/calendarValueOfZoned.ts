import { calendarZonedDateTime } from "../regex";
import type { CalendarSystem } from "../types";
import { isCalendarSystem } from "./calendarSystemIds";
import { hasCalendarAnnotation } from "./hasCalendarAnnotation";

/**
 * Determine which CalendarSystem a GMT ZonedDateTime string is expressed in: `"gregorian"` for a
 * bare (non-annotated) ISO zoned string, the tagged CalendarSystem for a GMT calendar-annotated
 * zoned string (as produced by `convertZonedToCalendar`), or `null` when the annotation names an
 * unrecognized calendar identifier.
 *
 * Kept as its own file rather than an overload of `calendarValueOfDate.ts` because the two differ
 * on both axes that matter: the regex (zoned carries a time, an offset and a `[timeZone]`
 * segment) and the non-matching fallback. `calendarSystemOfDateValue` reports `"gregorian"` for
 * ANY non-match, which is safe there because `plain/`'s only annotated shape is the one its regex
 * accepts. In `zoned/` a non-matching string may still carry `[u-ca=...]` — Temporal's own
 * RFC 9557 ordering, or a wrong-ordered GMT string — and calling either of those `"gregorian"`
 * would hand a caller a Gregorian answer for a string that visibly asked for something else. Those
 * fail closed with `null` instead.
 *
 * Does not itself validate overall shape or field values — pair with `parseCalendarZonedValue`
 * (which throws on invalid input) for full validation. Callers are expected to have already
 * confirmed `value` is valid (e.g. via `isValidCalendarZonedDateTime`) before relying on this.
 *
 * Part of E7 (issue #152)'s calendar-aware `zoned/` gate.
 */
export function calendarSystemOfZonedValue(
  value: string,
): CalendarSystem | null {
  const match = calendarZonedDateTime.exec(value);
  if (!match) {
    return hasCalendarAnnotation(value) ? null : "gregorian";
  }
  const [, , , , , , calendarId] = match;
  return isCalendarSystem(calendarId) ? calendarId : null;
}

/**
 * N-ary generalization of `calendarSystemOfZonedValue` for list-form functions
 * (`mergeIntervalsZoned`, `intervalXorAllZoned`, `intervalSplitAtZoned`'s `points`, and the
 * four-endpoint pairwise set operations): returns the shared CalendarSystem when every value
 * carries the same tag, or `null` on any mismatch or unrecognized identifier. An empty list is
 * treated as `"gregorian"` (the identity/no-op case).
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
    return "gregorian";
  }
  const first = calendarSystemOfZonedValue(values[0]);
  if (!first) {
    return null;
  }
  return values.every((value) => calendarSystemOfZonedValue(value) === first)
    ? first
    : null;
}
