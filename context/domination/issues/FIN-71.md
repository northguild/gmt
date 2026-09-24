# FIN-71 — Finance: Calculation period schedules

**Scope:** Generating the calculation periods and payment dates of an interest-bearing instrument from its effective date, termination date, frequency, roll convention and stub rules — the FpML `CalculationPeriodDates` and `PaymentDates` model.

## Gap

Day counts (FIN-42) value one period. A swap, bond or loan has dozens, and generating them is the fixed-income date problem nobody gets right by hand: the unadjusted dates roll on a convention — the same day of the month, the end of the month, IMM Wednesdays, a weekday — and are then adjusted for business days without the adjustment feeding back into the next roll; a term that is not a whole number of periods produces a short or long stub at the front or the back; and payment dates hang off period ends with their own offset and calendar. FpML defines every one of these as an enumeration, and ISDA's Definitions give them meaning.

FpML's own element documentation is the specification here: `effectiveDate` is "The first day of the term of the trade", `terminationDate` "The last day"; `calculationPeriodDatesAdjustments` is "The business day convention to apply to each calculation period end date"; `firstRegularPeriodStartDate` "must only be specified if there is an initial stub calculation period" and `lastRegularPeriodEndDate` likewise for a final stub; `stubPeriodType` is the "Method to allocate any irregular period remaining after regular periods have been allocated"; `paymentFrequency`, `payRelativeTo` ("each adjusted calculation period start date, adjusted calculation period end date or each reset date") and `paymentDaysOffset` ("If early payment or delayed payment is required") define payments.

