# HLTH-36 — Healthcare: Clinical age calculation

**Scope:** Age at a reference date, including the neonatal, gestational and obstetric forms clinical systems require, using the perinatal age vocabulary as documented conventions, with every dating constant supplied by the caller.

## Gap

Age looks trivial and is not. Four distinct problems:

- **A documented off-by-one.** CQL normalises timezone offsets "only when the comparison precision is hours, minutes, seconds, or milliseconds". Normalising for a months-or-years comparison introduces the very error it appears to prevent, because a date shifted across midnight changes the year count; the HL7 CQL-with-FHIR implementation guide warns that the DateTime age overloads "consider" the offset and recommends `date from` to force the date calculation.
  ([CQL v2.0.0 Appendix B, Same As](https://cql.hl7.org/09-b-cqlreference.html), [HL7 CQL-with-FHIR IG, patient patterns](https://hl7.org/fhir/us/cql/en/patterns-patient.html))
- **29 February birthdays.** In a non-leap year there is no anniversary, and the convention must be stated rather than inherited from whatever the arithmetic happens to do.
- **Age is not always in years.** Neonatal age is in hours or days, paediatric age in months, and gestational age in weeks plus days. A years-only function is unusable in obstetrics and neonatology.
- **Preterm infants have four ages.** Perinatal practice distinguishes gestational age (completed weeks from the first day of the last menstrual period to delivery; for assisted reproduction, the embryo age plus a conception offset), chronological age (time since birth), **postmenstrual age** (gestational + chronological) and **corrected age** (chronological age reduced by the weeks born before term, applied only up to an age the scheme states). Growth charts, developmental screening and drug dosing each key on a different one.

The estimated due date is a date calculation with conventions a caller supplies: a term length from the first day of the last period, an embryo age and a conception offset for assisted reproduction, and a redating threshold table keyed by gestational age at the scan. The arithmetic is the same whichever numbers a scheme states; the numbers are the caller's.

## Scope

- `packages/gmt/src/health/calculate/ageAt.ts`:
  - `ageAt(birthDate: string, at: string, options?: { unit?: 'year' | 'month' | 'week' | 'day' | 'hour', leapDayRule?: 'feb28' | 'mar1' }): { value: number, unit: string } | null`
  - `ageParts(birthDate: string, at: string): { years: number, months: number, days: number } | null`
- `packages/gmt/src/health/calculate/neonatalAge.ts`:
  - `neonatalAge(birthDateTime: string, at: string): { hours: number, days: number } | null` — Requires full precision on both inputs; a date-only birth is insufficient.
- `packages/gmt/src/health/calculate/gestationalAge.ts`:
  - `gestationalAge(anchor: { lmp?: string, edd?: string }, at: string, options: { termDays: number }): { weeks: number, days: number } | null` — The conventional `w+d` form. From EDD: `termDays − (edd − at)`.
  - `estimatedDueDate(anchor: { lmp: string } | { ultrasoundDate: string, gestationalAgeAtScan: { weeks: number, days: number } } | { embryoTransferDate: string, embryoAgeDays: number }, options: { termDays: number, conceptionOffsetDays?: number }): string | null` — LMP + `termDays`; back-calculated from a dated scan; or, for assisted reproduction, `transfer − embryoAgeDays − conceptionOffsetDays + termDays`. The transfer form requires `conceptionOffsetDays` and returns the sentinel without it.
  - `shouldRedate(lmpEdd: string, ultrasoundEdd: string, gestationalAgeAtScan: { weeks: number, days: number }, thresholds: { upToWeeks: number, days: number }[]): { redate: boolean, discrepancyDays: number, thresholdDays: number } | null` — The caller's band table: `upToWeeks` is an exclusive upper bound in completed weeks, bands ascend, and the first band whose bound exceeds the scan's gestational age applies. A scan at or beyond the last bound returns the sentinel, so an open-ended final band is written with a bound no pregnancy reaches.
- `packages/gmt/src/health/calculate/perinatalAge.ts`:
  - `postmenstrualAge(gestationalAgeAtBirth: { weeks: number, days: number }, birthDate: string, at: string): { weeks: number, days: number } | null`
  - `correctedAge(gestationalAgeAtBirth: { weeks: number, days: number }, birthDate: string, at: string, options: { termWeeks: number, applicableUntil?: string }): { weeks: number, days: number } | null` — Chronological age minus `(termWeeks − gestational age at birth)`; the sentinel beyond `applicableUntil` (an ISO duration from birth) only when it is given.

## Design notes

- **Date arithmetic, not instant arithmetic, for coarse units.** `ageAt` with unit `'year'` or `'month'` compares calendar dates and must not convert to instants. Only `'hour'` normalises offsets. This is the documented rule and the reason the unit is a parameter rather than the caller dividing a duration.
- **`leapDayRule` has no safe default**, so it is explicit and documented. Both conventions are in real use, and which applies for legal age varies by where the person lives.
- **`neonatalAge` requires a time.** A newborn's age in hours cannot be computed from a date, and silently assuming midnight would misstate it by up to a day — clinically significant in the first 72 hours.
- **Gestational age is `weeks + days`**, never decimal weeks. `38+4` is the clinical form and rounding it to 38.6 weeks is wrong in a way clinicians will notice. The same holds for postmenstrual and corrected age.
- **Corrected age is not "age from the due date".** It is chronological age minus the prematurity, which coincides with age-from-EDD only when the EDD was exactly `termWeeks` + 0 days; this is the definition implemented, and it is documented.
- **Redating thresholds are the caller's table.** `shouldRedate` reports the comparison against the bands it is given; the clinical decision to redate remains the clinician's.
- A partial birth date (HLTH-35) yields an age range, not a number. Callers pass a resolved date; the function returns the sentinel for imprecise input rather than guessing.

## Corrections

- The 280-day term, the 261/263-day transfer offsets and the redating table were one body's numbers with defaults; all are parameters (`termDays`, `embryoAgeDays` with `conceptionOffsetDays`, `thresholds`, `termWeeks`, `applicableUntil`). The four perinatal ages keep their definitions as this library's documented conventions.

## What gmt provides (do not re-implement)

- `comparePartialDates` from HLTH-35 — for callers holding imprecise birth dates
- `spanWallClock` from CORE-2 — calendar-distance spans
- `spanMs` from CORE-2 — exact elapsed time for the hour unit
- `getZonedDateTimeFields` — calendar field extraction
- `addDate` / `subtractDate` — the term-length arithmetic

## Verification

- Age in years the day before a birthday is one less than on the birthday
- A birth date and reference date in different timezones yield the same age in years, and may legitimately differ in hours — both asserted
- 29 February birth with `leapDayRule: 'feb28'` increments on 28 February in a non-leap year; `'mar1'` increments on 1 March
- `ageParts` sums correctly across a month boundary and a leap year
- `neonatalAge` returns hours for a birth 30 hours prior; a date-only birth returns the sentinel
- `gestationalAge` with `termDays: 280` returns `{ weeks: 38, days: 4 }`, never a decimal; from LMP and from the derived EDD it agrees
- `estimatedDueDate({ lmp }, { termDays: 280 })` is LMP + 280 days; from a scan dated 12w3d it is scan date + (`termDays` − 12w3d); from a day-5 transfer with `conceptionOffsetDays: 14` it is transfer + 261 days and from a day-3 transfer + 263; the transfer form without `conceptionOffsetDays` returns the sentinel
- `shouldRedate` with a five-band table (`upToWeeks` 9, 16, 22, 28, 99 with `days` 5, 7, 10, 14, 21) at 8w0d returns `redate: true` for a 6-day discrepancy and `false` for 5 days; at 20w0d the threshold is 10 days; at 30w0d it is 21 days; a scan beyond the last band returns the sentinel
- `postmenstrualAge` for a 32w0d infant 14 days old is `34+0`; `correctedAge` with `termWeeks: 40` is `−6+0` before term, the sentinel past `applicableUntil: 'P3Y'`, and still reported past three years when `applicableUntil` is omitted
- A future reference date returns a negative age rather than the sentinel, and this is documented
- `pnpm run validate` stays green
