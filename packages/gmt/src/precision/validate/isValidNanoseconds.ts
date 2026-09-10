import { isValidEpochNanoseconds } from "../../internal";

/**
 * Validate whether a value is an epoch-nanosecond `bigint` the `precision/` namespace accepts.
 *
 * Every `precision/` function gates on this range, so anything it accepts is renderable by
 * `fromNanoseconds`. Reach for it before `truncateNanoseconds`, whose `0n` return is both a
 * legitimate result and the invalid-input sentinel.
 *
 * - Requires a `bigint`. A `number` is rejected outright rather than coerced: nanoseconds
 *   since the epoch passed `Number.MAX_SAFE_INTEGER` in April 1970, so a `number` cannot
 *   carry one exactly and silently accepting it would defeat the namespace.
 * - The range is ±8_640_000_000_000_000_000_000n — what `Temporal.Instant` can represent.
 * - **A span is not an epoch nanosecond value.** `spanNs` reaches twice this range, because
 *   it measures a duration rather than naming an instant. Do not validate one with this.
 *
 * @param value candidate epoch-nanosecond value
 * @returns boolean indicating whether the value is an in-range epoch-nanosecond bigint
 *
 * @example isValidNanoseconds(0n) // true — the epoch
 * @example isValidNanoseconds(1710072000123456789n) // true
 * @example isValidNanoseconds(-1000000000n) // true
 * @example isValidNanoseconds(8640000000000000000001n) // false — outside the instant range
 * @example isValidNanoseconds(0) // false — number, not bigint
 * @example isValidNanoseconds("0") // false
 */
export function isValidNanoseconds(value: unknown): value is bigint {
  return isValidEpochNanoseconds(value);
}
