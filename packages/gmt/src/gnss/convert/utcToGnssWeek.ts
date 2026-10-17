import type { GnssWeek, GnssWeekCounter } from "../../types/gnss";
import {
  formatUtcReading,
  GNSS_WEEK_COUNTERS,
  isGnssWeekCounter,
  parseUtcReading,
  scaleLabelOfUtc,
  weekOfLabel,
} from "../../internal";

/**
 * Return the week, time of week and era of a UTC instant on a satellite week counter.
 *
 * - The inverse of `gnssWeekToUtc`: `week` is what the counter shows, `era` how often it has
 *   wrapped.
 * - Time of week is a `number` of seconds; a fraction is the nearest double to the exact value.
 * - A listed leap second (`…T23:59:60Z`) falls in its own second of the week.
 * - `null` before the system's epoch, for an instant past 9999-12-31T23:59:59.999999999Z (the
 *   inverse writes four-digit years only), and on invalid input.
 *
 * @param counter the week counter: "GPS-LNAV", "GPS-CNAV", "GAL", "BDT", "QZS-LNAV", "QZS-CNAV", "IRN-LNAV" or "IRN-L1NV"
 * @param utcString ISO 8601 instant string; a listed leap second is accepted
 * @returns `{ week, timeOfWeekSeconds, era }`, or null on invalid input, before the system's epoch or past year 9999
 *
 * @example utcToGnssWeek("GPS-LNAV", "2019-04-07T00:00:00Z") // { week: 0, timeOfWeekSeconds: 18, era: 2 }
 * @example utcToGnssWeek("GPS-CNAV", "2019-04-07T00:00:00Z") // { week: 2048, timeOfWeekSeconds: 18, era: 0 }
 * @example utcToGnssWeek("GAL", "2019-04-07T00:00:00Z") // { week: 1024, timeOfWeekSeconds: 18, era: 0 }
 * @example utcToGnssWeek("BDT", "2024-01-01T00:00:00Z") // { week: 939, timeOfWeekSeconds: 86404, era: 0 }
 * @example utcToGnssWeek("GPS-LNAV", "2016-12-31T23:59:60Z") // { week: 906, timeOfWeekSeconds: 17, era: 1 }
 * @example utcToGnssWeek("GAL", "1999-08-21T23:59:46Z") // null — before Galileo's epoch
 * @example utcToGnssWeek("GPS-LNAV", "+010000-01-01T00:00:00Z") // null — past year 9999
 */
export function utcToGnssWeek(
  counter: GnssWeekCounter,
  utcString: string,
): GnssWeek | null {
  try {
    if (!isGnssWeekCounter(counter)) {
      return null;
    }
    const reading = parseUtcReading(utcString);
    // `gnssWeekToUtc` writes four-digit years only, so a week past 9999-12-31 could not be read back.
    if (reading === null || formatUtcReading(reading) === "") {
      return null;
    }
    const label = scaleLabelOfUtc(GNSS_WEEK_COUNTERS[counter].system, reading);
    return label === null ? null : weekOfLabel(counter, label.labelNanoseconds);
  } catch {
    return null;
  }
}
