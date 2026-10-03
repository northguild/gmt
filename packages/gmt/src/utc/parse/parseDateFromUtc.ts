import { utcZonedDateTime } from "../../internal/utcZonedDateTime";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Extract the date portion from a UTC datetime string.
 *
 * - Uses Temporal.Instant.from to parse, converts to UTC date.
 * - Returns "" for invalid input.
 *
 * @param value ISO UTC datetime string (e.g., "2024-03-17T14:30:45Z")
 * @param options The time zone the value is read in
 * @returns ISO date string (e.g., "2024-03-17") or "" on invalid input
 *
 * @example parseDateFromUtc("2024-03-17T14:30:45Z") // "2024-03-17"
 * @example parseDateFromUtc("2025-01-01T02:00:00Z", { timeZone: "America/New_York" }) // "2024-12-31"
 * @example parseDateFromUtc("invalid") // ""
 */
export function parseDateFromUtc(
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

    const dateTime = utcZonedDateTime(value, options);

    return dateTime === null ? "" : dateTime.toPlainDate().toString();
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
