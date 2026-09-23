# @northguild/gmt

## 1.16.0

### Minor Changes

- 26caa18: Add the `calendar/` namespace: ISO week and ordinal dates, quarter and fiscal periods, and zone-aware bucketing (Story CORE-5).
  
  Two absences with outsized consequences, and they turn out to be the same absence twice: a calendar boundary is not a fixed number of hours, and it is not in UTC.
  
  **Week and period identifiers.** Vessel schedules are published by week number and retail runs on 52/53-week fiscal calendars. GMT could express neither.
  
  ```typescript
  import {
    getFiscalPeriod,
    getIsoWeekDate,
    getOrdinalDate,
    getQuarter,
  } from "@northguild/gmt";
  
  getIsoWeekDate("2027-01-01"); // { year: 2026, week: 53, weekday: 5 } — week-year 2026, not 2027
  getOrdinalDate("2024-12-31"); // { year: 2024, dayOfYear: 366 }
  getQuarter("2024-03-31", { fiscalYearStartMonth: 4 }); // { year: 2023, quarter: 4 }
  
  // The NRF retail calendar, stated as its published rule: "the Saturday nearest to January 31".
  const nrf = { pattern: "4-5-4", yearEndsOn: "2026-01-31" } as const;
  
  getFiscalPeriod("2024-06-15", nrf); // { year: 2024, period: 5, week: 19 }
  getFiscalPeriod("2024-01-28", nrf); // { year: 2023, period: 12, week: 53 } — a 53-week year
  ```
  
  **Zone-aware bucketing.** "Group by day in `America/New_York`" over UTC timestamps is the most common observability bug there is, and the same operation decides how many chargeable days a container accrued, because free time is counted in terminal-local calendar days.
  
  ```typescript
  import { bucketRange, floorToZone } from "@northguild/gmt";
  
  floorToZone("2024-06-15T03:00:00Z", "day", "America/New_York"); // "2024-06-14T04:00:00Z"
  floorToZone("2024-06-15T03:00:00Z", "day", "UTC");              // "2024-06-15T00:00:00Z"
  
  bucketRange("2024-03-09T05:00:00Z", "2024-03-12T04:00:00Z", "day", "America/New_York");
  // ["2024-03-09T05:00:00Z", "2024-03-10T05:00:00Z", "2024-03-11T04:00:00Z"] — 24h, then 23h
  ```
  
  - **Identifiers take a zoneless date or datetime; a moment is refused.** An instant has no calendar date until a zone is named, and answering "which ISO week is this?" in whatever zone the string happened to be written in is the bug this story exists to prevent. Floor it with `floorToZone` first, or convert it in the zone you mean.
  - **`getFiscalPeriod`'s `yearEndsOn` states the year-end *rule*, by example — not one year's end.** Fiscal years end on that date's weekday, on the occurrence nearest that date's month and day. The NRF's published rule, "the Saturday nearest to January 31" ([NRF 4-5-4 calendar](https://nrf.com/resources/4-5-4-calendar)), is `"2026-01-31"` — a Saturday falling exactly on January 31 — and it regenerates every year boundary the NRF publishes for 2017 through 2028, all three 53-week years included. Whether a year has 52 or 53 weeks is derived from the gap between its own two ends, never read from a bundled table: there is no single correct retail calendar to bundle. A 53rd week is appended to period 12, which is where the NRF adds it.
  - **`year` is the calendar year a fiscal year *starts* in**, for both `getFiscalPeriod` and `getQuarter` — matching the NRF, where fiscal 2023 runs 2023-01-29 to 2024-02-03. Conventions that label by the end year (the US federal October-start FY2025 begins in October 2024) should add one. It is not a unique key for a rule anchored near 1 January: a 364/371-day year drifts against the calendar, so under "the Saturday nearest to 31 December" two consecutive fiscal years share a label and some calendar years label none. The JSDoc says so; GMT does not invent a label the inputs do not fix.
  - **Buckets are deliberately not uniform in length.** A local day that springs forward is 23 hours and one that falls back is 25; forcing 24 is what makes a daily aggregate drift an hour twice a year. The same honesty applies to boundaries that do not exist: the calendar day Samoa deleted crossing the date line is absent from `bucketRange`, a local day whose midnight is skipped starts at 01:00, and in a zone that falls back by half an hour (`Australia/Lord_Howe`) the local 01:00 hour bucket is genuinely 90 minutes long.
  - **Boundaries are measured in exact time, not by truncating a wall clock.** Truncating and
    re-resolving is what most implementations do, and it breaks in zones whose shift is not a
    whole hour: `Pacific/Chatham` springs forward 02:45 → 03:45, so a truncated local 03:00 does
    not exist and resolving it lands *after* the instant being floored. GMT measures how far into
    the unit the wall clock sits and subtracts that exactly, so a floor never moves forward, and a
    bucket shorter than its own unit — Chatham's 15-minute 03:00 hour, `America/Goose_Bay`'s
    60-second local midnight — is never skipped. Checked against 2,576 transition windows across
    all 418 IANA zones.
  - **`bucketRange` is half-open, `[start, end)`**, so an `end` landing exactly on a boundary does not open that bucket; a zero-length range mid-bucket still returns the one bucket holding it. It returns at most 10,000 boundaries and `[]` past that, since an unbounded hour walk over Temporal's ±273,790-year range would exhaust memory.
  - Weeks start on Monday (ISO 8601) in both `floorToZone` and `bucketRange`, matching `startOfZoned` and `intervalCountZoned`.
  - Also exported: the `FiscalCalendar`, `FiscalPattern` and `ZoneBucketUnit` types, and the type guards that narrow the two unions — `isValidFiscalPattern` and `isValidZoneBucketUnit`. Both `getFiscalPeriod` and `floorToZone`/`bucketRange` return their sentinel for an unrecognised pattern or unit, which is the same sentinel a date or instant they cannot use returns; a pattern or unit read from config, an env var or a form is a bare string until one of these narrows it.
- 7846ecf: Add the business calendar engine: holiday calendars, calendar composition and roll conventions (Story CORE-7).
  
  `BusinessCalendar` is `{ weekend: number[], holidays: string[], timeZone: string }`. The weekend is explicit ISO weekday numbers because Saturday–Sunday is not universal — much of the Middle East is Friday–Saturday, and some markets keep a one-day weekend. Holidays are caller-supplied: GMT bundles no holiday table on the default import path, because holiday data is jurisdictional and changes annually, sometimes with days of notice.
  
  New in `calendar/business/`:
  
  ```ts
  businessDaysBetween("2024-07-01", "2024-07-05", usCalendar); // 3 — start exclusive, end inclusive
  nextBusinessDay("2024-07-03", usCalendar); // "2024-07-05" — strictly after, skipping 4 July
  previousBusinessDay("2024-07-05", usCalendar); // "2024-07-03"
  rollDate("2024-05-31", "modifiedFollowing", usCalendar); // "2024-05-30" — forward would leave May
  mergeCalendars([usCalendar, ukCalendar]); // working days both jurisdictions share
  ```
  
  `rollDate` implements the six conventions — `following`, `modifiedFollowing`, `preceding`, `modifiedPreceding`, `endOfMonth` and `none`. `mergeCalendars` unions weekend rules and holidays, so a date survives only if it is a working day in every input: the two-currency intersection FX settlement needs, and the two-port one an intermodal move needs.
  
  `isBusinessDay`, `addBusinessDays` and `subtractBusinessDays` take an optional `BusinessCalendar` as a new trailing argument. Omitting it keeps their existing Monday–Friday, no-holiday behaviour exactly, so no shipped call changes. All three are re-exported from `calendar/business` alongside the new functions.
  
  `isValidBusinessCalendar` and `isValidRollConvention` narrow a candidate, telling a misconfigured calendar or contract term apart from bad date input when a function returns its sentinel.
  
  Fixes a defect in `addBusinessDays` / `subtractBusinessDays` / `addZonedBusinessDays` / `subtractZonedBusinessDays`: the shared walker recursed once per calendar day, so an amount above roughly 6,000 business days overflowed the stack and returned the invalid-input sentinel for a valid request — `addBusinessDays("2024-01-01", 10000)` returned `""` instead of `"2062-05-01"`. The walk is now a bounded loop, capped at 200,000 calendar days (about 547 years), returning the sentinel only when that cap is reached.
- b414f44: Add foreign epoch bridges to `precision/convert/`: NTP, Windows `FILETIME`, .NET ticks, Excel day serials, and PostgreSQL's internal microseconds (Story CORE-3).
  
  Nothing else counts from 1970. NTP counts from 1900 and rolls over in 2036; `FILETIME` counts 100-nanosecond intervals from 1601; .NET ticks count the same interval from year 1; Excel uses a day serial carrying a deliberate 1900 leap-year bug; PostgreSQL stores microseconds from 2000-01-01. None of it was in gmt, so every integration hardcoded the constants — usually wrongly.
  
  ```typescript
  import {
    toNtpTimestamp,
    fromNtpTimestamp,
    toFileTime,
    fromFileTime,
    toDotNetTicks,
    fromDotNetTicks,
    toExcelSerial,
    fromExcelSerial,
    toPgMicroseconds,
    fromPgMicroseconds,
  } from "@northguild/gmt";
  
  toFileTime("1970-01-01T00:00:00Z");
  // 116444736000000000n — 100 ns intervals since 1601-01-01
  
  toDotNetTicks("1970-01-01T00:00:00Z");
  // 621355968000000000n — same unit, counted from 0001-01-01
  
  toPgMicroseconds("2024-03-10T12:00:00Z");
  // 763387200000000n — microseconds since 2000-01-01
  
  toExcelSerial("2024-03-10T12:00:00Z");
  // 45361.5 — days, with the time of day as the fraction
  ```
  
  - **NTP timestamps are era-ambiguous by design.** The seconds field is unsigned 32-bit, so it wraps every ~136.19 years and the value carries no era. `toNtpTimestamp("2036-02-07T06:28:15Z")` is `18446744069414584320n`, the last second of era 0, and the next second is `0n` again — the wire format's own ambiguity, not a gmt limitation, so instants outside era 0 wrap rather than being rejected. `fromNtpTimestamp` takes the era as an explicit second argument, defaulting to 0.
  - **Excel's serial 60 is the phantom 29 February 1900** — a date that never existed, since 1900 was not a leap year. Lotus 1-2-3 got it wrong and Excel keeps the bug for compatibility, so `fromExcelSerial(60)` is `""`: 59 is 1900-02-28 and 61 is 1900-03-01, and mapping 60 onto either neighbour would put gmt one day out from Excel for every earlier date. `{ system: "1904" }` selects the legacy Mac system, whose serials are exactly 1462 lower and which has no phantom day.
  - **Each bridge accepts only what its target format can hold**, and returns the namespace's sentinel otherwise rather than an out-of-range number: `toFileTime` on a pre-1601 instant is `0n`, not a negative tick count, and `toExcelSerial` past 9999-12-31 is `null`. The ranges are the formats' own — unsigned 64-bit for `FILETIME`, `DateTime.MinValue`/`MaxValue` for .NET ticks, serials 1–2958465 (or 0–2957003 in the 1904 system) for Excel, and PostgreSQL's `MIN_TIMESTAMP` (4713 BC) for `timestamptz`, which is 40× later than the earliest instant Temporal can represent.
  - **Round trips are exact to the target format's unit.** Where that unit is coarser than a nanosecond, the conversion floors toward negative infinity so the grid stays uniform either side of the epoch: 100 ns for `FILETIME` and .NET ticks, 1 µs for PostgreSQL, 1 ms for Excel. NTP is the exception in the other direction — its 2^-32 s unit is finer than a nanosecond, so `fromNtpTimestamp` rounds to the nearest nanosecond, which is what makes the round trip exact rather than one nanosecond early.
  - Every bridge returns a sentinel (`""`, `0n`, `null`) on invalid input and never throws. For the `bigint`-returning ones `0n` is also their own epoch — 1900-01-01 for NTP, 1601-01-01 for `FILETIME`, 0001-01-01 for .NET ticks, 2000-01-01 for PostgreSQL — so validate the input first when the two must be told apart.
  - These are plain instant conversions; no leap seconds are involved in any of them.
  
  `toNanoseconds` now delegates to a shared internal instant parser, so all six functions in the namespace that take an instant string apply one leap-second and calendar-annotation gate. Its behaviour is unchanged.
- 729e0f1: Make a `diff*` units array return the whole difference, number Sunday-first weeks by UTS #35, and read microseconds and nanoseconds in every `parseUnitFrom*` function (Story CORE-8).
  
  **A units array accounts for the whole difference.** `diffDate`, `diffDateTime`, `diffTime`, `diffUtc`, `diffZoned` and `diffUnix` used the largest listed unit as Temporal's `largestUnit` and returned only the listed fields. The amount in any unit not listed was dropped: `["years", "days"]` across 1 year and 2 months returned `{ years: 1, days: 0 }`. Weeks were dropped too, because Temporal fills weeks only when they are the largest unit. Unlisted amounts now fold into the next smaller listed unit, measured from the start moved by the larger listed amounts, so the record adds back up to the difference. A contiguous list keeps Temporal's own fields and rounding.
  
  ```typescript
  import { diffDate, diffDateTime } from "@northguild/gmt/plain";
  import { diffZoned } from "@northguild/gmt/zoned";
  
  diffDate("2024-01-01", "2025-03-15", ["years", "days"]); // { years: 1, days: 73 }
  diffDate("2024-01-01", "2024-03-20", ["months", "weeks", "days"]); // { months: 2, weeks: 2, days: 5 }
  diffDateTime("2024-01-01T00:00", "2024-03-20T05:00", ["months", "weeks", "hours"]); // { months: 2, weeks: 2, hours: 125 }
  diffZoned("2024-02-10T00:00:00-05:00[America/New_York]", "2024-03-11T23:00:00-04:00[America/New_York]", ["months", "hours"]); // { months: 1, hours: 46 }
  ```
  
  **An empty units array is invalid.** All six functions return `null` for `[]`, since no unit was asked for.
  
  **`diffUnix` reads singular unit names in an array.** It returned `null` for `["month", "week"]`. It now returns plural keys like the other five, and its return type is `Record<DateTimeDurationUnit, number>`.
  
  ```typescript
  import { diffUnix } from "@northguild/gmt/unix";
  
  diffUnix(1704067200000, 1710892800000, ["month", "week"]); // { months: 2, weeks: 2 }
  ```
  
  **Sunday-first week numbers follow UTS #35.** `getWeekNumber(value, "sunday")` counted weeks within the calendar year, so the last days of December could be week 53 or 54. UTS #35 Part 4, with a minimum of one day in the first week, puts them in week 1 of the next year when that week holds 1 January. The same rule applies to `parseWeekFromDate`, `parseWeekFromDateTime`, `parseWeekFromUtc`, `parseWeekFromZoned`, `parseWeekFromUnix` and `parseUnitFrom*(…, "week")` with `weekStartsOn: "sunday"`. Week numbers are 1–53 in both modes. Monday-first weeks were already ISO 8601 and are unchanged.
  
  ```typescript
  import { getWeekNumber, parseWeekFromDate } from "@northguild/gmt/plain";
  
  getWeekNumber("2024-12-31", "sunday"); // 1
  getWeekNumber("2000-12-31", "sunday"); // 1
  getWeekNumber("2024-12-28", "sunday"); // 52
  parseWeekFromDate("2024-12-31", { weekStartsOn: "sunday" }); // 1
  ```
  
  **`parseUnitFromDateTime`, `parseUnitFromTime`, `parseUnitFromUtc` and `parseUnitFromZoned` read `"microsecond"` and `"nanosecond"`.** `parseUnitFromUnix` already did. Each field is three digits, as Temporal's `microsecond` and `nanosecond` fields are.
  
  ```typescript
  import { parseUnitFromTime } from "@northguild/gmt/plain";
  import { parseUnitFromUtc } from "@northguild/gmt/utc";
  
  parseUnitFromUtc("2023-11-14T22:13:20.123456789Z", "microseconds"); // "456"
  parseUnitFromTime("22:13:20.123456789", "nanosecond"); // "789"
  ```
  
  ### Breaking changes
  
  | Call | 1.15 | 1.16 |
  | --- | --- | --- |
  | `diffDate("2024-01-01", "2025-03-01", ["years", "days"])` | `{ years: 1, days: 0 }` | `{ years: 1, days: 59 }` |
  | `diffDate("2024-01-01", "2024-03-20", ["months", "weeks"])` | `{ months: 2, weeks: 0 }` | `{ months: 2, weeks: 2 }` |
  | `diffDate(a, b, [])`, likewise `diffDateTime`, `diffTime`, `diffUtc`, `diffZoned`, `diffUnix` | `{}` | `null` |
  | `getWeekNumber("2024-12-31", "sunday")` | `53` | `1` |
  | `getWeekNumber("2000-12-31", "sunday")` | `54` | `1` |
  
  Migration: to get only the listed fields of Temporal's own difference, list every unit between the largest and the smallest you need, and ignore the ones you do not. For a calendar-year count of Sunday weeks, count from the year's first Sunday yourself.
- 82380f8: Export the `nanosecondDecimal` pattern from `@northguild/gmt/regex` and the package root.
  
  `isValidNanoPattern` documented it as a `regex/` pattern, but the `regex` barrel never re-exported its file, so it could not be imported. It now can.
- 729e0f1: Make the positional interval functions in `plain/`, `utc/`, `zoned/` and `unix/` half-open `[start, end)`, the rule the `interval/` namespace already follows (Story CORE-8).
  
  Earlier releases read most of these functions' intervals as closed `[start, end]`, with both endpoints inside, and stepped one unit in from every cut to make that work: one nanosecond, one day, or one epoch unit. A result from `intervalsOverlapUtc` could then disagree with `intervalsOverlap` on the same instants. Every positional family now uses `start ≤ t < end`, as SQL:2011's closed-open `PERIOD`, RFC 5545's non-inclusive `DTEND` and EWD831 do, and the one-unit steps are gone.
  
  ```typescript
  import { intervalAbutsDate, intervalContainsDate, intervalDifferenceUtc, intervalsOverlapUtc } from "@northguild/gmt";
  
  intervalsOverlapUtc("2024-01-01T09:00:00Z", "2024-01-01T12:00:00Z", "2024-01-01T12:00:00Z", "2024-01-01T17:00:00Z"); // false
  intervalDifferenceUtc("2024-01-01T09:00:00Z", "2024-01-01T17:00:00Z", "2024-01-01T12:00:00Z", "2024-01-01T13:00:00Z");
  // [{ start: "2024-01-01T09:00:00Z", end: "2024-01-01T12:00:00Z" }, { start: "2024-01-01T13:00:00Z", end: "2024-01-01T17:00:00Z" }]
  intervalContainsDate("2024-01-01", "2024-02-01", "2024-01-31"); // true
  intervalAbutsDate("2024-01-01", "2024-07-01", "2024-07-01", "2024-12-31"); // true
  ```
  
  - **Which functions.** Every variant (`Date`, `DateTime`, `Time`, `Utc`, `Zoned`, `Unix`) of `intervalsOverlap*`, `intervalContains*`, `intervalEngulfs*`, `intervalIntersection*`, `intervalUnion*`, `mergeIntervals*`, `intervalDifference*`, `intervalXor*`, `intervalXorAll*`, `intervalAbuts*` and `intervalOverlappingDays*`. The `Utc` variants call `interval/`'s `intervalsOverlap`, `intervalContains`, `intersectIntervals`, `mergeIntervals` and `subtractIntervals`, so both namespaces give the same answer.
  - **Touching intervals** do not overlap and have no intersection. They abut: `intervalAbuts*` is Allen's "meets", one interval's `end` equal to the other's `start`. `intervalUnion*`, `mergeIntervals*` and `intervalXor*` join them into one run.
  - **Empty intervals.** `start === end` holds no instant. It abuts nothing, and it is contained or engulfed only strictly inside another interval. `intervalUnion*` ignores it, and returns `null` when both inputs are empty.
  - **The tiling functions keep their output.** `intervalSplitAt*`, `splitIntervalByUnit*` and `intervalDivideEqually*` still give each piece's `end` as the next piece's `start`. Under the half-open rule those pieces share no instant, so they partition the interval.
  - **Outputs are still re-serialised** in each type's canonical spelling, so a row whose value did not change returns the same string.
  
  **`intervalCount*` counts an empty interval as `0`.** A zero-length interval holds no instant, so it touches no unit. All six families counted `1` when the point fell inside a unit.
  
  **`intervalOverlappingDaysZoned` and `intervalOverlappingDaysUnix` return `0` for an empty intersection.** An empty interval strictly inside the other one counted as one day. `intervalOverlappingDaysUtc`, `…Date` and `…DateTime` return `0` too.
  
  ```typescript
  import { intervalCountUnix, intervalOverlappingDaysUnix } from "@northguild/gmt/unix";
  
  intervalCountUnix(1800000, 1800000, "hour"); // 0
  intervalOverlappingDaysUnix(0, 172800000, 129600000, 129600000); // 0
  ```
  
  **`splitIntervalByUnit*` rejects a unit its type does not have, even for an empty interval.** A zero-length interval returned a one-piece split for any unit. It now returns `[]`, as a non-empty interval does. `splitIntervalByUnitDate` accepts only date units, and `splitIntervalByUnitTime` only time units.
  
  ```typescript
  import { splitIntervalByUnitDate } from "@northguild/gmt/plain";
  
  splitIntervalByUnitDate("2024-01-01", "2024-01-01", "hour", 1); // []
  ```
  
  ### Breaking changes
  
  `A` is `2024-01-01T09:00:00Z`, `B` is `…T12:00:00Z`, `C` is `…T13:00:00Z` and `D` is `…T17:00:00Z`. Each row applies to every variant of its family.
  
  | Call | 1.15 (closed) | 1.16 (half-open) |
  | --- | --- | --- |
  | `intervalsOverlapUtc(A, B, B, D)` | `true` | `false` |
  | `intervalContainsUtc(A, B, B)`, a point at `end` | `true` | `false` |
  | `intervalIntersectionUtc(A, B, B, D)` | `{ start: B, end: B }` | `null` |
  | `intervalDifferenceUtc(A, D, B, C)` | `[{ A, …T11:59:59.999999999Z }, { …T13:00:00.000000001Z, D }]` | `[{ A, B }, { C, D }]` |
  | `intervalDifferenceDate("2024-01-01", "2024-12-31", "2024-06-01", "2024-07-01")` | `[{ 01-01, 05-31 }, { 07-02, 12-31 }]` | `[{ 01-01, 06-01 }, { 07-01, 12-31 }]` |
  | `intervalXorUtc(A, C, B, D)`, `intervalXorAllUtc([{ A, C }, { B, D }])` | `[{ A, …T11:59:59.999999999Z }, { …T13:00:00.000000001Z, D }]` | `[{ A, B }, { C, D }]` |
  | `intervalAbutsUtc(A, B, B, D)`, a shared endpoint | `false` | `true` |
  | `intervalAbutsUtc(A, B, "2024-01-01T12:00:00.000000001Z", D)` | `true` | `false` |
  | `intervalAbutsDate("2024-01-01", "2024-06-30", "2024-07-01", "2024-12-31")` | `true` | `false` |
  | `intervalOverlappingDaysUtc("2024-01-01T00:00:00Z", "2024-01-02T00:00:00Z", "2024-01-02T00:00:00Z", "2024-01-03T00:00:00Z")` | `1` | `0` |
  | `intervalCountUnix(1800000, 1800000, "hour")` | `1` | `0` |
  | `splitIntervalByUnitDate("2024-01-01", "2024-01-01", "hour", 1)` | one piece | `[]` |
  
  Unchanged: `intervalUnionUtc(A, B, B, D)` is `{ start: A, end: D }`, `intervalIntersectionUtc(A, C, B, D)` is `{ start: B, end: C }`, `intervalSplitAtUtc(A, D, [B])` is `[{ A, B }, { B, D }]`, and `intervalCountUtc(A, D, "hour")` is `8`.
  
  Migration:
  
  - **An interval whose `end` was the last day, or last unit, it covers** now stops before it. Pass the next day or unit as `end`: `intervalContainsDate("2024-01-01", addDate("2024-01-31", { days: 1 }), "2024-01-31")` is `true`.
  - **Code that undid the one-unit step**, for example by adding a nanosecond to a piece from `intervalDifference*`, must stop: pieces now end and start exactly at the cut.
  - **Code that tested `intervalAbuts*` for a one-unit gap** now tests for a shared endpoint.
  - **`mapDatesInRange` and `mapZonedDatesInRange` stay end-inclusive** and did not change. They enumerate the dates a range covers, so `end` is one of them; `interval*` bounds a span, so `end` is not in it. Mixing the two in one expression is where this bites:
  
    ```typescript
    mapDatesInRange("2024-01-01", "2024-01-05", 1);
    // ["2024-01-01", "2024-01-02", "2024-01-03", "2024-01-04", "2024-01-05"] — 5 dates
  
    intervalCountDate("2024-01-01", "2024-01-05", "day"); // 4
    intervalContainsDate("2024-01-01", "2024-01-05", "2024-01-05"); // false
    splitIntervalByUnitDate("2024-01-01", "2024-01-05", "day", 1).length; // 4
    ```
  
    The same `start`/`end` pair therefore yields `n + 1` from the `map*` functions and `n` from the `interval*` ones. To read one set of bounds both ways, pass `addDate(end, { days: 1 })` to the `interval*` call, or `subtractDate(end, { days: 1 })` to the `map*` call.
