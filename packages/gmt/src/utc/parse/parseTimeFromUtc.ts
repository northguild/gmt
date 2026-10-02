import { Temporal } from "@js-temporal/polyfill";
import { normalizeTimeZone } from "../../internal/normalizeTimeZone";
import { isValidUtc } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Extract the time portion from a UTC datetime string.
 *
 * - Uses Temporal.Instant.from to parse, converts to the `timeZone` option's zone.
 * - Returns "" for invalid input.
 *
 * @param value ISO UTC datetime string (e.g., "2024-03-17T14:30:45Z")
 * @param options The time zone the value is read in
 * @returns ISO time string (e.g., "14:30:45") or "" on invalid input
 *
 * @example parseTimeFromUtc("2024-03-17T14:30:45Z") // "14:30:45"
 * @example parseTimeFromUtc("2024-03-17T14:30:45Z", { timeZone: "America/New_York" }) // "10:30:45"
 * @example parseTimeFromUtc("invalid") // ""
 */
export function parseTimeFromUtc(
  value: string,
  options?: {
    /**
     * The time zone whose wall clock the value is read on: an IANA name, a UTC offset, or
     * `"local"` for the system time zone. An invalid zone returns `""`.
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

    if (!isValidUtc(value)) {
      return "";
    }

    const timeZone = normalizeTimeZone(options?.timeZone);
    if (timeZone === "") {
      return "";
    }

    try {
      const instant = Temporal.Instant.from(value);
      const dateTime = instant.toZonedDateTimeISO(timeZone);
      return dateTime.toPlainTime().toString();
    } catch {
      return "";
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
