# SPA-49 slice: j2000-seconds

`toJ2000Seconds` and `fromJ2000Seconds` (the second is added by index Correction 4 / D3). Needs
[core.md](core.md). Rules are in [index § Authority](index.md#authority--what-each-rule-rests-on).

## Definition

Seconds since J2000.0 on scale S = (JD on S − 2451545.0) × 86 400 (`ERFA_DJ00`, `ERFA_DAYSEC`).

- On **TT** (the default) this is TT seconds since 2000-01-01T12:00:00 TT, which is J2000.0 itself.
- On TAI and TCG it counts from the label `2000-01-01T12:00:00` on that scale.
- On UTC it is the quasi-JD count (D1). On every day without a leap second it equals Unix seconds
  minus 946 728 000. On a day with one, the 86 401 s are scaled to fill 86 400. Like Unix time, the
  difference between two UTC values is not an exact interval.

## Signatures and bodies

```ts
export function toJ2000Seconds(isoString: string, scale: TimeScale = "TT"): number | null
export function fromJ2000Seconds(seconds: number, scale: TimeScale = "TT"): string
```

`toJ2000Seconds`: `isTimeScale`, `parseUtcReading`, `dayPositionOf`, then:

Return `nearestDouble(start × L + n × DAY, L × 10⁹)`, where `start` is
`(epochDay − J2000_EPOCH_DAY) × DAY − 43 200 × 10⁹` in nanoseconds, `n` the nanoseconds into the
day and `L` the day length (`DAY` on TT, TAI and TCG and on ordinary UTC days, `DAY + 10⁹` on a UTC
leap-second day). The fraction is the exact seconds since J2000.0, and it is rounded once, to the
nearest double, ties to even (index: one correctly rounded division of exact integers).

`fromJ2000Seconds`: return `""` unless `isTimeScale(scale)` and `seconds` is a finite `number`.
Otherwise the days since 1970-01-01T00:00 are exactly `(exactDyadic(seconds) + 43 200) / 86 400 + 10 957`.
Then `dayPositionOfDays`, `readingOfDayPosition` and `formatUtcReading`. On TT, TAI and TCG,
`dayLength` is a full day, so this is the nearest nanosecond to the exact double. On UTC it is the
quasi-day inverse of the leap-second day length above.

## Precision (JSDoc and tests)

The error is at most ½ ulp(result):

| Time from J2000.0 | ulp | Worst error |
| --- | --- | --- |
| under 2²⁹ s (1983 – 2017) | ≤ 2⁻²⁴ s | ≈ 30 ns |
| 2²⁹ – 2³⁰ s (to 2034-01-10, from 1972) | 2⁻²³ s | ≈ 60 ns |
| each further doubling | doubles | ≈ 15 µs at year 9999 (2³⁷ – 2³⁸ s) |

The JSDoc says that seconds since J2000 in one double keep about 0.1 µs today, and that callers
needing nanoseconds should use `toJulianDateParts`.

## JSDoc must also state

- **The default scale here is TT, unlike the JD and MJD functions, which default to UTC.** The
  reason is that J2000.0 is defined as 2000-01-01T12:00 TT (IAU 1994 C7). Put this sentence first (index D4).
- The UTC caveat from the Definition above. The domain is 1972 to 9999. TDB is not available, so
  this is not the "ephemeris seconds past J2000", which count on TDB.
- `@example`: rows 1, 2, 3 and 5 of the table below, plus one sentinel.

## Expected values — `toJ2000Seconds`

| Input | Scale | Result | Why |
| --- | --- | --- | --- |
| `2000-01-01T11:58:55.816Z` | default | `0` | J2000.0; TT − UTC = 32 + 32.184 s in 2000 |
| `2000-01-01T12:00:00Z` | default | `64.184` | |
| `2000-01-01T12:00:00Z` | `"UTC"` | `0` | |
| `2000-01-01T12:00:00Z` | `"TAI"` | `32` | |
| `2026-01-01T00:00:00Z` | `"UTC"` | `820497600` | 1 767 225 600 − 946 728 000 |
| `2026-01-01T00:00:00Z` | default | `820497669 + 0.184` | TT − UTC = 69.184 s |
| `2026-01-01T00:00:00Z` | `"TAI"` | `820497637` | |
| `2026-01-01T00:00:00Z` | `"TCG"` | `820497670 + 0.261661917` | label `…00:01:10.261661917 TCG` |
| `2016-12-31T23:59:60Z` | `"UTC"` | `536500799 + 11574 / 1e9` | (6209 × 86 400 − 43 200) + round(86 400 × 86 400 / 86 401 s) = 86 399.000011574 s |
| `2017-01-01T00:00:00Z` | `"UTC"` | `536500800` | the day after is ordinary again |
| `2016-12-31T23:59:60Z` | default | `536500868 + 0.184` | TT is continuous: the leap second gets its own TT second |
| `1999-12-31T23:59:59Z` | `"UTC"` | `-43201` | negative before J2000.0 |
| `1972-01-01T00:00:00Z` | `"UTC"` | `-883656000` | 1972 floor: (730 − 10 957) × 86 400 − 43 200 |

`tdd-dev` derives every value in a test from bigint arithmetic (a plain helper, not the core).
Where this table and that arithmetic disagree, the arithmetic is right; record the fix in the
spec. Sentinels (`null`): the same list as `toJulianDateParts`, and `"TDB"` with a cast.

## Expected values — `fromJ2000Seconds`

| Input | Scale | Result |
| --- | --- | --- |
| `0` | default | `2000-01-01T11:58:55.816Z` (Verification line, inverted) |
| `0` | `"UTC"` | `2000-01-01T12:00:00Z` |
| `820497600` | `"UTC"` | `2026-01-01T00:00:00Z` |
| `toJ2000Seconds("2026-01-01T00:00:00Z")` | default | `2026-01-01T00:00:00.000000015Z`, because the double nearest 820 497 669.184 is 820 497 669.184 000 015 26 |
| `536500799 + 11574 / 1e9` | `"UTC"` | `2016-12-31T23:59:60Z` |
| `-883656000.5` | `"UTC"` | `""` (before 1972) |

Sentinel (`""`) for `NaN`, `±Infinity`, `1e300`, a non-number, `null`, and a scale outside
`TimeScale`.

## Round trips (Verification)

- Within the bound on each scale, over the 12-instant list in `julian-date.md`.
- Exact to the nanosecond wherever `|q| < 2²⁹ s` and the fraction is a multiple of 2⁻²⁴ s. One
  row: `2000-01-01T12:00:00.5Z` on UTC.
- The `…000000015Z` row above is the explicit assertion that the round trip loses precision.
