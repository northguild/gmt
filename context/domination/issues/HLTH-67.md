# HLTH-67 — Healthcare: Immunization dose validity

**Scope:** Whether a vaccine dose counts, given a minimum age and a minimum interval from the previous dose, under the ACIP grace-period rule — and when the next dose becomes due.

## Gap

Every immunization registry and EHR evaluates each administered dose against a schedule: was the patient old enough, and was it far enough after the previous dose. The rule that decides borderline cases is precise and widely mis-coded. Under the ACIP General Best Practice Guidelines, "vaccine doses administered ≤4 days before the minimum interval or age are considered valid"; "Doses of any vaccine administered ≥5 days earlier than the minimum interval or age should not be counted as valid doses" and are repeated, spaced by the minimum interval from the invalid dose. Day counting is defined too: "Day 1 is the day before the day that marks the minimum age or minimum interval". The guideline "does not apply" to rabies vaccine or the accelerated Twinrix schedule, and "should not be applied to this 4-week interval between 2 different live vaccines". Local or state mandates "might supersede this 4-day guideline".

CDC's Clinical Decision Support for immunization (CDSi) logic specification (v4.6, December 2024) encodes the same rule as separate dates: the minimum age date is "date of birth plus the minimum age" (CALCDTAGE-4) and the absolute minimum age date is birth plus the absolute minimum age (CALCDTAGE-5); likewise CALCDTINT-3/4 for intervals. Validation uses the absolute minimum; forecasting uses the minimum — which is the retrospective-versus-prospective distinction the ACIP page draws in its Table 3-2 footnote (f).

([CDC ACIP General Best Practice Guidelines for Immunization, Timing and Spacing of Immunobiologics, updated 24 July 2024](https://www.cdc.gov/vaccines/hcp/imz-best-practices/timing-spacing-immunobiologics.html), [CDC CDSi Logic Specification v4.6, Table 3-7 and Glossary Table A-7](https://www.cdc.gov/iis/downloads/logic-spec-acip-rec-4.6.pdf))

## Scope

- `packages/gmt/src/health/calculate/doseValidity.ts`:
  - `doseValidity(input: { birthDate: string, administeredOn: string, previousDoseOn?: string, rule: { minimumAge?: string, minimumInterval?: string, graceDays: number } }): { valid: boolean, ageOnDate: { weeks: number, days: number }, earlyByDays: number, reason: 'ok' | 'grace' | 'belowMinimumAge' | 'belowMinimumInterval' | 'missingPreviousDose' } | null` — `minimumAge` and `minimumInterval` are ISO durations (`P6W`, `P28D`, `P12M`); `graceDays` is required — ACIP's 4 for the general case, 0 for the exceptions — and the JSDoc lists both.
- `packages/gmt/src/health/calculate/nextDoseDue.ts`:
  - `earliestValidDate(input: { birthDate: string, previousDoseOn?: string, rule }): string` — The later of minimum age and minimum interval, **without** the grace period: CDSi's minimum-age and minimum-interval dates (CALCDTAGE-4, CALCDTINT-4), which are what forecasting uses.
  - `recommendedWindow(input & { rule: { recommendedAge?: string, recommendedInterval?: string, maximumAge?: string } }): { from: string, to: string | null } | null` — The routine window, for reminder systems.
- `packages/gmt/src/health/calculate/liveVaccineSpacing.ts`:
  - `liveVaccineSpacingValid(firstOn: string, secondOn: string): { valid: boolean, daysApart: number }` — The 28-day rule between live parenteral vaccines not given on the same day; no grace.

## Design notes

- **`graceDays` is required so the exceptions are visible at the call site.** Defaulting to 4 would make a rabies series or a live-vaccine spacing check silently wrong; the caller states the number the guideline gives for that vaccine and the JSDoc cites it.
- **Validity and scheduling use different arithmetic on purpose.** The grace period exists so a dose given slightly early is not wasted; CDSi separates the absolute-minimum dates used to evaluate a given dose from the minimum dates used to forecast the next one, and the ACIP page's Table 3-2 footnote (f) draws the same line between "validating past doses" and "planning doses ahead of time". `earliestValidDate` therefore uses the minimum dates and ignores the grace period; the two functions cannot be made to agree by a flag. (ACIP does not state a blanket "never schedule with the grace period" rule, and this spec does not claim one.)
- **Age is calendar age (HLTH-36), in weeks and days, not a duration divided by 7.** Minimum ages are stated in weeks, months or years and compared as dates; a child born 29 February is handled by HLTH-36's documented leap-day rule.
- **"5 or more days early" is a whole-day comparison on local dates.** Administration and birth dates are dates, not instants, in immunization records; the functions take dates and refuse instants.
- Schedules — which vaccines, how many doses, which ages — are ACIP data that changes annually and are the consumer's or a data package's, never on the default import path. This story evaluates one dose against the rule the caller supplies.

## What gmt provides (do not re-implement)

- `ageAt` / `ageParts` from HLTH-36 — calendar age at the administration date
- `addDate` / `diffDate` — interval arithmetic on dates
- `isValidDate` — input validation

## Verification

- With `minimumAge: 'P6W'` and `graceDays: 4`, a dose at 5 weeks 3 days is valid with `reason: 'grace'` and `earlyByDays: 4`; at 5 weeks 2 days it is invalid with `reason: 'belowMinimumAge'` and `earlyByDays: 5`
- With `minimumInterval: 'P28D'`, a second dose 24 days after the first is valid under grace; 23 days is invalid; the same 24 days with `graceDays: 0` is invalid
- `earliestValidDate` with a previous dose returns the later of birth + minimum age and previous + minimum interval, and never applies the grace period, asserted against `doseValidity` accepting a date four days earlier
- `liveVaccineSpacingValid` returns `valid: true` at 28 days and `false` at 27, with no grace
- A dose before a required `previousDoseOn` returns `reason: 'missingPreviousDose'`
- `recommendedWindow` with a `maximumAge` returns a bounded window and `to: null` without one
- A birth date of 29 February evaluated at 6 weeks in a leap year and a non-leap year both compute the same age in weeks and days
- An instant string in place of a date returns the sentinel
- `pnpm run validate` stays green
