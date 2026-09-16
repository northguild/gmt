/**
 * RegExp matching an RFC 3339 §5.6 date-time: ISO 8601 with a mandatory offset
 * (`Z` or `±HH:MM`).
 *
 * - Separator may be `T`, `t`, or a space.
 * - Offset is mandatory. GMT's own zoned strings with a bracketed IANA zone annotation
 *   (`"...+00:00[UTC]"`) do NOT match — use `calendarZonedDateTime` for those.
 * - Offset hour `00`–`23` and minute `00`–`59` (§5.6 `time-numoffset`).
 * - Two GMT restrictions narrower than the grammar: second `60` does not match (§5.6
 *   `time-second` admits it; GMT rejects leap seconds because Temporal would read one as
 *   `:59`), and the fraction is capped at 9 digits (`time-secfrac` is `1*DIGIT`; Temporal keeps
 *   nanoseconds).
 * - Shape-only validation; real calendar validation is delegated to
 *   `Temporal.PlainDateTime.from(...).toZonedDateTime(offset)` in `parseRfc3339`.
 * - Capture groups: 1 year, 2 month, 3 day, 4 hour, 5 minute, 6 second,
 *   7 fractional (optional), 8 offset.
 *
 * @example rfc3339DateTime.test("2024-03-15T14:30:00-04:00")      // true
 * @example rfc3339DateTime.test("2024-03-15t14:30:00z")           // true
 * @example rfc3339DateTime.test("2024-03-15 14:30:00Z")           // true (space separator)
 * @example rfc3339DateTime.test("2024-03-15T14:30:00")           // false (no offset)
 * @example rfc3339DateTime.test("2024-03-15T14:30:00+00:00[UTC]") // false (bracketed zone)
 * @example rfc3339DateTime.test("2024-3-15T14:30:00Z")            // false (unpadded)
 * @example rfc3339DateTime.test("2024-03-15T14:30:00+24:00")      // false (offset hour out of range)
 * @example rfc3339DateTime.test("2016-12-31T23:59:60Z")           // false (leap second; GMT rejects it)
 */
export const rfc3339DateTime: RegExp =
  /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])[Tt ](0[0-9]|1[0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])(\.[0-9]{1,9})?(Z|z|[+-](?:[01][0-9]|2[0-3]):[0-5][0-9])$/;
