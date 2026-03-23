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
