import { Temporal } from "@js-temporal/polyfill";
import { isValidTimeZone } from "../../zoned";
import { isValidUtc } from "../validate";

/**
 * Extract the time portion from a UTC datetime string.
 *
 * - Uses Temporal.Instant.from to parse, converts to specified timezone.
 * - Defaults to UTC if no timezone specified.
 * - Returns "" for invalid input.
 *
 * @param value ISO UTC datetime string (e.g., "2024-03-17T14:30:45Z")
 * @param options optional: timeZone (IANA)
 * @returns ISO time string (e.g., "14:30:45") or "" on invalid input
 *
 * @example parseTimeFromUtc("2024-03-17T14:30:45Z") // "14:30:45"
 * @example parseTimeFromUtc("2024-03-17T14:30:45Z", { timeZone: "America/New_York" }) // "10:30:45"
 * @example parseTimeFromUtc("invalid") // ""
 */
export function parseTimeFromUtc(
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
