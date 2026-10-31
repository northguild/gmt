import { nowInstant } from "../../internal/temporalCompat";

/**
 * Return the current month from UTC as a zero-padded string.
 *
 * - Uses nowInstant() converted to UTC zoned date time.
 * - Returns zero-padded string to 2 digits.
 *
 * @returns current month string (zero-padded to 2 digits)
 *
 * @example getUtcMonth() // "02"
 */
export function getUtcMonth(): string {
  return nowInstant()
    .toZonedDateTimeISO("UTC")
    .month.toString()
    .padStart(2, "0");
}
