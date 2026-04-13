import { Temporal } from "@js-temporal/polyfill";
import { getSystemTimeZone } from "../../plain";
import { isValidTimeZone } from "../../zoned";
import {
  isValidUnixMilliseconds,
  isValidUnixSeconds,
  isValidUnixUnit,
} from "../validate";

/**
 * Convert a Unix timestamp to a plain time string in the format "HH:mm:ss".
 * - Accepts Unix timestamps in seconds or milliseconds (default is milliseconds).
 * - Returns an empty string for invalid inputs.
 * - Uses Temporal.ZonedDateTime for accurate time conversion.
 * @param unix Unix timestamp (number)
 * @param options conversion options
 * @example convertUnixToPlainTime(1706659200000) // "00:00:00"
 * @example convertUnixToPlainTime(1706659200, { epochUnit: "seconds" }) // "00:00:00"
 * @returns plain time string in "HH:mm:ss" format or "" on invalid input
 */
export function convertUnixToPlainTime(
  unix: number,
  options?: { epochUnit?: "seconds" | "milliseconds"; timeZone?: string },
): string {
  const { epochUnit = "milliseconds", timeZone = getSystemTimeZone() } =
    options ?? {};

  if (!isValidUnixUnit(epochUnit)) return "";
  if (!isValidTimeZone(timeZone)) return "";

  try {
    if (
      (epochUnit === "milliseconds" && !isValidUnixMilliseconds(unix)) ||
      (epochUnit === "seconds" && !isValidUnixSeconds(unix))
    ) {
      return "";
    }

    const instant = Temporal.Instant.fromEpochMilliseconds(
      epochUnit === "seconds" ? unix * 1000 : unix,
    );
    const zonedDateTime = instant.toZonedDateTimeISO(timeZone);
    return zonedDateTime.toPlainTime().toString();
  } catch {
    return "";
  }
}
