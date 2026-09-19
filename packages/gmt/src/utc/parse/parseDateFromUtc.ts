import { utcZonedDateTime } from "../../internal/utcZonedDateTime";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Extract the date portion from a UTC datetime string.
 *
 * - Uses Temporal.Instant.from to parse, converts to UTC date.
 * - Reads the value on the wall clock of `options.timeZone` (an IANA zone, default UTC), as
 *   `parseTimeFromUtc` does; an invalid zone returns "".
 * - Returns "" for invalid input.
 *
 * @param value ISO UTC datetime string (e.g., "2024-03-17T14:30:45Z")
 * @param options optional: timeZone (IANA, default "UTC")
 * @returns ISO date string (e.g., "2024-03-17") or "" on invalid input
 *
 * @example parseDateFromUtc("2024-03-17T14:30:45Z") // "2024-03-17"
 * @example parseDateFromUtc("2025-01-01T02:00:00Z", { timeZone: "America/New_York" }) // "2024-12-31"
 * @example parseDateFromUtc("invalid") // ""
 */
export function parseDateFromUtc(
  value: string,
  options?: { timeZone?: string },
): string {
  if (!isOptionsArgument(options)) {
    return "";
  }

  const dateTime = utcZonedDateTime(value, options);

  return dateTime === null ? "" : dateTime.toPlainDate().toString();
}
