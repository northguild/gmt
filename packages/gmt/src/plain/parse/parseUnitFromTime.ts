import { Temporal } from "@js-temporal/polyfill";

import { resolveDateTimeUnit } from "../../internal/resolveDateTimeUnit";
import { isValidTime } from "../validate";

/**
 * Return a specific time unit extracted from a PlainTime string.
 *
 * - Extracts "hour", "minute", "second", "millisecond", "microsecond" or "nanosecond" from a
 *   PlainTime.
 * - Returns zero-padded string for hour, minute, second (2 digits) and millisecond, microsecond and
 *   nanosecond (3 digits, each the 0-999 Temporal field).
 * - `unit` accepts the singular or plural name (`"hour"` or `"hours"`), as Temporal does.
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
 * @example parseUnitFromTime("14:30:45.123", "milliseconds") // "123"
 * @example parseUnitFromTime("14:30:45.123456789", "nanosecond") // "789"
 * @example parseUnitFromTime("invalid", "hour") // ""
 */
export function parseUnitFromTime(
  value: string,
  unit: Temporal.SmallestUnit<
    "hour" | "minute" | "second" | "millisecond" | "microsecond" | "nanosecond"
  >,
): string {
  if (!isValidTime(value)) {
    return "";
  }

  try {
    const time = Temporal.PlainTime.from(value);

    switch (resolveDateTimeUnit(unit)) {
      case "hour":
        return time.hour.toString().padStart(2, "0");
      case "minute":
        return time.minute.toString().padStart(2, "0");
      case "second":
        return time.second.toString().padStart(2, "0");
      case "millisecond":
        return time.millisecond.toString().padStart(3, "0");
      case "microsecond":
        return time.microsecond.toString().padStart(3, "0");
      case "nanosecond":
        return time.nanosecond.toString().padStart(3, "0");
      default:
        return "";
    }
  } catch {
    return "";
  }
}
