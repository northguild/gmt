/**
 * The fixed text grammars of time-ordered identifiers, and the digit decoders beside them
 * (CORE-56; see "Scoped exception: identifier grammars" in `context/coding-standards.md`).
 *
 * UUIDs, ObjectIds, ULIDs, KSUIDs and Snowflakes carry a timestamp as digits in a fixed
 * alphabet. No `Temporal.*.from` reads any of them, so each grammar is one regex here and a
 * public function matches the whole input against it before decoding. All are fixed, never
 * caller-supplied. Every loop is bounded by the grammar length (at most 27): O(1).
 *
 * Not in `regex/`: that namespace holds date-time grammars, and these validate identifiers.
 */

/** RFC 9562 §4 ABNF: 8-4-4-4-12 hex digits, hyphens required, no braces, no `urn:uuid:`. */
export const uuidText =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** MongoDB ObjectId: 12 bytes in hex string form, 24 digits. */
export const objectIdText = /^[0-9a-f]{24}$/i;

/**
 * ULID spec § Encoding: 26 Crockford base32 characters. The first is 0-7 so the 130 bits fit
 * 128 (§ Overflow). With the `i` flag the class still excludes `i l o u`, because it excludes
 * `I L O U`.
 */
export const ulidText = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/i;

/** KSUID `base62.go`: 27 base62 characters. Case-sensitive, so no `i` flag. */
export const ksuidText = /^[0-9A-Za-z]{27}$/;

/** Discord: snowflakes are sent as decimal strings; up to 20 digits covers 2^64 − 1. */
export const unsignedDecimalText = /^\d{1,20}$/;

/** Crockford base32 alphabet (ULID spec § Encoding): no `I L O U`. */
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** KSUID `base62.go` alphabet: `0-9A-Za-z`, spelled out in full. */
const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** Read hex digits as an integer. The caller has matched a grammar first. */
export function hexValue(digits: string): bigint {
  return BigInt("0x" + digits);
}

/** Read Crockford base32 digits (either case) as an integer, most significant first. */
export function crockfordValue(digits: string): bigint {
  let value = 0n;
  for (const character of digits.toUpperCase()) {
    value = value * 32n + BigInt(CROCKFORD.indexOf(character));
  }
  return value;
}

/** Write an integer as `length` upper-case Crockford base32 digits, most significant first. */
export function crockfordDigits(value: bigint, length: number): string {
  let digits = "";
  let rest = value;
  for (let index = 0; index < length; index++) {
    digits = CROCKFORD.charAt(Number(rest % 32n)) + digits;
    rest /= 32n;
  }
  return digits;
}

/** Read base62 digits (case-sensitive) as an integer, most significant first. */
export function base62Value(digits: string): bigint {
  let value = 0n;
  for (const character of digits) {
    value = value * 62n + BigInt(BASE62.indexOf(character));
  }
  return value;
}
