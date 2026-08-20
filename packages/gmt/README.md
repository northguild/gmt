# @burglekitt/gmt

Give Me Temporal.

`@burglekitt/gmt` is a Temporal-first date and time library with a simple rule set:

- ISO 8601 strings in
- ISO 8601 strings, numbers, booleans, or arrays out
- no `Date`
- plain and zoned operations kept separate

It wraps `@js-temporal/polyfill` behind a smaller, more opinionated API aimed at the cases application code actually hits: arithmetic, comparison, parsing, formatting, unix conversions, timezone conversion, and validation.

**Status:** pre-alpha. Expect API movement while the surface is still being filled out.

## Install

```bash
npm install @burglekitt/gmt
```

```bash
pnpm add @burglekitt/gmt
```

## Design Philosophy

GMT enforces a strict input/output contract to keep behavior predictable and auditable:

- **Explicit inputs only**: Public APIs accept clearly defined shapes — ISO 8601 date/time strings, IANA timezone identifiers, or numeric Unix epoch values (explicitly seconds or milliseconds). We do not attempt to parse arbitrary or ambiguous date formats.
- **Predictable outputs**: Helpers return normalized values (ISO strings, numbers, booleans, or arrays). Invalid input yields typed fallbacks (`""`, `null`, or `false`) instead of throwing.
- **No fuzzy parsing**: Avoid "throw everything at the wall" patterns found in permissive libraries. If you need permissive parsing, perform it outside of `@burglekitt/gmt` and then canonicalize to the strict shapes before calling into gmt.
- **Developer comfort with standards**: The library's goal is to make developers comfortable and deliberate with ISO 8601, IANA timezones, UTC instants, and Unix epochs by keeping APIs small and explicit.

## Core Rules

| Rule                    | Current behavior                                                                   |
| ----------------------- | ---------------------------------------------------------------------------------- |
| String-first API        | Public helpers consume ISO strings and return normalized strings where appropriate |
| Temporal-only internals | `Temporal` does the parsing and timezone math                                      |
| Plain/zoned separation  | `plain/*` is timezone-free, `zoned/*` is timezone-aware                            |
| No-throw public helpers | Invalid input returns a typed fallback instead of throwing                         |

Invalid input fallbacks are consistent across the library:

- string-returning helpers return `""`
- number-returning helpers return `null`
- boolean-returning helpers return `false`
- array-returning helpers return `[]`

## Testing

| Metric     | Count  |
| ---------- | ------ |
| Test files | 394    |
| Tests      | 11,898 |

Every function is exercised across **17 locales** and a full IANA timezone matrix. The CI pipeline runs the complete suite in **20 environments** — 2 Node versions (22, 24) × 10 timezones spanning every UTC offset band from Pacific/Niue (−11:00) to Pacific/Apia (+13:00):

| Timezone            | UTC Offset      |
| ------------------- | --------------- |
| Pacific/Niue        | −11:00          |
| America/New_York    | −05:00 / −04:00 |
| UTC                 | ±00:00          |
| Europe/London       | ±00:00 / +01:00 |
| Asia/Kolkata        | +05:30          |
| Asia/Kathmandu      | +05:45          |
| Asia/Shanghai       | +08:00          |
| Australia/Lord_Howe | +10:00 / +11:00 |
| Pacific/Chatham     | +12:45 / +13:45 |
| Pacific/Apia        | +13:00 / +14:00 |

This guarantees that DST transitions, leap seconds, half-hour offsets, and locale-specific weekend boundaries are all covered — not just the happy path.

## Package Layout

The package exports seven top-level namespaces:

```typescript
import {
  Temporal,
  duration,
  plain,
  zoned,
  unix,
  utc,
  regex,
} from "@burglekitt/gmt";
```

- `Temporal`: re-exported from `@js-temporal/polyfill`
- `duration`: ISO 8601 duration string parsing, validation, and arithmetic
- `plain`: timezone-free helpers
- `zoned`: timezone-aware helpers
- `unix`: Unix epoch (seconds or milliseconds) helpers
- `utc`: UTC instant helpers
- `regex`: low-level regex building blocks

You can also import subpaths directly:

```typescript
import { addDate, getNow, formatRelativeZoned } from "@burglekitt/gmt";
```

## Quick Start

### Plain arithmetic and comparisons

```typescript
import {
  addDate,
  addBusinessDays,
  subtractBusinessDays,
  areDatesEqual,
  diffDateTime,
  isBeforeDateTime,
} from "@burglekitt/gmt";

addDate("2026-01-01", 90, "day");
// "2026-03-32" is impossible, so Temporal normalizes correctly -> "2026-04-01"

addBusinessDays("2024-03-15", 1);
// "2024-03-18" (skips weekend)

subtractBusinessDays("2024-03-18", 1);
// "2024-03-15" (skips weekend)

diffDateTime("2024-03-17T12:00:00", "2024-03-17T12:30:00", "minute");
// 30

areDatesEqual("2026-03-17", "2026-03-17T09:00:00");
// true

isBeforeDateTime("2026-03-17T09:00:00", "2026-03-17T10:00:00");
// true
```

