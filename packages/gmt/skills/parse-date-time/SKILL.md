---
name: parse-date-time
description: >
  Parse individual components (year, month, day, hour, etc.) from date/time
  strings. Use parse* functions for extraction. Returns null on invalid input.
sources:
  - 'burglekitt/gmt:packages/gmt/src/plain/parse/index.ts'
metadata:
  type: core
  library: '@burglekitt/gmt'
  library_version: '1.12.0'
---

# Parse Date/Time Components

Use this skill when you need to extract a specific component (year, month, day, etc.) from a date or time string.

## Setup

```ts
import { parseYearFromDate, parseMonthFromDate, parseDayFromDate } from "@burglekitt/gmt";
import { parseHourFromTime, parseMinuteFromTime, parseSecondFromTime } from "@burglekitt/gmt";
```

## Core Patterns

### Parse year from date

```ts
const year = parseYearFromDate("2024-03-15"); // 2024
```

### Parse month from date

```ts
const month = parseMonthFromDate("2024-03-15"); // 3
```

### Parse day from date

```ts
const day = parseDayFromDate("2024-03-15"); // 15
```

### Parse hour from time

```ts
const hour = parseHourFromTime("14:30:45"); // 14
```

### Parse minute from time

```ts
const minute = parseMinuteFromTime("14:30:45"); // 30
```

### Parse second from time

```ts
const second = parseSecondFromTime("14:30:45"); // 45
```

### Parse from datetime string

```ts
import { parseYearFromDateTime, parseMonthFromDateTime, parseDayFromDateTime } from "@burglekitt/gmt";

const year = parseYearFromDateTime("2024-03-15T14:30:45"); // 2024
const month = parseMonthFromDateTime("2024-03-15T14:30:45"); // 3
const day = parseDayFromDateTime("2024-03-15T14:30:45"); // 15
```

### Parse day of week

```ts
import { parseDayOfWeekFromDate } from "@burglekitt/gmt";

const dayOfWeek = parseDayOfWeekFromDate("2024-03-15"); // 5 (Friday)
```

### Parse week of year

```ts
import { parseWeekFromDate } from "@burglekitt/gmt";

const week = parseWeekFromDate("2024-03-15"); // 11
```

### Get calendar quantities (days in month/year, day of year, week counts)

These aren't `parse*` functions — they don't extract a stored field, they compute
a derived quantity — so they live in `calculate/`, not `parse/`. Grouped here
because they answer the same "read a calendar fact off a date" need.

```ts
import {
  getDaysInMonth,
  getDaysInYear,
  getDayOfYear,
  getWeeksInYear,
  getWeeksInMonth,
  getWeekOfMonth,
  getWeekYear,
  getLocaleWeekYear,
  getWeeksInLocaleWeekYear,
} from "@burglekitt/gmt";

getDaysInMonth("2024-02-15"); // 29 (leap year)
getDaysInYear("2024-06-15"); // 366 (leap year)
getDayOfYear("2024-03-01"); // 61
getWeeksInYear("2024-06-15"); // 52 (ISO week-numbering year)
getWeeksInMonth("2024-02-15", "en-US"); // 5 (calendar-grid rows, locale week start)
getWeekOfMonth("2024-02-29", "en-US"); // 5 (which grid row this date falls on)
getWeekYear("2024-12-30"); // 2025 (ISO week-numbering year — a Monday in week 1 of 2025)
getLocaleWeekYear("2022-01-01", "en-US"); // 2022 (locale-relative: en-US always counts Jan 1 as week 1)
getWeeksInLocaleWeekYear("2020-06-15", "de-DE"); // 53
```

### Parse a fixed producer format against a token pattern

Unlike the `parse*From*` functions above, these decode a whole string against a
caller-supplied token pattern instead of pulling one field out of an ISO
string — use them for a known, fixed non-ISO producer format (a CSV column, a
legacy API field, a partially-typed form value).

```ts
import {
  parseDateWithPattern,
  parseDateTimeWithPattern,
  parseTimeWithPattern,
} from "@burglekitt/gmt";

parseDateWithPattern("03/15/2024", "MM/dd/yyyy"); // "2024-03-15"
parseDateWithPattern("15-Mar-2024", "dd-MMM-yyyy"); // "2024-03-15"
parseTimeWithPattern("02:30:45 PM", "hh:mm:ss a"); // "14:30:45"
parseDateTimeWithPattern("15-Mar-2024 2:30 PM", "dd-MMM-yyyy h:mm a"); // "2024-03-15T14:30:00"
parseDateWithPattern("02/31/2024", "MM/dd/yyyy"); // "" — shape-valid, not a real date
```

Token table (subset — see JSDoc on each function for the full table):

