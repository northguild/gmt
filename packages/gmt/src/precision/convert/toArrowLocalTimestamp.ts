import { arrowCount, wallClockNanoseconds } from "../../internal";
import type { ArrowTimeUnit } from "./fromArrowTimestamp";

/**
 * Convert an ISO 8601 plain date-time to the `int64` of an Apache Arrow `Timestamp` column that
 * has no timezone.
 *
 * - `dateTime` must be a plain date-time with no offset or `Z`: Arrow reads a zoneless count
 *   "as if" UTC (`Schema.fbs`), and an instant is never silently taken for a wall time. It
 *   returns `0n` for one. For a column with a timezone use `toArrowTimestamp`.
 * - A zone annotation (`[Asia/Tokyo]`) is ignored, as `Temporal.PlainDateTime.from` ignores
 *   it; the wall time is read as written.
 * - Digits below the unit floor toward negative infinity.
 * - In seconds, milliseconds and microseconds, every wall time `isValidDateTime` accepts has a
 *   count: `-271821-04-19T00:00:00.000000001` to `+275760-09-13T23:59:59.999999999`, a day past
 *   each end of the instant range. A wall time before the first whole unit of that range floors
 *   to the count of `-271821-04-19T00:00:00`, which `fromArrowLocalTimestamp` cannot read back.
 * - **Nanoseconds can overflow.** An `int64` of nanoseconds covers only
 *   `1677-09-21T00:12:43.145224192` to `2262-04-11T23:47:16.854775807`; outside it the result
 *   is `0n`, which is also the epoch. For the `nanosecond` unit, check
 *   `isValidInt64NanosecondDateTime` first.
 * - Returns `0n` on invalid input.
 *
 * @param dateTime ISO 8601 plain date-time
 * @param unit the column's `TimeUnit`
 * @returns the `int64` count since 1970-01-01T00:00:00 in the column's unit, or `0n` on invalid input
 *
 * @example toArrowLocalTimestamp("2024-01-01T00:00:00", "millisecond") // 1704067200000n
 * @example toArrowLocalTimestamp("2024-01-01T00:00:00[Asia/Tokyo]", "second") // 1704067200n — annotation ignored
 * @example toArrowLocalTimestamp("1969-12-31T23:59:59.999999999", "second") // -1n — toward negative infinity
 * @example toArrowLocalTimestamp("2262-04-11T23:47:16.854775807", "nanosecond") // 9223372036854775807n
 * @example toArrowLocalTimestamp("2262-04-11T23:47:16.854775808", "nanosecond") // 0n — past int64
 * @example toArrowLocalTimestamp("+275760-09-13T23:59:59", "second") // 8640000086399n — the last whole second
 * @example toArrowLocalTimestamp("+275760-09-14T00:00:00", "second") // 0n — not a valid date-time
 * @example toArrowLocalTimestamp("2024-01-01T00:00:00Z", "millisecond") // 0n — an instant, not a wall time
 * @example toArrowLocalTimestamp("2024-01-01T00:00:00", "ms") // 0n — not an Arrow unit
 */
export function toArrowLocalTimestamp(
  dateTime: string,
  unit: ArrowTimeUnit,
): bigint {
  return arrowCount(wallClockNanoseconds(dateTime), unit);
}
