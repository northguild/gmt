import { Temporal } from "@js-temporal/polyfill";
import { getSystemTimeZone } from "../../plain";
import { isValidTimeZone } from "../../zoned";
import {
  isValidUnixMilliseconds,
  isValidUnixSeconds,
  isValidUnixUnit,
} from "../validate";

/**
 * Convert a Unix timestamp to a plain date string in the format "YYYY-MM-DD".
 *
 * - Converts to PlainDate using the specified or system timezone.
 * - Validates epoch unit ("seconds" | "milliseconds").
 * - Returns "" for invalid input.
 *
 * @param unix Unix timestamp (number)
 * @param options optional: epochUnit ("seconds" | "milliseconds"), timeZone (IANA)
 * @returns plain date string in "YYYY-MM-DD" format or "" on invalid input
 *
 * @example convertUnixToPlainDate(1709164800000) // "2024-02-29"
 * @example convertUnixToPlainDate(1709164800, { epochUnit: "seconds" }) // "2024-02-29"
 * @example convertUnixToPlainDate(-1) // "1969-12-31"
 */

export function convertUnixToPlainDate(
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
    return zonedDateTime.toPlainDate().toString();
  } catch {
    return "";
  }
}
