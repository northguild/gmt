import { readGtfsTime } from "../../internal/gtfsTime";

/**
 * Checks a GTFS Schedule `Time` value, including one past `24:00:00`.
 *
 * - True for `H:MM:SS`, `HH:MM:SS` and `HHH:MM:SS` with hours 0–999 and minutes and seconds
 *   `00`–`59`.
 * - `25:35:00` is valid: 1:35 on the following day, still on the same service day.
 * - Nothing is trimmed, so a space or newline makes it false; an empty field is false.
 * - True exactly when `parseGtfsTime` returns a value: both read the value with one internal core.
 *
 * Source: GTFS Schedule Reference § Field Types, Time.
 *
 * @param value A GTFS `Time` field, such as `frequencies.txt` `start_time`.
 * @returns `true` when `value` is a GTFS time, or `false` on invalid input
 *
 * @example isValidGtfsTime("25:35:00") // true
 * @example isValidGtfsTime("8:05:00") // true
 * @example isValidGtfsTime("110:29:00") // true
 * @example isValidGtfsTime("25:60:00") // false
 * @example isValidGtfsTime("1000:00:00") // false
 */
export function isValidGtfsTime(value: string): boolean {
  return readGtfsTime(value) !== null;
}
