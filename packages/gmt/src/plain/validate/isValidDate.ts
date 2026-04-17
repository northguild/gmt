import { Temporal } from "@js-temporal/polyfill";
import { plainDate } from "../../regex";
import { isLeapSecond } from "./isLeapSecond";

/**
 * Return true if `value` is a valid ISO PlainDate string.
 *
 * - Uses regex to check format before parsing.
 * - Rejects leap seconds (e.g., "2024-12-31T23:59:60").
 * - Rejects invalid dates (e.g., "2024-02-30").
 *
 * @param value ISO PlainDate string
 * @returns boolean indicating validity
 *
 * @example isValidDate("2024-03-10") // true
 * @example isValidDate("2024-02-30") // false
 * @example isValidDate("invalid") // false
 * @example isValidDate("2024-12-31T23:59:60") // false (leap second - not a valid date)
 */
export function isValidDate(value: string): boolean {
  if (isLeapSecond(value)) {
    return false;
  }

  if (!plainDate.test(value)) {
    return false;
  }

  try {
    Temporal.PlainDate.from(value);
    return true;
  } catch {
    return false;
  }
}
