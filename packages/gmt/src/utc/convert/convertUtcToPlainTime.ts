import { Temporal } from "@js-temporal/polyfill";
import { isValidTimeZone } from "../../zoned";
import { isValidUtc } from "../validate";

/**
 * Convert a UTC datetime string to a plain time string in the format "HH:mm:ss".
 *
 * - Input must be a valid UTC ISO 8601 datetime string (ending in Z).
 * - Returns an empty string for invalid inputs.
 * - The output time is in the specified timeZone.
 *
 * @param value UTC datetime string (e.g., "2024-02-29T00:00:00Z")
 * @param options conversion options
 * @example convertUtcToPlainTime("2024-02-29T00:00:00Z") // "00:00:00"
 * @example convertUtcToPlainTime("2024-02-29T00:00:00Z", { timeZone: "America/New_York" }) // "19:00:00"
 * @returns plain time string in "HH:mm:ss" format or "" on invalid input
 */
export function convertUtcToPlainTime(
  value: string,
  options?: { timeZone?: string },
): string {
  const { timeZone = "UTC" } = options ?? {};

  if (!isValidTimeZone(timeZone)) return "";
  if (!isValidUtc(value)) return "";

  try {
    const instant = Temporal.Instant.from(value);
    const zonedDateTime = instant.toZonedDateTimeISO(timeZone);
    return `${zonedDateTime.hour.toString().padStart(2, "0")}:${zonedDateTime.minute
      .toString()
      .padStart(2, "0")}:${zonedDateTime.second.toString().padStart(2, "0")}`;
  } catch {
    return "";
  }
}
