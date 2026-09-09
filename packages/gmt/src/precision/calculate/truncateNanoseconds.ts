import { isValidEpochNanoseconds } from "../../internal";

/**
 * Storage precision a nanosecond value can be truncated to.
 *
 * @remarks Members:
 *
 * | Member | Description |
 * | --- | --- |
 * | `ms` | Milliseconds — the precision of `Date`, JSON APIs, and most message brokers. |
 * | `us` | Microseconds — the precision of PostgreSQL `timestamptz` and MySQL `DATETIME(6)`. |
 */
export type NanosecondTruncationUnit = "ms" | "us";

const NANOSECONDS_PER_UNIT: Record<NanosecondTruncationUnit, bigint> = {
  ms: 1_000_000n,
  us: 1_000n,
};

/**
 * Truncate nanoseconds since the Unix epoch to the precision a store can actually hold.
 *
 * - Floors toward negative infinity, so pre-1970 values truncate the same way post-1970 ones
 *   do: `truncateNanoseconds(-1500n, "us")` is `-2000n`, not `-1000n`. Rounding toward zero
 *   would make the result jump direction either side of the epoch.
 * - Call this before writing to a store that cannot hold nanoseconds — PostgreSQL
 *   `timestamptz` and MySQL `DATETIME(6)` hold microseconds, `Date`-based APIs hold
 *   milliseconds — so the value read back equals the value written.
 * - Idempotent: truncating an already-truncated value returns it unchanged.
 * - Returns `0n` on invalid input, including nanoseconds outside the range
 *   `Temporal.Instant` can represent. `0n` is also the epoch itself — validate first when
 *   the two must be told apart.
 *
 * @param nanoseconds nanoseconds since the Unix epoch (bigint)
 * @param unit target storage precision, "ms" (milliseconds) or "us" (microseconds)
 * @returns truncated nanoseconds as a bigint, or 0n on invalid input
 *
 * @example truncateNanoseconds(1710072000123456789n, "us") // 1710072000123456000n
 * @example truncateNanoseconds(1710072000123456789n, "ms") // 1710072000123000000n
 * @example truncateNanoseconds(-1500n, "us") // -2000n
 * @example truncateNanoseconds(0n, "ms") // 0n
 * @example truncateNanoseconds(1710072000123456789n, "ns") // 0n
 * @example truncateNanoseconds(1710072000123456789, "us") // 0n — number, not bigint
 */
export function truncateNanoseconds(
  nanoseconds: bigint,
  unit: NanosecondTruncationUnit,
): bigint {
  if (!isValidEpochNanoseconds(nanoseconds)) {
    return 0n;
  }

  if (unit !== "ms" && unit !== "us") {
    return 0n;
  }

  const divisor = NANOSECONDS_PER_UNIT[unit];
  const remainder = ((nanoseconds % divisor) + divisor) % divisor;

  return nanoseconds - remainder;
}
