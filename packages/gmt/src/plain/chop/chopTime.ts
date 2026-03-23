import { Temporal } from "@js-temporal/polyfill";
import { isValidDateTime } from "../validate/isValidDateTime";

/**
 * Return the PlainDate portion extracted from an ISO PlainDateTime string.
 *
 * - Converts a PlainDateTime string into its PlainDate component.
 * - Returns an empty string for invalid input.
 *
 * @param value ISO PlainDateTime string
 * @returns ISO PlainDate string or "" on invalid input
 */
export function chopTime(value: string): string {
  if (!isValidDateTime(value)) return "";
  return Temporal.PlainDateTime.from(value).toPlainDate().toString();
}
