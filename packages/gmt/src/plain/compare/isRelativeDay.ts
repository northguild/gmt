import { plainDateOf } from "../../internal/inputChecks";
import { todayDate } from "../../internal/todayDate";

/**
 * Return true when `value` falls `offsetDays` days from today, per the
 * system clock and system timeZone.
 *
 * - Subsumes `isToday`/`isYesterday`/`isTomorrow`: `offsetDays: 0` is
 *   "today", `-1` is "yesterday", `1` is "tomorrow", and any other integer
 *   offset works the same way.
 * - Compares against today, so this depends on the **system clock and
 *   system timeZone**. The same call returns different answers on hosts in
 *   different timeZones at the same instant — a caller needing determinism
 *   (server-side rendering, tests, scheduled jobs) should use
 *   `isZonedRelativeDay` with an explicit timeZone, or compare against an
 *   explicit reference with `areDatesEqualBy`.
 * - `offsetDays` must be an integer; non-integer or non-finite values return false.
 * - Returns false if `value` is invalid or the system timeZone is unavailable.
 *
 * Migrating from date-fns:
 * - `isToday(value)` → `isRelativeDay(value, 0)`
 * - `isYesterday(value)` → `isRelativeDay(value, -1)`
 * - `isTomorrow(value)` → `isRelativeDay(value, 1)`
 *
 * @param value ISO PlainDate string
 * @param offsetDays integer number of days from today (0 = today, -1 = yesterday, 1 = tomorrow)
 * @returns true if `value` is exactly `offsetDays` days from today, false on invalid input
 *
 * @example isRelativeDay("2024-03-15", 0) // true, if today is 2024-03-15
 * @example isRelativeDay("2024-03-14", -1) // true, if today is 2024-03-15
 * @example isRelativeDay("2024-03-22", 7) // true, if today is 2024-03-15
 * @example isRelativeDay("2024-03-15", 1.5) // false (offsetDays must be an integer)
 * @example isRelativeDay("invalid", 0) // false
 */
export function isRelativeDay(value: string, offsetDays: number): boolean {
  const date = plainDateOf(value);
  if (date === null || !Number.isInteger(offsetDays)) {
    return false;
  }

  const today = todayDate();
  if (today === null) {
    return false;
  }

  try {
    return date.equals(today.add({ days: offsetDays }));
  } catch {
    return false;
  }
}
