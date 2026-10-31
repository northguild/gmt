import { nowInstant } from "../../internal/temporalCompat";

/**
 * Return the current minute from the Unix timestamp in UTC as a zero-padded string.
 *
 * - Uses nowInstant() converted to UTC zoned date time.
 * - Returns zero-padded string to 2 digits.
 *
 * @returns current minute string (zero-padded to 2 digits)
 *
 * @example getUnixMinute() // "30"
 */
export function getUnixMinute(): string {
  return nowInstant()
    .toZonedDateTimeISO("UTC")
    .minute.toString()
    .padStart(2, "0");
}
