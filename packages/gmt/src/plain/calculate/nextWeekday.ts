// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { Temporal } from "../../internal/temporal";
import { advanceToWeekday, isValidDayOfWeek } from "../../internal";
import { isValidDate } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return a PlainDate ISO string for the next occurrence of `dayOfWeek` after `value` (or on it,
 * with `inclusive: true`).
 *
 * - `dayOfWeek` uses Temporal's ISO numbering: 1 (Monday) through 7 (Sunday), consistent with
 *   `getDayOfWeek`/`parseDayOfWeekFromDate`.
 * - Returns "" on invalid input.
 *
 * Migrating from date-fns: its eight `next*` functions map to one parameterized call. date-fns
 * numbers days 0 (Sunday) to 6 (Saturday), so `nextDay`'s 0 becomes 7.
 *
 * | date-fns        | gmt                                   |
 * | --------------- | ------------------------------------- |
 * | `nextMonday`    | `nextWeekday(value, 1)`               |
 * | `nextTuesday`   | `nextWeekday(value, 2)`               |
 * | `nextWednesday` | `nextWeekday(value, 3)`               |
 * | `nextThursday`  | `nextWeekday(value, 4)`               |
 * | `nextFriday`    | `nextWeekday(value, 5)`               |
 * | `nextSaturday`  | `nextWeekday(value, 6)`               |
 * | `nextSunday`    | `nextWeekday(value, 7)`               |
 * | `nextDay(v, n)` | `nextWeekday(value, n === 0 ? 7 : n)` |
 *
 * @param value ISO PlainDate string
 * @param dayOfWeek target ISO day of week (1-7, Monday-Sunday)
 * @param options Whether `value` itself can be the result
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
  options?: {
    /**
     * Whether `value` counts when it already falls on `dayOfWeek`. `true` returns `value`
     * unchanged; `false` advances a full week.
     *
     * @defaultValue `false`
     */
    inclusive?: boolean;
  },
): string {
  if (!isOptionsArgument(options)) {
    return "";
  }

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
