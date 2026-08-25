/**
 * Return true when `value` carries a `[u-ca=...]` calendar annotation — either GMT's own
 * native-digit shape or Temporal's own ISO-digit RFC 9557 shape.
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
 */
export function hasCalendarAnnotation(value: string): boolean {
  return typeof value === "string" && value.includes("[u-ca=");
}
