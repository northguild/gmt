import { zonedDateTimeOf } from "../../internal/zonedWallClock";

/**
 * Returns the zoned datetime string truncated to minute precision.
 *
 * - Removes seconds and milliseconds.
 * - Returns "" for invalid input.
 *
 * @param value ISO 8601 zoned datetime string
 * @returns Zoned datetime string at minute precision or "" for invalid
 *
 * @example chopZonedSeconds("2024-02-29T14:30:45.123+11:00[Australia/Sydney]") // "2024-02-29T14:30+11:00[Australia/Sydney]"
 * @example chopZonedSeconds("invalid") // ""
 */
export function chopZonedSeconds(value: string): string {
  const zonedDateTime = zonedDateTimeOf(value);
  if (zonedDateTime === null) return "";
  try {
    return zonedDateTime.toString({
      smallestUnit: "minute",
    });
  } catch {
    return "";
  }
}
