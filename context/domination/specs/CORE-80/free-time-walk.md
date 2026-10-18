# Slice 8 — Free-time ledger: counts by closed form

Read with [index.md](./index.md), then [schedule-walk.md](./schedule-walk.md) § B and § C
(`offsetTimeline`, `startOfDayNs`) and [holiday-days.md](./holiday-days.md) § D
(`businessDaysWithin`). Story scope part 6. Target: `chargeableDays` 10 years ≤ 2x 1 year, warm,
for the slice-1 rows (`America/Port_of_Spain`, `Europe/London`, and the working basis with 480
holidays); cold reported beside it. Baselines: Port_of_Spain 2 weeks 3.16 ms, 1 year 23.0 ms,
10 years 196 ms; London 3.42, 20.7, 190 ms; working basis 1 year 24.1 ms, 10 years 231 ms.

## Today

`walkFreeTime` (`freeTimeLedger.ts:270`) visits each local day with `nextLocalDay`
(`nextZonedBucketStart`, up to `MAX_REVISITED_BUCKETS` buckets) and `isBusinessDate`, about 15
Temporal operations a day, and returns `LedgerDay`s holding a `ZonedDateTime` and a date string.
Callers: `chargeableDays` (`used`, `charged.length`, `expiresAt`, the charged dates) and
`freeTimeExpiry` (`free[0].date`, `free[allowed − 1].date`, `expiresAt`).

## What the walk computes, stated on dates

Let the **visited dates** be the local dates from the event date `E` on, ascending, each once,
skipping a date whose day bucket is empty (`startOfDayNs(d) = startOfDayNs(d + 1)`: the zone
deleted it, as `Pacific/Apia` 2011-12-30). Index them `0, 1, 2, …` (`E` is index 0). Then today's
loop is exactly:

| Quantity | Definition |
| -------- | ---------- |
| first day `F` | index 0, or index 1 under `"nextDay"` |
| counted | `calendar === null`, or `isBusinessEpochDay(d, calendar)` |
| free days | the first `freeDays` counted visited dates from `F` |
| expiry date `X` | the visited date after the last free day; with `freeDays = 0`, the first counted visited date from `F` |
| `expiresAt` | `startOfDayNs(X)` |
| `last` | `clockEnd − 1 ns`, or `clockEnd` for a zero-length dwell (unchanged) |
| touched | `startOfDayNs(d) ≤ last` |
| `used` | free days touched |
| charged | visited dates `d ≥ X`, touched, and charging (`chargeCalendar === null` or a business day on it) |
| end index `R` | no `clockEnd`: index of `X`. With one: the first index `≥ index(X)` whose date is not touched |
| cap | `null` when `R > MAX_WALKED_DAYS` (the loop runs `i ≤ MAX_WALKED_DAYS`, 10,001 visits) |

The event day under `"nextDay"` is never charged: `X > E` there, so the rule holds by itself.

## The closed form

`walkFreeTime` keeps its signature for the arguments and returns integers:

```ts
export interface FreeTimeLedger {
  firstFree: number | null;   // epoch day; null when freeDays = 0
  lastFree: number | null;
  expiresAtNs: bigint;
  used: number;
  charged: number[];          // epoch days, ascending
}
```

1. `E` = the local date of `clockStart` (`offsetOf` on the timeline); the timeline starts a day
   before `startOfDayNs(E)` and grows in chunks as the searches below need later dates.
2. **Deleted dates**: only a change can delete a date, so they are found per change in the
   timeline (check the dates either side of each change). Keep them as a sorted `Int32Array`
   `deleted`; `countWithin` gives how many lie in a range.
3. **Counted days in `[a, b]`**: calendar basis `(b − a + 1) − countWithin(deleted, a, b)`;
   working basis `businessDaysWithin(a, b, calendar)` minus the deleted dates in `[a, b]` that are
   business days.
4. **`lastFree`**: binary search for the smallest `d` with `counted(F, d) = freeDays`, over at most
   `MAX_WALKED_DAYS + 1 + countWithin(deleted, …)` dates from `E`. Not found there: `null` (cap).
   `firstFree` the same with 1. `X` = the next visited date after `lastFree` (or, at
   `freeDays = 0`, the first counted from `F`).
