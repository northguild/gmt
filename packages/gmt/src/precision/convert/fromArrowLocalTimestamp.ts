import {
  arrowNanoseconds,
  instantStringFromEpochNanoseconds,
} from "../../internal";
import type { ArrowTimeUnit } from "./fromArrowTimestamp";

/**
 * Convert the `int64` of an Apache Arrow `Timestamp` column that has no timezone to a
 * wall-clock date-time string.
 *
 * - A column with no timezone holds wall-clock times, not instants: Arrow `Schema.fbs` says
 *   the count is read "as if" UTC and that an empty zone is not UTC. The result has no
 *   offset or zone, so it never becomes an instant by accident. For a column with a timezone
 *   use `fromArrowTimestamp`.
 * - `value` must be an `int64`; wall times use the same range as instants
 *   (`-271821-04-20T00:00:00` to `+275760-09-13T00:00:00`).
 * - Exact: nothing is rounded.
 * - Returns "" on invalid input.
 *
 * @param value the `int64` count since 1970-01-01T00:00:00 in the column's unit (bigint)
 * @param unit the column's `TimeUnit`
 * @returns ISO 8601 date-time string with no offset or zone, or "" on invalid input
 *
 * @example fromArrowLocalTimestamp(0n, "second") // "1970-01-01T00:00:00"
 * @example fromArrowLocalTimestamp(1704067200123n, "milliseconds") // "2024-01-01T00:00:00.123"
 * @example fromArrowLocalTimestamp(-1n, "nanosecond") // "1969-12-31T23:59:59.999999999"
 * @example fromArrowLocalTimestamp(9223372036854775807n, "nanosecond") // "2262-04-11T23:47:16.854775807"
 * @example fromArrowLocalTimestamp(8640000000001n, "second") // "" — past the supported range
 * @example fromArrowLocalTimestamp(0, "second") // "" — number, not bigint
 * @example fromArrowLocalTimestamp(0n, "s") // "" — not an Arrow unit
 */
export function fromArrowLocalTimestamp(
  value: bigint,
  unit: ArrowTimeUnit,
): string {
  // The instant string read as if UTC is the wall time: drop the final `Z`.
  return instantStringFromEpochNanoseconds(arrowNanoseconds(value, unit)).slice(
    0,
    -1,
  );
}