| Token             | Field                | Notes                                              |
| ----------------- | --------------------- | --------------------------------------------------- |
| `yyyy` / `yy`      | year                   | `yy` pivots 00–68 → 2000s, 69–99 → 1900s             |
| `MM` / `M`         | month (numeric)        |                                                       |
| `MMMM` / `MMM`     | month name             | locale-aware, via `getLocaleMonthNames`              |
| `dd` / `d`         | day                    |                                                       |
| `EEEE` / `EEE`     | weekday name           | locale-aware; consumed but not cross-validated       |
| `HH` / `H`         | hour (24h)             |                                                       |
| `hh` / `h`         | hour (12h)             | needs `a` in the pattern to resolve to 24h           |
| `mm` / `m`         | minute                 |                                                       |
| `ss` / `s`         | second                 |                                                       |
| `SSS`              | millisecond            |                                                       |
| `a`                | meridiem               | locale-aware, via `getLocaleMeridiems`               |
| `GGGG` / `GG`      | era name               | locale-aware; BCE label ⇒ final year = 1 − parsed year |

`parseDateWithPattern` rejects time-only tokens and `parseTimeWithPattern`
rejects date-only tokens (both return `""`); `parseDateTimeWithPattern`
accepts the combined set. All three return `""` — never `null` — on no
match, a malformed pattern, or a shape-valid-but-unreal date/time (the regex
only proves shape; `Temporal.*.from(..., { overflow: "reject" })` proves the
value is real).

Full docs: `packages/gmt/src/plain/parse/parseDateWithPattern.ts`,
`parseDateTimeWithPattern.ts`, `parseTimeWithPattern.ts`.

## Common Mistakes

### HIGH Not handling null on invalid input

Wrong:

```ts
const year = parseYearFromDate("invalid");
// Assume year is always a number
console.log(year + 1); // NaN
```

Correct:

```ts
const year = parseYearFromDate("invalid");
if (year === null) {
  throw new Error("Invalid date");
}
console.log(year + 1);
```

Source: packages/gmt/src/plain/parse/parseYearFromDate.ts — Returns null on invalid input

### MEDIUM Using string manipulation instead of parse functions

Wrong:

```ts
const year = "2024-03-15".split("-")[0]; // "2024" as string
```

Correct:

```ts
import { parseYearFromDate } from "@burglekitt/gmt";

const year = parseYearFromDate("2024-03-15"); // 2024 as number
```

Source: AGENTS.md — Use Temporal for date manipulation

### MEDIUM Assuming month is 1-indexed in arithmetic

Wrong:

```ts
const month = parseMonthFromDate("2024-01-15");
// Use directly in array indexing
const monthName = ["Jan", "Feb", "Mar"][month]; // undefined
```

Correct:

```ts
const month = parseMonthFromDate("2024-01-15");
const monthName = ["Jan", "Feb", "Mar"][month - 1]; // "Jan"
```

Source: Temporal spec — months are 1-indexed

### MEDIUM Confusing getWeekOfMonth with parseWeekFromDate

`parseWeekFromDate` returns the ISO week-of-**year** (1-53, resets every
January). `getWeekOfMonth` returns the calendar-grid row within the
**month** (1-4/5/6, resets every month, and depends on `locale`'s first
day of week). They answer different questions and are not interchangeable.

Wrong:

```ts
// Trying to size a datepicker's month grid
const row = parseWeekFromDate("2024-02-29"); // 9 — ISO week-of-year, not useful here
```

Correct:

```ts
import { getWeekOfMonth } from "@burglekitt/gmt";

const row = getWeekOfMonth("2024-02-29", "en-US"); // 5 — grid row within February
```

Source: packages/gmt/src/plain/calculate/getWeekOfMonth.ts

### MEDIUM Week number without week-year is a bug in waiting

`parseWeekFromDate`/`getWeekNumber` return the week number alone, which
is ambiguous across a year boundary — 2024-12-30 is ISO week 1, but of
2025, not 2024. Always pair it with `getWeekYear` (ISO) or
`getLocaleWeekYear` (locale-relative) when bucketing by week, or
December dates land in the wrong bucket.

Wrong:

```ts
const key = parseWeekFromDate("2024-12-30"); // "1" — 1 of which year?
```

Correct:

```ts
import { getWeekYear, parseWeekFromDate } from "@burglekitt/gmt";

const key = `${getWeekYear("2024-12-30")}-W${parseWeekFromDate("2024-12-30")}`; // "2025-W1"
```

Source: packages/gmt/src/plain/calculate/getWeekYear.ts, getLocaleWeekYear.ts

## References

- [Full parse API](references/parse-api.md)
- [Temporal.PlainDate documentation](https://tc39.es/proposal-temporal/docs/plaindate.html)