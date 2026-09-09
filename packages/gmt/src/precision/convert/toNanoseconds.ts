import { Temporal } from "@js-temporal/polyfill";
import { hasCalendarAnnotation } from "../../internal";

/**
 * A leap second in every shape `Temporal.Instant.from` accepts: `T`, `t` or a space before
 * the time, and extended (`23:59:60`) or basic (`235960`) digits.
 *
 * `plain/validate`'s shared `isLeapSecond` matches only an uppercase `T` with extended-format
 * digits — all that `utc/`'s stricter `<date>T<time>Z` regex gate can ever hand it. This
 * namespace parses the full instant grammar, so it needs the wider pattern; without it
 * `"2016-12-31 23:59:60Z"` would slip through and Temporal would silently clamp it to `:59`.
 */
const instantLeapSecond = /[Tt ]\d{2}:?\d{2}:?60(?:[.,]\d+)?(?:[-+Zz[])/;

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
 *   first (e.g. `isValidUtc`) when the two must be told apart.
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
  if (typeof isoString !== "string") {
    return 0n;
  }

  if (instantLeapSecond.test(isoString) || hasCalendarAnnotation(isoString)) {
    return 0n;
  }

  try {
    return Temporal.Instant.from(isoString).epochNanoseconds;
  } catch {
    return 0n;
  }
}
