import { Temporal } from "@js-temporal/polyfill";
import { isValidTimeZone } from "../../zoned";
import { isValidUtc } from "../validate";

/**
 * Convert a UTC datetime string to a plain date string in the format "YYYY-MM-DD".
 *
 * - Converts to specified timezone before extracting date.
 * - Defaults to UTC if no timezone specified.
 * - Returns "" for invalid input.
 *
 * @param value UTC datetime string (e.g., "2024-02-29T00:00:00Z")
 * @param options optional: timeZone (IANA)
 * @returns plain date string in "YYYY-MM-DD" format or "" on invalid input
 *
 * @example convertUtcToPlainDate("2024-02-29T00:00:00Z") // "2024-02-29"
 * @example convertUtcToPlainDate("2024-02-29T00:00:00Z", { timeZone: "America/New_York" }) // "2024-02-28"
 * @example convertUtcToPlainDate("invalid") // ""
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
