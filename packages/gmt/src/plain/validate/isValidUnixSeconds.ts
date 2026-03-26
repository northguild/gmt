import { unixSeconds } from "../../regex/unix";

/**
 * Return true when `timestamp` is a valid Unix seconds string.
 * - A valid Unix seconds string consists of 10 digits and represents a valid Unix timestamp in seconds.
 *
 * @param timestamp string candidate
 * @example isValidUnixSeconds("1700000000") => true
 * @example isValidUnixSeconds("17000000000") => false (too many digits)
 * @example isValidUnixSeconds("not-a-number") => false (not a number)
 * @returns boolean indicating whether the timestamp is a valid Unix seconds string
 */
export function isValidUnixSeconds(timestamp: string): boolean {
  return unixSeconds.test(timestamp);
}
