import { nowInstant } from "../../internal/temporalCompat";

/**
 * Return the current millisecond from the Unix timestamp in UTC as a zero-padded string.
 *
 * - Uses nowInstant() converted to UTC zoned date time.
 * - Returns zero-padded string to 3 digits.
 *
 * @returns current millisecond string (zero-padded to 3 digits)
 *
 * @example getUnixMillisecond() // "123"
 */
export function getUnixMillisecond(): string {
  return nowInstant()
    .toZonedDateTimeISO("UTC")
    .millisecond.toString()
    .padStart(3, "0");
}
