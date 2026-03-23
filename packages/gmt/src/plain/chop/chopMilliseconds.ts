import { Temporal } from "@js-temporal/polyfill";
import { isValidDateTime } from "../validate/isValidDateTime";
import { isValidTime } from "../validate/isValidTime";

/**
 * Return a string with millisecond precision removed from an ISO PlainDateTime
 * or PlainTime.
 *
 * - Trims precision to seconds for both PlainDateTime and PlainTime inputs.
 * - Returns an empty string for invalid input.
 *
 * @param value ISO PlainDateTime or PlainTime string
 * @returns ISO string without milliseconds, or "" on invalid input
 */
export function chopMilliseconds(value: string): string {
  if (isValidDateTime(value)) {
    return Temporal.PlainDateTime.from(value).toString({
      smallestUnit: "second",
    });
  }
  if (isValidTime(value)) {
    return Temporal.PlainTime.from(value).toString({ smallestUnit: "second" });
  }
  return "";
}
