# SPA-46 — Space: TAI and GPS scale conversion

**Scope:** TAI and GPS time scales, the two simplest offsets from UTC.

## Gap

Space and GNSS systems store timestamps in TAI (continuous, no leap seconds) and GPS (no leap seconds, offset from TAI by a constant). Converting either to UTC requires the leap-second table, and the offsets are frequently written down with the wrong sign.

## Scope

- `packages/gmt/src/space/convert/tai.ts`:
  - `toTAI(isoString: string): string` — ISO UTC to a TAI scale string.
  - `fromTAI(taiString: string): string` — TAI to ISO UTC.
- `packages/gmt/src/space/convert/gps.ts`:
  - `toGPS(isoString: string): string` — ISO UTC to a GPS scale string.
  - `fromGPS(gpsString: string): string` — GPS to ISO UTC.

## Key constants

- **TAI − UTC = +37 seconds** currently. 27 leap seconds since 1972; the last was 2016-12-31 and none has occurred since.
- **TAI − GPS = +19 seconds**, exactly and permanently, by definition.
- **GPS − UTC = +18 seconds** currently — GPS runs **ahead** of UTC. The value was **0** at the GPS epoch (1980-01-06) and grows with each leap second.
- TT − TAI = +32.184 seconds, exactly (see SPA-47).

([BIPM](https://www.bipm.org/documents/20126/52354616/CCTF_UTC_presentation.pdf/0a8f0954-7c00-9142-8da2-f4221c7e0269), [TimeTools](https://timetoolsltd.com/gps/what-is-gps-time/))

## String format

SPICE-style scale designators:

```
'2026-01-01T00:00:37 TAI'
'2026-01-01T00:00:18 GPS'
```

## Design notes

- **Every offset is a function of date**, resolved through the leap-second table. Only TAI − GPS is a genuine constant. Hardcoding 37 or 18 produces a library that is correct only until the next leap second.
- **Pre-1972 UTC is not convertible by integer offset.** Before 1972-01-01 UTC used rate-adjusted "rubber seconds" with fractional offsets from TAI. `fromTAI` and `toTAI` return the sentinel before 1972 rather than extrapolating an integer count — see SPA-48.
- Before the GPS epoch, GPS time is undefined and returns the sentinel.

## Corrections

The original SPA-1 stated **`GPS − UTC = -18 seconds`** and gave the example `toGPS('2026-01-01T00:00:18Z')` → `'2026-01-01T00:00:00 GPS'`. Both encode the sign backwards: GPS is *ahead* of UTC, so the correct example is `toGPS('2026-01-01T00:00:00Z')` → `'2026-01-01T00:00:18 GPS'`. The same error appeared in the original MAR-1 (see MAR-16), where it was compounded by asserting an 18-second offset at the GPS epoch, when the offset was zero.

## What gmt provides (do not re-implement)

- `toNanoseconds` / `fromNanoseconds` from CORE-1 — precision conversion
- The leap-second table from SPA-48 — TAI − UTC by date

## Verification

- `toTAI('2026-01-01T00:00:00Z')` returns `'2026-01-01T00:00:37 TAI'`
- `toGPS('2026-01-01T00:00:00Z')` returns a GPS time **18 seconds ahead**
- Round-trip for both scales returns an equivalent UTC string
- A date between the 2012 and 2015 leap seconds uses a 35-second TAI offset, not 37
- The difference between `toTAI` and `toGPS` for any date is exactly 19 seconds
- A date before 1972-01-01 returns the sentinel from `fromTAI`
- A date before 1980-01-06 returns the sentinel from `toGPS`
- `pnpm run validate` stays green
