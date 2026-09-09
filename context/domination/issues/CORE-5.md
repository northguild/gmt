# CORE-5 — Core: Calendar boundaries and zone-aware buckets

**Scope:** ISO week dates, ordinal dates, quarter and fiscal-period boundaries, and interval bucketing anchored to a target timezone.

## Gap

Two absences with outsized consequences.

**Week and period identifiers.** Vessel schedules are published by week number, retail and manufacturing run on 52/53-week fiscal calendars, and GMT can express neither.

**Zone-aware bucketing.** "Group by day in `America/New_York`" over UTC timestamps is the most common observability bug there is — and the same operation decides how many chargeable days a container accrued, because free time is counted in terminal-local calendar days. Flooring a UTC instant to a UTC day and calling it a local day is wrong for most of the world for most of the day.

## Scope

- `packages/gmt/src/calendar/get/`:
  - `getIsoWeekDate(isoString: string): { year: number, week: number, weekday: number } | null` — ISO 8601 week date. The week-numbering year differs from the calendar year at both ends of the year.
  - `getOrdinalDate(isoString: string): { year: number, dayOfYear: number } | null` — Ordinal date, 1–366.
  - `getQuarter(isoString: string, options?: { fiscalYearStartMonth?: number }): { year: number, quarter: number } | null`
- `packages/gmt/src/calendar/get/getFiscalPeriod.ts`:
  - `getFiscalPeriod(isoString: string, calendar: { pattern: '4-5-4' | '4-4-5' | '5-4-4', yearEndsOn: string }): { year: number, period: number, week: number } | null` — Retail/fiscal period. Handles the 53-week year.
- `packages/gmt/src/calendar/calculate/`:
  - `floorToZone(isoString: string, unit: 'hour' | 'day' | 'week' | 'month', timeZone: string): string` — Floors an instant to a boundary **in the target zone**, then returns the instant at that boundary.
  - `bucketRange(start: string, end: string, unit, timeZone: string): string[]` — The boundary instants spanning a range. Buckets are not uniform in length across a DST transition, which is the point.

## Fiscal calendar variants

| Pattern | Shape | Used by |
| --- | --- | --- |
| 4-5-4 | 4, 5, 4 weeks per quarter | NRF retail calendar — the US retail standard |
| 4-4-5 | 4, 4, 5 weeks per quarter | Longer month at quarter end |
| 5-4-4 | 5, 4, 4 weeks per quarter | Longer month at quarter start |

52 × 7 = 364 days, so a 53rd week is inserted roughly every five to six years. The NRF restates a 53-week year against the following year for comparability.
([NRF 4-5-4 calendar](https://nrf.com/resources/4-5-4-calendar))

## Design notes

- A DST-transition day is 23 or 25 hours long. `bucketRange` with `unit: 'day'` must return buckets of those lengths rather than forcing 24 hours, or daily aggregates silently drift.
- `floorToZone` takes the zone explicitly. There is no implicit "local" zone — GMT has no ambient timezone and must not acquire one.
- Fiscal calendars are caller-supplied configuration, not bundled data. There is no single correct retail calendar.

## What gmt provides (do not re-implement)

- `resolveLocal` from CORE-4 — boundary instants are local midnights and inherit the DST edge cases
- `Temporal.PlainDate.weekOfYear` / `dayOfYear` — the underlying ISO week and ordinal arithmetic
- `startOfZoned` / `endOfZoned` — existing zoned boundary helpers

## Verification

- `getIsoWeekDate('2027-01-01')` returns week-year 2026, not 2027
- `getIsoWeekDate` handles a 53-week ISO year
- `floorToZone('2024-06-15T03:00:00Z', 'day', 'America/New_York')` returns the 15 June local midnight instant, not the 15 June UTC midnight
- `bucketRange` across US spring-forward yields a 23-hour day; across fall-back, a 25-hour day
- `getFiscalPeriod` places the 53rd week correctly for a known NRF 53-week year
- Full IANA timezone coverage on `floorToZone` and `bucketRange`
- `pnpm run validate` stays green
