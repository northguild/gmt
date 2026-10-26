# SPA-49 — Space: Julian Date, MJD and J2000

**Scope:** Julian Date in a form that does not lose precision, plus Modified Julian Date and J2000 seconds.

## Gap

Julian Date is the standard argument for ephemerides and CCSDS orbit data, and the obvious implementation is quietly lossy.

**A Julian Date stored as a single IEEE double resolves to only about 100 µs.** JD values near the present are around 2 460 000, which consumes most of the mantissa; the fractional day has little left. The IAU's SOFA library (and ERFA, its open port) carries JD as a **pair** of doubles — one holding integer days, the other the fraction — precisely for this reason, and ERFA documents the single-value form as acceptable only where losing several digits of resolution is tolerable.

The original spec's `instantToJulianDate(isoString): number` bakes that loss in at the signature, in a realm whose entire purpose is precision.

(IAU SOFA, *Time Scale and Calendar Tools* — the two-part JD convention, not reached — marked, not asserted; [USNO AA TN2011-02](https://aa.usno.navy.mil/downloads/novas/USNOAA-TN2011-02.pdf) (US) and [astropy time](https://docs.astropy.org/en/stable/time/index.html) as corroboration)

## Scope

Paths are under the Space realm namespace, written `<space-ns>/` below: its name is decided when the SPA stories start, because "space" would collide with a planned spatial/geo expansion.

- `<space-ns>/convert/julianDate.ts`:
  - `toJulianDateParts(isoString: string, scale?: TimeScale): { jd1: number, jd2: number } | null` — Two-part JD; `jd1` holds integer days, `jd2` the fraction. Their sum is the JD.
  - `fromJulianDateParts(parts: { jd1: number, jd2: number }, scale?: TimeScale): string`
  - `toJulianDate(isoString: string, scale?: TimeScale): number | null` — Single-value form, **documented as lossy to roughly 100 µs**.
  - `fromJulianDate(jd: number, scale?: TimeScale): string`
- `<space-ns>/convert/modifiedJulianDate.ts`:
  - `toModifiedJulianDate(isoString: string, scale?: TimeScale): number | null` — MJD = JD − 2400000.5.
  - `fromModifiedJulianDate(mjd: number, scale?: TimeScale): string`
- `<space-ns>/convert/j2000.ts`:
  - `toJ2000Seconds(isoString: string, scale?: TimeScale): number | null` — Seconds since the J2000 epoch. Defaults to TT, the scale the J2000.0 epoch is defined in (2000-01-01 12:00 TT).

## Key epochs

| Epoch | Value | Notes |
| --- | --- | --- |
| J2000.0 | JD 2451545.0 | 2000-01-01 12:00 TT |
| MJD offset | JD − 2400000.5 | MJD starts at midnight, not noon |
| Unix epoch | JD 2440587.5 | 1970-01-01 00:00 UTC |

## Tool

**Extends Satellite Clock Converter** with day counts: the same instant appears as a Julian date, a modified Julian date and seconds since J2000. Calls `toJulianDateParts`, `toModifiedJulianDate`, `toJ2000Seconds`.

## Design notes

- **The two-part form is primary; the single-value form is a convenience.** Both are provided because callers integrating with systems that accept only one number need it, but the lossy one carries its error bound in its JSDoc so the choice is informed.
- **MJD is materially more precise than JD as a single double**, because subtracting 2 400 000.5 frees several digits of mantissa. Worth stating, since it is a cheap mitigation for callers stuck with one number.
- **The time scale matters and defaults differ by function.** J2000 seconds default to TT because the J2000.0 epoch is itself defined as 2000-01-01 12:00 TT (Key epochs above), so a count from it in TT needs no further correction. JD conversions default to UTC. Divergent defaults are justified by convention but must be explicit in every signature and JSDoc, or callers will assume one applies to all.
- **`TimeScale` is `'UTC' | 'TAI' | 'TT' | 'TCG'`**, the scales this epic's stories provide: UTC and TAI already, TT and TCG from SPA-47. Every function in this story accepts each of them; a JD, MJD or J2000 count in TCG is taken on TCG's own time line, through SPA-47's conversions. TDB is not a member: no story in this epic provides it, so a caller cannot pass it without a cast, and a value outside the type returns the sentinel like any other invalid input.
- JD begins at **noon**, not midnight — a half-day offset that is a classic source of off-by-12-hours errors.

## Corrections

`instantToJulianDate(isoString): number` is retained only as the explicitly lossy `toJulianDate`, with the two-part form added as the precision-preserving primary. The original's acceptance criterion `instantToJulianDate('2000-01-01T12:00:00Z') → 2451545.0 (± rounding)` is the whole problem in miniature: "± rounding" concealed a 100 µs floor in a realm specified to nanosecond precision. The function names are also aligned with the existing module's `to*`/`from*` convention.

## What gmt provides (do not re-implement)

- `toNanoseconds` / `fromNanoseconds` from CORE-1 — precision conversion
- `toTT` from SPA-47 — scale conversion before the JD calculation
- `taiMinusUtc` from SPA-48 — leap-second handling

## Verification

- `toJulianDateParts('2000-01-01T12:00:00Z')` sums to `2451545.0`
- `jd1` is integral and `jd2` lies in the documented fractional range for every test date
- Round-trip through the two-part form preserves nanosecond precision
- Round-trip through the single-value form loses precision, asserted explicitly against the documented ~100 µs bound
- `toModifiedJulianDate('2000-01-01T00:00:00Z')` returns `51544.5`
- MJD round-trip is demonstrably more precise than JD round-trip at the same date
- `toJ2000Seconds('2000-01-01T11:58:55.816Z')` returns `0` by default: J2000.0 is 2000-01-01T12:00:00 TT, and TT − UTC was 64.184 s that day
- Each function accepts all four `TimeScale` members; a JD in TCG round-trips through SPA-47's `toTCG` and `fromTCG`
- A scale outside `TimeScale` (for example `'TDB'`, passed with a cast) returns the sentinel
- JD noon offset is asserted: midnight UTC yields a `.5` fraction
- Invalid input returns the sentinel
- `pnpm run validate` stays green
