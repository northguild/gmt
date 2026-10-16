import { isValidZonedDateTime } from "../validate/isValidZonedDateTime";
import { zonedDateTimeFrom } from "../../internal";

/**
 * Returns the zoned datetime string rounded/truncated to second precision.
 *
 * - Removes millisecond precision.
 * - Returns "" for invalid input.
 *
 * @param value ISO 8601 zoned datetime string
 * @returns Zoned datetime string without milliseconds or "" for invalid
 *
 * @example chopZonedMilliseconds("2024-02-29T14:30:45.123+00:00[Europe/London]") // "2024-02-29T14:30:45+00:00[Europe/London]"
 * @example chopZonedMilliseconds("invalid") // ""
 */
export function chopZonedMilliseconds(value: string): string {
  if (!isValidZonedDateTime(value)) return "";
  try {
    return zonedDateTimeFrom(value).toString({
      smallestUnit: "second",
    });
  } catch {
    return "";
  }
}
