# SPA-49 slice: julian-date-parts

`toJulianDateParts` and `fromJulianDateParts`. These are the primary forms, and they are exact to the
nanosecond. They need [core.md](core.md). Rules: [index § Authority](index.md#authority--what-each-rule-rests-on).

## Signatures and bodies

```ts
export function toJulianDateParts(isoString: string, scale: TimeScale = "UTC"): JulianDateParts | null
export function fromJulianDateParts(parts: JulianDateParts, scale: TimeScale = "UTC"): string
```

`toJulianDateParts`: if `!isTimeScale(scale)`, return `null`. Then `parseUtcReading`, `dayPositionOf`,
`julianDatePartsOf`. Return `null` at any `null`. The whole body sits in `try`/`catch` and the
catch returns `null`. Each call returns a new plain object.

`fromJulianDateParts`: return `""` when `!isTimeScale(scale)`, when `!isObject(parts)`, or when
`parts.jd1` or `parts.jd2` is not a finite `number`. Each member is read once with an ordinary
property get; a `bigint`, a numeric string and `NaN` all give `""`. Then the exact sum
`jd1 + jd2 − 2440587.5` goes to `dayPositionOfDays`, then `readingOfDayPosition`, then
`formatUtcReading`. Catch → `""`.

## Why it is exact (put this in the JSDoc, briefly)

- `jd2` is one correctly rounded division, so it is within 2⁻⁵⁴ day (0.0048 ns) of the exact value.
  Multiplied back by at most 86 401 s, that stays under 0.01 ns. Rounding to the nearest nanosecond
  therefore recovers the input: `fromJulianDateParts(toJulianDateParts(x, s), s) === canonical(x)`
  for every instant in the domain and on every scale. `canonical(x)` is `x` in `Z` form with
  Temporal's shortest fraction.
- `fromJulianDateParts` reads the parts exactly (`exactDyadic`). Any split works
  (ERFA `jd2cal.c` Note 2): `{2451545, 0}`, `{2400000.5, 51544.5}`, `{0, 2451545}` and
  `{2451545.5, -0.5}` all give the same instant, though a split that puts everything into one part has
  already lost precision in that double.

## JSDoc must state

- First sentence: the scale defaults to `"UTC"` (index D4).
- The two-part form exists because one double near JD 2 460 000 resolves only to about 40 µs.
  Point to `toJulianDate`.
- JD days begin at **noon**: midnight UTC has `jd2 = 0.5`.
- `jd1` is a whole number and `jd2` lies in [0, 1). The input can be split in any way.
- The scale defaults to `"UTC"`. On UTC the count is ERFA's quasi-JD. A leap-second day counts as one
  day, so noon on that day is not `.0`, and the difference between two UTC JDs is not an exact
  interval (ERFA `dtf2d.c` Notes 4 and 7). On TAI, TT and TCG it is a true JD, read from the
  label `toTAI` / `toTT` / `toTCG` writes. TDB is not available.
- The domain is 1972-01-01 to 9999-12-31 UTC. The sentinel is returned outside it.
- `@example` rows: the first five rows of the table below, plus one sentinel row.

## Expected values — `toJulianDateParts`

Every `jd2` below is the double a single division gives. A test derives it as
`Number(a) / Number(b)` from the stated integers; it is never typed in as a decimal.

| Input | Scale | `jd1` | `jd2` | Why |
| --- | --- | --- | --- | --- |
| `2000-01-01T12:00:00Z` | default | 2451545 | 0 | J2000.0 day, noon (`ERFA_DJ00`) |
| `2000-01-01T00:00:00Z` | default | 2451544 | 0.5 | the noon offset: midnight is `.5` |
| `2000-01-01T11:58:55.816Z` | `"TT"` | 2451545 | 0 | J2000.0 itself; TT − UTC = 64.184 s in 2000 |
| `2000-01-01T12:00:00Z` | `"TCG"` | 2451545 | 64 689 833 330 / 86 400 000 000 000 | label `…12:01:04.68983333 TCG` (`toTCG` example) |
| `2016-12-31T23:59:60Z` | default | 2457754 | 86 399 / 172 802 | quasi-JD: 86 400 s into an 86 401 s day |
| `2016-12-31T12:00:00Z` | default | 2457753 | 172 801 / 172 802 | noon on a leap-second day is not `.0` |
| `2016-12-31T23:59:60.5Z` | default | 2457754 | 86 400 / 172 802 | |
| `2017-01-01T00:00:00Z` | default | 2457754 | 0.5 | the day after is an ordinary day |
| `2026-01-01T00:00:00Z` | `"TAI"` | 2461041 | (43 200 + 37) / 86 400 | TAI − UTC = 37 s |
| `2026-01-01T00:00:00Z` | `"TT"` | 2461041 | 43 269 184 / 86 400 000 | + 32.184 s |
| `2026-01-01T00:00:00.000000001Z` | default | 2461041 | 43 200 000 000 001 / 86 400 000 000 000 | one nanosecond survives (jd2 ≠ 0.5) |
| `2026-01-01T01:00:00+01:00` | default | 2461041 | 0.5 | an offset is read as its instant |
| `2026-01-01T01:00:00+01:00[Europe/Paris]` | default | 2461041 | 0.5 | a bracketed zone is accepted |
| `1972-01-01T00:00:00Z` | default | 2441317 | 0.5 | the floor |
| `9999-12-31T23:59:59.999999999Z` | default | 5373484 | 43 199 999 999 999 / 86 400 000 000 000 | the ceiling |

Sentinel (`null`) rows: `1971-12-31T23:59:59.999999999Z` on each of the four scales;
`2017-12-31T23:59:60Z` (no leap second that day); `""`; `"not a date"`; `"2026-01-01"` (a date,
not an instant); `"2026-01-01T00:00:00"` (no offset); `+010000-01-01T00:00:00Z`; a scale of
`"TDB"` (passed with a cast); `"tt"`; `null` as the scale; a number as the scale. An explicit
`undefined` scale is the same as omitting it, and gets its own row.

Properties, each over a fixed list of 20 instants (the rows above plus the 27 leap seconds, each
read as `…T23:59:60.5Z`):

- `Number.isInteger(jd1)` and `0 ≤ jd2 < 1`, on all four scales.
- TCG agrees with SPA-47: `toJulianDateParts(x, "TCG")` equals the JD a test helper computes from
  the label `toTCG(x)` returns, and the same holds for TT with `toTT` and TAI with `toTAI`. The
  helper parses the label with `Temporal.PlainDateTime` and counts nanoseconds in bigint. It is
  not the core's code.

## Expected values — `fromJulianDateParts`

| Parts | Scale | Result |
| --- | --- | --- |
| `{jd1: 2451545, jd2: 0}` | default | `2000-01-01T12:00:00Z` |
| `{jd1: 2451545, jd2: 0}` | `"TT"` | `2000-01-01T11:58:55.816Z` |
| `{jd1: 2400000.5, jd2: 51544.5}` | default | `2000-01-01T12:00:00Z` (MJD split) |
| `{jd1: 2451545.5, jd2: -0.5}` | default | `2000-01-01T12:00:00Z` (negative `jd2`) |
| `{jd1: 0, jd2: 2451545}` | default | `2000-01-01T12:00:00Z` |
| `{jd1: 2457754, jd2: 86399/172802}` | default | `2016-12-31T23:59:60Z` |
| `{jd1: 2457754, jd2: 86400/172802}` | default | `2016-12-31T23:59:60.5Z` |
| `{jd1: 2441317, jd2: 0.5}` | default | `1972-01-01T00:00:00Z` |
| `{jd1: 2441317, jd2: 0.4999999}` | default | `""` (before 1972) |
| `{jd1: 2441317, jd2: 0.5}` | `"TAI"` | `""`: the first TAI label is `00:00:10` |
| `{jd1: 2441317, jd2: (43200+10)/86400}` | `"TAI"` | `1972-01-01T00:00:00Z` |
| `{jd1: 5373484, jd2: 0.5}` | default | `""` (10000-01-01) |
| `{jd1: 2451545, jd2: 2⁻⁴⁰}` | default | rounds to the nearest ns: `2000-01-01T12:00:00.000000079Z` (2⁻⁴⁰ day = 78.58 ns, which rounds to 79) |

The last row is the rounding check. `tdd-dev` confirms `78.58` from `86_400e9 / 2 ** 40` in the test
itself, not from this table.

Sentinel (`""`) rows: `null`; `"2451545"`; `[2451545, 0]` (an array is an object, but its
members are missing, so `""`); `{jd1: 2451545}` (no `jd2`); `{jd1: NaN, jd2: 0}`;
`{jd1: Infinity, jd2: 0}`; `{jd1: 2451545n, jd2: 0}`; `{jd1: "2451545", jd2: 0}`;
`{jd1: 1e300, jd2: 0}`; `{jd1: Number.MAX_VALUE, jd2: -Number.MAX_VALUE}` (sum 0, before 1972);
a scale outside `TimeScale`. A function carrying `jd1` and `jd2` is read like any other object
(coding-standards § API Contract).

## Round trips (the Verification lines)

- Exact: on each scale, `fromJulianDateParts(toJulianDateParts(x, s), s)` returns `x` in canonical
  form, for the 20-instant list plus `2026-03-10T14:30:00.123456789Z` and `2016-12-31T23:59:60.999999999Z`.
- TCG through SPA-47: `fromJulianDateParts(toJulianDateParts(x, "TCG"), "TCG") === fromTCG(toTCG(x))`.
- Error paths: use the `mockTemporalInstantFromEpochNanosecondsThrow` mock (from `src/test/mocks`)
  to make `formatUtcReading`'s `Temporal` call throw. The function must still return `""`.
