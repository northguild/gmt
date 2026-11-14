import { parseInstantNanoseconds } from "../../internal";

/**
 * Convert an ISO 8601 instant string to nanoseconds since the Unix epoch.
 *
 * - Requires an offset designator (`Z`, `±HH:MM`), as `Temporal.Instant` does — date-only
 *   and offset-less strings are rejected.
 * - Accepts no annotation: a time zone, a `[u-ca=...]` calendar or any other bracket returns
 *   `0n`. The offset alone fixes the instant, and one written with seconds is read exactly
 *   (`-00:44:30` and `-00:45` are different instants).
 * - ISO 8601 extended format over the whole string: `<date>T<time>`, then
 *   `Z` or `±HH:MM[:SS[.fraction]]`. Basic format, a space or lower-case `t` separator, a
 *   lower-case `z` and an hour-only time or offset return `0n`, although
 *   `Temporal.Instant.from` reads them. The offsets make this wider than `isValidUtc`, which
 *   requires `Z`.
 * - Rejects leap seconds (`"2016-12-31T23:59:60Z"`), which Temporal would silently clamp —
 *   in every separator and format variant it accepts, `"20161231 235960Z"` included.
 * - Returns `bigint`, not `number`: nanoseconds since the epoch passed
 *   `Number.MAX_SAFE_INTEGER` in April 1970, so a `number` cannot hold them.
 * - Returns `0n` on invalid input. `0n` is also the epoch itself — use `isValidInstant`,
 *   which accepts exactly this grammar, when the two must be told apart. **Not
 *   `isValidUtc`**: it gates on GMT's stricter `<date>T<time>Z` shape and returns `false`
 *   for the offsets this function accepts, so validating with it discards valid input.
 *
 * @param isoString ISO 8601 instant string (e.g. "2024-03-10T12:00:00.123456789Z")
 * @returns nanoseconds since the Unix epoch as a bigint, or 0n on invalid input
 *
 * @example toNanoseconds("1970-01-01T00:00:00Z") // 0n
 * @example toNanoseconds("2024-03-10T12:00:00.123456789Z") // 1710072000123456789n
 * @example toNanoseconds("1969-12-31T23:59:59Z") // -1000000000n
 * @example toNanoseconds("2024-03-10T12:00:00+05:30") // 1710052200000000000n
 * @example toNanoseconds("2024-03-10T12:00:00+05:30[Asia/Kolkata]") // 0n — no annotation of any kind
 * @example toNanoseconds("1960-01-01T00:20:00-00:44:30") // -315615330000000000n — an offset with seconds is read exactly
 * @example toNanoseconds("2024-03-10T12:00:00") // 0n — no offset designator
 * @example toNanoseconds("20240310T120000Z") // 0n — basic format
 * @example toNanoseconds("invalid") // 0n
 */
export function toNanoseconds(isoString: string): bigint {
  return parseInstantNanoseconds(isoString) ?? 0n;
}
