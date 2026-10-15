import type { GnssSystem } from "../../types/gnss";
import {
  formatUtcReading,
  isGnssSystem,
  parseTimeScaleString,
  utcOfScaleLabel,
} from "../../internal";

/**
 * Convert a satellite system's time-scale string to a UTC instant string.
 *
 * - Reads `YYYY-MM-DDTHH:MM:SS[.fraction] <token>` with the system's RINEX token. Any other token
 *   returns "".
 * - A continuous scale has no second 60; `GLO` has one exactly when UTC does.
 * - During an inserted leap second the result is `…T23:59:60Z`. Only this realm's functions read
 *   that string back; other GMT functions reject a second of 60.
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
export function gnssToUtc(system: GnssSystem, value: string): string {
  try {
    if (!isGnssSystem(system)) {
      return "";
    }
    const label = parseTimeScaleString(value, system);
    if (label === null) {
      return "";
    }
    const reading = utcOfScaleLabel(system, label);
    return reading === null ? "" : formatUtcReading(reading);
  } catch {
    return "";
  }
}
