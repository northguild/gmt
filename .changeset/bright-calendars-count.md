---
"@northguild/gmt": patch
---

Fix non-ISO calendar arithmetic, differences and range limits that were wrong, empty or unparseable, so every supported calendar follows TC39 Temporal and the Intl Era and Month Code proposal across the whole representable range.

Several of these fixes change outputs that shipped. Each earlier output was wrong under the specification, so each change is a bug fix, not a new behaviour. The examples use this release's RFC 9557 calendar strings, described in their own entry.

- **Month and year differences at month ends are correct in every non-ISO calendar.** A month counts only once the end date reaches the same day of the next month, as Temporal's `NonISODateSurpasses` specifies. `diffDateAsDuration("2024-08-31[u-ca=buddhist]", "2024-09-30[u-ca=buddhist]", "months")` is `"P30D"`, not `"P1M"`. This changes results from `diffDate`, `diffDateAsDuration`, `intervalLengthDate`, `intervalCountDate`, `diffZoned`, `diffZonedAsDuration`, `intervalLengthZoned` and `intervalCountZoned` for calendar-annotated input. The rounding options of `diffDate` and `diffDateAsDuration` now round from that correct difference.
- **Hebrew year differences across a leap month return a value.** A difference in years from an Adar I date in a leap year used to return `null` or `""`. `diffDateAsDuration("2024-02-24[u-ca=hebrew]", "2025-03-15[u-ca=hebrew]", "years")` is `"P1Y"`.
- **Calendar dates at both range limits parse, and arithmetic works there.** `isValidCalendarDate("+275760-09-13[u-ca=hebrew]")` is `true`. `addDate`, `subtractDate`, `diffDate*` and the duration functions work near the first and last dates in buddhist, hebrew, the Islamic calendars, persian and indian.
- **Buddhist is proleptic.** Its year is the ISO year plus 543 with the same month and day for every date, so month arithmetic before 1582-10-15 follows the proleptic Gregorian calendar: `addDate("1000-01-31[u-ca=buddhist]", { months: 1 })` is `"1000-02-28[u-ca=buddhist]"`.
- **Hebrew years ≤ 0 and Indian dates before ISO year 1 are correct.** Their fields were a day off, threw, or returned the sentinel, which put arithmetic on those dates a day off too.
- **Zoned values at the minimum instant in zones behind UTC are accepted.** `convertZonedToCalendar("-271821-04-19T12:00:00[Etc/GMT+12]", "hebrew")` is `"-271821-04-19T12:00:00-12:00[Etc/GMT+12][u-ca=hebrew]"`. With an explicit `-12:00` offset, Temporal checks that local date against the day range and rejects it, so that form still returns `""`.
- **A calendar-annotated `relativeTo` works near the range limits** in `durationAs`, `normalizeDuration` and `compareDurations`.

Each correction checks the installed Temporal polyfill and ICU once and stays inactive where they are already right, so no output changes when the upstream fixes ship.
