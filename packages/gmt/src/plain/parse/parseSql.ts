import { Temporal } from "@js-temporal/polyfill";
import { sqlDateTime } from "../../regex";

/**
 * Parse an ANSI SQL / ODBC datetime literal — the `YYYY-MM-DD HH:MM:SS` form
 * MySQL, SQLite, and standard SQL `DATETIME`/`TIMESTAMP` columns (without a
 * time zone) use — into a plain ISO 8601 datetime string.
 *
 * - **Plain only.** SQL's offset-carrying `TIMESTAMPTZ` literal is out of
 *   scope; see `formatSql`'s JSDoc.
 * - Requires the space separator and 2-digit zero-padded month/day/hour;
 *   unlike `parseRfc2822`'s lenient 1-2 digit day, a single-digit field is
 *   rejected — SQL's literal grammar has no variable-width form to accept.
 * - Fractional seconds, when present, are preserved as-is; the regex only
 *   proves shape — `Temporal.PlainDateTime.from` proves the value is a real
 *   calendar date/time.
 *
 * @param value SQL datetime literal (e.g. "2024-03-15 14:30:00")
 * @returns plain ISO 8601 datetime string, or "" on invalid input
 *
 * @example parseSql("2024-03-15 14:30:00") // "2024-03-15T14:30:00"
 * @example parseSql("2024-03-15 14:30:00.5") // "2024-03-15T14:30:00.5"
 * @example parseSql("2024-03-15T14:30:00") // "" (wrong separator)
 * @example parseSql("not a date") // ""
 */
export function parseSql(value: string): string {
  if (typeof value !== "string") return "";
  if (!sqlDateTime.test(value)) return "";

  try {
    return Temporal.PlainDateTime.from(value.replace(" ", "T")).toString();
  } catch {
    return "";
  }
}
