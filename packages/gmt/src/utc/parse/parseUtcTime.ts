import { Temporal } from "@js-temporal/polyfill";
import { isValidTimeZone } from "../../zoned";
import { isValidUtc } from "../validate";

/**
 * Extract the time portion from a UTC datetime string.
 *
 * - `value` must be a valid UTC ISO datetime string (ending in Z).
 * - Defaults to UTC when no timeZone provided; optionally convert to a specific timeZone.
 * - Returns empty string on invalid input.
 *
 * @param value ISO UTC datetime string (e.g., "2024-03-17T14:30:45Z")
 * @param options optional options with timeZone
 * @example parseUtcTime("2024-03-17T14:30:45Z") // returns "14:30:45"
 * @example parseUtcTime("2024-03-17T14:30:45Z", { timeZone: "America/New_York" }) // returns "10:30:45"
 * @returns ISO time string (e.g., "14:30:45") or "" on invalid input
 */
export function parseUtcTime(
  value: string,
  options?: { timeZone?: string },
): string {
  if (!isValidUtc(value)) {
    return "";
  }

  const { timeZone = "UTC" } = options ?? {};
  if (timeZone !== "UTC" && !isValidTimeZone(timeZone)) {
    return "";
  }

  try {
    const instant = Temporal.Instant.from(value);
    const dateTime = instant.toZonedDateTimeISO(timeZone);
    return dateTime.toPlainTime().toString();
  } catch {
    return "";
  }
}
