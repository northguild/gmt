# FIN-42 — Finance: Day count conventions

**Scope:** Year-fraction calculation under the standard day count conventions, named as the market's own coding scheme names them and defined as ISDA defines them.

## Gap

Day count conventions are the most fundamental date primitive in finance — every accrual, coupon and discount factor depends on one — and the epic omitted them entirely.

The conventions differ in how they handle month lengths, and specifically in how they treat the 31st and the end of February. The 30/360 family adjusts dates before differencing them, and the variants disagree about which adjustments apply. Getting the variant wrong produces interest that is wrong by a day or two per period, which compounds.

The first draft of this story named the conventions informally (`'30/360 US'`, `'30/360 ISDA'`, `'30E+/360'`). Two of those names do not exist in the governing text, and the set omitted the convention every bond coupon uses. See Corrections.

([FpML day-count-fraction scheme 2-3](https://www.fpml.org/coding-scheme/day-count-fraction), [2006 ISDA Definitions §4.16 with Supplements 14 and 43](https://www.sc.com/en/uploads/sites/66/content/docs/2006-ISDA-Definitions.pdf))

## Scope

- `packages/gmt/src/finance/calculate/yearFraction.ts`:
  - `yearFraction(start: string, end: string, convention: DayCountConvention, options?: { couponFrequency?: number, periodStart?: string, periodEnd?: string, calendar?: BusinessCalendar, isTerminationDate?: boolean }): number | null`
- `packages/gmt/src/finance/calculate/dayCount.ts`:
  - `dayCount(start: string, end: string, convention: DayCountConvention, options?): number | null` — The numerator alone.
  - `daysInYearBasis(convention: DayCountConvention, start: string, end: string, options?): number | null` — The denominator alone.
- `DayCountConvention` is the FpML `dayCountFractionScheme` code set:
  `'1/1' | '30/360' | '30E/360' | '30E/360.ISDA' | 'ACT/360' | 'ACT/365.FIXED' | 'ACT/365L' | 'ACT/ACT.AFB' | 'ACT/ACT.ICMA' | 'ACT/ACT.ISDA' | 'BUS/252' | 'RBA'`.
  `ACT/ACT.ISMA` is also an FpML code (ISMA Rule 251, 1999); it is accepted as an alias of `ACT/ACT.ICMA` and the JSDoc says why.

## Conventions

The shared 30/360 numerator is `360 × (Y2 − Y1) + 30 × (M2 − M1) + (D2 − D1)`, where the first date is "the first day of the Calculation Period" and the second "the day immediately following the last day included in the Calculation Period" (ISDA 2006 §4.16(f)–(h)).

| Code | ISDA 2006 | ISDA 2021 §4.6.1 | Rule |
| --- | --- | --- | --- |
| `1/1` | §4.16(a) | (i) | The fraction is `1` |
| `ACT/ACT.ISDA` | §4.16(b) | (ii) | Actual days, "falling in a leap year divided by 366" plus those in a non-leap year divided by 365 |
| `ACT/ACT.ICMA` | §4.16(c) | (iii) | "number of days accrued/number of days in year" per ICMA Rule 251: actual days over `couponFrequency × days in the coupon period` (`periodStart`/`periodEnd` required) |
| `ACT/365.FIXED` | §4.16(d) | (iv) | Actual days "divided by 365" |
| `ACT/360` | §4.16(e) | (v) | Actual days "divided by 360" |
| `30/360` (Bond Basis) | §4.16(f) | (vi) | D1 = 31 → 30; D2 = 31 → 30 only "if D1 is greater than 29" after adjustment |
| `30E/360` (Eurobond Basis) | §4.16(g) | (vii) | D1 = 31 → 30; D2 = 31 → 30 |
| `30E/360.ISDA` | §4.16(h) | (viii) | D1 → 30 if "the last day of February or … 31"; D2 → 30 if "the last day of February but not the Termination Date or … 31" |
| `ACT/365L` | §4.16(i), Supplement 14 | (ix) | Actual days "divided by 365 (or, if the later Period End Date of the Calculation Period … falls in a leap year, divided by 366)" |
| `BUS/252` | — | (x) Calculation/252 | Business days in the period (`calendar` required) divided by 252 |
| `RBA` | §4.16(j)–(l), Supplement 43 | (xi) | "RBA Bond Basis (quarter)" is `0.25`, half-year `0.5`, annual `1`; `ACT/ACT.ISDA` applies to a first or final period shorter than the regular length |
| `ACT/ACT.AFB` | FpML (AFB 1994) | — | Actual days over 366 if a 29 February falls in the period, else 365, walking back whole years for periods over one year |

## Design notes

- **Names are the FpML codes, verbatim.** They are what confirmations, FpML messages and term sheets carry, so a reader matches them without a lookup table, and there is exactly one governing paragraph per code. GMT does not normalise them or invent aliases beyond the one FpML itself carries.
- **Rules are ISDA's words, quoted in the JSDoc.** The D1/D2 clauses above are the 2006 text; the 2021 Definitions renumber them and add Calculation/252. FpML's scheme description gives BUS/252 the paragraph "(v)", which collides with ACT/360 — a scheme error; the ISDA-authored Common Domain Model gives (x), and that is what the JSDoc cites, flagged as inferred because the 2021 text itself is paywalled.
- **`ACT/ACT.ISDA` is not a single division.** A period spanning a year boundary is split, with each portion divided by the length of its own year. Implementing it as actual days over 365 is wrong for any period crossing 31 December, and wrong differently in leap years.
- **`ACT/365L` keys on the period end date, not on whether the period contains 29 February.** That is what §4.16(i) says, and it differs from `ACT/ACT.AFB`, which keys on the 29th itself; the two are separate codes and the tests pin the difference.
- **`ACT/ACT.ICMA` is the bond convention.** It needs the coupon period and frequency, not just the accrual dates; the options are required for this code and ignored by every other, and the JSDoc says which codes consult which options. The stub handling ICMA Rule 251 prescribes is implemented from the ICMA text when available; until then irregular first and last periods return the sentinel rather than an approximation.
- **`30/360` and `30E/360.ISDA` differ in the end-of-February rule and in whether the termination date is exempt** — `isTerminationDate` exists for that clause alone.
- **`BUS/252` composes with CORE-7.** It is the one convention that needs a business calendar (Brazilian markets), and a missing `calendar` is the sentinel, never an assumed weekend.
- **The US "30/360 (SIA)" method with both February rules is not an FpML or ISDA code**, and its governing text (SIFMA, *Standard Securities Calculation Methods*) is a printed book that was not reached; the only description found is OpenGamma's, which states the rule in a different form from common paraphrases. It is out of scope by rule until the SIFMA text is cited, and the JSDoc says so.

## Corrections

The first draft's `'30/360 ISDA'` does not exist: ISDA defines "30/360" (Bond Basis) and "30E/360 (ISDA)", and the end-of-February handling the draft attributed to a "US" variant is what "30E/360 (ISDA)" actually specifies. `'30E+/360'` appears in some libraries but in no ISDA or FpML text and is dropped — this library justifies conventions from the governing standard, not from peer libraries. `ACT/ACT.ICMA`, `ACT/365L`, `BUS/252`, `1/1`, `RBA` and `ACT/ACT.AFB` were missing.

## What gmt provides (do not re-implement)

- `getZonedDateTimeFields` — day, month and year extraction
- `spanWallClock` from CORE-2 — actual day counts
- `getOrdinalDate` from CORE-5 — year-fraction splits for `ACT/ACT.ISDA`
- `businessDaysBetween` / `BusinessCalendar` from CORE-7 — `BUS/252`
- `getDaysInMonth` / `isLeapYear` from `plain/` — the February and leap-year tests

## Verification

- `30/360` and `30E/360.ISDA` return different results for a period ending on 28 February in a non-leap year, asserted explicitly
- `30E/360` adjusts a 31st start date to the 30th
- `30/360` leaves a 31st end date unadjusted when the start date is not the 30th or 31st, and adjusts it when it is — both asserted
- `30E/360.ISDA` treats a February month-end termination date differently from a February month-end interim date
- `ACT/360` over 90 actual days returns `0.25`
- `ACT/365.FIXED` in a leap year still divides by 365
- `ACT/365L` for a period ending in a leap year divides by 366 even when the period does not contain 29 February, and for a period containing 29 February but ending in a non-leap year divides by 365; `ACT/ACT.AFB` does the opposite in both cases — all four asserted
- `ACT/ACT.ISDA` across a year boundary splits the period, and the result differs from actual-over-365, asserted
- `ACT/ACT.ISDA` wholly inside a leap year divides by 366
- `ACT/ACT.ICMA` for a semi-annual coupon returns `0.5` over a full coupon period regardless of its actual length
- `ACT/ACT.ICMA` without `periodStart`/`periodEnd`/`couponFrequency` returns the sentinel
- `BUS/252` counts only business days and returns the sentinel without a calendar
- `RBA` over a regular quarter returns exactly `0.25`; over a two-month first period it returns the `ACT/ACT.ISDA` value
- `1/1` returns exactly `1`
- A full month under every 30/360 variant returns exactly `30/360`
- Inverted dates return a negative fraction
- Unknown convention returns the sentinel
- `pnpm run validate` stays green
