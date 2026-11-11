# SPA-49 slice: modified-julian-date

`toModifiedJulianDate` and `fromModifiedJulianDate`. Needs [core.md](core.md); rules in
[index § Authority](index.md#authority--what-each-rule-rests-on).

## Signatures and bodies

```ts
export function toModifiedJulianDate(isoString: string, scale: TimeScale = "UTC"): number | null
export function fromModifiedJulianDate(mjd: number, scale: TimeScale = "UTC"): string
```

`toModifiedJulianDate`: `isTimeScale`, `parseUtcReading`, `dayPositionOf`, then
`Number(epochDay + MJD_OF_UNIX_EPOCH) + fractionOfDay(position)`. MJD days begin at midnight, so
the fraction is the day position directly. Do **not** compute `JD − 2400000.5` in doubles, which
would lose the digits MJD exists to keep.

`fromModifiedJulianDate`: return `""` unless `isTimeScale(scale)` and `mjd` is a finite `number`.
Otherwise take `exactDyadic(mjd) − 40587` as the exact number of days, then `dayPositionOfDays`,
`readingOfDayPosition`, `formatUtcReading`.

## Precision (JSDoc and tests)

The error is at most ½ ulp(MJD) + ½ ulp(fraction) days, using the same formula and ulp helper as
[julian-date.md](julian-date.md):

| Years | MJD range | Worst error |
| --- | --- | --- |
| 1972 – 2038-04-22 | 2¹⁵ ≤ MJD < 2¹⁶ | 2⁻³⁸ day ≈ 0.31 µs |
| 2038-04-23 – about 2217 | 2¹⁶ ≤ MJD < 2¹⁷ | ≈ 0.63 µs |
| each later doubling of MJD | | the error doubles too, up to 40.2 µs by 9999 (MJD ≥ 2²¹) |

The JSDoc says that MJD = JD − 2 400 000.5 counts from midnight, not noon. For present-day dates it
keeps about 64 times the resolution of a single-double JD (about 0.6 µs against 40 µs), so it is
the right choice when a system takes only one number. For nanoseconds, use `toJulianDateParts`.

## JSDoc must also state

- First sentence: the scale defaults to `"UTC"` (index D4).
- The default scale is `"UTC"`, a quasi-MJD on UTC as in `toJulianDateParts`. The domain is 1972
  to 9999. TDB is not available.
- `@example`: rows 1, 2, 4 and 6 of the table below, plus one sentinel.

## Expected values — `toModifiedJulianDate`

| Input | Scale | Result | Why |
| --- | --- | --- | --- |
| `2000-01-01T00:00:00Z` | default | `51544` | midnight is a whole MJD (index Correction 2) |
| `2000-01-01T12:00:00Z` | default | `51544.5` | `ERFA_DJM00`, J2000.0's day |
| `2000-01-01T11:58:55.816Z` | `"TT"` | `51544.5` | J2000.0 on TT |
| `1972-01-01T00:00:00Z` | default | `41317` | the floor |
| `2016-12-31T12:00:00Z` | default | `57753 + 43200 / 86401` | quasi-MJD on an 86 401 s day |
| `2016-12-31T23:59:60Z` | default | `57753 + 86400 / 86401` | |
| `2026-01-01T00:00:00Z` | default | `61041` | |
| `2026-01-01T00:00:00Z` | `"TAI"` | `61041 + 37 / 86400` | |
| `2026-01-01T00:00:00Z` | `"TCG"` | `61041 + 70_261_661_917 / 86_400_000_000_000` | label `…00:01:10.261661917 TCG` (`toTCG` example) |

The test computes every expected value in the form written above. The constant 40587 and the
first row are also checked by Temporal: `PlainDate.from("1858-11-17").until("2000-01-01").days === 51544`.

Sentinels (`null`) are the same list as `toJulianDateParts`.

## Expected values — `fromModifiedJulianDate`

| Input | Scale | Result |
| --- | --- | --- |
| `51544` | default | `2000-01-01T00:00:00Z` |
| `51544.5` | `"TT"` | `2000-01-01T11:58:55.816Z` |
| `57753 + 86400 / 86401` | default | `2016-12-31T23:59:60Z` |
| `41317` | default | `1972-01-01T00:00:00Z` |
| `41316.99` | default | `""` |
| `2973484` | default | `""` (10000-01-01) |

Sentinel (`""`) for a non-finite value, a non-number, and a scale outside `TimeScale`.

## Round trips (Verification)

- MJD round trip within its bound, on the same 12-instant list and each scale as `julian-date.md`.
- **MJD beats JD** (deterministic, not luck): at `2026-01-01T12:00:00.00002Z` on UTC, the JD round
  trip loses exactly 20 µs (julian-date.md), and the MJD round trip is within 0.32 µs. Also, for each
  instant on the list dated before 2038, the MJD **bound** is at least 32 times smaller than the JD
  bound. Compare the bounds, not the errors seen: a single error can be small by chance.
