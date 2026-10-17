import { isValidZonedDateTime } from "../validate/isValidZonedDateTime";
import { zonedDateTimeFrom } from "../../internal";

/**
 * Returns the zoned datetime string truncated to minute precision.
 *
 * - Removes seconds and milliseconds.
 * - Returns "" for invalid input.
 *
 * @param value ISO 8601 zoned datetime string
 * @returns Zoned datetime string at minute precision or "" for invalid
 *
 * @example chopZonedSeconds("2024-02-29T14:30:45.123+11:00[Australia/Sydney]") // "2024-02-29T14:30+11:00[Australia/Sydney]"
 * @example chopZonedSeconds("invalid") // ""
 */
export function chopZonedSeconds(value: string): string {
  if (!isValidZonedDateTime(value)) return "";
  try {
    return zonedDateTimeFrom(value).toString({
      smallestUnit: "minute",
    });
  } catch {
    return "";
  }
}
