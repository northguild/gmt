# SPA-52 — Space: CCSDS ASCII time codes

**Scope:** The two ASCII time codes, A and B, that CCSDS 301.0-B-4 defines for space data systems.

## Gap

CCSDS 301.0-B-4 is cited in the epic's references and no story implements it. It defines the time codes that spacecraft telemetry, orbit data messages and ground systems actually exchange — two ASCII forms and two binary ones — and none of them is ISO 8601. This story covers the two ASCII forms.

## Scope

The functions live in `timescale/`, one file each: `parse/parseCcsdsAsciiA.ts`, `parse/parseCcsdsAsciiB.ts`, `format/formatCcsdsAsciiA.ts` and `format/formatCcsdsAsciiB.ts`. There is no grouped `ccsdsAscii.ts`. The grammar sits in one internal module, `internal/ccsdsAsciiTime.ts`.

- `parseCcsdsAsciiA(value: string): string` — Code A, `YYYY-MM-DDThh:mm:ss.d→dZ`. Returns an ISO 8601 UTC string, or `""`.
- `parseCcsdsAsciiB(value: string): string` — Code B, `YYYY-DDDThh:mm:ss.d→dZ`, day-of-year form. Returns an ISO 8601 UTC string in calendar form, or `""`.
- `formatCcsdsAsciiA(isoString: string, fractionalSecondDigits?: FractionalDigit): string`
- `formatCcsdsAsciiB(isoString: string, fractionalSecondDigits?: FractionalDigit): string`

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

- `parseUtcReading` and `LEAP_SECOND_STEPS` from SPA-48 and MAR-16 — reading a UTC instant, a
  listed leap second included, and the closed leap-second table. The public functions are not
  called (a public function never calls another); their internal hinge is.
- `taiOfUtc` from SPA-48 — deciding whether a second of `60` was one of the inserted leap seconds.
- `MAX_FOUR_DIGIT_YEAR` (`internal/utcReading.ts`) from MAR-16 — the last four-digit year.
- `isoYearString` from INT-15 — writing the year as four digits.
- Code B's day of the year is Temporal's own `dayOfYear` and `daysInYear`, not a gmt function.

## Verification

- `parseCcsdsAsciiA('2024-06-15T10:30:00.000000Z')` round-trips
- `parseCcsdsAsciiB('2024-001T00:00:00Z')` returns 1 January 2024
- Code B in a leap year with day 366 parses correctly
- A seconds field of `60` on a known leap-second date parses; on any other date it returns the sentinel
- The `Z` terminator is optional on both ASCII codes
- Fractional digits round-trip at the requested precision
- Malformed codes return the sentinel
- `pnpm run validate` stays green

## Decisions

- **Paths:** `timescale/parse/` and `timescale/format/`, one function per file.
- **The parsers return `string`, sentinel `""`**, per the [sentinel table](../../coding-standards.md#api-contract).
- **The formatter takes one positional argument**, `fractionalSecondDigits?: FractionalDigit` (`"auto" | 0 … 9`), not an options bag: a bag with one optional member is a shape the house rules forbid, and Temporal's own option already defines every value, the default and the cut.
- **Hinges, not public functions.** The functions use `parseUtcReading`, `taiOfUtc` and `LEAP_SECOND_STEPS`, and Temporal's own `dayOfYear` and `daysInYear`. They never call `isLeapSecond`, `getOrdinalDate` or `toNanoseconds`.
- **Parser out:** an ISO 8601 extended calendar date-time then `Z`; Code B comes out in calendar form. The second stays `60` in a leap second.
- **Formatter in:** any instant string the `parseUtcReading` grammar accepts, converted to UTC. A local date-time with no offset returns `""`.
- **Formatter digits:** omitted, `undefined` or `"auto"` writes the shortest exact fraction; `0` writes no period; `1` to `9` write exactly that many digits. Other values behave as Temporal reads them: `3.5` is `3`; `null`, `"3"`, `10`, `-1`, `NaN` and `true` return `""`.
- **Matching:** each parser matches the whole input against one regex. `\d` is `[0-9]`, there is no `m` flag, `T` and `Z` are upper case and literal, `.` is the only decimal sign, and a period needs at least one digit. Month, day, hour and minute ranges are left to Temporal's `overflow: "reject"`; the day of year is checked against `daysInYear`. Code A text never matches the Code B regex and the reverse.
- **No `-58` case.** No negative leap second was ever made and the table is closed, so every `…:59` is a real second.
- Every function returns `""` for a non-string first argument and never throws. No locale, no zone parameter, no loop over a span, so no bench rows.

## GMT rules

CCSDS 301.0-B-4 (November 2010) §3.5 is the governing text.

| Rule | Source |
| --- | --- |
| Code A is `YYYY-MM-DDThh:mm:ss.d→dZ`; Code B is `YYYY-DDDThh:mm:ss.d→dZ`, DDD 001-365 or -366 | CCSDS 301.0-B-4 §3.5.1.1 and §3.5.1.2 |
| Both codes are UTC; a code without `Z` is still UTC, never local time | §3.5.1 and §3.5.1.1-2 (`Z` optional) |
| Year 0001-9999, proleptic Gregorian | §3.5.1.1-2; Temporal's `iso8601` calendar |
| Fixed widths with leading zeros; separators `-`, `:`, upper-case `T`, `.`; upper-case `Z` | §3.5.1.1-2 and §3.5.1.3 d) |
| hh 00-23, mm 00-59; hour 24 is refused | §3.5.1.1-2 |
| ss 00-59, and 60 in a positive leap second | §3.5.1.1-2; ITU-R TF.460-6 Annex 1 §2.2 |
| A 60 is valid only at one of the 27 inserted leap seconds | IERS `Leap_Second.dat` through Bulletin C 72 (`LEAP_SECOND_STEPS`) |
| The fraction is a period and one or more digits, any number; no fraction means no period | §3.5.1.1-2 and §3.5.1.3 c), d) |
| A subset coarser than whole seconds returns `""` | **GMT rule.** §3.5.1.3 a) allows subsets only where context removes the ambiguity; a function has no context, and such a subset names a span, not an instant |
| Code B's day is the ISO ordinal day | ISO 8601-1:2019 §5.2.3; Temporal `dayOfYear`, `daysInYear` |
| Fields are checked, never clamped | §3.5.1.1-2 ranges; Temporal `overflow: "reject"` |
| Parser output is ISO 8601 extended date-time + `Z`, second 60 written as `60` | ISO 8601-1:2019 §5.4.2; RFC 3339 §5.6-5.7 |
| The parser keeps the fraction digits as sent, up to nine | **GMT rule.** The digit count is the precision the sender stated; precedent `parseFixUtcTimestamp` |
| Digits after the ninth are dropped, never rounded | **GMT rule.** Temporal holds nanoseconds; rounding up could carry into the next second, day or year, or out of a leap second |
| `fractionalSecondDigits` is `"auto"` or 0-9, default `"auto"`, read as Temporal reads it | TC39 Temporal `GetTemporalFractionalSecondDigitsOption` |
| The formatter cuts the fraction | TC39 Temporal `toString` with rounding mode `trunc` |
| The formatter always writes `Z` | **GMT rule.** Writing it tells every reader the text is UTC, and both of CCSDS's examples carry it |
| An offset is converted to UTC; a local date-time returns `""` | §3.5.1; [LOCAL_TIME_RESOLUTION.md](../../reference/LOCAL_TIME_RESOLUTION.md) |
| Sentinel `""`; an explicit `undefined` digits argument is the default | [coding-standards § API Contract](../../coding-standards.md#api-contract) |
