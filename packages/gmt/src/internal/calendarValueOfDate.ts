import { calendarDate } from "../regex";
import type { CalendarSystem } from "../types";
import { isCalendarSystem } from "./calendarSystemIds";

/**
 * Determine which CalendarSystem a GMT PlainDate string is expressed in: `"gregorian"` for a
 * bare (non-annotated) string, the tagged CalendarSystem for a calendar-annotated string (as
 * produced by `convertDateToCalendar`), or `null` when the annotation names an unrecognized
 * calendar identifier.
 *
 * Does not itself validate overall shape or field values — pair with `parseCalendarDateValue`
 * (which throws on invalid input) for full validation. Callers are expected to have already
 * confirmed `value` is valid (e.g. via `isValidCalendarDate`) before relying on this.
 *
 * Part of E5 (issue #78)'s calendar-aware `plain/` gate — see the E5 decisions of record for
 * why calendar-system awareness is confined to `plain/` `PlainDate` values (D1).
 */
export function calendarSystemOfDateValue(
  value: string,
): CalendarSystem | null {
  const match = calendarDate.exec(value);
  if (!match) {
    return "gregorian";
  }
  const [, , , , calendarId] = match;
  return isCalendarSystem(calendarId) ? calendarId : null;
}

/**
 * N-ary generalization of `calendarSystemOfDateValue` for list-form functions
 * (`mergeIntervalsDate`, `intervalXorAllDate`, `intervalSplitAtDate`'s `points`): returns the
 * shared CalendarSystem when every value carries the same tag, or `null` on any mismatch or
 * unrecognized identifier. An empty list is treated as `"gregorian"` (the identity/no-op case).
 */
export function calendarOfAllDateValues(
  values: readonly string[],
): CalendarSystem | null {
  if (values.length === 0) {
    return "gregorian";
  }
  const first = calendarSystemOfDateValue(values[0]);
  if (!first) {
    return null;
  }
  return values.every((value) => calendarSystemOfDateValue(value) === first)
    ? first
    : null;
}
