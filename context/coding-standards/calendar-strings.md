# Coding Standards: Calendar-Annotated Strings

### Calendar-annotated strings are RFC 9557 (E1, E7)

A calendar string is the RFC 9557 form Temporal writes: the ISO 8601 date (or zoned datetime),
then a `[u-ca=<id>]` annotation. The digits are always ISO; the annotation names the calendar the
date is presented in (RFC 9557 §3.3). Output is exactly `Temporal.PlainDate#toString()` /
`Temporal.ZonedDateTime#toString()` with `calendarName: "auto"`: no annotation for `iso8601`,
`[u-ca=<id>]` for every other calendar, `gregory` included. Eras, calendar years and month codes
are read values, never string content.

- **`plain/` `PlainDate`** — `regex/calendar-date.ts`: `<date>[u-ca=<id>]`. Year is Temporal's
  `DateYear` (four digits, or a sign and six; `-000000` rejected). Parsed by
  `internal/calendarDateString.ts` (`hasCalendarDateShape`: GMT's strict date or date-time shape, with at most one `u-ca`
  annotation after it, over the whole string, then `Temporal.PlainDate.from`), written by
  `internal/formatDateInCalendar.ts`.
- **`zoned/`** — `regex/calendar-zoned-date-time.ts`: `<date>T<time><offset>[<timeZone>][u-ca=<id>]`,
  the calendar annotation after the zone (RFC 9557 §4.1). Parsed by `internal/calendarZonedString.ts`
  (`hasCalendarZonedShape`: GMT's strict zoned shape with the one zone bracket and at most one
  `u-ca` after it, over the whole string, then `zonedDateTimeFrom`), written by `formatZonedInCalendar`.
- **The annotation.** A `u-ca` annotation, lower-case key, optionally critical (`[!u-ca=…]`). The
  id goes to Temporal's `CanonicalizeCalendar` (`internal/calendarSystemIds.ts`
  `canonicalCalendarSystem`), which folds case and CLDR aliases (`islamicc` → `islamic-civil`,
  `ethiopic-amete-alem` → `ethioaa`), and must be a `CalendarSystem`.
- **No other annotation is read.** The calendar-aware readers take the body plus at most one
  `u-ca` (with the zone bracket first, for a zoned value). A time zone annotation on a date, an
  elective annotation (`[foo=bar]`), a second `u-ca`, an unknown critical annotation, a calendar
  before the zone and `;era=` are rejected, although `Temporal.PlainDate.from` reads some of them.
- **A plain calendar date-time is read as its date**, as `Temporal.PlainDate.from` reads it
  (decision of 2026-09-17; replaces E5 / issue #78's date-only rule).
  `"2024-10-03T14:30[u-ca=hebrew]"` is 2024-10-03 in Hebrew, and a bare date-time is its ISO date:
  the time is dropped. The date or date-time must match GMT's strict `plainDate` or
  `plainDateTime` shape, as `isValidDate`/`isValidDateTime` require, and the string ends after the
  one `u-ca` annotation, before Temporal reads it (`internal/calendarDateString.ts`): basic format, a space or lower-case `t`
  separator, a UTC offset or designator, and a leap second (second `60`) are rejected, although
  `Temporal.PlainDate.from` reads all but the designator. Output is always the date
  (`Temporal.PlainDate#toString()`).
- **The same strict extended shape gates every zoned, UTC, instant and `relativeTo` string**
  (`internal/isoStringBody.ts`), each over the whole string: a zoned string is
  `<date>T<time>`, then nothing, `Z` or `±HH:MM[:SS[.fraction]]`, then one zone bracket
  (`hasZonedDateTimeShape`); an instant is the same with the `Z` or offset required and no bracket
  (`hasInstantShape`); a UTC string ends in an upper-case `Z`; and a `relativeTo` is the zoned shape
  (with at most one `u-ca` after the zone) when it has a time zone annotation, otherwise a
  `plainDate`/`plainDateTime` with at most one `u-ca`; basic
  format, a space or lower-case `t` separator, a lower-case `z`, an hour-only time or offset and a
  zoned date without a time are rejected although Temporal reads them.
  A zone bracket is an RFC 9557 §4.1 `time-zone`, `TIME_ZONE_ANNOTATION`: an IANA name (`/`-joined
  parts, each starting with a letter, `.` or `_`) or an extended-form offset `±HH:MM` (RFC 3339
  §5.6); `[+0200]`, `[+02]`, spaces and a second `[` are rejected.
- **A plain time is a bare `HH:MM[:SS[.fraction]]`** (`plainTime`): a leading time designator
  (`"T14:30"`, `"t14:30"`) is rejected, although `Temporal.PlainTime.from` reads it. The `T`
  designator belongs to date-time strings, where it separates the date from the time; GMT's strict
  extended-body rule takes the time on its own without it.
- **Calendar ids** are the canonical CLDR `bcp47/calendar.xml` / Temporal ids, in strings and as
  function arguments: `iso8601`, `gregory`, `hebrew`, `islamic-civil`, `islamic-tbla`,
  `islamic-umalqura`, `japanese`, `buddhist`, `roc`, `persian`, `indian`, `ethiopic`, `ethioaa`,
  `coptic` (the Intl Era and Month Code proposal's `table-calendar-types` without `chinese` and
  `dangi`, which GMT does not support; `islamic` and `islamic-rgsa` are not supported either).
  `gregorian`, `taiwan` and `islamic-tabular` are not calendar ids and return the sentinel. The
  alias table is Temporal's, asked of the polyfill, never a GMT copy.
- **No converter from the pre-1.16.0 calendar-native-digit strings.** No standard defines them, and
  most are also valid RFC 9557 strings, so the two readings cannot be told apart. Do not add
  heuristic detection; a stored old string is regenerated from its ISO date.
- **`ethiopic` and `coptic` compute in `ethioaa`** (`computationCalendarId`): polyfill 0.5.1 cannot
  read their fields under ICU ≥ 78, and the three share months, days and arithmetic, differing by a
  constant year. A parsed value therefore carries `ethioaa`; code that writes a string back takes the
  calendar from `calendarSystemOfDateValue` / `calendarSystemOfZonedValue`, never from `calendarId`.
- **Where it is accepted.** `plain/`: `isValidCalendarDate` and the functions gated on it
  (`convertDateToCalendar`, `addDate`, `subtractDate`, `diffDate`, `diffDateAsDuration`, the
  `Date`-suffixed `plain/interval/*`), plus `duration/`'s `relativeTo` (`internal/resolveDurationRelativeTo.ts`,
  which also accepts the zoned form). `zoned/`: `isValidCalendarZonedDateTime` /
  `isValidCalendarZonedInterval` and the functions gated on them (`convertZonedToCalendar`,
  `addZoned`, `subtractZoned`, `diffZoned`, `diffZonedAsDuration`, `zoned/interval/*`). Every other
  `zoned/` function, and `isValidZonedDateTime`, takes the zoned body and the zone bracket only: any
  further annotation, `[u-ca=iso8601]` included, is rejected, so a validator never certifies a
  string its own namespace refuses. `utc/` and the instant readers take no annotation at all
  (see the next bullet).
