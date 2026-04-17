import { Temporal } from "@js-temporal/polyfill";
import { plainTime } from "../../regex";
import { isLeapSecond } from "./isLeapSecond";

/**
 * Return true when `value` is a valid ISO PlainTime string.
 *
 * - Uses regex to check format before parsing.
 * - Rejects leap seconds (e.g., "23:59:60").
 * - Rejects invalid times (e.g., "24:00:00", "23:60:00").
 *
 * @param value ISO PlainTime string
 * @returns boolean indicating validity
 *
 * @example isValidTime("12:34:56") // true
 * @example isValidTime("24:00:00") // false (invalid hour)
 * @example isValidTime("23:60:00") // false (invalid minute)
 * @example isValidTime("23:59:60") // false (leap second)
 */
export function isValidTime(value: string): boolean {
  if (isLeapSecond(value)) {
    return false;
  }

  if (!plainTime.test(value)) {
    return false;
  }

  try {
    Temporal.PlainTime.from(value);
    return true;
  } catch {
    return false;
  }
}
