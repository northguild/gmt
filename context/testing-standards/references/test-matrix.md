# Test Matrix

Canonical test **values** for GMT tests. Write them inline as literals. The names in the
"Label" columns are descriptive only — **they are not exported constants**, and nothing in
`packages/gmt/src/test/` exports them. The fixtures that *are* exported (locales, time zones,
battle cases) are listed under [Reference Fixtures](#reference-fixtures) and must be imported.
See [index.md § Canonical Date Fixtures](./index.md#canonical-date-fixtures).

## Dates (PlainDate)

| Label | Value |
|---|---|
| `dateLeapDay2024Feb29` | `"2024-02-29"` |
| `dateNonLeapDay2023Feb28` | `"2023-02-28"` |
| `dateYearStart2024Jan01` | `"2024-01-01"` |
| `dateYearEnd2024Dec31` | `"2024-12-31"` |
| `dateMonthStart2024Mar01` | `"2024-03-01"` |
| `dateMonthEnd2024Mar31` | `"2024-03-31"` |

## DateTimes (PlainDateTime)

| Label | Value |
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

| Label | Value |
|---|---|
| `timeNoon` | `"12:00:00"` |
| `timeMidnight` | `"00:00:00"` |
| `timeEndOfDay` | `"23:59:59"` |

## Unix Timestamps (Instant)

| Label | Value |
|---|---|
| `unix2024Jan01T000000Ms` | `1704067200000` |
| `unix2024Jan01T000000Sec` | `1704067200` |
| `unix2024Dec31T235959Ms` | `1735689599000` |
| `unix2024Dec31T235959Sec` | `1735689599` |

## UTC Zoned DateTimes

| Label | Value |
|---|---|
| `utcStart2024Jan01StartOfDay` | `"2024-01-01T00:00:00+00:00[UTC]"` |
| `utcEnd2024Dec31EndOfDay` | `"2024-12-31T23:59:59+00:00[UTC]"` |

## Non-UTC Zoned DateTimes

Derive at test time by mapping the unix timestamps over `battleTestTimeZones`:

```ts
import { battleTestTimeZones } from "../../test"; // relative — there is no @gmt/test alias
import { Temporal } from "@js-temporal/polyfill";

const zonedStartCases = battleTestTimeZones.map((timeZone) => ({
  timeZone,
  value: Temporal.Instant.fromEpochMilliseconds(1704067200000) // unix2024Jan01T000000Ms
    .toZonedDateTimeISO(timeZone)
    .toString(),
}));
```

## Durations

| Label | Value |
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
