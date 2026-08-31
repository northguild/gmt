/**
 * RegExp matching an ANSI SQL / ODBC timestamp literal: `YYYY-MM-DD HH:mm[:ss[.fffffffff]]`.
 *
 * - Uses a space separator (never `T`), always zero-padded.
 * - Fractional seconds use `.` only (not `,`) and support 1–9 digits.
 * - Shape-only validation; real calendar validation is delegated to
 *   `Temporal.PlainDateTime.from` in `parseSql`.
 *
 * @example sqlDateTime.test("2024-03-15 14:30:00.123456789") // true
 * @example sqlDateTime.test("2024-03-15 14:30")               // true (seconds omitted)
 * @example sqlDateTime.test("2024-03-15T14:30:00")            // false (T separator)
 * @example sqlDateTime.test("2024-3-5 14:30:00")             // false (unpadded)
 * @example sqlDateTime.test("2024-03-15 14:30:60")           // false (invalid second)
 */
export const sqlDateTime: RegExp =
  /^(?:\d{4}|[+-]\d{6})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01]) (0[0-9]|1[0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9](?:\.[0-9]{1,9})?)?$/;
