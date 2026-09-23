import { Temporal } from "@js-temporal/polyfill";
import { sqlDateTime } from "../../regex";

/**
 * Parse a SQL timestamp literal without a time zone — the `YYYY-MM-DD HH:MM:SS[.fff]` form of
 * standard SQL `TIMESTAMP` and MySQL/SQLite `DATETIME` columns — into a plain ISO 8601 datetime
 * string.
 *
 * - **Grammar:** SQL-92 §5.3 `<timestamp string>` and the ODBC `ts` escape, as `sqlDateTime`
 *   matches: a space separator, a four-digit year `0001`–`9999` (no sign, no expanded year),
 *   two-digit month, day, hour, minute and second (seconds are required), and an optional `.`
 *   followed by up to 9 fraction digits.
 * - **Plain only.** SQL's offset-carrying `TIMESTAMP WITH TIME ZONE` literal is out of scope; see
 *   `formatSql`'s JSDoc.
 * - The fraction is written as `Temporal.PlainDateTime#toString` writes it: trailing zeros are
 *   dropped (`.500` → `.5`, `.000` → none), and a `.` with no digits is dropped. `Temporal.PlainDateTime.from`
 *   proves the value is a real calendar date and time.
 *
 * @param value SQL timestamp literal (e.g. "2024-03-15 14:30:00")
 * @returns plain ISO 8601 datetime string, or "" on invalid input
 *
 * @example parseSql("2024-03-15 14:30:00") // "2024-03-15T14:30:00"
 * @example parseSql("2024-03-15 14:30:00.5") // "2024-03-15T14:30:00.5"
 * @example parseSql("2024-03-15 14:30") // "" (seconds are required)
 * @example parseSql("0000-01-01 00:00:00") // "" (year outside 0001–9999)
 * @example parseSql("2024-03-15T14:30:00") // "" (wrong separator)
 * @example parseSql("not a date") // ""
 */
export function parseSql(value: string): string {
  if (typeof value !== "string") return "";
  if (!sqlDateTime.test(value)) return "";

  try {
    return Temporal.PlainDateTime.from(
      value.replace(" ", "T").replace(/\.$/, ""),
    ).toString();
  } catch {
    return "";
  }
}
