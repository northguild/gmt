import { Temporal } from "@js-temporal/polyfill";
import { plainTime } from "../../regex";

/**
 * Return true when `value` is a valid ISO PlainTime string.
 *
 * - Performs a regex pre-check and then attempts to construct a
 *   Temporal.PlainTime for stronger validation.
 * - Returns false for invalid inputs.
 *
 * @param value ISO PlainTime string
 * @returns boolean indicating validity
 */
export function isValidTime(value: string): boolean {
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
