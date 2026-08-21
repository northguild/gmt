import { getToday } from "../get/getToday";
import { isValidDate } from "../validate";
import { isBeforeDate } from "./isBeforeDate";

/**
 * Return true when `value` is strictly before today, per the system clock
 * and system timeZone.
 *
 * - `value === today` returns false — "past" means strictly before, not
 *   on-or-before.
 * - Compares against `getToday()`, so this depends on the **system clock and
 *   system timeZone**. A caller needing determinism should use `isZonedPast`
 *   with an explicit timeZone, or compare against an explicit reference with
 *   `isBeforeDate`.
 * - Returns false if `value` is invalid or the system timeZone is unavailable.
 *
 * @param value ISO PlainDate string
 * @returns true if `value` is before today, false on invalid input
 *
 * @example isPast("2024-03-14") // true, if today is 2024-03-15
 * @example isPast("2024-03-15") // false, if today is 2024-03-15 (equal is not past)
 * @example isPast("2024-03-16") // false, if today is 2024-03-15
 * @example isPast("invalid") // false
 */
export function isPast(value: string): boolean {
  if (!isValidDate(value)) {
    return false;
  }

  const today = getToday();
  if (today === "") {
    return false;
  }

  return isBeforeDate(value, today);
}
