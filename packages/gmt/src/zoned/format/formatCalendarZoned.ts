import { Temporal } from "@js-temporal/polyfill";
import { zonedDateTimeFrom } from "../../internal";
import { formatCalendarDays } from "../../internal/formatCalendarDays";
import { isValidUtc } from "../../utc/validate";
import { isValidZonedFormatReference } from "../../internal/zonedFormatReference";
import { isValidZonedDateTime } from "../validate";
import { optionOrDefault } from "../../internal/optionOrDefault";
import { isObject } from "../../internal/isObject";

/**
 * Options for `formatCalendarZoned`: the moment the day label is measured from and the length of
 * the time-of-day half.
 */
export interface FormatCalendarZonedOptions {
  /**
   * The instant the day label is measured from, as a zoned ISO string, a UTC ISO string or a
   * numeric epoch in milliseconds. Whatever its form, it is converted into `value`'s own time zone
   * before calendar days are compared, because a day label needs one zone's wall clock and
   * `value`'s zone is whose "today" is being described. Any other value returns `""`.
   *
   * @defaultValue The current instant, read in `value`'s time zone.
   */
  reference?: string | number;
  /**
   * The length of the time-of-day part, as the `timeStyle` of `Intl.DateTimeFormat`. `"short"`
   * writes hours and minutes, `"medium"` adds seconds, `"long"` adds the short time zone name
   * ("EDT") and `"full"` the long one ("Eastern Daylight Time"). Any other value returns `""`.
   *
   * @defaultValue `"short"`
   */
  timeStyle?: "short" | "medium" | "long" | "full";
}

/**
 * Format a zoned date-time as a relative day label plus time-of-day, e.g.
 * "Tomorrow at 2:30 PM" — the zoned counterpart of `formatCalendar`. See
 * that function's JSDoc for the day-label/threshold/connector design; this
 * variant differs only in reading `value`'s IANA timezone for both the
 * calendar-day comparison and the rendered clock time.
 * - `options` must be an object or omitted: `null` or any other primitive returns `""`, as
 *   Temporal's GetOptionsObject rejects it.
 *
 * @param value ZonedDateTime ISO string to format
 * @param locale optional: BCP 47 locale tag, or a preference list of tags (ECMA-402)
 * @param options optional settings for the reference moment and the time style
 * @returns the formatted calendar string, or "" on invalid input
 *
 * @example formatCalendarZoned("2026-03-16T14:30:00-04:00[America/New_York]", "en-US", { reference: "2026-03-15T09:00:00-04:00[America/New_York]" }) // "tomorrow at 2:30 PM"
 * @example formatCalendarZoned("2026-03-16T14:30:00+01:00[Europe/Berlin]", "de-DE", { reference: "2026-03-15T09:00:00+01:00[Europe/Berlin]" }) // "morgen um 14:30"
 * @example formatCalendarZoned("not-a-date") // ""
 * @example formatCalendarZoned("2024-03-16T14:30:00-04:00[America/New_York]", ["fr-FR", "en-US"], { reference: "2024-03-15T09:00:00-04:00[America/New_York]" }) // "demain à 14:30"
 * @example formatCalendarZoned("2024-03-12T10:00:00-04:00[America/New_York]", "en-US", null as never) // "" (null options)
 */
export function formatCalendarZoned(
  value: string,
  locale?: string | string[],
  options: FormatCalendarZonedOptions = {},
): string {
  try {
    // Temporal GetOptionsObject: options must be an object or omitted; null and other primitives are
    // invalid input.
    if (!isObject(options)) return "";
    if (!isValidZonedDateTime(value)) return "";

    // Each option is read once (GetOption).
    const referenceOption = options.reference;
    if (!isValidZonedFormatReference(referenceOption)) return "";

    try {
      const target = zonedDateTimeFrom(value);
      const timeZone = target.timeZoneId;

      let reference: Temporal.ZonedDateTime;
      if (referenceOption === undefined) {
        reference = Temporal.Now.zonedDateTimeISO(timeZone);
      } else if (typeof referenceOption === "string") {
        reference = isValidUtc(referenceOption)
          ? Temporal.Instant.from(referenceOption).toZonedDateTimeISO(timeZone)
          : zonedDateTimeFrom(referenceOption).withTimeZone(timeZone);
      } else {
        reference =
          Temporal.Instant.fromEpochMilliseconds(
            referenceOption,
          ).toZonedDateTimeISO(timeZone);
      }

      return formatCalendarDays(
        target.toPlainDate().since(reference.toPlainDate()).days,
        target.epochMilliseconds,
        timeZone,
        locale,
        optionOrDefault(options.timeStyle, "short"),
      );
    } catch {
      return "";
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
