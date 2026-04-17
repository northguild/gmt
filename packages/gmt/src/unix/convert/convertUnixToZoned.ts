import { Temporal } from "@js-temporal/polyfill";
import { isValidAmount } from "../../internal";
import {
  isValidUnixUnit,
  type UnixUnit,
} from "../../unix/validate/isValidUnixUnit";
import { isValidTimeZone } from "../../zoned/validate";

/**
 * Convert a unix epoch value to a zoned ISO 8601 datetime string.
 *
 * - Converts to ZonedDateTime using the specified timezone.
 * - Validates value, timezone, and epoch unit.
 * - Returns "" for invalid input.
 *
 * @param value epoch value (number)
 * @param timeZone IANA timeZone identifier
 * @param unit optional unit, "seconds" or "milliseconds"
 * @returns zoned ISO 8601 string or "" on invalid
 *
 * @example convertUnixToZoned(1709164800000, "America/New_York") // "2024-02-29T00:00:00-05:00[America/New_York]"
 * @example convertUnixToZoned(1709164800, "UTC", "seconds") // "2024-02-29T00:00:00+00:00[UTC]"
 * @example convertUnixToZoned(-1, "UTC") // "1969-12-31T23:59:59.999Z[UTC]"
 */
export function convertUnixToZoned(
  value: number,
  timeZone: string,
  ...unitInput: [unit?: UnixUnit]
): string {
  const resolvedUnit = unitInput.length === 0 ? "milliseconds" : unitInput[0];

  if (
    !isValidAmount(value) ||
    !isValidTimeZone(timeZone) ||
    !isValidUnixUnit(resolvedUnit ?? "")
  ) {
    return "";
  }

  try {
    const instant = Temporal.Instant.fromEpochMilliseconds(
      resolvedUnit === "seconds" ? value * 1000 : value,
    );

    return instant.toZonedDateTimeISO(timeZone).toString();
  } catch {
    return "";
  }
}
