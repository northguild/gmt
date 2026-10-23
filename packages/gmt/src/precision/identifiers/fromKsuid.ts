import {
  KSUID_EPOCH_SECONDS,
  NANOSECONDS_PER_SECOND,
  BASE62_ALPHABET,
  digitsValue,
  instantStringFromEpochNanoseconds,
  ksuidText,
} from "../../internal";

/**
 * Read the instant a KSUID carries (segmentio/ksuid, `ksuid.go` and `base62.go`).
 *
 * - 27 base62 characters (`0-9A-Za-z`) encode 20 bytes: a 4-byte big-endian unsigned count
 *   of seconds, then 16 bytes of payload. The payload is validated, never read.
 * - The count starts at the KSUID epoch, 2014-05-13T16:53:20Z (Unix 1 400 000 000), not 1970.
 *   The all-zero KSUID is that instant, and no KSUID can name an earlier second.
 * - Case-sensitive, unlike UUID and ULID: `a` and `A` are different digits, so lower-casing or
 *   upper-casing a KSUID changes the instant it reads (or makes it invalid).
 * - 27 digits hold more than 20 bytes. Anything above `aWgEPTl1tmebfsQzFP4bxwgy80V` is
 *   rejected, as `Parse` rejects it.
 * - Second precision: the result never has a fraction.
 * - Returns "" on invalid input and never throws.
 *
 * @param ksuid 27-character KSUID text
 * @returns ISO 8601 instant string in UTC, or "" on invalid input
 *
 * @example fromKsuid("0ujtsYcgvSTl8PAuAdqWYSMnLOv") // "2017-10-10T04:00:47Z" — the README inspect example
 * @example fromKsuid("0ujzPyRiIAffKhBux4PvQdDqMHY") // "2017-10-10T04:46:20Z"
 * @example fromKsuid("000000000000000000000000000") // "2014-05-13T16:53:20Z" — the KSUID epoch, not 1970
 * @example fromKsuid("aWgEPTl1tmebfsQzFP4bxwgy80V") // "2150-06-19T23:21:35Z" — the largest valid KSUID
 * @example fromKsuid("0UJTSYCGVSTL8PAUADQWYSMNLOV") // "2016-03-09T02:31:53Z" — upper case is a different KSUID
 * @example fromKsuid("0ujtsycgvstl8pauadqwysmnlov") // "2017-10-10T04:00:51Z" — lower case is another one
 * @example fromKsuid("aWgEPTl1tmebfsQzFP4bxwgy80W") // "" — one above the maximum
 * @example fromKsuid("0ujtsYcgvSTl8PAuAdqWYSMnLO") // "" — 26 characters
 * @example fromKsuid("0ujtsYcgvSTl8PAuAdqWYSMnLO-") // "" — not base62
 */
export function fromKsuid(ksuid: string): string {
  if (typeof ksuid !== "string" || !ksuidText.test(ksuid)) {
    return "";
  }

  const value = digitsValue(ksuid, BASE62_ALPHABET);
  // Above 2^160 - 1 (`maxStringEncoded` in `ksuid.go`) is not a 20-byte value.
  if (BigInt.asUintN(160, value) !== value) {
    return "";
  }

  const seconds = (value >> 128n) + KSUID_EPOCH_SECONDS;
  return instantStringFromEpochNanoseconds(seconds * NANOSECONDS_PER_SECOND);
}