- 729e0f1: Read options, unit names and locales the way Temporal and ECMA-402 read them, and remove the options no function reads (Story CORE-8).
  
  **Singular and plural unit names are the same unit everywhere.** Temporal §13.17 `GetTemporalUnitValuedOption` accepts `"day"` and `"days"` alike. Many GMT functions accepted only one spelling. Every unit-taking function now accepts both: the `startOf*`, `endOf*` and `are*EqualBy` functions, `diffDate`, `diffDateTime`, `diffTime`, `diffUtc`, `diffZoned`, `diffUnix` and their `*AsDuration` forms, the `getLargest*DurationUnit` functions, the `parseUnitFrom*` functions, `durationAs`, `getDurationUnit`, `getZonedOffsetAs`, `spanWallClock`, `floorToZone`, `bucketRange`, `isValidZoneBucketUnit` and the `get*NowUnit` functions.
  
  ```typescript
  import { diffDate, startOfDate } from "@northguild/gmt/plain";
  import { diffZoned } from "@northguild/gmt/zoned";
  
  diffDate("2024-01-01", "2024-03-20", "day"); // 79
  diffZoned("2024-01-01T00:00:00+00:00[UTC]", "2024-03-20T00:00:00+00:00[UTC]", "day"); // 79
  startOfDate("2024-03-15", "months"); // "2024-03-01"
  ```
  
  **An options argument must be an object.** Temporal's `GetOptionsObject` throws a `TypeError` for `null`, a string, a number or a boolean. GMT read all of them as "no options". The functions that take their own options object now return their sentinel, and the six `isValid*Range` validators return `false` for such a `props.options`. The functions backed by `Intl.DateTimeFormat` (`formatDate`, `formatTime`, `formatDateTime`, `formatDateRange`, `formatDateTimeRange`, the `…ToParts` functions, `formatUtc`, `formatUnix`, `formatZonedDateTime`, `formatZonedRange` and `formatZonedToParts`) follow ECMA-402's `CoerceOptionsToObject` instead: `null` returns the sentinel, and a string or number means the defaults. The `plain/` formatters and `formatZonedDateTime` already returned `""` for `null`; `formatUtc`, `formatUnix`, `formatZonedRange` and `formatZonedToParts` read it as no options. `formatDuration` builds its own options, so it returns `""` for any non-object.
  
  ```typescript
  import { addDate } from "@northguild/gmt/plain";
  import { durationAs, formatDuration } from "@northguild/gmt/duration";
  import { formatUnix } from "@northguild/gmt/unix";
  
  addDate("2024-03-10", { days: 5 }, null); // ""
  durationAs("P1DT2H30M", "hours", null); // null
  formatUnix(0, "en-US", null); // ""
  formatDuration("PT1H", "en-US", null); // ""
  ```
  
  **An explicit `undefined` is the same as an omitted argument,** as Temporal's `GetOption` treats it. `mapDatesInRange`, `mapZonedDatesInRange`, `fromNanoseconds` and `fromNtpTimestamp` returned their sentinel for it.
  
  ```typescript
  import { mapDatesInRange } from "@northguild/gmt/plain";
  
  mapDatesInRange("2024-01-01", "2024-01-03", undefined); // ["2024-01-01", "2024-01-02", "2024-01-03"]
  ```
  
  **Locales follow ECMA-402's `CanonicalizeLocaleList`.** Every locale-taking function accepts a `string` or a `string[]`, and a list uses its first supported tag. `isThisUnit` and `isZonedThisUnit` validate the locale for every unit, not only `"week"`. `getLocaleEraNames`, `getLocaleMeridiems`, `getLocaleMonthNames` and `getLocaleWeekdayNames` used to return `[]` for any list, even `["en-US"]`; a list now works. The 17 functions whose locale is required still return their sentinel for an empty list, rather than reading the host's locale: `getLocaleStartOfWeek`, `getLocaleEndOfWeek`, `getLocaleDayOfWeek`, `getLocaleWeekYear`, `getWeeksInLocaleWeekYear`, `getWeekOfMonth`, `getWeeksInMonth`, `isWeekend`, `getLocaleEraNames`, `getLocaleMeridiems`, `getLocaleMonthNames`, `getLocaleWeekdayNames`, `getLocaleZonedDayOfWeek`, `getLocaleZonedStartOfWeek`, `getLocaleZonedEndOfWeek`, `isZonedWeekend` and `formatTimeZoneName`.
  
  ```typescript
  import { formatDate, getLocaleStartOfWeek, isThisUnit } from "@northguild/gmt/plain";
  
  formatDate("2024-02-29", ["fr-FR", "en-US"]); // "29/02/2024"
  getLocaleStartOfWeek("2024-02-29", ["en-US", "fr-FR"]); // "2024-02-25"
  getLocaleStartOfWeek("2024-02-29", []); // ""
  isThisUnit("2024-03-15", "day", "en_US"); // false
  ```
  
  **An invalid `weekStartsOn` is invalid input.** The `startOf*`, `endOf*`, `are*EqualBy`, `parseUnitFrom*` and `parseWeekFrom*` functions and `getWeekNumber` return their sentinel for anything but `"monday"` or `"sunday"`, such as `"Monday"` or `1`.
  
  ```typescript
  import { areDatesEqualBy, startOfDate } from "@northguild/gmt/plain";
  
  startOfDate("2024-03-15", "week", { weekStartsOn: "Monday" as never }); // ""
  areDatesEqualBy("2024-03-15", "2024-03-15", "week", { weekStartsOn: 1 as never }); // false
  ```
  
  **`setZoned`, `setUnix` and `cycleZoned` default `offset` to `"prefer"`,** as `Temporal.ZonedDateTime#with` does. The default was `"ignore"`, which re-resolved a time in a repeated hour to its first occurrence, so setting the minute of the second 1:30 a.m. moved the value an hour back.
  
  ```typescript
  import { cycleZoned, setZoned } from "@northguild/gmt/zoned";
  
  setZoned("2024-11-03T01:30:00-05:00[America/New_York]", { minute: 45 }); // "2024-11-03T01:45:00-05:00[America/New_York]"
  cycleZoned("2024-11-03T01:30:00-05:00[America/New_York]", "minute", 15); // "2024-11-03T01:45:00-05:00[America/New_York]"
  ```
  
  **`formatRelativeUtc`, `formatRelativeUnix`, `formatRelativeZoned` and `formatRelativeDateTime` pick units up to a year,** with the thresholds `formatRelativeDate` uses: a week from 7 days, a month from 28 and a year from 365. They stopped at days. `formatRelativeTime` is unchanged, since a time distance is under a day.
  
  ```typescript
  import { formatRelativeDateTime } from "@northguild/gmt/plain";
  import { formatRelativeUtc } from "@northguild/gmt/utc";
  import { formatRelativeZoned } from "@northguild/gmt/zoned";
  
  formatRelativeUtc("2026-01-15T14:30:45Z", "en-US", { reference: "2026-04-15T14:30:45Z" }); // "3 months ago"
  formatRelativeZoned("2021-01-01T00:00:00+00:00[UTC]", "en-US", { reference: "2024-01-01T00:00:00+00:00[UTC]" }); // "3 years ago"
  formatRelativeDateTime("2024-01-01T00:00:00", "en-US", { reference: "2024-01-11T00:00:00" }); // "last week"
  ```
  
  **`formatRelativeZoned` and `formatCalendarZoned` validate `reference`.** It must be omitted, a zoned or UTC string, or a finite epoch in milliseconds. `true`, `null` or an array was converted to a number and rendered.
  
  **`closestDateTo`, `closestZonedTo` and the `getLargest*DurationUnit` functions return `""` for invalid input.** `closestDateTo` and `closestZonedTo` returned `null`, unlike every other string-returning function. `getLargestDateDurationUnit`, `getLargestDateTimeDurationUnit` and `getLargestTimeDurationUnit` returned their default unit, so an invalid list looked like a real answer.
  
  ```typescript
  import { closestDateTo, getLargestDateDurationUnit } from "@northguild/gmt/plain";
  
  closestDateTo("nope", ["2024-01-01"]); // ""
  getLargestDateDurationUnit(["hours"] as never); // ""
  getLargestDateDurationUnit(["day", "month"]); // "months"
  ```
  
  **`parseDateFromUtc` and the other `parse*FromUtc` functions take a `timeZone`,** as `parseTimeFromUtc` already did. Omitted, they read UTC fields as before.
  
  ```typescript
  import { parseDateFromUtc, parseHourFromUtc } from "@northguild/gmt/utc";
  
  parseHourFromUtc("2024-03-15T14:30:00Z", { timeZone: "Asia/Tokyo" }); // "23"
  parseDateFromUtc("2024-03-15T20:30:00Z", { timeZone: "Asia/Tokyo" }); // "2024-03-16"
  ```
  
  **`startOfTime` floors below a second.** `startOfTime("12:34:56.999", "millisecond")` returned `"12:34:56.000"`. It now returns `"12:34:56.999"`.
  
  **Options that no function read are removed.** Each was accepted and had no effect on the output, so the only change is that a call passing one stops type-checking.
  
  - `offset` on `addZoned`, `subtractZoned`, `intervalFromDurationZoned` and `convertPlainDateTimeToZoned`. Construction from a date-time and exact-time arithmetic have no offset to reconcile.
  - `offset` and `disambiguation` on `setUtc`. UTC has no repeated or skipped wall-clock time.
  - `overflow` on `addTime`, `subtractTime`, `intervalFromDurationTime` and `cycleTime`. `Temporal.PlainTime#add` takes no options, since a time has no month to overflow. `addTime`, `subtractTime` and `intervalFromDurationTime` therefore take no options argument at all, and `cycleTime` keeps `{ round }`.
  
  ### Breaking changes
  
  | Function | 1.15 | 1.16 |
  | --- | --- | --- |
  | Functions with their own options object | `addDate(v, d, null)` meant no options | `""`, `null`, `false` or `[]`; omit the argument or pass `{}` |
  | `formatUtc`, `formatUnix`, `formatZonedRange`, `formatZonedToParts` | `options = null` meant no options | the sentinel; a string or number still means the defaults |
  | `formatDuration(v, locale, "x")` | the defaults | `""` |
  | `formatRelativeZoned`, `formatCalendarZoned` with `reference: true` | rendered against epoch 1 | `""` |
  | `isThisUnit`, `isZonedThisUnit` | locale read only for `"week"` | an invalid locale returns `false` for every unit |
  | `weekStartsOn` other than `"monday"` or `"sunday"` | not checked | the sentinel |
  | `setZoned`, `setUnix`, `cycleZoned`, `offset` omitted | `"ignore"`: `setZoned("2024-11-03T01:30:00-05:00[America/New_York]", { minute: 45 })` gave `"…01:45:00-04:00[…]"` | `"prefer"`: `"…01:45:00-05:00[…]"`; pass `{ offset: "ignore" }` for the old result |
  | `formatRelativeUtc`, `formatRelativeUnix`, `formatRelativeZoned`, `formatRelativeDateTime` | `"90 days ago"`, `"1,095 days ago"` | `"3 months ago"`, `"3 years ago"`; pass `largestUnit: "day"` for the old text |
  | `closestDateTo`, `closestZonedTo` on invalid input | `null` | `""` |
  | `getLargestDateDurationUnit` and siblings on invalid input | the default unit | `""` |
  | `startOfTime("12:34:56.999", "millisecond")` | `"12:34:56.000"` | `"12:34:56.999"` |
  | `addZoned(v, d, { disambiguation, offset })`, likewise `subtractZoned`, `intervalFromDurationZoned`, `convertPlainDateTimeToZoned` | `offset` accepted, no effect | `addZoned(v, d, { disambiguation })` |
  | `setUtc(v, fields, { overflow, disambiguation, offset })` | accepted, no effect | `setUtc(v, fields, { overflow })` |
  | `addTime(v, d, { overflow })`, `subtractTime(v, d, { overflow })` | accepted, no effect | `addTime(v, d)`, `subtractTime(v, d)` |
  | `intervalFromDurationTime(v, duration, anchor, { overflow })` | accepted, no effect | `intervalFromDurationTime(v, duration, anchor)` |
  | `cycleTime(v, field, amount, { round, overflow })` | `overflow` accepted, no effect | `cycleTime(v, field, amount, { round })` |
- 729e0f1: List every import path explicitly, mark the package side-effect free, and state the Node versions it supports (Story CORE-8).
  
  **The `exports` map names each subpath.** It used wildcard patterns, which also resolved folders nobody documented, such as `@northguild/gmt/plain/interval/validate`, and a `./regex/*` pattern that matched nothing. It now lists the root, the twelve namespace paths (`calendar`, `duration`, `instant`, `interval`, `plain`, `precision`, `regex`, `span`, `types`, `unix`, `utc`, `zoned`) and each namespace's category subpaths, such as `@northguild/gmt/plain/interval` or `@northguild/gmt/unix/convert`: 71 entries in all. Any other path fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`.
  
  **`typesVersions` mirrors the map,** so TypeScript with `moduleResolution: "node10"` resolves the same 71 paths as `node16`, `nodenext` and `bundler`.
  
  **`sideEffects: false`.** An audit of every source module found only pure constant construction at load time, so bundlers may drop the modules an application does not use. An import cycle through the internal barrel is also gone.
  
  **Every namespace subpath except `types` re-exports the polyfill.** `Temporal`, `Intl` and `toTemporalInstant` are available from each of them, not only from the root and some namespaces, and they are the same objects everywhere. `@northguild/gmt/types` is type-only — it has no runtime exports at all — so the polyfill is not among them; it exports the `UnixUnit` type.
  
  ```typescript
  import { Temporal } from "@northguild/gmt/span";
  import type { UnixUnit } from "@northguild/gmt/types";
  
  const unit: UnixUnit = "seconds";
  Temporal.Instant.from("2024-01-01T00:00:00Z").epochMilliseconds; // 1704067200000
  ```
  
  **`engines` is `node >=22.16.0`.** Node 22.16.0 ships ICU 77.1, the oldest ICU the test suite's locale and calendar expectations cover. CI runs the latest Node 22, 24 and 26.
  
  ### Breaking changes
  
  | 1.15 | 1.16 |
  | --- | --- |
  | `import { … } from "@northguild/gmt/plain/interval/validate"` and other nested folders | `ERR_PACKAGE_PATH_NOT_EXPORTED`; import from `@northguild/gmt/plain/interval` or `@northguild/gmt/plain` |
  | `import { chopUtc } from "@northguild/gmt/plain"` | not exported there; `import { chopUtc } from "@northguild/gmt/utc"` |
  | Node below 22.16.0 | outside `engines`; upgrade Node |
- 729e0f1: Add a `maxPieces` option to the functions that build one array element per piece, so a large range returns `[]` instead of exhausting the heap (Story CORE-8).
  
  **Which functions.** `splitIntervalByUnitDate`, `splitIntervalByUnitDateTime`, `splitIntervalByUnitTime`, `splitIntervalByUnitUtc`, `splitIntervalByUnitUnix`, `splitIntervalByUnitZoned`, the six matching `intervalDivideEqually*` functions, `mapDatesInRange` and `mapZonedDatesInRange`. Before, each built an array as long as the range asked for. Ten thousand years of days, or a divide into billions of pieces, ran out of memory or threw a `RangeError` from inside the engine.
  
  **The option.** `maxPieces` is a positive safe integer, and it defaults to `1_000_000`. A call that would return more pieces returns `[]`, the functions' existing invalid-input sentinel. A split stops as soon as piece `maxPieces + 1` is due, so the answer comes back in bounded time. A `maxPieces` that is not a positive safe integer also returns `[]`.
  
  ```typescript
  import { intervalDivideEquallyUnix, mapDatesInRange, splitIntervalByUnitDate } from "@northguild/gmt";
  
  splitIntervalByUnitDate("2024-01-01", "2024-01-10", "day", 2, { maxPieces: 4 }); // [] — 5 slices
  splitIntervalByUnitDate("2024-01-01", "2024-01-10", "day", 2, { maxPieces: 5 }).length; // 5
  intervalDivideEquallyUnix(0, 90000000, 3, { maxPieces: 2 }); // []
  mapDatesInRange("0001-01-01", "9999-12-31", 1); // [] — 3,652,059 dates is over the default
  mapDatesInRange("2024-01-01", "4000-01-01", 1, { maxPieces: 2000000 }).length; // 721720
  ```
  
  **`splitIntervalByUnitTime` no longer loops forever.** A step that carried past midnight wrapped back to the morning, so the split never reached its end. The last slice now ends at `end`.
  
  ```typescript
  splitIntervalByUnitTime("20:00:00", "23:00:00", "hour", 5); // [{ start: "20:00:00", end: "23:00:00" }]
  ```
  
  **`bucketRange` gives up quickly.** It already returned `[]` over 10,000 buckets, but it counted them one at a time, which took up to a minute in zones with many offset changes. It now works out from the span when the range is certainly over the limit, and returns in under a second.
  
  ### Breaking changes
  
  A call that used to return more than 1,000,000 pieces now returns `[]`. The input was valid before and still is — only the output changed — so nothing throws and nothing warns. Each row is the boundary: one piece under the default cap still returns the array, one piece over returns `[]`. Every function in the row's family behaves the same way.
  
  | Call | 1.15 | 1.16 (default `maxPieces: 1_000_000`) |
  | --- | --- | --- |
  | `mapDatesInRange("2024-01-01", "4761-11-27", 1)` | 1,000,000 dates | 1,000,000 dates |
  | `mapDatesInRange("2024-01-01", "4761-11-28", 1)` | 1,000,001 dates | `[]` |
  | `mapZonedDatesInRange(A, "4761-11-27T00:00:00-05:00[America/New_York]", 1)` | 1,000,000 dates | 1,000,000 dates |
  | `mapZonedDatesInRange(A, "4761-11-28T00:00:00-05:00[America/New_York]", 1)` | 1,000,001 dates | `[]` |
  | `splitIntervalByUnitDate("2024-01-01", "4761-11-28", "day", 1)` | 1,000,000 pieces | 1,000,000 pieces |
  | `splitIntervalByUnitDate("2024-01-01", "4761-11-29", "day", 1)` | 1,000,001 pieces | `[]` |
  | `splitIntervalByUnitUnix(0, 3_600_003_600_000, "hour", 1)` | 1,000,001 pieces | `[]` |
  | `intervalDivideEquallyUtc("2024-01-01T00:00:00Z", "2124-01-01T00:00:00Z", 1000000)` | 1,000,000 pieces | 1,000,000 pieces |
  | `intervalDivideEquallyUtc("2024-01-01T00:00:00Z", "2124-01-01T00:00:00Z", 1000001)` | 1,000,001 pieces | `[]` |
  | `intervalDivideEquallyTime("00:00:00", "23:59:59", 1000001)` | 1,000,001 pieces | `[]` |
  | `splitIntervalByUnitTime("20:00:00", "23:00:00", "hour", 5)` | never returned | `[{ start: "20:00:00", end: "23:00:00" }]` |
  
  `A` is `"2024-01-01T00:00:00-05:00[America/New_York]"`. The same boundary applies to `splitIntervalByUnitDateTime`, `splitIntervalByUnitTime`, `splitIntervalByUnitUtc`, `splitIntervalByUnitZoned` and to the other four `intervalDivideEqually*` functions.
  
  Migration:
  
  - **A call that legitimately needs more than a million pieces** passes its own cap: `mapDatesInRange("2024-01-01", "4761-11-28", 1, { maxPieces: 2_000_000 })` returns the 1,000,001 dates again. `maxPieces` must be a positive safe integer; anything else is invalid input and returns `[]`.
  - **Code that treated `[]` as “the range is empty”** must now also read it as “the range is too large”. These functions have one sentinel, so distinguish the two by checking the range yourself — `intervalCountDate(start, end, "day")` counts the pieces without building them.
  - **Nothing became slower.** A split stops as soon as piece `maxPieces + 1` is due, so an over-cap call returns in bounded time instead of exhausting the heap.
  - **The engine's own array limit, 2^32 − 1 elements, still applies** above any `maxPieces` you set.
- 17ddf84: Add the `instant/` namespace: the instant-plus-offset pair, and explicit resolution of zoneless local wall times (Story CORE-4).
  
  GMT could represent an instant, and it could represent a zoned datetime. It had no primitive for the shape the world actually exchanges: an absolute instant **plus** the local UTC offset that was in force where the event happened. Neither field derives from the other — the instant orders events globally, the offset renders them as the human on the ground saw them — which is why GS1 EPCIS 2.0 requires both (`eventTime` and `eventTimeZoneOffset`), UN/EDIFACT DTM has qualifiers `303`/`304` for the pair, and DICOM appends `&ZZXX` to a `DT` value.
  
  ```typescript
  import {
    classifyLocal,
    fromOffsetInstant,
    resolveLocal,
    toOffsetInstant,
  } from "@northguild/gmt";
  
  toOffsetInstant("2024-07-15T12:00:00-04:00[America/New_York]");
  // { instant: "2024-07-15T16:00:00Z", offset: "-04:00", timeZone: "America/New_York" }
  
  toOffsetInstant("2024-07-15T12:00:00-04:00");
  // { instant: "2024-07-15T16:00:00Z", offset: "-04:00" } — most feeds send no zone
  
  toOffsetInstant("2024-07-15T16:00:00Z", "America/New_York");
  // { instant: "2024-07-15T16:00:00Z", offset: "-04:00", timeZone: "America/New_York" }
  
  fromOffsetInstant({ instant: "2024-07-15T16:00:00Z", offset: "-04:00" });
  // "2024-07-15T12:00:00-04:00"
  
  classifyLocal("2024-11-03T01:30:00", "America/New_York"); // "ambiguous"
  classifyLocal("2024-03-10T02:30:00", "America/New_York"); // "nonexistent"
  
  resolveLocal("2024-11-03T01:30:00", "America/New_York", { disambiguation: "later" });
  // "2024-11-03T06:30:00Z" — the same wall clock, an hour of real time later
  ```
  
  - **An offset is not a zone.** `-05:00` does not identify `America/New_York`; it is every zone sitting at `-05:00` that day, and it says nothing about what that zone does next spring. Keep the zone for anything still to be scheduled and the offset for anything that already happened. `timeZone` is optional because most feeds do not send one, and a string whose offset contradicts its own bracketed zone returns `null` rather than a guess about which half the sender meant.
  - **`classifyLocal` exists so realm code can refuse rather than guess.** Ambiguous and nonexistent wall times are the single most common datetime bug there is — 01:30 happens twice on a fall-back day and never on a spring-forward one — and a demurrage clock or a medication window should not silently accept whichever of two instants an hour apart a default handed it. It returns `"unique"`, `"ambiguous"` or `"nonexistent"` before any policy is applied, reading the zone's own transition table, so it is right for 30-minute shifts (`Australia/Lord_Howe`), quarter-hour offsets (`Pacific/Chatham`) and the calendar day Samoa deleted crossing the date line in 2011.
  - **`resolveLocal` returns an instant, exactly; `convertPlainDateTimeToZoned` returns a zoned string.** Same underlying resolution and the same four `disambiguation` values, but different output and different precision — `convertPlainDateTimeToZoned` truncates to milliseconds by default, so a nanosecond wall time survives one and not the other. `resolveLocal` has no `offset` parameter, since that option is inert on this construction path.
  - **`offset` is `±HH:MM`, except where the zone was not on a whole minute.** `Africa/Monrovia` ran at `-00:44:30` until 1972, and `toOffsetInstant` reports it as `±HH:MM:SS` rather than rounding the pair thirty seconds away from the event it describes. Sub-second offsets are rejected — ISO 8601 permits them and Temporal parses them, but no zone and no standard that stores this pair has used one.
  - **Annotations are read as RFC 9557 §3.3 and Temporal read them.** An elective `[key=value]` annotation, including `[u-ca=...]`, is ignored, and an unknown critical `[!key=value]` annotation returns `null`, exactly as `isValidInstant` decides. A string whose offset contradicts its bracketed zone still returns `null`.
  - Also exported: the `OffsetInstant` and `LocalTimeClassification` types, and the `utcOffset` regex pattern from `regex/`.
