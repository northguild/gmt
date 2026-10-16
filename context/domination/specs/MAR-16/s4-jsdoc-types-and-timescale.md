## 4. JSDoc drafts

Follow [jsdoc-standards](../../../jsdoc-standards.md). Every `@example` value is verified (§6). No peer
library is named.

### 4.1 Types

```ts
/**
 * A satellite navigation system's time scale, by its RINEX 4.02 time-system identifier: GPS time,
 * Galileo time, BeiDou time, QZSS time, GLONASS time (in UTC hours, as RINEX and BIPM report it),
 * NavIC time.
 */
export type GnssSystem = "GPS" | "GAL" | "BDT" | "QZS" | "GLO" | "IRN";

/**
 * A satellite week counter, named by system and, where a system broadcasts two, by navigation
 * message: GPS and QZSS LNAV count modulo 1024, their CNAV modulo 8192, Galileo modulo 4096,
 * BeiDou modulo 8192, NavIC LNAV (L5/S) modulo 1024 and L1NV modulo 8192. GLONASS has no week
 * counter. A RINEX navigation-file week is not one of these: see `RinexWeekSystem`.
 */
export type GnssWeekCounter =
  | "GPS-LNAV" | "GPS-CNAV" | "GAL" | "BDT" | "QZS-LNAV" | "QZS-CNAV" | "IRN-LNAV" | "IRN-L1NV";

/**
 * Which pass of a wrapping week counter a week number belongs to, in one of three forms.
 *
 * An integer from 0 is the era itself (era 0 starts at the system's epoch). `"rolling"` picks the
 * era that puts the week within half a counter period of today, for live receiver output; it reads
 * the clock, so the same stored value can give a different answer in a later year. `{ notBefore }`
 * picks the earliest occurrence at or after an instant you state — a receiver's firmware build
 * date, or the start of a recorded log — and gives the same answer in any year.
 */
export type RolloverEra = number | "rolling" | {
  /**
   * An ISO 8601 UTC instant. The week resolves to the earliest instant at or after it; an instant
   * exactly equal to it counts. Before the counter's epoch, or not an instant, returns the sentinel.
   */
  notBefore: string;
};

/** A week and time of week on one satellite week counter. */
export interface GnssWeek {
  /** The week number as the counter shows it, from 0 to the counter's modulus − 1. */
  week: number;
  /** Seconds since the start of the week, from 0 up to but not including 604 800. */
  timeOfWeekSeconds: number;
  /** How many times the counter has wrapped since the system's epoch. */
  era: number;
}

/** The systems whose RINEX navigation records carry a week number. GLONASS records do not. */
export type RinexWeekSystem = "GPS" | "GAL" | "BDT" | "QZS" | "IRN";

/** A week and time of week as a RINEX navigation record counts them: continuous, so no era. */
export interface RinexWeek {
  /** The continuous week number, counted from the record's epoch without wrapping. */
  week: number;
  /** Seconds since the start of the week, from 0 up to but not including 604 800. */
  timeOfWeekSeconds: number;
}
```

### 4.2 Timescale (`timescale/`)

A shared paragraph for the `timescale` functions (adapt per function): "TAI − UTC comes from the IERS
leap-second table built into GMT (Leap_Second.dat through Bulletin C 72, 6 July 2026). The table is
closed: the CGPM decided in 2026 that UTC becomes continuous on 20 May 2027, so after the last
insertion (2016-12-31) TAI − UTC stays 37 s."

