import { readSqlOffsetDateTime } from "../../internal/sqlOffsetDateTime";

/**
 * Return true when `value` is SQL `TIMESTAMP WITH TIME ZONE` text: SQL-92's
 * `YYYY-MM-DD HH:MM:SS±HH:MM`, or a variant PostgreSQL `timestamptz`, SQL Server `datetimeoffset`
 * or Oracle under an ISO `NLS_TIMESTAMP_TZ_FORMAT` print.
 *
 * - True exactly when `parseSqlOffsetDateTime` returns a non-empty string for the same value. Both read
 *   through one core, so they cannot disagree.
 * - **Grammar:** SQL-92 §5.3 `<timestamp string>` and `<time zone interval>`, as
 *   `sqlOffsetDateTime` matches: a single space separator, a four-digit year `0001`–`9999`,
 *   two-digit month, day, hour, minute and second (seconds are required), an optional `.` followed
 *   by up to 9 fraction digits, then an offset `±HH`, `±HH:MM` or `±HH:MM:SS` (PostgreSQL's
 *   hour-only and seconds forms), with one optional space before it (SQL Server and Oracle).
 *   Offset hours `00`–`23` are GMT's rule, wider than SQL-92 (§5.3 Syntax Rule 25: −12:59 …
 *   +13:00), so that `+14:00` (SQL Server, MySQL, Oracle) is read; 24 and above is outside
 *   Temporal's offset grammar.
 * - Checks the calendar as well as the shape. `sqlOffsetDateTime` matches 30 February; this
 *   returns false for it.
 * - False for:
 *   - a second of 60;
 *   - a `T` separator or a `Z`, which `isValidInstant` and `isValidRfc3339DateTime` cover;
 *   - text with no offset, which `isValidSqlDateTime` covers.
 * - A value that is not a string, a `String` object included, returns `false`. A `true` result
 *   narrows an `unknown` value to `string`.
 *
 * @param value any value; a string is checked as a SQL offset timestamp literal
 * @returns boolean indicating validity
 *
 * @example isValidSqlOffsetDateTime("2024-03-15 14:30:00+00") // true
 * @example isValidSqlOffsetDateTime("2007-05-08 12:35:29.1234567 +12:15") // true
 * @example isValidSqlOffsetDateTime("2024-02-30 00:00:00+00") // false (February has no 30th; the sqlOffsetDateTime pattern matches it)
 * @example isValidSqlOffsetDateTime("2024-03-15 14:30:00") // false (no offset: isValidSqlDateTime)
 * @example isValidSqlOffsetDateTime("2024-03-15T14:30:00+00:00") // false (T separator)
 * @example isValidSqlOffsetDateTime(null) // false
 */
export function isValidSqlOffsetDateTime(value: string): boolean;
export function isValidSqlOffsetDateTime(
  value: {} | null | undefined | void,
): boolean;
export function isValidSqlOffsetDateTime(value: unknown): value is string;
export function isValidSqlOffsetDateTime(value: unknown): boolean {
  return readSqlOffsetDateTime(value) !== "";
}
