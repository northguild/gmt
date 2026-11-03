import { sqlDateTime } from "../regex/sql-date-time";
import { Temporal } from "./temporal";

/**
 * The shared core of `parseSqlDateTime` and `isValidSqlDateTime`: read a SQL timestamp literal
 * without a time zone and return it as a plain ISO 8601 datetime string, or `""` when it is not
 * one. Never throws.
 *
 * @param value - The text to read.
 * @returns `YYYY-MM-DDTHH:MM:SS[.f]`, or `""` for any other value.
 * @example readSqlDateTime("2024-03-15 14:30:00.500") // "2024-03-15T14:30:00.5"
 * @example readSqlDateTime("2024-02-30 14:30:00")     // ""
 * @example readSqlDateTime(42)                        // ""
 */
export function readSqlDateTime(value: unknown): string {
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
