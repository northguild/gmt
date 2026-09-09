/**
 * Smallest epoch-nanosecond value `Temporal.Instant` can represent:
 * -10^8 days from the Unix epoch, i.e. `-271821-04-20T00:00:00Z`.
 */
export const MIN_EPOCH_NANOSECONDS = -8_640_000_000_000_000_000_000n;

/**
 * Largest epoch-nanosecond value `Temporal.Instant` can represent:
 * +10^8 days from the Unix epoch, i.e. `+275760-09-13T00:00:00Z`.
 */
export const MAX_EPOCH_NANOSECONDS = 8_640_000_000_000_000_000_000n;

/**
 * Digits in `MAX_EPOCH_NANOSECONDS` (22) — the longest a decimal form of an in-range
 * epoch-nanosecond value can be, sign excluded.
 */
export const MAX_EPOCH_NANOSECOND_DIGITS =
  MAX_EPOCH_NANOSECONDS.toString().length;

/**
 * Type guard for an epoch-nanosecond value the `precision/` namespace accepts: a `bigint`
 * inside the range `Temporal.Instant` can represent.
 *
 * Every `precision/` function gates on this, so anything one of them accepts is renderable
 * by `fromNanoseconds` — a value outside the range has no instant to convert back to.
 *
 * @example isValidEpochNanoseconds(0n) // true
 * @example isValidEpochNanoseconds(8_640_000_000_000_000_000_001n) // false
 * @example isValidEpochNanoseconds(0) // false — number, not bigint
 */
export function isValidEpochNanoseconds(value: unknown): value is bigint {
  return (
    typeof value === "bigint" &&
    value >= MIN_EPOCH_NANOSECONDS &&
    value <= MAX_EPOCH_NANOSECONDS
  );
}
