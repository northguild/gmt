import type { RinexWeekSystem } from "../../types/gnss";
import {
  formatUtcReading,
  isRinexWeekSystem,
  labelOfFullWeek,
  RINEX_WEEK_EPOCHS,
  timeOfWeekNanoseconds,
  utcOfScaleLabel,
  weekNumber,
} from "../../internal";

/**
 * Convert a week number from a RINEX navigation file, and the seconds of that week, to a UTC
 * instant string.
 *
 * - A RINEX navigation record's week is a continuous count that never wraps. For GPS, QZSS, NavIC
 *   and Galileo records it counts from the GPS epoch, 1980-01-06 (RINEX 4.02 Table A30: "Continuous
 *   number, not mod (1024), counted from 1980 (same as GPS)"; Tables A9, A13, A19). A BeiDou record
 *   counts BDT weeks from 2006-01-01 (RINEX 4.02 §5.4.6, Table A23).
 * - CNAV/CNAV-2, BDS CNAV-1/2/3 and NavIC L1NV records have no week column: take the week from the
 *   record's epoch line.
 * - It is not the week a satellite broadcasts: a NavIC broadcast week counts from 1999 and wraps.
 *   Use `gnssWeekToUtc` for those.
 * - A full GPS week number from any other source is the same count, so `"GPS"` reads it too.
 * - GLONASS records carry no week number.
 * - A week time inside an inserted leap second returns `…T23:59:60Z`.
 * - "" for a negative or non-integer week, a time of week outside 0 up to 604 800, a time before
 *   the system's epoch (Galileo and NavIC time start on 1999-08-22, RINEX week 1024), a result past
 *   year 9999, and on invalid input.
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
export function rinexWeekToUtc(
  system: RinexWeekSystem,
  week: number,
  timeOfWeekSeconds: number,
): string {
  try {
    if (!isRinexWeekSystem(system)) {
      return "";
    }
    const fullWeek = weekNumber(week);
    if (fullWeek === null) {
      return "";
    }
    const timeOfWeek = timeOfWeekNanoseconds(timeOfWeekSeconds);
    if (timeOfWeek === null) {
      return "";
    }
    const epoch = RINEX_WEEK_EPOCHS[system];
    const reading = utcOfScaleLabel(epoch.system, {
      labelNanoseconds: labelOfFullWeek(epoch.epochLabel, fullWeek, timeOfWeek),
      secondSixty: false,
    });
    return reading === null ? "" : formatUtcReading(reading);
  } catch {
    return "";
  }
}
