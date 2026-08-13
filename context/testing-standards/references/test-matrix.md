# Test Matrix

Canonical test values for GMT tests. Tests may inline these strings or reference the exported constants from `packages/gmt/src/test/localeMatrix.ts` and `packages/gmt/src/test/timeZoneMatrix.ts`.

## Dates (PlainDate)

| Constant | Value |
|---|---|
| `dateLeapDay2024Feb29` | `"2024-02-29"` |
| `dateNonLeapDay2023Feb28` | `"2023-02-28"` |
| `dateYearStart2024Jan01` | `"2024-01-01"` |
| `dateYearEnd2024Dec31` | `"2024-12-31"` |
| `dateMonthStart2024Mar01` | `"2024-03-01"` |
| `dateMonthEnd2024Mar31` | `"2024-03-31"` |

## DateTimes (PlainDateTime)

| Constant | Value |
|---|---|
| `dateTimeLeapDay2024Feb29StartOfDay` | `"2024-02-29T00:00:00"` |
| `dateTimeLeapDay2024Feb29Noon` | `"2024-02-29T12:00:00"` |
| `dateTimeLeapDay2024Feb29EndOfDay` | `"2024-02-29T23:59:59"` |
| `dateTimeNonLeapDay2023Feb28StartOfDay` | `"2023-02-28T00:00:00"` |
| `dateTimeNonLeapDay2023Feb28Noon` | `"2023-02-28T12:00:00"` |
| `dateTimeNonLeapDay2023Feb28EndOfDay` | `"2023-02-28T23:59:59"` |
| `dateTimeYearStart2024Jan01StartOfDay` | `"2024-01-01T00:00:00"` |
| `dateTimeYearEnd2024Dec31EndOfDay` | `"2024-12-31T23:59:59"` |

## Times (PlainTime)

| Constant | Value |
|---|---|
| `timeNoon` | `"12:00:00"` |
| `timeMidnight` | `"00:00:00"` |
| `timeEndOfDay` | `"23:59:59"` |

## Unix Timestamps (Instant)

| Constant | Value |
|---|---|
| `unix2024Jan01T000000Ms` | `1704067200000` |
| `unix2024Jan01T000000Sec` | `1704067200` |
| `unix2024Dec31T235959Ms` | `1735689599000` |
| `unix2024Dec31T235959Sec` | `1735689599` |

## UTC Zoned DateTimes

| Constant | Value |
|---|---|
| `utcStart2024Jan01StartOfDay` | `"2024-01-01T00:00:00+00:00[UTC]"` |
| `utcEnd2024Dec31EndOfDay` | `"2024-12-31T23:59:59+00:00[UTC]"` |

## Non-UTC Zoned DateTimes

Derive at test time by mapping the unix timestamps over `battleTestTimeZones`:

```ts
import { battleTestTimeZones } from "@gmt/test";
import { Temporal } from "@js-temporal/polyfill";

const zonedStartCases = battleTestTimeZones.map((timeZone) => ({
  timeZone,
  value: Temporal.Instant.from(unix2024Jan01T000000Ms)
    .toZonedDateTimeISO(timeZone)
    .toString(),
}));
```

## Durations

| Constant | Value |
|---|---|
| `durationOneDay` | `"P1D"` |
| `durationOneHour` | `"PT1H"` |
| `durationOneMinute` | `"PT1M"` |
| `durationOneSecond` | `"PT1S"` |
| `duration90Minutes` | `"PT90M"` |
| `durationOneDayOneHour` | `"P1DT1H"` |

## Reference Fixtures

- **`packages/gmt/src/test/localeMatrix.ts`** — `MustTestLocales`, `localeZonedDateTimeInputByLocale`, `localeZonedRangeInputByLocale`
- **`packages/gmt/src/test/timeZoneMatrix.ts`** — `battleTestTimeZones`, `sameInstantBattleCases`, `unixEpochBattleCases`, `localNoonBattleCases`, `localRangeBattleCases`
