# SPA-52 — Space: CCSDS ASCII time codes

**Scope:** The two ASCII time codes, A and B, that CCSDS 301.0-B-4 defines for space data systems.

## Gap

CCSDS 301.0-B-4 is cited in the epic's references and no story implements it. It defines the time codes that spacecraft telemetry, orbit data messages and ground systems actually exchange — two ASCII forms and two binary ones — and none of them is ISO 8601. This story covers the two ASCII forms.

## Scope

Paths are under the Space realm namespace, written `<space-ns>/` below: its name is decided when the SPA stories start, because "space" would collide with a planned spatial/geo expansion.

- `<space-ns>/parse/ccsdsAscii.ts`:
  - `parseCcsdsAsciiA(value: string): string | null` — Code A, `YYYY-MM-DDThh:mm:ss.d→dZ`.
  - `parseCcsdsAsciiB(value: string): string | null` — Code B, `YYYY-DDDThh:mm:ss.d→dZ`, day-of-year form.
  - `formatCcsdsAsciiA(isoString: string, options?: { fractionDigits?: number }): string`
  - `formatCcsdsAsciiB(isoString: string, options?: { fractionDigits?: number }): string`

## CCSDS time codes

| Code | Section | Form |
| --- | --- | --- |
| ASCII A | §3.5 | `YYYY-MM-DDThh:mm:ss.d→dZ` — 27 characters at full precision |
| ASCII B | §3.5 | `YYYY-DDDThh:mm:ss.d→dZ` — 25 characters, day of year |

- Both ASCII codes are **UTC-based**, so leap-second correction applies. The seconds field may read `60` during a leap second.
- The `Z` terminator is optional.

([CCSDS 301.0-B-4](https://ccsds.org/Pubs/301x0b4e1.pdf))

## Tool

**CCSDS Time Code Decoder.** Paste an ASCII A or B string and see the instant. The tool writes the instant back in both forms. Calls `parseCcsdsAsciiA`, `parseCcsdsAsciiB`, `formatCcsdsAsciiA`, `formatCcsdsAsciiB`.

## Design notes

- **ASCII codes are UTC.** The JSDoc on each function says so, so a caller does not read the result as TAI.
- **Code B is day-of-year, not month-day.** `2024-001` is 1 January; misreading it as a month yields a nonsensical date rather than an obviously wrong one.
- **The seconds field may be `60`.** A parser rejecting it will fail exactly during a leap second — the moment correctness matters most. It must be accepted and validated against the leap-second table, per SPA-48.

## What gmt provides (do not re-implement)

- `getOrdinalDate` from CORE-5 — day-of-year handling for Code B
- `isLeapSecond` from SPA-48 (`timescale/validate/`) — checking a `60` seconds field against the leap-second table
- `toNanoseconds` from CORE-1 — precision conversion

## Verification

- `parseCcsdsAsciiA('2024-06-15T10:30:00.000000Z')` round-trips
- `parseCcsdsAsciiB('2024-001T00:00:00Z')` returns 1 January 2024
- Code B in a leap year with day 366 parses correctly
- A seconds field of `60` on a known leap-second date parses; on any other date it returns the sentinel
- The `Z` terminator is optional on both ASCII codes
- Fractional digits round-trip at the requested precision
- Malformed codes return the sentinel
- `pnpm run validate` stays green
