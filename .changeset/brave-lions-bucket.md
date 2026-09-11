---
"@northguild/gmt": minor
---

Add the `calendar/` namespace: ISO week and ordinal dates, quarter and fiscal periods, and zone-aware bucketing (Story CORE-5).

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
- Also exported: the `FiscalCalendar`, `FiscalPattern` and `ZoneBucketUnit` types.
