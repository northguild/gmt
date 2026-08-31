export const year: RegExp = /^(?:\d{4}|[+-]\d{6})$/;
export const month: RegExp = /^(0[1-9]|1[0-2])$/;
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
