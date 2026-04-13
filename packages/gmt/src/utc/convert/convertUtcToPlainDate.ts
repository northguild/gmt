import { Temporal } from "@js-temporal/polyfill";
import { isValidTimeZone } from "../../zoned";
import { isValidUtc } from "../validate";

/**
 * Convert a UTC datetime string to a plain date string in the format "YYYY-MM-DD".
 *
 * - Input must be a valid UTC ISO 8601 datetime string (ending in Z).
 * - Returns an empty string for invalid inputs.
 * - The output date is in the specified timeZone.
 *
 * @param value UTC datetime string (e.g., "2024-02-29T00:00:00Z")
 * @param options conversion options
 * @example convertUtcToPlainDate("2024-02-29T00:00:00Z") // "2024-02-29"
 * @example convertUtcToPlainDate("2024-02-29T00:00:00Z", { timeZone: "America/New_York" }) // "2024-02-28"
 * @returns plain date string in "YYYY-MM-DD" format or "" on invalid input
 */
export function convertUtcToPlainDate(
  value: string,
  options?: { timeZone?: string },
): string {
  const { timeZone = "UTC" } = options ?? {};

  if (!isValidTimeZone(timeZone)) return "";
  if (!isValidUtc(value)) return "";

  try {
    const instant = Temporal.Instant.from(value);
    const zonedDateTime = instant.toZonedDateTimeISO(timeZone);
    return `${zonedDateTime.year.toString().padStart(4, "0")}-${zonedDateTime.month
      .toString()
      .padStart(2, "0")}-${zonedDateTime.day.toString().padStart(2, "0")}`;
  } catch {
    return "";
  }
}