```ts
/**
 * Return TAI − UTC, in whole seconds, at a UTC instant.
 *
 * - From the built-in IERS table: 10 s from 1972-01-01, 37 s from 2017-01-01 on. The table is
 *   closed (continuous UTC from 20 May 2027, CGPM 2026), so 37 holds for every later date.
 * - At an inserted leap second (`…T23:59:60Z`, accepted only on the 27 listed days) the value is
 *   the one before the insertion: TAI − UTC changes at 00:00:00 UTC.
 * - `null` before 1972-01-01 (TAI − UTC was then fractional with a daily rate term), for a
 *   second-60 string on a day with no insertion, and on invalid input.
 *
 * @param isoString ISO 8601 instant string; a listed leap second (`…T23:59:60Z`) is accepted
 * @returns TAI − UTC in seconds, or null on invalid input or a date before 1972
 *
 * @example taiMinusUtc("2024-01-01T00:00:00Z") // 37
 * @example taiMinusUtc("2016-01-01T00:00:00Z") // 36
 * @example taiMinusUtc("2016-12-31T23:59:60Z") // 36 — the inserted second
 * @example taiMinusUtc("2100-01-01T00:00:00Z") // 37
 * @example taiMinusUtc("1971-01-01T00:00:00Z") // null — before 1972
 */

/**
 * Return how many leap seconds fall between two UTC instants: the change in TAI − UTC.
 *
 * - Counts each leap second whose second starts in `[start, end)`: from `…T23:59:60Z` to the next
 *   `…T00:00:00Z` is 1; from `…T23:59:59Z` to `…T23:59:60Z` is 0.
 * - Signed: negative when `end` is before `start`.
 * - `null` when either instant is before 1972-01-01 or invalid.
 *
 * @param start ISO 8601 instant string
 * @param end ISO 8601 instant string
 * @returns the signed count, or null on invalid input or a date before 1972
 *
 * @example leapSecondsBetween("2020-01-01T00:00:00Z", "2024-01-01T00:00:00Z") // 0
 * @example leapSecondsBetween("2000-01-01T00:00:00Z", "2024-01-01T00:00:00Z") // 5
 * @example leapSecondsBetween("2024-01-01T00:00:00Z", "2000-01-01T00:00:00Z") // -5
 * @example leapSecondsBetween("2016-12-31T23:59:60Z", "2017-01-01T00:00:00Z") // 1
 * @example leapSecondsBetween("2016-12-31T23:59:60.5Z", "2017-01-01T00:00:00Z") // 0 — it started at 23:59:60.000
 * @example leapSecondsBetween("1971-01-01T00:00:00Z", "2024-01-01T00:00:00Z") // null
 */

/**
 * Return the first leap second after a UTC instant, as its UTC label `…T23:59:60Z`.
 *
 * - `""` for every instant from 2016-12-31T23:59:60Z on: there are no more. The table is closed
 *   (continuous UTC from 20 May 2027, CGPM 2026).
 * - `""` also on invalid input or a date before 1972; check with `isValidInstant` to tell them apart.
 *
 * @param isoString ISO 8601 instant string
 * @returns the next leap second's UTC label, or "" when there is none or on invalid input
 *
 * @example nextLeapSecond("2016-01-01T00:00:00Z") // "2016-12-31T23:59:60Z"
 * @example nextLeapSecond("1999-08-22T00:00:00Z") // "2005-12-31T23:59:60Z"
 * @example nextLeapSecond("2016-12-31T23:59:60Z") // ""
 * @example nextLeapSecond("2024-01-01T00:00:00Z") // ""
 */

/**
 * Convert a UTC instant to a TAI time-scale string, `YYYY-MM-DDTHH:MM:SS[.fraction] TAI`.
 *
 * - TAI = UTC + (TAI − UTC), from the built-in IERS table.
 * - An inserted leap second maps to its own TAI second: `2016-12-31T23:59:60Z` is
 *   `2017-01-01T00:00:36 TAI`. A second 60 on any other day returns "".
 * - Accepts any offset or bracketed zone `toNanoseconds` accepts; TAI has no zone.
 * - "" before 1972-01-01, for a result past year 9999, and on invalid input.
 *
 * @param isoString ISO 8601 instant string
 * @returns the TAI time-scale string, or "" on invalid input or a date before 1972
 *
 * @example toTAI("2026-01-01T00:00:00Z") // "2026-01-01T00:00:37 TAI"
 * @example toTAI("2013-06-01T00:00:00Z") // "2013-06-01T00:00:35 TAI"
 * @example toTAI("2016-12-31T23:59:60.5Z") // "2017-01-01T00:00:36.5 TAI"
 * @example toTAI("2017-12-31T23:59:60Z") // "" — no leap second that day
 * @example toTAI("1971-12-31T00:00:00Z") // ""
 */

/**
 * Convert a TAI time-scale string to a UTC instant string.
 *
 * - Reads `YYYY-MM-DDTHH:MM:SS[.fraction] TAI`: four-digit year, `T`, seconds required, 1 to 9
 *   fraction digits after `.`, one space, `TAI` (the FITS time-scale token). TAI has no second 60.
 * - During an inserted leap second the result is `…T23:59:60Z` (ITU-R TF.460-6 Annex 3). Only this
 *   realm's functions read that string back; other GMT functions reject a second of 60.
 * - "" before 1972-01-01T00:00:10 TAI and on invalid input.
 *
 * @param taiString TAI time-scale string
 * @returns ISO 8601 UTC instant string (`Z`), or "" on invalid input or a date before 1972
 *
 * @example fromTAI("2026-01-01T00:00:37 TAI") // "2026-01-01T00:00:00Z"
 * @example fromTAI("2017-01-01T00:00:36 TAI") // "2016-12-31T23:59:60Z"
 * @example fromTAI("2017-01-01T00:00:36.5 TAI") // "2016-12-31T23:59:60.5Z"
 * @example fromTAI("2024-01-01T00:00:37 GPS") // "" — wrong token
 * @example fromTAI("2016-12-31T23:59:60 TAI") // "" — TAI has no leap seconds
 */

/**
 * Return true when a UTC instant string is one of the 27 inserted leap seconds.
 *
 * - A table lookup, not a pattern match: `23:59:60` is well-formed on any day and real on 27 of
 *   them. For the syntax test alone, use `hasSecond60`.
 * - Accepts the inserted second in any offset spelling (`2017-01-01T08:59:60+09:00`).
 * - Leap smearing is not a leap second: a smeared clock never reads `23:59:60` and is up to a second
 *   off true UTC around an insertion. GMT cannot detect smearing.
 *
 * @param isoString ISO 8601 instant string
 * @returns true for an inserted leap second, or false otherwise and on invalid input
 *
 * @example isLeapSecond("2016-12-31T23:59:60Z") // true
 * @example isLeapSecond("2009-01-01T08:59:60+09:00") // true
 * @example isLeapSecond("2017-12-31T23:59:60Z") // false — well-formed, no insertion that day
 * @example isLeapSecond("2016-12-31T23:59:59Z") // false
 */
```
