import { Temporal } from "@js-temporal/polyfill";
import {
  isValidUnixUnit,
  type UnixUnit,
} from "../../unix/validate/isValidUnixUnit";
import { isValidZonedDateTime } from "../validate";

/**
 * Convert an ISO 8601 zoned datetime string to a unix epoch value in milliseconds (default) or seconds.
 *
 * - Uses Temporal.ZonedDateTime.toInstant to convert.
 * - Validates epoch unit ("seconds" | "milliseconds").
 * - Returns null for invalid input.
 *
 * @param value zoned ISO 8601 datetime string
 * @param unit optional: "seconds" | "milliseconds"
 * @returns epoch number or null on invalid
 *
 * @example convertZonedToUnix("2024-02-29T12:34:56.789+00:00[UTC]") // 1709200496789
 * @example convertZonedToUnix("2024-02-29T12:34:56.789+00:00[UTC]", "seconds") // 1709200496
 * @example convertZonedToUnix("invalid") // null
 */
export function convertZonedToUnix(
  value: string,
  ...unitInput: [unit?: UnixUnit]
): number | null {
  const resolvedUnit = unitInput.length === 0 ? "milliseconds" : unitInput[0];

  if (!isValidZonedDateTime(value) || !isValidUnixUnit(resolvedUnit ?? "")) {
    return null;
  }

  try {
    const zonedDateTime = Temporal.ZonedDateTime.from(value);
    const milliseconds = Number(zonedDateTime.toInstant().epochMilliseconds);
    return resolvedUnit === "seconds"
      ? Math.floor(milliseconds / 1000)
      : milliseconds;
  } catch {
    return null;
  }
}
