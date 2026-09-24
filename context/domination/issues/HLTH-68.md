# HLTH-68 — Healthcare: Pharmacy adherence and supply arithmetic

**Scope:** Proportion of days covered and medication possession ratio from prescription fills, and the days'-supply arithmetic under them — next fill date, remaining supply, refill-too-soon.

## Gap

Medication adherence is measured from claims, and the measure that drives Medicare Part D Star Ratings is the Pharmacy Quality Alliance's Proportion of Days Covered (PDC): "the percentage of days within the measurement year that individuals covered by prescription claims for the same medication or another medication in the same therapeutic class". The counting rule is specific. Each fill covers `daysSupply` days from its fill date; when fills of the "same target medication (i.e., one or more products with the same generic ingredient)" overlap, PQA says to "adjust the prescription start date to be the day after the days' supply for the previous fill has ended", so stockpiling does not inflate the measure; fills of different medications in the class overlap freely and a day counts when the patient "was covered by at least one drug in the class". The treatment period runs "from the index prescription start date (IPSD) … through the last day of the measurement year, or until death or disenrollment", must be at least 91 days, and needs "at least two prescription claims … on different dates of service". The adherence threshold is 80 % (90 % for antiretrovirals).

The older Medication Possession Ratio (MPR) sums days' supply over the period without the overlap adjustment and can exceed 100 %. Both are interval arithmetic that the `plain/` date-interval functions already do; what is missing is the PQA-specific shift rule and the vocabulary.

([PQA adherence measures](https://www.pqa.org/adherence-measures), [PQA FAQ for QRS measures, 2020, "How are days covered calculated"](https://pqa.memberclicks.net/assets/Measures/QRS%20Measures%20FAQs%2020200403.pdf), [PQA PDC-STA tip sheet, 2022](https://files.guidewell.com/m/56dd3b4c0ea92f/original/providers-programs-quality-pqa-pdc-sta.pdf); the full specification is sold through NCQA Publications, so the rules above are PQA's own public restatements)

## Scope

- `packages/gmt/src/health/calculate/daysCovered.ts`:
  - `coveredIntervals(fills: { filledOn: string, daysSupply: number, medication?: string }[], options: { overlap: 'shiftSameMedication' | 'none' }): { start: string, end: string }[]` — The plain-date intervals of coverage after the overlap rule, merged.
  - `proportionOfDaysCovered(fills, period: { start: string, end: string }, options?: { overlap?: 'shiftSameMedication', indexFromFirstFill?: boolean }): { daysCovered: number, daysInPeriod: number, pdc: number } | null` — PQA rules by default: same-medication shift, period from the first fill in range.
  - `medicationPossessionRatio(fills, period): { daysSupplied: number, daysInPeriod: number, mpr: number } | null` — Uncapped, as defined.
- `packages/gmt/src/health/calculate/supply.ts`:
  - `supplyRunsOutOn(fill: { filledOn: string, daysSupply: number }): string` — First uncovered date.
  - `daysSupplyRemaining(fill, onDate: string): number` — Non-negative.
  - `refillTooSoon(previous: { filledOn: string, daysSupply: number }, requestedOn: string, options: { thresholdPercent: number }): { tooSoon: boolean, percentUsed: number, earliestAllowedOn: string }` — The payer's early-refill test; the threshold (commonly 75 % or 80 %) is a plan parameter with no default.

## Design notes

- **Dates, not instants.** Fills are dated, coverage is counted in whole days, and the measure is defined on calendar days; the functions take ISO dates and reject instants rather than resolving a zone that pharmacy claims do not carry.
- **The shift rule is per medication, and `medication` is an opaque key.** GMT does not know that two NDCs are the same drug; the caller labels fills and the rule applies to equal labels. Absent labels, every fill is treated as the same medication, which is the conservative PQA reading and is documented.
- **Coverage intervals are the `plain/` date-interval algebra**, half-open, so `daysCovered` is a sum of interval lengths in days and cannot disagree with HLTH-35 or CORE-6 about a boundary.
- **Thresholds are reported, not judged.** The 80 % adherence line and the early-refill percentage are payer and programme facts; `pdc` is returned as a number and `refillTooSoon` takes its threshold, so the same code serves a Star Ratings measure and a plan edit.
- Class membership, exclusions (hospice, ESRD) and eligibility rules are measure logic maintained by PQA and the consumer. This story is the date arithmetic under them.

## What gmt provides (do not re-implement)

- `mergeIntervalsDate` / `intervalIntersectionDate` / `intervalLengthDate` from `plain/` — plain-date interval algebra
- `addDate` / `diffDate` — supply arithmetic
- `comparePartialDates` from HLTH-35 — where a fill date is recorded at month precision
- `isValidDate` — input validation

## Verification

- Two 30-day fills of the same medication on day 1 and day 25 cover days 1–60 under the shift rule (the second shifted to day 31), and days 1–54 with `overlap: 'none'`, asserted side by side
- Two 30-day fills of different medications on day 1 and day 25 cover days 1–54, each day counted once
- `proportionOfDaysCovered` over a 365-day period with 292 covered days returns `pdc: 0.8`; the period starts at the first fill when `indexFromFirstFill` is true and at `period.start` otherwise
- `medicationPossessionRatio` for fills totalling 400 days' supply over 365 days returns `mpr` above 1 and is not capped
- `supplyRunsOutOn` for a 30-day fill on 1 March returns 31 March; `daysSupplyRemaining` on 31 March is 0 and on 30 March is 1
- `refillTooSoon` with `thresholdPercent: 75` on day 22 of a 30-day supply returns `tooSoon: true` (70 % used) and `earliestAllowedOn` day 23; on day 23 it returns `tooSoon: false`
- A fill dated after the period end contributes nothing; a fill before the period start contributes only its days inside the period
- An instant in place of a date, or a non-positive `daysSupply`, returns the sentinel
- `pnpm run validate` stays green
