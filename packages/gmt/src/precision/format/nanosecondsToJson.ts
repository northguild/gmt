import { isValidEpochNanoseconds } from "../../internal";

/**
 * Serialise nanoseconds since the Unix epoch to a decimal string for transport.
 *
 * - `JSON.stringify` throws a `TypeError` on a `bigint`, so a nanosecond timestamp cannot
 *   go into a JSON payload as-is. This is the bridge every consumer needs; do not hand-roll it.
 * - The output is a canonical decimal integer: an optional `-`, then digits, no leading zeros,
 *   no exponent, no separators. `nanosecondsFromJson` is its exact inverse.
 * - Rejects values outside the range `Temporal.Instant` can represent
 *   (±8_640_000_000_000_000_000_000n), so anything serialised here can be read back and rendered.
 * - Returns "" on invalid input.
 *
 * @param nanoseconds nanoseconds since the Unix epoch (bigint)
 * @returns decimal string form of the value, or "" on invalid input
 *
 * @example nanosecondsToJson(1710072000123456789n) // "1710072000123456789"
 * @example nanosecondsToJson(0n) // "0"
 * @example nanosecondsToJson(-1000000000n) // "-1000000000"
 * @example nanosecondsToJson(1710072000123456789) // "" — number, not bigint
 * @example nanosecondsToJson(8640000000000000000001n) // "" — outside the instant range
 */
export function nanosecondsToJson(nanoseconds: bigint): string {
  if (!isValidEpochNanoseconds(nanoseconds)) {
    return "";
  }

  return nanoseconds.toString();
}
