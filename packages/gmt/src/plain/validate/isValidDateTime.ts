import { Temporal } from "@js-temporal/polyfill";
import { plainDateTime } from "../../regex";
import { isLeapSecond } from "./isLeapSecond";

/**
 * Return true when `value` is a valid PlainDateTime string.
 * A valid PlainDateTime string is a string that can be parsed by Temporal.PlainDateTime.from() and is not a leap second.
 *
 * @param value string candidate
 * @example isValidDateTime("2024-02-29T12:34:56") => true
 * @example isValidDateTime("2024-02-30T12:34:56") => false (invalid date)
 * @example isValidDateTime("2024-02-29T24:00:00") => false (invalid time)
 * @example isValidDateTime("2024-02-29T23:59:60") => false (leap second)
 * @returns boolean indicating whether the value is a valid PlainDateTime string
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