`add*`/`subtract*` accept an optional `overflow` (`"constrain"` (default) | `"reject"`) to control out-of-range results (e.g. adding a month to Jan 31), and `diff*` accept optional `smallestUnit`/`roundingIncrement`/`roundingMode` to round the computed difference:

```typescript
import { addDate, diffDate } from "@burglekitt/gmt";

addDate("2024-01-31", { months: 1 }, { overflow: "reject" });
// "" — Feb 31 doesn't exist and overflow: "reject" refuses to clamp it

diffDate("2023-01-01", "2023-01-10", "week", {
  smallestUnit: "week",
  roundingMode: "halfExpand",
});
// 1
```

`isWeekend`/`isZonedWeekend` check locale-specific weekend days (via `Intl.Locale`'s `weekInfo`) rather than assuming Saturday/Sunday:

```typescript
import { isWeekend, isZonedWeekend } from "@burglekitt/gmt";

isWeekend("2024-02-03", "en-US");
// true (Saturday, en-US weekend is Sat/Sun)

isWeekend("2024-02-03", "he-IL");
// true (Saturday is also part of he-IL's Fri/Sat weekend)

isZonedWeekend("2024-02-04T10:00:00+02:00[Asia/Jerusalem]", "he-IL");
// false (Sunday isn't part of he-IL's weekend)
```

`isBusinessDay` returns true for fixed ISO Monday–Friday business days (Mon=1 … Fri=5), locale-agnostic and with no holiday calendar. It's the complement to locale-aware `isWeekend` and matches the boundary that `addBusinessDays`/`subtractBusinessDays` use:

```typescript
import { isBusinessDay } from "@burglekitt/gmt";

isBusinessDay("2024-02-05");
// true (Monday)

isBusinessDay("2024-02-10");
// false (Saturday)
```

`clampDate` restricts a date to a range, and `closestDateTo` finds the nearest candidate by calendar distance:

```typescript
import { clampDate, closestDateTo } from "@burglekitt/gmt";

clampDate("2024-02-01", "2024-03-01", "2024-03-31");
// "2024-03-01"

closestDateTo("2024-03-15", ["2024-03-01", "2024-03-20", "2024-03-18"]);
// "2024-03-18"
```

`getLocaleStartOfWeek`/`getLocaleEndOfWeek` (and their zoned equivalents) compute week boundaries from the locale's first day of week, instead of an ISO-Monday default:

```typescript
import { getLocaleStartOfWeek, getLocaleEndOfWeek } from "@burglekitt/gmt";

getLocaleStartOfWeek("2024-02-29", "en-US");
// "2024-02-25" (Sunday, en-US weeks start Sunday)

getLocaleStartOfWeek("2024-02-29", "fr-FR");
// "2024-02-26" (Monday, fr-FR weeks start Monday)

getLocaleEndOfWeek("2024-02-29", "en-US");
// "2024-03-02" (Saturday)
```

`getLocaleDayOfWeek`/`getLocaleZonedDayOfWeek` return a locale-relative day-of-week index (0 = first day of the locale's week):

```typescript
import { getLocaleDayOfWeek, getLocaleZonedDayOfWeek } from "@burglekitt/gmt";

getLocaleDayOfWeek("2024-02-25", "en-US");
// 0 (Sunday = first day of en-US week)

getLocaleDayOfWeek("2024-02-26", "fr-FR");
// 0 (Monday = first day of fr-FR week)

getLocaleDayOfWeek("2024-02-24", "he-IL");
// 0 (Saturday = first day of he-IL week)

getLocaleZonedDayOfWeek("2024-02-25T12:00:00+00:00[UTC]", "en-US");
// 0
```

`getLocaleEraNames`/`getLocaleMonthNames`/`getLocaleWeekdayNames`/`getLocaleMeridiems` return standalone, locale-aware calendar names with no date value required — the GMT equivalents of Luxon's `Info.eras`/`Info.months`/`Info.weekdays`/`Info.meridiems`:

```typescript
import {
  getLocaleEraNames,
  getLocaleMonthNames,
  getLocaleWeekdayNames,
  getLocaleMeridiems,
} from "@burglekitt/gmt";

getLocaleEraNames("en-US");
// ["Before Christ", "Anno Domini"]

getLocaleEraNames("ja-JP", "short");
// ["紀元前", "西暦"]

getLocaleMonthNames("en-US");
// ["January", "February", ... "December"]

getLocaleMonthNames("de-DE", "short");
// ["Jan", "Feb", "Mär", ... "Dez"]

getLocaleWeekdayNames("en-US");
// ["Sunday", "Monday", ... "Saturday"] (locale-first-day order)

getLocaleWeekdayNames("fr-FR");
// ["lundi", "mardi", ... "dimanche"]

getLocaleMeridiems("en-US");
// ["AM", "PM"]

getLocaleMeridiems("zh-CN");
// ["上午", "下午"]
```

`getLocaleWeekdayNames` returns names in the locale's first-day order, consistent with `getLocaleDayOfWeek` (index 0 is the locale's first day of the week). All four delegate to the host runtime's `Intl` data, so their output depends on the runtime's ICU build.

### Durations

```typescript
import {
  addDuration,
  diffDateAsDuration,
  formatDuration,
  isValidDuration,
  normalizeDuration,
  parseDuration,
  subtractDuration,
} from "@burglekitt/gmt";

isValidDuration("P1DT2H30M");
// true

parseDuration("P1DT2H30M");
// "P1DT2H30M"

parseDuration("PT1.5S", { smallestUnit: "second", roundingMode: "trunc" });
// "PT1S"

parseDuration("not a duration");
// ""

addDuration("P1D", "PT2H");
// "P1DT2H"

subtractDuration("P1D", "PT2H");
// "PT22H"

normalizeDuration("PT90M", { largestUnit: "hour" });
// "PT1H30M"

normalizeDuration("P45D", { largestUnit: "month", relativeTo: "2024-01-01" });
// "P1M14D"

formatDuration("P1DT2H30M", "en-US");
// "1 day, 2 hours, and 30 minutes"

formatDuration("P1DT2H30M", "en-US", { style: "short" });
// "1 day, 2 hr, & 30 min"

formatDuration("P1DT0H30M", "en-US");
// "1 day and 30 minutes"

diffDateAsDuration("2024-03-10", "2024-04-05", "days");
// "P26D" — bridges diffDate to an ISO duration string instead of a single-unit number
```

`diffDateAsDuration`/`diffDateTimeAsDuration`/`diffZonedAsDuration`/`diffUnixAsDuration`/`diffUtcAsDuration` are sibling functions to `diffDate`/`diffDateTime`/`diffZoned`/`diffUnix`/`diffUtc`, returning an ISO 8601 duration string (sentinel `""`) instead of a single-unit number (sentinel `null`). They take a single `unit` (not an array) to set the duration's `largestUnit`.

### Intervals

Interval and range validators are available in two API shapes — **range validators** (matching `isValidDateRange`'s `{ value1, value2, options? }` object-param shape) and **interval validators** (`(start, end)` positional args, `start <= end` always):

```typescript
import {
  isValidDateInterval,
  isValidTimeInterval,
  isValidDateTimeInterval,
  isValidDateRange,
  isValidTimeRange,
  isValidDateTimeRange,
  isValidUtcRange,
  isValidUnixRange,
  isValidZonedRange,
  isValidUtcInterval,
  isValidUnixInterval,
  isValidZonedInterval,
} from "@burglekitt/gmt";

// Interval validators — positional args, start <= end
isValidDateInterval("2024-01-01", "2024-12-31");
// true

isValidTimeInterval("09:00:00", "17:00:00");
// true

isValidDateTimeInterval("2024-01-01T10:00:00", "2024-12-31T23:59:59");
// true

isValidZonedInterval(
  "2024-01-01T10:00:00+00:00[UTC]",
  "2024-12-31T23:59:59+00:00[UTC]",
);
// true

// Range validators — object params, with optional allowEqual
isValidDateRange({ value1: "2024-01-01", value2: "2024-12-31" });
// true

isValidTimeRange({ value1: "09:00:00", value2: "17:00:00" });
// true

isValidZonedRange({
  value1: "2024-01-01T10:00:00+00:00[UTC]",
  value2: "2024-12-31T23:59:59+00:00[UTC]",
});
// true
```

Interval containment checks (`intervalContains*`) test whether a point or inner interval falls within an outer interval. Each supports two modes via an optional fourth argument:

- 3-arg: `intervalContains(start, end, point)` — true when `start <= point <= end`
- 4-arg: `intervalContains(start, end, innerStart, innerEnd)` — true when the inner interval is fully contained

```typescript
import {
  intervalContainsDate,
  intervalContainsTime,
  intervalContainsDateTime,
  intervalContainsUtc,
  intervalContainsUnix,
  intervalContainsZoned,
} from "@burglekitt/gmt";

// Point-in-interval (3-arg)
intervalContainsDate("2024-01-01", "2024-12-31", "2024-06-15");
// true

intervalContainsTime("09:00:00", "17:00:00", "12:00:00");
// true

intervalContainsUtc(
  "2024-01-01T00:00:00Z",
  "2024-12-31T23:59:59Z",
  "2024-06-15T12:00:00Z",
);
// true

intervalContainsUnix(0, 1700000000, 170000000);
// true

intervalContainsZoned(
  "2024-01-01T00:00:00+00:00[UTC]",
  "2024-12-31T23:59:59+00:00[UTC]",
  "2024-06-15T12:00:00+00:00[UTC]",
);
// true

// Interval-in-interval (4-arg)
intervalContainsDate("2024-01-01", "2024-12-31", "2024-03-01", "2024-09-01");
// true

intervalContainsTime("09:00:00", "17:00:00", "10:00:00", "16:00:00");
// true
```

All interval containment checks return `false` on invalid input (wrong type, malformed strings, leap seconds, inverted intervals, non-finite values for Unix).

`intervalsOverlap*` checks whether two intervals share any time. Returns `true` when intervals overlap, `false` when they are disjoint or only adjacent (touching at a single instant with no shared time):

```typescript
import {
  intervalsOverlapDate,
  intervalsOverlapTime,
  intervalsOverlapDateTime,
  intervalsOverlapUtc,
  intervalsOverlapUnix,
  intervalsOverlapZoned,
} from "@burglekitt/gmt";

intervalsOverlapDate("2024-01-01", "2024-06-30", "2024-04-01", "2024-12-31");
// true

intervalsOverlapDate("2024-01-01", "2024-06-30", "2024-06-30", "2024-12-31");
// false (adjacent, no shared time)

intervalsOverlapUnix(0, 1700000000, 1000000, 2000000);
// true

intervalsOverlapUtc(
  "2024-01-01T00:00:00Z",
  "2024-06-30T23:59:59Z",
  "2024-04-01T00:00:00Z",
  "2024-12-31T23:59:59Z",
);
// true
```

All overlap checks return `false` on invalid input (wrong type, malformed strings, leap seconds, inverted intervals, non-finite values for Unix).

`intervalIntersection*` returns the overlapping span of two intervals, or `null` when they do not overlap. Adjacent intervals (sharing one instant) count as overlapping and return a single-point span:

```typescript
import {
  intervalIntersectionDate,
  intervalIntersectionTime,
  intervalIntersectionDateTime,
  intervalIntersectionUtc,
  intervalIntersectionUnix,
  intervalIntersectionZoned,
} from "@burglekitt/gmt";

intervalIntersectionDate(
  "2024-01-01",
  "2024-06-30",
  "2024-04-01",
  "2024-12-31",
);
// { start: "2024-04-01", end: "2024-06-30" }

intervalIntersectionDate(
  "2024-01-01",
  "2024-06-30",
  "2024-06-30",
  "2024-12-31",
);
// { start: "2024-06-30", end: "2024-06-30" } (adjacent, shares one instant)

intervalIntersectionDate(
  "2024-01-01",
  "2024-06-30",
  "2024-07-01",
  "2024-12-31",
);
// null (disjoint)

intervalIntersectionUnix(0, 1700000000, 1000000, 2000000);
// { start: 1000000, end: 1700000000 }

intervalIntersectionUtc(
  "2024-01-01T00:00:00Z",
  "2024-06-30T23:59:59Z",
  "2024-04-01T00:00:00Z",
  "2024-12-31T23:59:59Z",
);
// { start: "2024-04-01T00:00:00Z", end: "2024-06-30T23:59:59Z" }
```

All intersection functions return `null` on invalid input (wrong type, malformed strings, leap seconds, inverted intervals, non-finite values for Unix).

`intervalUnion*` returns the combined span of two overlapping or adjacent intervals, or `null` when they are disjoint with a gap. Adjacent intervals (sharing one instant) count as mergeable:

```typescript
import {
  intervalUnionDate,
  intervalUnionTime,
  intervalUnionDateTime,
  intervalUnionUtc,
  intervalUnionUnix,
  intervalUnionZoned,
} from "@burglekitt/gmt";

intervalUnionDate("2024-01-01", "2024-06-30", "2024-04-01", "2024-12-31");
// { start: "2024-01-01", end: "2024-12-31" }

intervalUnionDate("2024-01-01", "2024-06-30", "2024-06-30", "2024-12-31");
// { start: "2024-01-01", end: "2024-12-31" } (adjacent, merged)

intervalUnionDate("2024-01-01", "2024-06-30", "2024-07-01", "2024-12-31");
// null (disjoint with a gap)

intervalUnionUnix(0, 1700000000, 1000000, 2000000);
// { start: 0, end: 1700000000 }

intervalUnionUtc(
  "2024-01-01T00:00:00Z",
  "2024-06-30T23:59:59Z",
  "2024-04-01T00:00:00Z",
  "2024-12-31T23:59:59Z",
);
// { start: "2024-01-01T00:00:00Z", end: "2024-12-31T23:59:59Z" }
```

All union functions return `null` on invalid input (wrong type, malformed strings, leap seconds, inverted intervals, non-finite values for Unix).

`intervalDifference*` returns the portion(s) of interval A not covered by interval B, as an array of `{ start, end }` records:

```typescript
import {
  intervalDifferenceDate,
  intervalDifferenceTime,
  intervalDifferenceDateTime,
  intervalDifferenceUtc,
  intervalDifferenceUnix,
  intervalDifferenceZoned,
} from "@burglekitt/gmt";

intervalDifferenceDate("2024-01-01", "2024-12-31", "2024-06-01", "2024-07-01");
// [{ start: "2024-01-01", end: "2024-05-31" }, { start: "2024-07-02", end: "2024-12-31" }]

intervalDifferenceDate("2024-01-01", "2024-12-31", "2024-01-01", "2024-12-31");
// [] (B fully covers A)

intervalDifferenceUnix(0, 1700000000, 1000000, 2000000);
// [{ start: 0, end: 999999 }, { start: 2000001, end: 1700000000 }]

intervalDifferenceUtc(
  "2024-01-01T00:00:00Z",
  "2024-12-31T23:59:59Z",
  "2024-06-01T00:00:00Z",
  "2024-07-01T00:00:00Z",
);
// [{ start: "2024-01-01T00:00:00Z", end: "2024-05-31T23:59:59Z" }, { start: "2024-07-02T00:00:00Z", end: "2024-12-31T23:59:59Z" }]
```

All difference functions return `[]` on invalid input (wrong type, malformed strings, leap seconds, inverted intervals, non-finite values for Unix).

`intervalXor*` returns the symmetric difference of two intervals — the portions covered by exactly one of them, not both — as an array of `{ start, end }` records:

```typescript
import {
  intervalXorDate,
  intervalXorTime,
  intervalXorDateTime,
  intervalXorUtc,
  intervalXorUnix,
  intervalXorZoned,
} from "@burglekitt/gmt";

intervalXorDate("2024-01-01", "2024-06-30", "2024-04-01", "2024-12-31");
// [{ start: "2024-01-01", end: "2024-03-31" }, { start: "2024-07-01", end: "2024-12-31" }]

intervalXorDate("2024-01-01", "2024-06-30", "2024-06-30", "2024-12-31");
// [{ start: "2024-01-01", end: "2024-06-29" }, { start: "2024-07-01", end: "2024-12-31" }] (adjacent)

intervalXorUnix(0, 1700000000, 1000000, 2000000);
// [{ start: 0, end: 999999 }, { start: 2000001, end: 1700000000 }]

intervalXorUtc(
  "2024-01-01T00:00:00Z",
  "2024-06-30T23:59:59Z",
  "2024-04-01T00:00:00Z",
  "2024-12-31T23:59:59Z",
);
// [{ start: "2024-01-01T00:00:00Z", end: "2024-03-31T23:59:59Z" }, { start: "2024-07-01T00:00:00Z", end: "2024-12-31T23:59:59Z" }]
```

All xor functions return `[]` on invalid input (wrong type, malformed strings, leap seconds, inverted intervals, non-finite values for Unix).

`intervalAbuts*` checks whether two intervals are exactly adjacent — one's end equals the other's start with zero gap and zero overlap:

```typescript
import {
  intervalAbutsDate,
  intervalAbutsTime,
  intervalAbutsDateTime,
  intervalAbutsUtc,
  intervalAbutsUnix,
  intervalAbutsZoned,
} from "@burglekitt/gmt";

intervalAbutsDate("2024-01-01", "2024-06-30", "2024-06-30", "2024-12-31");
// true

intervalAbutsDate("2024-01-01", "2024-06-29", "2024-06-30", "2024-12-31");
// false (one-day gap)

intervalAbutsDate("2024-01-01", "2024-06-30", "2024-04-01", "2024-12-31");
// false (overlap)

intervalAbutsUnix(0, 1000000, 1000000, 2000000);
// true

intervalAbutsUtc(
  "2024-01-01T00:00:00Z",
  "2024-06-30T23:59:59Z",
  "2024-06-30T23:59:59Z",
  "2024-12-31T23:59:59Z",
);
// true
```

All abuts checks return `false` on invalid input (wrong type, malformed strings, leap seconds, inverted intervals, non-finite values for Unix).

`intervalEngulfs*` checks whether interval B is fully contained within interval A — every instant of B falls within A. Equivalent to the 4-argument `intervalContains*` mode:

```typescript
import {
  intervalEngulfsDate,
  intervalEngulfsTime,
  intervalEngulfsDateTime,
  intervalEngulfsUtc,
  intervalEngulfsUnix,
  intervalEngulfsZoned,
} from "@burglekitt/gmt";

intervalEngulfsDate("2024-01-01", "2024-12-31", "2024-06-01", "2024-07-01");
// true

intervalEngulfsDate("2024-01-01", "2024-12-31", "2024-01-01", "2024-12-31");
// true (equal intervals)

intervalEngulfsDate("2024-06-01", "2024-07-01", "2024-01-01", "2024-12-31");
// false

intervalEngulfsUnix(0, 1700000000, 1000000, 2000000);
// true

intervalEngulfsUtc(
  "2024-01-01T00:00:00Z",
  "2024-12-31T23:59:59Z",
  "2024-06-01T00:00:00Z",
  "2024-07-01T00:00:00Z",
);
// true
```

All engulfs checks return `false` on invalid input (wrong type, malformed strings, leap seconds, inverted intervals, non-finite values for Unix).

`splitIntervalByUnit*` splits an interval into sub-intervals of `amount × unit`, returning an array of `{ start, end }` records. The final sub-interval is trimmed so its `end` never exceeds the original `end`:

```typescript
import {
  splitIntervalByUnitDate,
  splitIntervalByUnitTime,
  splitIntervalByUnitDateTime,
  splitIntervalByUnitUtc,
  splitIntervalByUnitUnix,
  splitIntervalByUnitZoned,
} from "@burglekitt/gmt";

splitIntervalByUnitDate("2024-01-01", "2024-01-10", "day", 2);
// [{ start: "2024-01-01", end: "2024-01-03" }, { start: "2024-01-03", end: "2024-01-05" }, { start: "2024-01-05", end: "2024-01-07" }, { start: "2024-01-07", end: "2024-01-09" }, { start: "2024-01-09", end: "2024-01-10" }]

splitIntervalByUnitUtc(
  "2024-01-01T00:00:00Z",
  "2024-01-02T00:00:00Z",
  "hour",
  6,
);
// [{ start: "2024-01-01T00:00:00Z", end: "2024-01-01T06:00:00Z" }, { start: "2024-01-01T06:00:00Z", end: "2024-01-01T12:00:00Z" }, { start: "2024-01-01T12:00:00Z", end: "2024-01-01T18:00:00Z" }, { start: "2024-01-01T18:00:00Z", end: "2024-01-02T00:00:00Z" }]

splitIntervalByUnitUnix(0, 86400000, "hour", 6);
// [{ start: 0, end: 21600000 }, { start: 21600000, end: 43200000 }, { start: 43200000, end: 64800000 }, { start: 64800000, end: 86400000 }]
```

All split functions return `[]` on invalid input (wrong type, malformed strings, leap seconds, inverted intervals, non-positive amount, unsupported unit, or a unit that has no effect on the target type).

`intervalCount*` returns how many calendar-unit boundaries an interval crosses — the number of units the half-open interval `[start, end)` touches. This is distinct from `diff*`, which measures exact elapsed duration: an interval from 23:59 to 00:01 is two minutes long but touches two days:

```typescript
import {
  intervalCountDate,
  intervalCountTime,
  intervalCountDateTime,
  intervalCountUtc,
  intervalCountUnix,
  intervalCountZoned,
} from "@burglekitt/gmt";

intervalCountDateTime("2024-01-01T23:59:00", "2024-01-02T00:01:00", "day");
// 2 (two minutes long, but two days touched)

intervalCountDate("2024-01-01", "2024-01-03", "day");
// 2 (the end boundary is excluded)

intervalCountDate("2024-01-15", "2024-03-10", "month");
// 3

intervalCountTime("12:30:00", "13:00:00", "hour");
// 1

intervalCountZoned(
  "2024-03-10T00:00:00-05:00[America/New_York]",
  "2024-03-11T00:00:00-04:00[America/New_York]",
  "hour",
);
// 23 (the spring-forward local day is 23 hours long)

intervalCountUnix(0, 86400000, "hour");
// 24
```

Zero-length intervals count `1` when they sit mid-unit and `0` when they sit exactly on a unit boundary — `intervalCountDate("2024-01-15", "2024-01-15", "month")` is `1`, while `intervalCountDate("2024-01-01", "2024-01-01", "month")` is `0`. Weeks start on Monday (ISO 8601), singular and plural units are interchangeable (`"day"` and `"days"`), and `intervalCountUnix` uses the system timeZone for calendar boundaries (consistent with `addUnix`). All count functions return `null` on invalid input (wrong type, malformed strings, leap seconds, inverted intervals, unsupported unit, or a unit that has no effect on the target type).

`intervalFromDuration*` constructs an interval from a single point plus an ISO 8601 duration, anchored at either end — Luxon's `Interval.after`/`Interval.before` as one function with an `anchor` param instead of two:

```typescript
import {
  intervalFromDurationDate,
  intervalFromDurationTime,
  intervalFromDurationDateTime,
  intervalFromDurationUtc,
  intervalFromDurationUnix,
  intervalFromDurationZoned,
} from "@burglekitt/gmt";

intervalFromDurationDate("2024-01-01", "P1M", "start");
// { start: "2024-01-01", end: "2024-02-01" }

intervalFromDurationDate("2024-02-01", "P1M", "end");
// { start: "2024-01-01", end: "2024-02-01" }

intervalFromDurationZoned(
  "2024-03-09T02:30:00-05:00[America/New_York]",
  "P1D",
  "start",
);
// { start: "2024-03-09T02:30:00-05:00[America/New_York]", end: "2024-03-10T03:30:00-04:00[America/New_York]" } (spring-forward day is 23 hours long)

intervalFromDurationTime("12:00:00", "P1D", "start");
// null (PlainTime has no calendar — a date-unit duration needs a relativeTo it can't supply)
```

Calendar units (years/months/weeks) resolve against `value` itself, so no separate `relativeTo` is needed — except for `intervalFromDurationTime`, which returns `null` for a `duration` with a nonzero years/months/weeks/days component, since `PlainTime` has no calendar to resolve it against. `intervalFromDurationZoned` accepts the same `disambiguation`/`offset`/`overflow` options as `addZoned`; `intervalFromDurationUnix` accepts `addUnix`'s `epochUnit`/`timeZone`/`overflow` options. A negative `duration` that inverts the computed span, or an `overflow: "reject"` result, returns `null` — same sentinel as any other invalid input.

All validators return `false` on invalid input (wrong type, malformed strings, leap seconds, mixed kinds for plain interval validators, non-finite values for Unix).

### Zoned operations

```typescript
import { addZoned, formatZonedDateTime } from "@burglekitt/gmt";

addZoned("2026-03-07T23:00:00-05:00[America/New_York]", 2, "hour");
// "2026-03-08T01:00:00-05:00[America/New_York]"

formatZonedDateTime("2024-03-17T14:30:45+00:00[UTC]", "en-US", {
  dateStyle: "full",
  timeStyle: "short",
});
// locale-dependent non-empty formatted string
```

Twice a year, DST creates local times that don't exist (spring-forward gap) or happen twice (fall-back overlap). Functions that attach a timezone to a plain/local value accept an optional `disambiguation` (`"compatible"` (default) | `"earlier"` | `"later"` | `"reject"`) to control how that's resolved instead of silently guessing:

```typescript
import { convertPlainDateTimeToZoned } from "@burglekitt/gmt";

// 2024-03-10T02:30:00 doesn't exist in America/New_York (clocks jump 2am -> 3am).
convertPlainDateTimeToZoned("2024-03-10T02:30:00", "America/New_York", {
  disambiguation: "reject",
});
// "" — no such local time exists
```

The `startOfZoned`/`endOfZoned`/`startOfQuarterForZoned`/`endOfQuarterForZoned`/`mapZonedHoursInDay` family (and their `unix/` counterparts) also accept `disambiguation`, plus an `offset` option (`"prefer"` | `"use"` | `"ignore"` (default) | `"reject"`) that controls whether the source's existing UTC offset is kept when computing the new boundary. **`offset` must stay at its default (`"ignore"`) for `disambiguation` to take effect** — Temporal's own default (`"prefer"`) keeps the source offset whenever still valid, which silently makes `disambiguation` a no-op:

```typescript
import { startOfZoned } from "@burglekitt/gmt";

// 2024-11-03T01:45:00-05:00 is the SECOND, repeated 1am of the fall-back overlap in America/New_York.
const source = "2024-11-03T01:45:00-05:00[America/New_York]";

startOfZoned(source, "hour", { disambiguation: "reject" });
// "" — offset defaults to "ignore", so disambiguation actually fires and "reject" throws

startOfZoned(source, "hour", { disambiguation: "reject", offset: "prefer" });
// "2024-11-03T01:00:00-05:00[America/New_York]" — offset:"prefer" keeps the source's
// still-valid -05:00 offset, so disambiguation is never consulted and "reject" never fires
```

`convertPlainDateTimeToZoned` and `addZoned`/`subtractZoned` also accept `offset` for API consistency, but it's permanently inert on both — their construction path never has a stored offset for it to act on.

`hasDaylightSaving` reports whether an IANA timezone observes daylight saving time at all:

```typescript
import { hasDaylightSaving } from "@burglekitt/gmt";

hasDaylightSaving("America/New_York");
// true

hasDaylightSaving("Asia/Tokyo");
// false

hasDaylightSaving("Invalid/Zone");
// false
```

`clampZoned` restricts a zoned datetime to a range, and `closestZonedTo` finds the nearest candidate by temporal distance:

```typescript
import { clampZoned, closestZonedTo } from "@burglekitt/gmt";

clampZoned(
  "2024-02-01T12:00:00[America/New_York]",
  "2024-03-01T00:00:00[America/New_York]",
  "2024-03-31T23:59:59[America/New_York]",
);
// "2024-03-01T00:00:00-05:00[America/New_York]"

closestZonedTo("2024-03-15T12:00:00[America/New_York]", [
  "2024-03-01T00:00:00[America/New_York]",
  "2024-03-20T00:00:00[America/New_York]",
  "2024-03-18T00:00:00[America/New_York]",
]);
// "2024-03-18T00:00:00-04:00[America/New_York]"
```

See [`docs/dst-disambiguation.md`](../../docs/dst-disambiguation.md) for the full explanation, including why `overflow` was deliberately left off the public API.

### Formatting

```typescript
import {
  formatDate,
  formatRelativeDate,
  formatTime,
  formatRelativeTime,
  formatDateTime,
  formatRelativeDateTime,
  formatZonedDateTime,
  formatZonedRange,
  formatRelativeZoned,
  formatUtc,
  formatRelativeUtc,
  formatUnix,
  formatRelativeUnix,
} from "@burglekitt/gmt";

// Relative to "now" — auto-picks the best unit.
formatRelativeDate("2026-01-15");
// e.g. "3 months ago"

formatRelativeTime("14:30:00", "en-US", { style: "short" });
// e.g. "2 hours ago"

formatRelativeDateTime("2026-03-17T09:00:00", "en-GB", {
  style: "long",
  numeric: "always",
});
// e.g. "17 March, 2026 at 09:00"

// Zoned relative formatting — reference can be a ZonedDateTime, UTC string, or unix epoch.
formatRelativeZoned("2026-03-08T01:00:00-05:00[America/New_York]", "en-US");
// e.g. "tomorrow"

formatRelativeUtc("2024-03-17T14:30:45+00:00[UTC]", "en-US");
// e.g. "2 years ago"

// Unix epoch relative formatting.
formatRelativeUnix(1710685845000, "en-US", { epochUnit: "milliseconds" });
// e.g. "3 years ago"
```

### Unix and UTC helpers

```typescript
import { getUnixNow, getUtcNow, convertUnixToPlainDate } from "@burglekitt/gmt";

getUnixNow("milliseconds");
// 1710685845000

getUtcNow();
// "2026-03-18T11:42:33.123Z"

convertUnixToPlainDate(1710685845);
// "2024-03-17"
```

## API Surface

For the complete API listing, see the namespace documentation on GitHub:

- [Duration API](https://github.com/burglekitt/gmt/tree/main/packages/gmt/src/duration) — ISO 8601 duration parsing, validation, arithmetic, and formatting
- [Plain API](https://github.com/burglekitt/gmt/tree/main/packages/gmt/src/plain) — timezone-free operations
- [Zoned API](https://github.com/burglekitt/gmt/tree/main/packages/gmt/src/zoned) — IANA timezone-aware operations
- [Unix API](https://github.com/burglekitt/gmt/tree/main/packages/gmt/src/unix) — Unix epoch utilities
- [UTC API](https://github.com/burglekitt/gmt/tree/main/packages/gmt/src/utc) — UTC instant utilities
- [Regex API](https://github.com/burglekitt/gmt/tree/main/packages/gmt/src/regex) — composable regex patterns

## Agent Prompt

When working with `@burglekitt/gmt`, follow these rules:

1. **No `Date` object.** Use `Temporal` exclusively.
2. **String-in, string-out.** Public APIs accept ISO 8601 strings; return strings, numbers, booleans, or arrays.
3. **Invalid input returns a sentinel, never throws.** `""` for strings, `null` for numbers, `false` for booleans, `[]` for arrays.
4. **Wrap all Temporal calls in `try-catch`.** `.from()`, `.add()`, `.since()`, etc. throw `RangeError` on bad input.
5. **Keep `plain/` and `zoned/` strictly separate.** Never mix `PlainDateTime` and `ZonedDateTime`.
6. **Full locale matrix for any locale-aware function.** 17 locales, explicit rows, `hasFullIcu` ternaries where output differs.
7. **Use pre-built mocks for error-path tests.** See `packages/gmt/src/test/mocks`.
8. **JSDoc with `@example` on every public function.** Cover valid, invalid, and edge-case inputs.

## License

MIT — See [LICENSE](../../LICENSE) for details.
