/**
 * Return true when `value` carries a `[u-ca=...]` calendar annotation — either GMT's own
 * native-digit shape or Temporal's own ISO-digit RFC 9557 shape.
 *
 * Used by `zoned/`, `utc/`, and `unix/` validators to reject calendar-tagged input per the E5
 * (issue #78) decision record: calendar-system awareness is confined to `plain/` `PlainDate`
 * values (D1). `zoned/` previously accepted the annotation by accident (nothing gated it) and
 * did genuinely calendar-aware — but undocumented and untested — arithmetic; D2 removes that
 * rather than blessing it, so `zoned/` now rejects the annotation outright, the same as `utc/`
 * (already regex-gated to reject it) and `unix/` (numeric input, structurally immune) always
 * have.
 */
export function hasCalendarAnnotation(value: string): boolean {
  return typeof value === "string" && value.includes("[u-ca=");
}
