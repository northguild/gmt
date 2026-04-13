import { Temporal } from "@js-temporal/polyfill";
import { plainDate, plainDateTime } from "../../regex";
import { isLeapSecond } from "./isLeapSecond";

/**
 * Return true when the input is a valid PlainDate or PlainDateTime ISO string.
 *
 * - Performs regex pre-checks and then constructs Temporal objects to
 *   validate correctness.
 * - Rejects leap seconds explicitly.
 * - Returns false for invalid input.
 *
 * @param value ISO PlainDate or PlainDateTime string
 * @example isValidIsoDateLike("2024-02-29") => true
 * @example isValidIsoDateLike("2024-02-30") => false (invalid date)
 * @example isValidIsoDateLike("2024-02-29T12:34:56") => true
 * @example isValidIsoDateLike("2024-02-29T24:00:00") => false (invalid time)
 * @example isValidIsoDateLike("2024-12-31T23:59:60") => false (leap second)
 * @returns boolean indicating validity
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
