import { Temporal } from "@js-temporal/polyfill";
import { plainTime } from "../../regex";
import { isLeapSecond } from "./isLeapSecond";

/**
 * Return true when `value` is a valid ISO PlainTime string.
 *
 * - Performs a regex pre-check and then attempts to construct a
 *   Temporal.PlainTime for stronger validation.
 * - Explicitly rejects leap-second inputs (times with 60 seconds).
 * - Returns false for invalid inputs.
 *
 * @param value ISO PlainTime string
 * @example isValidTime("12:34:56") => true
 * @example isValidTime("24:00:00") => false (invalid hour)
 * @example isValidTime("23:60:00") => false (invalid minute)
 * @example isValidTime("23:59:60") => false (leap second)
 * @returns boolean indicating validity
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