- **Each kind accepts one exact pattern, over the whole string** (CORE-113, #528; `internal/isoStringBody.ts`):
  - Plain kinds (`PlainDate`, `PlainTime`, `PlainDateTime`, `PlainYearMonth`, `PlainMonthDay`):
    the body and no annotation of any kind.
  - UTC: `<date>T<time>Z` and nothing after it.
  - Instant: `…Z` or `…±HH:MM[:SS[.fraction]]` and nothing after it; the written offset is the
    instant (`Temporal.Instant.from`).
  - Zoned: the body, an optional `Z` or offset, and the zone bracket only.
  - Calendar-aware: see the bullets above.
  - `duration/` `relativeTo`: the plain or the zoned form exactly as above.
  - A function that keeps the zone (`transitTime`, `nextDeparture`, `scheduleDelivery`,
    `toOffsetInstant`, and every `zoned/` function) reads the zoned form through the zoned readers;
    a function that does not keep it reads an instant.
  - The `cutoff` of `isPastCutoff` and `timeToCutoff` is zoned only: exactly what `cutoffAt`
    writes, `<date>T<time>±HH:MM[Zone]` (an offset or `Z`, one time zone bracket, the critical
    `[!Zone]` included, nothing after it; `internal/exactMoment.ts` `zonedInstantOf`). The bracket
    may be an offset (`[+02:00]`), which GMT treats as a time zone and `cutoffAt` writes for an
    offset `timeZone`. A bare instant, an offset-less wall time and any other annotation return
    the sentinel. `now` is an instant only.
  - No argument accepts two kinds. An annotated string passed to an instant reader returns the
    sentinel; call a zoned function, or drop the bracket, first.
  - A zoned string whose local date is -271821-04-19 is refused, as `Temporal.ZonedDateTime.from`
    refuses it (`CheckISODaysRange`). A zone west of Greenwich shows that date for the first hours
    of the instant range. Tracked in [js-temporal-polyfill-bugs.md § J](../domination/js-temporal-polyfill-bugs.md).
- **Different calendars follow Temporal's `CalendarEquals`.** A difference between two values that
  name different calendars returns the sentinel (`diff*`, `intervalCount*`, `intervalLength*`,
  `splitIntervalByUnit*`, `intervalOverlappingDays*`; `internal/calendarDatePairPolicy.ts`,
  `calendarZonedPairPolicy.ts`), as Temporal's `until` throws. Ordering (`compare`) has no calendar
  check, so the ordering-only interval functions accept mixed calendars; value-returning interval
  set operations reject the mismatch, since their result must be written in one calendar. A bare
  ISO string names `iso8601`.

Every Temporal call keeps the try-catch and sentinel rules above. This is not a manual-parsing
exception: the regex restricts the shape and Temporal parses the string itself.

Do not extend the calendar grammar to a new namespace (e.g. `PlainDateTime`, `utc/`) without a new roadmap story.
