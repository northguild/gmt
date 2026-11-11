# SPA-49 — Space: Julian Date, MJD and J2000

**Scope:** Julian Date in a form that does not lose precision, plus Modified Julian Date and J2000 seconds.

## Gap

Julian Date is the standard argument for ephemerides and CCSDS orbit data, and the obvious implementation is quietly lossy.

**A Julian Date stored as a single IEEE double resolves to only about 100 µs.** JD values near the present are around 2 460 000, which consumes most of the mantissa; the fractional day has little left. The IAU's SOFA library (and ERFA, its open port) carries JD as a **pair** of doubles — one holding integer days, the other the fraction — precisely for this reason, and ERFA documents the single-value form as acceptable only where losing several digits of resolution is tolerable.

The original spec's `instantToJulianDate(isoString): number` bakes that loss in at the signature, in a realm whose entire purpose is precision.

(IAU SOFA, *Time Scale and Calendar Tools* — the two-part JD convention, not reached — marked, not asserted; [USNO AA TN2011-02](https://aa.usno.navy.mil/downloads/novas/USNOAA-TN2011-02.pdf) (US) and [astropy time](https://docs.astropy.org/en/stable/time/index.html) as corroboration)

## Scope

Eight functions in `packages/gmt/src/timescale/convert/`, one per file, plus the `TimeScale` type and
`JulianDateParts` (`types/time-scale.ts`) and one internal core (`internal/julianDate.ts`, with
`utcDayLengthNanoseconds` in `internal/leapSeconds.ts`). A UTC instant goes in. It comes out as a
two-part Julian Date, a single Julian Date, a Modified Julian Date or seconds since J2000.0, counted
on one of four scales. Each `to*` has a `from*` that returns the UTC instant.

```ts
toJulianDateParts(isoString, scale?): JulianDateParts | null   // { jd1, jd2 }, default "UTC"
fromJulianDateParts(parts, scale?): string                      // default "UTC"
toJulianDate(isoString, scale?): number | null                  // default "UTC"
fromJulianDate(jd, scale?): string                              // default "UTC"
toModifiedJulianDate(isoString, scale?): number | null          // default "UTC"
fromModifiedJulianDate(mjd, scale?): string                     // default "UTC"
toJ2000Seconds(isoString, scale?): number | null                // default "TT"
fromJ2000Seconds(seconds, scale?): string                       // default "TT"
```

`TimeScale` is `"UTC" | "TAI" | "TT" | "TCG"`. A scale outside it, such as `"TDB"`, `"tt"` or
`null`, returns the sentinel; an omitted or `undefined` scale means the default. No new string
grammar and no reference data.

## Gap

A Julian Date held in one IEEE double cannot carry the nanosecond. Near the present a JD is about
2 460 000, which uses most of the mantissa. The IAU SOFA library and ERFA carry JD as a pair of
doubles for this reason. The two-part form is the primary one here and the single-value form is a
convenience whose rounding is stated in its JSDoc.

## Key epochs

| Epoch | Value | Notes |
| --- | --- | --- |
| J2000.0 | JD 2451545.0, MJD 51544.5 | 2000-01-01 12:00 TT |
| MJD offset | JD − 2400000.5 | MJD counts from midnight, not noon |
| Unix epoch | JD 2440587.5 | 1970-01-01 00:00 UTC |

## Tools

Two standalone Core tools on the Dox site, the Julian Day Counter and the Double Precision Meter.
Their entries are in [`context/dox/built.md`](../../dox/built.md) § Tier 2. Neither extends the
Satellite Clock Converter.

## What gmt provides (do not re-implement)

- `parseUtcReading`, `formatUtcReading` and `LEAP_SECOND_STEPS` from SPA-48 and MAR-16 — reading and
  writing a UTC instant, a listed leap second included, and the closed leap-second table. The public
  functions are not called (a public function never calls another); their internal hinge is.
- `taiOfUtc` and `utcOfTai` from SPA-48 — TAI − UTC at an instant.
- `ttOfUtc`, `utcOfTt`, `ttOfTcg` and `tcgMinusTtNanoseconds` from SPA-47 — the TT and TCG labels.
- `floorDivide` from CORE-3 — floor toward −∞.

## Decisions

- **D1 — the UTC count is ERFA's quasi-JD.** A UTC day counts as one day, even with a leap second
  in it, so every UTC value converts back exactly; noon on a leap-second day is not `.0`. Seconds
  since J2000 on UTC equal Unix seconds − 946 728 000 except on a leap-second day. On TAI, TT and
  TCG the count runs along that scale's own label.
- **D2 — the domain is 1972-01-01T00:00:00Z to 9999-12-31T23:59:59.999999999Z UTC**, on every scale.
  `to*` returns `null` and `from*` returns `""` outside it.
- **D3 — `fromJ2000Seconds` exists**, so every `to*` has an inverse.
- **D4 — defaults:** UTC for JD and MJD, TT for J2000 seconds, because J2000.0 is defined in TT. Each
  function's JSDoc opens with its default scale.
- **D5 — a single-double `to*` returns `null` when its nearest double reads back outside the
  domain.** Near the two ends the correctly rounded double can fall past the edge. Every returned
  value keeps a `from*` inverse; the two-part form covers the whole domain exactly.
- **MJD at midnight is a whole number.** `toModifiedJulianDate("2000-01-01T00:00:00Z")` is `51544`;
  51544.5 is J2000.0, at noon.
- **The single-double error bound is 20 µs** for years 1029 to 6771 (a double's spacing between
  2²¹ and 2²² is 2⁻³¹ day, 40.2 µs, and rounding is off by at most half of it) and 40.2 µs from 6771
  to 9999. Tests assert the bound from the IEEE 754 spacing, never a fixed figure. An MJD keeps
  more digits than a JD in one double.
- **Paths:** `timescale/convert/<function>.ts`, one function per file; there is no grouped file.

## GMT rules

| Rule | Source |
| --- | --- |
| JD counts days from noon; MJD = JD − 2400000.5 counts from midnight | IAU 1997 Resolution B1 App. 2; ITU-R TF.457-2 Rec. 1 and 2 |
| J2000.0 is 2000-01-01T12:00:00 TT | IAU 1994 Resolution C7 Rec. 1; IERS Conventions 2010 §5.3.1 |
| A UTC JD is a quasi-JD and the scale is always stated | IAU 1997 B1 App. 2; ERFA `dtf2d.c` Notes 4 and 7 |
| `jd1` is a whole number and `jd2` lies in [0, 1) | GMT rule; ERFA `dtf2d.c` Note 3 |
| The domain starts in 1972 on every scale | BIPM Annual Report vol. 15 Table 2; GMT has no table for the 1960–1971 mini-leaps |
| The domain ends in year 9999 | GMT rule (`MAX_FOUR_DIGIT_YEAR`), so every value has a `from*` inverse |
| A double out is one correctly rounded division of exact integers | IEEE 754-2019 §4.3 |
| Back to nanoseconds: the exact value of the doubles, rounded once, a half rounding up | GMT rule; Temporal `halfExpand` |
| Single JD = `jd1 + jd2` in one IEEE addition | GMT rule |
| J2000 seconds = (JD on the scale − 2451545.0) × 86 400, one formula on every scale | ERFA `ERFA_DJ00`; GMT rule |
| TDB is not offered | GMT rule: no story provides TDB |
| An explicit `undefined` scale means the default and `null` returns the sentinel | coding-standards § API Contract |

## Verification

- `toJulianDateParts("2000-01-01T12:00:00Z")` is `{ jd1: 2451545, jd2: 0 }`.
- `jd1` is a whole number and `jd2` lies in [0, 1) for every test date.
- A round trip through the two-part form keeps the nanosecond.
- A round trip through the single-value form is asserted against the exact IEEE half spacing.
- `toModifiedJulianDate("2000-01-01T00:00:00Z")` is `51544`.
- `toJ2000Seconds("2000-01-01T11:58:55.816Z")` is `0`: TT − UTC was 64.184 s that day.
- Every function accepts all four scales, and a scale outside `TimeScale` returns the sentinel.
- Midnight UTC yields a `.5` JD fraction.
- Invalid input returns the sentinel.
- `pnpm run validate` stays green.
