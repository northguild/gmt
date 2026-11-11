---
story: SPA-49
issue: 230
status: approved
dox: context/dox/specs/spa-49/index.md
---

# SPA-49 — Julian Date, MJD and J2000 seconds

## Scope

Story: [`issues/SPA-49.md`](../../issues/SPA-49.md) (#230). Painpoint:
[painpoints.md § Space and celestial](../../painpoints.md#space-and-celestial) (single-double JD).

Eight functions in `timescale/convert/`, one file each, plus the `TimeScale` type and one internal
core. A UTC instant goes in. It comes out as a two-part Julian Date, a single Julian Date, a Modified
Julian Date or seconds since J2000.0, counted on one of four scales. Each `to*` has a `from*` that
returns the UTC instant. No new string grammar and no reference data. The Dox side is
[`context/dox/specs/spa-49/index.md`](../../../dox/specs/spa-49/index.md) (Correction 5).

### Corrections to the issue

1. **Paths.** `timescale/convert/<function>.ts`, one function per file. SPA-47's Decisions name
   `timescale/` for this story, and the module keeps one function per file. There is no `<space-ns>/`
   and no grouped `julianDate.ts`.
2. **MJD at midnight is a whole number.** `toModifiedJulianDate('2000-01-01T00:00:00Z')` is
   `51544`, not `51544.5`. 51544.5 is J2000.0, which falls at noon (ERFA `ERFA_DJM00`). The issue's
   Verification line is wrong.
3. **The single-double error bound is 20 µs, not "~100 µs".** A double's spacing (ulp) at a JD
   between 2²¹ and 2²² is 2⁻³¹ day (40.2 µs), and round-to-nearest is off by at most half that. This
   holds for years 1029 to 6771; from 6771 to 9999 the bound is 40.2 µs. Tests assert the bound
   from the IEEE 754 spacing, never a fixed 100 µs.
4. **`fromJ2000Seconds` is added** so that every `to*` has an inverse (D3).
5. **Dox tools.** The issue's `## Tool` ("Extends Satellite Clock Converter") is replaced by two
   new standalone tools, Julian Day Counter and Double Precision Meter, specced in
   [`context/dox/specs/spa-49/index.md`](../../../dox/specs/spa-49/index.md). The finalizer folds
   this into `issues/SPA-49.md` at close.
6. **Slice tables held values one double cannot carry.** 2026-01-01T12:00Z is JD 2461042, not
   2461041. MJD `57753 + 86400/86401` and `61041 + 37/86400`, and J2000 `536500799.000011574`,
   are not exact doubles; the tests use exactly representable rows and test these within ½ ulp.

## Signatures

```ts
// types/time-scale.ts
export type TimeScale = "UTC" | "TAI" | "TT" | "TCG";
export interface JulianDateParts { jd1: number; jd2: number }

// timescale/convert/
toJulianDateParts(isoString: string, scale?: TimeScale): JulianDateParts | null   // default "UTC"
fromJulianDateParts(parts: JulianDateParts, scale?: TimeScale): string           // default "UTC"
toJulianDate(isoString: string, scale?: TimeScale): number | null                 // default "UTC"
fromJulianDate(jd: number, scale?: TimeScale): string                             // default "UTC"
toModifiedJulianDate(isoString: string, scale?: TimeScale): number | null         // default "UTC"
fromModifiedJulianDate(mjd: number, scale?: TimeScale): string                    // default "UTC"
toJ2000Seconds(isoString: string, scale?: TimeScale): number | null               // default "TT"
fromJ2000Seconds(seconds: number, scale?: TimeScale): string                      // default "TT"
```

Shared contract (each slice restates the parts it tests):

- **Input instant:** anything `parseUtcReading` reads, so any offset or bracketed zone, and a
  listed leap second `…T23:59:60[.f]Z`. **Output instant:** `formatUtcReading`, so `Z` form,
  shortest fraction, and `…:60` inside an inserted second.
- **Domain:** 1972-01-01T00:00:00Z to 9999-12-31T23:59:59.999999999Z UTC, on every scale. `to*`
  returns `null` and `from*` returns `""` outside it (D2).
- **Scale:** omitted or `undefined` means the default. Any other value outside `TimeScale` (for example
  `"TDB"`, `"tt"` or `null`) returns the sentinel.
- **How each scale is counted.** On TAI, TT or TCG the count runs along that scale's own label (the
  label `toTAI` / `toTT` / `toTCG` writes). On UTC it is ERFA's quasi-JD: each UTC day counts as one
  day, however many seconds it holds (D1).
- **Sentinels:** `null` for `number` and the object, `""` for `string`
  ([coding-standards § API Contract](../../../coding-standards.md#api-contract)).
  Every body is wrapped in `try`/`catch`.

## Files

| File | Slice |
| --- | --- |
| `packages/gmt/src/types/time-scale.ts` (new), `types/index.ts` | [core](core.md) |
| `packages/gmt/src/internal/julianDate.ts` (+ `.test.ts`, new), `internal/index.ts` | [core](core.md) |
| `packages/gmt/src/internal/leapSeconds.ts` (+ test): `utcDayLengthNanoseconds` | [core](core.md) |
| `timescale/convert/toJulianDateParts.ts`, `fromJulianDateParts.ts` (+ tests) | [julian-date-parts](julian-date-parts.md) |
| `timescale/convert/toJulianDate.ts`, `fromJulianDate.ts` (+ tests) | [julian-date](julian-date.md) |
| `timescale/convert/toModifiedJulianDate.ts`, `fromModifiedJulianDate.ts` (+ tests) | [modified-julian-date](modified-julian-date.md) |
| `timescale/convert/toJ2000Seconds.ts`, `fromJ2000Seconds.ts` (+ tests) | [j2000-seconds](j2000-seconds.md) |
| `timescale/convert/index.ts` (eight exports) | each slice |
| `.changeset/*.md` (`minor`); `scripts/bundle-size.budgets.json` (reviewed root raise, as SPA-47) | finalizer |

No bench rows. No loop steps across the caller's span: the only loop is the
leap-second table scan, which is bounded by its 28 constant rows
([§ Loop cost](../../../coding-standards.md#loop-cost)). A public function never calls another; all
eight call the core.

## Authority — what each rule rests on

| Rule | Source |
| --- | --- |
| JD counts days from noon | [IAU 1997 Resolution B1](https://iau.org/Iau/Publications/List-of-Resolutions), Appendix 2: "The Julian Date (JD) of any instant is the Julian day number for the preceding noon plus the fraction of the day since that instant" |
| 1970-01-01T00:00 is JD 2440587.5 | ERFA `erfam.h` `ERFA_DJM0 (2400000.5)` "Julian Date of Modified Julian Date zero" with MJD 40587 for 1970-01-01; GMT's `JULIAN_DAY_OF_UNIX_EPOCH` (2440588, asserted in `foreignEpochs.test.ts`). B1 does not give this value |
| MJD = JD − 2400000.5, counted from midnight, on the caller's scale | [ITU-R TF.457-2](https://www.itu.int/rec/R-REC-TF.457-2-199710-I/en) Rec. 2: MJD "equals the JD less 2 400 000.5 and therefore has its origin, in the case of UT, at 0000 hours UT, 17 November 1858"; Rec. 1: the day is counted from 0000 hours TAI, UTC or UT. IAU 1997 B1 Rec. (b); ERFA `ERFA_DJM0` |
| J2000.0 = JD 2451545.0 = MJD 51544.5 | IAU 1994 Resolution C7 Rec. 1 (same IAU page); ERFA `erfam.h` `ERFA_DJ00 (2451545.0)`, `ERFA_DJM00 (51544.5)` |
| J2000.0 is 2000-01-01T12:00:00 **TT** (so the J2000 default scale is TT) | IAU 1994 C7 Rec. 1: "the event (epoch) J2000.0 be defined at the geocenter and at the date 2000 January 1.5 TT Julian date 2451545.0 TT"; [IERS Conventions 2010 (TN 36)](https://iers-conventions.obspm.fr/content/chapter5/icc5.pdf) §5.3.1 eq. (5.2), `t = (TT − 2000 January 1d 12h TT)/36525` |
| A two-part JD may be split between the parts in any way | ERFA `jd2cal.c` Note 2: "The Julian Date is apportioned in any convenient way between the arguments dj1 and dj2" |
| GMT's own output split: `jd1` a whole number, `jd2` in [0, 1) | **GMT rule.** ERFA `dtf2d.c` Note 3: "normally d1 is the Julian Day Number and d2 is the fraction of a day". The fraction is never negative, so `jd2` stays in one documented range |
| A JD on UTC is a quasi-JD: a day of 86 401 s is still one day; the scale is always stated | IAU 1997 B1 App. 2: "time intervals calculated from differences of Julian Dates specified in non-uniform time scales, such as UTC, may need to be corrected for changes in time scales (e.g. leap seconds)", and "the time scale used should be indicated" (hence the `scale` parameter and the JSDoc's first line). ERFA `dtf2d.c` Note 4: "the quasi-JD day represents UTC days whether the length is 86399, 86400 or 86401 SI seconds"; Note 7: the difference between two such values "cannot be interpreted as a precise time interval" |
| TT = TAI + 32.184 s; TCG from TT | IERS TN 36 §10.1, eq. (10.1); IAU 2000 B1.9 (inherited from SPA-47, via `ttOfUtc`, `tcgMinusTtNanoseconds`, `ttOfTcg`) |
| TAI − UTC, inserted seconds | IERS `Leap_Second.dat` through Bulletin C 72 (`LEAP_SECOND_STEPS`); ITU-R TF.460-6 Annex 1 §2.2 |
| Domain from 1972 on every scale, UTC included | BIPM Annual Report vol. 15 Table 2 (whole-second TAI − UTC begins 1972-01-01). ERFA's quasi-JD also counts the 1960–1971 "mini-leaps" (`dtf2d.c` Note 4), and GMT has no table for them |
| Domain up to year 9999 | **GMT rule** (`MAX_FOUR_DIGIT_YEAR`): the realm writes four-digit years, so every `to*` value has a `from*` inverse |
| Double out: a single correctly rounded division of exact integers | IEEE 754-2019 §4.3 (roundTiesToEven is the default rounding); **GMT rule** for which integers are divided |
| Back to nanoseconds: the exact value of the doubles, rounded once to the nearest nanosecond, a half rounding up | **GMT rule.** TC39 Temporal's default rounding mode is `halfExpand` (`GetRoundingModeOption`); on a non-negative fraction of a day this is half-up |
| Single JD = `jd1 + jd2`; MJD = day + fraction | **GMT rule.** One IEEE addition, so the error is at most ½ ulp(result) + ½ ulp(fraction) |
| J2000 seconds = (JD on the scale − 2451545.0) × 86 400 | ERFA `ERFA_DJ00`, `ERFA_DAYSEC (86400.0)`; **GMT rule** that one formula covers every scale (D1) |
| A scale outside `TimeScale` (TDB) → sentinel | **GMT rule.** No story provides TDB (SPA-47 Corrections) |
| Explicit `undefined` = default; `null` → sentinel | [coding-standards § API Contract](../../../coding-standards.md#api-contract) (`GetOption`) |

## Slices

| Slice | Functions | Order |
| --- | --- | --- |
| [core.md](core.md) | `TimeScale`, `JulianDateParts`, `internal/julianDate.ts`, `utcDayLengthNanoseconds` | 1 |
| [julian-date-parts.md](julian-date-parts.md) | `toJulianDateParts`, `fromJulianDateParts` | 2 |
| [julian-date.md](julian-date.md) | `toJulianDate`, `fromJulianDate` | 3 |
| [modified-julian-date.md](modified-julian-date.md) | `toModifiedJulianDate`, `fromModifiedJulianDate` | 3 |
| [j2000-seconds.md](j2000-seconds.md) | `toJ2000Seconds`, `fromJ2000Seconds` | 3 |

Slices with the same order number can run in parallel.

## Decisions (owner)

- **D1 — the UTC count is ERFA's quasi-JD.** A UTC day counts as one day, even with a leap second
  in it, so every UTC value converts back exactly; noon on a leap-second day is not `.0`. Seconds
  since J2000 on UTC equal Unix seconds − 946 728 000 except on a leap-second day.
- **D2 — UTC before 1972-01-01 returns the sentinel**, on every scale, as the rest of the realm does.
- **D3 — `fromJ2000Seconds` is added**, so every `to*` has an inverse.
- **D4 — defaults stay as the issue sets them:** UTC for JD and MJD, TT for J2000 seconds. Each
  function's JSDoc opens with its default scale.
- **D5 — a single-double `to*` returns `null` when its nearest double reads back outside the
  domain.** Near 1972-01-01 and the end of 9999 the correctly rounded double can fall past the
  edge. The rounding stays a single IEEE division and every returned value keeps a `from*`
  inverse; the two-part form covers the whole domain exactly.
