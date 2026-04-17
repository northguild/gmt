import { Temporal } from "@js-temporal/polyfill";
import { isValidDateTime, isValidTime } from "../validate";

/**
 * Return a string with millisecond precision removed from a PlainDateTime or PlainTime value.
 *
 * - Truncates to second precision.
 * - Accepts both PlainDateTime and PlainTime formats.
 * - Returns "" for invalid input.
 *
 * @param value ISO PlainDateTime or PlainTime string
 * @returns ISO string without milliseconds, or "" on invalid input
 *
 * @example chopMilliseconds("2024-02-29T12:34:56.789") // "2024-02-29T12:34:56"
 * @example chopMilliseconds("12:34:56.789") // "12:34:56"
 * @example chopMilliseconds("invalid") // ""
 */
export function chopMilliseconds(value: string): string {
  try {
    if (isValidDateTime(value)) {
      return Temporal.PlainDateTime.from(value).toString({
        smallestUnit: "second",
      });
    }
    if (isValidTime(value)) {
      return Temporal.PlainTime.from(value).toString({
        smallestUnit: "second",
      });
    }
    return "";
  } catch {
    return "";
  }
}
