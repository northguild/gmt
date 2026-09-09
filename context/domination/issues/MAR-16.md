# MAR-16 — Maritime: GPS ↔ UTC conversion and week rollover

**Scope:** GPS time to UTC and back, and decoding raw GPS week/time-of-week pairs.

## Gap

Maritime AIS, GNSS receivers and navigation systems report GPS time, which has no leap seconds. Port and commercial operations run on UTC. The offset between them is not constant — it grows by one second with every leap second — and raw receiver output carries a week number that has already wrapped three times.

## Scope

- `packages/gmt/src/maritime/convert/gpsToUtc.ts`:
  - `gpsToUtc(gpsString: string): string` — GPS timestamp to UTC ISO string.
  - `utcToGps(utcString: string): string` — UTC to GPS timestamp.
- `packages/gmt/src/maritime/convert/gpsWeekToUtc.ts`:
  - `gpsWeekToUtc(week: number, timeOfWeekSeconds: number, options?: { rolloverEra?: number }): string` — Raw week and time-of-week to UTC. `rolloverEra` disambiguates the 1024-week wrap.
  - `utcToGpsWeek(utcString: string): { week: number, timeOfWeekSeconds: number, era: number } | null`

## Key constants

- GPS epoch: 1980-01-06T00:00:00 UTC
- **GPS − UTC = +18 seconds** as of January 2017 — GPS runs **ahead** of UTC
- GPS − UTC was **0** at the GPS epoch; it grows with each leap second
- TAI − GPS = +19 seconds (constant, by definition)
- TAI − UTC = +37 seconds (27 leap seconds since 1972; none since 2016-12-31)

The legacy navigation message carries the week number in **10 bits**, so it wraps every 1024 weeks (~19.6 years). Rollovers occurred on **1999-08-21** and **2019-04-06**; the next is **2038-11-20**.

Sources: [TimeTools](https://timetoolsltd.com/gps/what-is-gps-time/), [Meinberg](https://kb.meinbergglobal.com/kb/time_sync/gnss_systems/gps_week_number_rollover), [BIPM](https://www.bipm.org/documents/20126/52354616/CCTF_UTC_presentation.pdf/0a8f0954-7c00-9142-8da2-f4221c7e0269).

## Corrections

The original MAR-1 contained two factual errors, both now corrected above.

- **The sign was backwards.** It stated `GPS − UTC = -18 seconds`. GPS is ahead of UTC, so the offset is `+18`. Implemented as written, every converted timestamp would have been 36 seconds wrong.
- **The epoch example was wrong.** It asserted `utcToGps('1980-01-06T00:00:00Z')` → `'1980-01-06T00:00:18Z'`. The GPS−UTC offset was **zero** at the GPS epoch — the 18 seconds accumulated from leap seconds inserted afterwards. Using the present-day offset at the epoch is exactly the bug this story exists to prevent, and it was encoded in the acceptance criteria.

## Design notes

- The offset is a function of the date, resolved through the leap-second table, not a constant. Any implementation that hardcodes 18 is correct only between 2017 and the next leap second.
- `rolloverEra` cannot be inferred from a week number alone; a receiver reporting week 100 is genuinely ambiguous across four decades. Default to the current era and document that older receivers need an explicit value.
- Before 1980-01-06 GPS time is undefined. Return the sentinel rather than extrapolating.

## What gmt provides (do not re-implement)

- `toNanoseconds` / `fromNanoseconds` from CORE-1 — precision conversion
- The leap-second table from SPA-48 — shared, not duplicated

## Verification

- `utcToGps('1980-01-06T00:00:00Z')` returns the GPS epoch with a **zero** offset
- `utcToGps('2024-01-01T00:00:00Z')` returns a GPS time **18 seconds ahead** of UTC
- Round-trip: `gpsToUtc(utcToGps(iso))` returns an equivalent UTC string
- A date before the 2016 leap second uses a 17-second offset, not 18
- `gpsWeekToUtc(100, 0, { rolloverEra: 0 })` and era 1 differ by exactly 1024 weeks
- `utcToGpsWeek('2019-04-07T00:00:00Z')` returns era 2
- A date before the GPS epoch returns the sentinel
- `pnpm run validate` stays green
