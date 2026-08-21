import { Temporal } from "@js-temporal/polyfill";
import { advanceToWeekday, isValidDayOfWeek } from "../../internal";
import { isValidDate } from "../validate";

/**
 * Return a PlainDate ISO string for the next occurrence of `dayOfWeek` on or after `value`.
 *
 * - `dayOfWeek` uses Temporal's ISO numbering: 1 (Monday) through 7 (Sunday), consistent with
 *   `getDayOfWeek`/`parseDayOfWeekFromDate`.
 * - `options.inclusive` (default `false`) controls what happens when `value` already falls on
 *   `dayOfWeek`: `false` advances a full week (matching date-fns), `true` returns `value` as-is.
 * - Returns "" on invalid input.
 *
 * Replaces date-fns's sixteen `next*` functions with one parameterized call:
 *
 * | date-fns          | gmt                          |
 * | ----------------- | ----------------------------- |
 * | `nextMonday`      | `nextWeekday(value, 1)`      |
 * | `nextTuesday`     | `nextWeekday(value, 2)`      |
 * | `nextWednesday`   | `nextWeekday(value, 3)`      |
 * | `nextThursday`    | `nextWeekday(value, 4)`      |
 * | `nextFriday`      | `nextWeekday(value, 5)`      |
 * | `nextSaturday`    | `nextWeekday(value, 6)`      |
 * | `nextSunday`      | `nextWeekday(value, 7)`      |
 * | `nextDay(v, n)`   | `nextWeekday(value, n)`      |
 *
 * @param value ISO PlainDate string
 * @param dayOfWeek target ISO day of week (1-7, Monday-Sunday)
 * @param options optional: inclusive (boolean, default false)
 * @returns ISO PlainDate string for the next occurrence of `dayOfWeek`, or "" on invalid input
 *
 * @example nextWeekday("2024-03-15", 5) // "2024-03-22" (2024-03-15 is already a Friday, so it advances a full week)
 * @example nextWeekday("2024-03-15", 5, { inclusive: true }) // "2024-03-15"
 * @example nextWeekday("2024-03-13", 5) // "2024-03-15" (Wednesday -> next Friday)
 * @example nextWeekday("invalid", 5) // ""
 * @example nextWeekday("2024-03-15", 8) // "" (dayOfWeek out of range)
 */
export function nextWeekday(
  value: string,
  dayOfWeek: number,
  options?: { inclusive?: boolean },
): string {
  if (!isValidDate(value) || !isValidDayOfWeek(dayOfWeek)) return "";

  try {
    const date = Temporal.PlainDate.from(value);
    return advanceToWeekday(
      date,
      dayOfWeek,
      1,
      options?.inclusive ?? false,
    ).toString();
  } catch {
    return "";
  }
}
