# @burglekitt/gmt

Give Me Temporal.

`@burglekitt/gmt` is a Temporal-first date and time library with a simple rule set:

- ISO 8601 strings in
- ISO 8601 strings, numbers, booleans, or arrays out
- no `Date`
- plain and zoned operations kept separate

It wraps `@js-temporal/polyfill` behind a smaller, more opinionated API aimed at the cases application code actually hits: arithmetic, comparison, parsing, formatting, unix conversions, timezone conversion, and validation.

**Status:** pre-alpha. Expect API movement while the surface is still being filled out.

---

## Install

```bash
npm install @burglekitt/gmt
```

```bash
bun add @burglekitt/gmt
```

---

## Package Layout

The package exports four top-level namespaces:

```typescript
import { Temporal, plain, zoned, regex } from "@burglekitt/gmt";
```

- `Temporal`: re-exported from `@js-temporal/polyfill`
- `plain`: timezone-free helpers
- `zoned`: timezone-aware helpers
- `regex`: low-level regex building blocks

You can also import subpaths directly:

```typescript
import { addDate } from "@burglekitt/gmt/plain/calculate";
import { getNow } from "@burglekitt/gmt/plain/get";
import { convertUnixToTimezone } from "@burglekitt/gmt/zoned/convert";
```

---

## Core Rules

| Rule | Current behavior |
|---|---|
| String-first API | Public helpers consume ISO strings and return normalized strings where appropriate |
| Temporal-only internals | `Temporal` does the parsing and timezone math |
| Plain/zoned separation | `plain/*` is timezone-free, `zoned/*` is timezone-aware |
| No-throw public helpers | Invalid input returns a typed fallback instead of throwing |

Invalid input fallbacks are consistent across the library:

- string-returning helpers return `""`
- number-returning helpers return `null`
- boolean-returning helpers return `false`
- array-returning helpers return `[]`

---

## Quick Start

### Plain arithmetic and comparisons

```typescript
import { addDate, diffDateTime } from "@burglekitt/gmt/plain/calculate";
import { areDatesEqual, isBeforeDateTime } from "@burglekitt/gmt/plain/compare";

addDate("2026-01-01", 90, "day");
// "2026-03-32" is impossible, so Temporal normalizes correctly -> "2026-04-01"

diffDateTime("2024-03-17T12:00:00", "2024-03-17T12:30:00", "minute");
// 30

areDatesEqual("2026-03-17", "2026-03-17T09:00:00");
// true

isBeforeDateTime("2026-03-17T09:00:00", "2026-03-17T10:00:00");
// true
```

### Plain get, parse, map, and validate helpers

```typescript
import { getNow, getToday, getUnixNow } from "@burglekitt/gmt/plain/get";
import { mapDatesInRange, mapDaysInMonth } from "@burglekitt/gmt/plain/map";
import { parseDateUnit } from "@burglekitt/gmt/plain/parse";
import { isValidDate, isValidUnixMilliseconds } from "@burglekitt/gmt/plain/validate";

getNow();
// "2026-03-18T11:42:33.123"

getToday();
// "2026-03-18"

getUnixNow("milliseconds");
// 1710685845000

mapDaysInMonth("2024-02");
// ["2024-02-01", ..., "2024-02-29"]

mapDatesInRange("2024-03-01", "2024-03-05", 2);
// ["2024-03-01", "2024-03-03", "2024-03-05"]

parseDateUnit("2024-03-17", "month");
// "03"

isValidDate("2024-02-29");
// true

isValidUnixMilliseconds("1710685845000");
// true
```

### Zoned arithmetic, conversion, and formatting

