import { Temporal } from "@js-temporal/polyfill";
import { isValidDateTime } from "../validate";

/**
 * Return the PlainTime portion extracted from an ISO PlainDateTime string.
 *
 * - Extracts time components from a PlainDateTime.
 * - Returns "" for invalid input.
 *
 * @param value ISO PlainDateTime string
 * @returns ISO PlainTime string or "" on invalid input
 *
 * @example chopDate("2024-02-29T12:34:56") // "12:34:56"
 * @example chopDate("invalid") // ""
 */
export function chopDate(value: string): string {
  if (!isValidDateTime(value)) return "";
  try {
    return Temporal.PlainDateTime.from(value).toPlainTime().toString();
  } catch {
    return "";
  }
}