([FpML 5.12 `CalculationPeriodDates`](https://www.fpml.org/spec/fpml-5-12-4-rec-1/html/confirmation/schemaDocumentation/schemas/fpml-ird-5-12_xsd/complexTypes/CalculationPeriodDates.html), [`RollConventionEnum`](https://www.fpml.org/spec/fpml-5-12-4-rec-1/html/confirmation/schemaDocumentation/schemas/fpml-enum-5-12_xsd/simpleTypes/RollConventionEnum.html), [`StubPeriodTypeEnum`](https://www.fpml.org/spec/fpml-5-12-4-rec-1/html/confirmation/schemaDocumentation/schemas/fpml-enum-5-12_xsd/simpleTypes/StubPeriodTypeEnum.html), [`PaymentDates`](https://www.fpml.org/spec/fpml-5-12-4-rec-1/html/confirmation/schemaDocumentation/schemas/fpml-ird-5-12_xsd/complexTypes/PaymentDates.html), [ISDA 2021 Interest Rate Derivatives Definitions](https://www.isda.org/book/2021-isda-interest-rate-derivatives-definitions/))

## Scope

- `packages/gmt/src/finance/calculate/calculationPeriods.ts`:
  - `calculationPeriods(spec: { effectiveDate: string, terminationDate: string, frequency: string, rollConvention: RollConventionCode, stub?: 'ShortInitial' | 'ShortFinal' | 'LongInitial' | 'LongFinal', firstPeriodStartDate?: string, firstRegularPeriodStartDate?: string, lastRegularPeriodEndDate?: string, businessDayConvention: RollConvention, calendar: BusinessCalendar, adjustEffectiveDate?: boolean, adjustTerminationDate?: boolean }): { unadjustedStart: string, unadjustedEnd: string, adjustedStart: string, adjustedEnd: string, isStub: boolean }[] | null` — Field names are FpML's, including `firstPeriodStartDate` ("if the date falls before the effective date").
  - `RollConventionCode` is FpML's `RollConventionEnum`: `'EOM' | 'FRN' | 'IMM' | 'IMMCAD' | 'IMMAUD' | 'IMMNZD' | 'SFE' | 'NONE' | 'TBILL' | 1 | … | 30 | 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN'`.
- `packages/gmt/src/finance/calculate/paymentDates.ts`:
  - `paymentDates(periods, spec: { frequency?: string, payRelativeTo: 'CalculationPeriodStartDate' | 'CalculationPeriodEndDate', paymentDaysOffset?: { days: number, dayType: 'Business' | 'Calendar' }, businessDayConvention: RollConvention, calendar: BusinessCalendar }): string[] | null` — One payment per period, or one per `frequency` of periods for instruments that pay less often than they accrue.
- `packages/gmt/src/finance/validate/isValidRollConventionCode.ts`:
  - `isValidRollConventionCode(value: unknown): value is RollConventionCode`

## Design notes

- **Unadjusted first, then adjusted, and the adjustment never feeds back.** A period ending on the 31st that rolls to the 30th for a weekend still starts the next period on the 31st. Generating adjusted dates and rolling forward from them is the canonical schedule bug and the reason both date pairs are returned.
- **Roll conventions are FpML's, verbatim, and FpML's enum text is the rule where it states one.** Day-of-month rolls constrain to the month's length (Temporal `overflow: 'constrain'`, so a 30 roll in February is the 28th or 29th); `EOM` "Rolls on month end dates irrespective of the length of the month and the previous roll day"; `IMM` is "The third Wednesday of the (delivery) month" via CORE-54's `nthWeekdayOfMonth`; `SFE` is "The second Friday of the (delivery) month"; `TBILL` is "Each Monday except for U.S. (New York) holidays" and takes the calendar; `NONE` is for daily frequencies. `IMMCAD`, `IMMAUD` and `IMMNZD` are defined by reference to an exchange's last trading day, which FpML does not state, and return the sentinel until that exchange rule is cited; `FRN` refers to the ISDA 2000 FRN Convention and does the same.
- **Stubs are explicit.** A regular period is generated from the regular start (or end) outward; the leftover at the front or back is the stub, short or long as the enum says, and `firstRegularPeriodStart`/`lastRegularPeriodEnd` let the caller pin where regularity begins, as the FpML fields do. No stub is ever silently absorbed.
- **The business-day convention is CORE-7's `RollConvention`**, reused without renaming so `modifiedFollowing` means what ISDA §4.12 says everywhere in the library.
- Notional schedules, rate fixings and compounding are FIN-72 and the consumer's; this story is dates.

## What gmt provides (do not re-implement)

- `rollDate` / `addBusinessDays` / `BusinessCalendar` / `RollConvention` from CORE-7 — business-day adjustment
- `nthWeekdayOfMonth` from CORE-54 — IMM rolls
- `tenorDate` / `parseTenor` / `immDate` from FIN-44 — frequency arithmetic and IMM dates
- `addDate` with `overflow: 'constrain'` — day-of-month rolls
- `getIsoWeekDate` from CORE-5 — weekday rolls

## Verification

- A two-year semi-annual schedule from 15 January with roll `15` yields four periods, none stubs, each unadjusted end on the 15th
- Roll `31` from 31 January yields unadjusted ends 28/29 February, 31 March, 30 April …, asserted as constrained not overflowed
- A period end on a Saturday adjusts to Friday under `preceding` and to Monday under `following`; the following period's unadjusted start is still the Saturday, asserted
- A 14-month quarterly term with `ShortInitial` yields a two-month first period then four regular quarters; with `LongInitial` a five-month first period then three quarters; `ShortFinal` and `LongFinal` mirror them at the back
- `firstRegularPeriodStart` pins regularity and produces the stub before it
- Roll `IMM` yields third Wednesdays in March, June, September and December; `EOM` yields month ends adjusted by the convention
- `paymentDates` with a two-business-day offset lands two business days after each adjusted period end, skipping a holiday in the payment calendar; paying annually on a semi-annual schedule yields one date per two periods
- Roll `SFE` yields second Fridays; roll `TBILL` yields every Monday that is not a New York holiday in the supplied calendar, and the Tuesday when Monday is one is **not** substituted (FpML says "except for", not "or the next business day") — asserted
- `IMMCAD` returns the sentinel until its rule is cited; `FRN` returns the sentinel
- Termination before effective, or an unknown roll code, returns the sentinel
- `pnpm run validate` stays green
