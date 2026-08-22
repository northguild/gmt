import { Temporal } from "@js-temporal/polyfill";
import { isValidDateTime } from "../validate";

/**
 * Format a plain ISO 8601 datetime string as an ANSI SQL / ODBC datetime
 * literal — the `YYYY-MM-DD HH:MM:SS` form MySQL, SQLite, and standard SQL
 * `DATETIME`/`TIMESTAMP` columns (without a time zone) accept.
 *
 * - **Plain only.** SQL's offset-carrying `TIMESTAMPTZ` literal
 *   (`YYYY-MM-DD HH:MM:SS±HH:MM`, e.g. PostgreSQL) is out of scope — this
 *   targets the far more common tz-less `DATETIME` column shape. There is no
 *   zoned counterpart in this story.
 * - The only change from GMT's own ISO output is the separator: `T` becomes
 *   a single space. Fractional seconds, when present, are preserved as-is.
 *
 * @param value plain ISO 8601 datetime string (e.g. "2024-03-15T14:30:00")
 * @returns SQL datetime literal, or "" on invalid input
 *
 * @example formatSql("2024-03-15T14:30:00") // "2024-03-15 14:30:00"
 * @example formatSql("2024-03-15T14:30:00.500") // "2024-03-15 14:30:00.5"
 * @example formatSql("invalid") // ""
 */
export function formatSql(value: string): string {
  if (!isValidDateTime(value)) return "";

  try {
    return Temporal.PlainDateTime.from(value).toString().replace("T", " ");
  } catch {
    return "";
  }
}