```typescript
import { addZoned } from "@burglekitt/gmt/zoned/calculate";
import {
  convertUtcDateTimeToUnix,
  convertTimezoneToUnix,
  convertTimezoneToUtc,
  convertUnixToTimezone,
  convertUtcToUnix,
  convertUtcToTimezone,
} from "@burglekitt/gmt/zoned/convert";
import { formatZonedDateTime } from "@burglekitt/gmt/zoned/format";

addZoned("2026-03-07T23:00:00-05:00[America/New_York]", 2, "hour");
// "2026-03-08T01:00:00-05:00[America/New_York]" or DST-adjusted equivalent depending on the instant

convertTimezoneToUnix("2024-03-17T10:30:45-04:00[America/New_York]", "seconds");
// 1710685845

convertTimezoneToUtc("2024-03-17T10:30:45-04:00[America/New_York]");
// "2024-03-17T14:30:45Z"

convertUtcToUnix("2024-03-17T14:30:45Z", "seconds");
// 1710685845

convertUtcDateTimeToUnix("2024-03-17T09:00:00", "seconds");
// 1710666000

convertUnixToTimezone(1710685845000, "Asia/Kolkata");
// "2024-03-17T20:00:45+05:30[Asia/Kolkata]"

convertUtcToTimezone("2024-03-17T14:30:45Z", "Pacific/Apia");
// zoned datetime in Pacific/Apia at the same instant

formatZonedDateTime("2024-03-17T14:30:45+00:00[UTC]", "en-US", {
  dateStyle: "full",
  timeStyle: "short",
});
// locale-dependent non-empty formatted string
```

### Zoned get, map, parse, and validate helpers

```typescript
import { getUtcNow, getZonedDateTime, getZonedNow, getZonedToday } from "@burglekitt/gmt/zoned/get";
import { mapZonedDatesInRange, mapZonedHoursInDay } from "@burglekitt/gmt/zoned/map";
import { parseZonedDate, parseZonedTimezone } from "@burglekitt/gmt/zoned/parse";
import { isValidTimezone, isValidZonedDateTime } from "@burglekitt/gmt/zoned/validate";

getZonedNow("UTC");
// current zoned datetime in UTC

getUtcNow();
// current UTC instant string

getZonedToday("America/Chicago");
// local ISO date string for that timezone

getZonedDateTime("2024-03-17T14:30:45", "Europe/Helsinki");
// "2024-03-17T14:30:45+02:00[Europe/Helsinki]"

mapZonedHoursInDay("2024-03-17T12:00:00+00:00[UTC]");
// 24 hourly zoned datetimes for that local day

mapZonedDatesInRange(
  "2024-03-17T10:00:00-05:00[America/Chicago]",
  "2024-03-19T10:00:00-05:00[America/Chicago]",
);
// ["2024-03-17", "2024-03-18", "2024-03-19"]

parseZonedDate("2024-03-17T14:30:45+00:00[UTC]");
// "2024-03-17"

parseZonedTimezone("2024-03-17T14:30:45+00:00[UTC]");
// "UTC"

isValidTimezone("Asia/Kathmandu");
// true

isValidZonedDateTime("2024-03-17T14:30:45+00:00[UTC]");
// true
```

---

## API Surface

### `@burglekitt/gmt/plain/calculate`

- `addDate`
- `addDateTime`
- `addTime`
- `diffDate`
- `diffDateTime`
- `diffTime`
- `subtractDate`
- `subtractDateTime`
- `subtractTime`

### `@burglekitt/gmt/plain/chop`

- `chopDate`
- `chopMilliseconds`
- `chopSeconds`
- `chopTime`
- `chopUtc`

### `@burglekitt/gmt/plain/compare`

- `areDatesEqual`
- `areDateTimesEqual`
- `areTimesEqual`
- `isAfterDate`
- `isAfterDateTime`
- `isAfterTime`
- `isBeforeDate`
- `isBeforeDateTime`
- `isBeforeTime`

### `@burglekitt/gmt/plain/format`

- `formatDate`
- `formatDateTime`
- `formatTime`

### `@burglekitt/gmt/plain/get`

- `getNow`
- `getSystemTimezone`
- `getToday`
- `getUnixNow`

### `@burglekitt/gmt/plain/map`

- `mapDatesInRange`
- `mapDaysInMonth`

### `@burglekitt/gmt/plain/parse`

- `parseDateTimeUnit`
- `parseDateUnit`
- `parseTimeUnit`

### `@burglekitt/gmt/plain/validate`

- `isLeapSecond`
- `isValidDate`
- `isValidDateOrDateTime`
- `isValidDateRange`
- `isValidDateTime`
- `isValidDateTimeUnit`
- `isValidDateUnit`
- `isValidTime`
- `isValidTimeUnit`
- `isValidUnixMilliseconds`
- `isValidUnixSeconds`
- `isUtcDateTime`

