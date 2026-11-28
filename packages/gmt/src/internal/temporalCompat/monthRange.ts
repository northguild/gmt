/*
 * D9, out-of-range half: a month amount past Temporal's date range throws before any arithmetic.
 *
 * `temporal-polyfill` 1.0.8 throws RangeError for such an amount only after work linear in the
 * amount (`{ months: 4294967295 }` in hebrew: about 5 s). TC39 Temporal throws RangeError for it
 * too (`CalendarDateAdd` ends with `ISODateWithinLimits`; a ZonedDateTime result is checked by
 * `IsValidEpochNanoseconds`), so throwing first changes no result. The guard is always on, not
 * probe-gated: a probe would cost what the guard saves, and it fires only where the spec throws.
 *
 * Why |months| > MAX_MONTHS_IN_RANGE proves the result is out of range: `IsValidDuration` gives
 * every non-zero field one sign, so years, weeks and days never offset months, and a months amount
 * larger than the most months between two in-range dates lands outside the range from every
 * in-range start. A ZonedDateTime's range is narrower than a PlainDate's, so the bound holds there.
 *
 * Call sites (helper → public functions that reach it). The guard sits at the narrowest shared
 * helper. Paths that accept only iso8601 (the date-time functions, `getDateTimeIn/Ago`, the UTC
 * functions, the year-month functions) do ISO arithmetic, which is O(1) in every polyfill, so
 * their guard is not needed for speed; the date-time and year-month ones keep it by Decision 2 of
 * CORE-108 (the guard covers year-months, and a date-time call states the same limit).
 *
 * | Helper | Public functions |
 * | ------ | ---------------- |
 * | `calendarDateAdd` (here) | addDate, subtractDate, diffDate, getDateIn, getDateAgo, intervalFromDurationDate, splitIntervalByUnitDate (its `tileByUnit` steps through `plainDateAdd`), intervalLengthDate, and every zoned date step |
 * | `addToZoned`, `subtractFromZoned` | addUnix, subtractUnix, diffUnix, intervalFromDurationUnix, diffZoned, splitIntervalByUnitZoned (its `tileByUnit` steps through `addToZoned`), getZonedIn, getZonedAgo, diffUtc, addToZonedDisambiguated (non-compatible paths reach `calendarDateAdd`) |
 * | `addToZonedDisambiguated` | addZoned, subtractZoned, intervalFromDurationZoned |
 * | `durationTotal`, `durationRound`, `durationCompare` | totalDuration, totalUnits, normalizeDuration, compareDurations, intervalLength*, formatRelative* |
 * | `moveYearMonth` | addYearMonth, subtractYearMonth |
 * | `addDateTime`, `subtractDateTime`, `intervalFromDurationDateTime` (direct `PlainDateTime#add`, ISO only) | the same-named functions |
 *
 * Stepping loops (`tileByUnit` in `internal/splitStep.ts`) add a calendar-unit duration through the
 * caller's add, which is one of the helpers above for every non-ISO calendar. `splitIntervalByUnitDateTime`
 * is ISO only, so its steps are O(1) and need no guard of their own. *
 * `addDuration` and `subtractDuration` take no `relativeTo`, so a calendar amount throws in the
 * specification before any date arithmetic; they need no guard.
 */

/**
 * The largest month count between any two dates Temporal can represent, in any GMT calendar.
 * 13 months × (whole years that fit the range + 1).
 */
export const MAX_MONTHS_IN_RANGE =
  13 * // the most months in any year (Intl era/monthCode proposal §4.1.4 Table 3: M13)
  (Math.ceil(
    200_000_001 / // days from -271821-04-19 to +275760-09-13 (ISODateWithinLimits)
      353, // days in the shortest year of any GMT calendar (hebrew deficient common year, Dershowitz & Reingold)
  ) +
    1); // the partial years at both ends

/**
 * Throws RangeError when `|months|` exceeds `MAX_MONTHS_IN_RANGE`. Reads nothing from Temporal.
 *
 * @param months a Duration's `months` field, or `undefined` for a DurationLike without one
 */
export function assertMonthsInRange(months: number | undefined): void {
  // An absent field is 0; `undefined` is neither past the bound nor a number to compare.
  if (months !== undefined && Math.abs(months) > MAX_MONTHS_IN_RANGE) {
    throw new RangeError("months amount past Temporal's date range");
  }
}
