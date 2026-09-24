---
name: gmt-basics
description: >
  Core date/time basics — get current values, parse components, read ISO week,
  ordinal, quarter and fiscal-period identifiers, format for display, format
  relative time, compare dates, and validate strings/timezones/intervals. Reads
  the installed package README.md and source JSDoc for API details; this skill
  is a routing pointer, not an API dump.
sources:
  - 'northguild/gmt:README.md'
  - 'northguild/gmt:packages/gmt/src/plain/get/index.ts'
  - 'northguild/gmt:packages/gmt/src/plain/parse/index.ts'
  - 'northguild/gmt:packages/gmt/src/plain/format/index.ts'
  - 'northguild/gmt:packages/gmt/src/plain/locale/index.ts'
  - 'northguild/gmt:packages/gmt/src/plain/compare/index.ts'
  - 'northguild/gmt:packages/gmt/src/plain/validate/index.ts'
  - 'northguild/gmt:packages/gmt/src/zoned/get/index.ts'
  - 'northguild/gmt:packages/gmt/src/zoned/format/index.ts'
  - 'northguild/gmt:packages/gmt/src/zoned/validate/index.ts'
  - 'northguild/gmt:packages/gmt/src/unix/get/index.ts'
  - 'northguild/gmt:packages/gmt/src/utc/get/index.ts'
  - 'northguild/gmt:packages/gmt/src/calendar/calculate/index.ts'
  - 'northguild/gmt:packages/gmt/src/calendar/validate/index.ts'
metadata:
  type: core
  library: '@northguild/gmt'
  library_version: '1.17.0'
---

# GMT Basics

Use this skill when the task touches core date/time read operations: getting the
current time, parsing components out of a date string, formatting for display,
producing human-friendly relative strings, comparing two values, or validating
input before you act on it.

## When to load

- The user needs "now" as an ISO string, or a formatted/localized display value.
- The user wants to extract a year/month/day/hour from a date string.
- The user needs the ISO week, ordinal, quarter or retail-calendar period a date
  falls in — a week number on a vessel schedule, a 4-5-4 fiscal period.
- The user needs "yesterday" or "in 2 hours" style output.
- The user is comparing or sorting two date strings.
- The user wants to guard a call with a validity check first.

## Core rules

1. **ISO 8601 strings in.** Public APIs consume ISO strings, IANA timezone ids,
   or numeric Unix epochs — never `new Date()`.
2. **Sentinel returns, never throws.** `""` for strings, `null` for numbers,
   `false` for booleans, `[]` for arrays. Always check before using. This holds
   for a `null` or wrong-typed argument too (`addDate(x, null)` is `""`), so a
   `try`/`catch` around a GMT call is dead code.
3. **Read the README.** This skill is a routing pointer. For full API
   signatures, locale matrices, and code examples, read the installed package's
   `README.md` and the source JSDoc of the function you intend to call.

## Key functions

- **Current values**: `getNow`, `getToday`, `getUtcNow`, `getUnixNow`,
  `getSystemTimeZone`, `getTimeZones`
- **Parsing**: `parseYearFromDate`, `parseMonthFromDate`,
  `parseDateTimeWithPattern`, `parseRfc3339`, `parseHttp`, `parseSql`
- **Calendar identifiers**: `getIsoWeekDate`, `getOrdinalDate`, `getQuarter`,
  `getFiscalPeriod`
- **Formatting**: `formatDate`, `formatTime`, `formatDateTime`,
  `formatRelativeDate`, `formatCalendar`, `formatRfc3339`
- **Locale names**: `getLocaleMonthNames`, `getLocaleWeekdayNames`,
  `getLocaleMeridiems`, `getLocaleEraNames`
- **Comparison**: `isAfterDate`, `isBeforeDate`, `areDatesEqual`,
  `areDatesEqualBy`, `isWeekend`, `isBusinessDay`, `nextWeekday`
