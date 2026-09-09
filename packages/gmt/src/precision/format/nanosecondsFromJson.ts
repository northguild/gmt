import {
  isValidEpochNanoseconds,
  MAX_EPOCH_NANOSECOND_DIGITS,
} from "../../internal";

/** Canonical decimal integer: optional `-`, then digits with no leading zeros. */
const decimalInteger = /^-?(?:0|[1-9][0-9]*)$/;

/**
 * Parse a decimal string produced by `nanosecondsToJson` back to nanoseconds since the
 * Unix epoch.
 *
 * - Accepts only a canonical decimal integer — an optional `-` then digits with no leading
 *   zeros. Exponents, fractions, hex, separators, a `+` sign and surrounding whitespace are
 *   rejected rather than coerced, so a payload written by another language's serialiser
 *   either reads back exactly or fails loudly.
 * - Rejects values outside the range `Temporal.Instant` can represent
 *   (±8_640_000_000_000_000_000_000n).
 * - Returns `0n` on invalid input. `0n` is also the epoch itself — check the string against
 *   the format above first when the two must be told apart.
 *
 * @param value decimal string form of a nanosecond timestamp (e.g. "1710072000123456789")
 * @returns nanoseconds since the Unix epoch as a bigint, or 0n on invalid input
 *
 * @example nanosecondsFromJson("1710072000123456789") // 1710072000123456789n
 * @example nanosecondsFromJson("-1000000000") // -1000000000n
 * @example nanosecondsFromJson("1.5") // 0n
 * @example nanosecondsFromJson("1e18") // 0n
 * @example nanosecondsFromJson("8640000000000000000001") // 0n — outside the instant range
 * @example nanosecondsFromJson(1710072000123456789) // 0n — number, not string
 */
export function nanosecondsFromJson(value: string): bigint {
  if (typeof value !== "string" || !decimalInteger.test(value)) {
    return 0n;
  }

  // Out of range by inspection once it is longer than MAX_EPOCH_NANOSECONDS, and stopping
  // here keeps BigInt off an arbitrarily long payload string.
  const digits = value.startsWith("-") ? value.length - 1 : value.length;

  if (digits > MAX_EPOCH_NANOSECOND_DIGITS) {
    return 0n;
  }

  const nanoseconds = BigInt(value);

  return isValidEpochNanoseconds(nanoseconds) ? nanoseconds : 0n;
}
