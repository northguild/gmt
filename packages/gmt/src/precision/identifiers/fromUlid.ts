import {
  NANOSECONDS_PER_MILLISECOND,
  crockfordValue,
  ulidText,
} from "../../internal";
import { fromNanoseconds } from "../convert/fromNanoseconds";

/**
 * Read the instant a ULID carries (ulid/spec README, § Components and § Canonical String
 * Representation).
 *
 * - The first 10 of the 26 characters are a 48-bit Unix millisecond count in Crockford base32,
 *   most significant first. The other 16 are randomness: validated, never read.
 * - Either case is read (the spec's "Case insensitive").
 * - The first character must be `0`-`7`: `7ZZZZZZZZZZZZZZZZZZZZZZZZZ` is the largest valid ULID
 *   and anything larger "should be rejected" (§ Overflow Errors when Parsing Base32 Strings).
 * - Strict alphabet: `I`, `L`, `O` and `U` are rejected, not read as `1`, `1` and `0` the way
 *   Crockford's own decoder folds them. GMT rule: the spec lists the alphabet and says nothing
 *   of folding, and a decoder that folds reads a mistyped ID as a different instant.
 * - Millisecond precision: the result never has more than three fraction digits.
 * - The time is the generator's clock; ULIDs from different machines order only as well as
 *   their clocks agree.
 * - Returns "" on invalid input.
 *
 * @param ulid 26-character ULID text
 * @returns ISO 8601 instant string in UTC, or "" on invalid input
 *
 * @example fromUlid("01ARZ3NDEKTSV4RRFFQ69G5FAV") // "2016-07-30T23:54:10.259Z" — the spec README example
 * @example fromUlid("01HK153X000000000000000000") // "2024-01-01T00:00:00Z"
 * @example fromUlid("01hk153x000000000000000000") // "2024-01-01T00:00:00Z" — lower case
 * @example fromUlid("01FWHE4YDG0000000000000000") // "2022-02-22T19:22:22Z" — same millisecond as RFC 9562 A.6
 * @example fromUlid("00000000000000000000000000") // "1970-01-01T00:00:00Z"
 * @example fromUlid("7ZZZZZZZZZZZZZZZZZZZZZZZZZ") // "+010889-08-02T05:31:50.655Z" — the largest valid ULID
 * @example fromUlid("80000000000000000000000000") // "" — overflow
 * @example fromUlid("01HK153X00000000000000000I") // "" — I is not in the alphabet
 * @example fromUlid("01HK153X00000000000000000") // "" — 25 characters
 * @example fromUlid(" 01HK153X000000000000000000") // "" — no trimming
 */
export function fromUlid(ulid: string): string {
  if (typeof ulid !== "string" || !ulidText.test(ulid)) {
    return "";
  }

  const milliseconds = crockfordValue(ulid.slice(0, 10));
  return fromNanoseconds(milliseconds * NANOSECONDS_PER_MILLISECOND);
}
