import { addDate } from "../calculate/addDate";
import { getToday } from "../get/getToday";
import { isValidDate } from "../validate";
import { areDatesEqual } from "./areDatesEqual";

/**
 * Return true when `value` falls `offsetDays` days from today, per the
 * system clock and system timeZone.
 *
 * - Subsumes `isToday`/`isYesterday`/`isTomorrow`: `offsetDays: 0` is
 *   "today", `-1` is "yesterday", `1` is "tomorrow", and any other integer
 *   offset works the same way.
 * - Compares against `getToday()`, so this depends on the **system clock and
 *   system timeZone**. The same call returns different answers on hosts in
 *   different timeZones at the same instant — a caller needing determinism
 *   (server-side rendering, tests, scheduled jobs) should use
 *   `isZonedRelativeDay` with an explicit timeZone, or compare against an
 *   explicit reference with `areDatesEqualBy`.
 * - `offsetDays` must be an integer; non-integer or non-finite values return false.
 * - Returns false if `value` is invalid or the system timeZone is unavailable.
 *
 * Mapping from date-fns (Decision 5, `context/roadmap/issues/J.md`):
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
  if (!isValidDate(value) || !Number.isInteger(offsetDays)) {
    return false;
  }

  const today = getToday();
  if (today === "") {
    return false;
  }

  const target = addDate(today, { days: offsetDays });
  if (target === "") {
    return false;
  }

  return areDatesEqual(value, target);
}
