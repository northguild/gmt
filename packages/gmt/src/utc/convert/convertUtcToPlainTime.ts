// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { Temporal } from "@js-temporal/polyfill";
import { isValidTimeZone } from "../../zoned";
import { isValidUtc } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Convert a UTC datetime string to a plain time string in the format "HH:mm:ss".
 *
 * - Converts to specified timezone before extracting time.
 * - Defaults to UTC if no timezone specified.
 * - Returns "" for invalid input.
 *
 * @param value UTC datetime string (e.g., "2024-02-29T00:00:00Z")
 * @param options optional: timeZone (IANA)
 * @returns plain time string in "HH:mm:ss" format or "" on invalid input
 *
 * @example convertUtcToPlainTime("2024-02-29T00:00:00Z") // "00:00:00"
 * @example convertUtcToPlainTime("2024-02-29T00:00:00Z", { timeZone: "America/New_York" }) // "19:00:00"
 * @example convertUtcToPlainTime("invalid") // ""
 */
export function convertUtcToPlainTime(
  value: string,
  options?: { timeZone?: string },
): string {
  try {
    if (!isOptionsArgument(options)) {
      return "";
    }

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
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
