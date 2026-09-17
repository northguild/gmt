/** A `[u-ca=` calendar annotation, with or without RFC 9557's critical flag (`[!u-ca=`). */
const calendarAnnotation = /\[!?u-ca=/;

/**
 * Return true when `value` carries a `[u-ca=...]` calendar annotation — either GMT's own
 * native-digit shape or Temporal's own ISO-digit RFC 9557 shape.
 *
 * RFC 9557 lets any suffix annotation carry a critical flag (§3.3; `critical-flag` in the §4.1
 * ABNF), and Temporal honours it for the calendar key:
 * `Temporal.ZonedDateTime.from("5784-01-01T14:30:00-05:00[America/New_York][!u-ca=hebrew]")`
 * succeeds in the Hebrew calendar, reading ISO year 5784 as Hebrew year 9544. The flag only makes
 * the annotation harder to ignore, so `[!u-ca=...]` is detected exactly like `[u-ca=...]`. A
 * critical time-zone annotation (`[!America/New_York]`) carries no key and does not match.
 * Temporal rejects an upper-case `[U-CA=` key outright, so it needs no special case.
 *
 * The implementation has not changed since E5; its *meaning* has, because `zoned/` is no longer
 * uniform. Current usage, after E7 (issue #152):
 *
 * - **`utc/`** (already regex-gated to a strict `<date>T<time>Z` shape) and **`unix/`** (numeric
 *   input, structurally immune) reject every annotation, exactly as they always have.
 * - **`isValidZonedDateTime`** still rejects every annotation, and the ~72 `zoned/` functions
 *   gated on it therefore still do too. That gate is deliberately left alone: loosening it would
 *   make `isValidZonedDateTime(x) === true` while e.g. `getZonedYear(x) === null`, i.e. a
 *   validator certifying strings its own namespace refuses.
 * - **The ~18 calendar-aware `zoned/` functions** added by E7 gate on the parallel
 *   `isValidCalendarZonedDateTime`/`isValidCalendarZonedInterval` instead, which ACCEPT GMT's
 *   `<date>T<time><offset>[u-ca=...][timeZone]` grammar and reject only Temporal's own segment
 *   ordering. Those paths use `internal/calendarValueOfZoned.ts` and
 *   `internal/calendarZonedString.ts`, not this predicate.
 * - **`plain/`** `PlainDate` functions accept GMT's annotated shape via `isValidCalendarDate`
 *   (E5's D1); `plain/` `PlainDateTime`/`PlainTime` functions have no annotated grammar of their
 *   own and treat one as invalid input.
 *
 * So this predicate answers exactly one question — "does this string carry an annotation at all?"
 * — and says nothing about whether the caller should accept it. Reach for it only where the
 * answer is "reject unconditionally".
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
