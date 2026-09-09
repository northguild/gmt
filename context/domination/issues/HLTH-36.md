# HLTH-36 — Healthcare: Clinical age calculation

**Scope:** Age at a reference date, including the neonatal and gestational forms clinical systems require.

## Gap

Age looks trivial and is not. Three distinct problems:

- **A documented off-by-one.** Timezone offsets must be normalised **only** when the comparison precision is hours or finer. Normalising for a months-or-years comparison introduces the very error it appears to prevent, because a date shifted across midnight changes the year count.
  ([US CQL IG, patient patterns](https://build.fhir.org/ig/HL7/us-cql-ig/patterns-patient.html))
- **29 February birthdays.** In a non-leap year there is no anniversary, and the convention must be stated rather than inherited from whatever the arithmetic happens to do.
- **Age is not always in years.** Neonatal age is in hours or days, paediatric age in months, and gestational age in weeks plus days. A years-only function is unusable in obstetrics and neonatology.

## Scope

- `packages/gmt/src/health/calculate/ageAt.ts`:
  - `ageAt(birthDate: string, at: string, options?: { unit?: 'year' | 'month' | 'week' | 'day' | 'hour', leapDayRule?: 'feb28' | 'mar1' }): { value: number, unit: string } | null`
  - `ageParts(birthDate: string, at: string): { years: number, months: number, days: number } | null`
- `packages/gmt/src/health/calculate/neonatalAge.ts`:
  - `neonatalAge(birthDateTime: string, at: string): { hours: number, days: number } | null` — Requires full precision on both inputs; a date-only birth is insufficient.
- `packages/gmt/src/health/calculate/gestationalAge.ts`:
  - `gestationalAge(lmpOrEdd: { lmp?: string, edd?: string }, at: string): { weeks: number, days: number } | null` — The conventional `w+d` form.

## Design notes

- **Date arithmetic, not instant arithmetic, for coarse units.** `ageAt` with unit `'year'` or `'month'` compares calendar dates and must not convert to instants. Only `'hour'` normalises offsets. This is the documented rule and the reason the unit is a parameter rather than the caller dividing a duration.
- **`leapDayRule` has no safe default**, so it is explicit and documented. Both conventions are in real use, and jurisdictions differ on which applies for legal age.
- **`neonatalAge` requires a time.** A newborn's age in hours cannot be computed from a date, and silently assuming midnight would misstate it by up to a day — clinically significant in the first 72 hours.
- **Gestational age is `weeks + days`**, never decimal weeks. `38+4` is the clinical form and rounding it to 38.6 weeks is wrong in a way clinicians will notice.
- A partial birth date (HLTH-35) yields an age range, not a number. Callers pass a resolved date; the function returns the sentinel for imprecise input rather than guessing.

## What gmt provides (do not re-implement)

- `comparePartialDates` from HLTH-35 — for callers holding imprecise birth dates
- `spanWallClock` from CORE-2 — calendar-distance spans
- `spanMs` from CORE-2 — exact elapsed time for the hour unit
- `getZonedDateTimeFields` — calendar field extraction

## Verification

- Age in years the day before a birthday is one less than on the birthday
- A birth date and reference date in different timezones yield the same age in years, and may legitimately differ in hours — both asserted
- 29 February birth with `leapDayRule: 'feb28'` increments on 28 February in a non-leap year; `'mar1'` increments on 1 March
- `ageParts` sums correctly across a month boundary and a leap year
- `neonatalAge` returns hours for a birth 30 hours prior
- `neonatalAge` with a date-only birth returns the sentinel
- `gestationalAge` returns `{ weeks: 38, days: 4 }`, never a decimal
- A future reference date returns a negative age rather than the sentinel, and this is documented
- `pnpm run validate` stays green
