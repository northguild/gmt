import { Temporal } from "@js-temporal/polyfill";
import { plainDate, plainDateTime } from "../../regex";
import { isLeapSecond } from "./isLeapSecond";

/**
 * Return true when the input is a valid PlainDate or PlainDateTime ISO string.
 *
 * - Accepts both PlainDate ("2024-02-29") and PlainDateTime ("2024-02-29T12:34:56") formats.
 * - Uses regex to check format before parsing.
 * - Rejects leap seconds and invalid dates/times.
 *
 * @param value ISO PlainDate or PlainDateTime string
 * @returns boolean indicating validity
 *
 * @example isValidIsoDateLike("2024-02-29") // true
 * @example isValidIsoDateLike("2024-02-30") // false (invalid date)
 * @example isValidIsoDateLike("2024-02-29T12:34:56") // true
 * @example isValidIsoDateLike("2024-02-29T24:00:00") // false (invalid time)
 * @example isValidIsoDateLike("2024-12-31T23:59:60") // false (leap second)
 */
export function isValidIsoDateLike(value: string): boolean {
  if (isLeapSecond(value)) {
    return false;
  }

  if (plainDate.test(value)) {
    try {
      Temporal.PlainDate.from(value);
      return true;
    } catch {
      return false;
    }
  }

  if (plainDateTime.test(value)) {
    try {
      Temporal.PlainDateTime.from(value);
      return true;
    } catch {
      return false;
    }
  }

  return false;
}
