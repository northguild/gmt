# SPA-49 slice: core

The type, the guard, the day-length lookup and one internal core that all eight public functions
call. Build it first. Authority rows: [index § Authority](index.md#authority--what-each-rule-rests-on).

## `types/time-scale.ts` (new), re-exported from `types/index.ts`

```ts
/**
 * A time scale a Julian Date, Modified Julian Date or J2000 count can be taken on: UTC, TAI,
 * Terrestrial Time or Geocentric Coordinate Time. TDB is not one: GMT does not provide it.
 */
export type TimeScale = "UTC" | "TAI" | "TT" | "TCG";

/** A Julian Date in two parts, whose sum is the JD (ERFA `jd2cal.c` Note 2). */
export interface JulianDateParts {
  /** Whole days. `to*` writes a whole number; `from*` accepts any finite number. */
  jd1: number;
  /** The rest of the day. `to*` writes a value from 0 up to but not including 1. */
  jd2: number;
}
```

`isTimeScale(value: unknown): value is TimeScale` goes in `internal/julianDate.ts`, written as
`isGnssSystem` is (`typeof value === "string" && Object.hasOwn(TABLE, value)`).

## `internal/leapSeconds.ts`: `utcDayLengthNanoseconds(steps, epochDay: bigint): bigint`

The length of the UTC day that starts at `epochDay × NANOSECONDS_PER_DAY`: 86 400 s plus the step
whose row starts at the next midnight, if there is one (`stepAt`, already in the module). It gives
`86_401_000_000_000n` for 2016-12-31 and `86_400_000_000_000n` for 2017-01-01, 2016-12-30 and every day
before the first row. A negative step gives 86 399 s; the table has none, so a test row checks it
on a hand-built `LeapSecondSteps`. Loop bound: one scan of `steps.at` (28 rows).

Test rows: all 27 inserted-second days give 86 401 s (read each from `ROWS`, not typed again);
the day after each gives 86 400 s; 1972-01-01 gives 86 400 s.

## `internal/julianDate.ts` (new)

Pure bigint and number arithmetic. It makes no Temporal call (parsing and formatting stay in
`utcReading.ts`), does nothing at import time, and has no loop of its own.

### Constants

Each is asserted in `julianDate.test.ts` against a Temporal day count (as `foreignEpochs.test.ts`
does), never against the code that uses it.

| Name | Value | Check |
| --- | --- | --- |
| `MJD_OF_UNIX_EPOCH` | `40_587n` | `PlainDate("1858-11-17").until("1970-01-01").days` |
| `JD_OF_UNIX_EPOCH_MIDNIGHT_HALF_DAYS` | `4_881_175n` (2 × 2440587.5) | `= 2 × (JULIAN_DAY_OF_UNIX_EPOCH) − 1` |
| `J2000_EPOCH_DAY` | `10_957n` | `PlainDate("1970-01-01").until("2000-01-01").days` |
| `UTC_JD_FLOOR_NANOSECONDS` | `63_072_000_000_000_000n` | `LEAP_SECOND_STEPS.at[0]` (1972-01-01T00:00:00Z); reuse it, don't copy it |

`LAST_FOUR_DIGIT_UTC_NANOSECONDS` (in `utcReading.ts`) is the upper bound.

### `DayPosition`

```ts
interface DayPosition {
  readonly epochDay: bigint;    // days since 1970-01-01 on the scale's own label
  readonly nanosOfDay: bigint;  // 0 ≤ nanosOfDay < dayLength
  readonly dayLength: bigint;   // NANOSECONDS_PER_DAY, or 86 401 s on a UTC leap-second day
}
```

### `dayPositionOf(steps, reading: UtcReading, scale: TimeScale): DayPosition | null`

1. `null` when `reading.epochNanoseconds` is outside [`UTC_JD_FLOOR_NANOSECONDS`,
   `LAST_FOUR_DIGIT_UTC_NANOSECONDS`].
2. `const tai = taiOfUtc(steps, reading)`, then `null` when it is null. On every scale this does the
   validation: a second 60 on a day with no insertion, or a reading inside a deleted second, gets
   no count.
3. Label nanoseconds (UTC-style epoch nanoseconds of the label):
   - `TAI`: `tai`. `TT`: `tai + TT_MINUS_TAI_NANOSECONDS`. `TCG`: `tt + tcgMinusTtNanoseconds(tt)`.
   - Then `epochDay = floorDivide(label, DAY)`, `nanosOfDay = label − epochDay × DAY`,
     `dayLength = DAY`.
   - `UTC`: `epochDay = floorDivide(reading.epochNanoseconds, DAY)`; `nanosOfDay` = the remainder
     plus 1 s when `reading.secondSixty`; `dayLength = utcDayLengthNanoseconds(steps, epochDay)`.
     So `…T23:59:60.5Z` has `nanosOfDay = 86 400.5 s` on an 86 401 s day.

### `readingOfDayPosition(steps, epochDay, nanosOfDay, scale): UtcReading | null`

The inverse. `nanosOfDay` has already been rounded and lies in [0, dayLength).

- `UTC`: when `nanosOfDay ≥ DAY` (possible only on an 86 401 s day) the reading is
  `{ epochNanoseconds: epochDay × DAY + nanosOfDay − 1 s, secondSixty: true }`, otherwise
  `{ epochDay × DAY + nanosOfDay, false }`. `null` before `UTC_JD_FLOOR_NANOSECONDS`.
- `TAI`: `utcOfTai(steps, label)`. `TT`: `utcOfTt(steps, label)`. `TCG`:
  `utcOfTt(steps, ttOfTcg(label))`. These are already null before 1972.
- The caller passes the result to `formatUtcReading`, which returns `""` past year 9999.

### Reading doubles exactly: `exactDyadic(x: number): { numerator: bigint; exponent: bigint }`

`x = numerator / 2^exponent`, exactly, with `exponent ≥ 0`. It reads the sign, the 11-bit exponent
and the 52-bit significand through a `DataView` (`getBigUint64`), and handles subnormals and ±0.
Callers have already rejected non-finite values. Test rows: `0`, `-0`, `0.5`, `2451545`, `0.1`
(numerator `3602879701896397n`, exponent `55n`), `Number.MIN_VALUE`, `-2.75`, `2 ** 60`.

### `dayPositionOfDays(daysNumerator: bigint, daysDenominator: bigint, steps, scale): {epochDay, nanosOfDay} | null`

The inverse core: it takes days since 1970-01-01T00:00 on the scale as an exact fraction and returns a day
position.

1. `epochDay = floorDivide(n, d)`. The rest of the day is `r / d` with `r = n − epochDay × d`.
2. `dayLength` = DAY, or `utcDayLengthNanoseconds(steps, epochDay)` on UTC.
3. `nanosOfDay = floorDivide(2 × r × dayLength + d, 2 × d)`. This rounds to the nearest nanosecond,
   and a half rounds up (the halfExpand row).
4. When `nanosOfDay === dayLength`, carry: `epochDay + 1`, `nanosOfDay = 0n`.
5. Return `null` straight after step 1 when `epochDay` is outside [`729n`, `2_932_897n`].
   1972-01-01 is day 730 and 9999-12-31 is day 2 932 896; one day of slack on each side lets a
   TT, TAI or TCG label that lies just across a UTC bound still reach the exact checks in
   `readingOfDayPosition` and `formatUtcReading`. Because of this check, `1e300` never reaches
   the day-length scan.

The callers build `n / d`:

- From JD parts: `jd1 + jd2 − 2440587.5`. Bring the parts' `exactDyadic` values and
  `JD_OF_UNIX_EPOCH_MIDNIGHT_HALF_DAYS / 2` to a common power-of-two denominator.
- From MJD: `mjd − 40587`.
- From J2000 seconds `s`: `(s + 43 200) / 86 400 + 10 957`.

Where the double is a whole number, the denominator is 1, so `fromJulianDate(2451545)` does no
fractional work.

### Doubles out

- `fractionOfDay(position): number` is `Number(nanosOfDay) / Number(dayLength)`. Both values are
  below 2⁵³, so the result is one correctly rounded division.
- `julianDatePartsOf(position): JulianDateParts`. When `2 × nanosOfDay ≥ dayLength`:
  `jd1 = 2440588 + epochDay` and `jd2 = Number(2 × nanosOfDay − dayLength) / Number(2 × dayLength)`.
  Otherwise `jd1 = 2440587 + epochDay` and `jd2 = Number(2 × nanosOfDay + dayLength) / Number(2 × dayLength)`.
  Each numerator is below 2 × 86 401 × 10⁹ < 2⁵³, so `jd2` comes from one division and lies in [0, 1).
- The single-value, MJD and J2000 forms are built in their own slices from these two functions.

## Edge cases the core's own tests cover

- `dayPositionOf` on each scale at `2000-01-01T12:00:00Z`: UTC `{10957, 43 200 s, DAY}`;
  TAI `{10957, 43 232 s, DAY}`; TT `{10957, 43 264.184 s, DAY}`;
  TCG `{10957, 43 264.68983333 s, DAY}` (`toTCG`'s JSDoc example).
- UTC `2016-12-31T23:59:60Z` → `{17166, 86 400 s, 86 401 s}`; `2016-12-31T23:59:59.999999999Z` →
  `{17166, 86 399.999999999 s, 86 401 s}`; `2017-12-31T23:59:60Z` → `null`.
- `1971-12-31T23:59:59.999999999Z` → `null` on all four scales; `1972-01-01T00:00:00Z` →
  UTC `{730, 0, DAY}`.
- `readingOfDayPosition(dayPositionOf(x))` equals the reading for x = the 1972 floor,
  `2016-12-31T23:59:60.999999999Z`, `9999-12-31T23:59:59.999999999Z`, and each scale.
- `dayPositionOfDays` carry: a fraction that rounds up to `dayLength` lands on the next day at 0.
- A half rounds up: `r/d = 1/(2 × 86 400 × 10⁹)` gives `nanosOfDay = 1n`, not `0n`.
