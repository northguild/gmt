import { readGtfsTime } from "../../internal/gtfsTime";
import type { GtfsTime } from "../../types";

/**
 * Reads a GTFS Schedule `Time` value, keeping the days past the service day apart from the time
 * of day.
 *
 * - Reads `HH:MM:SS`, `H:MM:SS` and `HHH:MM:SS`, hours up to 999; minutes and seconds `00` to `59`.
 * - `25:35:00` is 1:35 on the following day, still on the service day: `dayOverflow` counts the
 *   whole 24-hour blocks and `seconds` is what is left: the written time less those blocks.
 * - Nothing is trimmed: a space, tab, newline or byte order mark returns `null`.
 * - Reads the `Time` type only, not GTFS `Local time` (`timeframes.txt`).
 * - Resolves no local time and needs no zone; that is the job of the service date and the
 *   agency's zone.
 *
 * Source: GTFS Schedule Reference § Field Types, Time.
 *
 * @param value A GTFS `Time` field, such as `stop_times.txt` `arrival_time`.
 * @returns The written time less whole 24-hour blocks (`seconds`) and those blocks
 *   (`dayOverflow`), or `null` on invalid input (an empty field included)
 *
 * @example parseGtfsTime("25:35:00") // { seconds: 5700, dayOverflow: 1 }
 * @example parseGtfsTime("8:05:00") // { seconds: 29100, dayOverflow: 0 }
 * @example parseGtfsTime("24:00:00") // { seconds: 0, dayOverflow: 1 }
 * @example parseGtfsTime("25:60:00") // null
 * @example parseGtfsTime(" 25:35:00") // null
 */
export function parseGtfsTime(value: string): GtfsTime | null {
  return readGtfsTime(value);
}
