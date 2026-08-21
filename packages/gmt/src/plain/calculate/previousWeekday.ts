import { Temporal } from "@js-temporal/polyfill";
import { advanceToWeekday, isValidDayOfWeek } from "../../internal";
import { isValidDate } from "../validate";

/**
 * Return a PlainDate ISO string for the previous occurrence of `dayOfWeek` on or before `value`.
 *
 * - `dayOfWeek` uses Temporal's ISO numbering: 1 (Monday) through 7 (Sunday), consistent with
 *   `getDayOfWeek`/`parseDayOfWeekFromDate`.
 * - `options.inclusive` (default `false`) controls what happens when `value` already falls on
 *   `dayOfWeek`: `false` goes back a full week (matching date-fns), `true` returns `value` as-is.
 * - Returns "" on invalid input.
 *
 * Replaces date-fns's sixteen `previous*` functions with one parameterized call:
 *
 * | date-fns              | gmt                              |
 * | ---------------------- | --------------------------------- |
 * | `previousMonday`      | `previousWeekday(value, 1)`      |
 * | `previousTuesday`     | `previousWeekday(value, 2)`      |
 * | `previousWednesday`   | `previousWeekday(value, 3)`      |
 * | `previousThursday`    | `previousWeekday(value, 4)`      |
 * | `previousFriday`      | `previousWeekday(value, 5)`      |
 * | `previousSaturday`    | `previousWeekday(value, 6)`      |
 * | `previousSunday`      | `previousWeekday(value, 7)`      |
 * | `previousDay(v, n)`   | `previousWeekday(value, n)`      |
 *
 * @param value ISO PlainDate string
 * @param dayOfWeek target ISO day of week (1-7, Monday-Sunday)
 * @param options optional: inclusive (boolean, default false)
 * @returns ISO PlainDate string for the previous occurrence of `dayOfWeek`, or "" on invalid input
 *
 * @example previousWeekday("2024-03-15", 5) // "2024-03-08" (2024-03-15 is already a Friday, so it goes back a full week)
 * @example previousWeekday("2024-03-15", 5, { inclusive: true }) // "2024-03-15"
 * @example previousWeekday("2024-03-13", 5) // "2024-03-08" (Wednesday -> previous Friday)
 * @example previousWeekday("invalid", 5) // ""
 * @example previousWeekday("2024-03-15", 0) // "" (dayOfWeek out of range)
 */
export function previousWeekday(
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
      -1,
      options?.inclusive ?? false,
    ).toString();
  } catch {
    return "";
  }
}
