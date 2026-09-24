# FIN-72 — Finance: Risk-free-rate compounding period conventions

**Scope:** The date structure under compounded and averaged overnight rates — which observation date supplies the rate for each day of a calculation period, and with what weight — under the ISDA 2021 conventions: observation period shift, lookback, lockout and payment delay.

## Gap

Since LIBOR's end, floating legs reference overnight rates (SOFR, €STR, SONIA, TONA) compounded in arrears. The rate for a period is not known until the period ends, so the market adopted conventions that let the amount be known a few days early, and every one of them is a rule about **dates**: which business day's fixing applies to which calendar day, how many calendar days it applies for, and when the payment falls. ISDA's 2021 Definitions and its Compounding/Averaging Matrix name four:

| Convention | Rule, in ISDA's words |
| --- | --- |
| Lookback (memo §1.1) | "the rate for each business day in a Calculation Period is determined on the basis of the rate observed for a certain number of business days prior"; "The weighting to be given to the rate depends on the relevant day in the Calculation Period" — weights follow the **calculation** calendar |
| Observation period shift (§1.2) | "both the start and end dates are shifted by a certain number of days"; "both the rate and the weighting are determined on the basis of the relevant day in this observation period" — weights follow the **observation** calendar; the annualised result applies "based on the number of days in the Calculation Period" |
| Lockout (§1.3) | up to and including the first day of the lockout period, each day's own rate; "for each remaining day … the level of the rate observed for the first day of that lockout period (the 'lockout date')"; "there is no change to the weighting" |
| Payment delay (§1.4) | "the rates are observed for each day during the Calculation Period and the Floating Rate Payer Payment Date falls a number of business days after" the period end; rate and weighting for each day are that day's own |

The ARRC guide states the same four with `k` as the parameter: lookback uses "the SOFR rate from k business days earlier" for each day; lockout freezes the rate "observed k days before the period ends"; payment delay pays "k days after the start of the next period"; and lookback with observation shift "applies that rate for the number of calendar days until next business date following the observation date". The compounding formula itself is a fold over `(rate, weightDays)`; the hard, error-prone part is producing that list, and it is entirely calendar arithmetic.

([ISDA memorandum A40393158 v18.0, *Documenting RFR derivatives using different approaches to compounding/averaging*, §1.1–1.4](https://www.isda.org/a/alEgE/A40393158-v18.0-ISDA_Memorandum_Compounding-RFRs-under-2006-Definitions.pdf), [ARRC, *An Updated User's Guide to SOFR*, 2021, pp. 17–19](https://www.newyorkfed.org/medialibrary/Microsites/arrc/files/2021/users-guide-to-sofr2021-update.pdf), [ISDA 2021 Definitions and Compounding/Averaging Matrix](https://www.isda.org/2021/06/11/2021-isda-interest-rate-derivatives-definitions/))

## Scope

- `packages/gmt/src/finance/calculate/observationSchedule.ts`:
  - `observationSchedule(period: { start: string, end: string }, convention: { method: 'standard' | 'observationShift' | 'lookback' | 'lockout' | 'paymentDelay', days: number }, calendars: { fixing: BusinessCalendar, payment?: BusinessCalendar }): { entries: { calculationDate: string, observationDate: string, weightDays: number }[], observationPeriod: { start: string, end: string }, paymentDate: string | null } | null` — One entry per business day whose rate applies, with the calendar-day weight; `paymentDate` for `paymentDelay`, else the period end adjusted.
- `packages/gmt/src/finance/calculate/compoundedRatePeriod.ts`:
  - `rateApplicationDays(period, fixingCalendar): { date: string, weightDays: number }[]` — The `standard` case alone: each fixing business day and the calendar days until the next.
  - `lockoutDates(period, days, fixingCalendar, options: { countFrom: 'periodEndDate' | 'lastBusinessDay' }): { lockedFrom: string, lockedRateDate: string, fixingsRepeated: number }` — Where the lockout begins and which fixing it repeats. ISDA's memo notes (footnote 4) that a five-business-day lockout "by reference to the Period End Date" means "the same fixing being used 5 times but having a lockout period that is strictly only 4 Business Days"; `countFrom` makes the confirmation's wording explicit rather than guessed.

## Design notes

- **Weights are calendar days between fixing business days.** A Friday's rate applies for three days over an ordinary weekend and four over a bank-holiday weekend; that is what makes the fixing calendar load-bearing and why the schedule, not the caller, computes it.
- **Shift and lookback differ only in whose calendar sets the weights**, and that difference is the whole reason both exist. Returning `observationPeriod` alongside the entries makes the shift visible; a consumer who cannot see the observation window cannot reconcile against a counterparty's statement.
- **`days` has no default.** Five business days is common for lookback and observation shift and two for lockout, and none of those is a rule; the confirmation states the number and so does the call.
- **Two calendars.** The fixing calendar is the rate's publication calendar (SOFR: SIFMA US government securities); payment follows the payment calendar of the leg. They are frequently different and passing one for both is the standard mistake, so the second is separate and optional only for methods that do not pay.
- The fold — compounding `Π(1 + r·w/360) − 1` or the arithmetic average — is a few lines the consumer writes against `entries`; GMT returns no rates and computes no interest.

## What gmt provides (do not re-implement)

- `calculationPeriods` from FIN-71 — the periods being observed
- `addBusinessDays` / `isBusinessDay` / `previousBusinessDay` / `BusinessCalendar` from CORE-7 — business-day walking in each calendar
- `diffDate` — calendar-day weights
- `yearFraction` from FIN-42 — where a caller wants the period's fraction alongside

## Verification

- `standard` over a period Monday to Monday with no holidays yields five entries, weights 1, 1, 1, 1, 3, summing to seven
- The same period with a Monday bank holiday in the fixing calendar yields four entries with the Friday weight 4
- `lookback` with `days: 5` keeps the calculation-period weights and moves each `observationDate` five fixing business days back; `observationShift` with `days: 5` moves the period and recomputes weights from the observation window — asserted to differ on a period containing a holiday
- `lockout` with `days: 2` repeats the fixing two business days before the end for the last two entries, and `lockoutDates` names it
- `paymentDelay` with `days: 2` returns `paymentDate` two payment-calendar business days after the period end, skipping a payment-calendar holiday absent from the fixing calendar
- Total `weightDays` equals the calendar length of the (observation) period for every method
- A missing payment calendar under `paymentDelay`, or a zero or negative `days`, returns the sentinel
- `pnpm run validate` stays green
