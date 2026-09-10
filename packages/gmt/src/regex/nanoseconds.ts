/**
 * RegExp matching the canonical decimal form of a nanosecond timestamp — the shape
 * `formatNanoseconds` emits and `parseNanoseconds` accepts.
 *
 * - An optional `-`, then digits with no leading zeros. Anchored, so it matches a whole
 *   value rather than a fragment.
 * - Exponents, fractions, hex, digit separators, a `+` sign and surrounding whitespace are
 *   all rejected. That strictness is the point: a payload written by another language's
 *   serialiser either reads back exactly or fails loudly, never silently coerced.
 * - Shape only. The representable-instant range is a separate check — see
 *   `isValidNanoPattern`, which applies both.
 *
 * @example nanosecondDecimal.test("1710072000123456789") // true
 * @example nanosecondDecimal.test("-1000000000") // true
 * @example nanosecondDecimal.test("0") // true
 * @example nanosecondDecimal.test("01") // false (leading zero)
 * @example nanosecondDecimal.test("1.5") // false
 * @example nanosecondDecimal.test("1e18") // false
 */
export const nanosecondDecimal: RegExp = /^-?(?:0|[1-9][0-9]*)$/;
