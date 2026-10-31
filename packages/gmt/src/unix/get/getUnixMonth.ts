import { nowInstant } from "../../internal/temporalCompat";

/**
 * Return the current month from the Unix timestamp in UTC as a zero-padded string.
 *
 * - Uses nowInstant() converted to UTC zoned date time.
 * - Returns zero-padded string to 2 digits.
 *
 * @returns current month string (zero-padded to 2 digits)
 *
 * @example getUnixMonth() // "02"
 */
export function getUnixMonth(): string {
  return nowInstant()
    .toZonedDateTimeISO("UTC")
    .month.toString()
    .padStart(2, "0");
}
