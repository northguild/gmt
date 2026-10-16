import type { GnssWeekCounter, RolloverEra } from "../../types/gnss";
import {
  formatUtcReading,
  GNSS_WEEK_COUNTERS,
  isGnssWeekCounter,
  labelOfWeek,
  resolveRolloverEra,
  timeOfWeekNanoseconds,
  utcOfScaleLabel,
  weekNumber,
} from "../../internal";

/**
 * Convert a week number and time of week, as a receiver reports them, to a UTC instant string.
 *
 * - Name the counter the week came from: GPS and QZSS LNAV wrap every 1024 weeks (about 19.6
 *   years), their CNAV every 8192, Galileo every 4096, BeiDou every 8192, NavIC LNAV every 1024
 *   and L1NV every 8192.
 * - A week number alone cannot say which pass it is, so `rolloverEra` is required: an integer (era
 *   0 starts at the system's epoch); `"rolling"` for the pass within half a counter period of today;
 *   or `{ notBefore }` for the earliest pass at or after an instant you state, as a receiver that
 *   resolves weeks against its firmware build date does. An instant exactly at `notBefore` counts.
 *   Receivers that report a stale week need an integer or a pivot.
 * - `timeOfWeekSeconds` is seconds of week and may have a fraction; it is rounded to the nearest
 *   nanosecond. Convert a coarser broadcast count first (NavIC L5/S: TOWC × 12; NavIC L1: ITOW × 7200
 *   + TOI × 18, per the NavIC ICDs).
 * - A week time inside an inserted leap second returns `…T23:59:60Z`. Only this realm's functions
 *   read that string back; other GMT functions reject a second of 60.
 * - GLONASS has no week counter, so it is not a counter here.
 * - A RINEX navigation-file week is a continuous count, not a broadcast week: read it with
 *   `rinexWeekToUtc`. A RINEX NavIC week given to `"IRN-L1NV"` would be 1024 weeks off.
 * - "" when `week`, `timeOfWeekSeconds` or `rolloverEra` is out of range (a `notBefore` before the
 *   counter's epoch included), for a result past year 9999, and on invalid input.
 *
 * @param counter the week counter: "GPS-LNAV", "GPS-CNAV", "GAL", "BDT", "QZS-LNAV", "QZS-CNAV", "IRN-LNAV" or "IRN-L1NV"
 * @param week week number as the counter shows it, 0 to the counter's modulus − 1
 * @param timeOfWeekSeconds seconds since the start of the week, 0 up to but not including 604 800
 * @param rolloverEra the counter's pass: an integer from 0, "rolling", or `{ notBefore }` with an ISO 8601 UTC instant
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
 * @example gnssWeekToUtc("GAL", 100, 0, { notBefore: "1999-01-01T00:00:00Z" }) // "" — before Galileo's epoch
 * @example gnssWeekToUtc("GPS-LNAV", 1024, 0, 2) // "" — an LNAV week stops at 1023
 */
export function gnssWeekToUtc(
  counter: GnssWeekCounter,
  week: number,
  timeOfWeekSeconds: number,
  rolloverEra: RolloverEra,
): string {
  try {
    if (!isGnssWeekCounter(counter)) {
      return "";
    }
    const { system, modulus } = GNSS_WEEK_COUNTERS[counter];
    const counterWeek = weekNumber(week);
    if (counterWeek === null || counterWeek >= modulus) {
      return "";
    }
    const timeOfWeek = timeOfWeekNanoseconds(timeOfWeekSeconds);
    if (timeOfWeek === null) {
      return "";
    }
    const era = resolveRolloverEra(
      counter,
      counterWeek,
      timeOfWeek,
      rolloverEra,
    );
    if (era === null) {
      return "";
    }
    const reading = utcOfScaleLabel(system, {
      labelNanoseconds: labelOfWeek(counter, counterWeek, timeOfWeek, era),
      secondSixty: false,
    });
    return reading === null ? "" : formatUtcReading(reading);
  } catch {
    return "";
  }
}
