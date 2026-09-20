import { Temporal } from "@js-temporal/polyfill";
import { zonedDateTimeFrom } from "../../internal";
import { formatCalendarDays } from "../../internal/formatCalendarDays";
import { isValidUtc } from "../../utc/validate";
import { isValidZonedFormatReference } from "../../internal/zonedFormatReference";
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
 * @param options optional: { reference, timeStyle }
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
  // Temporal GetOptionsObject: options must be an object or omitted; null and other primitives are
  // invalid input.
  if (options === null || typeof options !== "object") return "";
  if (!isValidZonedDateTime(value)) return "";

  if (!isValidZonedFormatReference(options.reference)) return "";

  try {
    const target = zonedDateTimeFrom(value);
    const timeZone = target.timeZoneId;

    let reference: Temporal.ZonedDateTime;
    if (options.reference === undefined) {
      reference = Temporal.Now.zonedDateTimeISO(timeZone);
    } else if (typeof options.reference === "string") {
      reference = isValidUtc(options.reference)
        ? Temporal.Instant.from(options.reference).toZonedDateTimeISO(timeZone)
        : zonedDateTimeFrom(options.reference).withTimeZone(timeZone);
    } else {
      reference = Temporal.Instant.fromEpochMilliseconds(
        options.reference,
      ).toZonedDateTimeISO(timeZone);
    }

    return formatCalendarDays(
      target.toPlainDate().since(reference.toPlainDate()).days,
      target.epochMilliseconds,
      timeZone,
      locale,
      options.timeStyle === undefined ? "short" : options.timeStyle,
    );
  } catch {
    return "";
  }
}