- 729e0f1: Write calendar strings in the standard RFC 9557 form, the ISO date followed by `[u-ca=<id>]`, and name calendars by their CLDR and Temporal ids (Story CORE-8).
  
  GMT's calendar strings carried the calendar's own year, month and day digits: the Hebrew New Year 5785 was `"5785-01-01[u-ca=hebrew]"`. No standard defines that form. Temporal's `PlainDate#toString()` always writes the ISO date, and RFC 9557 §3.3 says `u-ca` names the calendar a date is preferably shown in, not the calendar of its digits. Every standard parser, Temporal included, therefore read GMT's strings as a different date without an error. `;era=` was not RFC 9557 syntax, and the zoned form put `[u-ca=…]` before the time zone, the reverse of RFC 9557 §4.1.
  
  ```typescript
  import { addDate, convertDateToCalendar } from "@northguild/gmt/plain";
  import { convertZonedToCalendar } from "@northguild/gmt/zoned";
  
  convertDateToCalendar("2024-10-03", "hebrew"); // "2024-10-03[u-ca=hebrew]"
  convertDateToCalendar("2024-10-03", "islamicc"); // "2024-10-03[u-ca=islamic-civil]"
  convertZonedToCalendar("2024-10-03T14:30:45-04:00[America/New_York]", "hebrew"); // "2024-10-03T14:30:45-04:00[America/New_York][u-ca=hebrew]"
  addDate("2024-10-03[u-ca=hebrew]", { months: 1 }); // "2024-11-02[u-ca=hebrew]"
  ```
  
  - **Output is exactly Temporal's.** `convertDateToCalendar` and every function that returns a calendar string write `Temporal.PlainDate#toString()` or `Temporal.ZonedDateTime#toString()`. Only `iso8601` has no annotation; `gregory` is written `[u-ca=gregory]`. A zoned string ends `…[timeZone][u-ca=<id>]`.
  - **Calendar ids are the CLDR and Temporal ids,** in strings and as function arguments alike: `iso8601`, `gregory`, `hebrew`, `islamic-civil`, `islamic-tbla`, `islamic-umalqura`, `japanese`, `buddhist`, `roc`, `persian`, `indian`, `ethiopic`, `ethioaa` and `coptic`. Temporal's aliases and any letter case are accepted, and the canonical id is written (`islamicc` → `islamic-civil`, `ethiopic-amete-alem` → `ethioaa`, `HEBREW` → `hebrew`). `chinese`, `dangi`, `islamic` and `islamic-rgsa` are not supported.
  - **Input is read as Temporal reads it.** A critical `[!u-ca=…]` is accepted, and the flag is not written back. Elective annotations such as `[foo=bar]` and a time zone annotation on a date are ignored. The first `u-ca` names the calendar. An unknown critical annotation, or a second `u-ca` when either is critical, is rejected. A calendar date-time such as `"2024-10-03T14:30[u-ca=hebrew]"` is read as its date. The part before the first `[` must still be GMT's written shape, so basic format (`20241003[u-ca=hebrew]`), a space or lower-case `t` separator, and an offset are rejected.
  - **Different calendars follow Temporal's `CalendarEquals` check.** `diffDate`, `diffDateAsDuration`, `diffZoned`, `diffZonedAsDuration`, the `intervalCount*`, `intervalLength*`, `splitIntervalByUnit*` and `intervalOverlappingDays*` functions, and the value-returning interval set operations in `plain/` and `zoned/`, return their sentinel for two different calendars. A bare ISO string is `iso8601`. Temporal's ordering has no calendar check, so `intervalsOverlap*`, `intervalContains*`, `intervalEngulfs*`, `intervalAbuts*`, `isValidDateInterval` and `isValidCalendarZonedInterval` still accept mixed calendars.
  - **`relativeTo`** in `durationAs`, `normalizeDuration` and `compareDurations` reads a calendar string as Temporal's `ParseTemporalRelativeToString` does: zoned when it has a time zone annotation, otherwise a date.
  
  ```typescript
  import { diffDate, intervalsOverlapDate, isValidCalendarDate } from "@northguild/gmt/plain";
  import { durationAs } from "@northguild/gmt/duration";
  
  isValidCalendarDate("2024-10-03T14:30[u-ca=hebrew]"); // true
  isValidCalendarDate("2024-10-03[foo=bar][u-ca=hebrew]"); // true
  isValidCalendarDate("20241003[u-ca=hebrew]"); // false
  diffDate("2024-10-03", "2024-11-03[u-ca=hebrew]", "days"); // null
  intervalsOverlapDate("2024-10-03[u-ca=hebrew]", "2024-10-10", "2024-10-05", "2024-10-20"); // true
  durationAs("P1M", "days", { relativeTo: "2024-02-10[!u-ca=hebrew]" }); // 30
  ```
  
  ### Breaking changes
  
  Every calendar string changes. There is no converter from the old strings: no standard defines them, and an old string cannot be told apart from a valid RFC 9557 one.
  
  | Call | 1.15 | 1.16 |
  | --- | --- | --- |
  | `convertDateToCalendar("2024-10-03", "hebrew")` | `"5785-01-01[u-ca=hebrew]"` | `"2024-10-03[u-ca=hebrew]"` |
  | `convertDateToCalendar("2024-10-03", "japanese")` | `"0006-10-03[u-ca=japanese;era=reiwa]"` | `"2024-10-03[u-ca=japanese]"` |
  | `convertDateToCalendar("2024-10-03", "ethiopic")` | `"2017-01-23[u-ca=ethiopic;era=ethiopic]"` | `"2024-10-03[u-ca=ethiopic]"` |
  | `convertDateToCalendar("1000-01-01", "taiwan")` | `"-911-01-01[u-ca=taiwan]"` | `""`; with `"roc"`: `"1000-01-01[u-ca=roc]"` |
  | `convertDateToCalendar("+275760-09-13", "hebrew")` | `"279517-10-11[u-ca=hebrew]"` | `"+275760-09-13[u-ca=hebrew]"` |
  | `convertDateToCalendar("5785-01-01[u-ca=hebrew]", "gregorian")` | `"2024-10-03"` | `""`; with `"iso8601"`: `"5785-01-01"` |
  | `convertZonedToCalendar("2024-10-03T14:30:45-04:00[America/New_York]", "hebrew")` | `"5785-01-01T14:30:45-04:00[u-ca=hebrew][America/New_York]"` | `"2024-10-03T14:30:45-04:00[America/New_York][u-ca=hebrew]"` |
  | `addDate("5784-06-15[u-ca=hebrew]", { months: 1 })` | `"5784-07-15[u-ca=hebrew]"` | `"5784-07-14[u-ca=hebrew]"`, reading ISO 5784-06-15 |
  | `diffDate("2024-10-03", "2024-11-03[u-ca=hebrew]", "days")` | `-1373406`, reading Hebrew year 2024 | `null` |
  
  Calendar ids renamed:
  
  | 1.15 | 1.16 |
  | --- | --- |
  | `gregorian` | `iso8601` (or `gregory`, which writes `[u-ca=gregory]`) |
  | `taiwan` | `roc` |
  | `islamic-tabular` | `islamic-tbla` |
  | `ethiopic-amete-alem` | `ethioaa` (the old id is still accepted as Temporal's alias) |
  
  Migration:
  
  - **Regenerate every stored calendar string from its ISO date** with `convertDateToCalendar` or `convertZonedToCalendar`. Do not parse the old strings. Most of them are also valid RFC 9557, so `"5785-01-01[u-ca=hebrew]"` is now read, silently, as ISO year 5785. Only four old shapes are rejected: `;era=`, an unsigned 5- or 6-digit year, a negative year without six digits (`-911`), and `[u-ca=…]` before the time zone.
  - **`;era=` is gone**, including the `;era=japanese` input alias. `convertDateToCalendar("1800-01-01[u-ca=japanese;era=ce]", "iso8601")` is `""`.
  - **Replace the renamed ids** in calls and stored annotations. `gregorian`, `taiwan` and `islamic-tabular` return the sentinel.
  - **Difference two dates in one calendar.** Convert one side first with `convertDateToCalendar`, then call `diffDate`.
- 82380f8: Add the `interval/` namespace: half-open `[start, end)` interval algebra over instants: overlap, containment, intersect, clamp, merge, subtract, split and sum (Story CORE-6).
  
  Four realms need the same operation and none of them could express it: sum the parts of an interval that fall inside a set of allowed windows. Laytime counts only the hours a charter clause allows, driver hours split a duty period around mandatory rest, demurrage free time counts only working days, and a trading window counts only continuous-session time. Without one shared primitive, each realm reimplements intersection and they disagree at every boundary.
  
  ```typescript
  import {
    intervalsOverlap,
    mergeIntervals,
    subtractIntervals,
    sumIntervals,
  } from "@northguild/gmt";
  
  const shift = { start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" };
  
  intervalsOverlap(shift, { start: "2024-01-01T17:00:00Z", end: "2024-01-01T18:00:00Z" });
  // false — touching intervals share no instant
  
  subtractIntervals(shift, [{ start: "2024-01-01T12:00:00Z", end: "2024-01-01T13:00:00Z" }]);
  // [{ start: "2024-01-01T09:00:00Z", end: "2024-01-01T12:00:00Z" },
  //  { start: "2024-01-01T13:00:00Z", end: "2024-01-01T17:00:00Z" }]
  
  sumIntervals([
    { start: "2024-01-01T09:00:00Z", end: "2024-01-01T13:00:00Z" },
    { start: "2024-01-01T12:00:00Z", end: "2024-01-01T17:00:00Z" },
  ]); // "PT8H" — the overlap counts once
  ```
  
  - **Half-open `[start, end)`, everywhere in the namespace.** An instant `t` is inside when `start ≤ t < end`. That is SQL:2011's closed-open application-time `PERIOD`, RFC 5545's non-inclusive `DTEND` and Dijkstra's EWD831. Touching intervals do not overlap, `intersectIntervals` returns `null` for them, `mergeIntervals` joins them, and `splitIntervalAt` returns pieces that share no instant. A container gated out at exactly 17:00 has not used another day.
  - **Endpoints are instants.** Each needs an offset (`Z` or `±HH:MM`), may carry a `[Zone]` annotation, and may name a different zone from the other. They compare by epoch nanoseconds, as a TC39 `Temporal.Instant` does. A leap second and an unknown critical annotation are rejected. Elective annotations and a `[u-ca=…]` calendar annotation are ignored, as `Temporal.Instant.from` ignores them, and the caller's annotated string is echoed back. Where a realm needs local-calendar edges, build them with `floorToZone` or `bucketRange` first.
  - **Outputs are the caller's own strings, never re-serialised.** When two strings spell the same instant, the first argument's spelling wins (`from`'s in `subtractIntervals`, the first occurrence in `splitIntervalAt` and `mergeIntervals`). No spec covers this tie, so it is a GMT rule, chosen because a rule based on position is deterministic without inventing a canonical spelling.
  - **`start === end` is a valid empty interval.** It has a position but contains no instant:
    - `intervalContains` is always `false` for it.
    - It overlaps only an interval it lies strictly inside.
    - `mergeIntervals` absorbs it into a run it touches, and drops it otherwise.
    - Removing one changes nothing.
    - An inverted interval (`start` after `end`) is invalid input, not silently swapped.
  - **`sumIntervals` is covered time.** It measures the length of the union as an exact ISO 8601 duration with hours as the largest unit: exactly `Temporal.Instant.prototype.until(…, { largestUnit: "hour" })`, since an instant has no calendar to define a day (`PT49H30M`, not `P2DT1H30M`). It sums as `bigint` nanoseconds, so it stays exact past 2^53 ns and across the whole instant range. `sumIntervals([])` is `PT0S`. A New York day across spring-forward is `PT23H`.
  - **Also exported:** the `Interval` type (`{ start: string; end: string }`) and `isValidInterval`. `mergeIntervals`, `subtractIntervals` and `splitIntervalAt` return `[]` both as a legitimate result (a fully covered subtraction) and as the invalid-input sentinel, and `isValidInterval` tells the two apart.
  
  The older positional functions in `plain/`, `utc/`, `zoned/` and `unix/` `interval/` move to the same half-open rule in this release, and the `Utc` variants call these functions; that change and its migration are listed in their own entry.
- d298c49: Add the `precision/` namespace: nanosecond instants as `bigint`, their JSON bridge, and explicit storage truncation (Story CORE-1).
  
  `convertZonedToUnix` and the rest of `unix/` return `number` milliseconds, which cannot carry nanosecond timestamps — a `number` holds integers exactly only to `2^53 − 1` ≈ 9.0 × 10^15, and nanoseconds since the epoch passed that in April 1970. The new namespace works in `bigint` throughout:
  
  ```typescript
  import {
    toNanoseconds,
    fromNanoseconds,
    formatNanoseconds,
    parseNanoseconds,
    truncateNanoseconds,
  } from "@northguild/gmt";
  
  toNanoseconds("2024-03-10T12:00:00.123456789Z");
  // 1710072000123456789n
  
  fromNanoseconds(1710072000123456789n, "America/New_York");
  // "2024-03-10T08:00:00.123456789-04:00[America/New_York]"
  
  JSON.stringify({ observedAt: formatNanoseconds(1710072000123456789n) });
  // '{"observedAt":"1710072000123456789"}' — JSON.stringify throws on a raw bigint
  
  parseNanoseconds("1710072000123456789");
  // 1710072000123456789n
  
  truncateNanoseconds(1710072000123456789n, "us");
  // 1710072000123456000n — what a PostgreSQL timestamptz column can actually hold
  ```
  
  - `toNanoseconds` accepts any extended-format ISO 8601 instant string (offset or bracketed IANA zone). It rejects leap seconds and unknown critical annotations, and ignores a `[u-ca=...]` calendar annotation, as `Temporal.Instant.from` does.
  - `fromNanoseconds` returns a UTC instant string, or a zoned string when given a time zone. Instant-to-local needs no disambiguation policy. Truncate first when writing to a store that holds less than nanoseconds, or the round-trip silently loses digits.
  - `truncateNanoseconds` floors toward negative infinity, so pre-1970 values truncate the same way post-1970 ones do: `truncateNanoseconds(-1500n, "us")` is `-2000n`, not `-1000n`.
  - Every function returns a sentinel (`""`, `0n`) on invalid input and never throws, and accepts only values inside the range `Temporal.Instant` can represent (±8_640_000_000_000_000_000_000n). `0n` is also the epoch itself, so validate first when the two must be told apart.
  - `formatNanoseconds` / `parseNanoseconds` are the JSON bridge: a `bigint` cannot go into a payload as-is, so the value crosses as a canonical decimal string. Embed it as a JSON *string* — unquoted it is a JSON number, and `JSON.parse` rounds it back through a double to `1710072000123456800`. `parseNanoseconds` takes that string value (`JSON.parse(payload).observedAt`), not JSON text.
  - Leap-second-aware time scales (TAI, GPS) are deliberately out of scope — these are plain instant conversions.
  
  Importable from the package root or from `@northguild/gmt/precision`, `@northguild/gmt/precision/convert`, `/precision/format`, `/precision/parse`, and `/precision/calculate`.
- fd2b96f: Fix zone-aware boundaries, counts and splits that went wrong around DST transitions and month ends.
  
  Every fix follows TC39 Temporal. A boundary is a real instant in the zone, never a wall-clock time re-resolved after truncation. Repeated calendar steps are measured from the original anchor.
  
  - **Boundaries are always real.** `startOfZoned`, `endOfZoned`, `startOfUnix`, `endOfUnix`, `getLocaleZonedStartOfWeek`, `getLocaleZonedEndOfWeek`, `startOfQuarterForZoned`, `startOfQuarterForUnix`, `endOfQuarterForZoned`, `endOfQuarterForUnix` return the real start and end of the unit that contains the input: a start is never after the input and an end never before it. Before, `startOfZoned` could place Pacific/Chatham's hour 15 minutes _after_ its input, and `endOfZoned` could end New York's repeated 1 a.m. hour before the input.
  - **`disambiguation` and `offset` are removed from those functions, and `mapZonedHoursInDay` takes no options.** Boundary methods in TC39 Temporal take no resolution options — `startOfDay()` has none — and passing them here, even at their documented defaults, used to bring the wrong answer back. See **Breaking changes** below.
  - **A repeated local midnight is one day.** When a fall-back repeats midnight on the same date (America/Havana, 3 November 2024), that date is one 25-hour day, matching `getHoursInZonedDay`; its repeated first hour is still two hour buckets. A fall-back that re-enters the previous date (America/Goose_Bay, 7 November 2010) remains its own 59-minute bucket, because the date changed.
  - **`areZonedEqualBy` and `areUnixEqualBy`** compare those boundary instants, so the two passes of a repeated hour are no longer equal. Across two different zones, `areZonedEqualBy` still compares each value's local unit.
  - **`intervalCountZoned`, `intervalCountUnix`, `intervalCountUtc`** count the buckets `bucketRange` would return. A 20-minute Chatham range straddling 04:00 now counts 2 hours, not 1, and a span over Samoa's deleted 30 December 2011 counts 2 days, not 3. Counting stops at 10,000 zone transitions and returns `null`; `bucketRange` separately stops at 10,000 buckets, so the two agree only within that list's cap.
  - **`startOfQuarterForZoned`, `startOfQuarterForUnix`, `startOfQuarterForUtc`** reset milliseconds, microseconds and nanoseconds. `2024-05-15T12:34:56.789Z` now starts its quarter at `2024-04-01T00:00:00Z`, not `…00:00:00.789Z`.
  - **`getHoursInZonedDay`** returns Temporal's `hoursInDay`, so a day whose midnight is skipped (America/Santiago, 8 September 2024) is 23 hours, not 24. **`mapZonedHoursInDay`** stops at the next local day instead of spilling into it. Both follow TC39's date-labelled day (`startOfDay()`/`hoursInDay`), which differs from the boundary functions' bucket only where a fall-back re-enters the previous date (America/Goose_Bay, 2010).
  - **`splitIntervalByUnitDate`, `splitIntervalByUnitDateTime`, `splitIntervalByUnitZoned`, `splitIntervalByUnitUnix`, `splitIntervalByUnitUtc`** no longer drift at month ends: calendar units step from the anchor, so splitting from 31 January by month gives 29 February, 31 March, 30 April, and a yearly split from 29 February returns to 29 February in leap years. A step into a deleted local day is skipped rather than failing the whole split (Pacific/Apia by day now returns 29–31 December and 31 December–1 January). Hours and smaller step from the previous boundary, so very large amounts keep nanosecond precision.
  - **`getDstTransitions`** reports a transition that falls exactly at local midnight on 1 January (Asia/Singapore, 1982), returns a year with 20 transitions in full, and returns `[]` rather than a truncated list if its scan limit is ever exhausted.
  - **`floorToZone`** and **`bucketRange`** return `""` and `[]` rather than a plausible wrong boundary if the zone walker ever runs out of transitions.
  
  `getFiscalPeriod`, `roundZoned`, `roundUnix`, `parseRfc2822` and `parseHttp` behave as before. Their documentation now states how a 29 February fiscal anchor clamps, how `round` behaves in Chatham, and that impossible dates such as 31 February are rejected.
  
  ### Breaking changes
  
  `startOfZoned`, `endOfZoned`, `startOfQuarterForZoned`, `endOfQuarterForZoned`, `getLocaleZonedStartOfWeek`, `getLocaleZonedEndOfWeek`, `startOfUnix`, `endOfUnix`, `startOfQuarterForUnix` and `endOfQuarterForUnix` no longer declare `disambiguation` or `offset`, and `mapZonedHoursInDay` no longer declares an options argument. A call that passes one stops type-checking. The output is the real boundary either way; a caller that relied on `disambiguation: "reject"` returning `""` for an ambiguous boundary gets the boundary.
  
  | 1.15 | 1.16 |
  | --- | --- |
  | `startOfZoned(v, "hour", { disambiguation: "reject", offset: "prefer" })` | `startOfZoned(v, "hour")` |
  | `endOfZoned(v, "day", { weekStartsOn, fractionalSecondDigits, disambiguation, offset })` | `endOfZoned(v, "day", { weekStartsOn, fractionalSecondDigits })` |
  | `startOfQuarterForZoned(v, { disambiguation, offset, fractionalSecondDigits })`, likewise `endOfQuarterForZoned` | `startOfQuarterForZoned(v, { fractionalSecondDigits })` |
  | `getLocaleZonedStartOfWeek(v, locale, { fractionalSecondDigits, disambiguation, offset })`, likewise `…EndOfWeek` | `getLocaleZonedStartOfWeek(v, locale, { fractionalSecondDigits })` |
  | `startOfUnix(v, unit, { epochUnit, timeZone, weekStartsOn, disambiguation, offset })`, likewise `endOfUnix` | `startOfUnix(v, unit, { epochUnit, timeZone, weekStartsOn })` |
  | `startOfQuarterForUnix(v, { epochUnit, timeZone, disambiguation, offset })`, likewise `endOfQuarterForUnix` | `startOfQuarterForUnix(v, { epochUnit, timeZone })` |
  | `mapZonedHoursInDay(anchor, { disambiguation, offset })` | `mapZonedHoursInDay(anchor)` |
- 729e0f1: Read annotations, time zone ids, SQL literals and leap seconds by their standards, and accept only the written shape each validator documents (Story CORE-8).
  
  **Elective annotations are accepted everywhere a Temporal string is.** RFC 9557 §3.3 lets a receiver ignore an elective `[key=value]` annotation and requires it to reject an unknown critical `[!key=value]` one, and Temporal's ISO grammar does exactly that. GMT refused every annotation in some namespaces and read them loosely in others. Now:
  
  - `plain/` validators and functions read elective annotations and a time zone annotation as `Temporal.PlainDate.from` and its siblings do, and accept `[u-ca=iso8601]`. A non-ISO calendar is still refused outside the calendar functions.
  - `utc/`, `instant/`, `interval/`, `span/` and `precision/` read an instant as `Temporal.Instant.from` does, which ignores any calendar annotation, critical or not.
  - `zoned/` functions accept elective annotations and `[u-ca=iso8601]`, and refuse a non-ISO calendar outside the calendar functions.
  - Every namespace rejects an unknown critical annotation.
  
  `isValidZonedRange`, the `plain/` interval validators and `toOffsetInstant` follow the same rule. `getWeekNumber` accepts an ISO-annotated date.
  
  ```typescript
  import { isValidDateTime, getWeekNumber } from "@northguild/gmt/plain";
  import { isValidInterval } from "@northguild/gmt/interval";
  import { toOffsetInstant } from "@northguild/gmt/instant";
  import { isValidUtc } from "@northguild/gmt/utc";
  import { isValidZonedDateTime } from "@northguild/gmt/zoned";
  
  isValidDateTime("2024-01-01T10:00:00[foo=bar]"); // true
  isValidDateTime("2024-01-01T10:00:00[!foo=bar]"); // false
  isValidUtc("2024-01-01T00:00:00Z[u-ca=hebrew]"); // true
  isValidZonedDateTime("2024-01-01T00:00:00+01:00[Europe/Paris][u-ca=iso8601]"); // true
  isValidZonedDateTime("2024-01-01T00:00:00+01:00[Europe/Paris][u-ca=hebrew]"); // false
  isValidInterval({ start: "2024-01-01T09:00:00Z[u-ca=hebrew]", end: "2024-01-01T17:00:00Z" }); // true
  toOffsetInstant("2024-07-15T12:00:00-04:00[foo=bar]"); // { instant: "2024-07-15T16:00:00Z", offset: "-04:00" }
  getWeekNumber("2024-06-15[u-ca=iso8601]"); // 24
  ```
  
  **Each validator accepts only its documented written shape.** Temporal's parser also reads the basic format, a space or lower-case `t` separator, a lower-case `z`, an hour without minutes, and a date with only a zone annotation. `isValidZonedDateTime`, `isValidZonedRange`, `isValidInstant`, `isValidUtc`, `toNanoseconds`, `isValidSpan`, `toOffsetInstant`, `getTimeZoneOffset`, the `utcDateTime` and `calendarZonedDateTime` regexes and a zoned `relativeTo` accepted some of these although GMT never writes them. They now accept only the extended form with an upper-case `T` and `Z`, as the rest of GMT does.
  
  ```typescript
  import { durationAs } from "@northguild/gmt/duration";
  import { isValidInstant } from "@northguild/gmt/precision";
  import { isValidZonedDateTime } from "@northguild/gmt/zoned";
  
  isValidZonedDateTime("2024-01-01 00:00:00+01:00[Europe/Paris]"); // false
  isValidInstant("20240101T000000Z"); // false
  isValidInstant("2024-01-01T00:00:00z"); // false
  durationAs("P1D", "hours", { relativeTo: "2024-03-10[America/New_York]" }); // null
  durationAs("P1D", "hours", { relativeTo: "2024-03-10T00:00:00-05:00[America/New_York]" }); // 23
  ```
  
  **UTC offset ids are time zones.** Temporal's `TimeZoneIdentifier` is an IANA name or a UTC offset without seconds. `isValidTimeZone` and every zone argument rejected `"+05:00"`. They now accept it, and `toOffsetInstant` returns the pair without a `timeZone` for an offset zone, because an offset names no zone.
  
  ```typescript
  import { toOffsetInstant } from "@northguild/gmt/instant";
  import { convertUtcToZoned } from "@northguild/gmt/utc";
  import { isValidTimeZone } from "@northguild/gmt/zoned";
  
  isValidTimeZone("+05:00"); // true
  isValidTimeZone("+05:00:30"); // false
  convertUtcToZoned("2024-07-15T16:00:00Z", "+05:00"); // "2024-07-15T21:00:00+05:00[+05:00]"
  toOffsetInstant("2024-07-15T16:00:00Z", "+05:00"); // { instant: "2024-07-15T16:00:00Z", offset: "+05:00" }
  ```
  
  `toOffsetInstant` still writes a zero offset as `+00:00`, never `Z`, because EPCIS `eventTimeZoneOffset` requires `±HH:MM`. Its documentation now says so.
  
  **SQL date-times follow the SQL literal grammar.** SQL-92 §5.3 requires seconds in a timestamp literal, and a four-digit year from 0001 to 9999. The `sqlDateTime` regex and `parseSql` accepted a value without seconds and years outside that range, and `formatSql` wrote years outside it. They now take `YYYY-MM-DD HH:MM:SS`, with an optional `.` and up to nine fraction digits, and `formatSql` returns `""` for a year it cannot write.
  
  ```typescript
  import { formatSql, parseSql } from "@northguild/gmt/plain";
  import { sqlDateTime } from "@northguild/gmt/regex";
  
  sqlDateTime.test("2024-03-15 14:30"); // false
  parseSql("2024-03-15 14:30:00.123456789"); // "2024-03-15T14:30:00.123456789"
  parseSql("0000-03-15 14:30:00"); // ""
  formatSql("+010000-01-01T00:00:00"); // ""
  ```
  
  **`isLeapSecond` recognises a second-60 field in a bare date-time or time.** It stays a syntactic test, since GMT carries no IERS leap-second table, and matched only a second 60 followed by an offset, `Z` or an annotation. The `leapSecond` regex is widened with it. Every validator still rejects second 60.
  
  ```typescript
  import { isLeapSecond, isValidDateTime } from "@northguild/gmt/plain";
  
  isLeapSecond("2016-12-31T23:59:60"); // true
  isLeapSecond("23:59:60"); // true
  isValidDateTime("2016-12-31T23:59:60"); // false
  ```
  
  **Sub-millisecond time ranges are ordered correctly.** `isValidTimeRange` and `isValidTimeInterval` compared times to the millisecond, so an end one nanosecond before the start was accepted. They now compare with `Temporal.PlainTime.compare`.
  
  ```typescript
  import { isValidTimeInterval } from "@northguild/gmt/plain";
  
  isValidTimeInterval("10:00:00.000000002", "10:00:00.000000001"); // false
  ```
  
  ### Breaking changes
  
  | Input | 1.15 | 1.16 |
  | --- | --- | --- |
  | `"2024-01-01T10:00:00[foo=bar]"` to a `plain/` function | rejected | accepted, annotation ignored |
  | `"2024-01-01T00:00:00Z[u-ca=hebrew]"` to a `utc/` function | rejected | accepted, calendar ignored |
  | `[!u-ca=hebrew]` on an instant, for example to `isValidUtc` or `addUtc` | rejected | accepted, calendar ignored |
  | `"…[u-ca=iso8601]"` to `plain/` and `zoned/` functions | rejected | accepted |
  | `isValidZonedDateTime("2024-01-01 00:00:00+01:00[Europe/Paris]")`, and basic, lower-case `t` and hour-only spellings | `true` | `false` |
  | `isValidUtc("2024-01-01T00:00:00z")` | accepted | `false` |
  | `durationAs(…, { relativeTo: "2024-03-10[America/New_York]" })` | a value | `null`; pass a full zoned date-time |
  | `isValidTimeZone("+05:00")`, and `"+05:00"` as any zone argument | `false`, sentinel | `true`, accepted |
  | `sqlDateTime.test("2024-03-15 14:30")`, `parseSql` of the same | matched, parsed | `false`, `""` |
  | `formatSql` for a year past 9999 or before 0001 | a string outside the SQL grammar | `""` |
  | `isLeapSecond("2016-12-31T23:59:60")` | `false` | `true` |
  | `isValidTimeInterval("10:00:00.000000002", "10:00:00.000000001")` | `true` | `false` |
  
  Migration: write strings in GMT's extended form (`T`, `Z`, full `HH:MM:SS`). Pass SQL values with seconds. Check `isValidTimeZone(zone) && !zone.startsWith("+") && !zone.startsWith("-")` where only IANA zones are allowed.
- 59831ff: Add the `span/` namespace: exact elapsed and wall-clock durations between two timestamps, as raw numbers (Story CORE-2).
  
  `diffZoned` and `diffUnix` measure in calendar units and hand back a Temporal `Duration`. Profiling, tracing and telemetry want a number:
  
  ```typescript
  import { spanMs, spanNs, spanWallClock } from "@northguild/gmt";
  
  spanMs("2024-03-10T12:00:00Z", "2024-03-10T12:00:01Z");
  // 1000
  
  spanMs("2024-03-10T12:00:00Z", "2024-03-10T12:00:00.123456789Z");
  // 123.456789 — fractional, like performance.now()
  
  spanNs("2024-03-10T12:00:00.123456789Z", "2024-03-10T12:00:00.123456790Z");
  // 1n
  ```
  
  Both are signed, so `spanMs(b, a)` is exactly `-spanMs(a, b)`, and both measure exact elapsed time. That is a different question from calendar distance, and conflating the two is the most common span bug there is — a wall-clock day containing a DST transition is 23 or 25 real hours, or 24.5 in `Australia/Lord_Howe`:
  
  ```typescript
  const start = "2024-03-09T12:00:00-05:00[America/New_York]";
  const end = "2024-03-10T12:00:00-04:00[America/New_York]";
  
  spanMs(start, end);
  // 82800000 — 23 hours actually elapsed
  
  spanWallClock(start, end, "hours");
  // 24 — the clock face advanced a full day
  ```
  
  - `spanMs` / `spanNs` accept anything `toNanoseconds` does: the extended RFC 9557 instant form, an offset or a bracketed IANA zone, no leap seconds, a `[u-ca=...]` calendar annotation ignored. The endpoints need not share a zone.
  - `spanWallClock(start, end, "days" | "hours")` reads each endpoint's own local wall clock, so it requires a bracketed IANA zone on both — and the two may differ, which is how a flight from New York to Berlin is 12 wall-clock hours and 7 elapsed ones. It truncates toward zero, and it is not a count of midnights crossed. The wall clock is read directly rather than via an instant, so no disambiguation policy applies: an offset-less local time that never occurred (`"2024-03-10T02:30:00[America/New_York]"`) is measured as written rather than silently advanced past the DST gap.
  - **`0` and `0n` are valid spans**, so invalid input returns `null` from all three rather than the zero the rest of the library would use. `null` and not `NaN`, because it is the sentinel GMT already uses for every number-returning function and the only one `strictNullChecks` forces a caller to handle — a `NaN` types as plain `number` and propagates silently through arithmetic. This is also why `spanNs` is not `toNanoseconds(b) - toNanoseconds(a)`: those return `0n` for both the epoch and a rejected string.
  - **`spanMs` returns `null` past `Number.MAX_SAFE_INTEGER` milliseconds** (±285,000 years, which two instants at opposite ends of `Temporal.Instant`'s range exceed). Use `spanNs` there. A span is a duration, not an instant: it reaches twice the epoch-nanosecond range, so it is not a `fromNanoseconds` input.
  - **Leap seconds are not counted.** UTC repeats a second rather than numbering a 61st one, so a span across one is a second short of the physical elapsed time; against a smeared clock (Google, AWS, Meta) the error is up to a second spread over the smear window. Leap-second-exact spans need a TAI scale, which is not yet shipped.
  
  ### Validators for both namespaces
  
  `precision/` and `span/` were the only namespaces with no `validate/` module, and in `precision/` that was not cosmetic: `0n` is simultaneously the epoch and the invalid-input sentinel, and there was no public predicate to tell them apart. `toNanoseconds`' own JSDoc suggested `isValidUtc`, which gates on GMT's stricter `<date>T<time>Z` shape and returns `false` for the offset and bracketed-zone strings `toNanoseconds` accepts — so following that advice discarded valid input.
  
  ```typescript
  import {
    isValidInstant,
    isValidNanoseconds,
    isValidNanoPattern,
    isValidSpan,
  } from "@northguild/gmt";
  
  isValidInstant("1970-01-01T00:00:00Z"); // true  — toNanoseconds returns 0n, the epoch
  isValidInstant("garbage"); // false — toNanoseconds returns 0n, the sentinel
  isValidInstant("2024-03-10T12:00:00-04:00[America/New_York]"); // true  — isValidUtc says false
  
  isValidNanoPattern("0"); // true  — parseNanoseconds returns 0n, the epoch
  isValidNanoseconds(0n); // true; isValidNanoseconds(0) is false — a number cannot carry one
  
  isValidSpan("2024-03-10T12:00:00Z", "2024-03-10T12:00:01Z"); // true
  ```
  
  Each predicate accepts exactly what its partner parses, and `parseNanoseconds` now defers to `isValidNanoPattern` so the two cannot drift apart. `isValidSpan` is symmetric — a reversed pair is a negative span, not an invalid one — and is true for a pair whose span exceeds `spanMs`'s range, since that is a limit on the result rather than the inputs; `spanNs` still returns the exact `bigint`.
  
  `regex/` gains `instantLeapSecond` (the wider leap-second grammar the full instant parser needs, alongside the existing `leapSecond`) and `nanosecondDecimal`.
  
  Importable from the package root or from `@northguild/gmt/span`, `@northguild/gmt/span/calculate`, `@northguild/gmt/span/validate` and `@northguild/gmt/precision/validate`.
- 729e0f1: Export `parseMillisecondFromUnix` and `parseMinuteFromUnix` and three types their functions' signatures already named, and add a `minimalDays` option to `getLocaleWeekYear` and `getWeeksInLocaleWeekYear` (Story CORE-8).
  
  **Two functions that shipped unreachable.** Both were implemented, documented and tested, but `unix/parse` never re-exported them, and the package's `exports` map blocks deep imports, so no path could reach them. Their `utc/` and `zoned/` equivalents were always exported.
  
  ```typescript
  import { parseMillisecondFromUnix, parseMinuteFromUnix } from "@northguild/gmt/unix";
  
  parseMillisecondFromUnix(1700000000123); // "123"
  parseMinuteFromUnix(1700000000000); // "13"
  ```
  
  **Three types a signature named but nobody could import.** `startOfTime`, `endOfTime` and `isValidDateRange` declared their unit and argument types without exporting them. `StartOfTimeUnit`, `EndOfTimeUnit` and `IsValidDateRangeProps` are now exported from `@northguild/gmt/plain` and the package root.
  
  ```typescript
  import type { EndOfTimeUnit } from "@northguild/gmt/plain";
  
  const unit: EndOfTimeUnit = "minute";
  ```
  
  **A locale's week-numbering rule, stated by the caller.** Week 1 is the week, starting on the locale's first day of week, that holds at least `minimalDays` days of January ([UTS #35, Week Data](https://unicode.org/reports/tr35/tr35-dates.html#Week_Data)). ECMA-402 no longer exposes that value: `Intl.Locale.prototype.getWeekInfo` returns only `firstDay` and `weekend` ([tc39/proposal-intl-locale-info#86](https://github.com/tc39/proposal-intl-locale-info/issues/86)). So it is now an option, an integer from 1 to 7.
  
  ```typescript
  import { getLocaleWeekYear, getWeeksInLocaleWeekYear } from "@northguild/gmt";
  
  getLocaleWeekYear("2022-01-01", "en-US", { minimalDays: 1 }); // 2022 — January 1 is always in week 1
  getLocaleWeekYear("2022-01-01", "en-US"); // 2021 — the ISO 8601 default of 4
  getWeeksInLocaleWeekYear("2022-06-15", "en-US", { minimalDays: 1 }); // 53
  getLocaleWeekYear("2022-01-01", "en-US", { minimalDays: 0 }); // null
  ```
  
  In CLDR 48's `weekData` the world default is `1`, as in `US`, `CA`, `MX`, `JP` and `CN`. `4` is set for a list of mostly European regions such as `GB`, `DE` and `FR`, where it matches GMT's default.
- 729e0f1: Give every `unix/` function one epoch grammar, one `{ epochUnit }` option and a UTC default time zone (Story CORE-8).
  
  **UTC is the default time zone everywhere in `unix/`.** About twenty functions read an omitted `timeZone` as the host's zone, so the same call gave a different answer on another machine: `addUnix`, `subtractUnix`, `setUnix`, `roundUnix`, `diffUnix`, `diffUnixAsDuration`, `isBetweenUnix`, `startOfUnix`, `endOfUnix`, `startOfQuarterForUnix`, `endOfQuarterForUnix`, `areUnixEqualBy`, the `convertUnixToPlain*` functions, `parseDateFromUnix`, `parseTimeFromUnix`, `parseDayOfWeekFromUnix`, `parseUnitFromUnix` and `parseWeekFromUnix`. They now use UTC, as `formatUnix` and `formatRelativeUnix` already did. Pass `timeZone: "local"` to the formatters, or a zone id to any function, for another zone.
  
  **One epoch grammar.** An epoch is a safe integer, or a string of ASCII digits with an optional leading `-`. Anything else returns the sentinel: `"+1"`, `" 1"`, `"1e3"`, `"1.0"`, `1.5`, `NaN`, a `bigint`, and a value outside Temporal's instant range. Before, some functions took digit strings and others did not, and the validators disagreed with the functions they guard. `isValidUnixSeconds` and `isValidUnixMilliseconds` now accept exactly what the functions accept.
  
  ```typescript
  import { addUnix, convertUnixToPlainDate, isValidUnixSeconds, parseHourFromUnix, sortUnix } from "@northguild/gmt/unix";
  
  parseHourFromUnix(1700000000000); // "22"
  convertUnixToPlainDate(1710460800, { epochUnit: "seconds" }); // "2024-03-15"
  addUnix("1700000000000", { days: 1 }); // 1700086400000
  addUnix("+1700000000000", { days: 1 }); // null
  isValidUnixSeconds("1700000000"); // true
  sortUnix(["3", 1, "2"]); // [1, 2, 3]
  ```
  
  **The converters take `{ epochUnit }`.** `convertUnixToUtc`, `convertUnixToZoned`, `convertUtcToUnix`, `convertZonedToUnix` and `getUnixNow` took the unit as a positional argument, unlike every other `unix/` function. They now take an options object, and `getUnixNow` returns `number | null`. Singular unit names are accepted in `epochUnit` too, as Temporal §13.17 accepts them.
  
  ```typescript
  import { convertUnixToUtc } from "@northguild/gmt/unix";
  import { convertUtcToUnix } from "@northguild/gmt/utc";
  
  convertUnixToUtc(1709164800, { epochUnit: "seconds" }); // "2024-02-29T00:00:00Z"
  convertUnixToUtc("1709164800", { epochUnit: "second" }); // "2024-02-29T00:00:00Z"
  convertUtcToUnix("2024-02-29T00:00:00Z", { epochUnit: "seconds" }); // 1709164800
  ```
  
  `getUnixNowUnit` also accepts plural unit names.
  
  **`intervalLengthUnix`, `intervalCountUnix` and `splitIntervalByUnitUnix` take `epochUnit` and `timeZone`** like the other `unix/interval` functions. They read milliseconds and the host's zone only.
  
  ```typescript
  import { intervalCountUnix, intervalLengthUnix } from "@northguild/gmt/unix";
  
  intervalLengthUnix(0, 172800, "days", { epochUnit: "seconds" }); // 2
  intervalCountUnix(0, 86400000, "day", { timeZone: "America/New_York" }); // 2
  ```
  
  **An unknown time zone is invalid in the `unix/` and `utc/` formatters.** `formatUnix`, `formatCalendarUnix`, `formatRelativeUnix`, `formatUtc`, `formatCalendarUtc` and `formatRelativeUtc` rendered in UTC when the zone did not exist, as if it had been omitted. ECMA-402 throws a `RangeError` for it, so they now return `""`. An omitted zone is still UTC, and `"local"` is the system zone.
  
  ```typescript
  import { formatUnix } from "@northguild/gmt/unix";
  
  formatUnix(1700000000000, "en-US", { timeZone: "Not/AZone" }); // ""
  ```
  
  **Nanosecond fields are three digits.** `parseNanosecondFromUnix` and `parseUnitFromUnix(…, "nanosecond")` returned nine digits. Temporal's `nanosecond` field is 0–999, as every other GMT parser and getter writes it.
  
  ```typescript
  import { parseNanosecondFromUnix } from "@northguild/gmt/unix";
  
  parseNanosecondFromUnix(1700000000123); // "000"
  ```
  
  ### Breaking changes
  
  | Function | 1.15 | 1.16 |
  | --- | --- | --- |
  | `convertUnixToUtc`, `convertUnixToZoned` | `convertUnixToUtc(v, "seconds")`, `convertUnixToZoned(v, zone, "seconds")` | `convertUnixToUtc(v, { epochUnit: "seconds" })`, `convertUnixToZoned(v, zone, { epochUnit: "seconds" })` |
  | `convertUtcToUnix`, `convertZonedToUnix` | `convertUtcToUnix(v, "seconds")` | `convertUtcToUnix(v, { epochUnit: "seconds" })` |
  | `getUnixNow` | `getUnixNow("seconds")`, returns `number` | `getUnixNow({ epochUnit: "seconds" })`, returns `number \| null` |
  | `convertUnixToPlainDate`, `…DateTime`, `…Time` | `convertUnixToPlainDate(1710460800, "seconds")` silently read milliseconds: `"1970-01-20"` in UTC | `""`; pass `{ epochUnit: "seconds" }` |
  | The unix functions listed above, `timeZone` omitted | the host's zone | `"UTC"`; pass `timeZone` for another zone |
  | `intervalLengthUnix`, `intervalCountUnix`, `splitIntervalByUnitUnix` | host zone, milliseconds only | `{ epochUnit, timeZone }`, default milliseconds and `"UTC"` |
  | `formatUnix`, `formatCalendarUnix`, `formatRelativeUnix`, `formatUtc`, `formatCalendarUtc`, `formatRelativeUtc` with an unknown `timeZone` | rendered in UTC | `""` |
  | `parseNanosecondFromUnix(1700000000000)` | `"000000000"` | `"000"` |
  | Epoch strings such as `"+1"`, `"1e3"` or `" 1"` | accepted by some functions | the sentinel |
  
  A positional unit passed to the new signatures returns the sentinel rather than a wrong instant: `convertUnixToUtc(1709164800, "seconds" as never)` is `""`.
- 729e0f1: Validate `unix/` epoch arguments and read rounding and comparison options the way Temporal reads them (Story CORE-8).
  
  **`epochUnit` is validated.** Fourteen `unix/` functions read any `epochUnit` they did not recognise, including a misspelling, as milliseconds. They are `addUnix`, `subtractUnix`, `diffUnix`, `diffUnixAsDuration`, `isBetweenUnix`, `roundUnix`, `setUnix`, `areUnixEqual`, `isAfterUnix`, `isBeforeUnix`, `intervalFromDurationUnix`, `intervalOverlappingDaysUnix`, `formatCalendarUnix` and `formatRelativeUnix`. They now return their sentinel.
  
  **A blank epoch string is not 1970.** `parseYearFromUnix` and the other `parse*FromUnix` functions read `""` and whitespace as epoch 0. They now return `""`.
  
  **`sortUnix`, `minUnix` and `maxUnix` skip values that are not instants.** A fraction such as `1.5`, or a number past Temporal's range such as `1e20`, was sorted or returned as if it were an epoch.
  
  ```typescript
  import { addUnix, parseYearFromUnix, sortUnix } from "@northguild/gmt/unix";
  
  addUnix(1700000000000, { days: 1 }, { epochUnit: "minutes" }); // null
  parseYearFromUnix("   "); // ""
  sortUnix([3, 1.5, 1e20, 2]); // [2, 3]
  ```
  
  `FormatCalendarUnixOptions` no longer declares `style`, `numeric`, `largestUnit` or `roundingMethod`. `formatCalendarUnix` never read them, so its output is unchanged; see **Breaking changes** below.
  
  **Rounding options follow Temporal.**
  
  - `roundTime`, `roundDateTime`, `roundUtc`, `roundZoned` and `roundUnix` accept plural unit names in `smallestUnit`, as Temporal §13.17 does.
  - `roundDate` and `roundDateTime` returned the floor for a `roundingMode` outside Temporal's nine modes. They now return `""`. A fractional `roundingIncrement` is truncated to an integer, as Temporal truncates it, instead of rejected.
  - `startOfDate(value, "day")` returns the date, as `endOfDate(value, "day")` already did. It returned `""`.
  
  ```typescript
  import { roundDate, roundTime, startOfDate } from "@northguild/gmt/plain";
  
  roundTime("12:34:56", { smallestUnit: "hours" }); // "13:00:00"
  roundDate("2024-05-20", { smallestUnit: "month", roundingIncrement: 1.5 }); // "2024-06-01"
  roundDate("2024-05-20", { smallestUnit: "month", roundingMode: "bogus" as never }); // ""
  startOfDate("2024-02-29", "day"); // "2024-02-29"
  ```
  
  **`areUtcEqualBy` and `areDateTimesEqualBy` compare the buckets you name.** With `fractionalSecondDigits`, they compared the printed strings, so two different milliseconds printed with 0 digits looked equal. They now compare the start of each `unit` bucket, and the option is removed.
  
  ```typescript
  import { areUtcEqualBy } from "@northguild/gmt/utc";
  
  areUtcEqualBy("2024-05-15T10:20:30.123Z", "2024-05-15T10:20:30.999Z", "millisecond"); // false
  ```
  
  To compare at the precision the digits stood for, pass that coarser unit.
  
  ```typescript
  areUtcEqualBy("2024-05-15T10:20:30.123Z", "2024-05-15T10:20:30.999Z", "second"); // true
  ```
  
  **`getLocaleZonedEndOfWeek` prints the end to the nanosecond.** It kept the whole-second default that the other `endOf*` functions dropped in this release.
  
  ```typescript
  import { getLocaleZonedEndOfWeek } from "@northguild/gmt/zoned";
  
  getLocaleZonedEndOfWeek("2024-03-13T10:00:00-04:00[America/New_York]", "en-US"); // "2024-03-16T23:59:59.999999999-04:00[America/New_York]"
  ```
  
  Compatibility: pass `{ fractionalSecondDigits: 0 }` to keep the whole-second string.
  
  ```typescript
  getLocaleZonedEndOfWeek("2024-03-13T10:00:00-04:00[America/New_York]", "en-US", { fractionalSecondDigits: 0 }); // "2024-03-16T23:59:59-04:00[America/New_York]"
  ```
  
  ### Breaking changes
  
  | 1.15 | 1.16 |
  | --- | --- |
  | `formatCalendarUnix(v, locale, { reference, style, numeric, largestUnit, roundingMethod })` | `formatCalendarUnix(v, locale, { reference })`: the four members had no effect |
  | `areUtcEqualBy(a, b, "millisecond", { fractionalSecondDigits: 0 })` | `areUtcEqualBy(a, b, "second")` |
  | `areDateTimesEqualBy(a, b, "millisecond", { fractionalSecondDigits: 0 })` | `areDateTimesEqualBy(a, b, "second")` |

### Patch Changes

- 729e0f1: Fix three defaults that returned the wrong value (Story CORE-8). Each one has a documented option that restores the previous output.
  
  **`endOf*` printed a moment earlier than the end.** An end is the next start minus one nanosecond, but `endOfTime`, `endOfDateTime`, `endOfUtc`, `endOfZoned` and `endOfQuarterForZoned` printed only the digits the unit names, so `endOfTime("12:34:56", "hour")` returned `"12:59:59"`: 999,999,999 nanoseconds before the real end. They now default to nanosecond precision, which `endOfQuarterForUtc` already used.
  
  ```typescript
  endOfUtc("2024-03-15T14:30:45Z", "month"); // "2024-03-31T23:59:59.999999999Z"
  endOfUtc("2024-03-15T14:30:45Z", "month", { fractionalSecondDigits: 0 }); // "2024-03-31T23:59:59Z" — previous output
  ```
  
  To keep the previous string, pass the digits the unit names: `0` for `second` and coarser, `3` for `millisecond`, `6` for `microsecond`. For `endOfQuarterForZoned`, always pass `0`.
  
  **`formatDateTimeToParts` and `formatZonedToParts` dropped the time.** Called with no field options, they returned only the date parts. For a date-time value, ECMA-402's `GetDateTimeFormat`, as amended by Temporal, defaults year, month, day, hour, minute and second to `"numeric"`, and adds a short time zone name for a zoned value. They now do the same.
  
  ```typescript
  formatZonedToParts("2024-03-15T14:30:00.000-04:00[America/New_York]", "en-US");
  // month, day, year, hour, minute, second, dayPeriod, timeZoneName "EDT"
  formatZonedToParts("2024-03-15T14:30:00.000-04:00[America/New_York]", "en-US", { year: "numeric", month: "numeric", day: "numeric" });
  // month, day, year — previous output
  ```
  
  **`getLocaleWeekYear` and `getWeeksInLocaleWeekYear` answered differently by Node version.** They read a locale's `minimalDays` from the runtime. Node 22 still reported it, while Node 24 and later do not, so `getLocaleWeekYear("2022-01-01", "en-US")` returned `2022` on one runtime and `2021` on another. The default is now the ISO 8601 value `4` on every runtime. Pass `{ minimalDays: 1 }` to keep the Node 22 result for `en-US` and other locales whose rule is `1`.
- 82380f8: Fix non-ISO calendar arithmetic, differences and range limits that were wrong, empty or unparseable, so every supported calendar follows TC39 Temporal and the Intl Era and Month Code proposal across the whole representable range.
  
  Several of these fixes change outputs that shipped. Each earlier output was wrong under the specification, so each change is a bug fix, not a new behaviour. The examples use this release's RFC 9557 calendar strings, described in their own entry.
  
  - **Month and year differences at month ends are correct in every non-ISO calendar.** A month counts only once the end date reaches the same day of the next month, as Temporal's `NonISODateSurpasses` specifies. `diffDateAsDuration("2024-08-31[u-ca=buddhist]", "2024-09-30[u-ca=buddhist]", "months")` is `"P30D"`, not `"P1M"`. This changes results from `diffDate`, `diffDateAsDuration`, `intervalLengthDate`, `intervalCountDate`, `diffZoned`, `diffZonedAsDuration`, `intervalLengthZoned` and `intervalCountZoned` for calendar-annotated input. The rounding options of `diffDate` and `diffDateAsDuration` now round from that correct difference.
  - **Hebrew year differences across a leap month return a value.** A difference in years from an Adar I date in a leap year used to return `null` or `""`. `diffDateAsDuration("2024-02-24[u-ca=hebrew]", "2025-03-15[u-ca=hebrew]", "years")` is `"P1Y"`.
  - **Calendar dates at both range limits parse, and arithmetic works there.** `isValidCalendarDate("+275760-09-13[u-ca=hebrew]")` is `true`. `addDate`, `subtractDate`, `diffDate*` and the duration functions work near the first and last dates in buddhist, hebrew, the Islamic calendars, persian and indian.
  - **Buddhist is proleptic.** Its year is the ISO year plus 543 with the same month and day for every date, so month arithmetic before 1582-10-15 follows the proleptic Gregorian calendar: `addDate("1000-01-31[u-ca=buddhist]", { months: 1 })` is `"1000-02-28[u-ca=buddhist]"`.
  - **Hebrew years ≤ 0 and Indian dates before ISO year 1 are correct.** Their fields were a day off, threw, or returned the sentinel, which put arithmetic on those dates a day off too.
  - **Zoned values at the minimum instant in zones behind UTC are accepted.** `convertZonedToCalendar("-271821-04-19T12:00:00[Etc/GMT+12]", "hebrew")` is `"-271821-04-19T12:00:00-12:00[Etc/GMT+12][u-ca=hebrew]"`. With an explicit `-12:00` offset, Temporal checks that local date against the day range and rejects it, so that form still returns `""`.
  - **A calendar-annotated `relativeTo` works near the range limits** in `durationAs`, `normalizeDuration` and `compareDurations`.
  
  Each correction checks the installed Temporal polyfill and ICU once and stays inactive where they are already right, so no output changes when the upstream fixes ship.
- 729e0f1: The 1844 date-line crossings are found. `Asia/Manila`, `Pacific/Guam`, `Pacific/Saipan`, `Pacific/Kosrae` and `Pacific/Palau` moved to the Asian side of the date line by skipping 1844-12-31, but the Temporal polyfill only searches for time zone transitions from 1847-01-01 on, so GMT missed that change. Every fix returns what native Temporal (Chrome 153) returns.
  
  - **`getDstTransitions(zone, 1845)` lists the crossing.** It used to return `[]`. `getDstTransitions("Asia/Manila", 1845)` is `[{ instant: "1844-12-31T15:56:08Z", offsetBefore: "-15:56:08", offsetAfter: "+08:03:52" }]`. 1844 stays `[]`: the crossing is local 1845-01-01 00:00, so it belongs to 1845.
  - **Weeks across the crossing start on Monday 1844-12-30.** `startOfZoned`, `endOfZoned`, `floorToZone` and `areZonedEqualBy` by week were a day off. `floorToZone("1845-01-02T03:56:08Z", "week", "Asia/Manila")` is `"1844-12-30T15:56:08Z"`, not `"1844-12-29T15:56:08Z"`, and 1844-12-30 and 1845-01-02 are now in the same week. `startOfUnix`, `areUnixEqualBy` and `getLocaleZonedStartOfWeek` are corrected with them.
  - **1844-12-30 is 24 hours long.** `getHoursInZonedDay("1844-12-30T12:00:00-15:56[Asia/Manila]")` is `24`, not `479340.06444444443`. `roundZoned` and `roundUnix` to a day now round its noon up to the crossing, `1845-01-01T00:00:00+08:04[Asia/Manila]`, instead of down to 1844-12-30.
  - **The skipped day is not counted.** `intervalCountZoned` from 1844-12-01 to 1845-02-01 by day is `61`, not `62` (`intervalCountUnix` over the same span agrees), and `intervalOverlappingDaysZoned` from 1844-12-29 noon to 1845-01-01 noon is `3`, not `4`.
  - **Business days skip it.** `addZonedBusinessDays("1844-12-27T12:00:00-15:56[Asia/Manila]", 2)` is `"1845-01-01T12:00:00+08:04[Asia/Manila]"`, not a date in 1899.
  
  The correction runs only for instants before 1847-01-01 (and local dates on or before it) in a named zone; every later value takes the same path as before. It is removed once a polyfill release containing js-temporal/temporal-polyfill#372 is the dependency floor.
- 729e0f1: Correct about 70 JSDoc `@example` results that disagreed with what the function returns (Story CORE-8).
  
  Every public function's examples were executed against the build and compared with their documented result. They also feed the reference site and the playground's default inputs. The wrong ones fell into a few classes:
  
  - **Invalid locales.** Twelve locale-aware functions documented their sentinel for `"not-a-locale"`. That tag is well-formed BCP 47, so ECMA-402 falls back instead of throwing, and the functions return a real value. The examples now use a malformed tag.
  - **Microseconds and nanoseconds.** The `parseMicrosecondFrom*` and `parseNanosecondFrom*` examples documented `"123"` for `"…45.123"`. That fraction is 123 milliseconds, so both fields are `"000"`.
  - **Zone-dependent Unix parsers.** The `unix/parse` examples were written in a local zone. They now document the UTC fields.
  - **CLDR wording.** Range, date-time and parts examples now match CLDR 42 and later, including the narrow no-break space (U+202F) before `AM`/`PM`.
  - **Arithmetic and transcription errors.** Among others: `roundUtc`, `roundUnix`, `minZoned` across a DST change, `convertZonedToUnix`, `intervalIntersectionUnix`, and `areUnixEqual`, whose `epochUnit` applies to both values. The `formatCalendarUtc` and `formatCalendarZoned` examples referenced an undefined variable.
  
  The rest of the review corrected the prose around those examples too:
  
  - **Parity claims and option tables.** `formatCalendarUnix` claimed to mirror `formatCalendar` and listed four options it never read. `isZonedBusinessDay` and its add and subtract functions claimed parity with `isBusinessDay` that no longer held.
  - **Ranges and defaults.** `normalizeDuration`'s `roundingIncrement` and `largestUnit: "auto"` rules, and the `unixSeconds` and `unixMilliseconds` regex ranges.
  - **Sources.** Wrong section numbers for Temporal, ECMA-402 and the RFCs, and documented behaviour the docs had not stated: RFC 5905's all-zero NTP timestamp also means an unknown time, only .NET ticks of `Kind == Utc` name an instant, and a bracketed zone on an instant string is not checked.
  
  No function's behaviour changed in this entry.
- 82380f8: Fix results that were wrong, empty or thrown at the edges of the representable range: the last nanosecond of a day, the first and last instant, and zones ahead of or behind UTC there.
  
  Temporal represents instants from `-271821-04-20T00:00:00Z` to `+275760-09-13T00:00:00Z`. Every fix returns what the TC39 specification returns for the same input.
  
  - **`intervalAbuts*` and `intervalXorAll*` no longer step past an edge.** They used to add one unit to an interval's end, which wraps a `PlainTime` to midnight and throws at the last instant. The half-open rule in this release removes the step altogether, so `intervalAbutsTime`, `intervalAbutsDate`, `intervalAbutsDateTime`, `intervalAbutsUtc`, `intervalAbutsZoned`, and `intervalXorAll*` for all six families return the exact answer there. `intervalXorAllTime([{ start: "22:00:00", end: "23:59:59.999999999" }])` returns that interval, not `[]`.
  - **`intervalDifference*` keeps A whole when B lies entirely before it.** All six families used to start the remaining piece one unit after B's end, inside the gap. `intervalDifferenceDate("2024-01-10", "2024-01-20", "2024-01-01", "2024-01-05")` is `[{ start: "2024-01-10", end: "2024-01-20" }]`.
  - **Ends of units in the earliest month exist.** Several functions returned the sentinel because the unit's start lies before the range, although its end does not: `endOfDate`, `endOfDateTime`, `endOfUtc`, `endOfZoned` and `endOfUnix` for week, month, quarter and year, plus `roundDate`, `roundDateTime`, `intervalCountDate`, `intervalCountDateTime` and `getLocaleZonedEndOfWeek`. `endOfDate("-271821-04-19", "month")` is `"-271821-04-30"`.
  - **`endOfDate` and `endOfDateTime` end a Sunday-first week on Saturday.** For a Sunday input, the week used to end on the previous Saturday. `endOfDate("2024-03-10", "week", { weekStartsOn: "sunday" })` is `"2024-03-16"`.
  - **Zone boundaries at the last instant keep the right offset.** `startOfZoned`, `startOfQuarterForZoned`, `floorToZone`, `startOfUnix`, `intervalCountZoned`, `intervalCountUnix` and `getLocaleZonedStartOfWeek` dropped a transition there, so boundaries in daylight-saving zones came out an hour off.
  - **Zoned values near the last instant work in zones ahead of UTC.** `isValidZonedDateTime("+275760-09-13T10:00:00+10:00[Australia/Sydney]")` is now `true`, and one nanosecond later is still `false`. Every `zoned/` function that parses, adds, rounds or finds a start of day accepts these values, as do the differences and totals built on them: `diffZoned`, `diffUnix`, `diffUtc`, their `*AsDuration` forms, `intervalLengthZoned`, `intervalLengthUnix`, `intervalLengthUtc`, `durationAs`, `normalizeDuration`, `compareDurations` and `formatRelative{Zoned,Utc,Unix}`. For example, `durationAs("PT49H", "days", { relativeTo: "+275760-09-10T05:00:00+10:00[Australia/Sydney]" })` is now `2.0416666666666665`, not `null`. The same differences also work at the first instant in zones behind UTC.
  - **Daylight-saving transitions in the last weeks of the range are found.** `America/Santiago`'s day on `+275760-09-07` is 23 hours: `getHoursInZonedDay` returns `23`, not `null`. `getDstTransitions`, `mapZonedHoursInDay`, `roundZoned` and `roundUnix` to a day, and `intervalCountZoned` are corrected with it.
  - **`UTC` near the last instant behaves like `+00:00`.** A rounded difference or total whose window passes the limit now returns the sentinel, as the specification requires. `intervalLengthUtc("+275760-09-10T23:00:00Z", "+275760-09-13T00:00:00Z", "days")` is `null`.
  - **`unix/interval` functions accept only whole, safe epochs.** A fractional epoch, one past `Number.MAX_SAFE_INTEGER`, or `""` now returns the sentinel, as does any other value outside the `unix/` epoch grammar. `intervalXorUnix(0, 1, 0.5, 2)` used to return a negative piece, and `""` was read as epoch 0. `isValidUnixRange` and `isValidUnixInterval` reject the same values.
  - **The critical calendar flag is read like the plain one.** `[!u-ca=hebrew]` used to pass a gate that refused `[u-ca=hebrew]`, and the value was read in the wrong calendar. `spanNs`, `spanMs`, `toNanoseconds`, `isValidInstant` and `isValidInterval` now ignore both spellings, since an instant has no calendar, and the zoned validators refuse both.
  
  The zoned corrections run only when the installed Temporal polyfill throws near a limit, so no other input changes. They are removed once a polyfill release fixes those limits.
- 729e0f1: Return the sentinel for arguments that are hostile to inspection, not just hostile to `ToString` (Story CORE-8).
  
  **What was wrong.** 221 of the 551 exports threw when an argument resisted being looked at. A revoked `Proxy` throws on `get`, `ownKeys` and `Array.isArray`; an object with a throwing getter throws when a rest-spread enumerates it. Those operations sat in the guards *above* each function's `try`, so the guard meant to reject invalid input raised instead.
  
  ```typescript
  import { addDate, formatUnix } from "@northguild/gmt";
  
  const { proxy, revoke } = Proxy.revocable({}, {});
  revoke();
  
  addDate("2024-01-01", proxy);
  // ""  — was: TypeError: Cannot perform 'ownKeys' on a proxy that has been revoked
  
  formatUnix(0, "en-US", { get length() { throw new Error("boom"); } });
  // ""  — was: Error: boom
  ```
  
  Every affected export now evaluates its whole body inside the `try` whose `catch` already returned its sentinel, so a guard cannot raise. Valid input is unaffected: all 36,348 tests pass unchanged.
  
  **Why it was invisible.** The no-throw harness fed each export a list of eleven hostile values, and a list only finds what someone thought to put on it. It now also passes a proxy that throws on every trap, a revoked proxy, and an object with a throwing getter — values hostile to *any* access rather than to one named operation.
- 729e0f1: Make the RFC 5322, HTTP-date and RFC 3339 parsers and formatters follow their grammars exactly (Story CORE-8).
  
  **`parseRfc2822` accepts what a receiver must accept.** It took only the strict form GMT's own formatter writes. RFC 5322 §3.3 also allows folding whitespace, comments, any letter case and a 4-or-more-digit year. §4 says a receiver MUST accept the obsolete syntax too: two- and three-digit years, and the military and North American zone names. Unknown zone names read as `-0000`, meaning no offset information.
  
  ```typescript
  import { parseRfc2822 } from "@northguild/gmt/zoned";
  
  parseRfc2822("fri,15 Mar 24 14:30 -0400 (EDT)"); // "2024-03-15T14:30:00-04:00[-04:00]"
  parseRfc2822("Fri, 15 Mar 2024 14:30:00 CEST"); // "2024-03-15T14:30:00+00:00[+00:00]"
  ```
  
  Comments are read in one linear pass. A deeply nested comment used to take quadratic time: 4 seconds for 100 KB.
  
  **`parseHttp` accepts all three HTTP-date forms.** RFC 9110 §5.6.7 says a recipient MUST accept `rfc850-date` and `asctime-date` as well as `IMF-fixdate`. Only `IMF-fixdate` was accepted.
  
  ```typescript
  import { parseHttp } from "@northguild/gmt/utc";
  
  parseHttp("Sunday, 06-Nov-94 08:49:37 GMT"); // "1994-11-06T08:49:37Z"
  parseHttp("Sun Nov  6 08:49:37 1994"); // "1994-11-06T08:49:37Z"
  ```
  
  **A day name that contradicts the date is rejected.** RFC 5322 §3.3 requires the day of week to match the date. Both parsers ignored it, so `"Sat, 15 Mar 2024"` parsed as a Friday. They now return `""`.
  
  `parseHttp` applies the rule to **all three** HTTP-date forms, `asctime-date` included. That form writes the day name with no comma after it, so it is the one most likely to be read as decoration — it is not. 6 November 1994 was a Sunday, so all three of these return `""`, and only the Sunday spellings parse:
  
  ```typescript
  parseRfc2822("Sat, 15 Mar 2024 14:30:00 -0400"); // ""
  parseHttp("Sat, 15 Mar 2024 14:30:00 GMT"); // "" — IMF-fixdate
  parseHttp("Monday, 06-Nov-94 08:49:37 GMT"); // "" — rfc850-date
  parseHttp("Mon Nov  6 08:49:37 1994"); // "" — asctime-date
  parseHttp("Sun Nov  6 08:49:37 1994"); // "1994-11-06T08:49:37Z"
  ```
  
  Accepting a mismatch would mean choosing which of the two fields to believe, and RFC 9110 gives no rule for that. Rejecting is the only reading that never invents a date.
  
  Compatibility: remove the day name. The date alone then decides the result. For `parseHttp`, parse the string as RFC 5322 and convert it to UTC.
  
  ```typescript
  parseRfc2822("15 Mar 2024 14:30:00 -0400"); // "2024-03-15T14:30:00-04:00[-04:00]"
  convertZonedToUtc(parseRfc2822("15 Mar 2024 14:30:00 GMT")); // "2024-03-15T14:30:00Z"
  ```
  
  **Formatters stop writing strings outside their grammar.** `formatRfc2822` and `formatHttp` wrote years before 0000 as `"00-1"`, and `formatHttp` wrote years past 9999. `formatRfc2822` wrote an offset with seconds, such as Monrovia's −00:44:30 in 1969, as `"-0044.5"`. `formatRfc3339` rounded a sub-minute offset to the minute, which names a different instant, and wrote years past 9999 in expanded form. All three now return `""` for a year their grammar cannot express, and `formatRfc2822` does the same for an offset with seconds. `formatRfc3339` writes such a value as the same instant at `+00:00`.
  
  ```typescript
  formatRfc3339("1969-12-31T23:15:30-00:45[Africa/Monrovia]"); // "1970-01-01T00:00:00+00:00"
  formatRfc3339("+010000-01-01T00:00:00+00:00[UTC]"); // ""
  formatHttp("-000001-06-15T12:00:00Z"); // ""
  formatRfc2822("-000001-06-15T12:00:00+00:00[UTC]"); // ""
  ```
  
  Compatibility: for the value itself, use Temporal's own serialisation. `Temporal.ZonedDateTime#toString({ timeZoneName: "never" })` gives the earlier `formatRfc3339` string, and `Temporal.Instant#toString()` or `Temporal.ZonedDateTime#toString()` gives a string for any year.
  
  ```typescript
  Temporal.ZonedDateTime.from("1969-12-31T23:15:30-00:45[Africa/Monrovia]").toString({ timeZoneName: "never" }); // "1969-12-31T23:15:30-00:45"
  ```
  
  The `rfc2822DateTime` and `httpDate` regexes stay strict: they match only the form GMT writes. The `rfc3339DateTime` regex now rejects an offset outside `-23:59`…`+23:59`, as RFC 3339 §5.6 requires.
  
  ```typescript
  import { rfc3339DateTime } from "@northguild/gmt/regex";
  
  rfc3339DateTime.test("2024-03-15T14:30:00+24:00"); // false
  ```
- 729e0f1: Format dates and times the way ECMA-402, as amended by Temporal, formats Temporal values (Story CORE-8).
  
  The text formatters took their options through the polyfill's `toLocaleString`, which rebuilds them from `resolvedOptions()` and loses some on the way. They now apply Temporal's `GetDateTimeFormat` and `AdjustDateTimeStyleFormat` over the runtime's own `Intl.DateTimeFormat`, so each text result equals its `…ToParts` result joined. The affected functions are `formatDate`, `formatTime`, `formatDateTime`, `formatDateRange`, `formatDateTimeRange`, `formatUtc`, `formatUnix`, `formatZonedDateTime`, `formatZonedRange` and the three `…ToParts` functions. The implementation was checked against a native-Temporal browser in 55,080 comparisons.
  
  **Requested widths are kept.** Some locales and calendars lost a width, so `ja-JP` with the Japanese calendar and `month: "long"` gave `"R6/2"`, and `zh-CN` gave `"2024/2"`. A `long` or `full` `timeStyle` also replaced a shorter `dateStyle`.
  
  ```typescript
  import { formatDate, formatDateTime, formatTime } from "@northguild/gmt/plain";
  
  formatDate("2024-02-03", "ja-JP-u-ca-japanese", { year: "numeric", month: "long" }); // "令和6年2月"
  formatDate("2024-02-03", "ja-JP-u-ca-japanese", { year: "numeric", month: "numeric" }); // "R6/2"
  ```
  
  **`era` and `timeZoneName` count as the fields they are.** Temporal treats neither as a date or time field, so it adds the value's default fields. `era` alone dropped the time from a date-time. `timeZoneName` alone returned `""`, and a plain value has no zone to name, so it is now left out.
  
  ```typescript
  formatDateTime("2024-02-03T14:30:45", "en-US", { era: "long" }); // "2/3/2024 Anno Domini, 2:30:45 PM"
  formatDate("2024-02-03", "en-US", { timeZoneName: "long" }); // "2/3/2024"
  formatTime("14:30:45", "en-US", { era: "long" }); // "2:30:45 PM"
  ```
  
  **A style the type cannot show returns the sentinel.** A `timeStyle` beside `dateStyle` on a `PlainDate` was ignored, as was a `dateStyle` on a `PlainTime`. `formatDateToParts` with time options leaked a UTC midnight and a `"UTC"` zone name, and a `long`/`full` `timeStyle` added a `"UTC"` zone name to `formatDateTimeToParts` and `formatCalendar`. Plain values now show no zone, and a style for fields the type does not have returns `""` or `[]`.
  
  ```typescript
  formatDate("2024-02-03", "en-US", { dateStyle: "short", timeStyle: "short" }); // ""
  formatDate("2024-02-03", "en-US", { dateStyle: "short" }); // "2/3/24"
  formatTime("14:30:45", "en-US", { timeStyle: "short" }); // "2:30 PM"
  ```
  
  **A zoned value is formatted in its own zone.** `formatZonedToParts` honoured a `timeZone` option and rendered the instant in that zone, and `formatZonedRange` silently overrode it. Both now return their sentinel for a `timeZone` option, as `formatZonedDateTime` does.
  
  ```typescript
  import { formatUtc, formatZonedToParts } from "@northguild/gmt";
  
  formatZonedToParts("2024-03-15T14:30:00.000-04:00[America/New_York]", "en-US", { timeZone: "Asia/Tokyo" }); // []
  formatUtc("2024-02-03T19:30:45Z", "en-US", { timeZone: "Asia/Tokyo", includeTimeZoneName: true }); // "2/4/2024, 4:30:45 AM GMT+9"
  ```
  
  Compatibility: each function's JSDoc names the call that keeps its earlier text. Pass the fields the old text showed, such as the numeric fields for `"R6/2"` or `dateStyle` alone for the styled date. To render an instant in another zone, use `formatUtc` with its `timeZone` option. For the parts a plain date used to leak, call `formatZonedToParts` on the value at midnight UTC.
- 729e0f1: Stop 62 functions throwing on a missing or wrong-typed argument (Story CORE-8). Each now returns its documented invalid-input result.
  
  GMT's contract is that invalid input returns `""`, `null`, `false` or `[]` and never throws. These functions broke it with a `TypeError` or `RangeError` from inside the function:
  
  - `addDate`, `subtractDate` and the other `add*`/`subtract*` functions, given a `null` duration
  - `roundDate`, `roundTime` and the other `round*` functions, with no options
  - `min*`, `max*`, `sort*`, `closestDateTo` and `closestZonedTo`, given something that is not an array
  - `getLargestDateDurationUnit`, `getLargestDateTimeDurationUnit` and `getLargestTimeDurationUnit`, given `null` or a non-array, which now return `""`
  - the ten `formatRelative*` and `formatCalendar*` functions, given `options = null`
  - the six `isValid*Range` validators, given `null` or `undefined`
  
  ```typescript
  import { addDate, cycleDate, isValidDateRange, minDate, minUnix, roundTime } from "@northguild/gmt";
  
  addDate("2024-01-01", null); // ""
  roundTime("12:34:56"); // ""
  minDate("2024-01-01"); // null
  isValidDateRange(null); // false
  ```
  
  `options = null` in the relative and calendar formatters returns `""`, since Temporal's `GetOptionsObject` rejects it. This release applies the same rule to every function that takes an options object.
  
  **`cycle*` amounts.** `cycleDate`, `cycleDateTime`, `cycleTime` and `cycleZoned` read `null`, `""`, `[]` and `true` as an amount of `0` and returned the value unchanged. They now return `""`.
  
  ```typescript
  cycleDate("2024-12-15", "month", null); // ""
  ```
  
  **`minUnix` and `maxUnix` on long arrays.** They spread the array into one call, so around 200,000 values overflowed the stack. They now scan the array.
  
  ```typescript
  minUnix(Array.from({ length: 200000 }, (_, i) => i * 1000)); // 0
  ```
  
  A new test feeds invalid values to every exported function in every argument position and checks that it returns its declared sentinel. No valid input changes output in this entry.
- 729e0f1: Tighten input checks for leap seconds, time zone names, calendar annotations and date shapes, so every function accepts the same strings its validator accepts (Story CORE-8).
  
  **Leap seconds are rejected in every spelling.** GMT rejects `:60`, as Temporal does not represent it, but the check matched only an uppercase `T` with extended digits. A lowercase `t`, a space separator or the basic format (`20161231 235960Z`) got through, and every `zoned/` function silently read the second as `:59`. `getTimeZoneOffset` looked up the offset at the clamped instant, and a `relativeTo` string was never checked at all. All of them now return their sentinel, and `isLeapSecond` and the `leapSecond` regex recognise every spelling.
  
  ```typescript
  import { addZoned, getTimeZoneOffset, isValidZonedDateTime } from "@northguild/gmt/zoned";
  
  isValidZonedDateTime("2016-12-31t23:59:60+00:00[UTC]"); // false
  addZoned("2016-12-31 23:59:60+00:00[UTC]", { seconds: 1 }); // ""
  getTimeZoneOffset("UTC", "2016-12-31T23:59:60Z"); // ""
  ```
  
  Compatibility: to read a leap second as `:59` the way earlier releases did, let Temporal clamp it, or pass the `:59` instant yourself.
  
  ```typescript
  Temporal.ZonedDateTime.from("2016-12-31 23:59:60+00:00[UTC]").toString(); // "2016-12-31T23:59:59+00:00[UTC]"
  getTimeZoneOffset("UTC", "2016-12-31T23:59:60Z".replace(":60", ":59")); // "+00:00"
  ```
  
  The `instantLeapSecond` regex is now anchored. It used to match inside an annotation value, so `isValidInstant`, the `span*` functions and `toOffsetInstant` rejected a valid instant such as `"2024-01-01T00:00:00Z[x=T123460Z]"`.
  
  **Single-component IANA names are time zones.** `timeZoneLike`, and so `isValidTimeZone` and every zone argument, required a `/` in any name except `UTC` and `GMT`. It rejected 42 IANA names such as `Japan`, `Zulu` and `EST5EDT`, and `formatUtc` and `formatUnix` rendered those zones as UTC. The pattern now follows Temporal's `TimeZoneIdentifier` grammar and is case-insensitive: an IANA name, or a UTC offset such as `+05:00`, which this release also accepts as a zone. Any other name starting with `+` or `-` is rejected.
  
  ```typescript
  import { formatUtc, isValidTimeZone } from "@northguild/gmt";
  
  isValidTimeZone("Japan"); // true
  isValidTimeZone("utc"); // true
  formatUtc("2024-07-15T16:00:00Z", "en-US", { timeZone: "Japan", hour: "numeric", minute: "2-digit" }); // "1:00 AM"
  ```
  
  Compatibility: to keep the slash rule, also require `timeZone.includes("/")`, or `"UTC"`/`"GMT"`. `toOffsetInstant` now returns the zone in IANA casing on both paths. Earlier releases echoed the argument's casing, so pass an IANA-cased id to get the same string back.
  
  **`isValidZonedRange` checks calendar annotations as the rest of `zoned/` does.** It accepted any `[u-ca=…]` annotation, which the `zoned/` functions behind it then refused. It now accepts `[u-ca=iso8601]` and returns `false` for any other calendar. Calendar ids and calendar-annotated strings themselves are described in this release's RFC 9557 entry.
  
  ```typescript
  import { isValidZonedRange } from "@northguild/gmt/zoned";
  
  isValidZonedRange({ value1: "2024-01-01T00:00:00+00:00[UTC][u-ca=hebrew]", value2: "2024-02-01T00:00:00+00:00[UTC]" }); // false
  isValidZonedRange({ value1: "2024-01-01T00:00:00+00:00[UTC][u-ca=iso8601]", value2: "2024-02-01T00:00:00+00:00[UTC]" }); // true
  ```
  
  Compatibility: to check a range of calendar-annotated zoned strings, validate each value with `isValidCalendarZonedDateTime`.
  
  **`isLeapYear` and `getWeekNumber` validate before they parse.** They read date-times, zoned strings and other shapes loosely as a date. They now take a `PlainDate` only.
  
  ```typescript
  import { getWeekNumber, isLeapYear } from "@northguild/gmt/plain";
  
  isLeapYear("2024-03-15T10:00"); // false
  getWeekNumber("2024-03-15T10:00"); // null
  getWeekNumber("2024-03-15T10:00".slice(0, 10)); // 11
  ```
  
  Compatibility: pass the date part alone, or use `Temporal.PlainDate.from(value).inLeapYear` and `.weekOfYear`.
  
  **Regexes.** `year`, `plainDate`, `plainDateTime`, `sqlDateTime` and `utcDateTime` accepted the year `-000000`, which Temporal's grammar forbids. They now reject it.
  
  ```typescript
  import { year } from "@northguild/gmt/regex";
  
  year.test("-000000"); // false
  ```
- 82380f8: Fix locale week data on Node 26.
  
  Node 26 (V8 14) removed the `Intl.Locale#weekInfo` accessor in favour of the Intl Locale Info proposal's `getWeekInfo()` method. GMT read only the accessor, so on Node 26 every locale silently fell back to ISO defaults: weeks started on Monday, weekends were Saturday and Sunday, and week-year rules used ISO's minimal days.
  
  The functions affected on Node 26 were `getLocaleStartOfWeek`, `getLocaleEndOfWeek`, `getLocaleDayOfWeek`, `getLocaleWeekYear`, `getWeeksInLocaleWeekYear`, `getWeekOfMonth`, `getWeeksInMonth`, `getLocaleWeekdayNames`, `isWeekend`, `isThisUnit` and their zoned twins. For example, `en-US` weeks started on Monday instead of Sunday, and `ar-SA` weekends were Saturday and Sunday instead of Friday and Saturday.
  
  GMT now calls `getWeekInfo()` when the runtime has it and falls back to `weekInfo` otherwise, so results are the same on Node 22, 24 and 26.
- 729e0f1: Fix lengths, rounding and differences in months or years measured from the 29th, 30th or 31st (Story CORE-8).
  
  **Which functions.** `intervalLengthDate`, `intervalLengthDateTime`, `intervalLengthUtc`, `intervalLengthZoned`, `intervalLengthUnix`, `formatRelativeDate`, `formatRelativeDateTime`, `normalizeDuration`, and the `diff*` functions that carry a time component — `diffDateTime`, `diffUtc`, `diffUnix` and `diffZoned` — given a `smallestUnit` of months or years. `diffDate` is not affected: two dates have no time component, so the bracket always closes on a date it already reaches.
  
  **What was wrong.** A month has no fixed length, so measuring one means bracketing the span between two dates a month apart. Temporal checks that the answer actually falls inside that bracket and moves it along when it does not. `@js-temporal/polyfill` 0.5.1 skips that check, so any measurement from the 29th, 30th or 31st — the days where adding a month has to clamp — could be taken against the wrong pair of dates.
  
  ```typescript
  import { diffDateTime, intervalLengthDateTime, normalizeDuration } from "@northguild/gmt";
  
  diffDateTime("2024-01-31T00:00:00", "2024-02-29T12:00:00", ["months"], { smallestUnit: "months", roundingMode: "floor" });
  // { months: 1 } — was { months: 0 }, a whole month short
  
  normalizeDuration("P30DT12H", { smallestUnit: "month", roundingMode: "floor", relativeTo: "2024-01-30" });
  // "P1M" — was "PT0S"
  
  intervalLengthDateTime("2024-01-31T00:00:00", "2024-02-29T12:00:00", "month");
  // 1.0161290322580645 — was 1.0172413793103448
  ```
  
  Differences without a `smallestUnit` were always right, and so was every whole part: only a measurement that had to round, or report a fraction, was affected.
  
  **Rounding exactly on a boundary.** Separately, `ceil` treated a span that lands exactly on a whole month as needing another one — `P60D` from `2024-01-31` rounded to `P3M` instead of `P2M`. A span that is already a whole number of months now stays as it is, in every calendar.
  
  **How it is fixed.** GMT already owns the TC39 algorithm, for the non-ISO calendars the polyfill also gets wrong; these operations now take that path. Every one of 24,916 scanned cases matches the Temporal built into Chrome 153 exactly. The workaround is behind a probe (compat defect `D11`) and stops running by itself once a polyfill release carries the upstream fix — the answers do not change when it does.
- 729e0f1: Stop routing ISO `PlainDate` differences through the D11 nudge-window workaround (Story CORE-8).
  
  `diffDate` and `diffDateAsDuration` with a `smallestUnit` of months or years took GMT's own spec path when the start day was the 29th or later. That path exists for a polyfill defect the operation cannot reach: the nudge window only misses its target when the target sits strictly between the window bounds by a sub-day amount, and two `PlainDate`s have no time component, so the bound always lands on a date the window already reaches. Measured over about 1.96 million rows against the raw polyfill, in both directions and across every rounding mode and increment, the two paths never disagreed.
  
  Answers are unchanged. What goes away is exposure: that path carries GMT's own exact-boundary rounding behaviour, and routing ISO through it widened a defect's reach for no corrected result. The workaround stays where the defect is real — `Duration#total`, `Duration#round`, and `until`/`since` with a time component.
- 82380f8: Correct the positional interval documentation's cross-references and tiling notes.
  
  - `intervalSplitAtDate`, `intervalSplitAtDateTime` and `intervalSplitAtTime` named a `divideEqually` function that does not exist. They now name `intervalDivideEquallyDate`, `intervalDivideEquallyDateTime` and `intervalDivideEquallyTime`.
  - `intervalSplitAt*`, `splitIntervalByUnit*` and `intervalDivideEqually*` say that each piece's `end` is the next piece's `start`, so the pieces partition the interval under the half-open rule.
  
  The boundary behaviour of every positional interval function is described in the half-open intervals entry of this release.
- 729e0f1: Return exact answers at Temporal's range limits and for very large or very precise values (Story CORE-8).
  
  **Answers that exist at the edge of the range.** Temporal represents dates from `-271821-04-19` to `+275760-09-13`. Several functions built a boundary they did not need, such as the start of the next year or the 1st of a month before the first date, and returned their sentinel when that boundary fell outside the range. The affected functions were `roundDate`, `roundDateTime`, `bucketRange`, the `splitIntervalByUnit*` functions, `mapDatesInRange`, `mapZonedDatesInRange`, `getWeekOfMonth`, `getWeeksInMonth`, `getWeeksInYear`, `getLocaleWeekYear` and `getWeeksInLocaleWeekYear`. The `intervalCount*` functions also returned `null` at the minimum. Each now builds a boundary only when the answer needs it, and returns the answer.
  
  ```typescript
  import { bucketRange, getWeekOfMonth, intervalCountZoned, roundDate } from "@northguild/gmt";
  
  roundDate("+275760-06-15", { smallestUnit: "year", roundingMode: "floor" }); // "+275760-01-01"
  roundDate("+275760-06-15", { smallestUnit: "year", roundingMode: "ceil" }); // "" — +275761-01-01 is out of range
  getWeekOfMonth("-271821-04-30", "en-US"); // 5
  intervalCountZoned("-271821-04-20T00:00:00+00:00[UTC]", "-271821-04-20T01:00:00+00:00[UTC]", "week"); // 1
  bucketRange("+275760-09-12T23:00:00Z", "+275760-09-13T00:00:00Z", "day", "America/New_York"); // ["+275760-09-12T04:00:00Z"]
  ```
  
  **Equal pieces are equal.** The `intervalDivideEqually*` functions computed boundaries in floating point, so pieces differed by nanoseconds and the last one could end up to 66 microseconds past the range. Boundaries are now exact integer division of the span in nanoseconds, rounded half up.
  
  ```typescript
  import { intervalDivideEquallyUtc } from "@northguild/gmt/utc";
  
  intervalDivideEquallyUtc("2024-01-01T00:00:00Z", "2024-01-01T00:00:01Z", 3).map((piece) => piece.end);
  // ["2024-01-01T00:00:00.333333333Z", "2024-01-01T00:00:00.666666667Z", "2024-01-01T00:00:01Z"]
  ```
  
  **`formatDuration` shows sub-second parts exactly.** It rounded milliseconds, microseconds and nanoseconds to three digits of a second. A duration of one nanosecond printed as `"0 seconds"`, and seconds past 2^53 printed a larger number than the input.
  
  ```typescript
  import { formatDuration, parseDuration } from "@northguild/gmt/duration";
  
  formatDuration("PT0.000000001S", "en-US"); // "0.000000001 seconds"
  formatDuration("PT1.123456789S", "en-US"); // "1.123456789 seconds"
  ```
  
  Compatibility: round the duration to milliseconds first to keep three digits.
  
  ```typescript
  formatDuration(parseDuration("PT1.123456789S", { smallestUnit: "millisecond" }), "en-US"); // "1.123 seconds"
  ```
  
  **Large month spans in non-ISO calendars no longer crash the process.** The polyfill adds and counts non-ISO months one at a time and caches every step. A few million months, which is in range, ran the heap out of memory and aborted the process, and no `try` could catch it. GMT now computes spans of 1,200 months or more in whole years from Temporal's own calendar data. This work-around is inactive for smaller spans, and `pnpm compat` reports when a polyfill release makes it unnecessary.
  
  ```typescript
  import { addDate } from "@northguild/gmt/plain";
  
  addDate("2024-01-15[u-ca=persian]", { months: 3000000 }); // "+252023-12-27[u-ca=persian]"
  ```
  
  **Smaller corrections.**
  
  - `fromFileTime` and `toFileTime` treat a value at or above 2^63 as out of range, as Windows' `FileTimeToSystemTime` does. They used to decode it as a date as far out as the year 60056. Compatibility: `fromNanoseconds((value - 116444736000000000n) * 100n)` decodes the raw unsigned value.
  - `businessDaysBetween` returns `0`, not `-0`.
  - `intervalFromDurationTime` returns `null` for a duration of 24 hours or more, or a negative duration that wraps past midnight, as its docs said. It used to return a span of the wrong length, such as a zero-length span for `"PT24H"`.
  
  ```typescript
  import { fromFileTime, fromNanoseconds } from "@northguild/gmt/precision";
  import { intervalFromDurationTime } from "@northguild/gmt/plain";
  
  fromFileTime(9223372036854775808n); // ""
  fromNanoseconds((18446744073709551615n - 116444736000000000n) * 100n); // "+060056-05-28T05:36:10.9551615Z"
  intervalFromDurationTime("10:00:00", "PT24H", "start"); // null
  ```
- 82380f8: Document the `year`, `month` and `day` patterns, and correct a wrong `fractionalSecond` example.
  
  `year`, `month` and `day` had no JSDoc, so editors showed nothing on hover. They now carry a description and examples like every other pattern in the regex namespace. The `millisecond` alias gains examples too.
  
  The `fractionalSecond` JSDoc said `fractionalSecond.test("0")` returns `false`. It returns `true`, since `"0"` is one digit. The example now shows a 10-digit input, which the pattern does reject.
- 7b585cd: Name the standard behind each roll convention, and correct three wrong JSDoc examples.
  
  `RollConvention`, `rollDate` and `isValidRollConvention` said `modifiedFollowing` with the end-of-month rule was "the common convention for interest-rate instruments", sourced to a vendor daycount page. That sourced a market habit, not the definition. The docs now cite the text that actually governs the conventions: `following`, `modifiedFollowing` and `preceding` are [ISDA 2006 Definitions §4.12(a)(i)–(iii)](https://www.isda.org/book/2006-isda-definitions/), `modifiedPreceding` — which §4.12(a) does not define — is FpML's `BusinessDayConventionEnum` `MODPRECEDING`, and `none` is what [OpenGamma Strata](https://strata.opengamma.io/apidocs/com/opengamma/strata/basics/date/BusinessDayConventions.html) calls `NO_ADJUST`. No TC39, ECMA or RFC standard governs any of them, and the camelCase spelling is GMT's — the standard fixes the behaviour, not the identifier.
  
  `endOfMonth` is now labelled plainly as GMT's own, because it is neither an ISDA convention nor the industry "EOM rule" a reader is likely to assume it is. That rule is a *schedule* rule — hold every date in a schedule to its month's last day once the anchor is one — and `endOfMonth` is the per-date primitive you build it from, by testing the anchor for month-end yourself and applying it to the unadjusted target date.
  
  Three `@example` lines asserted results the functions do not return:
  
  ```ts
  // formatRelativeUtc: the old example had no `reference`, so its output moved with the clock
  formatRelativeUtc("2026-01-15T14:30:45Z", "en-US", { reference: "2026-04-15T14:30:45Z" }); // "3 months ago"
  
  // roundZoned: New York is -04:00 in June, not -05:00, and 12:34:56 rounds down to 12:30
  roundZoned("2024-06-15T12:34:56-04:00[America/New_York]", { smallestUnit: "minute", roundingIncrement: 15 }); // "2024-06-15T12:30:00-04:00[America/New_York]"
  ```
  
  The docs site runs every `@example` live, so a wrong one is visible on the reference page as well as on hover.
- 82380f8: Fix `halfEven` in `roundDate` and `roundDateTime`, which rounded ties the wrong way.
  
  Both functions aliased `halfEven` to `halfExpand` for date units, so an exact tie rounded away from the unit start instead of towards the even multiple of the increment. `roundDate("2024-06-16", { smallestUnit: "month", roundingMode: "halfEven" })` returned `"2024-07-01"`; June 16 is 15 days into a 30-day month, an exact tie, so half-even rounds to `"2024-06-01"`. The same applied to `roundDateTime` on `"year"`, `"month"` and `"week"`.
  
  The rounding grid is anchored at the unit containing the value: that unit's start is multiple 0 and the next start is multiple 1, so the even multiple at a tie is the current start. Values above and below the tie are unaffected, and every other rounding mode is unchanged. Both JSDoc blocks now state the anchor. Time units in `roundDateTime` were already correct — they round through Temporal.
- 729e0f1: Follow Temporal's zoned arithmetic and difference algorithms across DST changes (Story CORE-8).
  
  **`addZoned`, `subtractZoned` and `intervalFromDurationZoned` keep exact time exact.** TC39 Temporal §6.5.5 AddZonedDateTime adds a duration's date part on the wall clock and its time part in exact time. With a `disambiguation` other than `"compatible"`, these functions re-resolved the final wall-clock time. Adding 10 minutes in a repeated hour could then land 50 minutes earlier. `disambiguation` now applies only to the wall-clock time the date part lands on: when a fall-back repeats that time, and when a spring-forward skips it. A date step into a skipped hour used to move forward whatever `disambiguation` said. A time-only duration ignores it.
  
  ```typescript
  import { addZoned, setZoned } from "@northguild/gmt/zoned";
  
  addZoned("2024-11-03T01:30:00-05:00[America/New_York]", { minutes: 10 }, { disambiguation: "earlier" });
  // "2024-11-03T01:40:00-05:00[America/New_York]"
  addZoned("2024-03-09T02:30:00-05:00[America/New_York]", { days: 1 }, { disambiguation: "earlier" });
  // "2024-03-10T01:30:00-05:00[America/New_York]"
  addZoned("2024-03-09T02:30:00-05:00[America/New_York]", { days: 1 }, { disambiguation: "reject" }); // ""
  ```
  
  Compatibility: to get the earlier value, re-resolve the result's wall-clock time with `setZoned`.
  
  ```typescript
  setZoned(addZoned("2024-11-03T01:30:00-05:00[America/New_York]", { minutes: 10 }), { hour: 1, minute: 40, second: 0 }, { disambiguation: "earlier", offset: "ignore" });
  // "2024-11-03T01:40:00-04:00[America/New_York]"
  ```
  
  **`diffZoned`, `diffZonedAsDuration` and `intervalLengthZoned` count calendar units on the wall clock.** They converted both values to UTC first, so a 23-hour local day was 0 days. §6.5.6 DifferenceZonedDateTime measures days, weeks, months and years on the wall clock of the shared time zone. For values in two different zones, a calendar unit has no single wall clock to count on, and Temporal throws. These functions now return their sentinel instead. Hours and smaller units are exact time, as before, and work across zones.
  
  ```typescript
  import { diffZoned, diffZonedAsDuration } from "@northguild/gmt/zoned";
  
  diffZoned("2024-03-09T12:00:00-05:00[America/New_York]", "2024-03-10T12:00:00-04:00[America/New_York]", "days"); // 1
  diffZonedAsDuration("2024-03-09T12:00:00-05:00[America/New_York]", "2024-03-11T12:00:00-04:00[America/New_York]", "days"); // "P2D"
  diffZoned("2024-01-01T00:00:00-05:00[America/New_York]", "2024-01-03T00:00:00+01:00[Europe/Paris]", "days"); // null
  ```
  
  Compatibility: difference the UTC instants to get the UTC-clock value. For `intervalLengthZoned` across two zones, convert both ends to one zone first with `convertZonedToZoned`.
  
  ```typescript
  diffUtc(convertZonedToUtc("2024-03-09T12:00:00-05:00[America/New_York]"), convertZonedToUtc("2024-03-10T12:00:00-04:00[America/New_York]"), "days"); // 0
  diffUtcAsDuration(convertZonedToUtc("2024-03-09T12:00:00-05:00[America/New_York]"), convertZonedToUtc("2024-03-11T12:00:00-04:00[America/New_York]"), "days"); // "P1DT23H"
  ```
  
  **`intervalOverlappingDaysZoned` and `intervalOverlappingDaysUnix` count the local dates an overlap touches.** They took the calendar difference of the overlap's two endpoint dates and added one. A day a zone deleted was counted, like Samoa's 30 December 2011, and a fall-back that sent the clock back into the previous date could give 0. They now count the distinct local dates the overlap touches.
  
  ```typescript
  import { intervalOverlappingDaysUnix } from "@northguild/gmt/unix";
  
  intervalOverlappingDaysUnix(1289098830000, 1289100600000, 1289098830000, 1289100600000, { timeZone: "America/Goose_Bay" }); // 2
  ```
  
  Compatibility: for the earlier number, take the difference of the endpoint dates in the first interval's zone and add one.
  
  ```typescript
  diffDate(convertUnixToPlainDate(1289098830000, { timeZone: "America/Goose_Bay" }), convertUnixToPlainDate(1289100600000, { timeZone: "America/Goose_Bay" }), "days") + 1; // 0
  ```

## 1.15.0

### Minor Changes

- a5dbda2: Promote shared unit types to the public API: `RelativeUnit`, `DurationUnit`, `NowUnit`, `UnixNowUnit`, `UtcNowUnit`, `RelativeDateUnit`, `RelativeTimeUnit`, `RelativeDateTimeUnit`, `ZonedParseUnit`, `PlainNowUnit`, `ZonedOffsetUnit`, and `UnixUnit` are now importable from `@northguild/gmt/types` (and from their domain subpaths via the existing barrel re-exports). Add `@example` import lines and Members tables to all type JSDoc.

### Patch Changes

- 7d0b18c: Add JSDoc to `formatUtc` and `formatUnix`, and to internal helpers `startOrEndOfUtc` and `startOrEndOfUnix`. Replace the six namespace `README.md` files with one-line stubs pointing at the docs site reference section.
- 3dc6edf: Internal type consolidation: extract shared option properties into base types (`CalendarOptions`, `RelativeTimeFormatOptions`, `DateTimeFormatOptions`) to reduce duplication across plain/unix/utc/zoned formatters. Convert all remaining `//` comments in `packages/gmt/src/regex/` to JSDoc style with `@example` blocks, and add missing JSDoc to `time-zone-like.ts` and `unix.ts`.
- a5dbda2: Fix `@example` values and prose in `intervalDifferenceZoned` and `intervalXorZoned` JSDoc: the documented interior boundaries didn't match what the functions actually compute (they're re-derived at ±1 nanosecond from the overlap edges, never copied or rounded to the second). `intervalXorZoned`'s docs also incorrectly claimed full containment returns a single `{ start, end }` — it returns two. Added regression tests asserting the exact boundary strings so this can't drift silently again.
- 0f4bfe9: Slim the AI agent skill bundle: replace 13 verbose consumer skill files with 4 lightweight routing pointers (gmt-basics, gmt-arithmetic, gmt-timezone, gmt-integration) and relocate 5 contributor/maintainer skills under a `contributor/` subdirectory that is excluded from the published npm package. The `files` allowlist in package.json and `.npmignore` now prevent consumer installs from receiving contributor skills or `_artifacts/` build output. No TypeScript source or public API changed — the package dist output is identical.

## 1.14.2

### Patch Changes

- e0b3c6e: Publish packages under the `@northguild` npm org, replacing the retired `@burglekitt` scope.

## 1.14.1

### Patch Changes

- 131087a: Add deprecation notice: this package is moving to `@northguild/gmt` under the [northguild](https://github.com/northguild) GitHub organization. `@northguild/gmt` will receive no further updates after this release.

## 1.14.0

### Minor Changes

- a7858f6: Add a GMT-native calendar-annotated `ZonedDateTime` string and make `zoned/` calendar-aware (Story E7), deliberately restoring — with a grammar, tests and docs — the capability E5's decision D2 removed.

  The new grammar adds a time, a UTC offset and an IANA zone to E1's plain calendar string:

  ```
  <calendar-native-date>T<time><offset>[u-ca=<id>[;era=<era>]][<timeZone>]

  5784-06-15T14:30:00-05:00[u-ca=hebrew][America/New_York]
  0031-04-30T12:00:00+09:00[u-ca=japanese;era=heisei][Asia/Tokyo]
  7517-12-30T00:30:00-04:00[u-ca=ethiopic-amete-alem][America/Santiago]
  ```

  `convertZonedToCalendar(value, calendar)` produces it across all 13 supported calendar systems, keeping the instant, wall time, offset and zone unchanged; `isValidCalendarZonedDateTime` and `isValidCalendarZonedInterval` validate it. `addZoned`, `subtractZoned`, `diffZoned`, `diffZonedAsDuration` and the 17 `zoned/interval/*` functions now accept it alongside bare ISO strings.

  This closes a gap that was categorically impossible to compose around: adding one Hebrew month to a date in `America/New_York` needs calendar-unit arithmetic and DST resolution in the _same_ operation. Doing the calendar step first applies DST to an already-resolved wall time; doing the zoned step first leaves no calendar to step in. `addZoned("5784-06-15T14:30:00-05:00[u-ca=hebrew][America/New_York]", { months: 1 })` now returns `"5784-07-15T14:30:00-04:00[u-ca=hebrew][America/New_York]"` — Adar I to Adar and EST to EDT together, one calendar day away from the ISO answer for the same input. The calendar tag, era, wall time and UTC offset are always re-derived from the arithmetic result, never copied: a Japanese Heisei value crossing 2019-05-01 comes back tagged Reiwa.

  **The `[u-ca=...]` segment precedes `[timeZone]` — the reverse of RFC 9557, deliberately.** GMT's digits are calendar-native (Hebrew year 5784, not ISO year 5784), so the string is never valid RFC 9557 to begin with, and the `;era=` suffix is not valid RFC 9557 at any ordering. The RFC-legal ordering is the dangerous one: `Temporal.ZonedDateTime.from("5784-01-01T14:30:00-05:00[America/New_York][u-ca=hebrew]")` _succeeds_ and silently reads 5784 as an ISO year — a ~3760-year misparse with no error anywhere. GMT's ordering makes that shape uniformly rejected instead.

  **Purely additive — no existing behavior changes.** `isValidZonedDateTime` and `isValidZonedInterval` are deliberately left untouched and still reject every `[u-ca=...]` annotation, so the ~72 `zoned/` functions outside this story's scope (`formatZonedDateTime`, `roundZoned`, `setZoned`, `startOfZoned`, `parseDateFromZoned`, `convertZonedToUtc`, and the rest) continue to return their sentinel for a calendar-annotated value. Loosening them would have made `isValidZonedDateTime(x) === true` while `getZonedYear(x) === null` — a validator certifying strings the library still refuses. `addZonedBusinessDays`/`subtractZonedBusinessDays` also stay out by design: day-of-week is ISO-fixed in every supported calendar, so a tag would change nothing while implying it might.

  Mixed-calendar endpoints follow the split E5 established for `plain/`: ordering functions accept them (ordering is calendar-independent — `Temporal.Instant` has no calendar field at all); the eight value-returning set operations require one shared calendar and return their sentinel on a mismatch; measurement functions (`diffZoned`, `diffZonedAsDuration`, `intervalCountZoned`, `intervalLengthZoned`, `splitIntervalByUnitZoned`) measure in the shared calendar when both tags match and fall back to Gregorian otherwise. That fallback is mandatory rather than merely convenient here: unlike `PlainDate`, `Temporal.ZonedDateTime.prototype.until` throws across mismatched calendars for _every_ unit, including pure time units like hours.

  **Two pre-existing latent bugs fixed along the way.** `addZoned` and `intervalFromDurationZoned` both rebuilt their non-`"compatible"` disambiguation path via `` `${x.toPlainDateTime().toString()}[${x.timeZoneId}]` ``. That was harmless while every input was plain ISO, but a calendared `toPlainDateTime().toString()` emits Temporal's own `[u-ca=...]` annotation, so appending the zone produced the forbidden segment ordering and silently degraded every non-default `disambiguation` to `""`/`null`. Both now round-trip the rebuild through bare ISO and re-attach the calendar to the result; `subtractZoned` had the same shape and was fixed alongside.

  Decisions of record, the reversed `(b→a→b)` audit verdicts, and the unanticipated findings are recorded permanently in `context/roadmap/issues/E.md`'s new "E7 outcome" section. Extending `duration/`'s `relativeTo` to accept the zoned grammar was explicitly left out of scope as a follow-up.

- addaeb9: Add calendar-system foundation: `CalendarSystem` type and `convertDateToCalendar` (Story E1), with Hebrew as the first supported non-Gregorian calendar.

  `convertDateToCalendar(value, calendar)` expresses a PlainDate in a different calendar system, built entirely on Temporal's native calendar support (`PlainDate.prototype.withCalendar`) — no ported leap-year tables or arithmetic, since the polyfill already implements the full Metonic 19-year Hebrew leap-year cycle (7 leap years per cycle, a 13th month inserted before Adar) correctly.

  The output string format deliberately diverges from Temporal's own `[u-ca=...]` annotation convention: Temporal's `toString()` always keeps the ISO/proleptic-Gregorian digits and only tags the calendar, hiding the calendar-native fields behind object accessors GMT's string-only contract has no equivalent for. GMT's annotated string instead carries the calendar's own year/month/day (e.g. `"5785-01-01[u-ca=hebrew]"` for Hebrew year 5785, not the ISO year), so the calendar-system concept is visible directly in the string. A plain, unannotated ISO string is always the `"gregorian"` calendar, so every existing GMT function keeps working unchanged, and `convertDateToCalendar(value, "gregorian")` always returns a bare ISO string.

  New `CalendarSystem` type at `packages/gmt/src/types/calendar-system.ts` (seeded with `"gregorian" | "hebrew"`, extended by E2–E4 as they land), new `plain/convert/` module, and a new `isValidCalendarDate` validator accepting both plain and calendar-annotated PlainDate strings.

- d296372: Extend `duration/` and interval functions to be calendar-system-aware (Story E5), completing the audit-and-fix pass over Story Groups A/B/G's functions promised by E1–E4's calendar-system foundation.

  `addDate`, `subtractDate`, `diffDate`, `diffDateAsDuration`, and the `Date`-suffixed `plain/interval/*` functions (`intervalContainsDate`, `intervalsOverlapDate`, `intervalUnionDate`, `intervalCountDate`, `splitIntervalByUnitDate`, and 13 others) now accept GMT calendar-annotated `PlainDate` strings (e.g. `"5784-06-15[u-ca=hebrew]"`, as produced by `convertDateToCalendar`) in addition to bare ISO strings. Calendar-unit arithmetic ("add 1 month") resolves in the value's own calendar — a Hebrew leap year now correctly reports 13 month boundaries and splits into 13 month-slices, not 12, and adding a month from Hebrew Adar I lands on Adar rather than being rejected as invalid input. Ordering functions (`intervalContains*`, `intervalsOverlap*`, `intervalAbuts*`, `intervalEngulfs*`, `isValidDateInterval`, `intervalOverlappingDaysDate`) accept endpoints in different calendars, since ordering and day-counting are calendar-independent; value-returning set operations (union, intersection, difference, xor, split, divide, merge) require all arguments to share one calendar and return the type's sentinel on a mismatch, since there is no principled way to pick an output calendar for a value the caller reads back as a date.

  **Two behavior changes, not purely additive:**

  - **`zoned/` now rejects any `[u-ca=...]` calendar annotation.** Before this change, `isValidZonedDateTime` and most `zoned/interval/*` functions had no gate against a calendar annotation, so a zoned string carrying one (e.g. `"2024-02-10T12:00:00-05:00[America/New_York][u-ca=hebrew]"`) was silently accepted and produced genuinely calendar-aware — but undocumented and untested — arithmetic. Calendar-system awareness is now confined to `plain/` `PlainDate` values only, for contract coherence with the string format `convertDateToCalendar` established in E1: GMT's own calendar-annotated string uses calendar-native digits, which is a different (and incompatible) convention from the ISO-digit `[u-ca=...]` shape Temporal itself accepts, so a single string could otherwise mean two different dates depending on which function received it. Any caller that was unknowingly relying on this accidental behavior will now get `""`/`false`/`null`/`[]` from the affected function instead. A follow-up story to deliberately support a GMT-shape calendar-annotated zoned string is proposed (not yet filed) in `context/roadmap/issues/E.md`'s E5 section.
  - **`duration/`'s `relativeTo` option now validates a GMT calendar-annotated `PlainDate` string instead of silently misreading it as Temporal's ISO-digit convention.** `durationAs`, `compareDurations`, and `normalizeDuration` previously passed `relativeTo` straight through to `Temporal.Duration`, so `relativeTo: "5784-06-15[u-ca=hebrew]"` (GMT's own documented calendar-annotated output shape) was silently interpreted as ISO year 5784 and produced a wrong-but-plausible number with no error. This is fixed as part of E5 (it predates this story but shares E5's parsing gate); the number these three functions return for a GMT-shape `relativeTo` argument changes for anyone who was passing one before this fix, from a silently wrong answer to the correct one.

  Full per-function audit findings — including the "no change needed, verified why" negatives the story's definition of done requires — are recorded permanently in `context/roadmap/issues/E.md`'s new "E5 outcome" section, alongside the decisions of record this story settled (D1–D10) and a follow-up story candidate (E7) for deliberately extending `zoned/`.

- 71b5b43: Add `cycleDate`, `cycleDateTime`, `cycleTime`, and `cycleZoned` (Story E6), matching
  `@internationalized/date`'s `cycle(field, amount, options)` — the datepicker-segment-editing
  primitive GMT had no equivalent for.

  `cycle*` is not `add*`: it adjusts a single field and **wraps** at that field's own min/max instead
  of carrying into the next larger field. Cycling December's `month` by `+1` stays in the same year
  (`cycleDate("2024-12-15", "month", 1)` → `"2024-01-15"`), where `addDate(value, { months: 1 })`
  correctly overflows into January of the _next_ year — the right answer for arithmetic, but not for
  "pressing Up on a month segment shouldn't silently change the year." No composition of `addDate`
  calls can express this; the wrap boundary is a property of the field itself, not of an amount to add.

  - `cycleDate`/`cycleTime`/`cycleDateTime` cycle a single field of a `PlainDate`/`PlainTime`/
    `PlainDateTime` string. `cycleZoned` does the same for a `ZonedDateTime` string, and additionally
    takes `disambiguation`/`offset` (default `offset: "ignore"`, the same C3 precedent as `setZoned`/
    `startOfZoned`) to resolve any DST gap or overlap the wrapped local time lands on.
  - All four build on Story J1's field setters (`setDate`/`setDateTime`/`setTime`/`setZoned`),
    computing the wrapped target value and delegating to the matching setter for the atomic
    overflow/disambiguation/offset resolution — so cycling `month` or `year` can still clamp (or, with
    `overflow: "reject"`, reject) `day` exactly the way `setDate`'s own `.with()` call does.
  - `options.round` does not round to the nearest increment — it steps to the _next_ multiple of
    `amount` in the direction of its sign (ceiling for positive, floor for negative), matching
    `@internationalized/date`'s `CycleOptions.round` exactly.
  - `cycleTime`'s `overflow` option is accepted for signature consistency but is inert: a cycled time
    field's wrapped value is always already in range, so there's nothing for `setTime`'s `.with()` to
    constrain or reject.
  - No `hourCycle: 12` option — GMT's `hour` field always cycles `0–23`; a 12-hour, AM/PM-preserving
    wrap is a display/formatting concern with no ISO representation to round-trip through GMT's string
    contract.

  Purely additive — no existing function's behavior changes.

- cfdee87: Add era-based solar calendar family: `"japanese"`, `"buddhist"`, `"taiwan"`, `"persian"`, `"indian"` calendar systems (Story E3), extending `CalendarSystem` and `convertDateToCalendar` from E1/E2.

  All five are built entirely on Temporal's native calendar support — no ported leap-year tables or arithmetic. Buddhist and Taiwan are fixed year-offset calendars over the same Gregorian day/month structure; Persian and Indian are distinct solar calendars with their own leap-year rules (Persian: a 33-year cycle; Indian: aligned to the Gregorian leap-year rule rather than an independent cycle), verified against `@internationalized/date`'s corresponding sources rather than assumed to be offset-only.

  `"japanese"` gets a different annotated-string shape than every other calendar: Temporal's `.year` for it stays proleptic across imperial era changes (it does not reset to `1` the way the calendar's own numbering does), so `convertDateToCalendar` tags it with `.eraYear` and an era name instead (`"0006-10-03[u-ca=japanese;era=reiwa]"`, not a plain proleptic year). GMT also does not replicate `@internationalized/date`'s pre-Meiji (before 1868-10-23) restriction — since the conversion is built entirely on Temporal's own calendar support, and Temporal resolves those dates correctly under a synthetic `"japanese"` era, rejecting them would mean adding validation solely to reproduce another library's gap rather than an actual GMT limitation.

- ad034e5: Add Ethiopic calendar family: `"ethiopic"`, `"ethiopic-amete-alem"`, and `"coptic"` calendar systems (Story E4), extending `CalendarSystem` and `convertDateToCalendar` from E1–E3.

  All three share one 13-month structure (12 months of 30 days, plus a short 5/6-day Pagume/Nasie 13th month) but differ in epoch. `"ethiopic"` resets to the Amete Mihret era at its own epoch (~AD 8) and is tagged with `.eraYear`/`;era=<name>` like `"japanese"` (`"2017-01-23[u-ca=ethiopic;era=ethiopic]"`, not a 5-digit proleptic year). `"ethiopic-amete-alem"` is the same calendar counted continuously from a much older epoch (~5493 BCE) with no era reset. `"coptic"` has its own epoch (AD 284, the Diocletian/Martyrs era) and a plain native year.

  Unlike every other calendar `convertDateToCalendar` supports, this family is **not** resolved through Temporal's native `"ethiopic"`/`"coptic"` calendar ids: `@js-temporal/polyfill@0.5.1` resolves those two calendars' year/era via `Intl.DateTimeFormat`-derived era-name matching, and CLDR's era-name output for them changed between the ICU versions bundled with different Node releases — every read or write of Temporal's `"ethiopic"`/`"coptic"` calendar ids throws a `RangeError` under Node 24's ICU (confirmed directly, not a hypothetical; `"ethiopic-amete-alem"`/Temporal's `"ethioaa"` id is unaffected, since it has no era and is resolved with pure arithmetic). GMT routes around this bug rather than inheriting it: month/day are identical across the whole family (they share one annual cycle), so `convertDateToCalendar` reads/writes them through the safe `"ethioaa"` id and computes each calendar's own displayed year (+ era, for `"ethiopic"`) with GMT-owned arithmetic ported from the same epoch/anchor-year constants `@js-temporal/polyfill` itself uses internally (`internal/ethiopicFamilyCalendar.ts`).

- a4285ae: Add Islamic calendar family: `"islamic-civil"`, `"islamic-tabular"`, and `"islamic-umalqura"` calendar systems (Story E2), extending `CalendarSystem` and `convertDateToCalendar` from E1.

  Like Hebrew, all three are built entirely on Temporal's native calendar support — no ported leap-year tables or arithmetic. This includes `"islamic-umalqura"`, the Saudi civil calendar: rather than porting `@internationalized/date`'s bundled Umm al-Qura lookup table into GMT, `convertDateToCalendar` resolves it through the polyfill's own built-in Umm al-Qura implementation, avoiding a second, divergence-prone copy of the same data. The three variants are not interchangeable — civil and tabular use different fixed leap-year cycles (Friday vs. Thursday epoch, one day apart), and Umm al-Qura's tabulated dates diverge from both by more than a fixed offset on some dates, so GMT does not approximate one variant with another's arithmetic.

  Fixed a latent bug this story surfaced: `convertDateToCalendar`'s output annotation used to read a Temporal `PlainDate`'s own `calendarId` directly, which happened to match GMT's calendar identifiers for `"gregorian"`/`"hebrew"` but diverges for `"islamic-tabular"` (Temporal's id is `"islamic-tbla"`). The annotation now always maps back through GMT's own `CalendarSystem` identifiers, so `convertDateToCalendar(value, "islamic-tabular")` reliably returns `[u-ca=islamic-tabular]`, not `[u-ca=islamic-tbla]`.

## 1.13.0

### Minor Changes

- 9d341ce: Add calendar quantity getters: `getDaysInMonth`, `getDaysInYear`, `getDayOfYear`, `getWeeksInYear`, `getWeeksInMonth`, `getWeekOfMonth` (Story J3).

  All six take a `PlainDate` ISO string and return `number | null`. `getDaysInMonth`, `getDaysInYear`, and `getDayOfYear` wrap Temporal's own `daysInMonth`/`daysInYear`/`dayOfYear`. `getWeeksInYear` reports the ISO week-numbering year's total week count (52 or 53), resolved from `value`'s own `yearOfWeek` rather than its calendar year, since late-December/early-January dates can belong to a different ISO week-year than their calendar year.

  `getWeeksInMonth` and `getWeekOfMonth` are locale-aware — they size and index a month's calendar-grid rows using `locale`'s first day of week, matching date-fns's `getWeekOfMonth` convention (the row containing the 1st of the month counts as row 1, even when partial). They live in `plain/calculate/`, not `plain/get/`, per the rule J0b established: `get/` namespaces are current-moment accessors only, and these take a date value.

- 6d9ed5e: Add duration introspection and comparison: `getDurationUnit`, `durationAs`, `negateDuration`, `absDuration`, `compareDurations`, `getDurationSign` (Story J8).

  `getDurationUnit` reads a single component as stored (`getDurationUnit("PT90M", "hours")` is `0` — the minutes field holds 90, not a converted total); `durationAs` totals the whole duration into one unit instead (`durationAs("PT90M", "hours")` is `1.5`). `negateDuration`/`absDuration` flip or drop the sign; `getDurationSign` reports `-1`/`0`/`1`. New `duration/compare/` module holds `compareDurations`, wrapping `Temporal.Duration.compare`.

  `durationAs` and `compareDurations` follow the `relativeTo` pattern already documented for `normalizeDuration` (A3): any calendar unit (years/months/weeks) on either side requires `relativeTo`, returning the sentinel (`null`) without it — this applies even when the _requested_ unit is the only calendar-shaped one, e.g. `durationAs("PT36H", "weeks")` is `null`. Worth noting the asymmetry with `addDuration`/`subtractDuration` (A2): `Temporal.Duration.compare` **does** accept `relativeTo`, so `compareDurations` can order calendar-unit durations in cases `addDuration` cannot combine. `negateDuration`, `absDuration`, and `getDurationSign` are pure sign operations and never need `relativeTo`, even on calendar-unit durations.

  Updated `packages/gmt/README.md`, `packages/gmt/src/duration/README.md`, and the `durations` skill (new Core Patterns plus two Common Mistakes entries extending the existing `relativeTo` guidance).

- 3eae84e: Add field setters: `setDate`, `setDateTime`, `setTime`, `setZoned`, `setUnix`, `setUtc` (Story J1).

  Each takes a partial fields object and wraps `Temporal.*.prototype.with()`, resolving every supplied field in a single atomic overflow pass — the safe alternative to composing `add*` calls field-by-field, which resolves each field's overflow independently and can silently diverge on multi-field updates (e.g. setting month-then-day vs. day-then-month on the same target).

  All six take `overflow` ("constrain" (default) | "reject"). `setZoned`, `setUnix`, and `setUtc` additionally take `disambiguation` and `offset` (default `"ignore"`, same rule as the `startOfZoned` family — see `docs/dst-disambiguation.md`) for DST gap/overlap control; `setUtc`'s `disambiguation`/`offset` are accepted for signature consistency but are permanently inert, since `"UTC"` has no DST transitions.

  An empty fields object is a no-op on all six.

- f948e85: Add `formatCalendar`, `formatCalendarZoned`, `formatCalendarUnix`, `formatCalendarUtc` (Story J15) — Story Group J complete.

  Moment's `.calendar()`: a relative day label plus time-of-day, e.g. `"Tomorrow at 2:30 PM"`. This is distinct from the existing `formatRelative*` family, which renders an elapsed-time phrase ("in 1 day") and never includes a clock time — Group I's notes over-generalized Luxon's `toRelativeCalendar` parity claim to Moment's `.calendar()`, which this story corrects.

  Within `±6` days of `reference` (default "now"), renders `<day label> <connector> <time>` — "today"/"tomorrow"/"yesterday" near the boundary, "in N days"/"N days ago" further out, via `Intl.RelativeTimeFormat`. Beyond that, falls back to an absolute `dateStyle: "long"` + `timeStyle` string with no relative wording, matching Moment's `sameElse` behavior.

  The day label and time are joined using the **locale's own connector** — read from `Intl.DateTimeFormat`'s combined `dateStyle` + `timeStyle` part sequence for the same instant, never a hardcoded `"at"`. This is the go/no-go decision the story required before implementation: a verified `Intl`-only route with no hardcoded English, covering all 17 `MustTestLocales` including a locale (ru-RU) whose combined date+time pattern fuses a date-side suffix onto the connector literal, which the new `internal/joinDateTimeConnector.ts` helper detects and strips.

  `timeStyle: "full"` is available on the zoned/unix/utc variants (a real IANA zone) but not on plain `formatCalendar` — a plain value has no real timezone, so `"full"`'s `timeZoneName` would misrepresent the internal UTC anchor as a fact about the input.

  Updated `packages/gmt/README.md`, `plain/README.md`, `zoned/README.md`, `unix/README.md`, `utc/README.md`, and the `format-date-time` skill (new Core Pattern + a Common Mistakes entry distinguishing `formatCalendar` from `formatRelativeDateTime`).

- c14db2a: Add `formatDateToParts`, `formatDateTimeToParts`, `formatZonedToParts` (Story J12).

  Each returns the locale-ordered `Array<{ type, value }>` parts behind `formatDate`/`formatDateTime`/`formatZonedDateTime`'s finished strings, mirroring those functions' `(value, locale?, options?)` signature exactly. `formatZonedToParts` also emits `timeZoneName` parts when `options.timeZoneName` is set. All three return `[]` on invalid input.

  This is GMT's sanctioned substitute for a token formatter (Luxon `toFormat`, date-fns `format`), which remains deliberately excluded (roadmap Decision 1): a token pattern like `"MM/dd/yyyy"` hard-codes US field order and ships it to every locale. `formatToParts` gives the caller full control over presentation while the locale keeps control of field order — iterate the returned array instead of reassembling parts in a fixed order.

- 7ff6484: Add interval length and partitioning: `intervalLength*`, `intervalDivideEqually*`, `intervalSplitAt*`, `mergeIntervals*`, `intervalXorAll*` across `Date`/`DateTime`/`Time`/`Zoned`/`Unix`/`Utc` (Story J9).

  `intervalLength*` is `intervalCount*`'s exact-duration counterpart — it answers "how long is this interval" as a real, possibly fractional number via `Temporal.Duration.prototype.total`, rather than "how many `unit` boundaries does it touch". The same interval from `23:59` to `00:01` is `2` day boundaries via `intervalCountDateTime` but `~0.0014` days via `intervalLengthDateTime`. Zoned/Unix/Utc variants are DST-aware the same way `intervalCount*` is.

  `intervalDivideEqually*` splits an interval into `n` equal-length sub-intervals; `intervalSplitAt*` splits at arbitrary (unsorted, out-of-range-safe) points instead of by count. `PlainDate` rounds internal boundaries to the nearest whole day since it has no fractional-day representation; every other variant is exact, computed from total elapsed nanoseconds — `intervalDivideEquallyZoned` splits DST-crossing intervals by real elapsed time, not local clock time.

  `mergeIntervals*` and `intervalXorAll*` are the list-form generalizations of the existing pairwise `intervalUnion*` (B5) and `intervalXor*` (B7) — each takes a single array of `{ start, end }` records instead of two flat intervals. `intervalXorAll*` is implemented as a coverage sweep and reduces to the pairwise `intervalXor*` result for exactly two intervals.

  Updated `packages/gmt/README.md`, all four namespace READMEs (`plain`/`zoned`/`unix`/`utc`), and the `interval-ops` skill (new Core Patterns plus two Common Mistakes entries, including the required `intervalLength` vs `intervalCount` distinction).

- 7b391a4: Add named machine-format format/parse pairs: `formatRfc2822`/`parseRfc2822` (zoned), `formatHttp`/`parseHttp` (utc), `formatSql`/`parseSql` (plain), `formatRfc3339`/`parseRfc3339` (zoned) (Story J13).

  These are **fixed, non-locale-adaptive grammars** — RFC 5322 and RFC 7231 mandate English weekday/month abbreviations regardless of locale, by specification — so none of the eight take a `locale` argument, unlike GMT's `Intl`-backed formatters. `""` on invalid input for every function.

  - `formatRfc2822`/`parseRfc2822` — RFC 5322 (RFC 2822) email `Date:` header format, e.g. `"Fri, 15 Mar 2024 14:30:00 -0400"`. Parsing accepts a 1- or 2-digit day and RFC 5322's obsolete named zones (`GMT`, `UT`, and the eight North American zones); formatting always emits a zero-padded, numeric offset.
  - `formatHttp`/`parseHttp` — RFC 7231 IMF-fixdate, e.g. `"Fri, 15 Mar 2024 14:30:00 GMT"`, for `Last-Modified`/`Date`/`Expires` headers. Strict 2-digit fields and a literal `GMT` only; the obsolete RFC 850/asctime HTTP-date forms are a documented limitation, not accepted.
  - `formatSql`/`parseSql` — ANSI SQL / ODBC datetime literal, e.g. `"2024-03-15 14:30:00"`, for `DATETIME`/`TIMESTAMP` columns without a time zone. SQL's offset-carrying `TIMESTAMPTZ` literal is out of scope.
  - `formatRfc3339`/`parseRfc3339` — strict RFC 3339. This is _not_ a passthrough on GMT's existing ISO output: GMT's own zoned strings always carry a bracketed IANA zone annotation (`...+00:00[UTC]`) that RFC 3339 does not permit, so `formatRfc3339` strips it. A parallel `utc`/`unix` wrapper was deliberately not added — `Temporal.Instant.prototype.toString()` is already fully RFC 3339 compliant with no bracket to strip, so a wrapper there would be a pure passthrough.

- e9e8649: Add now-relative predicates: `isRelativeDay`, `isThisUnit`, `isPast`, `isFuture`, and their zoned counterparts `isZonedRelativeDay`, `isZonedThisUnit`, `isZonedPast`, `isZonedFuture` (Story J6).

  `isRelativeDay(value, offsetDays)` subsumes `isToday`/`isYesterday`/`isTomorrow` (`offsetDays: 0`/`-1`/`1`, or any other integer offset); `isThisUnit(value, unit, locale?)` subsumes `isThisWeek`/`isThisMonth`/`isThisYear`. Per Decision 5 in `context/roadmap/issues/J.md`, GMT ships one parameterized function per axis rather than date-fns's eleven near-duplicate named functions. `isPast`/`isFuture` stay separate — genuinely distinct before/after-now predicates, not one more value on an enumerable axis.

  The plain functions compare against `getToday()` and so depend on the **system clock and system timeZone** — the same call can return a different answer on hosts in different timeZones at the same instant. The zoned variants resolve "today"/"now" in the value's own timeZone instead, making them deterministic regardless of the host machine's timeZone; `isZonedPast`/`isZonedFuture` additionally compare the exact instant rather than just the calendar day, since a `ZonedDateTime` carries a full time-of-day where a `PlainDate` does not.

- 9170eb1: Add offset and DST-instant accessors: `getZonedOffset`, `getZonedOffsetAs`, `getTimeZoneOffset`, `formatTimeZoneName`, `isInDaylightSaving` (Story J10).

  GMT could construct and manipulate zoned values but couldn't report their UTC offset — `getZonedOffset(value)` returns it as a `±HH:MM` string; `getZonedOffsetAs(value, unit)` reads it as a number in `"minutes"` or `"nanoseconds"` (following J8's `getDurationUnit(value, unit)` precedent, replacing what would otherwise be a `getZonedOffsetMinutes`/`getZonedOffsetNanoseconds` pair). `getTimeZoneOffset(timeZone, instant)` looks up a zone's offset at an arbitrary instant without needing an existing zoned value in hand. `formatTimeZoneName(timeZone, locale, options?)` returns a zone's localized display name across all six `Intl.DateTimeFormatOptions` `timeZoneName` styles.

  `isInDaylightSaving(value)` is the third DST-related function in the roadmap and answers a distinct question from the other two: `hasDaylightSaving(timeZone)` asks whether a zone observes DST _at all_ (zone-level, no instant), `getDstTransitions(timeZone, year)` asks _where_ a zone's transitions fall (enumerates instants), and `isInDaylightSaving(value)` asks whether _this particular instant_ is currently in DST. `docs/dst-disambiguation.md` now documents all four (including `disambiguation`/`offset`, the orthogonal construction-time concern) as one table.

  Both `getZonedOffset`/`getZonedOffsetAs` live in `zoned/parse/`, not `zoned/get/` — per J0b's rule, they take a date _value_ rather than reporting on _now_ or a bare timezone. `getTimeZoneOffset` stays in `zoned/get/` alongside `getDstTransitions`, since neither argument is a value being described, both are coordinates for a zone-level lookup.

  Updated `packages/gmt/README.md`, `packages/gmt/src/zoned/README.md`, `docs/dst-disambiguation.md`, and the `zoned-date-ops` skill.

- cbc8384: Add plain range formatting: `formatDateRange`, `formatDateTimeRange` (Story J14).

  Plain counterparts of the existing `zoned/format/formatZonedRange` — same `(start, end, locale?, options?)` parameter order and `Intl.DateTimeFormatOptions` shape, but wrapping `Temporal.PlainDate`/`Temporal.PlainDateTime` directly since there's no timezone to reconcile between endpoints. Both use `Intl.DateTimeFormat.prototype.formatRange` under the hood, so the locale elides shared fields between `start` and `end` (`"February 3 – 5, 2024"` for same-month, `"November 3, 2024 – February 10, 2025"` once the year differs) instead of the caller having to format both ends and join them by hand. Returns `""` when either endpoint is invalid; a reversed range (`end` before `start`) still formats rather than throwing or auto-correcting.

  Updated `packages/gmt/README.md`, `packages/gmt/src/plain/README.md`, and the `format-date-time` skill.

- bffb00c: Add same-unit comparison: `areDatesEqualBy`, `areDateTimesEqualBy`, `areZonedEqualBy`, `areUnixEqualBy`, `areUtcEqualBy` (Story J5).

  Each function answers "are these two values equal at a given calendar unit?" — `areDatesEqualBy(a, b, "month")` replaces the pattern of manually truncating both values before comparing. Per Decision 5 in `context/roadmap/issues/J.md`, GMT ships one parameterized function per namespace rather than date-fns's twelve `isSameX` functions; each function's JSDoc carries the full date-fns mapping table.

  **Semantics, decided explicitly:** equality is measured by comparing the start-of-unit boundary for each value, so a unit implicitly requires every coarser unit above it to match too — `areDatesEqualBy("2023-03-15", "2024-03-15", "month")` is `false`, not `true`, because "same month" means the same month _and_ year. This matches date-fns's `isSameMonth`/`isSameWeek`/etc. and Luxon's `dt.hasSame(other, unit)` (verified against date-fns's source), not a bare "same month-of-year across any year" comparison.

  `areZonedEqualBy` compares each value's own local calendar fields in its own time zone, not the underlying instant or time zone identifier — two zoned values representing the same instant can land on different local calendar days depending on their zone, and vice versa.

- 8663839: Add token-pattern-based parsing: `parseDateWithPattern`, `parseDateTimeWithPattern`, `parseTimeWithPattern` (Story J11).

  Each decodes a string against a caller-supplied token pattern (e.g. `"MM/dd/yyyy"`, `"dd-MMM-yyyy h:mm a"`) and returns the matching ISO `PlainDate`/`PlainDateTime`/`PlainTime` string, or `""` on no match, a malformed pattern, or a shape-valid-but-not-real date/time (`"02/31/2024"` against `"MM/dd/yyyy"` still fails — the regex only proves shape, `Temporal.*.from(..., { overflow: "reject" })` proves it's real).

  This is a decoding tool for a _known, fixed_ producer format — a CSV column, a legacy API field, a partially-typed form value — not a display formatter. GMT still has no token-pattern _formatter_: hard-coding a field order like `"MM/dd/yyyy"` for output would ship US field ordering to every locale (roadmap Decision 1). Use `formatDate`/`formatDateTime`/`formatDateToParts` for locale-correct display; use these new functions only to consume input whose shape you don't control.

  Supports numeric tokens (`yyyy`/`yy`/`MM`/`M`/`dd`/`d`/`HH`/`H`/`hh`/`h`/`mm`/`m`/`ss`/`s`/`SSS`), locale-aware name tokens (`MMMM`/`MMM`/`EEEE`/`EEE`/`a`/`GGGG`/`GG`, defaulting to `"en-US"` when `locale` is omitted), and literal text via automatic literal characters or `'single quotes'`. `parseDateWithPattern`/`parseTimeWithPattern` each reject the other's tokens (returning `""`); `parseDateTimeWithPattern` accepts the full combined set.

- 77e9c80: Add week-numbering year getters: `getWeekYear`, `getLocaleWeekYear`, `getWeeksInLocaleWeekYear` (Story J4).

  `getWeekYear` reports the ISO 8601 week-numbering year a date belongs to (via `Temporal.PlainDate.yearOfWeek`), which can differ from the calendar year — 2024-12-30 is a Monday in ISO week 1 of **2025**, not 2024. Pair it with the existing `weekOfYearForDate`/`getWeekNumber` whenever bucketing by week number, since a week number alone is ambiguous across a year boundary.

  `getLocaleWeekYear` and `getWeeksInLocaleWeekYear` are the locale-relative equivalents, resolved from `locale`'s first day of week and minimal-days-in-first-week (`Intl.Locale.prototype.weekInfo`) instead of the fixed ISO rule (Monday-start, 4 minimal days). The two can disagree on the same date near a year boundary — e.g. en-US always counts Jan 1 as week 1, while ISO-style locales do not.

  All three take a `PlainDate` ISO string and return `number | null`. They live in `plain/calculate/`, not `plain/get/`, per the rule J0b established.

- 511f2de: Add weekday navigation: `nextWeekday`, `previousWeekday` (Story J7).

  Each function finds the next/previous occurrence of a given ISO day of week (1 = Monday … 7 = Sunday, matching `getDayOfWeek`/`parseDayOfWeekFromDate`) on or after/before a date. Per Decision 5 in `context/roadmap/issues/J.md`, GMT ships two parameterized functions rather than date-fns's sixteen `nextMonday`…`previousSunday` functions; each function's JSDoc carries the full date-fns mapping table.

  **`options.inclusive`** (default `false`) controls what happens when the input already falls on the target day: `false` advances/retreats a full week, matching date-fns's behavior; `true` returns the input as-is. This default is easy to get surprised by — `nextWeekday("2024-03-15", 5)` on a date that _is_ already a Friday returns the following Friday, not the input — so it's called out explicitly in both functions' JSDoc and the `compare-dates` skill's Common Mistakes.

  date-fns's `lastDayOfMonth` is not a gap this pair fills — it's already covered by GMT's existing `endOfDate(value, "month")`.

- 3ecb5a9: Move `getLocaleDayOfWeek`, `getLocaleZonedDayOfWeek`, and `getHoursInZonedDay` from the `get/` namespace to `calculate/` (Story J0b):

  - `plain/get/getLocaleDayOfWeek.ts` → `plain/calculate/getLocaleDayOfWeek.ts`
  - `zoned/get/getLocaleZonedDayOfWeek.ts` → `zoned/calculate/getLocaleZonedDayOfWeek.ts`
  - `zoned/get/getHoursInZonedDay.ts` → `zoned/calculate/getHoursInZonedDay.ts`

  `get/` namespaces are now current-moment accessors only (no argument, or timezone only, reporting a value for _now_); any function taking a date value belongs in `calculate/`. Function names, signatures, and behavior are unchanged.

  **Technically breaking for deep-subpath consumers.** Root imports (`from "@northguild/gmt"`) are unaffected. But anyone importing from `@northguild/gmt/plain/get` or `@northguild/gmt/zoned/get` loses these symbols — switch those imports to `@northguild/gmt/plain/calculate` and `@northguild/gmt/zoned/calculate` respectively.

## 1.12.0

### Minor Changes

- 7d45b85: Add `intervalOverlappingDays*` — the number of distinct calendar days two intervals share (Story I1):

  - `intervalOverlappingDaysDate`, `intervalOverlappingDaysDateTime`, `intervalOverlappingDaysZoned`, `intervalOverlappingDaysUnix`, `intervalOverlappingDaysUtc`

  Returns `0` when the intervals are disjoint and `null` on invalid input. Counting is inclusive of both endpoints, matching GMT's closed-interval model: `["2024-01-01", "2024-01-01"]` overlapping itself is `1` day, not `0`. This differs from date-fns's `getOverlappingDaysInIntervals`, which rounds up elapsed 24-hour periods instead — compose `intervalCount*` over `intervalIntersection*`'s result for that behavior. There is no `Time` variant: `PlainTime` has no calendar.

- a0de5fb: Add `roundingMethod` option to the `formatRelative*` family (Story I2):

  - `formatRelativeDate`, `formatRelativeDateTime`, `formatRelativeTime`, `formatRelativeZoned`, `formatRelativeUnix`, `formatRelativeUtc`

  `roundingMethod?: "floor" | "ceil" | "round"` controls how the computed distance rounds to the display unit — applied to the signed fractional value, matching date-fns's `formatDistanceStrict`. Defaults to `"round"`, matching existing behavior; no call-signature changes.

- e4d5344: Add `getDstTransitions` — enumerate daylight-saving-time transition points for an IANA timezone in a given year (Story I3):

  - `getDstTransitions`

  Returns an array of `{ instant, offsetBefore, offsetAfter }` objects representing each DST transition. Returns `[]` for zones with no transitions in the requested year or on invalid input.

- 5988a93: Add `getHoursInZonedDay` — the number of hours in a specific zoned calendar day (Story I4):

  - `getHoursInZonedDay(value: string): number | null`

  Returns `23` on spring-forward days, `25` on fall-back days, and `24` on normal days — or a fractional value for zones whose DST shift isn't a whole hour (e.g. `Australia/Lord_Howe`'s 30-minute shift returns `23.5`/`24.5`). Zoned-only — this is meaningless without a timezone. Returns `null` on invalid input per GMT's number-return sentinel convention.

## 1.11.0

### Minor Changes

- a9a7c17: Add standalone, locale-aware calendar-name lookups (Story H1):

  - `getLocaleMonthNames(locale, style?)` — 12 Gregorian month names in calendar order
  - `getLocaleWeekdayNames(locale, style?)` — 7 weekday names in the locale's first-day order
  - `getLocaleMeridiems(locale)` — `[AM-label, PM-label]` day-period labels

  These are the GMT equivalents of Luxon's `Info.months` / `weekdays` / `meridiems`: they return locale-formatted calendar names without requiring a date value. All three delegate to the host runtime's `Intl` data and return `[]` for an invalid BCP 47 locale tag. `getLocaleWeekdayNames` uses locale-first-day ordering to stay consistent with `getLocaleDayOfWeek`.

- 51c3f12: Add standalone, locale-aware Gregorian era-name lookup (Story H2):

  - `getLocaleEraNames(locale, style?)` — 2-element `[BCE-label, CE-label]` array

  This is the GMT equivalent of Luxon's `Info.eras`: it returns locale-formatted era names without requiring a date value, delegating to the host runtime's `Intl` data. Returns `[]` for an invalid BCP 47 locale tag. If a locale has no distinct BCE/CE era names, both array elements contain the same string — the sentinel is reserved for invalid input only.

- d2be1e3: Add `hasDaylightSaving` — reports whether an IANA timezone observes daylight saving time at all. Returns `false` on invalid or unresolvable timezone identifiers.

## 1.10.0

### Minor Changes

- 816261a: Add `intervalCount`: `intervalCountDate`, `intervalCountTime`, `intervalCountDateTime`, `intervalCountUtc`, `intervalCountUnix`, `intervalCountZoned` — count how many calendar-unit boundaries the half-open interval `[start, end)` crosses, distinct from `diff*`'s exact elapsed duration. An interval from 23:59 to 00:01 is two minutes long but crosses two day boundaries. DST-aware for zoned and unix values, and `null` on invalid input.
- 942aafb: Add `intervalFromDuration`: `intervalFromDurationDate`, `intervalFromDurationDateTime`, `intervalFromDurationTime`, `intervalFromDurationUtc`, `intervalFromDurationUnix`, `intervalFromDurationZoned` — construct an interval from a single point plus an ISO 8601 duration, anchored at either `"start"` or `"end"` (Luxon's `Interval.after`/`Interval.before` as one function with an `anchor` param). Calendar units resolve against the point itself, no `relativeTo` needed — except `intervalFromDurationTime`, which returns `null` for a duration with a date-unit component, since `PlainTime` has no calendar to resolve it against. Returns `null` on invalid input, including a negative duration that inverts the computed span.

## 1.9.0

### Minor Changes

- 2f467df: Add `intervalContainsDate`, `intervalContainsTime`, `intervalContainsDateTime`
  (plain), `intervalContainsUtc` (utc), `intervalContainsUnix` (unix), and
  `intervalContainsZoned` (zoned) — interval containment checks. Each supports
  two modes via an optional fourth argument:

  - 3-arg: `intervalContains(start, end, point)` — true when `start <= point <= end`
  - 4-arg: `intervalContains(start, end, innerStart, innerEnd)` — true when the
    inner interval is fully contained within the outer interval

- 49aecc4: Add `intervalIntersectionDate`, `intervalIntersectionTime`, `intervalIntersectionDateTime`
  (plain), `intervalIntersectionUtc` (utc), `intervalIntersectionUnix` (unix), and
  `intervalIntersectionZoned` (zoned) — interval intersection. Each accepts two
  intervals and returns the overlapping span, or `null` when they do not overlap:

  - Adjacent intervals (e.g. `aEnd === bStart`) share one instant and DO overlap,
    returning a single-point span.
  - Returns `null` when intervals are disjoint with a gap, or when either interval
    is invalid (`start > end`).
  - Returns `null` on malformed input (never throws).
  - Return shape: `{ start: string; end: string } | null` (or `{ start: number;
end: number } | null` for Unix).

- 9f702f6: Add `intervalsOverlapDate`, `intervalsOverlapTime`, `intervalsOverlapDateTime`
  (plain), `intervalsOverlapUtc` (utc), `intervalsOverlapUnix` (unix), and
  `intervalsOverlapZoned` (zoned) — interval overlap detection. Each accepts two
  intervals and returns `true` when they share at least one instant:

  - Adjacent intervals (e.g. `aEnd === bStart`) are treated as overlapping because
    they share the boundary instant.
  - Returns `false` when intervals are disjoint with a gap, or when either interval
    is invalid (`start > end`).
  - Returns `false` on malformed input (never throws).

- 5681f6d: Adds `intervalUnionDate`, `intervalUnionTime`, `intervalUnionDateTime` (plain), `intervalUnionUtc` (utc), `intervalUnionUnix` (unix), and `intervalUnionZoned` (zoned) — merge two intervals into their combined span when they overlap or are directly adjacent.

  - Overlapping or adjacent intervals return `{ start, end }` with the merged span. Adjacent intervals (e.g. `aEnd === bStart`) share one instant and ARE merged.
  - Returns `null` when intervals are disjoint with a gap, when either interval is invalid (`start > end`), or on malformed input (never throws).
  - Return shape: `{ start: string; end: string } | null` for plain/utc/zoned; `{ start: number; end: number } | null` for Unix.

- afb1c0a: Add interval and range validators across plain, utc, unix, and zoned namespaces.

  - `isValidDateInterval`, `isValidTimeInterval`, `isValidDateTimeInterval` (plain) — positional `(start, end)` args returning `true` when both parse and `start <= end`.
  - `isValidUtcInterval`, `isValidUnixInterval`, `isValidZonedInterval` (utc, unix, zoned) — same pattern, comparing by instant for utc/zoned.
  - `isValidDateTimeRange`, `isValidTimeRange` (plain), `isValidUtcRange`, `isValidUnixRange`, `isValidZonedRange` (utc, unix, zoned) — object-param `{ value1, value2 }` shape matching the existing `isValidDateRange` convention.

  All functions return `false` on invalid input (never throw).

- 6dbb941: Add `splitIntervalByUnit*` functions across plain, utc, unix, and zoned namespaces.

  - `splitIntervalByUnitDate`, `splitIntervalByUnitTime`, `splitIntervalByUnitDateTime` (plain) — split an interval into sub-intervals of `amount × unit`, returning an array of `{ start, end }` records.
  - `splitIntervalByUnitUtc`, `splitIntervalByUnitUnix`, `splitIntervalByUnitZoned` (utc, unix, zoned) — same pattern adapted to each Temporal environment.

  All functions return `[]` on invalid input (never throw). The final sub-interval is trimmed so its `end` never exceeds the original `end`.

- e130f96: Add interval set operations: `intervalDifference`, `intervalXor`, `intervalAbuts`, `intervalEngulfs` across plain, zoned, unix, and utc namespaces.

## 1.8.0

### Minor Changes

- 1785dd9: Add `addBusinessDays` and `subtractBusinessDays` for Mon–Fri business-day arithmetic that skips weekends. Also includes `addZonedBusinessDays` and `subtractZonedBusinessDays` for timezone-aware variants.
- f9db169: Add `clampDate`, `closestDateTo`, `clampZoned`, and `closestZonedTo` for range restriction and nearest-candidate selection in both plain and zoned date spaces.
- 63be628: Add `isBusinessDay` for fixed ISO Monday–Friday business-day checks (locale-agnostic, returns false on invalid input). Also includes `isZonedBusinessDay` for timezone-aware variants.
- 574f6f0: Add `roundTime`, `roundDateTime`, `roundDate`, `roundZoned`, `roundUnix`, and `roundUtc` for rounding time-of-day, datetime, date, zoned datetime, Unix timestamp, and UTC instant values to the nearest multiple of a unit.

### Patch Changes

- 574f6f0: Expand CI timezone matrix to 10 zones covering global offsets and edge cases, and drop Node 20 (EOL April 2026) from the test matrix.

## 1.7.0

### Minor Changes

- 54d238e: Adds `isWeekend` (plain) and `isZonedWeekend` (zoned) — locale-aware weekend checks, matching react-aria's `@internationalized/date` `isWeekend(date, locale)`.

  - `isWeekend(value, locale)` checks an ISO `PlainDate` string; `isZonedWeekend(value, locale)` checks an ISO `ZonedDateTime` string against its own local calendar day.
  - Uses `Intl.Locale.prototype.weekInfo` to resolve which days count as the weekend for a given locale — e.g. `en-US`/most locales use Saturday/Sunday, while `he-IL`/`ar-SA` use Friday/Saturday.
  - Falls back to Saturday/Sunday if the runtime can't resolve `weekInfo` data for the locale.
  - Both return `false` for invalid input (unparseable date/zoned value, or an invalid locale tag).

  This starts Story Group D (locale-aware calendar helpers) of the Luxon/react-aria parity roadmap.

- 002deea: Adds `getLocaleDayOfWeek` (plain) and `getLocaleZonedDayOfWeek` (zoned) — locale-aware day-of-week index extraction.

  - `getLocaleDayOfWeek(value, locale)` returns a 0-based index where `0` = the locale's first day of week (e.g. Sunday for en-US, Monday for fr-FR, Saturday for he-IL).
  - `getLocaleZonedDayOfWeek(value, locale)` does the same for zoned ISO datetimes, reading the local calendar day.
  - Both derive the locale's first day from `Intl.Locale.prototype.weekInfo` and fall back to Monday if unavailable.
  - Both return `null` for invalid input (unparseable date/zoned value, or an invalid locale tag).
  - The formula `(isoDay - firstDay + 7) % 7` is the same one used by `getLocaleStartOfWeek`/`getLocaleZonedStartOfWeek`.

  Completes Story Group D (locale-aware calendar helpers) of the Luxon/react-aria parity roadmap.

- 317a1b8: Adds `getLocaleStartOfWeek`/`getLocaleEndOfWeek` (plain) and `getLocaleZonedStartOfWeek`/`getLocaleZonedEndOfWeek` (zoned) — locale-aware week boundaries, matching react-aria's `@internationalized/date` `startOfWeek(date, locale)`/`endOfWeek(date, locale)`.

  - Derives the week's first day from the locale via `Intl.Locale.prototype.weekInfo` (e.g. `en-US` weeks start Sunday, `fr-FR` weeks start Monday), instead of the existing `startOfDate`/`endOfDate`/`startOfZoned`/`endOfZoned`'s explicit, ISO-biased `weekStartsOn` option.
  - Falls back to Monday if the runtime can't resolve `weekInfo` data for the locale.
  - The zoned variants accept the same `disambiguation`/`offset` options as `startOfZoned`/`endOfZoned`, controlling DST gap/overlap resolution when the week-boundary time-of-day reset lands on an ambiguous local time.
  - All four return `""` for invalid input (unparseable date/zoned value, or an invalid locale tag).

  Part of Story Group D (locale-aware calendar helpers) of the Luxon/react-aria parity roadmap.

## 1.6.0

### Minor Changes

- b7a9440: Adds `diffDateAsDuration`, `diffDateTimeAsDuration`, `diffZonedAsDuration`, `diffUnixAsDuration`, and `diffUtcAsDuration` — sibling functions to the existing `diffDate`/`diffDateTime`/`diffZoned`/`diffUnix`/`diffUtc`, bridging to the `duration` namespace by returning an ISO 8601 duration string (e.g. `"P1DT2H"`) instead of a single-unit number.

  - Each takes a single `unit` (not an array like its counterpart) to set the duration's `largestUnit` — an ISO duration string already expresses a full multi-unit breakdown via `largestUnit` alone.
  - Accepts the same `smallestUnit`/`roundingIncrement`/`roundingMode` rounding options as its counterpart (controlling the underlying difference), plus new `toStringSmallestUnit`/`fractionalSecondDigits`/`toStringRoundingMode` options controlling the precision of the rendered string itself (mirroring `parseDuration`'s options) — kept as separately-named keys since both option sets have colliding `smallestUnit`/`roundingMode` names with different Temporal types.
  - Returns `""` on invalid input, matching the `duration` namespace's string sentinel convention (rather than `null`, which its counterpart number-returning functions use).

  This completes Story Group A (Duration) of the Luxon/react-aria parity roadmap.

- 0eb2052: Adds `formatDuration` to the `duration` namespace, rendering an ISO 8601 duration string as a human-readable, locale-aware string (e.g. `"P1DT2H30M"` + `"en-US"` → `"1 day, 2 hours, and 30 minutes"`).

  - Built on `Intl.NumberFormat({ style: "unit" })` for per-locale unit labels and pluralization, joined via `Intl.ListFormat` — both universally available on Node 20/22/24 with no version variance, unlike `Intl.DurationFormat`, which is absent entirely on Node 20/22 (only ships natively on Node 24+). This keeps `formatDuration` free of any new runtime dependency, at the cost of not being a byte-for-byte match to native `Intl.DurationFormat` output (e.g. no `"digital"` style).
  - Accepts an optional `locale` (system default if omitted) and `{ style?: "long" | "short" | "narrow", zero?: boolean }` options.
  - Zero-valued components are omitted by default; pass `{ zero: true }` to include them. A zero-length duration (`"PT0S"`) always renders `"0 seconds"`.
  - Negative durations render each component with its own leading `"-"`.
  - Returns `""` on invalid input: non-string value or invalid duration string.

- 5b66743: Adds `addDuration` and `subtractDuration` to the `duration` namespace, combining two ISO 8601 duration strings (e.g. `"P1D"` + `"PT2H"` → `"P1DT2H"`) via `Temporal.Duration.prototype.add`/`.subtract`.

  Both operate on day/time units only — combining a pair where either operand has a nonzero years/months/weeks component returns `""`, since `Temporal.Duration.prototype.add`/`.subtract` have no `relativeTo` option to resolve calendar-unit arithmetic.

- eeee737: Adds `normalizeDuration` to the `duration` namespace, rolling an ISO 8601 duration string's small units into larger ones via `Temporal.Duration.prototype.round` (e.g. `"PT90M"` + `{ largestUnit: "hour" }` → `"PT1H30M"`).

  - Defaults to `{ largestUnit: "auto" }` when no options are given, which reformats a day/time-only duration without promoting units — pass an explicit `largestUnit` to promote.
  - Accepts `largestUnit`, `smallestUnit`, `roundingIncrement`, `roundingMode`, and `relativeTo` options, mirroring `Temporal.Duration.prototype.round`'s options.
  - `relativeTo` is required whenever a calendar unit (year/month/week) is involved — either as the requested `largestUnit`, or because the input duration already has a nonzero year/month/week component (this applies even under the `"auto"` default). Without it in either case, returns `""`.
  - Returns `""` on invalid input: non-string value, invalid duration string, or invalid `relativeTo`.

  Also expands `addDuration`/`subtractDuration`'s test coverage with additional permutations (overflow-without-borrow, negative-operand cancellation, fractional-second combination, negative-result subtraction) per `context/testing-standards/index.md`'s exhaustive `it.each` coverage bar.

- 6839dca: Adds a new `duration` namespace for parsing and validating ISO 8601 duration strings:

  - `isValidDuration` — validates an ISO 8601 duration string (e.g. `"P1DT2H30M"`) via `Temporal.Duration.from`.
  - `parseDuration` — parses and re-normalizes an ISO 8601 duration string, returning `""` on invalid input. Accepts `smallestUnit`, `fractionalSecondDigits`, and `roundingMode` options to control the precision/rounding of the output.

  Also extends the existing `add*`/`subtract*`/`diff*` functions across the `plain`, `zoned`, `unix`, and `utc` namespaces (`addDate`, `addDateTime`, `addTime`, `addUnix`, `addUtc`, `addZoned`, and their `subtract`/`diff` equivalents) with additional Temporal options that were previously unreachable:

  - `add*`/`subtract*` gain an `overflow` option (`"constrain"` (default, matches current behavior) | `"reject"`) controlling how an out-of-range arithmetic result (e.g. adding 1 month to Jan 31) is resolved — clamp to the nearest valid date, or reject and return the function's sentinel (`""`/`null`).
  - `diff*` gain `smallestUnit`, `roundingIncrement`, and `roundingMode` options to round the computed difference before it's returned, instead of always returning the exact unrounded value.

  All new options are optional and default to current behavior — no existing call signature changes.

## 1.5.0

### Minor Changes

- e83828a: `startOfZoned`, `endOfZoned`, `startOfQuarterForZoned`, `endOfQuarterForZoned`, `mapZonedHoursInDay`, `startOfUnix`, `endOfUnix`, `startOfQuarterForUnix`, and `endOfQuarterForUnix` accept new `disambiguation` and `offset` options (`disambiguation`: `"compatible" | "earlier" | "later" | "reject"`, defaulting to `"compatible"`; `offset`: `"prefer" | "use" | "ignore" | "reject"`, defaulting to `"ignore"`) to control how DST gaps and overlaps are resolved when the function's boundary computation lands on an ambiguous or nonexistent local time. `"reject"` returns the function's sentinel (`""`/`null`/`[]`) instead of silently picking a resolution.

  `offset` must stay at its default (`"ignore"`) for `disambiguation` to take effect on these functions — setting it to `"prefer"` (or `"use"`) can make `disambiguation` inert, since these functions construct their boundary via `Temporal.ZonedDateTime.prototype.with()`, which otherwise prefers the source's existing UTC offset whenever it's still valid. See `docs/dst-disambiguation.md` for the full explanation.

  `convertPlainDateTimeToZoned`, `addZoned`, and `subtractZoned` also gain the same `offset` option for API consistency, but it is permanently inert on those three: their underlying construction path always parses a plain datetime string with no offset embedded, so there is never a stored offset for `offset` to act on.

- d6da928: `convertPlainDateTimeToZoned` accepts a new `disambiguation` option (`"compatible" | "earlier" | "later" | "reject"`, defaulting to `"compatible"`) to control how DST gaps (spring-forward) and overlaps (fall-back) are resolved when attaching a timezone to a plain datetime. `"reject"` returns `""` for any ambiguous or nonexistent local time instead of silently picking one.
- 2186c3a: `addZoned` and `subtractZoned` accept a new `disambiguation` option (`"compatible" | "earlier" | "later" | "reject"`, defaulting to `"compatible"`) to control how a fall-back (DST-end) overlap is resolved when the arithmetic result lands on an ambiguous local time. `"reject"` returns `""` for an ambiguous result instead of silently picking one.

  This option has no effect on a spring-forward (DST-start) gap: Temporal's arithmetic always resolves a gap landing unambiguously before disambiguation is evaluated, so all four values produce the same result in that case.

## 1.4.0

### Minor Changes

- 313f052: Adds `getTimeZones` to the `zoned` namespace, returning the full list of IANA timezone identifiers supported by the runtime (via `Intl.supportedValuesOf("timeZone")`, `[]` on unsupported runtimes).

  `getSystemTimeZone` moves from the `plain` namespace to `zoned` alongside it. It remains available from the package root (`@northguild/gmt`) and from `@northguild/gmt/zoned`, but is no longer exported from `@northguild/gmt/plain` — update imports accordingly if you were importing it from the `plain` subpath.

## 1.3.0

### Minor Changes

- 9868c37: Adds relative time formatters across all value types, and fills in the missing base formatters for the unix and utc namespaces.

  New relative formatters — all accept `locale`, `style` (`"long" | "short" | "narrow"`), `numeric` (`"auto" | "always"`), `largestUnit`, and an optional `reference` anchor; auto-select the largest sensible unit when `largestUnit` is omitted; return `""` for invalid input:

  - `formatRelativeDate` — relative plain date (e.g. `"3 days ago"`, `"next year"`)
  - `formatRelativeTime` — relative plain time (e.g. `"30 minutes ago"`)
  - `formatRelativeDateTime` — relative plain datetime (e.g. `"in 2 hours"`)
  - `formatRelativeZoned` — relative zoned datetime, DST-safe; reference can be a `ZonedDateTime` string, UTC string, or Unix epoch (ms)
  - `formatRelativeUnix` — relative time from a Unix epoch (ms or seconds); reference can be a numeric epoch or UTC ISO string
  - `formatRelativeUtc` — relative time from a UTC ISO string

  New base formatters:

  - `formatUnix` — locale-aware formatting for Unix epochs (ms or seconds); accepts `timeZone` (including `"local"`) and `includeTimeZoneName`
  - `formatUtc` — locale-aware formatting for UTC ISO strings; accepts `timeZone` and `includeTimeZoneName`

## 1.2.1

### Patch Changes

- 8d49857: Add missing barrel exports for unix and utc comparators, and add a new public export for `plain/validate/isLeapYear`

## 1.2.0

### Minor Changes

- Adds parser methods for plain, unix, utc, zoned. Updates tanstack-intent skills.

## 1.1.0

### Minor Changes

- cc4feab: Adds more unix and utc methods. Adds min, max, sort methods.

## 1.0.0

### Major Changes

- fa5a465: Initial public release of the gmt suite.

  ## @northguild/gmt

  Temporal-first date and time library. String-in, string-out API wrapping
  `@js-temporal/polyfill`. Covers plain and zoned arithmetic, comparison,
  formatting, parsing, mapping, conversion, and validation. No `Date` object
  used anywhere.

  ## @northguild/gmt-eslint

  ESLint flat-config plugin that bans the `Date` API (`new Date`, `Date.now`,
  `Date.UTC`, `Date.parse`, and the global `Date` reference) and points
  consumers toward `@northguild/gmt` replacements.

  ## @northguild/gmt-oxlint

  Oxlint JS plugin with the same `Date`-ban policy as `gmt-eslint`. Rules
  cover `new Date`, `Date.now`, `Date.UTC`, `Date.parse`,
  `date.getTimezoneOffset`, and bare `Date` global references.

  ## @northguild/gmt-biome

  Biome GritQL plugin enforcing the same `Date`-ban rules for projects using
  Biome as their formatter/linter.
