import { Temporal } from "@js-temporal/polyfill";
import { joinDateTimeConnector, normalizeDateTime } from "../../internal";
import { isValidUtc } from "../../utc/validate";
import { isValidZonedDateTime } from "../validate";

export interface FormatCalendarZonedOptions {
  /**
   * Anchor point for the relative diff.
   *
   * - ZonedDateTime ISO string: converted into `value`'s own zone before
   *   comparing calendar days. Unlike `formatRelativeZoned`'s `reference`
   *   (which keeps a ZonedDateTime reference in its own zone for
   *   elapsed-time diffing), a calendar *label* is meaningless without
   *   picking one zone's wall clock — `value`'s zone is the natural choice,
   *   since that is whose "today" is being described.
   * - UTC ISO string or numeric epoch (ms): placed into `value`'s timezone.
   * - Omitted: "now" in `value`'s own timezone.
   */
  reference?: string | number;
  /** `Intl.DateTimeFormatOptions` `timeStyle` for the time-of-day half. */
  timeStyle?: "short" | "medium" | "full";
}

const ABS_DAY_THRESHOLD = 6;

/**
 * Format a zoned date-time as a relative day label plus time-of-day, e.g.
 * "Tomorrow at 2:30 PM" — the zoned counterpart of `formatCalendar`. See
 * that function's JSDoc for the day-label/threshold/connector design; this
 * variant differs only in reading `value`'s IANA timezone for both the
 * calendar-day comparison and the rendered clock time.
 *
 * @param value ZonedDateTime ISO string to format
 * @param locale optional: BCP 47 locale tag
 * @param options optional: { reference, timeStyle }
 * @returns the formatted calendar string, or "" on invalid input
 *
 * @example formatCalendarZoned("2026-03-16T14:30:00-04:00[America/New_York]", "en-US", { reference: "2026-03-15T09:00:00-04:00[America/New_York]" }) // "tomorrow at 2:30 PM"
 * @example formatCalendarZoned(value, "de-DE") // "morgen um 14:30"
 * @example formatCalendarZoned("not-a-date") // ""
 */
export function formatCalendarZoned(
  value: string,
  locale?: string,
  options: FormatCalendarZonedOptions = {},
): string {
  if (!isValidZonedDateTime(value)) return "";

  if (
    typeof options.reference === "string" &&
    !isValidZonedDateTime(options.reference) &&
    !isValidUtc(options.reference)
  )
    return "";

  if (
    typeof options.reference === "number" &&
    !Number.isFinite(options.reference)
  )
    return "";

  try {
    const target = Temporal.ZonedDateTime.from(value);
    const timeZone = target.timeZoneId;

    let reference: Temporal.ZonedDateTime;
    if (options.reference == null) {
      reference = Temporal.Now.zonedDateTimeISO(timeZone);
    } else if (typeof options.reference === "string") {
      reference = isValidUtc(options.reference)
        ? Temporal.Instant.from(options.reference).toZonedDateTimeISO(timeZone)
        : Temporal.ZonedDateTime.from(options.reference).withTimeZone(timeZone);
    } else {
      reference = Temporal.Instant.fromEpochMilliseconds(
        options.reference,
      ).toZonedDateTimeISO(timeZone);
    }

    const diffDays = target.toPlainDate().since(reference.toPlainDate()).days;
    const timeStyle = options.timeStyle ?? "short";
    const epochMilliseconds = target.epochMilliseconds;

    if (Math.abs(diffDays) > ABS_DAY_THRESHOLD) {
      return normalizeDateTime(
        new Intl.DateTimeFormat(locale, {
          dateStyle: "long",
          timeStyle,
          timeZone,
        }).format(epochMilliseconds),
      );
    }

    const dayLabel = new Intl.RelativeTimeFormat(locale, {
      numeric: "auto",
    }).format(diffDays, "day");

    return normalizeDateTime(
      joinDateTimeConnector(
        epochMilliseconds,
        timeZone,
        locale,
        dayLabel,
        timeStyle,
      ),
    );
  } catch {
    return "";
  }
}
