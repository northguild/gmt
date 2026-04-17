import { Temporal } from "@js-temporal/polyfill";

import { isValidTime } from "../validate";

/**
 * Return a specific time unit extracted from a PlainTime string.
 *
 * - Extracts "hour", "minute", "second", or "millisecond" from a PlainTime.
 * - Returns zero-padded string for hour, minute, second (2 digits) and millisecond (3 digits).
 * - Returns "" for invalid input.
 *
 * @param value ISO PlainTime string
 * @param unit unit to extract from the time
 * @returns string representation of the requested unit or "" on invalid input
 *
 * @example parseUnitFromTime("14:30:45.123", "hour") // "14"
 * @example parseUnitFromTime("14:30:45.123", "minute") // "30"
 * @example parseUnitFromTime("14:30:45.123", "second") // "45"
 * @example parseUnitFromTime("14:30:45.123", "millisecond") // "123"
 * @example parseUnitFromTime("invalid", "hour") // ""
 */
export function parseUnitFromTime(
  value: string,
  unit: "hour" | "minute" | "second" | "millisecond",
): string {
  if (!isValidTime(value)) {
    return "";
  }

  try {
    const time = Temporal.PlainTime.from(value);

    switch (unit) {
      case "hour":
        return time.hour.toString().padStart(2, "0");
      case "minute":
        return time.minute.toString().padStart(2, "0");
      case "second":
        return time.second.toString().padStart(2, "0");
      case "millisecond":
        return time.millisecond.toString().padStart(3, "0");
      default:
        return "";
    }
  } catch {
    return "";
  }
}
