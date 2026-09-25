# FIN-43 — Finance: Settlement and value dates

**Scope:** Settlement date calculation for securities and FX, across multiple currency calendars.

## Gap

Settlement dates are business-day arithmetic with a twist that makes them genuinely hard: **an FX trade settles only on a day that is a business day in every calendar the leg must clear**, and which calendars apply to the value date differs from which apply to the days in between.

Settlement cycles are dated facts that change by market decision; spot cycles and which calendars a leg must clear are dealer conventions that vary by pair. Neither is derivable, and neither is GMT's to encode; the arithmetic under them is: a date that is a business day in every calendar named, with intermediate days tested against a caller-chosen subset, and a forward date that rolls forward off a closed day.

## Scope

- `packages/gmt/src/finance/calculate/settlementDate.ts`:
  - `settlementDate(tradeDate: string, cycleDays: number, calendar: BusinessCalendar): string | null` — Single-calendar settlement, for securities: `cycleDays` business days after the trade date. A negative or non-integer `cycleDays` returns the sentinel.
- `packages/gmt/src/finance/calculate/spotDate.ts`:
  - `spotDate(tradeDate: string, options: { cycleDays: number, calendars: BusinessCalendar[], intermediateCalendars: BusinessCalendar[] }): string | null` — The spot date is the `cycleDays`-th day after the trade date that is a business day in all `calendars`; each day between the trade date and the spot date counts only if it is a business day in all `intermediateCalendars`. This is the generic form of "a third calendar's holiday on the day between does or does not delay the value date".
  - `forwardDate(spot: string, tenor: string, options: { calendars: BusinessCalendar[] }): string | null` — Forward value date with end-of-month handling; the value date clears every calendar in `calendars`, and intermediate days are not tested for a forward.

## Design notes

- **`spotDate` is not `addBusinessDays` on a merged calendar.** Which calendars the intermediate days must clear differs from which the value date must clear, so the two sets are separate parameters; merging them into one calendar is the standard bug.
- **Cycles are parameters.** GMT does not infer a cycle from a market or a date; the JSDoc says a cycle is a dated market fact the caller states.
- **Calendars are identified by FpML business-center code** (`USNY`, `GBLO`, `EUTA`, `JPTO`, …) where a settlement calendar is meant, and by ISO 4217 currency code where a currency calendar is meant. FIN-41's reference data uses the same keys, so the two compose without a mapping table. ([FpML business-center scheme](https://www.fpml.org/coding-scheme/business-center))
- **Forward dates use the end-of-month rule**: a spot date on the last business day of a month settles a one-month forward on the last business day of the target month, not on the same day number. This is the `endOfMonth` convention from CORE-7.
- Calendars come from the caller or from the opt-in data subpath (FIN-41, exchange and payment-system calendars only). GMT ships no default settlement calendar, because a wrong one produces a failed settlement.
- A settlement date is a date, not an instant. Cut-off times for same-day value are a separate concern and belong with TRAN-10's deadline model.

## Corrections

- `defaultSpotCycle`, the built-in pair exception table and the JSDoc instruction to document two markets' transition dates were dealer conventions and law; removed. `spotDate` takes the cycle and both calendar sets from the caller, so FIN-44 still has a spot anchor.

## What gmt provides (do not re-implement)

- `mergeCalendars` from CORE-7 — the all-calendars business-day intersection
- `addBusinessDays` / `rollDate` from CORE-7 — cycle arithmetic and rolling
- `BusinessCalendar` from `types/`

## Verification

- `settlementDate` with `cycleDays: 1` skips a weekend: a Friday trade settles the following Monday
- `cycleDays: 1` and `cycleDays: 2` differ for the same trade date; a negative or non-integer `cycleDays` returns the sentinel
- `spotDate` with `cycleDays: 2` and two calendars skips a holiday in either
- A holiday in a calendar listed only in `calendars` and not in `intermediateCalendars` does not delay the intermediate day, asserted; the same calendar listed in both does, asserted
- `forwardDate` from a month-end spot lands on the target month's last business day, not the same day number
- A forward landing on a weekend rolls forward
- An empty `calendars` array returns the sentinel
- `pnpm run validate` stays green