### `@burglekitt/gmt/zoned/calculate`

- `addZoned`
- `subtractZoned`

### `@burglekitt/gmt/zoned/chop`

- `chopZonedDate`
- `chopZonedDateTime`
- `chopZonedMilliseconds`
- `chopZonedSeconds`
- `chopZonedTime`
- `chopZonedTimezone`

### `@burglekitt/gmt/zoned/compare`

- `areZonedEqual`
- `isAfterZoned`
- `isBeforeZoned`

### `@burglekitt/gmt/zoned/convert`

- `convertTimezoneToUnix`
- `convertTimezoneToUtc`
- `convertUnixToTimezone`
- `convertUnixToZoned`
- `convertUnixToUtc`
- `convertUtcDateTimeToUnix`
- `convertZonedToUnix`
- `convertZonedToZoned`
- `convertUtcToTimezone`
- `convertUtcToUnix`

### `@burglekitt/gmt/zoned/format`

- `formatZonedDateTime`
- `formatZonedRange`

### `@burglekitt/gmt/zoned/get`

- `getZonedDate`
- `getZonedDateTime`
- `getUtcNow`
- `getZonedNow`
- `getZonedToday`

### `@burglekitt/gmt/zoned/map`

- `mapZonedDatesInRange`
- `mapZonedHoursInDay`

### `@burglekitt/gmt/zoned/parse`

- `parseZonedDate`
- `parseZonedTime`
- `parseZonedTimezone`
- `parseZonedUnit`

### `@burglekitt/gmt/zoned/validate`

- `isValidTimezone`
- `isValidZonedDateTime`

### `@burglekitt/gmt/regex`

- `year`
- `month`
- `day`
- `plainDate`
- `plainDateTime`
- `leapSecond`
- `hour`
- `minute`
- `second`
- `fractionalSecond`
- `millisecond`
- `plainTime`
- `timezoneLike`
- `unixSeconds`
- `unixMilliseconds`
- `utcDateTime`

---

## TODO (Feature Gaps)

Prioritized roadmap and parity checks against Luxon, Moment, and date-fns.

1. Interval primitives and helpers (`Interval` type, overlap checks, containment checks, interval sorting, interval normalization/merge).
2. Range iteration helpers (each day/week/month/quarter across a range for plain and zoned inputs).
3. Clamp/min/max helpers for dates datetimes times (bounded values and collection min/max selectors).
4. `isBetween` and inclusive/exclusive boundary helpers for plain and zoned APIs.
5. Quarter helpers beyond parse-only accessors (`getQuarter`, `startOfQuarter`, `endOfQuarter`).
6. Additional start/end boundaries (`startOfWeek`, `endOfWeek`, ISO-week variants, month/year boundaries where missing).
7. Duration utilities (interval-to-duration, ISO duration formatting, optional human-readable duration formatting).
8. Calendar/relative formatting helpers (`formatRelative`, distance-to-now style outputs).
9. Serialization adapters package (`gmt-serializers`) for SuperJSON-style Temporal round-tripping.
10. Parsing pack for non-ISO but common user inputs (`YYYY/MM/DD`, `HHmm`, month-name parsing) in a separate optional package.
11. Business-day helpers (`addBusinessDays`, `differenceInBusinessDays`) as an optional domain module.
12. Optional validation package (`gmt-zod`) kept separate from core `@burglekitt/gmt`.
13. Descriptive parsing errors for timezones, GMT offsets
---

## Testing Matrix

The zoned suite is intentionally biased toward timezone edge cases rather than only UTC happy paths.

- `Pacific/Niue` and `Pacific/Apia` exercise far-edge calendar separation at the same instant.
- `UTC` and `Etc/GMT` cover baseline zero-offset handling.
- `Europe/Helsinki`, `America/Chicago`, and `Asia/Shanghai` cover common regional behavior.
- `Asia/Kolkata`, `Asia/Kathmandu`, and `Pacific/Chatham` cover half-hour and 45-minute offset paths.
- `Asia/Calcutta` is included as a timezone alias validation case.

This matrix is used across zoned compare, convert, format, get, map, parse, and validate tests.

---

## License

MIT — See [LICENSE](../../LICENSE) for details.
