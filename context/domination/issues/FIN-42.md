# FIN-42 — Finance: Day count conventions

**Scope:** Year-fraction calculation under the standard day count conventions.

## Gap

Day count conventions are the most fundamental date primitive in finance — every accrual, coupon and discount factor depends on one — and the epic omitted them entirely.

The conventions differ in how they handle month lengths, and specifically in how they treat the 31st and the end of February. The 30/360 family adjusts dates before differencing them, and the variants disagree about which adjustments apply. Getting the variant wrong produces interest that is wrong by a day or two per period, which compounds.

([FINCAD day count reference](https://docs.fincad.com/support/developerfunc/mathref/Daycount.htm), [OpenGamma conventions guide](https://quant.opengamma.io/Interest-Rate-Instruments-and-Market-Conventions.pdf))

## Scope

- `packages/gmt/src/finance/calculate/yearFraction.ts`:
  - `yearFraction(start: string, end: string, convention: DayCountConvention, options?: { couponFrequency?: number, periodEnd?: string }): number | null`
- `packages/gmt/src/finance/calculate/dayCount.ts`:
  - `dayCount(start: string, end: string, convention: DayCountConvention): number | null` — The numerator alone.
  - `daysInYearBasis(convention: DayCountConvention, start: string, end: string): number | null` — The denominator alone.
- `DayCountConvention` is `'30/360 US' | '30/360 ISDA' | '30E/360' | '30E+/360' | 'ACT/360' | 'ACT/365F' | 'ACT/ACT ISDA'`.

## Conventions

| Convention | Numerator | Denominator |
| --- | --- | --- |
| `30/360 US` | Adjusted 360-day months; end-of-February rules apply | 360 |
| `30/360 ISDA` | Adjusts the 31st, not end-of-February | 360 |
| `30E/360` | Adjusts both dates from 31 to 30 | 360 |
| `30E+/360` | As `30E/360`, but an end date of 31 rolls to the 1st of the next month | 360 |
| `ACT/360` | Actual days | 360 |
| `ACT/365F` | Actual days | 365, fixed |
| `ACT/ACT ISDA` | Actual days, split at the year boundary | 365 or 366 per portion |

## Design notes

- **`ACT/ACT ISDA` is not a single division.** A period spanning a year boundary is split, with each portion divided by the length of its own year. Implementing it as actual days over 365 is wrong for any period crossing 31 December, and wrong differently in leap years.
- **`30/360 US` and `30/360 ISDA` differ only in the end-of-February rule**, which is why they are separate values rather than an option flag — a boolean would not make the distinction legible at the call site.
- **`couponFrequency` and `periodEnd` are needed only by `ACT/ACT` variants** used for bond accrual. They are optional, and the JSDoc must state which conventions consult them, so callers do not assume they are inert.
- Convention names follow market usage rather than being normalised, so a reader can match them to a term sheet without a lookup table.

## What gmt provides (do not re-implement)

- `getZonedDateTimeFields` — day, month and year extraction
- `spanWallClock` from CORE-2 — actual day counts
- `getOrdinalDate` from CORE-5 — year-fraction splits for `ACT/ACT`

## Verification

- `30/360 US` and `30/360 ISDA` return different results for a period ending on 28 February in a non-leap year, asserted explicitly
- `30E/360` adjusts a 31st start date to the 30th
- `30E+/360` rolls a 31st end date to the 1st of the next month
- `ACT/360` over 90 actual days returns `0.25`
- `ACT/365F` in a leap year still divides by 365
- `ACT/ACT ISDA` across a year boundary splits the period, and the result differs from actual-over-365, asserted
- `ACT/ACT ISDA` wholly inside a leap year divides by 366
- A full month under every 30/360 variant returns exactly `30/360`
- Inverted dates return a negative fraction
- Unknown convention returns the sentinel
- `pnpm run validate` stays green
