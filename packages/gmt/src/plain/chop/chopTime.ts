import { plainDateTimeOf } from "../../internal/inputChecks";

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
  const valueParsed = plainDateTimeOf(value);
  if (valueParsed === null) return "";
  try {
    return valueParsed.toPlainDate().toString();
  } catch {
    return "";
  }
}
