/**
 * RegExp matching a Unix timestamp in seconds: exactly 10 digits.
 *
 * - Covers the range from `0000000000` (1970-01-01T00:00:00Z) through
 *   `3999999999` (2096-10-11T03:33:19Z), which is the practical range for
 *   10-digit Unix-second timestamps.
 *
 * @example unixSeconds.test("1710511800") // true
 * @example unixSeconds.test("0000000000") // true (epoch)
 * @example unixSeconds.test("17105118001") // false (11 digits)
 */
export const unixSeconds = /^\d{10}$/;

/**
 * RegExp matching a Unix timestamp in milliseconds: exactly 13 digits.
 *
 * - Covers the range from `0000000000000` (1970-01-01T00:00:00Z) through
 *   `3999999999999` (2096-10-11T03:33:19.999Z).
 *
 * @example unixMilliseconds.test("1710511800123") // true
 * @example unixMilliseconds.test("0000000000000")  // true (epoch)
 * @example unixMilliseconds.test("17105118001")    // false (11 digits)
 */
export const unixMilliseconds = /^\d{13}$/;
