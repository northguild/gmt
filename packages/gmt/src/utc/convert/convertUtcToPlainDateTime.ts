// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { Temporal } from "@js-temporal/polyfill";
import { normalizeTimeZone } from "../../internal/normalizeTimeZone";
import { isValidUtc } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Convert a UTC datetime string to a plain datetime string in the format "YYYY-MM-DDTHH:mm:ss".
 *
 * - Converts to the `timeZone` option's zone before extracting the datetime.
 * - Returns "" for invalid input.
 *
 * @param value UTC datetime string (e.g., "2024-02-29T00:00:00Z")
 * @param options The time zone the value is read in
 * @returns plain datetime string in "YYYY-MM-DDTHH:mm:ss" format or "" on invalid input
 *
 * @example convertUtcToPlainDateTime("2024-02-29T00:00:00Z") // "2024-02-29T00:00:00"
 * @example convertUtcToPlainDateTime("2024-02-29T00:00:00Z", { timeZone: "America/New_York" }) // "2024-02-28T19:00:00"
 * @example convertUtcToPlainDateTime("invalid") // ""
 */
export function convertUtcToPlainDateTime(
  value: string,
  options?: {
    /**
     * The time zone the wall-clock fields are read in: an IANA name, a UTC offset, or `"local"` for
     * the system time zone. An unknown zone returns `""`.
     *
     * @defaultValue `"UTC"`
     */
    timeZone?: string;
  },
): string {
  try {
    if (!isOptionsArgument(options)) {
      return "";
    }

    const timeZone = normalizeTimeZone(options?.timeZone);

    if (timeZone === "") return "";
    if (!isValidUtc(value)) return "";

    try {
      const instant = Temporal.Instant.from(value);
      const zonedDateTime = instant.toZonedDateTimeISO(timeZone);
      return `${zonedDateTime.year.toString().padStart(4, "0")}-${zonedDateTime.month
        .toString()
        .padStart(2, "0")}-${zonedDateTime.day
        .toString()
        .padStart(2, "0")}T${zonedDateTime.hour
        .toString()
        .padStart(2, "0")}:${zonedDateTime.minute
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
