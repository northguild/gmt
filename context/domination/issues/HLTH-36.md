# HLTH-36 — Healthcare: Clinical age calculation

**Scope:** Age at a reference date, including the neonatal, gestational and obstetric forms clinical systems require, using the terminology the AAP and ACOG define.

## Gap

Age looks trivial and is not. Four distinct problems:

- **A documented off-by-one.** CQL normalises timezone offsets "only when the comparison precision is hours, minutes, seconds, or milliseconds". Normalising for a months-or-years comparison introduces the very error it appears to prevent, because a date shifted across midnight changes the year count; the US CQL IG warns that the DateTime age overloads "consider" the offset and recommends `date from` to force the date calculation.
  ([CQL v2.0.0 Appendix B, Same As](https://cql.hl7.org/09-b-cqlreference.html), [US CQL IG, patient patterns](https://hl7.org/fhir/us/cql/en/patterns-patient.html))
- **29 February birthdays.** In a non-leap year there is no anniversary, and the convention must be stated rather than inherited from whatever the arithmetic happens to do.
- **Age is not always in years.** Neonatal age is in hours or days, paediatric age in months, and gestational age in weeks plus days. A years-only function is unusable in obstetrics and neonatology.
- **Preterm infants have four ages.** The AAP defines gestational age (completed weeks from the first day of the last menstrual period to delivery; conceptional age + 2 weeks for assisted reproduction), chronological age (time since birth), **postmenstrual age** (gestational + chronological) and **corrected age** (chronological age reduced by the weeks born before 40 weeks; used up to 3 years). Growth charts, developmental screening and drug dosing each key on a different one.
  ([AAP, *Age Terminology During the Perinatal Period*, Pediatrics 2004;114(5):1362, reaffirmed 2021](https://publications.aap.org/pediatrics/article/114/5/1362/67715/Age-Terminology-During-the-Perinatal-Period))

The estimated due date is itself a date calculation with a governing text: "By convention, the EDD is 280 days after the first day of the LMP"; first-trimester ultrasound "(up to and including 13 6/7 weeks of gestation) is the most accurate method to establish or confirm" it and redates only when the discrepancy exceeds a threshold that depends on the gestational age at the scan; and for IVF the EDD is set from the embryo age and transfer date — "for a day-5 embryo, the EDD would be 261 days from the embryo replacement date", 263 for a day-3 embryo.
([ACOG Committee Opinion 700, *Methods for Estimating the Due Date*, May 2017](https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2017/05/methods-for-estimating-the-due-date))

## Scope

- `packages/gmt/src/health/calculate/ageAt.ts`:
  - `ageAt(birthDate: string, at: string, options?: { unit?: 'year' | 'month' | 'week' | 'day' | 'hour', leapDayRule?: 'feb28' | 'mar1' }): { value: number, unit: string } | null`
  - `ageParts(birthDate: string, at: string): { years: number, months: number, days: number } | null`
- `packages/gmt/src/health/calculate/neonatalAge.ts`:
  - `neonatalAge(birthDateTime: string, at: string): { hours: number, days: number } | null` — Requires full precision on both inputs; a date-only birth is insufficient.
- `packages/gmt/src/health/calculate/gestationalAge.ts`:
  - `gestationalAge(anchor: { lmp?: string, edd?: string }, at: string): { weeks: number, days: number } | null` — The conventional `w+d` form. From EDD: `280 days − (edd − at)`.
  - `estimatedDueDate(anchor: { lmp: string } | { ultrasoundDate: string, gestationalAgeAtScan: { weeks: number, days: number } } | { embryoTransferDate: string, embryoAgeDays: 3 | 5 }): string | null` — LMP + 280 days; back-calculated from a dated scan; or transfer date + 263 (day-3) or + 261 (day-5) for IVF, per ACOG.
  - `shouldRedate(lmpEdd: string, ultrasoundEdd: string, gestationalAgeAtScan: { weeks: number, days: number }): { redate: boolean, discrepancyDays: number, thresholdDays: number } | null` — ACOG Table 1 thresholds.
- `packages/gmt/src/health/calculate/perinatalAge.ts`:
  - `postmenstrualAge(gestationalAgeAtBirth: { weeks: number, days: number }, birthDate: string, at: string): { weeks: number, days: number } | null`
  - `correctedAge(gestationalAgeAtBirth: { weeks: number, days: number }, birthDate: string, at: string): { weeks: number, days: number } | null` — Chronological age minus `(40 weeks − gestational age at birth)`; the sentinel beyond the AAP's 3-year applicability.

## ACOG redating thresholds

| Gestational age at first ultrasound | Redate when discrepancy exceeds |
| --- | --- |
| ≤ 8w6d | 5 days |
| 9w0d – 15w6d | 7 days |
| 16w0d – 21w6d | 10 days |
| 22w0d – 27w6d | 14 days |
| ≥ 28w0d | 21 days |

## Design notes

- **Date arithmetic, not instant arithmetic, for coarse units.** `ageAt` with unit `'year'` or `'month'` compares calendar dates and must not convert to instants. Only `'hour'` normalises offsets. This is the documented rule and the reason the unit is a parameter rather than the caller dividing a duration.
- **`leapDayRule` has no safe default**, so it is explicit and documented. Both conventions are in real use, and jurisdictions differ on which applies for legal age.
- **`neonatalAge` requires a time.** A newborn's age in hours cannot be computed from a date, and silently assuming midnight would misstate it by up to a day — clinically significant in the first 72 hours.
- **Gestational age is `weeks + days`**, never decimal weeks. `38+4` is the clinical form and rounding it to 38.6 weeks is wrong in a way clinicians will notice. The same holds for postmenstrual and corrected age.
- **Corrected age is not "age from the due date".** It is chronological age minus the prematurity, which coincides with age-from-EDD only when the EDD was exactly 40w0d; the AAP definition is the one implemented.
- **The redating thresholds are ACOG's, cited by band.** They are encoded as a table with its source and revision, because they are what the committee opinion states as numbers; the clinical decision to redate remains the clinician's, and `shouldRedate` only reports the comparison.
- A partial birth date (HLTH-35) yields an age range, not a number. Callers pass a resolved date; the function returns the sentinel for imprecise input rather than guessing.

## What gmt provides (do not re-implement)

- `comparePartialDates` from HLTH-35 — for callers holding imprecise birth dates
- `spanWallClock` from CORE-2 — calendar-distance spans
- `spanMs` from CORE-2 — exact elapsed time for the hour unit
- `getZonedDateTimeFields` — calendar field extraction
- `addDate` / `subtractDate` — the 280-day arithmetic

## Verification

- Age in years the day before a birthday is one less than on the birthday
- A birth date and reference date in different timezones yield the same age in years, and may legitimately differ in hours — both asserted
- 29 February birth with `leapDayRule: 'feb28'` increments on 28 February in a non-leap year; `'mar1'` increments on 1 March
- `ageParts` sums correctly across a month boundary and a leap year
- `neonatalAge` returns hours for a birth 30 hours prior; a date-only birth returns the sentinel
- `gestationalAge` returns `{ weeks: 38, days: 4 }`, never a decimal; from LMP and from the derived EDD it agrees
- `estimatedDueDate({ lmp })` is LMP + 280 days; from a scan dated 12w3d it is scan date + (40w0d − 12w3d); from a day-5 transfer it is transfer + 261 days and from a day-3 transfer + 263, asserted against the ACOG text
- `shouldRedate` at 8w0d returns `redate: true` for a 6-day discrepancy and `false` for 5 days; at 20w0d the threshold is 10 days; at 30w0d it is 21 days
- `postmenstrualAge` for a 32w0d infant 14 days old is `34+0`; `correctedAge` is `−6+0` before term and the sentinel past 3 years chronological
- A future reference date returns a negative age rather than the sentinel, and this is documented
- `pnpm run validate` stays green
