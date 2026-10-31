import { nowInstant } from "../../internal/temporalCompat";

/**
 * Return the current hour from the Unix timestamp in UTC as a zero-padded string.
 *
 * - Uses nowInstant() converted to UTC zoned date time.
 * - Returns zero-padded string to 2 digits.
 *
 * @returns current hour string (zero-padded to 2 digits)
 *
 * @example getUnixHour() // "00"
 */
export function getUnixHour(): string {
  return nowInstant()
    .toZonedDateTimeISO("UTC")
    .hour.toString()
    .padStart(2, "0");
}
