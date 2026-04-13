import { Temporal } from "@js-temporal/polyfill";
import { isValidAmount } from "../../internal";
import {
  isValidUnixUnit,
  type UnixUnit,
} from "../../unix/validate/isValidUnixUnit";
import { isValidTimeZone } from "../../zoned/validate";

export function convertUnixToZoned(
  value: number,
  timeZone: string,
  ...unitInput: [unit?: UnixUnit]
): string {
  /**
   * Convert a unix epoch value to a zoned ISO 8601 datetime string in the
   * specified `timeZone`.
   *
   * - `value` is milliseconds by default, or seconds when `unit` is "seconds".
   * - Returns empty string "" for invalid inputs (amount, timeZone, or unit).
   *
   * @param value epoch value (number)
   * @param timeZone IANA timeZone identifier
   * @param unit optional unit, "seconds" or "milliseconds"
   * @returns zoned ISO 8601 string or empty string when invalid
   */
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
