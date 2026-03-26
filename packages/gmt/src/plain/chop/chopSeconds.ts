import { Temporal } from "@js-temporal/polyfill";
import { isValidDateTime, isValidTime } from "../validate";

/**
 * Return an ISO string with second precision removed (rounded/truncated to
 * minutes) for PlainDateTime or PlainTime values.
 *
 * - Converts inputs to minute precision.
 * - Returns an empty string for invalid input.
 *
 * @param value ISO PlainDateTime or PlainTime string
 * @returns ISO string trimmed to minutes or "" on invalid input
 */
export function chopSeconds(value: string): string {
  if (isValidDateTime(value)) {
    return Temporal.PlainDateTime.from(value).toString({
      smallestUnit: "minute",
    });
  }
  if (isValidTime(value)) {
    return Temporal.PlainTime.from(value).toString({ smallestUnit: "minute" });
  }
  return "";
}
