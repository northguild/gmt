import type { GnssSystem } from "../../types/gnss";
import {
  formatTimeScaleString,
  isGnssSystem,
  parseUtcReading,
  scaleLabelOfUtc,
} from "../../internal";

/**
 * Convert a UTC instant to a satellite system's own time, as a time-scale string.
 *
 * - `GPS`, `GAL`, `BDT`, `QZS`: continuous scales a fixed number of seconds behind TAI (19, 19, 33,
 *   19), so their lead over UTC grows with every leap second and is read from the built-in table,
 *   never fixed. GPS was 0 s ahead at its 1980 epoch and is 18 s ahead since 2017.
 * - `IRN`: NavIC time, 19 s behind TAI. RINEX 4.02 Table 1 equates IRN with GPS time in whole
 *   seconds; BIPM publishes no NavIC relation, so the offset is derived, and NavIC's own ICD epoch
 *   (13 s ahead of UTC when TAI − UTC was 32 s) agrees.
 * - `GLO`: GLONASS time as RINEX and BIPM report it, "the same hours as UTC and not UTC+3 h" (RINEX
 *   4.02 §4.1.2), with UTC's leap seconds: the label is UTC's own wall clock. A raw broadcast
 *   GLONASS system time, which runs three hours ahead, must have the three hours removed first.
 * - The token after the space is the system's RINEX time-system identifier.
 * - Nominal scale relations only: the nanosecond corrections a satellite broadcasts are not applied.
 * - Galileo's count starts 13 s before 1999-08-22T00:00:00 UTC (Galileo OS SIS ICD Issue 2.2 §5.1.2).
 * - "" before the system's epoch (GPS and QZSS 1980-01-06, Galileo 1999-08-21T23:59:47Z, BeiDou
 *   2006-01-01, GLONASS 1972-01-01, NavIC 1999-08-21T23:59:47Z), for a result past year 9999, and
 *   on invalid input.
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
export function utcToGnss(system: GnssSystem, utcString: string): string {
  try {
    if (!isGnssSystem(system)) {
      return "";
    }
    const reading = parseUtcReading(utcString);
    if (reading === null) {
      return "";
    }
    const label = scaleLabelOfUtc(system, reading);
    return label === null ? "" : formatTimeScaleString(label, system);
  } catch {
    return "";
  }
}
