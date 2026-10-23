import {
  arrowNanoseconds,
  instantStringFromEpochNanoseconds,
} from "../../internal";

/**
 * The unit of an Apache Arrow `Timestamp` column: Temporal's unit names, singular or plural,
 * matching Arrow's `TimeUnit` (`SECOND`, `MILLISECOND`, `MICROSECOND`, `NANOSECOND`).
 */
export type ArrowTimeUnit =
  | "second"
  | "seconds"
  | "millisecond"
  | "milliseconds"
  | "microsecond"
  | "microseconds"
  | "nanosecond"
  | "nanoseconds";

/**
 * Convert the `int64` of an Apache Arrow `Timestamp` column that has a timezone to a UTC
 * instant string.
 *
 * - A column with a timezone holds UTC instants; the zone only says how to display them
 *   (Arrow `Schema.fbs`). The result is UTC (`Z`), not that zone. For local display call
 *   `fromNanoseconds(ns, timeZone)`. For a column with no timezone use `fromArrowLocalTimestamp`.
 * - `value` must be an `int64` and the instant must be inside Temporal's range
 *   (`-271821-04-20T00:00:00Z` to `+275760-09-13T00:00:00Z`).
 * - Exact: nothing is rounded.
 * - Returns "" on invalid input.
 *
 * @param value the `int64` count since 1970-01-01T00:00:00Z in the column's unit (bigint)
 * @param unit the column's `TimeUnit`
 * @returns ISO 8601 instant string in UTC (`Z`), or "" on invalid input
 *
 * @example fromArrowTimestamp(0n, "second") // "1970-01-01T00:00:00Z"
 * @example fromArrowTimestamp(1704067200000n, "milliseconds") // "2024-01-01T00:00:00Z"
 * @example fromArrowTimestamp(1704067200123456789n, "nanosecond") // "2024-01-01T00:00:00.123456789Z"
 * @example fromArrowTimestamp(-1n, "nanosecond") // "1969-12-31T23:59:59.999999999Z"
 * @example fromArrowTimestamp(9223372036854775807n, "nanosecond") // "2262-04-11T23:47:16.854775807Z"
 * @example fromArrowTimestamp(8640000000001n, "second") // "" — past the instant range
 * @example fromArrowTimestamp(0, "second") // "" — number, not bigint
 * @example fromArrowTimestamp(0n, "s") // "" — not an Arrow unit
 */
export function fromArrowTimestamp(value: bigint, unit: ArrowTimeUnit): string {
  return instantStringFromEpochNanoseconds(arrowNanoseconds(value, unit));
}
