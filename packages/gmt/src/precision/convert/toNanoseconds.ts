import { parseInstantNanoseconds } from "../../internal";

/**
 * Convert an ISO 8601 instant string to nanoseconds since the Unix epoch.
 *
 * - Requires an offset designator (`Z`, `±HH:MM`), as `Temporal.Instant` does — date-only
 *   and offset-less strings are rejected.
 * - Accepts a bracketed IANA time zone annotation and a `[u-ca=...]` calendar annotation. The
 *   calendar is ignored, as `Temporal.Instant.from` ignores it (an instant has no calendar).
 * - **The offset fixes the instant; a bracketed zone only resolves a rounded one.** An offset
 *   written to the minute that is the bracketed zone's sub-minute offset rounded
 *   (`-00:45[Africa/Monrovia]`, for −00:44:30) names the instant the zone gives, as
 *   `Temporal.ZonedDateTime.from` reads it, so a zoned string Temporal wrote is read back as
 *   the instant it was written for, except a wall time repeated inside a sub-minute offset
 *   change, which reads as its first pass (see `isValidInstant`). Otherwise the bracket is not
 *   checked: a zone that does not exist, or that disagrees with the offset, changes nothing.
 * - ISO 8601 extended format before any annotation: `<date>T<time>`, then
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
 *   for the offsets and bracketed zones this function accepts, so validating with it discards valid input.
 *
 * @param isoString ISO 8601 instant string (e.g. "2024-03-10T12:00:00.123456789Z")
 * @returns nanoseconds since the Unix epoch as a bigint, or 0n on invalid input
 *
 * @example toNanoseconds("1970-01-01T00:00:00Z") // 0n
 * @example toNanoseconds("2024-03-10T12:00:00.123456789Z") // 1710072000123456789n
 * @example toNanoseconds("1969-12-31T23:59:59Z") // -1000000000n
 * @example toNanoseconds("2024-03-10T12:00:00-05:00[America/New_York]") // 1710090000000000000n
 * @example toNanoseconds("2024-03-10T12:00:00+05:00[America/New_York]") // 1710054000000000000n — the offset decides, the zone is not checked
 * @example toNanoseconds("1960-01-01T00:20:00-00:45[Africa/Monrovia]") // -315615330000000000n — the zone's −00:44:30, which `-00:45` rounds
 * @example toNanoseconds("2024-03-10T12:00:00") // 0n — no offset designator
 * @example toNanoseconds("20240310T120000Z") // 0n — basic format
 * @example toNanoseconds("invalid") // 0n
 */
export function toNanoseconds(isoString: string): bigint {
  return parseInstantNanoseconds(isoString) ?? 0n;
}