- **Validation**: `isValidDate`, `isValidTime`, `isValidTimeZone`,
  `isValidZonedDateTime`, `isValidDateInterval`, `isValidFiscalPattern`

## Common pitfalls

- `formatRelative*` measure from now when `reference` is omitted, so the output
  changes from day to day. Pass `reference` whenever the result must be deterministic.
- `parseDateWithPattern`, `parseRfc2822` and `parseHttp` return `""` on
  shape-valid-but-unreal dates such as 31 February (regex only proves shape;
  Temporal validates the real value). Parsers reject; only arithmetic clamps.
- `parseRfc2822` reads everything RFC 5322 says a receiver must: comments,
  folding whitespace, any case, two-digit years and zone names such as `EST`
  (an unknown name reads as `+00:00`). `parseHttp` reads all three HTTP-date
  forms, including `rfc850-date` and `asctime-date`. Both return `""` when the
  day name contradicts the date (`"Sat, 15 Mar 2024 …"`), so do not synthesise
  a day name; omit it. The `rfc2822DateTime` and `httpDate` regexes stay strict
  and match only what GMT writes, so do not use them to pre-filter parser input.
- `formatRfc2822`, `formatHttp` and `formatRfc3339` return `""` for a year their
  grammar cannot hold (before 0000, or after 9999 for RFC 3339 and HTTP).
  `formatRfc3339` writes a sub-minute historical offset as the same instant at
  `+00:00`. Use Temporal's `toString()` when you need any year.
- Text formatters follow ECMA-402 as Temporal amends it, so text equals the
  `…ToParts` result joined. `era` or `timeZoneName` alone keep the default
  fields. A plain value never shows a zone name, and a style for fields the type
  lacks (`timeStyle` on `formatDate`, `dateStyle` on `formatTime`) returns `""`.
  Zoned formatters return `""`/`[]` for a `timeZone` option: to show an instant
  in another zone, use `formatUtc(value, locale, { timeZone })`.
- Leap seconds (`:60`) are invalid in every spelling (`T`, `t`, space, basic
  format). `isLeapSecond` tells you one is there. Validators return `false`.
- `isValidTimeZone` accepts every IANA name, including single-component links
  such as `Japan`, `Zulu` and `EST5EDT`, and ignores case. It also accepts
  offset zone ids such as `"+05:00"`, as Temporal does.
- `isLeapYear` and `getWeekNumber` take a `PlainDate` only: a date-time returns
  `false`/`null`. Pass `value.slice(0, 10)` for a date-time's date.
- Week numbers are ambiguous across year boundaries — `getIsoWeekDate` returns
  the week-numbering year with the week so the pair can never drift apart, and
  `getWeekYear` reads that year on its own.
- `getLocaleWeekYear` and `getWeeksInLocaleWeekYear` use the ISO rule (`minimalDays` 4)
  unless you pass `{ minimalDays }`: ECMA-402 no longer exposes a locale's value. CLDR's
  world default is `1` (`en-US` included), so pass `{ minimalDays: 1 }` for those locales.
- The `calendar/` identifier functions take a **zoneless** date or datetime. An
  instant has no calendar date until you name a zone — floor it with
  `floorToZone` first, or convert it in the zone you mean.
- `getFiscalPeriod`'s `yearEndsOn` states the year-end **rule** by example, not
  one year's end. The NRF 4-5-4 calendar is `"2026-01-31"` — a Saturday on
  January 31, which is "the Saturday nearest to January 31".
- `isWeekend` is locale-aware via `Intl.Locale.weekInfo`; `isBusinessDay` is
  fixed ISO Mon–Fri with no locale and no holidays **until you pass it a
  `BusinessCalendar`** — `isBusinessDay(value, { weekend, holidays, timeZone })`
  states the weekend and holidays itself. See the `gmt-arithmetic` skill.

## References

- [README — API Surface and Quick Start](README.md)
- [Core date operations guides](/guides/core-date-operations/get-current/)
