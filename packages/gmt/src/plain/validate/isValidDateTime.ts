import { Temporal } from "@js-temporal/polyfill";
import { plainDateTime } from "../../regex";
import { isLeapSecond } from "./isLeapSecond";

/**
 * Return true when `value` is a valid PlainDateTime string.
 *
 * - Uses regex to check format before parsing.
 * - Rejects leap seconds (e.g., "2024-02-29T23:59:60").
 * - Rejects invalid dates (e.g., "2024-02-30") and invalid times (e.g., "2024-02-29T24:00:00").
 *
 * @param value string candidate
 * @returns boolean indicating whether the value is a valid PlainDateTime string
 *
 * @example isValidDateTime("2024-02-29T12:34:56") // true
 * @example isValidDateTime("2024-02-30T12:34:56") // false (invalid date)
 * @example isValidDateTime("2024-02-29T24:00:00") // false (invalid time)
 * @example isValidDateTime("2024-02-29T23:59:60") // false (leap second)
 */
export function isValidDateTime(value: string): boolean {
  if (isLeapSecond(value)) {
    return false;
  }

  if (!plainDateTime.test(value)) {
    return false;
  }

  try {
    Temporal.PlainDateTime.from(value);
    return true;
  } catch {
    return false;
  }
}
