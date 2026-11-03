import { readSqlOffsetDateTime } from "../../internal/sqlOffsetDateTime";

/**
 * Parse SQL `TIMESTAMP WITH TIME ZONE` text into an ISO 8601 date-time string that keeps the
 * offset: SQL-92's `YYYY-MM-DD HH:MM:SS±HH:MM`, and the variants PostgreSQL `timestamptz`, SQL
 * Server `datetimeoffset` and Oracle under an ISO `NLS_TIMESTAMP_TZ_FORMAT` print.
 *
 * - **Grammar:** SQL-92 §5.3 `<timestamp string>` and `<time zone interval>`, as
 *   `sqlOffsetDateTime` matches: a single space separator, a four-digit year `0001`–`9999`,
 *   two-digit month, day, hour, minute and second (seconds are required), an optional `.` followed
 *   by up to 9 fraction digits, then an offset `±HH`, `±HH:MM` or `±HH:MM:SS` (PostgreSQL's
 *   hour-only and seconds forms), with one optional space before it (SQL Server and Oracle).
 *   Offset hours `00`–`23` are GMT's rule, wider than SQL-92 (§5.3 Syntax Rule 25: −12:59 …
 *   +13:00), so that `+14:00` (SQL Server, MySQL, Oracle) is read; 24 and above is outside
 *   Temporal's offset grammar.
 * - **The offset is kept, not applied.** The result is the same wall time and offset in ISO form.
 *   - Read the instant and offset with `toOffsetInstant`, or the UTC instant with
 *     `toOffsetInstant(…)?.instant`.
 *   - PostgreSQL's offset is the session `TimeZone`'s rendering, not stored data. SQL Server's is
 *     stored.
 * - **Normalised:**
 *   - A `T` separator.
 *   - An hour-only offset gains `:00`.
 *   - Offset seconds of `00` are dropped.
 *   - A negative zero offset is written `+00:00`.
 *   - The fraction is written as Temporal writes one: trailing zeros dropped, and a bare `.` is
 *     dropped.
 * - **Not read here, with the right reader for each:**
 *   - `T` and `Z` (ISO 8601: `toOffsetInstant`, `parseRfc3339`). One form has both readers: a
 *     space, then a full `±HH:MM` with no space before it. `parseRfc3339` returns it zoned
 *     (`…+05:30[+05:30]`); this one returns it with the offset alone;
 *   - text with no offset (`parseSqlDateTime`);
 *   - a `BC` year or `infinity` (no Temporal value);
 *   - a leap second (`:60`), which SQL-92 §6.1 Table 10 allows; Temporal has no leap seconds.
 * - **Precision:** up to 9 fraction digits. PostgreSQL prints 6, SQL Server 7, and Oracle up to 9.
 *
 * @param value SQL timestamp-with-time-zone text, e.g. `"2024-03-15 14:30:00+00"`
 * @returns ISO 8601 date-time with offset, or `""` on invalid input
 *
 * @example parseSqlOffsetDateTime("2024-03-15 14:30:00+00") // "2024-03-15T14:30:00+00:00"
 * @example parseSqlOffsetDateTime("2024-03-15 14:30:00.123456+05:30") // "2024-03-15T14:30:00.123456+05:30"
 * @example parseSqlOffsetDateTime("2007-05-08 12:35:29.1234567 +12:15") // "2007-05-08T12:35:29.1234567+12:15" (SQL Server `datetimeoffset`)
 * @example parseSqlOffsetDateTime("1900-01-01 00:00:00+00:19:32") // "1900-01-01T00:00:00+00:19:32"
 * @example parseSqlOffsetDateTime("2024-02-30 00:00:00+00") // ""
 * @example parseSqlOffsetDateTime("2024-03-15T14:30:00+00:00") // "" (ISO 8601: use `toOffsetInstant`)
 * @example parseSqlOffsetDateTime("2024-03-15 14:30:00") // "" (no offset: use `parseSqlDateTime`)
 * @example parseSqlOffsetDateTime("infinity") // ""
 */
export function parseSqlOffsetDateTime(value: string): string {
  try {
    return readSqlOffsetDateTime(value);
  } catch {
    return "";
  }
}
