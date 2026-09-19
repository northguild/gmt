import { parseInstantNanoseconds } from "../../internal";

/**
 * Validate whether a string is an ISO 8601 instant string the `precision/` namespace accepts.
 *
 * The predicate `toNanoseconds` was missing. `toNanoseconds` returns `0n` for both the epoch
 * and a rejected string, and the only public validator close enough to reach for —
 * `isValidUtc` — is *narrower* than this grammar: it gates on GMT's stricter
 * `<date>T<time>Z` shape and rejects the offsets and bracketed zones `toNanoseconds` parses. Validating with it discards valid
 * input. This accepts exactly what `toNanoseconds` does, so the two never disagree.
 *
 * - Requires an offset designator (`Z`, `±HH:MM`); a bracketed IANA zone may follow, but a
 *   bracket alone is not enough.
 * - **A bracketed zone annotation is syntactic only.** As in `Temporal.Instant.from`, it is
 *   ignored: the offset alone fixes the instant, and a zone that does not exist or disagrees
 *   with the offset is not checked.
 * - ISO 8601 extended format before any annotation: `<date>T<time>`, then
 *   `Z` or `±HH:MM[:SS[.fraction]]`. Basic format, a space or lower-case `t` separator, a
 *   lower-case `z` and an hour-only time or offset return `false`, although
 *   `Temporal.Instant.from` reads them.
 * - Rejects leap seconds in every separator and format variant.
 * - Reads RFC 9557 annotations as `Temporal.Instant.from` does: a calendar or elective annotation
 *   is ignored, and an unknown critical one (`[!foo=bar]`) is rejected.
 * - Returns `false` for non-strings and empty strings.
 *
 * @param value candidate ISO 8601 instant string
 * @returns boolean indicating whether `toNanoseconds` will parse it
 *
 * @example isValidInstant("2024-03-10T12:00:00Z") // true
 * @example isValidInstant("1970-01-01T00:00:00Z") // true — the epoch, where toNanoseconds returns 0n
 * @example isValidInstant("2024-03-10T12:00:00-05:00[America/New_York]") // true
 * @example isValidInstant("2024-03-10T12:00:00Z[Not/AZone]") // true — the zone annotation is not checked
 * @example isValidInstant("2024-03-10T12:00:00-05:00") // true — isValidUtc says false
 * @example isValidInstant("2024-03-10 12:00:00Z") // false — space separator (extended format only)
 * @example isValidInstant("2024-03-10T12:00:00") // false — no offset designator
 * @example isValidInstant("2016-12-31T23:59:60Z") // false — leap second
 * @example isValidInstant("invalid") // false
 */
export function isValidInstant(value: string): boolean {
  return parseInstantNanoseconds(value) !== null;
}
