# Slice 6 — Holidays as sorted epoch days

Read with [index.md](./index.md). Story scope part 7 (holidays) and the business-day half of the
speed targets. Slices 7 and 8 build on the module and the array this slice adds.

Target (story verification): `businessDaysBetween` and `addBusinessDays` with 480 holidays carry
no per-call cost that grows with the holiday count beyond reading the caller's array and a
binary search. Baselines: 3.37 ms and 2.16 ms (1 year, 480 holidays).

## Today

- `parseHolidays` (`businessCalendar.ts:57`) runs `isValidDate` and `Temporal.PlainDate.from` on
  every holiday on every call and stores `PlainDate#toString()` strings in a `Set<string>`.
- `isBusinessEpochDay` (`:215`) formats each walked day back to a string (`isoDateString`) to
  look it up.
- `businessDaysBetween` parses each holiday a second time inside `countBusinessDates` (`:32`),
  and `mergeCalendars` sorts with `Temporal.PlainDate.compare` on strings.
- `stepBusinessDates` and `businessDateFrom` walk one day at a time, up to
  `MAX_BUSINESS_DAY_STEPS` (200,000).

Verified behaviour that must not change: `isValidDate` rejects `2024-07-04[u-ca=hebrew]`,
`2024-07-04T10:00` and `20240704`, so a holiday is always an ISO-calendar date; it accepts
`+002024-07-04` and `2024-07-04[u-ca=iso8601]`, which mean the same day as `2024-07-04`.

## A. `internal/epochDay.ts` (new)

Move from `businessCalendar.ts`, unchanged in body, and export: `epochDayOf`, `isoFieldsOf`,
`isoDateString`, `epochDayOfDate`, `MIN_EPOCH_DAY`, `MAX_EPOCH_DAY`, and add:

```ts
/** ISO weekday of an epoch day, Monday 1 to Sunday 7 (index authority row "ISO weekday"). */
export function isoWeekdayOf(epochDay: number): number;
/** Index of the first element of `days` (sorted ascending) that is >= `epochDay`. */
export function lowerBound(days: Int32Array, epochDay: number): number;
/** Members of `days` within [from, to]; 0 when from > to. Two binary searches. */
export function countWithin(days: Int32Array, from: number, to: number): number;
export function hasEpochDay(days: Int32Array, epochDay: number): boolean;
```

`Int32Array`: every epoch day Temporal can hold lies within ±100,000,001, inside 32 bits.
`isoWeekdayOf` replaces the inline formula in `isBusinessEpochDay`; keep its comment about `%`.

## B. The holiday memo

In `businessCalendar.ts`, a module-level `Map<string, number>` from a raw holiday string to its
epoch day. Nothing at import time.

- A miss runs today's path: `typeof holiday === "string" && isValidDate(holiday)`, then
  `epochDayOfDate(Temporal.PlainDate.from(holiday))`. Store only a valid result; an invalid
  string makes `parseHolidays` return `null` as today and is not stored.
- Bound: 65,536 entries. When an insert would pass it, clear the map and insert. Clearing loses
  speed, never correctness (index authority row: memo soundness; `isValidDate` and
  `PlainDate.from` on an ISO string are pure functions of the string).
- Test seam: export `clearHolidayMemo()` (internal, tests only).

## C. `parseHolidays` and `ResolvedBusinessCalendar`

```ts
export type ResolvedBusinessCalendar = {
  weekend: Set<number>;
  /** Every holiday, sorted ascending, no repeats. */
  holidays: Int32Array;
  /** The holidays that fall on a working weekday: the only ones that change a count. */
  closures: Int32Array;
};
export function parseHolidays(holidays: unknown): Int32Array | null;
```

- `parseHolidays` reads the array once (O(H) memo lookups). If the epoch days come out strictly
  ascending, it keeps them as they are; otherwise it sorts (`Int32Array#sort`, numeric) and drops
  repeats. Lists are usually written in date order, so the sort rarely runs.
- `closures` is built in `parseBusinessCalendar`, where the weekend is known: one pass keeping
  each holiday whose `isoWeekdayOf` is not in `weekend`.
- `DEFAULT_BUSINESS_CALENDAR` gets two empty arrays. The array is never mutated after creation;
  the default is shared, so state that in its comment.

## D. Counting and stepping

```ts
/** Business days in [from, to] (epoch days, from <= to); 0 when from > to. */
export function businessDaysWithin(from: number, to: number, calendar: ResolvedBusinessCalendar): number;
```

Whole weeks give `7 - weekend.size` each; the at most six leftover days are checked one by one
with `isoWeekdayOf`; then subtract `countWithin(calendar.closures, from, to)`. O(log H).

`isBusinessEpochDay(day, calendar)` becomes `!weekend.has(isoWeekdayOf(day)) &&
!hasEpochDay(calendar.closures, day)`. Export it.

**`stepBusinessDates`** (count `n > 0`) and **`businessDateFrom`** (the first business day at or
beyond the start) find their answer by binary search on the distance, since
`businessDaysWithin` is monotone in the far end. They must return, throw and give up exactly as
the day-by-day walk does today:

| Walk | Days it may reach (forward; mirror for backward) | Wanted |
| ---- | ------------------------------------------------ | ------ |
| `stepBusinessDates(s, +1, n)` | `s + 1` .. `s + 200,000` | smallest `d` with `businessDaysWithin(s + 1, d) = n` |
| `businessDateFrom(s, +1)` | `s` .. `s + 200,000` | smallest `d` with `businessDaysWithin(s, d) = 1` |

