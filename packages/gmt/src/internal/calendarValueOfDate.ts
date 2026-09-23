import { Temporal } from "@js-temporal/polyfill";
import type { CalendarSystem } from "../types";
import { canonicalCalendarSystem } from "./calendarSystemIds";
import { hasCalendarAnnotation } from "./hasCalendarAnnotation";

/**
 * Determine which CalendarSystem a GMT PlainDate string is expressed in: `"iso8601"` for a string
 * with no `u-ca` annotation, the canonical id of the calendar Temporal reads from the annotations
 * otherwise (`[u-ca=HEBREW]` is `"hebrew"`, `[u-ca=ethiopic-amete-alem]` is `"ethioaa"`, and in
 * `[u-ca=hebrew][u-ca=roc]` the first annotation wins), or `null` when the annotations do not
 * parse or GMT does not support that calendar.
 *
 * Does not itself validate the date — pair with `parseCalendarDateValue` (which throws on invalid
 * input) for full validation. Callers are expected to have already confirmed `value` is valid
 * (e.g. via `isValidCalendarDate`) before relying on this.
 */
export function calendarSystemOfDateValue(
  value: string,
): CalendarSystem | null {
  if (!hasCalendarAnnotation(value)) {
    return "iso8601";
  }
  try {
    return canonicalCalendarSystem(Temporal.PlainDate.from(value).calendarId);
  } catch {
    return null;
  }
}

/**
 * N-ary generalization of `calendarSystemOfDateValue` for list-form functions
 * (`mergeIntervalsDate`, `intervalXorAllDate`, `intervalSplitAtDate`'s `points`): returns the
 * shared CalendarSystem when every value names the same calendar, or `null` on any mismatch or
 * unsupported identifier. An empty list is treated as `"iso8601"` (the identity/no-op case).
 */
export function calendarOfAllDateValues(
  values: readonly string[],
): CalendarSystem | null {
  if (values.length === 0) {
    return "iso8601";
  }
  const first = calendarSystemOfDateValue(values[0]);
  if (!first) {
    return null;
  }
  return values.every((value) => calendarSystemOfDateValue(value) === first)
    ? first
    : null;
}
