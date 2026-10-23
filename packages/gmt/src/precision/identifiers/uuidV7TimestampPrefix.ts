import { UNIX_MS_48_END, prefixMilliseconds } from "../../internal";
/**
 * The first 13 characters of every version 7 UUID minted in the same millisecond as an
 * instant, for range scans over stored UUID text (RFC 9562 §5.7, §6.11).
 *
 * - The result is the 48-bit Unix millisecond count as 12 lower-case hex digits, with the
 *   hyphen after the eighth digit, so it is a true prefix of the hyphenated UUID.
 * - Select every v7 UUID minted in `[start, end)` with
 *   `uuid >= uuidV7TimestampPrefix(start) && uuid < uuidV7TimestampPrefix(end)` when the stored
 *   text is lower case. For a binary UUID column compared byte by byte (PostgreSQL `uuid`, for one),
 *   append `-0000-0000-000000000000` to make a full UUID bound.
 * - Sub-millisecond digits floor: the prefix names the millisecond the instant falls in.
 * - Accepts any instant string GMT accepts, a zoned one included.
 * - Not a generator: the result is not a UUID.
 * - Returns "" on invalid input, an instant before 1970-01-01, or one past 2^48 − 1 ms
 *   (`+010889-08-02T05:31:50.655Z`). 12 hex digits cannot hold 2^48, so a range that ends at
 *   or past 2^48 ms has no exclusive end bound here: leave the upper bound off, or use the Max
 *   UUID `ffffffff-ffff-ffff-ffff-ffffffffffff` as an inclusive upper bound (`uuid <= max`).
 *   Every v7 UUID sorts below or equal to it, as text and as bytes.
 *
 * @param isoString ISO 8601 instant string (with `Z`, an offset or a zone)
 * @returns 13-character lower-case hyphenated prefix, or "" on invalid input
 *
 * @example uuidV7TimestampPrefix("2024-01-01T00:00:00Z") // "018cc251-f400"
 * @example uuidV7TimestampPrefix("2022-02-22T19:22:22Z") // "017f22e2-79b0" — the prefix of RFC 9562 A.6
 * @example uuidV7TimestampPrefix("1970-01-01T00:00:00Z") // "00000000-0000"
 * @example uuidV7TimestampPrefix("2024-01-01T00:00:00.0009Z") // "018cc251-f400" — floors to the millisecond
 * @example uuidV7TimestampPrefix("2024-01-01T09:00:00+09:00[Asia/Tokyo]") // "018cc251-f400"
 * @example uuidV7TimestampPrefix("+010889-08-02T05:31:50.655Z") // "ffffffff-ffff" — the largest
 * @example uuidV7TimestampPrefix("+010889-08-02T05:31:50.656Z") // "" — past 48 bits
 * @example uuidV7TimestampPrefix("1969-12-31T23:59:59.999Z") // "" — before the Unix epoch
 * @example uuidV7TimestampPrefix("2024-01-01T00:00:00") // "" — no offset
 * @example uuidV7TimestampPrefix("invalid") // ""
 */
export function uuidV7TimestampPrefix(isoString: string): string {
  const milliseconds = prefixMilliseconds(isoString);
  if (milliseconds === null || milliseconds === UNIX_MS_48_END) {
    return "";
  }

  const hex = milliseconds.toString(16).padStart(12, "0");
  return hex.slice(0, 8) + "-" + hex.slice(8);
}
