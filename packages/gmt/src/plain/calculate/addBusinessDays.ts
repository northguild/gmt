import { Temporal } from "@js-temporal/polyfill";
import { advanceBusinessDays, isValidAmount } from "../../internal";
import { isValidDate } from "../validate";

/**
 * Return a PlainDate ISO string with `amount` business days added to `value`.
 *
 * - Uses fixed ISO Monday–Friday business days (no locale awareness).
 * - Saturday and Sunday are skipped during the count.
 * - Returns "" on invalid input.
 *
 * @param value ISO PlainDate string
 * @param amount number of business days to add
 * @returns ISO PlainDate string after adding business days, or "" on invalid input
 *
 * @example addBusinessDays("2024-03-15", 1) // "2024-03-18"
 * @example addBusinessDays("2024-03-16", 1) // "2024-03-18"
 * @example addBusinessDays("2024-03-15", 0) // "2024-03-15"
 * @example addBusinessDays("invalid", 1) // ""
 */
export function addBusinessDays(value: string, amount: number): string {
  if (!isValidDate(value) || !isValidAmount(amount)) {
    return "";
  }

  if (amount === 0) {
    return value;
  }

  try {
    const date = Temporal.PlainDate.from(value);
    const direction = amount > 0 ? 1 : -1;
    return advanceBusinessDays(date, direction, Math.abs(amount)).toString();
  } catch {
    return "";
  }
}