1. Let `reach` be the last day the walk may reach, and `limit` the last day within
   `MIN_EPOCH_DAY` .. `MAX_EPOCH_DAY` in that direction.
2. Count over the reachable days up to `min(reach, limit)`. If the count reaches the target,
   binary-search `d` in that range and return it (`dateAt` as today).
3. Otherwise, if `reach` is past `limit`, throw the `RangeError` the walk throws today (the walk
   would have stepped past the limit before giving up). Else return `null` (the cap).

`n = 0` still returns the date unchanged without a count. O(log(200,000) · log H) per call.

## E. Callers

| File | Change |
| ---- | ------ |
| `calendar/business/businessDaysBetween.ts` | Parse each date once with `Temporal.PlainDate.from` (it parses twice today, after `isValidDate`), take `epochDayOfDate` of both, and return `±businessDaysWithin(from + 1, to, calendar)`. Delete `countBusinessDates` |
| `calendar/business/mergeCalendars.ts` | Union the `holidays` arrays into one sorted unique `Int32Array`; output `Array.from(merged, isoDateString)`. No Temporal compare. The weekend union is unchanged |
| `internal/businessCalendar.ts` `isBusinessDate` | `isBusinessEpochDay(epochDayOfDate(date), calendar)`. Both callers pass ISO dates: `isBusinessDay` after `isValidDate`; the free-time ledger from zoned days in the ISO calendar |
| `internal/operatingSchedule.ts` | `holidays: Int32Array`; `windowsOn` uses `hasEpochDay(schedule.holidays, epochDayOfDate(date))`. `parseScheduleHolidays` returns `new Int32Array(0)` for `undefined`. Slice 7 replaces this path; this keeps it compiling and correct meanwhile |
| `rollDate`, `businessDayValues`, `adjustZonedBusinessDays`, `isBusinessDay`, `freeTimeLedger` | No change beyond the type: they call `businessDateFrom`, `stepBusinessDates` or `isBusinessDate` |

`mergeCalendars` output strings must equal today's: `isoDateString` is documented as
`PlainDate#toString` for an ISO date, including the six-digit `+`/`-` year form; the existing
rows with expanded years hold that.

## Tests

Existing rows in every business-day test stay green unchanged. Add, with expected values worked
from a printed calendar (weekday from the ECMA-262 formula, never from the old code):

`internal/epochDay.test.ts` (new):

| Input | Expected |
| ----- | -------- |
| `isoWeekdayOf(0)` (1970-01-01) | 4 |
| `isoWeekdayOf(-1)` (1969-12-31) | 3 |
| `isoWeekdayOf(epochDayOf(-271821, 4, 19))` | 1 (Monday; cross-checked against `PlainDate#dayOfWeek` in the row's comment) |
| `isoWeekdayOf(epochDayOf(275760, 9, 13))` | 6 (Saturday; same check) |
| `countWithin([1, 3, 5], 2, 5)` / `(6, 9)` / `(5, 4)` | 2 / 0 / 0 |
| `lowerBound` on an empty array | 0 |

`internal/businessCalendar.test.ts`:

| Row | Expected |
| --- | -------- |
| `parseHolidays(["2024-07-04", "+002024-07-04", "2024-07-04[u-ca=iso8601]"])` | one epoch day, 19908 |
| `parseHolidays(["2024-12-25", "2024-01-01"])` | `[19723, 20082]` (sorted) |
| `parseHolidays(["2024-07-04[u-ca=hebrew]"])`, `(["2024-07-04T10:00"])`, `([20240704])` | `null` |
| The same valid list twice, `clearHolidayMemo()` before the first | equal arrays; the second call reaches `PlainDate.from` zero times (spy) |
| 65,537 distinct valid strings, then the first again | correct epoch day after the clear |
| `closures` for weekend `[6, 7]` and holidays on Sat 2024-07-06 and Thu 2024-07-04 | `[19908]` only |
| `stepBusinessDates` from `+275760-09-05` forward 10 with a Mon–Fri week | throws `RangeError` (walks past the limit), as today |
| Weekend `[1, 2, 3, 4, 5, 6]`, `stepBusinessDates` n = 1 from Sunday 2024-06-30, every Sunday in the next 200,000 days a holiday (28,571 dates; build them in the test) | `null` (the cap), as today |
| The same with the last of those Sundays removed | that Sunday: the cap's last reachable day still counts |
| `businessDateFrom` on a run of 40 consecutive holidays | the first weekday after the run |

`businessDaysBetween.test.ts`, `addBusinessDays.test.ts`: one row each with 480 holidays over a
30-year range whose expected count is worked as weeks × 5 − weekday holidays (state the
arithmetic in the row's comment).

Differential check (not a test): `businessDaysBetween` and `addBusinessDays` over a grid of 1,000
random (start, span, weekend, holiday list) inputs, old against new. Any difference is a defect in
the new code.

## Bench and size

`businessDays.bench.ts` rows from slice 1, before and after. `internal/temporalCompat/` stays in
`pnpm size --files addBusinessDays` after this slice: `isValidTimeZone` pulls it in through
`zonedDateTimeFrom`, not the walk. Slice 9 § C removes that import.

## Done when

- No `Set<string>` of holidays remains; `rg 'holidays\.has' packages/gmt/src` matches nothing.
- `businessDaysBetween` and `addBusinessDays` at 480 holidays show no growth from 1 year to 30
  years and no Temporal call per holiday on a warm call.
- `pnpm run validate` green; the size check passes.
