import { nowInstant } from "../../internal/temporalCompat";

/**
 * Return the current hour from UTC as a zero-padded string.
 *
 * - Uses nowInstant() converted to UTC zoned date time.
 * - Returns zero-padded string to 2 digits.
 *
 * @returns current hour string (zero-padded to 2 digits)
 *
 * @example getUtcHour() // "00"
 */
export function getUtcHour(): string {
  return nowInstant()
    .toZonedDateTimeISO("UTC")
    .hour.toString()
    .padStart(2, "0");
}
