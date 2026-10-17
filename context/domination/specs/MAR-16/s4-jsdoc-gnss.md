## 4. JSDoc drafts (continued)

### 4.3 GNSS (`gnss/`)

```ts
/**
 * Convert a UTC instant to a satellite system's own time, as a time-scale string.
 *
 * - `GPS`, `GAL`, `BDT`, `QZS`: continuous scales a fixed number of seconds behind TAI (19, 19, 33,
 *   19), so their lead over UTC grows with every leap second and is read from the built-in table,
 *   never fixed. GPS was 0 s ahead at its 1980 epoch and is 18 s ahead since 2017.
 * - `IRN`: NavIC time (IRNSST), also 19 s behind TAI. Unlike the other four, no international body
 *   states that offset: it is derived from the NavIC ICD's epoch ("ahead of UTC by 13 leap seconds"
 *   when TAI − UTC was 32 s) and agrees with RINEX's "GPS = IRN = UTC + ΔtLS".
 * - `GLO`: GLONASS time as RINEX and BIPM report it, "the same hours as UTC and not UTC+3 h" (RINEX
 *   4.02 §4.1.2), with UTC's leap seconds: the label is UTC's own wall clock. A raw broadcast
 *   GLONASS system time, which runs three hours ahead, must have the three hours removed first.
 * - The token after the space is the system's RINEX time-system identifier.
 * - Nominal scale relations only: the nanosecond corrections a satellite broadcasts are not applied.
 * - Galileo's count starts 13 s before 1999-08-22T00:00:00 UTC (Galileo OS SIS ICD Issue 2.2 §5.1.2).
 * - "" before the system's epoch (GPS and QZSS 1980-01-06, Galileo 1999-08-21T23:59:47Z, BeiDou
 *   2006-01-01, GLONASS 1972-01-01, NavIC 1999-08-21T23:59:47Z), for a result past year 9999, and on invalid
 *   input.
 *
 * @param system satellite time scale: "GPS", "GAL", "BDT", "QZS", "GLO" or "IRN"
 * @param utcString ISO 8601 instant string; a listed leap second is accepted
 * @returns the system's time-scale string, or "" on invalid input or before the system's epoch
 *
 * @example utcToGnss("GPS", "1980-01-06T00:00:00Z") // "1980-01-06T00:00:00 GPS" — 0 s at the GPS epoch
 * @example utcToGnss("GPS", "2016-06-01T00:00:00Z") // "2016-06-01T00:00:17 GPS"
 * @example utcToGnss("GPS", "2024-01-01T00:00:00Z") // "2024-01-01T00:00:18 GPS"
 * @example utcToGnss("GPS", "2016-12-31T23:59:60Z") // "2017-01-01T00:00:17 GPS"
 * @example utcToGnss("GAL", "1999-08-22T00:00:00Z") // "1999-08-22T00:00:13 GAL"
 * @example utcToGnss("BDT", "2006-01-01T00:00:00Z") // "2006-01-01T00:00:00 BDT"
 * @example utcToGnss("BDT", "2024-01-01T00:00:00Z") // "2024-01-01T00:00:04 BDT"
 * @example utcToGnss("QZS", "2024-01-01T00:00:00Z") // "2024-01-01T00:00:18 QZS"
 * @example utcToGnss("GLO", "2024-01-01T00:00:00Z") // "2024-01-01T00:00:00 GLO"
 * @example utcToGnss("GLO", "2016-12-31T23:59:60Z") // "2016-12-31T23:59:60 GLO"
 * @example utcToGnss("IRN", "2024-01-01T00:00:00Z") // "2024-01-01T00:00:18 IRN"
 * @example utcToGnss("BDT", "2005-12-31T23:59:59Z") // "" — before BeiDou's epoch
 */

/**
 * Convert a satellite system's time-scale string to a UTC instant string.
 *
 * - Reads `YYYY-MM-DDTHH:MM:SS[.fraction] <token>` with the system's RINEX token. Any other token
 *   returns "".
 * - A continuous scale has no second 60; `GLO` has one exactly when UTC does.
 * - During an inserted leap second the result is `…T23:59:60Z`.
 * - "" before the system's epoch and on invalid input.
 *
 * @param system satellite time scale: "GPS", "GAL", "BDT", "QZS", "GLO" or "IRN"
 * @param value the system's time-scale string
 * @returns ISO 8601 UTC instant string (`Z`), or "" on invalid input or before the system's epoch
 *
 * @example gnssToUtc("GPS", "2017-01-01T00:00:17 GPS") // "2016-12-31T23:59:60Z"
 * @example gnssToUtc("GPS", "2038-11-21T00:00:00 GPS") // "2038-11-20T23:59:42Z"
 * @example gnssToUtc("BDT", "2024-01-01T00:00:04 BDT") // "2024-01-01T00:00:00Z"
 * @example gnssToUtc("GAL", "1999-08-22T00:00:00 GAL") // "1999-08-21T23:59:47Z"
 * @example gnssToUtc("GLO", "2016-12-31T23:59:60 GLO") // "2016-12-31T23:59:60Z"
 * @example gnssToUtc("GLO", "2017-12-31T23:59:60 GLO") // "" — no leap second that day
 * @example gnssToUtc("GPS", "2024-01-01T00:00:18 GAL") // "" — wrong token
 */

/**
 * Convert a week number and time of week, as a receiver reports them, to a UTC instant string.
 *
 * - Name the counter the week came from: GPS and QZSS LNAV wrap every 1024 weeks (about 19.6
 *   years), their CNAV every 8192, Galileo every 4096, BeiDou every 8192, NavIC LNAV every 1024
 *   and L1NV every 8192.
 * - A week number alone cannot say which pass it is, so `rolloverEra` is required: an integer (era
 *   0 starts at the system's epoch); `"rolling"` for the pass within half a counter period of today;
 *   or `{ notBefore }` for the earliest pass at or after an instant you state, as a receiver that
 *   resolves weeks against its firmware build date does. Receivers that report a stale week need an
 *   integer or a pivot.
 * - `timeOfWeekSeconds` is seconds of week and may have a fraction; it is rounded to the nearest
 *   nanosecond. Convert a coarser broadcast count first (NavIC L5/S: TOWC × 12; NavIC L1: ITOW × 7200
 *   + TOI × 18, per the NavIC ICDs).
 * - A week time inside an inserted leap second returns `…T23:59:60Z`.
 * - GLONASS has no week counter, so it is not a counter here.
 * - A RINEX navigation-file week is a continuous count, not a broadcast week: read it with
 *   `rinexWeekToUtc`. A RINEX NavIC week given to `"IRN-L1NV"` would be 1024 weeks off.
 * - "" when `week`, `timeOfWeekSeconds` or `rolloverEra` is out of range, for a result past year
 *   9999, and on invalid input.
 *
 * @param counter the week counter: "GPS-LNAV", "GPS-CNAV", "GAL", "BDT", "QZS-LNAV", "QZS-CNAV", "IRN-LNAV" or "IRN-L1NV"
 * @param week week number as the counter shows it, 0 to the counter's modulus − 1
 * @param timeOfWeekSeconds seconds since the start of the week, 0 up to but not including 604 800
 * @param rolloverEra the counter's pass: an integer from 0, or "rolling"
 * @returns ISO 8601 UTC instant string (`Z`), or "" on invalid input
 *
 * @example gnssWeekToUtc("GPS-LNAV", 100, 0, 0) // "1981-12-05T23:59:59Z"
 * @example gnssWeekToUtc("GPS-LNAV", 100, 0, 1) // "2001-07-21T23:59:47Z"
 * @example gnssWeekToUtc("GPS-LNAV", 0, 0, 3) // "2038-11-20T23:59:42Z" — the third LNAV rollover
 * @example gnssWeekToUtc("GPS-CNAV", 2295, 86418, 0) // "2024-01-01T00:00:00Z"
 * @example gnssWeekToUtc("BDT", 939, 86404, 0) // "2024-01-01T00:00:00Z"
 * @example gnssWeekToUtc("GPS-LNAV", 906, 17, 1) // "2016-12-31T23:59:60Z"
 * @example gnssWeekToUtc("GPS-LNAV", 0, 0, 2) // "2019-04-06T23:59:42Z" — the second LNAV rollover
 * @example gnssWeekToUtc("GPS-LNAV", 1020, 0, { notBefore: "2019-01-01T00:00:00Z" }) // "2019-03-09T23:59:42Z"
 * @example gnssWeekToUtc("GPS-LNAV", 1020, 0, { notBefore: "2019-04-07T00:00:00Z" }) // "2038-10-23T23:59:42Z" — after the 2019 rollover
 * @example gnssWeekToUtc("GPS-LNAV", 0, 0, { notBefore: "2019-04-06T23:59:42Z" }) // "2019-04-06T23:59:42Z" — equal counts
 * @example gnssWeekToUtc("GAL", 100, 0, { notBefore: "1999-01-01T00:00:00Z" }) // "2001-07-21T23:59:47Z" — before Galileo's epoch: era 0
 * @example gnssWeekToUtc("GPS-LNAV", 1024, 0, 2) // "" — an LNAV week stops at 1023
 */

/**
 * Return the week, time of week and era of a UTC instant on a satellite week counter.
 *
 * - The inverse of `gnssWeekToUtc`: `week` is what the counter shows, `era` how often it has
 *   wrapped.
 * - Time of week is a `number` of seconds; a fraction is the nearest double to the exact value.
 * - `null` before the system's epoch and on invalid input.
 *
 * @param counter the week counter: "GPS-LNAV", "GPS-CNAV", "GAL", "BDT", "QZS-LNAV", "QZS-CNAV", "IRN-LNAV" or "IRN-L1NV"
 * @param utcString ISO 8601 instant string; a listed leap second is accepted
 * @returns `{ week, timeOfWeekSeconds, era }`, or null on invalid input or before the system's epoch
 *
 * @example utcToGnssWeek("GPS-LNAV", "2019-04-07T00:00:00Z") // { week: 0, timeOfWeekSeconds: 18, era: 2 }
 * @example utcToGnssWeek("GPS-CNAV", "2019-04-07T00:00:00Z") // { week: 2048, timeOfWeekSeconds: 18, era: 0 }
 * @example utcToGnssWeek("GAL", "2019-04-07T00:00:00Z") // { week: 1024, timeOfWeekSeconds: 18, era: 0 }
 * @example utcToGnssWeek("BDT", "2024-01-01T00:00:00Z") // { week: 939, timeOfWeekSeconds: 86404, era: 0 }
 * @example utcToGnssWeek("GPS-LNAV", "2016-12-31T23:59:60Z") // { week: 906, timeOfWeekSeconds: 17, era: 1 }
 * @example utcToGnssWeek("GAL", "1999-08-21T23:59:46Z") // null — before Galileo's epoch
 */

/**
 * Convert a week number from a RINEX navigation file, and the seconds of that week, to a UTC
 * instant string.
 *
 * - A RINEX navigation record's week is a continuous count that never wraps. For GPS, QZSS, NavIC
 *   and Galileo records it counts from the GPS epoch, 1980-01-06 (RINEX 4.02 Table A30: "Continuous
 *   number, not mod (1024), counted from 1980 (same as GPS)"; Tables A9, A13, A19). A BeiDou record counts BDT weeks from
 *   2006-01-01 (RINEX 4.02 §5.4.6, Table A23).
 * - CNAV/CNAV-2, BDS CNAV-1/2/3 and NavIC L1NV records have no week column: take the week from the
 *   record's epoch line.
 * - It is not the week a satellite broadcasts: a NavIC broadcast week counts from 1999 and wraps.
 *   Use `gnssWeekToUtc` for those.
 * - A full GPS week number from any other source is the same count, so `"GPS"` reads it too.
 * - GLONASS records carry no week number.
 * - "" for a negative or non-integer week, a time of week outside 0 up to 604 800, a result past year
 *   9999, and on invalid input.
 *
 * @param system the RINEX record's system: "GPS", "GAL", "BDT", "QZS" or "IRN"
 * @param week the record's week number
 * @param timeOfWeekSeconds seconds since the start of the week, 0 up to but not including 604 800
 * @returns ISO 8601 UTC instant string (`Z`), or "" on invalid input
 *
 * @example rinexWeekToUtc("IRN", 2295, 86418) // "2024-01-01T00:00:00Z"
 * @example rinexWeekToUtc("GPS", 1930, 17) // "2016-12-31T23:59:60Z"
 * @example rinexWeekToUtc("GPS", 3072, 0) // "2038-11-20T23:59:42Z"
 * @example rinexWeekToUtc("BDT", 809, 165600) // "2021-07-05T21:59:56Z" — RINEX Table A27's C05 record
 * @example rinexWeekToUtc("GPS", -1, 0) // ""
 */

/**
 * Return the RINEX navigation-file week and seconds of week of a UTC instant.
 *
 * - The inverse of `rinexWeekToUtc`; the week is continuous, so there is no era.
 * - `null` before the record's epoch and on invalid input.
 *
 * @param system the RINEX record's system: "GPS", "GAL", "BDT", "QZS" or "IRN"
 * @param utcString ISO 8601 instant string; a listed leap second is accepted
 * @returns `{ week, timeOfWeekSeconds }`, or null on invalid input
 *
 * @example utcToRinexWeek("IRN", "2024-01-01T00:00:00Z") // { week: 2295, timeOfWeekSeconds: 86418 }
 * @example utcToRinexWeek("GPS", "1980-01-05T23:59:59Z") // null
 */
```

`"rolling"` gets no `@example`: its result depends on the day the check runs.

### 4.4 `hasSecond60`

Keep the current JSDoc with the name changed throughout, and end its first bullet with: "It does not
check that one was inserted on that day; for that, use `isLeapSecond` from `timescale/`." Keep every
`@example`, renamed.

---
