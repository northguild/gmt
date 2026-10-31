import { nowInstant } from "../../internal/temporalCompat";

/**
 * Return the current millisecond from UTC as a zero-padded string.
 *
 * - Uses nowInstant() converted to UTC zoned date time.
 * - Returns zero-padded string to 3 digits.
 *
 * @returns current millisecond string (zero-padded to 3 digits)
 *
 * @example getUtcMillisecond() // "123"
 */
export function getUtcMillisecond(): string {
  return nowInstant()
    .toZonedDateTimeISO("UTC")
    .millisecond.toString()
    .padStart(3, "0");
}
