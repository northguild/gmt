/**
 * RegExp matching a Unix timestamp in seconds: exactly 10 digits.
 *
 * - Matches `0000000000` (1970-01-01T00:00:00Z) through `9999999999`
 *   (2286-11-20T17:46:39Z).
 * - Does not match an unpadded value (`"999999999"`, `"0"`), so every real timestamp before
 *   `1000000000` (2001-09-09T01:46:40Z) needs zero-padding to match, and never matches a
 *   negative (pre-1970) timestamp.
 *
 * @example unixSeconds.test("1710511800") // true
 * @example unixSeconds.test("0000000000") // true (epoch)
 * @example unixSeconds.test("9999999999") // true (2286-11-20T17:46:39Z)
 * @example unixSeconds.test("999999999")  // false (unpadded; 2001-09-09T01:46:39Z)
 * @example unixSeconds.test("-1")         // false (negative)
 * @example unixSeconds.test("17105118001") // false (11 digits)
 */
export const unixSeconds = /^\d{10}$/;

/**
 * RegExp matching a Unix timestamp in milliseconds: exactly 13 digits.
 *
 * - Matches `0000000000000` (1970-01-01T00:00:00Z) through `9999999999999`
 *   (2286-11-20T17:46:39.999Z).
 * - Does not match an unpadded value, so every real timestamp before `1000000000000`
 *   (2001-09-09T01:46:40Z) needs zero-padding to match, and never matches a negative one.
 *
 * @example unixMilliseconds.test("1710511800123") // true
 * @example unixMilliseconds.test("0000000000000")  // true (epoch)
 * @example unixMilliseconds.test("999999999999")   // false (unpadded, 12 digits)
 * @example unixMilliseconds.test("17105118001")    // false (11 digits)
 */
export const unixMilliseconds = /^\d{13}$/;
