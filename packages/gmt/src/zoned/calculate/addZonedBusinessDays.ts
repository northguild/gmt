import { isValidAmount } from "../../internal";
import { adjustZonedBusinessDays } from "../../internal/adjustZonedBusinessDays";
import { isValidZonedDateTime } from "../validate";

/**
 * Return a zoned ISO 8601 datetime string with `amount` business days added to `value`.
 *
 * - Uses a fixed Monday–Friday business week (no locale awareness). Saturday–Sunday is
 *   CLDR's world-default weekend; ISO 8601 defines no weekend.
 * - Has no calendar parameter, so no other weekend and no holidays. It is not the
 *   zoned form of the plain `addBusinessDays`, which takes a `BusinessCalendar`.
 * - Saturday and Sunday are skipped during the count.
 * - Preserves the original time component through the operation.
 * - Returns "" on invalid input.
 *
 * @param value ISO 8601 zoned datetime string
 * @param amount number of business days to add
 * @returns Zoned ISO 8601 datetime string after adding business days, or "" on invalid input
 *
 * @example addZonedBusinessDays("2024-03-15T14:30:00+09:00[Asia/Tokyo]", 1) // "2024-03-18T14:30:00+09:00[Asia/Tokyo]"
 * @example addZonedBusinessDays("2024-03-16T14:30:00+09:00[Asia/Tokyo]", 1) // "2024-03-18T14:30:00+09:00[Asia/Tokyo]"
 * @example addZonedBusinessDays("2024-03-15T14:30:00+09:00[Asia/Tokyo]", 0) // "2024-03-15T14:30:00+09:00[Asia/Tokyo]"
 * @example addZonedBusinessDays("invalid", 1) // ""
 */
export function addZonedBusinessDays(value: string, amount: number): string {
  if (!isValidZonedDateTime(value) || !isValidAmount(amount)) {
    return "";
  }

  if (amount === 0) {
    return adjustZonedBusinessDays(value, 1, 0);
  }

  const absAmount = Math.abs(amount);
  const direction = amount > 0 ? 1 : -1;
  return adjustZonedBusinessDays(value, direction, absAmount);
}
