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

/**
 * A UUID that carries a timestamp. RFC 9562 §4 ABNF: 8-4-4-4-12 hex digits, hyphens required,
 * no braces, no `urn:uuid:`. The version digit (§4.2) is 1, 6 or 7, and the variant digit
 * (§4.1) is 8, 9, a or b: bits `10xx`.
 */
export const timeUuidText =
  /^[\da-f]{8}-[\da-f]{4}-[167][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;

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

/** An unsigned decimal string of up to 20 digits: 2^64 − 1 has 20 digits. */
export const unsignedDecimalText = /^\d{1,20}$/;

/** Crockford base32 alphabet (ULID spec § Encoding): no `I L O U`. */
export const CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** KSUID `base62.go` alphabet: `0-9A-Za-z`, spelled out in full. */
export const BASE62_ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** Read hex digits as an integer. The caller has matched a grammar first. */
export function hexValue(digits: string): bigint {
  return BigInt("0x" + digits);
}

/**
 * Read `digits` as an integer in the base `alphabet.length`, most significant first. The
 * caller has matched a grammar first and upper-cases Crockford digits it reads from either case.
 */
export function digitsValue(digits: string, alphabet: string): bigint {
  return [...digits].reduce(
    (value, digit) =>
      value * BigInt(alphabet.length) + BigInt(alphabet.indexOf(digit)),
    0n,
  );
}

/** Write an integer as `length` upper-case Crockford base32 digits, most significant first. */
export function crockfordDigits(value: bigint, length: number): string {
  return value
    .toString(32)
    .padStart(length, "0")
    .replace(/./g, (digit) => CROCKFORD_ALPHABET.charAt(parseInt(digit, 32)));
}
