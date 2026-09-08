# SPA-3 — Space / Celestial: Leap second handling

**Scope:** Leap second awareness — counting leap seconds between dates and validating leap second timestamps.

## Gap

UTC has leap seconds. TAI and GPS do not. Systems need to know how many leap seconds have been inserted between any two UTC dates, and whether a given timestamp is a valid leap second.

## Scope

- `packages/gmt/src/space/leap-seconds.ts`:
  - `leapSecondsBetween(start: string, end: string): number` — Count leap seconds inserted between two UTC dates. Returns the accumulated offset.
  - `isLeapSecond(isoString: string): boolean` — Is this timestamp a valid leap second (23:59:60 UTC)? Leap seconds occur at June 30 or December 31, 23:59:59 UTC.

## IERS leap second data

- Source: IERS Bulletin C
- Storage: Bundled JSON asset in the package
- Format: Array of `{ date: string, offset: number }` entries
- Update cadence: Bundled at build time. Document how to update.

## Leap second dates

Leap seconds occur at:
- 1972-06-30 23:59:60 UTC (first)
- 1972-12-31 23:59:60 UTC
- And subsequently at June 30 or December 31

As of 2024: TAI − UTC = +37 seconds (27 leap seconds since 1972).

## Validation

- `isLeapSecond('2016-12-31T23:59:60Z')` → `true`
- `isLeapSecond('2016-12-31T23:59:59Z')` → `false`
- `isLeapSecond('2016-12-31T23:59:61Z')` → `false` (invalid)
- `leapSecondsBetween('2020-01-01Z', '2024-01-01Z')` → `1` (one leap second in 2022)
- `leapSecondsBetween('2000-01-01Z', '2024-01-01Z')` → `10` (approximate)

## What gmt provides (do not re-implement)

- `isValidZonedDateTime` — validation
- Temporal for date arithmetic

## Verification

- Leap second dates in IERS table return `true` for `isLeapSecond`
- Non-leap-second dates return `false`
- `leapSecondsBetween` matches known IERS offsets for any date pair
- Before 1972-01-01: leap seconds don't apply (TAI epoch). Return `0`.
- `pnpm run validate` stays green
