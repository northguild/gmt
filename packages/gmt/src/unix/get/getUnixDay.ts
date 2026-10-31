import { nowInstant } from "../../internal/temporalCompat";

/**
 * Return the current day from the Unix timestamp in UTC as a zero-padded string.
 *
 * - Uses nowInstant() converted to UTC zoned date time.
 * - Returns zero-padded string to 2 digits.
 *
 * @returns current day string (zero-padded to 2 digits)
 *
 * @example getUnixDay() // "29"
 */
export function getUnixDay(): string {
  return nowInstant().toZonedDateTimeISO("UTC").day.toString().padStart(2, "0");
}
