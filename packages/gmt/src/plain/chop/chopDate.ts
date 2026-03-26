import { Temporal } from "@js-temporal/polyfill";
import { isValidDateTime } from "../validate";

/**
 * Return the PlainTime portion extracted from an ISO PlainDateTime string.
 *
 * - Converts a PlainDateTime string into its PlainTime component.
 * - Returns an empty string for invalid input.
 *
 * @param value ISO PlainDateTime string
 * @returns ISO PlainTime string or "" on invalid input
 */
export function chopDate(value: string): string {
  if (!isValidDateTime(value)) return "";
  return Temporal.PlainDateTime.from(value).toPlainTime().toString();
}
