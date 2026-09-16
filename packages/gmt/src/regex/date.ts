/**
 * RegExp matching the shape of an ISO 8601 year: 4 digits, or a sign and 6 digits (Temporal's
 * `DateYear`).
 *
 * - Shape only. Any 6 digits match, including years outside the range Temporal can represent
 *   (`-271821` to `+275760`); that range is checked by `Temporal.PlainDate.from`.
 * - `-000000` does not match: Temporal's grammar makes it a Syntax Error ("It is a Syntax Error
 *   if DateYear is `-000000`"). `+000000` and `0000` match.
 *
 * @example year.test("2024")    // true
 * @example year.test("+275760") // true (expanded year)
 * @example year.test("-271821") // true (negative expanded year)
 * @example year.test("+999999") // true (shape only; outside Temporal's range)
 * @example year.test("-000000") // false (negative zero)
 * @example year.test("24")      // false (too few digits)
 * @example year.test("20245")   // false (5 digits without a sign)
 */
export const year: RegExp = /^(?:\d{4}|\+\d{6}|-(?!0{6})\d{6})$/;

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
 * in its month is checked by `Temporal.PlainDate.from` in `isValidDate`).
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
 * - Year: 4-digit (`2024`) or 6-digit with sign (`+000031` / `-000031`), never `-000000`
 *   (a Syntax Error in Temporal's `DateYear`).
 * - Month: `01`–`12`, zero-padded.
 * - Day: `01`–`31`, zero-padded (shape-only; real calendar validation is delegated to
 *   `Temporal.PlainDate.from` in `isValidDate`).
 *
 * Capture groups: 1 month, 2 day. The year is not captured.
 *
 * @example plainDate.test("2024-03-15")       // true
 * @example plainDate.test("+000031-04-30")    // true (6-digit year)
 * @example plainDate.test("-000031-04-30")    // true (negative 6-digit year)
 * @example plainDate.exec("2024-03-15")?.slice(1) // ["03", "15"] (month, day)
 * @example plainDate.test("-000000-01-01")    // false (negative zero year)
 * @example plainDate.test("2024-3-15")        // false (unpadded month)
 * @example plainDate.test("2024-03-00")       // false (day zero)
 */
export const plainDate: RegExp =
  /^(?:\d{4}|\+\d{6}|-(?!0{6})\d{6})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;
