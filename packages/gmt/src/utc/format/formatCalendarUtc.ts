import { Temporal } from "@js-temporal/polyfill";
import { joinDateTimeConnector, normalizeDateTime } from "../../internal";
import { normalizeTimeZone } from "../../internal/normalizeTimeZone";
import { toInstantFromUtc } from "../../internal/toInstantFromUtc";
import type { CalendarOptions } from "../../types";
import { isValidUtc } from "../validate";

export interface FormatCalendarUtcOptions extends CalendarOptions {
  /**
   * IANA timezone used for both the calendar-day comparison and the
   * rendered clock time. Resolved via `normalizeTimeZone` — `"local"` for
   * the system zone, an invalid/omitted value falls back to `"UTC"`.
   */
  timeZone?: string;
  /** `Intl.DateTimeFormatOptions` `timeStyle` for the time-of-day half. */
  timeStyle?: "short" | "medium" | "full";
}

const ABS_DAY_THRESHOLD = 6;

/**
 * Format a UTC ISO string as a relative day label plus time-of-day, e.g.
 * "Tomorrow at 2:30 PM" — the UTC counterpart of `formatCalendar`. See that
 * function's JSDoc for the day-label/threshold/connector design; this
 * variant compares calendar days and renders the clock time in `timeZone`
 * (default `"UTC"`).
 *
 * @param value UTC ISO string to format
 * @param locale optional: BCP 47 locale tag
 * @param options optional: { reference, timeZone, timeStyle }
 * @returns the formatted calendar string, or "" on invalid input
 *
 * @example formatCalendarUtc("2026-03-16T18:30:00Z", "en-US", { timeZone: "America/New_York", reference: "2026-03-15T13:00:00Z" }) // "tomorrow at 2:30 PM"
 * @example formatCalendarUtc(value, "fr-FR", { timeZone: "Europe/Paris" }) // "demain à 14:30"
 * @example formatCalendarUtc("not-a-date") // ""
 */
export function formatCalendarUtc(
  value: string,
  locale?: string,
  options: FormatCalendarUtcOptions = {},
): string {
  if (!isValidUtc(value)) return "";
  if (options.reference !== undefined && !isValidUtc(options.reference))
    return "";

  const target = toInstantFromUtc(value);
  if (target === null) return "";

  let reference: Temporal.Instant;
  if (options.reference) {
    const ref = toInstantFromUtc(options.reference);
    if (ref === null) return "";
    reference = ref;
  } else {
    try {
      reference = Temporal.Now.instant();
    } catch {
      return "";
    }
  }

  try {
    const timeZone = normalizeTimeZone(options.timeZone);
    const timeStyle = options.timeStyle ?? "short";

    const targetDate = target.toZonedDateTimeISO(timeZone).toPlainDate();
    const referenceDate = reference.toZonedDateTimeISO(timeZone).toPlainDate();
    const diffDays = targetDate.since(referenceDate).days;

    const epochMilliseconds = Number(target.epochMilliseconds);

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
