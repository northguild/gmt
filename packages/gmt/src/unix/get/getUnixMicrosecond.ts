import { nowInstant } from "../../internal/temporalCompat";

/**
 * Return the current microsecond from the Unix timestamp in UTC as a zero-padded string.
 *
 * - Uses nowInstant() converted to UTC zoned date time.
 * - Returns zero-padded string to 3 digits.
 *
 * @returns current microsecond string (zero-padded to 3 digits)
 *
 * @example getUnixMicrosecond() // "456"
 */
export function getUnixMicrosecond(): string {
  return (nowInstant().toZonedDateTimeISO("UTC").microsecond ?? 0)
    .toString()
    .padStart(3, "0");
}
