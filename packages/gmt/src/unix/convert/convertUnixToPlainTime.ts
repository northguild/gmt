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
 *
 * - Converts to PlainTime using the specified or system timezone.
 * - Validates epoch unit ("seconds" | "milliseconds").
 * - Returns "" for invalid input.
 *
 * @param unix Unix timestamp (number)
 * @param options optional: epochUnit ("seconds" | "milliseconds"), timeZone (IANA)
 * @returns plain time string in "HH:mm:ss" format or "" on invalid input
 *
 * @example convertUnixToPlainTime(1706659200000) // "00:00:00"
 * @example convertUnixToPlainTime(1706659200, { epochUnit: "seconds" }) // "00:00:00"
 * @example convertUnixToPlainTime(-1) // "23:59:59.999"
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
