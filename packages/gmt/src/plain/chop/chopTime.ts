import { Temporal } from "@js-temporal/polyfill";
import { isValidDateTime } from "../validate";

/**
 * Return the PlainDate portion extracted from an ISO PlainDateTime string.
 *
 * - Extracts date components from a PlainDateTime.
 * - Returns "" for invalid input.
 *
 * @param value ISO PlainDateTime string
 * @returns ISO PlainDate string or "" on invalid input
 *
 * @example chopTime("2024-02-29T12:34:56") // "2024-02-29"
 * @example chopTime("invalid") // ""
 */
export function chopTime(value: string): string {
  if (!isValidDateTime(value)) return "";
  try {
    return Temporal.PlainDateTime.from(value).toPlainDate().toString();
  } catch {
    return "";
  }
}
