import { Temporal } from "@js-temporal/polyfill";
import { plainDate } from "../../regex";

/**
 * Return true if `value` is a valid ISO PlainDate string.
 *
 * - Uses a regex pre-check followed by Temporal.PlainDate.from for strong
 *   validation.
 * - Returns false on invalid input.
 *
 * @param value ISO PlainDate string
 * @returns boolean indicating validity
 */
export function isValidDate(value: string): boolean {
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
