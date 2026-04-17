import { Temporal } from "@js-temporal/polyfill";
import { isValidTimeZone } from "../validate";

/**
 * Return the current zoned datetime for the specified IANA timeZone.
 *
 * - Uses Temporal.Now.zonedDateTimeISO to get the current time.
 * - Validation is performed on the timezone.
 *
 * @param ianaTimezone IANA timeZone identifier
 * @param optionsArg optional: smallestUnit ("second" | "millisecond" | "microsecond" | "nanosecond")
 * @returns zoned ISO 8601 datetime string or "" on invalid input
 *
 * @example getZonedNow("America/New_York") // "2024-02-29T09:30:45.123-05:00[America/New_York]"
 * @example getZonedNow("Invalid/Zone") // ""
 */
export function getZonedNow(
  ianaTimezone: string,
  optionsArg?: {
    smallestUnit?: Temporal.ZonedDateTimeToStringOptions["smallestUnit"];
  },
): string {
  const options = {
    smallestUnit: "millisecond",
    ...optionsArg,
  } as Partial<Temporal.ZonedDateTimeToStringOptions>;
  if (!isValidTimeZone(ianaTimezone)) {
    return "";
  }

  try {
    const now = Temporal.Now.zonedDateTimeISO(ianaTimezone);
    return now.toString(options);
  } catch {
    return "";
  }
}
