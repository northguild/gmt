import { isoYearString } from "../../internal/isoYearString";
import { nowInstant } from "../../internal/temporalCompat";

/**
 * Return the current year from UTC as a zero-padded string.
 *
 * - Uses nowInstant() converted to UTC zoned date time.
 * - Returns zero-padded string to 4 digits.
 * - A year outside 0000–9999 is written with a sign and six digits (`+010000`, `-000005`), as
 *   Temporal writes it at the head of a date.
 *
 * @returns current year string (zero-padded to 4 digits)
 *
 * @example getUtcYear() // "2024"
 */
export function getUtcYear(): string {
  return isoYearString(nowInstant().toZonedDateTimeISO("UTC").year);
}
