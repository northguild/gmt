import { getToday } from "../get/getToday";
import { isValidDate } from "../validate";
import { isAfterDate } from "./isAfterDate";

/**
 * Return true when `value` is strictly after today, per the system clock
 * and system timeZone.
 *
 * - `value === today` returns false — "future" means strictly after, not
 *   on-or-after.
 * - Compares against `getToday()`, so this depends on the **system clock and
 *   system timeZone**. A caller needing determinism should use
 *   `isZonedFuture` with an explicit timeZone, or compare against an
 *   explicit reference with `isAfterDate`.
 * - Returns false if `value` is invalid or the system timeZone is unavailable.
 *
 * @param value ISO PlainDate string
 * @returns true if `value` is after today, false on invalid input
 *
 * @example isFuture("2024-03-16") // true, if today is 2024-03-15
 * @example isFuture("2024-03-15") // false, if today is 2024-03-15 (equal is not future)
 * @example isFuture("2024-03-14") // false, if today is 2024-03-15
 * @example isFuture("invalid") // false
 */
export function isFuture(value: string): boolean {
  if (!isValidDate(value)) {
    return false;
  }

  const today = getToday();
  if (today === "") {
    return false;
  }

  return isAfterDate(value, today);
}
