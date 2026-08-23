import { adjustZonedBusinessDays, isValidAmount } from "../../internal";
import { isValidZonedDateTime } from "../validate";

/**
 * Return a zoned ISO 8601 datetime string with `amount` business days subtracted from `value`.
 *
 * - Uses fixed ISO Monday–Friday business days (no locale awareness).
 * - Saturday and Sunday are skipped during the count.
 * - Preserves the original time component through the operation.
 * - Returns "" on invalid input.
 *
 * @param value ISO 8601 zoned datetime string
 * @param amount number of business days to subtract
 * @returns Zoned ISO 8601 datetime string after subtracting business days, or "" on invalid input
 *
 * @example subtractZonedBusinessDays("2024-03-18T14:30:00-04:00[America/New_York]", 1) // "2024-03-15T14:30:00-04:00[America/New_York]"
 * @example subtractZonedBusinessDays("2024-03-18T14:30:00-04:00[America/New_York]", 2) // "2024-03-14T14:30:00-04:00[America/New_York]"
 * @example subtractZonedBusinessDays("2024-03-18T14:30:00-04:00[America/New_York]", 0) // "2024-03-18T14:30:00-04:00[America/New_York]"
 * @example subtractZonedBusinessDays("invalid", 1) // ""
 */
export function subtractZonedBusinessDays(
  value: string,
  amount: number,
): string {
  if (!isValidZonedDateTime(value) || !isValidAmount(amount)) {
    return "";
  }

  if (amount === 0) {
    return value;
  }

  return adjustZonedBusinessDays(value, -1, Math.abs(amount));
}
