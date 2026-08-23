import { adjustZonedBusinessDays, isValidAmount } from "../../internal";
import { isValidZonedDateTime } from "../validate";

/**
 * Return a zoned ISO 8601 datetime string with `amount` business days added to `value`.
 *
 * - Uses fixed ISO Monday–Friday business days (no locale awareness).
 * - Saturday and Sunday are skipped during the count.
 * - Preserves the original time component through the operation.
 * - Returns "" on invalid input.
 *
 * @param value ISO 8601 zoned datetime string
 * @param amount number of business days to add
 * @returns Zoned ISO 8601 datetime string after adding business days, or "" on invalid input
 *
 * @example addZonedBusinessDays("2024-03-15T14:30:00-04:00[America/New_York]", 1) // "2024-03-18T14:30:00-04:00[America/New_York]"
 * @example addZonedBusinessDays("2024-03-16T14:30:00-04:00[America/New_York]", 1) // "2024-03-18T14:30:00-04:00[America/New_York]"
 * @example addZonedBusinessDays("2024-03-15T14:30:00-04:00[America/New_York]", 0) // "2024-03-15T14:30:00-04:00[America/New_York]"
 * @example addZonedBusinessDays("invalid", 1) // ""
 */
export function addZonedBusinessDays(value: string, amount: number): string {
  if (!isValidZonedDateTime(value) || !isValidAmount(amount)) {
    return "";
  }

  if (amount === 0) {
    return value;
  }

  const absAmount = Math.abs(amount);
  const direction = amount > 0 ? 1 : -1;
  return adjustZonedBusinessDays(value, direction, absAmount);
}
