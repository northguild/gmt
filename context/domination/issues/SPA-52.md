# SPA-52 — Space: CCSDS time codes

**Scope:** The CCSDS 301.0-B-4 time code formats used across space data systems.

## Gap

CCSDS 301.0-B-4 is cited in the epic's references and no story implements it. It defines the time codes that spacecraft telemetry, orbit data messages and ground systems actually exchange — two ASCII forms and two binary ones — and none of them is ISO 8601.

## Scope

- `packages/gmt/src/space/parse/ccsdsAscii.ts`:
  - `parseCcsdsAsciiA(value: string): string | null` — Code A, `YYYY-MM-DDThh:mm:ss.d→dZ`.
  - `parseCcsdsAsciiB(value: string): string | null` — Code B, `YYYY-DDDThh:mm:ss.d→dZ`, day-of-year form.
  - `formatCcsdsAsciiA(isoString: string, options?: { fractionDigits?: number }): string`
  - `formatCcsdsAsciiB(isoString: string, options?: { fractionDigits?: number }): string`
- `packages/gmt/src/space/parse/ccsdsCuc.ts`:
  - `parseCuc(coarse: bigint, fine: bigint, options: { epoch: string, coarseOctets: number, fineOctets: number }): string | null` — Unsegmented time code (§3.2).
- `packages/gmt/src/space/parse/ccsdsCds.ts`:
  - `parseCds(days: number, msOfDay: number, subMs?: number, options?: { epoch?: string }): string | null` — Day segmented time code (§3.3).

## CCSDS time codes

| Code | Section | Form |
| --- | --- | --- |
| CUC | §3.2 | Unsegmented binary counter: coarse octets of basic time units plus optional fine fractional octets |
| CDS | §3.3 | Day segmented: day count, milliseconds of day, optional sub-millisecond field |
| ASCII A | §3.5 | `YYYY-MM-DDThh:mm:ss.d→dZ` — 27 characters at full precision |
| ASCII B | §3.5 | `YYYY-DDDThh:mm:ss.d→dZ` — 25 characters, day of year |

- The CCSDS **recommended reference epoch is 1958-01-01T00:00:00 TAI**, which is neither the Unix epoch nor UTC.
- Both ASCII codes are **UTC-based**, so leap-second correction applies. The seconds field may read `60` during a leap second.
- The `Z` terminator is optional.

([CCSDS 301.0-B-4](https://ccsds.org/Pubs/301x0b4e1.pdf))

## Design notes

- **The 1958 TAI epoch is the trap.** CUC and CDS count from it by default, and treating those counts as seconds since 1970 or as UTC produces an error of twelve years plus the leap-second offset. The epoch is a required parameter on `parseCuc` for that reason, and defaulted-but-documented on `parseCds`.
- **ASCII codes are UTC and binary codes are typically TAI-referenced.** Mixing them without conversion is a silent error, and the JSDoc on each must say which scale it yields.
- **Code B is day-of-year, not month-day.** `2024-001` is 1 January; misreading it as a month yields a nonsensical date rather than an obviously wrong one.
- **The seconds field may be `60`.** A parser rejecting it will fail exactly during a leap second — the moment correctness matters most. It must be accepted and validated against the leap-second table, per SPA-48.
- CUC field widths are mission-configured and are parameters, not constants.

## What gmt provides (do not re-implement)

- `getOrdinalDate` from CORE-5 — day-of-year handling for Code B
- `toTAI` / `fromTAI` from SPA-46 — the 1958 TAI epoch
- `isLeapSecond` from SPA-48 — validating a `60` seconds field
- `toNanoseconds` from CORE-1 — precision conversion

## Verification

- `parseCcsdsAsciiA('2024-06-15T10:30:00.000000Z')` round-trips
- `parseCcsdsAsciiB('2024-001T00:00:00Z')` returns 1 January 2024
- Code B in a leap year with day 366 parses correctly
- A seconds field of `60` on a known leap-second date parses; on any other date it returns the sentinel
- The `Z` terminator is optional on both ASCII codes
- `parseCuc` with the 1958 TAI epoch returns an instant twelve years plus the leap offset from the Unix-epoch interpretation, asserted explicitly
- `parseCds` with varying coarse and fine octet counts produces consistent instants
- Fractional digits round-trip at the requested precision
- Malformed codes return the sentinel
- `pnpm run validate` stays green
