import { instantOf } from "../../internal/instantNanoseconds";

/**
 * Validate whether a string is an ISO 8601 instant string the `precision/` namespace accepts.
 *
 * The predicate `toNanoseconds` was missing. `toNanoseconds` returns `0n` for both the epoch
 * and a rejected string, and the only public validator close enough to reach for —
 * `isValidUtc` — is *narrower* than this grammar: it gates on GMT's stricter
 * `<date>T<time>Z` shape and rejects the offsets `toNanoseconds` parses. Validating with it discards valid
 * input. This accepts exactly what `toNanoseconds` does, so the two never disagree.
 *
 * - Requires an offset designator (`Z`, `±HH:MM[:SS[.fraction]]`) and nothing after it: an
 *   annotation of any kind (a time zone, a calendar, an elective one) returns `false`. The offset
 *   alone fixes the instant, and an offset written with seconds is read exactly, so
 *   `-00:44:30` and `-00:45` are different instants.
 * - ISO 8601 extended format over the whole string: `<date>T<time>`, then
 *   `Z` or `±HH:MM[:SS[.fraction]]`. Basic format, a space or lower-case `t` separator, a
 *   lower-case `z` and an hour-only time or offset return `false`, although
 *   `Temporal.Instant.from` reads them.
 * - Rejects leap seconds in every separator and format variant.
 * - An empty string returns `false`.
 * - A value that is not a string, a `String` object included, returns `false`. A `true` result
 *   narrows an `unknown` value to `string`.
 *
 * @param value any value; a string is checked as an ISO 8601 instant string
 * @returns boolean indicating whether `toNanoseconds` will parse it
 *
 * @example isValidInstant("2024-03-10T12:00:00Z") // true
 * @example isValidInstant("1970-01-01T00:00:00Z") // true — the epoch, where toNanoseconds returns 0n
 * @example isValidInstant("2024-03-10T12:00:00+05:30") // true
 * @example isValidInstant("2024-03-10T12:00:00+05:30[Asia/Kolkata]") // false — no annotation of any kind
 * @example isValidInstant("2024-03-10T12:00:00Z[u-ca=hebrew]") // false
 * @example isValidInstant("2024-03-10T12:00:00-05:00") // true — isValidUtc says false
 * @example isValidInstant("2024-03-10 12:00:00Z") // false — space separator (extended format only)
 * @example isValidInstant("2024-03-10T12:00:00") // false — no offset designator
 * @example isValidInstant("2016-12-31T23:59:60Z") // false — leap second
 * @example isValidInstant("invalid") // false
 * @example isValidInstant(null) // false
 */
export function isValidInstant(value: string): boolean;
export function isValidInstant(value: {} | null | undefined | void): boolean;
export function isValidInstant(value: unknown): value is string;
export function isValidInstant(value: unknown): boolean {
  return instantOf(value) !== null;
}
