# FIN-44 — Finance: Tenors and IMM dates

**Scope:** Tenor arithmetic and the standardised roll dates derivatives settle on.

## Gap

Financial instruments are quoted by tenor (`ON`, `1W`, `3M`, `2Y`), not by date, and converting a tenor to a date is not simply adding months — it interacts with business-day conventions and the end-of-month rule.

Separately, exchange-traded interest rate and FX futures settle on **IMM dates**: the third Wednesday of March, June, September and December. Quarterly roll schedules, futures expiries and swap conventions all key off them, and they cannot be derived from a generic date library.

## Scope

- `packages/gmt/src/finance/calculate/tenorDate.ts`:
  - `tenorDate(from: string, tenor: string, calendar: BusinessCalendar, options?: { convention?: RollConvention, endOfMonth?: boolean }): string | null` — Resolves a tenor to a date. Defaults to `modifiedFollowing`.
  - `parseTenor(tenor: string): { count: number, unit: 'D' | 'W' | 'M' | 'Y' } | 'ON' | 'TN' | 'SN' | null`
- `packages/gmt/src/finance/get/immDate.ts`:
  - `immDate(year: number, month: number): string | null` — Third Wednesday of the given month; the sentinel for non-IMM months unless `anyMonth` is set.
  - `nextImmDate(isoString: string, options?: { anyMonth?: boolean }): string`
  - `immDatesBetween(start: string, end: string, options?: { anyMonth?: boolean }): string[]`
  - `isImmDate(isoString: string): boolean`

## Tenor codes

| Code | Meaning |
| --- | --- |
| `ON` | Overnight — today to the next business day |
| `TN` | Tomorrow/next — the next business day to the one after |
| `SN` | Spot/next — spot date to the following business day |
| `1D`, `1W`, `3M`, `2Y` | Count plus unit |

## Design notes

- **`ON`, `TN` and `SN` are not durations** and cannot be parsed as count-plus-unit. They are relative to today or to spot, which is why `parseTenor` returns a union rather than always yielding a count. Treating `ON` as `1D` is wrong across a weekend.
- **The end-of-month rule is opt-in and interacts with the roll convention.** A `3M` tenor from 31 January lands on 30 April with `endOfMonth`, and on the modified-following adjustment of 30 April without it. Both are used; the caller must choose.
- **Month arithmetic must constrain, not overflow.** `1M` from 31 January is 28 or 29 February, never 2 or 3 March. This is Temporal's `overflow: 'constrain'`, and the JSDoc must say so.
- **IMM months default to the quarterly cycle.** `anyMonth` exists because serial monthly contracts also use third Wednesdays, but the quarterly set is the default because that is what "IMM date" means unqualified.

## What gmt provides (do not re-implement)

- `addBusinessDays` / `rollDate` / `BusinessCalendar` from CORE-7 — business-day arithmetic and conventions
- `spotDate` from FIN-43 — the anchor for `SN`
- `addZoned` with `overflow: 'constrain'` — month arithmetic
- `getZonedDateTimeFields` — weekday extraction for IMM

## Verification

- `parseTenor('3M')` returns count 3 and unit `'M'`
- `parseTenor('ON')` returns the overnight form, not `1D`
- `tenorDate` for `1M` from 31 January returns the last day of February, never March
- `tenorDate` with `endOfMonth` from a month-end date lands on the target month end
- `tenorDate` landing on a holiday rolls per the supplied convention
- `modifiedFollowing` at a month end rolls backward, not forward
- `immDate(2026, 3)` returns the third Wednesday of March 2026
- `immDate` for a non-quarterly month returns the sentinel by default and a date with `anyMonth`
- `nextImmDate` called on an IMM date returns the **next** one, not the same day
- `immDatesBetween` over a year returns four dates by default
- `pnpm run validate` stays green
