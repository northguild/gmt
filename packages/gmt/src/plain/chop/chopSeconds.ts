import { plainDateTimeOf, plainTimeOf } from "../../internal/inputChecks";

/**
 * Return an ISO string with second precision removed from a PlainDateTime or PlainTime value.
 *
 * - Truncates to minute precision.
 * - Accepts both PlainDateTime and PlainTime formats.
 * - Returns "" for invalid input.
 *
 * @param value ISO PlainDateTime or PlainTime string
 * @returns ISO string trimmed to minutes or "" on invalid input
 *
 * @example chopSeconds("2024-02-29T12:34:56") // "2024-02-29T12:34"
 * @example chopSeconds("12:34:56") // "12:34"
 * @example chopSeconds("invalid") // ""
 */
export function chopSeconds(value: string): string {
  try {
    const dateTime = plainDateTimeOf(value);
    if (dateTime !== null) {
      return dateTime.toString({
        smallestUnit: "minute",
      });
    }
    const time = plainTimeOf(value);
    if (time !== null) {
      return time.toString({
        smallestUnit: "minute",
      });
    }
    return "";
  } catch {
    return "";
  }
}
