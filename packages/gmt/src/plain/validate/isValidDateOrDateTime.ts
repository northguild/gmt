import { Temporal } from "@js-temporal/polyfill";
import { plainDate, plainDateTime } from "../../regex";

/**
 * Return true when the input is a valid PlainDate or PlainDateTime ISO string.
 *
 * - Performs regex pre-checks and then constructs Temporal objects to
 *   validate correctness.
 * - Returns false for invalid input.
 *
 * @param value ISO PlainDate or PlainDateTime string
 * @example isValidDateOrDateTime("2024-02-29") => true
 * @example isValidDateOrDateTime("2024-02-30") => false (invalid date)
 * @example isValidDateOrDateTime("2024-02-29T12:34:56") => true
 * @example isValidDateOrDateTime("2024-02-29T24:00:00") => false (invalid time)
 * @returns boolean indicating validity
 */
export function isValidDateOrDateTime(value: string): boolean {
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
