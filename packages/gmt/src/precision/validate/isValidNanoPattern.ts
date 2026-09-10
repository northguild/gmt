import {
  isValidEpochNanoseconds,
  MAX_EPOCH_NANOSECOND_DIGITS,
} from "../../internal";
import { nanosecondDecimal } from "../../regex/nanoseconds";

/**
 * Validate whether a string is a nanosecond timestamp `parseNanoseconds` will parse.
 *
 * `parseNanoseconds` returns `0n` for both `"0"` and garbage, so this is how the two are
 * told apart — the check its own JSDoc asks callers to make.
 *
 * - Shape **and** range: a canonical decimal integer (optional `-`, digits, no leading
 *   zeros) that also falls inside what `Temporal.Instant` can represent. Shape alone is
 *   `nanosecondDecimal` in `regex/`.
 * - Length is checked before `BigInt`, so an arbitrarily long payload string is rejected
 *   rather than converted.
 * - Takes the string *value*, not JSON text — `JSON.parse(payload).observedAt`, not the
 *   payload. A quoted `"\"123\""` is not a decimal integer.
 * - Returns `false` for non-strings.
 *
 * @param value candidate decimal string form of a nanosecond timestamp
 * @returns boolean indicating whether `parseNanoseconds` will parse it
 *
 * @example isValidNanoPattern("1710072000123456789") // true
 * @example isValidNanoPattern("0") // true — the epoch, where parseNanoseconds returns 0n
 * @example isValidNanoPattern("-1000000000") // true
 * @example isValidNanoPattern("8640000000000000000001") // false — outside the instant range
 * @example isValidNanoPattern("01") // false — leading zero
 * @example isValidNanoPattern("1e18") // false
 * @example isValidNanoPattern("garbage") // false
 */
export function isValidNanoPattern(value: string): boolean {
  if (typeof value !== "string" || !nanosecondDecimal.test(value)) {
    return false;
  }

  // Out of range by inspection once it is longer than MAX_EPOCH_NANOSECONDS, and stopping
  // here keeps BigInt off an arbitrarily long payload string.
  const digits = value.startsWith("-") ? value.length - 1 : value.length;

  if (digits > MAX_EPOCH_NANOSECOND_DIGITS) {
    return false;
  }

  return isValidEpochNanoseconds(BigInt(value));
}
