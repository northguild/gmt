# HLTH-67 — Healthcare: Immunization dose validity

**Scope:** Whether a dose counts against a minimum age and a minimum interval with a caller-supplied grace window, and when the next dose becomes due.

## Gap

Every immunization registry and EHR evaluates each administered dose against a schedule: was the patient old enough, and was it far enough after the previous dose. Borderline doses are decided by a grace window of N days before the minimum date, with day 1 being the day before the minimum date — a count that is widely mis-coded by one in either direction. Evaluating a past dose and forecasting the next one use different dates: the evaluation admits the grace window, the forecast does not, and code that uses one date for both either schedules doses early or rejects valid ones.

## Scope

- `packages/gmt/src/health/calculate/doseValidity.ts`:
  - `doseValidity(input: { birthDate: string, administeredOn: string, previousDoseOn?: string, rule: { minimumAge?: string, minimumInterval?: string, graceDays: number } }): { valid: boolean, ageOnDate: { weeks: number, days: number }, earlyByDays: number, reason: 'ok' | 'grace' | 'belowMinimumAge' | 'belowMinimumInterval' | 'missingPreviousDose' } | null` — `minimumAge` and `minimumInterval` are ISO durations (`P6W`, `P28D`, `P12M`); `graceDays` is required, and a schedule states it per vaccine.
- `packages/gmt/src/health/calculate/nextDoseDue.ts`:
  - `earliestValidDate(input: { birthDate: string, previousDoseOn?: string, rule }): string` — The later of minimum age and minimum interval, **without** the grace window: the dates forecasting uses.
  - `recommendedWindow(input & { rule: { recommendedAge?: string, recommendedInterval?: string, maximumAge?: string } }): { from: string, to: string | null } | null` — The routine window, for reminder systems.

## Design notes

- **`graceDays` is required so the exceptions are visible at the call site.** A schedule that gives 0 for one vaccine and 4 for another says so per call; the JSDoc names no schedule.
- **Validity and scheduling use different arithmetic on purpose.** The grace window exists so a dose given slightly early is not wasted; evaluating a given dose admits it and forecasting the next dose does not. `earliestValidDate` therefore uses the minimum dates and ignores the grace window; the two functions cannot be made to agree by a flag. This is the library's documented convention.
- **Age is calendar age (HLTH-36), in weeks and days, not a duration divided by 7.** Minimum ages are stated in weeks, months or years and compared as dates; a child born 29 February is handled by HLTH-36's documented leap-day rule.
- **Early-by is a whole-day comparison on local dates.** Administration and birth dates are dates, not instants, in immunization records; the functions take dates and refuse instants.
- **Day counting is a stated convention.** `earlyByDays` is whole days between the administered date and the minimum date, so a dose on the minimum date is 0 days early and one the day before is 1; the grace test is `earlyByDays ≤ graceDays`.
- Schedules — which vaccines, how many doses, which ages, which grace — are the consumer's data, never on any import path. This story evaluates one dose against the rule the caller supplies.

## Corrections

- The live-vaccine spacing function encoded one body's 28-day rule; it is `doseValidity` with `minimumInterval: 'P28D'` and `graceDays: 0`. Agency names and clause ids leave the spec; the numbers in the examples are labelled as numbers.

## What gmt provides (do not re-implement)

- `ageAt` / `ageParts` from HLTH-36 — calendar age at the administration date
- `addDate` / `diffDate` — interval arithmetic on dates
- `isValidDate` — input validation

## Verification

- With `minimumAge: 'P6W'` and `graceDays: 4`, a dose at 5 weeks 3 days is valid with `reason: 'grace'` and `earlyByDays: 4`; at 5 weeks 2 days it is invalid with `reason: 'belowMinimumAge'` and `earlyByDays: 5`
- With `minimumInterval: 'P28D'`, a second dose 24 days after the first is valid under grace; 23 days is invalid; the same 24 days with `graceDays: 0` is invalid
- `earliestValidDate` with a previous dose returns the later of birth + minimum age and previous + minimum interval, and never applies the grace window, asserted against `doseValidity` accepting a date four days earlier
- A dose before a required `previousDoseOn` returns `reason: 'missingPreviousDose'`
- `recommendedWindow` with a `maximumAge` returns a bounded window and `to: null` without one
- A birth date of 29 February evaluated at 6 weeks in a leap year and a non-leap year both compute the same age in weeks and days
- An instant string in place of a date returns the sentinel
- `pnpm run validate` stays green
