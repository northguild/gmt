import { crockfordDigits, prefixMilliseconds } from "../../internal";

/**
 * The first 10 characters of every ULID minted in the same millisecond as an instant, for range
 * scans over stored ULID text (ulid/spec README, § Components and § Encoding).
 *
 * - The result is the 48-bit Unix millisecond count as 10 upper-case Crockford base32
 *   characters (Crockford: "When encoding, only upper case letters are used",
 *   crockford.com/base32.html). Lower-case the result to scan lower-case ULIDs.
 * - Select every ULID minted in `[start, end)` with
 *   `ulid >= ulidTimestampPrefix(start) && ulid < ulidTimestampPrefix(end)`: Crockford's
 *   alphabet is in ASCII order (`0`-`9` before `A`-`Z`), so text order is time order.
 * - Sub-millisecond digits floor: the prefix names the millisecond the instant falls in.
 * - Accepts any instant string GMT accepts, a zoned one included.
 * - Not a generator: the result is 10 characters, not a ULID.
 * - The instant that floors to exactly 2^48 ms (`+010889-08-02T05:31:50.656Z`) gives
 *   `"8000000000"`, the exclusive end bound that no ULID carries (the largest ULID prefix is
 *   `7ZZZZZZZZZ`), so a range can end at the last millisecond of the 48-bit field.
 * - Returns "" on invalid input, an instant before 1970-01-01, or one past 2^48 ms: the
 *   spec's overflow rule applies to encoding too.
 *
 * @param isoString ISO 8601 instant string (with `Z`, an offset or a zone)
 * @returns 10-character upper-case Crockford prefix, or "" on invalid input
 *
 * @example ulidTimestampPrefix("2024-01-01T00:00:00Z") // "01HK153X00"
 * @example ulidTimestampPrefix("2016-07-30T23:54:10.259Z") // "01ARZ3NDEK" — the spec README example
 * @example ulidTimestampPrefix("2022-02-22T19:22:22Z") // "01FWHE4YDG"
 * @example ulidTimestampPrefix("1970-01-01T00:00:00Z") // "0000000000"
 * @example ulidTimestampPrefix("2024-01-01T00:00:00.0009Z") // "01HK153X00" — floors to the millisecond
 * @example ulidTimestampPrefix("2024-01-01T09:00:00+09:00[Asia/Tokyo]") // "01HK153X00"
 * @example ulidTimestampPrefix("+010889-08-02T05:31:50.655Z") // "7ZZZZZZZZZ" — the largest
 * @example ulidTimestampPrefix("+010889-08-02T05:31:50.656Z") // "8000000000" — 2^48 ms, the exclusive end no ULID carries
 * @example ulidTimestampPrefix("+010889-08-02T05:31:50.657Z") // "" — past the exclusive end
 * @example ulidTimestampPrefix("1969-12-31T23:59:59.999Z") // "" — before the Unix epoch
 * @example ulidTimestampPrefix("2024-01-01T00:00:00") // "" — no offset
 * @example ulidTimestampPrefix("invalid") // ""
 */
export function ulidTimestampPrefix(isoString: string): string {
  const milliseconds = prefixMilliseconds(isoString);

  return milliseconds === null ? "" : crockfordDigits(milliseconds, 10);
}
