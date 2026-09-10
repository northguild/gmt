import { parseInstantNanoseconds } from "../../internal";

/**
 * Validate whether a string is an ISO 8601 instant string the `precision/` namespace accepts.
 *
 * The predicate `toNanoseconds` was missing. `toNanoseconds` returns `0n` for both the epoch
 * and a rejected string, and the only public validator close enough to reach for —
 * `isValidUtc` — is *narrower* than this grammar: it gates on GMT's stricter
 * `<date>T<time>Z` shape and rejects the offsets, bracketed zones, space separators and
 * basic-format strings `toNanoseconds` happily parses. Validating with it discards valid
 * input. This accepts exactly what `toNanoseconds` does, so the two never disagree.
 *
 * - Requires an offset designator (`Z`, `±HH:MM`); a bracketed IANA zone may follow, but a
 *   bracket alone is not enough.
 * - Rejects leap seconds in every separator and format variant, and `[u-ca=...]` calendar
 *   annotations — matching `utc/` and `unix/`.
 * - Returns `false` for non-strings and empty strings.
 *
 * @param value candidate ISO 8601 instant string
 * @returns boolean indicating whether `toNanoseconds` will parse it
 *
 * @example isValidInstant("2024-03-10T12:00:00Z") // true
 * @example isValidInstant("1970-01-01T00:00:00Z") // true — the epoch, where toNanoseconds returns 0n
 * @example isValidInstant("2024-03-10T12:00:00-05:00[America/New_York]") // true
 * @example isValidInstant("2024-03-10 12:00:00Z") // true — isValidUtc says false
 * @example isValidInstant("2024-03-10T12:00:00") // false — no offset designator
 * @example isValidInstant("2016-12-31T23:59:60Z") // false — leap second
 * @example isValidInstant("invalid") // false
 */
export function isValidInstant(value: string): boolean {
  return parseInstantNanoseconds(value) !== null;
}
