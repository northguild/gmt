import { isValidEpochNanoseconds } from "../../internal";

/**
 * Format nanoseconds since the Unix epoch as a decimal string, for JSON and other
 * text transports.
 *
 * - `JSON.stringify` throws a `TypeError` on a `bigint`, so a nanosecond timestamp cannot
 *   go into a JSON payload as-is. This is the bridge every consumer needs; do not hand-roll it.
 * - The output is a canonical decimal integer: an optional `-`, then digits, no leading zeros,
 *   no exponent, no separators. `parseNanoseconds` is its exact inverse.
 * - **Put the result in JSON as a string, not a number.** It is itself only the value —
 *   `{ observedAt: formatNanoseconds(n) }` serialises to `{"observedAt":"1710072000123456789"}`.
 *   Emitted unquoted it is a JSON number, and `JSON.parse` rounds it back through a double
 *   to `1710072000123456800` — the exact loss this namespace exists to prevent.
 * - Rejects values outside the range `Temporal.Instant` can represent
 *   (±8_640_000_000_000_000_000_000n), so anything formatted here can be read back and rendered.
 * - Returns "" on invalid input.
 *
 * @param nanoseconds nanoseconds since the Unix epoch (bigint)
 * @returns decimal string form of the value, or "" on invalid input
 *
 * @example formatNanoseconds(1710072000123456789n) // "1710072000123456789"
 * @example formatNanoseconds(0n) // "0"
 * @example formatNanoseconds(-1000000000n) // "-1000000000"
 * @example formatNanoseconds(1710072000123456789) // "" — number, not bigint
 * @example formatNanoseconds(8640000000000000000001n) // "" — outside the instant range
 */
export function formatNanoseconds(nanoseconds: bigint): string {
  if (!isValidEpochNanoseconds(nanoseconds)) {
    return "";
  }

  return nanoseconds.toString();
}
