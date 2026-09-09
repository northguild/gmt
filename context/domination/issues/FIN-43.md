# FIN-43 — Finance: Settlement and value dates

**Scope:** Settlement date calculation for securities and FX, across multiple currency calendars.

## Gap

Settlement dates are business-day arithmetic with a twist that makes them genuinely hard: **an FX trade settles only on a day that is a business day in both currencies**, so the calculation needs two calendars merged, plus a set of exceptions that are pure market convention.

- US equities moved to **T+1 in May 2024**.
- FX spot is generally **T+2**, but **USD/CAD, USD/TRY, USD/RUB and USD/PHP are T+1**.
- **USD holidays do not affect T+1** for most pairs — but ARS, CLP and MXN are exceptions, and a USD holiday on T+1 pushes those to **T+3**.
- A forward date landing on a weekend, a local currency holiday or a USD holiday rolls forward.

None of this is derivable; it must be encoded.

([Just FX value dates](https://gojust.com/guides/fx-value-dates/), [ObjectLab currency date calculation](https://objectlabkit.sourceforge.net/currency.html))

## Scope

- `packages/gmt/src/finance/calculate/settlementDate.ts`:
  - `settlementDate(tradeDate: string, cycle: 'T+0' | 'T+1' | 'T+2' | 'T+3', calendar: BusinessCalendar): string` — Single-calendar settlement, for securities.
- `packages/gmt/src/finance/calculate/spotDate.ts`:
  - `spotDate(tradeDate: string, pair: { base: string, quote: string }, calendars: Record<string, BusinessCalendar>, options?: { usdCalendar?: BusinessCalendar }): string | null` — FX spot, honouring the two-currency rule and the USD exceptions.
  - `forwardDate(spot: string, tenor: string, pair, calendars, options?): string | null` — Forward value date with end-of-month handling.
- `packages/gmt/src/finance/get/settlementCycle.ts`:
  - `defaultSpotCycle(pair: { base: string, quote: string }): 'T+1' | 'T+2'` — The conventional cycle for a pair.

## Design notes

- **`spotDate` is not `addBusinessDays` on a merged calendar**, and implementing it that way is the standard bug. The USD exemption means USD holidays are skipped for the T+1 leg of most pairs but not for ARS, CLP and MXN. The rule set has to be explicit.
- **`defaultSpotCycle` returns a convention, not a contract.** Counterparties can and do agree otherwise, so `spotDate` accepts an override. The JSDoc must not present the default as authoritative.
- **Forward dates use the end-of-month rule**: a spot date on the last business day of a month settles a one-month forward on the last business day of the target month, not on the same day number. This is the `endOfMonth` convention from CORE-7.
- Calendars come from the caller or from the opt-in data subpath (FIN-41). GMT ships no default settlement calendar, because a wrong one produces a failed settlement.
- A settlement date is a date, not an instant. Cut-off times for same-day value are a separate concern and belong with TRAN-10's deadline model.

## What gmt provides (do not re-implement)

- `mergeCalendars` from CORE-7 — the two-currency business-day intersection
- `addBusinessDays` / `rollDate` from CORE-7 — cycle arithmetic and rolling
- `BusinessCalendar` from `types/`

## Verification

- `settlementDate` with `T+1` skips a weekend correctly
- A US equity trade on a Friday settles the following Monday under `T+1`
- `spotDate` for EUR/USD skips a day that is a holiday in either calendar
- `spotDate` for USD/CAD uses `T+1`; for EUR/USD it uses `T+2`
- A USD holiday falling on T+1 does **not** delay a standard pair, asserted explicitly
- The same USD holiday **does** push USD/MXN to T+3, asserted explicitly
- `forwardDate` from a month-end spot lands on the target month's last business day, not the same day number
- A forward landing on a weekend rolls forward
- Missing a required currency calendar returns the sentinel
- `pnpm run validate` stays green
