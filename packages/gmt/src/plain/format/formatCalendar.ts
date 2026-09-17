// fallow-ignore-file code-duplication -- cross-family Temporal type clone, by design (rule 5)
import { Temporal } from "@js-temporal/polyfill";
import { joinDateTimeConnector, normalizeDateTime } from "../../internal";
import { plainTimeStyle } from "../../internal/plainFormatOptions";
import type { CalendarOptions } from "../../types";
import { isValidDateTime } from "../validate";

export interface FormatCalendarOptions extends CalendarOptions {
  /**
   * `Intl.DateTimeFormatOptions` `timeStyle` for the time-of-day half.
   * "long" and "full" are not offered: they differ from "medium" only by a
   * `timeZoneName`, and a plain value has no zone. Passed anyway (from
   * untyped code), they format as "medium" — Temporal's PlainDateTime format
   * drops `timeZoneName` (AdjustDateTimeStyleFormat).
   */
  timeStyle?: "short" | "medium";
}

// Beyond a week either direction, Moment's `.calendar()` falls back to an
// absolute date rather than "6 days ago" / "in 6 days" wording. GMT follows
// the same threshold (documented, not a byte-for-byte Moment port — see J15).
const ABS_DAY_THRESHOLD = 6;

/**
 * Format a plain date-time as a relative day label plus time-of-day, e.g.
 * "Tomorrow at 2:30 PM" — Moment's `.calendar()`, which the existing
 * `formatRelativeDateTime` family does not cover (that family renders
 * "in 1 day", an elapsed-time phrase, not a day label + clock time).
 *
 * - Within `±6` days of `reference` (default: now), renders `<day label>`
 *   joined to the localized time using the locale's own connector — never a
 *   hardcoded "at". The day label comes from `Intl.RelativeTimeFormat`
 *   (`numeric: "auto"`), so it reads "Today"/"Tomorrow"/"Yesterday" near
 *   the boundary and "in N days"/"N days ago" further out, all locale-native.
 * - Beyond `±6` days, falls back to an absolute `dateStyle: "long"` +
 *   `timeStyle` string with no relative wording, matching Moment's
 *   `sameElse` behavior.
 * - The connector between the day label and the time is read from CLDR's
 *   own combined date+time pattern for the locale (see
 *   `internal/joinDateTimeConnector.ts`), not hardcoded — this is what lets
 *   `formatCalendar` avoid the i18n objection that excludes a token
 *   formatter (Decision 1 in `context/roadmap/issues/J.md`).
 * - The time never carries a zone name: a plain value has none. A `timeStyle` of `"long"` or
 *   `"full"` (outside the type) formats as `"medium"`.
 * - Use `formatCalendar` for user-facing schedules ("Tomorrow at 2:30 PM");
 *   use `formatRelativeDateTime` for elapsed-time displays ("in 1 day").
 * - `options` must be an object or omitted: `null` or any other primitive returns `""`, as
 *   Temporal's GetOptionsObject rejects it.
 *
 * @param value ISO PlainDateTime string to format
 * @param locale optional: BCP 47 locale tag, or a preference list of tags (ECMA-402)
 * @param options optional: { reference, timeStyle }
 * @returns the formatted calendar string, or "" on invalid input
 *
 * @example formatCalendar("2026-03-16T14:30:00", "en-US", { reference: "2026-03-15T09:00:00" }) // "tomorrow at 2:30 PM"
 * @example formatCalendar("2026-03-08T14:30:00", "en-US", { reference: "2026-03-15T09:00:00" }) // "March 8, 2026 at 2:30 PM" (7 days out — beyond the threshold, absolute fallback)
 * @example formatCalendar("not-a-date") // ""
 * @example formatCalendar("2024-03-16T14:30:00", ["fr-FR", "en-US"], { reference: "2024-03-15T09:00:00" }) // "demain à 14:30"
 * @example formatCalendar("2024-03-12T10:00:00", "en-US", null as never) // "" (null options)
 */
export function formatCalendar(
  value: string,
  locale?: string | string[],
  options: FormatCalendarOptions = {},
): string {
  // Temporal GetOptionsObject: options must be an object or omitted; null and other primitives are
  // invalid input.
  if (options === null || typeof options !== "object") return "";
  if (!isValidDateTime(value)) return "";
  if (options.reference !== undefined && !isValidDateTime(options.reference))
    return "";

  try {
    const target = Temporal.PlainDateTime.from(value);
    const reference = options.reference
      ? Temporal.PlainDateTime.from(options.reference)
      : Temporal.Now.plainDateTimeISO();

    const diffDays = target.toPlainDate().since(reference.toPlainDate()).days;
    // "long"/"full" are outside the type but reachable from JS; their zone
    // name would describe the UTC anchor, not the value. Temporal's
    // PlainDateTime format drops timeZoneName (AdjustDateTimeStyleFormat).
    const timeStyle = plainTimeStyle(options.timeStyle ?? "short");

    // Plain values carry no timezone. UTC is an arbitrary but stable anchor
    // for reusing Intl's part-level formatting — any fixed zone reproduces
    // the same wall-clock fields since there's no real zone to get wrong.
    const epochMilliseconds = target.toZonedDateTime("UTC").epochMilliseconds;

    if (Math.abs(diffDays) > ABS_DAY_THRESHOLD) {
      return normalizeDateTime(
        new Intl.DateTimeFormat(locale, {
          dateStyle: "long",
          timeStyle,
          timeZone: "UTC",
        }).format(epochMilliseconds),
      );
    }

    const dayLabel = new Intl.RelativeTimeFormat(locale, {
      numeric: "auto",
    }).format(diffDays, "day");

    return normalizeDateTime(
      joinDateTimeConnector(
        epochMilliseconds,
        "UTC",
        locale,
        dayLabel,
        timeStyle,
      ),
    );
  } catch {
    return "";
  }
}
