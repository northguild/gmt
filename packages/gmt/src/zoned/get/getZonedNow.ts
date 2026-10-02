import { Temporal } from "@js-temporal/polyfill";
import { isValidTimeZone } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";
import { optionOrDefault } from "../../internal/optionOrDefault";

/**
 * Return the current zoned datetime for the specified IANA timeZone.
 *
 * - Uses Temporal.Now.zonedDateTimeISO to get the current time.
 * - Validation is performed on the timezone.
 * - `smallestUnit` is the only option read. Any other key on `optionsArg` is ignored, so the
 *   string always carries the offset and the bracketed time zone, and smaller units are always
 *   truncated.
 *
 * @param ianaTimezone IANA timeZone identifier
 * @param optionsArg optional setting for the precision of the output string
 * @returns zoned ISO 8601 datetime string or "" on invalid input
 *
 * @example getZonedNow("America/New_York") // "2024-02-29T09:30:45.123-05:00[America/New_York]"
 * @example getZonedNow("America/New_York", { smallestUnit: "second" }) // "2024-02-29T09:30:45-05:00[America/New_York]"
 * @example getZonedNow("Invalid/Zone") // ""
 * @example getZonedNow("America/New_York", { smallestUnit: "fortnight" as never }) // "" (not a unit from minute to nanosecond)
 */
export function getZonedNow(
  ianaTimezone: string,
  optionsArg?: {
    /**
     * The smallest unit written in the output string, from `"minute"` to `"nanosecond"`, singular
     * or plural. Anything smaller is truncated, as Temporal's `toString` does with its `"trunc"`
     * rounding mode.
     *
     * @defaultValue `"millisecond"`
     */
    smallestUnit?: Temporal.ZonedDateTimeToStringOptions["smallestUnit"];
  },
): string {
  try {
    if (!isOptionsArgument(optionsArg)) {
      return "";
    }

    // ECMA-402 GetOption (the Temporal specification defines the same operation): the option is
    // read once, and a value of undefined is absent, so the default applies.
    // Only smallestUnit is read: any other key on the caller's object (roundingMode, offset,
    // timeZoneName, calendarName, fractionalSecondDigits) never reaches Temporal's toString.
    const options: Partial<Temporal.ZonedDateTimeToStringOptions> = {
      smallestUnit: optionOrDefault(optionsArg?.smallestUnit, "millisecond"),
    };
    if (!isValidTimeZone(ianaTimezone)) {
      return "";
    }

    try {
      const now = Temporal.Now.zonedDateTimeISO(ianaTimezone);
      return now.toString(options);
    } catch {
      return "";
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
