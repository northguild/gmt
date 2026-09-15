/**
 * RegExp matching an ISO 8601 year: 4 digits, or a sign and 6 digits for the expanded years
 * Temporal supports (`-271821` to `+275760`).
 *
 * @example year.test("2024")    // true
 * @example year.test("+275760") // true (expanded year)
 * @example year.test("-271821") // true (negative expanded year)
 * @example year.test("24")      // false (too few digits)
 * @example year.test("20245")   // false (5 digits without a sign)
 */
export const year: RegExp = /^(?:\d{4}|[+-]\d{6})$/;

/**
 * RegExp matching an ISO 8601 month: `01`–`12`.
 *
 * @example month.test("01") // true
 * @example month.test("12") // true
 * @example month.test("13") // false (out of range)
 * @example month.test("1")  // false (not zero-padded)
 */
export const month: RegExp = /^(0[1-9]|1[0-2])$/;

/**
 * RegExp matching an ISO 8601 day of the month: `01`–`31` (shape only; whether the day exists
 * in its month is checked by `Temporal.PlainDate.from` in `parseDate`).
 *
 * @example day.test("01") // true
 * @example day.test("31") // true
 * @example day.test("32") // false (out of range)
 * @example day.test("00") // false (day zero)
 * @example day.test("9")  // false (not zero-padded)
 */
export const day: RegExp = /^(0[1-9]|[12][0-9]|3[01])$/;

/**
 * RegExp matching ISO 8601 calendar date (extended): `YYYY-MM-DD` or `±YYYYYY-MM-DD`.
 *
 * - Year: 4-digit (`2024`) or 6-digit with sign (`+000031` / `-000031`).
 * - Month: `01`–`12`, zero-padded.
 * - Day: `01`–`31`, zero-padded (shape-only; real calendar validation is delegated to
 *   `Temporal.PlainDate.from` in `parseDate`).
 *
 * Capture groups: 1 year, 2 month, 3 day.
 *
 * @example plainDate.test("2024-03-15")       // true
 * @example plainDate.test("+000031-04-30")    // true (6-digit year)
 * @example plainDate.test("-000031-04-30")    // true (negative 6-digit year)
 * @example plainDate.test("2024-3-15")        // false (unpadded month)
 * @example plainDate.test("2024-03-00")       // false (day zero)
 */
export const plainDate: RegExp =
  /^(?:\d{4}|[+-]\d{6})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;
