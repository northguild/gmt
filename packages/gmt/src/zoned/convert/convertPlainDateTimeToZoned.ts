import { Temporal } from "@js-temporal/polyfill";
import { isValidDateTime } from "../../plain/validate";
import { isValidTimeZone } from "../validate";

/**
 * Attach the specified `timeZone` to a plain datetime string and return a zoned ISO 8601 datetime string.
 *
 * - Combines plain datetime with timezone to create ZonedDateTime.
 * - Returns "" for invalid input.
 *
 * @param value plain datetime string (e.g. "2024-02-29T14:30:45")
 * @param timeZone IANA timeZone identifier
 * @param optionsArg optional: smallestUnit
 * @returns zoned ISO 8601 datetime string or "" when invalid
 *
 * @example convertPlainDateTimeToZoned("2024-02-29T14:30:45", "America/New_York") // "2024-02-29T14:30:45.123-05:00[America/New_York]"
 * @example convertPlainDateTimeToZoned("invalid", "America/New_York") // ""
 */
export function convertPlainDateTimeToZoned(
  value: string,
  timeZone: string,
  optionsArg?: {
    smallestUnit?: Temporal.ZonedDateTimeToStringOptions["smallestUnit"];
  },
): string {
  if (!isValidDateTime(value) || !isValidTimeZone(timeZone)) {
    return "";
  }

  const options = {
    smallestUnit: "milliseconds",
    ...optionsArg,
  } as Partial<Temporal.ZonedDateTimeToStringOptions>;

  try {
    const zonedDateTime = Temporal.ZonedDateTime.from(`${value}[${timeZone}]`);
    return zonedDateTime.toString(options);
  } catch {
    return "";
  }
}
