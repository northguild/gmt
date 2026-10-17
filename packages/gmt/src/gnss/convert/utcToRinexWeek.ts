import type { RinexWeek, RinexWeekSystem } from "../../types/gnss";
import {
  formatUtcReading,
  isRinexWeekSystem,
  parseUtcReading,
  RINEX_WEEK_EPOCHS,
  scaleLabelOfUtc,
  weeksSince,
} from "../../internal";

/**
 * Return the RINEX navigation-file week and seconds of week of a UTC instant.
 *
 * - The inverse of `rinexWeekToUtc`; the week is continuous, so there is no era.
 * - GPS, QZSS, NavIC and Galileo weeks count from 1980-01-06; BeiDou weeks from 2006-01-01.
 * - `null` before the system's epoch, for an instant past 9999-12-31T23:59:59.999999999Z (the
 *   inverse writes four-digit years only), and on invalid input.
 *
 * @param system the RINEX record's system: "GPS", "GAL", "BDT", "QZS" or "IRN"
 * @param utcString ISO 8601 instant string; a listed leap second is accepted
 * @returns `{ week, timeOfWeekSeconds }`, or null on invalid input, before the system's epoch or past year 9999
 *
 * @example utcToRinexWeek("IRN", "2024-01-01T00:00:00Z") // { week: 2295, timeOfWeekSeconds: 86418 }
 * @example utcToRinexWeek("BDT", "2021-07-05T21:59:56Z") // { week: 809, timeOfWeekSeconds: 165600 }
 * @example utcToRinexWeek("GPS", "1980-01-05T23:59:59Z") // null
 * @example utcToRinexWeek("GPS", "+010000-01-01T00:00:00Z") // null — past year 9999
 */
export function utcToRinexWeek(
  system: RinexWeekSystem,
  utcString: string,
): RinexWeek | null {
  try {
    if (!isRinexWeekSystem(system)) {
      return null;
    }
    const reading = parseUtcReading(utcString);
    // `rinexWeekToUtc` writes four-digit years only, so a week past 9999-12-31 could not be read back.
    if (reading === null || formatUtcReading(reading) === "") {
      return null;
    }
    const epoch = RINEX_WEEK_EPOCHS[system];
    const label = scaleLabelOfUtc(epoch.system, reading);
    if (label === null) {
      return null;
    }
    const split = weeksSince(epoch.epochLabel, label.labelNanoseconds);
    return split === null
      ? null
      : {
          week: Number(split.fullWeek),
          timeOfWeekSeconds: split.timeOfWeekSeconds,
        };
  } catch {
    return null;
  }
}
