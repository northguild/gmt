---
name: gmt-basics
description: >
  Core date/time basics — get current values, parse components, format for
  display, format relative time, compare dates, and validate
  strings/timezones/intervals. Reads the installed package README.md and source
  JSDoc for API details; this skill is a routing pointer, not an API dump.
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
metadata:
  type: core
  library: '@northguild/gmt'
  library_version: '1.15.0'
---

# GMT Basics

Use this skill when the task touches core date/time read operations: getting the
current time, parsing components out of a date string, formatting for display,
producing human-friendly relative strings, comparing two values, or validating
input before you act on it.

## When to load

- The user needs "now" as an ISO string, or a formatted/localized display value.
- The user wants to extract a year/month/day/hour from a date string.
- The user needs "yesterday" or "in 2 hours" style output.
- The user is comparing or sorting two date strings.
- The user wants to guard a call with a validity check first.

## Core rules

1. **ISO 8601 strings in.** Public APIs consume ISO strings, IANA timezone ids,
   or numeric Unix epochs — never `new Date()`.
2. **Sentinel returns, never throws.** `""` for strings, `null` for numbers,
   `false` for booleans, `[]` for arrays. Always check before using.
3. **Read the README.** This skill is a routing pointer. For full API
   signatures, locale matrices, and code examples, read the installed package's
   `README.md` and the source JSDoc of the function you intend to call.

## Key functions

- **Current values**: `getNow`, `getToday`, `getUtcNow`, `getUnixNow`,
  `getSystemTimeZone`, `getTimeZones`
- **Parsing**: `parseYearFromDate`, `parseMonthFromDate`,
  `parseDateTimeWithPattern`, `parseRfc3339`, `parseHttp`, `parseSql`
- **Formatting**: `formatDate`, `formatTime`, `formatDateTime`,
  `formatRelativeDate`, `formatCalendar`, `formatRfc3339`
- **Locale names**: `getLocaleMonthNames`, `getLocaleWeekdayNames`,
  `getLocaleMeridiems`, `getLocaleEraNames`
- **Comparison**: `isAfterDate`, `isBeforeDate`, `areDatesEqual`,
  `areDatesEqualBy`, `isWeekend`, `isBusinessDay`, `nextWeekday`
- **Validation**: `isValidDate`, `isValidTime`, `isValidTimeZone`,
  `isValidZonedDateTime`, `isValidDateInterval`

## Common pitfalls

- `formatRelativeDate` requires a `reference` option — without it, you get `""`.
- `parseDateWithPattern` returns `""` on shape-valid-but-unreal dates (regex
  only proves shape; Temporal validates the real value).
- Week numbers are ambiguous across year boundaries — pair
  `parseWeekFromDate` with `getWeekYear`.
- `isWeekend` is locale-aware via `Intl.Locale.weekInfo`; `isBusinessDay` is
  fixed ISO Mon–Fri with no locale and no holidays.

## References

- [README — API Surface and Quick Start](README.md)
- [Full API reference](/reference/plain)
