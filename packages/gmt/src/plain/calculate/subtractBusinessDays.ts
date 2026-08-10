import { Temporal } from "@js-temporal/polyfill";
import { advanceBusinessDays, isValidAmount } from "../../internal";
import { isValidDate } from "../validate";

/**
 * Return a PlainDate ISO string with `amount` business days subtracted from `value`.
 *
 * - Uses fixed ISO Monday–Friday business days (no locale awareness).
 * - Saturday and Sunday are skipped during the count.
 * - Negative `amount` behaves identically to `addBusinessDays(value, Math.abs(amount))`.
 * - Returns "" on invalid input.
 *
 * @param value ISO PlainDate string
 * @param amount number of business days to subtract
 * @returns ISO PlainDate string after subtracting business days, or "" on invalid input
 *
 * @example subtractBusinessDays("2024-03-18", 1) // "2024-03-15"
 * @example subtractBusinessDays("2024-03-17", 1) // "2024-03-15"
 * @example subtractBusinessDays("2024-03-18", 0) // "2024-03-18"
 * @example subtractBusinessDays("invalid", 1) // ""
 */
export function subtractBusinessDays(value: string, amount: number): string {
  if (!isValidDate(value) || !isValidAmount(amount)) {
    return "";
  }

  if (amount === 0) {
    return value;
  }

  try {
    const date = Temporal.PlainDate.from(value);
    const direction = amount > 0 ? -1 : 1;
    return advanceBusinessDays(date, direction, Math.abs(amount)).toString();
  } catch {
    return "";
  }
}
