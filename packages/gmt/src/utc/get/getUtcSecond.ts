import { nowInstant } from "../../internal/temporalCompat";

/**
 * Return the current second from UTC as a zero-padded string.
 *
 * - Uses nowInstant() converted to UTC zoned date time.
 * - Returns zero-padded string to 2 digits.
 *
 * @returns current second string (zero-padded to 2 digits)
 *
 * @example getUtcSecond() // "45"
 */
export function getUtcSecond(): string {
  return nowInstant()
    .toZonedDateTimeISO("UTC")
    .second.toString()
    .padStart(2, "0");
}
