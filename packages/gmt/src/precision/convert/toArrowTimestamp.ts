import { arrowCount, parseInstantNanoseconds } from "../../internal";
import type { ArrowTimeUnit } from "./fromArrowTimestamp";

/**
 * Convert an ISO 8601 instant string to the `int64` of an Apache Arrow `Timestamp` column that
 * has a timezone.
 *
 * - `isoString` must be an instant: `Z`, an offset, or a zoned string. A plain date-time returns
 *   `0n`: a wall time is never silently read as UTC. For a column with no timezone use
 *   `toArrowLocalTimestamp`.
 * - The column's zone is display information and does not change the count.
 * - Digits below the unit floor toward negative infinity, so `1969-12-31T23:59:59.9999999Z` in
 *   microseconds is `-1n`.
 * - **Nanoseconds can overflow.** An `int64` of nanoseconds covers only
 *   `1677-09-21T00:12:43.145224192Z` to `2262-04-11T23:47:16.854775807Z`; outside it the result
 *   is `0n`, which is also the epoch. For the `nanosecond` unit, check `isValidInt64NanosecondInstant`
 *   first. Seconds, milliseconds and microseconds cover the whole Temporal range, so
 *   `isValidInstant` is all they need.
 * - Returns `0n` on invalid input.
 *
 * @param isoString ISO 8601 instant string (with `Z`, an offset or a zone)
 * @param unit the column's `TimeUnit`
 * @returns the `int64` count since 1970-01-01T00:00:00Z in the column's unit, or `0n` on invalid input
 *
 * @example toArrowTimestamp("2024-01-01T00:00:00Z", "millisecond") // 1704067200000n
 * @example toArrowTimestamp("2024-01-01T09:00:00+09:00[Asia/Tokyo]", "second") // 1704067200n
 * @example toArrowTimestamp("2024-01-01T00:00:00.123456789Z", "microsecond") // 1704067200123456n — floors
 * @example toArrowTimestamp("1969-12-31T23:59:59.9999999Z", "microsecond") // -1n — toward negative infinity
 * @example toArrowTimestamp("2262-04-11T23:47:16.854775807Z", "nanosecond") // 9223372036854775807n
 * @example toArrowTimestamp("2262-04-11T23:47:16.854775808Z", "nanosecond") // 0n — past int64
 * @example toArrowTimestamp("2024-01-01T00:00:00", "millisecond") // 0n — a wall time, not an instant
 * @example toArrowTimestamp("2024-01-01T00:00:00Z", "ms") // 0n — not an Arrow unit
 */
export function toArrowTimestamp(
  isoString: string,
  unit: ArrowTimeUnit,
): bigint {
  return arrowCount(parseInstantNanoseconds(isoString), unit);
}