5. **`D`** = the latest date with `startOfDayNs(D) ≤ last`: binary search on `d`, since
   `startOfDayNs` never decreases.
6. `used` = `counted(firstFree, min(lastFree, D))`, 0 when empty. Charged dates: the visited
   dates in `[X, D]` that charge, emitted ascending, skipping weekends by weekday and holidays and
   deleted dates by walking the two sorted arrays alongside. O(charged + weeks).
7. `R` from the indices (`index(d) = d − E − countWithin(deleted, E, d − 1)`); `null` when
   `R > MAX_WALKED_DAYS`.

**The pre-check.** `certainlyTouchesMoreBuckets` stays, but runs only when the UTC day count
between `clockStart` and `last` exceeds `MAX_WALKED_DAYS − 2`. Below that the dwell cannot touch
more local days than the cap, so the check could only answer false: skipping it changes no
answer.

**Temporal's limits.** When `E` or `D` lies within 2 days of Temporal's first or last date, or
`expiresAt` would, the slice keeps today's day-by-day walk for the whole call (it holds the
`clamped` event day and the unrepresentable-expiry rules). Rename it `walkFreeTimeByDay`; the
integer form calls it in that case only.

## Callers

| File | Change |
| ---- | ------ |
| `intermodal/calculate/chargeableDays.ts` | `chargedDates: ledger.charged.map(isoDateString)`; `chargeableDays: charged.length`; `expiresAt: instantText(ledger.expiresAtNs)` |
| `intermodal/calculate/freeTimeExpiry.ts` | `freeTimeStart: isoDateString(firstFree)`, `lastFreeDay: isoDateString(lastFree)`, `expiresAt` as above |

`expiresAt` equals today's `frameInstant(…).toString()`: the timeline's offsets include
`frame.shiftNanoseconds` (slice 7 § B), so `startOfDayNs` is the real instant, and
`Instant#toString` prints it the same way. `isoDateString` is `PlainDate#toString` for an ISO
date (slice 6). `LedgerDay` and `nextLocalDay` move with `walkFreeTimeByDay`.

## Tests

Every `intermodal/` row stays green unchanged. Add, with values worked by hand and checked
against the JSDoc examples:

| Row | Expected |
| --- | -------- |
| `freeTimeExpiry("2024-01-01T10:00:00Z", 10000, { basis: "calendar", timeZone: "UTC", firstDay: "eventDay" })` | `lastFreeDay` `"2051-05-18"`, `expiresAt` `"2051-05-19T00:00:00Z"`: expiry at index 10,000, inside the cap |
| the same with 10001 | `null`: expiry at index 10,001 |
| `chargeableDays("2011-12-27T12:00:00Z", "2012-01-03T12:00:00Z", 1, calendar/calendar, "Pacific/Apia", "eventDay")` | 7 charged, dates from `"2011-12-28"` with no `"2011-12-30"` (deleted) |
| `chargeableDays("2010-11-04T12:00:00Z", "2010-11-10T12:00:00Z", 1, calendar/calendar, "America/Goose_Bay", "eventDay")` | 6 charged, `"2010-11-06"` once |
| working basis, 480 holidays, `Europe/London`, a 10-year dwell | `chargeableDays` = business days in the charged range minus weekday holidays (state the arithmetic) |
| `"nextDay"`, `freeDays = 0`, an event on a Saturday with a working basis | expiry at the next Monday's start; the Saturday never charged |
| zero-length dwell at a day start | that day touched, as `dwellTime` counts |
| a dwell of 10,001 local days | `null` from the pre-check, as today |

Differential check (not a test): `chargeableDays` and `freeTimeExpiry` over 1,000 random dwells
of up to 12 years in `Europe/London`, `America/Port_of_Spain`, `Pacific/Apia` (2011),
`America/Goose_Bay` (2010), `+05:45:30`, both bases and both `firstDay`s, old against new.

## Bench

`chargeableDays.bench.ts` rows from slice 1, before and after, plus a cold row.

## Done when

- `walkFreeTime` does no per-day Temporal work away from Temporal's limits; `chargedDates` is the
  only output that grows with the dwell.
- 10 years ≤ 2x 1 year warm; all `intermodal/` tests green; `pnpm run validate` green.
