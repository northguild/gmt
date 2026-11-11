# SPA-49 slice: julian-date

`toJulianDate` and `fromJulianDate`: the single-double form. It is a convenience and it loses
precision. It needs [core.md](core.md); the rules are in [index § Authority](index.md#authority--what-each-rule-rests-on).

## Signatures and bodies

```ts
export function toJulianDate(isoString: string, scale: TimeScale = "UTC"): number | null
export function fromJulianDate(jd: number, scale: TimeScale = "UTC"): string
```

`toJulianDate` follows the same path as `toJulianDateParts` (`isTimeScale`, `parseUtcReading`,
`dayPositionOf`, `julianDatePartsOf`) and returns `jd1 + jd2`, one IEEE addition. It does not
call `toJulianDateParts`, because a public function never calls another; both call the core.

`fromJulianDate` returns `""` when `!isTimeScale(scale)` or when `jd` is not a finite `number`. Otherwise
it does what `fromJulianDateParts` does with `jd1 = jd` and `jd2 = 0`: `exactDyadic(jd) − 2440587.5`,
then `dayPositionOfDays`, `readingOfDayPosition` and `formatUtcReading`. The double is read
exactly, so the only loss is the one already in `jd`.

## The precision bound (JSDoc and tests)

`toJulianDate(x, s) === jd1 + jd2` for the parts of `x` on `s`. The parts are exact to well under a
nanosecond, so the only loss is the addition:

`|toJulianDate(x) − JD_exact| ≤ ½ ulp(result) + ½ ulp(jd2)` days.

| Years (JD range) | ulp(JD) | Worst error | In seconds |
| --- | --- | --- | --- |
| 1972 – 6771 (2²¹ ≤ JD < 2²²) | 2⁻³¹ day | 2⁻³² day + 2⁻⁵⁴ day | 20.1 µs |
| 6771 – 9999 (2²² ≤ JD < 2²³) | 2⁻³⁰ day | 2⁻³¹ day + 2⁻⁵⁴ day | 40.2 µs |

The JSDoc says: **"A single double resolves a Julian Date only to about 40 µs (2⁻³¹ day) for
dates from 1972 to 6771, so any one value can be up to 20 µs off; after 6771, 80 µs and 40 µs. Use
`toJulianDateParts` for nanosecond precision, or `toModifiedJulianDate`, which keeps about 64 times
more digits for dates before 2038."** It does not say "~100 µs" (index Correction 3).

Tests take ulp from a helper in `src/test/` (`ulp(x) = 2 ** (Math.floor(Math.log2(Math.abs(x))) − 52)`,
with a guard for exact powers of two). The bound is written as the formula above, never as a
constant.

## JSDoc must also state

- First sentence: the scale defaults to `"UTC"` (index D4).
- JD days begin at noon. The default scale is `"UTC"`, a quasi-JD, the same as `toJulianDateParts`
  (one bullet; point to it rather than repeating it).
- The domain is 1972 to 9999. TDB is not available.
- `@example` rows: the first four rows of the table below, plus one sentinel row.

## Expected values — `toJulianDate`

| Input | Scale | Result | Why |
| --- | --- | --- | --- |
| `2000-01-01T12:00:00Z` | default | `2451545` | J2000 day, noon |
| `2000-01-01T00:00:00Z` | default | `2451544.5` | midnight is `.5` |
| `2000-01-01T11:58:55.816Z` | `"TT"` | `2451545` | J2000.0 |
| `2026-01-01T12:00:00.00002Z` | default | `2461041` | the 20 µs are lost: 20 µs < ½ ulp = 20.1 µs |
| `2026-01-01T12:00:00.00003Z` | default | `2461041 + 2 ** -31` | rounds up to the next double |
| `2016-12-31T23:59:60Z` | default | `2457754 + 86399 / 172802` (computed in the test as that sum) | |

For every row in julian-date-parts' `toJulianDateParts` table, `toJulianDate(x, s)` equals the
sum `jd1 + jd2` of those parts. Each sentinel input there also gives `null` here.

## Expected values — `fromJulianDate`

| Input | Scale | Result |
| --- | --- | --- |
| `2451545` | default | `2000-01-01T12:00:00Z` |
| `2451545` | `"TT"` | `2000-01-01T11:58:55.816Z` |
| `2451544.5` | default | `2000-01-01T00:00:00Z` |
| `2461041` | default | `2026-01-01T12:00:00Z` |
| `2461041 + 2 ** -31` | default | `2026-01-01T12:00:00.000040233Z` (2⁻³¹ × 86 400 s = 40 233.135 ns, rounded to 40 233) |
| `2441317.5` | default | `1972-01-01T00:00:00Z` |
| `2441317.4` | default | `""` |
| `5373484.5` | default | `""` (year 10000) |

Sentinel (`""`): `NaN`, `Infinity`, `-Infinity`, `"2451545"`, `2451545n`, `null`, `undefined`
as `jd`, `1e300`, and a scale outside `TimeScale`.

## Round trips (Verification: "loses precision, asserted against the bound")

Over a list of 12 instants that includes 2000, 2026, the 27 leap seconds read as `…:60.5Z`,
`6800-06-01T00:00:00.123456789Z` and `9999-12-31T23:59:59.999999999Z`, on each scale:

- `|ns(fromJulianDate(toJulianDate(x))) − ns(x)| ≤ bound(x) + 0.5 ns`, where `bound` is the
  formula above in nanoseconds (`ulp × 86 400e9 / 2` plus the `jd2` term). On UTC leap-second days,
  multiply by 86 401 / 86 400.
- At least one instant **fails** an exact round trip. `2026-01-01T12:00:00.00002Z` comes back as
  `…12:00:00Z`. This is the explicit "loses precision" assertion. It is a normal `expect`, not
  `it.fails`.
