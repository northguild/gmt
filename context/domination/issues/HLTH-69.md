# HLTH-69 — Healthcare: Encounter durations — length of stay, midnights and observation hours

**Scope:** How long a patient was in the hospital, counted the ways payers and quality measures count it: midnights crossed, calendar days, and elapsed hours.

## Gap

"Length of stay" has at least three definitions in use at once, and reporting systems mix them. Medicare counts inpatient days "always in units of full days" by the "midnight-to-midnight method": "A part of a day, including the day of admission … counts as a full day"; "the day of discharge, death, or a day on which a patient begins a leave of absence is not counted as a day unless discharge or death occur on the day of admission"; and "If admission and discharge or death occur on the same day, the day is considered a day of admission and counts as one inpatient day". The two-midnight benchmark decides inpatient versus outpatient status: "an inpatient admission is generally appropriate for payment under Medicare Part A when the admitting physician expects the patient to require hospital care that crosses two midnights" (42 CFR 412.3(d)(1)). Observation services are billed by the hour and have hour thresholds of their own. Elapsed hours are what the clinical team means by "how long has this patient been here".

All three are questions TRAN-8 already answers for a container: `dwellTime` returns exact elapsed time and the count of local calendar dates touched, and midnights crossed is that count minus one. A hospital is a terminal with sicker cargo, and the day boundary is the same local midnight in the same zone.

([42 CFR 412.3(d)(1)](https://www.law.cornell.edu/cfr/text/42/412.3), [Medicare Benefit Policy Manual, Pub. 100-02, Chapter 3 §20.1 "Counting Inpatient Days" and §20.1.2 leave of absence](https://www.cms.gov/Regulations-and-Guidance/Guidance/Manuals/Downloads/bp102c03pdf.pdf))

## Scope

- `packages/gmt/src/health/calculate/lengthOfStay.ts`:
  - `lengthOfStay(admittedAt: string, dischargedAt: string, options: { timeZone: string, leavesOfAbsence?: Interval[] }): { midnights: number, inpatientDays: number, calendarDays: number, elapsed: string } | null` — `midnights` is local midnights crossed; `inpatientDays` is the Medicare count (`max(midnights, 1)`: day of admission counts, day of discharge does not, same-day is one), with each leave of absence treated per §20.1.2 (the day it begins is a discharge day; the return day counts "if the patient is present at midnight of that day"); `calendarDays` is local dates touched; `elapsed` is exact.
- `packages/gmt/src/health/calculate/twoMidnightBenchmark.ts`:
  - `twoMidnightBenchmark(from: string, expectedDischargeAt: string, options: { timeZone: string }): { midnights: number, meetsBenchmark: boolean }` — `from` is the instant the caller decides counts (the inpatient order, or the start of hospital care where the consumer's policy includes prior outpatient time); GMT counts from what it is given and the JSDoc says the choice is the caller's.
- `packages/gmt/src/health/calculate/observationHours.ts`:
  - `observationHours(start: string, end: string, options?: { excluding?: Interval[] }): { hours: number, exact: string }` — Elapsed hours, whole hours rounded down as billed, with caller-supplied excluded intervals (for example time in a procedure) subtracted.

## Design notes

- **Midnights are `dwellTime.calendarDays − 1`.** This story does not re-derive a day boundary; it consumes TRAN-8's count so a hospital midnight and a terminal midnight are the same midnight, including on DST-transition nights when the local day is 23 or 25 hours.
- **The three counts are returned together** because they are routinely confused and each is right for a different consumer: `inpatientDays` for Medicare billing, `midnights` for the benchmark, `elapsed` for clinicians, `calendarDays` for the daily count. A function returning one number invites the wrong one to be used. (The manual's own phrase is "midnight-to-midnight method"; "midnight census" is industry shorthand and does not appear in it.)
- **`twoMidnightBenchmark` takes the start instant from the caller** because the regulation is about a physician's *expectation* and CMS guidance on whether pre-order outpatient time counts has changed over time; GMT does not encode a policy position, it counts midnights from the instant it is handed and documents both readings.
- **Observation hours are billed whole and rounded down**, and excluded time is subtracted before rounding; the eight-hour and other thresholds that trigger specific codes are payer facts the consumer applies to the returned number.
- Time zone is required. Admission and discharge instants may be recorded in UTC by the EHR; the midnight that counts is the hospital's.

## What gmt provides (do not re-implement)

- `dwellTime` from TRAN-8 — exact elapsed time and the local calendar-day count
- `floorToZone` from CORE-5 — local midnight
- `subtractIntervals` / `sumIntervals` from CORE-6 — excluded intervals in observation time
- `spanMs` from CORE-2 — elapsed hours

## Verification

- Admission 09:00, discharge 15:00 the same local day returns `midnights: 0`, `inpatientDays: 1`, `calendarDays: 1`
- Admission 23:30, discharge 00:30 the next day returns `midnights: 1`, `inpatientDays: 1`, `calendarDays: 2`, `elapsed: 'PT1H'`
- Admission Monday 10:00, discharge Wednesday 10:00 returns `midnights: 2`, `inpatientDays: 2`
- A stay spanning a fall-back night returns `elapsed` one hour longer than the wall-clock difference and the same `midnights`
- Two instants in UTC that straddle local midnight in `America/Chicago` but not in UTC return `midnights: 1`, asserted to show the zone matters
- `twoMidnightBenchmark` from Monday 23:00 to Wednesday 01:00 returns `midnights: 2, meetsBenchmark: true`; from Tuesday 01:00 it returns `midnights: 1, meetsBenchmark: false`
- `observationHours` over 9 hours 50 minutes returns `hours: 9`; with a 2-hour excluded interval it returns `hours: 7`
- Discharge before admission or an invalid zone returns the sentinel
- `pnpm run validate` stays green
