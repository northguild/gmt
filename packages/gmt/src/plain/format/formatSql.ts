import { Temporal } from "@js-temporal/polyfill";
import { isValidDateTime } from "../validate";

/**
 * Format a plain ISO 8601 datetime string as a SQL timestamp literal without a time zone — the
 * `YYYY-MM-DD HH:MM:SS[.fff]` form of standard SQL `TIMESTAMP` and MySQL/SQLite `DATETIME`
 * columns.
 *
 * - **Grammar:** SQL-92 §5.3 `<timestamp string>` and the ODBC `ts` escape, which `parseSql`
 *   reads: the date, a single space, and the time with seconds always written.
 * - A year outside SQL-92's `0001`–`9999` (Table 10) returns `""`: the literal has no sign and
 *   no expanded year to write it with.
 * - **Plain only.** SQL's offset-carrying `TIMESTAMP WITH TIME ZONE` literal
 *   (`YYYY-MM-DD HH:MM:SS±HH:MM`, e.g. PostgreSQL) is out of scope — this targets the far more
 *   common tz-less column shape. There is no zoned counterpart.
 * - Fractional seconds are written as Temporal writes them: only the digits needed, with
 *   trailing zeros dropped (`.500` → `.5`).
 *
 * @param value plain ISO 8601 datetime string (e.g. "2024-03-15T14:30:00")
 * @returns SQL timestamp literal, or "" on invalid input
 *
 * @example formatSql("2024-03-15T14:30:00") // "2024-03-15 14:30:00"
 * @example formatSql("2024-03-15T14:30") // "2024-03-15 14:30:00"
 * @example formatSql("2024-03-15T14:30:00.500") // "2024-03-15 14:30:00.5"
 * @example formatSql("0000-01-01T00:00:00") // "" (year outside 0001–9999)
 * @example formatSql("invalid") // ""
 */
export function formatSql(value: string): string {
  if (!isValidDateTime(value)) return "";

  try {
    const dateTime = Temporal.PlainDateTime.from(value);

    // SQL-92 Table 10: YEAR 0001 to 9999.
    if (dateTime.year < 1 || dateTime.year > 9999) return "";

    return dateTime.toString().replace("T", " ");
  } catch {
    return "";
  }
}
