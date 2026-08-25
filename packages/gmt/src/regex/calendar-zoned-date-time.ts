// GMT's own calendar-annotated ZonedDateTime string — the zoned sibling of `calendarDate`
// (regex/calendar-date.ts). Shape:
//
//   <calendar-native-date>T<time><offset>[u-ca=<id>[;era=<era>]][<timeZone>]
//   5784-06-15T14:30:00-05:00[u-ca=hebrew][America/New_York]
//   0031-04-30T12:00:00+09:00[u-ca=japanese;era=heisei][Asia/Tokyo]
//
// The date half (`(\d{4,6})-(\d{2})-(\d{2})`) and the annotation half
// (`\[u-ca=([a-z][a-z0-9-]*)(?:;era=([a-z]+))?\]`) are deliberately byte-identical to
// `calendarDate`'s, so the two grammars cannot drift apart — `calendar-zoned-date-time.test.ts`
// asserts every `convertDateToCalendar` output splices into this pattern.
//
// ---------------------------------------------------------------------------------------
// SEGMENT ORDERING: `[u-ca=...]` comes BEFORE `[timeZone]` — the reverse of RFC 9557.
// ---------------------------------------------------------------------------------------
// This is deliberate and load-bearing, not an oversight, and it must not be "fixed" to match
// Temporal's own string convention. Verified against @js-temporal/polyfill@0.5.1:
//
//  1. GMT's digits are calendar-native (Hebrew year 5784, not ISO year 5784), so a GMT string is
//     never a valid RFC 9557 string in the first place — E1's decision D1. Round-trippability
//     through `Temporal.ZonedDateTime.from` was never achievable, and the `;era=` suffix (below)
//     makes it impossible regardless of ordering.
//  2. RFC 9557's own ordering is actively dangerous here.
//     `Temporal.ZonedDateTime.from("5784-01-01T14:30:00-05:00[America/New_York][u-ca=hebrew]")`
//     SUCCEEDS, silently reading `5784-01-01` as ISO year 5784 — a ~3760-year misparse with no
//     error anywhere. GMT's ordering makes that same string shape uniformly rejected instead:
//     `Temporal.ZonedDateTime.from("...-05:00[u-ca=hebrew][America/New_York]")` throws
//     `RangeError: invalid RFC 9557 string` for all 13 calendars.
//  3. `isValidZonedDateTime` is imported by ~90 non-test files, only ~18 of which are in E7's
//     scope. With `[u-ca=]` first, every out-of-scope function fails closed (returns its
//     sentinel) rather than silently returning an answer computed against the wrong calendar.
//
// The offset stays between the time and the bracketed tail, so `<date>T<time><offset>` remains a
// contiguous, familiar ISO-8601 head; only the bracketed tail reorders.
//
// Capture groups: 1 year, 2 month, 3 day, 4 time, 5 offset (optional), 6 calendar id, 7 era
// (optional), 8 time zone. As with every GMT grammar regex, a match proves SHAPE ONLY — real
// field/calendar/era/zone validation is delegated to `Temporal.*.from(fields, { overflow:
// "reject" })` in `internal/calendarZonedString.ts` (see `context/coding-standards.md`'s scoped
// manual-string-parsing exception, rule 2).
export const calendarZonedDateTime: RegExp =
  /^(\d{4,6})-(\d{2})-(\d{2})T(\d{2}:\d{2}(?::\d{2}(?:[.,]\d{1,9})?)?)((?:[+-]\d{2}:\d{2}(?::\d{2}(?:[.,]\d{1,9})?)?)|[Zz])?\[u-ca=([a-z][a-z0-9-]*)(?:;era=([a-z]+))?\]\[([^[\]]+)\]$/;
