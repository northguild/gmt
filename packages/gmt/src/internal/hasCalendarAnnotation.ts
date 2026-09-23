/** A `[u-ca=` calendar annotation, with or without RFC 9557's critical flag (`[!u-ca=`). */
const calendarAnnotation = /\[!?u-ca=/;

/**
 * Return true when `value` carries a `[u-ca=...]` calendar annotation, in any position.
 *
 * RFC 9557 lets any suffix annotation carry a critical flag (§3.3; `critical-flag` in the §4.1
 * ABNF), and Temporal honours it for the calendar key:
 * `Temporal.ZonedDateTime.from("5784-01-01T14:30:00-05:00[America/New_York][!u-ca=hebrew]")`
 * succeeds in the Hebrew calendar, reading ISO year 5784 as Hebrew year 9544. The flag only makes
 * the annotation harder to ignore, so `[!u-ca=...]` is detected exactly like `[u-ca=...]`. A
 * critical time-zone annotation (`[!America/New_York]`) carries no key and does not match.
 * Temporal rejects an upper-case `[U-CA=` key outright, so it needs no special case.
 *
 * Since CORE-8 (#22) the non-calendar validators no longer use it: `isValidDate`,
 * `isValidDateTime`, `isValidZonedDateTime` and `isValidZonedRange` read the calendar Temporal
 * reads (`calendarId === "iso8601"`), and instants ignore the annotation as `Temporal.Instant.from`
 * does. It remains a routing test: does a string name a calendar at all?
 *
 * So this predicate answers exactly one question — "does this string carry an annotation at all?"
 * — and says nothing about whether the caller should accept it.
 *
 * @param value candidate ISO 8601 string
 * @returns true when a calendar annotation is present, critical or not
 *
 * @example hasCalendarAnnotation("2024-02-10T12:00:00Z[u-ca=hebrew]") // true
 * @example hasCalendarAnnotation("2024-02-10T12:00:00Z[!u-ca=hebrew]") // true (critical flag)
 * @example hasCalendarAnnotation("2024-02-10T12:00:00-05:00[!America/New_York]") // false (a zone, not a calendar)
 */
export function hasCalendarAnnotation(value: string): boolean {
  return typeof value === "string" && calendarAnnotation.test(value);
}
