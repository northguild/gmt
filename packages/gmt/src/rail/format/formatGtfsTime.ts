import { isObject, writeGtfsTime } from "../../internal";
import type { GtfsTime } from "../../types";

/**
 * Writes a GTFS Schedule `Time` value, keeping the days past the service day in the hour.
 *
 * - Writes `HH:MM:SS` with at least two hour digits: `08:05:00`, not `8:05:00`; `110:29:00`.
 * - `dayOverflow` adds 24 hours a day, so `{ seconds: 5700, dayOverflow: 1 }` is `25:35:00`,
 *   never `01:35:00`.
 * - A value over `999:59:59` cannot be written in three digits and returns `""`.
 * - The argument is read like a property bag: any object, a function included; each member is
 *   read once, inherited members are read and extra members are ignored.
 *
 * Source: GTFS Schedule Reference § Field Types, Time.
 *
 * @param value The time of day (`seconds`, 0–86399) and the whole days past the service day
 *   (`dayOverflow`, 0 or more).
 * @returns The GTFS `Time` string, or `""` on invalid input (not a `GtfsTime`, or past
 *   `999:59:59`)
 *
 * @example formatGtfsTime({ seconds: 5700, dayOverflow: 1 }) // "25:35:00"
 * @example formatGtfsTime({ seconds: 29100, dayOverflow: 0 }) // "08:05:00"
 * @example formatGtfsTime({ seconds: 0, dayOverflow: 1 }) // "24:00:00"
 * @example formatGtfsTime({ seconds: 86400, dayOverflow: 0 }) // ""
 */
export function formatGtfsTime(value: GtfsTime): string {
  try {
    if (!isObject(value)) return "";
    const { seconds, dayOverflow } = value;
    return writeGtfsTime(seconds, dayOverflow);
  } catch {
    // Never throws (Core Rule 3): a hostile argument is invalid input, not an exception.
    return "";
  }
}
