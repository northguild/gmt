import { Temporal } from "@js-temporal/polyfill";
import { resolveReadingTimeZone } from "../../internal/resolveReadingTimeZone";
import { resolveWeekStartsOn } from "../../internal/resolveWeekStartsOn";
import { getWeekNumber } from "../../plain/calculate/getWeekNumber";
import { isValidUtc } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return the week number from a UTC datetime string.
 *
 * - `"monday"` (default) is the ISO 8601 week of the week-year: week 1 is the week containing the
 *   first Thursday, so late-December days can be week 1 of the next year (a value on 2024-12-31
 *   → 1). The result is 1–53.
 * - `"sunday"` is the UTS #35 week of the week-year with a Sunday first day and minimal days 1:
 *   week 1 is the Sunday-first week holding 1 January, so late-December days can be week 1 of the
 *   next year (2024-12-31 → 1, 2000-12-30 → 53). The result is 1–53.
 * - `weekStartsOn` other than `"monday"` or `"sunday"` returns null.
 * - The week is read from the value's date on the wall clock of `options.timeZone` (an IANA zone,
 *   default UTC), as `parseTimeFromUtc` does; an invalid zone returns null.
 * - Returns null for invalid input.
 *
 * @param value ISO UTC datetime string (e.g., "2024-03-17T14:30:45Z")
 * @param optionsArg optional: weekStartsOn ("monday" | "sunday") for week calculations, timeZone (IANA, default "UTC")
 * @returns Week number (1-53), or null on invalid input
 *
 * @example parseWeekFromUtc("2024-03-17T14:30:45Z") // 11
 * @example parseWeekFromUtc("2024-12-31T12:00:00Z") // 1 (ISO week 1 of 2025)
 * @example parseWeekFromUtc("2024-12-31T12:00:00Z", { weekStartsOn: "sunday" }) // 1 (its Sunday-first week holds 1 January 2025)
 * @example parseWeekFromUtc("2000-12-31T12:00:00Z", { weekStartsOn: "sunday" }) // 1 (its Sunday-first week holds 1 January 2001)
 * @example parseWeekFromUtc("2024-03-17T02:30:45Z", { weekStartsOn: "sunday", timeZone: "America/New_York" }) // 11 (Saturday 16 March in New York)
 * @example parseWeekFromUtc("invalid") // null
 */
export function parseWeekFromUtc(
  value: string,
  optionsArg?: { weekStartsOn?: "monday" | "sunday"; timeZone?: string },
): number | null {
  try {
    if (!isOptionsArgument(optionsArg)) {
      return null;
    }

    if (!isValidUtc(value)) return null;

    const weekStartsOn = resolveWeekStartsOn(optionsArg?.weekStartsOn);
    const timeZone = resolveReadingTimeZone(optionsArg?.timeZone);
    if (weekStartsOn === null || timeZone === null) return null;

    try {
      const instant = Temporal.Instant.from(value);
      const dt = instant.toZonedDateTimeISO(timeZone);
      const dateStr = dt.toPlainDate().toString();
      return getWeekNumber(dateStr, weekStartsOn);
    } catch {
      return null;
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return null;
  }
}
