import { parseInstantNanoseconds } from "../../internal";

/**
 * Convert an ISO 8601 instant string to nanoseconds since the Unix epoch.
 *
 * - Requires an offset designator (`Z`, `±HH:MM`), as `Temporal.Instant` does — date-only
 *   and offset-less strings are rejected.
 * - Accepts a bracketed IANA time zone annotation; rejects a `[u-ca=...]` calendar
 *   annotation, like `utc/` and `unix/` do.
 * - The string is validated by `Temporal.Instant.from`, so the full RFC 9557 instant
 *   grammar is accepted — including a space in place of the `T` separator. This is wider
 *   than `isValidUtc`, which gates on GMT's stricter `<date>T<time>Z` regex.
 * - Rejects leap seconds (`"2016-12-31T23:59:60Z"`), which Temporal would silently clamp —
 *   in every separator and format variant it accepts, `"20161231 235960Z"` included.
 * - Returns `bigint`, not `number`: nanoseconds since the epoch passed
 *   `Number.MAX_SAFE_INTEGER` in April 1970, so a `number` cannot hold them.
 * - Returns `0n` on invalid input. `0n` is also the epoch itself — validate the string
 *   first (e.g. `isValidUtc`) when the two must be told apart. `spanNs` measures between
 *   two of these strings without that ambiguity, since it returns `null` instead.
 *
 * @param isoString ISO 8601 instant string (e.g. "2024-03-10T12:00:00.123456789Z")
 * @returns nanoseconds since the Unix epoch as a bigint, or 0n on invalid input
 *
 * @example toNanoseconds("1970-01-01T00:00:00Z") // 0n
 * @example toNanoseconds("2024-03-10T12:00:00.123456789Z") // 1710072000123456789n
 * @example toNanoseconds("1969-12-31T23:59:59Z") // -1000000000n
 * @example toNanoseconds("2024-03-10T12:00:00-05:00[America/New_York]") // 1710090000000000000n
 * @example toNanoseconds("2024-03-10T12:00:00") // 0n — no offset designator
 * @example toNanoseconds("invalid") // 0n
 */
export function toNanoseconds(isoString: string): bigint {
  return parseInstantNanoseconds(isoString) ?? 0n;
}
