import type { Temporal } from "@js-temporal/polyfill";
import { joinDateTimeConnector } from "./joinDateTimeConnector";
import { normalizeDateTime } from "./normalizeDateTime";

// Beyond a week either direction the phrase falls back to an absolute date, as plain
// `formatCalendar` does.
const ABS_DAY_THRESHOLD = 6;

/**
 * Render a calendar phrase for a moment `diffDays` calendar days from the reference: "tomorrow at
 * 2:30 PM" within six days, else the long date and time. Shared by the zoned, utc and unix
 * calendar formatters.
 *
 * @param diffDays signed calendar-day distance from the reference, in `timeZone`
 * @param epochMilliseconds the moment to render
 * @param timeZone IANA zone the clock time is rendered in
 * @param locale BCP 47 locale(s) passed through to `Intl`
 * @param timeStyle the `Intl.DateTimeFormat` time style
 * @returns the phrase; throws where `Intl` throws, for the caller's sentinel
 * @example formatCalendarDays(1, 1710685800000, "UTC", "en-US", "short") // "tomorrow at 2:30 PM"
 * @example formatCalendarDays(-9, 1710685800000, "UTC", "en-US", "short") // "March 17, 2024 at 2:30 PM"
 */
export function formatCalendarDays(
  diffDays: number,
  epochMilliseconds: number,
  timeZone: string,
  locale: string | string[] | undefined,
  timeStyle: "short" | "medium" | "full",
): string {
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
}

/**
 * `formatCalendarDays` for two instants, counting calendar days between their dates in `timeZone`.
 *
 * @param target the moment to render
 * @param reference the moment "today" is read from
 * @param timeZone IANA zone both dates and the clock time are read in
 * @param locale BCP 47 locale(s) passed through to `Intl`
 * @param timeStyle the `Intl.DateTimeFormat` time style
 * @returns the phrase; throws where Temporal or `Intl` throws
 * @example formatCalendarInstants(Temporal.Instant.from("2024-03-17T14:30:00Z"), Temporal.Instant.from("2024-03-16T09:00:00Z"), "UTC", "en-US", "short") // "tomorrow at 2:30 PM"
 */
export function formatCalendarInstants(
  target: Temporal.Instant,
  reference: Temporal.Instant,
  timeZone: string,
  locale: string | string[] | undefined,
  timeStyle: "short" | "medium" | "full",
): string {
  const targetDate = target.toZonedDateTimeISO(timeZone).toPlainDate();
  const referenceDate = reference.toZonedDateTimeISO(timeZone).toPlainDate();
  const diffDays = targetDate.since(referenceDate).days;

  return formatCalendarDays(
    diffDays,
    Number(target.epochMilliseconds),
    timeZone,
    locale,
    timeStyle,
  );
}
