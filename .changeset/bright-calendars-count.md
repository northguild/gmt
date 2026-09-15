---
"@northguild/gmt": patch
---

Fix non-ISO calendar dates, differences and strings that were wrong, empty or unparseable, so every supported calendar follows TC39 Temporal and the Intl Era and Month Code proposal across the whole representable range.

Several of these fixes change outputs that shipped. Each earlier output was wrong under the specification, so each change is a bug fix, not a new behaviour.

- **Month and year differences at month ends are correct in every non-ISO calendar.** A month counts only once the end date reaches the same day of the next month, as Temporal's `NonISODateSurpasses` specifies. `diffDateAsDuration("2567-08-31[u-ca=buddhist]", "2567-09-30[u-ca=buddhist]", "months")` is now `"P30D"`, not `"P1M"`. This changes existing results from `diffDate`, `diffDateAsDuration`, `intervalLengthDate`, `intervalCountDate`, `diffZoned`, `diffZonedAsDuration`, `intervalLengthZoned` and `intervalCountZoned` for calendar-annotated input. The rounding options of `diffDate` and `diffDateAsDuration` now round from that correct difference.
- **Hebrew year differences across a leap month return a value.** A difference in years from an Adar I date in a leap year used to return `null` or `""`. `diffDateAsDuration("5784-06-15[u-ca=hebrew]", "5785-06-15[u-ca=hebrew]", "years")` is `"P1Y"`.
- **Calendar strings at both range limits parse, and arithmetic works there.** `isValidCalendarDate("279517-10-11[u-ca=hebrew]")` is now `true`, so the output of `convertDateToCalendar("+275760-09-13", "hebrew")` reads back. `addDate`, `subtractDate`, `diffDate*` and the duration functions work near the first and last dates in buddhist, hebrew, the Islamic calendars, persian and indian.
- **Negative calendar years are representable.** A negative year is written as a minus sign and six digits, the form Temporal's `PadISOYear` writes: `convertDateToCalendar("1000-01-01", "taiwan")` is `"-000911-01-01[u-ca=taiwan]"`. The previous output, `-911-…`, was rejected by GMT's own validator. `-0911` and `-000000` are rejected. Positive years keep their existing digits.
- **Japanese eras use the proposal's era codes.** Dates up to 1872-12-31 are `ce`, ISO years ≤ 0 are `bce`, and `meiji` starts on 1873-01-01 at year 6.
  - `convertDateToCalendar("1800-01-01", "japanese")` is now `"1800-01-01[u-ca=japanese;era=ce]"`, not `;era=japanese`.
  - `"1868-10-23"` is `"1868-10-23[u-ca=japanese;era=ce]"`, not Meiji year 1.
  - `"-000500-06-15"` is `"0501-06-15[u-ca=japanese;era=bce]"`.
  - `;era=japanese` is still accepted as input, as a deprecated alias of `ce`, until the next major version. `;era=japanese-inverse` is rejected.
- **Buddhist is proleptic.** The year is the ISO year plus 543 for every date, with the same month and day. `convertDateToCalendar("1000-01-01", "buddhist")` is now `"1543-01-01[u-ca=buddhist]"`, not `"1542-12-27[u-ca=buddhist]"`. Every buddhist value and difference before 1582-10-15 was wrong before.
- **Hebrew years ≤ 0 and Indian dates before ISO year 1 are correct.** They were a day off, threw, or returned the sentinel. `convertDateToCalendar("-003761-09-01", "hebrew")` is `"0000-01-13[u-ca=hebrew]"`, and `convertDateToCalendar("-000500-06-15", "indian")` is `"-000578-03-25[u-ca=indian]"`.
- **Zoned values at the minimum instant in zones behind UTC are accepted.** `convertZonedToCalendar("-271821-04-19T12:00:00[Etc/GMT+12]", "hebrew")` is `"-268058-11-04T12:00:00-12:00[u-ca=hebrew][Etc/GMT+12]"`. With an explicit `-12:00` offset, Temporal checks that local date against the day range and rejects it, so that form still returns `""`.
- **A calendar-annotated `relativeTo` works near the range limits** in `durationAs`, `normalizeDuration` and `compareDurations`.

Each correction checks the installed Temporal polyfill and ICU once and stays inactive where they are already right, so no output changes when the upstream fixes ship.
