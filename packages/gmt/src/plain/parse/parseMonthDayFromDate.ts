import { monthDayString } from "../../internal/monthDay";
import { Temporal } from "../../internal/temporal";
import { isValidDate } from "../validate";

/**
 * Return the month-day (`--MM-DD`) of an ISO 8601 date string.
 *
 * - The year is dropped, so `2023-02-28` and `2024-02-28` give the same month-day.
 * - Only the ISO calendar is read; a Hebrew or Islamic date gives `""`.
 * - Returns "" for invalid input.
 *
 * @param value ISO date string
 * @returns The canonical `--MM-DD` string, or "" on invalid input
 *
 * @example parseMonthDayFromDate("2024-12-25") // "--12-25"
 * @example parseMonthDayFromDate("2024-02-29") // "--02-29"
 * @example parseMonthDayFromDate("2024-02-30") // ""
 * @example parseMonthDayFromDate("2024-12-25[u-ca=hebrew]") // ""
 */
export function parseMonthDayFromDate(value: string): string {
  if (!isValidDate(value)) return "";

  try {
    return monthDayString(Temporal.PlainDate.from(value).toPlainMonthDay());
  } catch {
    return "";
  }
}
