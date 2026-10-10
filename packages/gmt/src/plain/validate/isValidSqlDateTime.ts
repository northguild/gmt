import { parseSqlDateTime } from "../parse/parseSqlDateTime";

/**
 * Return true when `value` is a real SQL timestamp literal without a time zone: the
 * `YYYY-MM-DD HH:MM:SS[.fff]` value of a standard SQL `TIMESTAMP` or a MySQL/SQLite `DATETIME`
 * column. It checks one date-and-time value, not a SQL statement.
 *
 * - True exactly when `parseSqlDateTime` returns a plain string for the same value: the validator
 *   calls the parser, so the two cannot disagree.
 * - **Grammar:** SQL-92 §5.3 `<timestamp string>` and the ODBC `ts` escape, as `sqlDateTime`
 *   matches: a single space separator, a four-digit year `0001`–`9999`, two-digit month, day,
 *   hour, minute and second (seconds are required), and an optional `.` followed by up to 9
 *   fraction digits.
 * - Checks the calendar as well as the shape. The `sqlDateTime` pattern proves the shape alone, so
 *   it matches a day that does not exist: 30 February, 29 February in a common year and 31 June
 *   are false here.
 * - False for a second of 60: GMT rejects leap seconds.
 * - **Plain only.** A `T` separator, a `Z` and an offset are false: SQL's offset-carrying
 *   `TIMESTAMP WITH TIME ZONE` literal is out of scope.
 * - False for a non-string. Read the value with `parseSqlDateTime`; write one with
 *   `formatSqlDateTime`.
 *
 * @param value candidate SQL timestamp literal
 * @returns boolean indicating validity
 *
 * @example isValidSqlDateTime("2024-03-15 14:30:00") // true
 * @example isValidSqlDateTime("2024-03-15 14:30:00.123456789") // true
 * @example isValidSqlDateTime("2024-02-30 14:30:00") // false (February has no 30th; the sqlDateTime pattern matches it)
 * @example isValidSqlDateTime("2023-02-29 14:30:00") // false (2023 has no 29 February; the sqlDateTime pattern matches it)
 * @example isValidSqlDateTime("2024-06-31 00:00:00") // false (June has 30 days; the sqlDateTime pattern matches it)
 * @example isValidSqlDateTime("2024-03-15 14:30") // false (seconds are required)
 * @example isValidSqlDateTime("2024-03-15T14:30:00") // false (T separator)
 * @example isValidSqlDateTime("not a date") // false
 */
export function isValidSqlDateTime(value: string): boolean {
  return parseSqlDateTime(value) !== "";
}
