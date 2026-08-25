import { Temporal } from "@js-temporal/polyfill";
import { hasCalendarAnnotation } from "../../internal";
import { isLeapSecond } from "../../plain/validate/isLeapSecond";

/**
 * Validate whether a string is a valid ISO 8601 zoned datetime string.
 *
 * - Uses Temporal.ZonedDateTime.from for validation.
 * - Rejects leap seconds.
 * - Rejects any `[u-ca=...]` calendar annotation (E5 issue #78, decision of record D2):
 *   calendar-system awareness is confined to `plain/` `PlainDate` values (D1) — `zoned/`
 *   previously accepted the annotation by accident (nothing gated it) and did genuinely
 *   calendar-aware but undocumented, untested arithmetic; this closes that rather than
 *   blessing it. See `context/roadmap/issues/E.md`'s E5 section for the follow-up story
 *   proposal to extend `zoned/` with a GMT-shape annotated string deliberately.
 * - Returns false for non-strings or empty strings.
 *
 * @param value candidate zoned datetime string
 * @returns boolean indicating validity
 *
 * @example isValidZonedDateTime("2024-02-29T12:34:56.789+00:00[UTC]") // true
 * @example isValidZonedDateTime("2024-06-30T23:59:60+00:00[UTC]") // false (leap second)
 * @example isValidZonedDateTime("2024-02-10T12:00:00-05:00[America/New_York][u-ca=hebrew]") // false (calendar annotation rejected)
 * @example isValidZonedDateTime("invalid") // false
 */
export function isValidZonedDateTime(value: string): boolean {
  if (typeof value !== "string" || value.length === 0) {
    return false;
  }

  if (isLeapSecond(value) || hasCalendarAnnotation(value)) {
    return false;
  }

  try {
    const zonedDateTime = Temporal.ZonedDateTime.from(value);
    return zonedDateTime.timeZoneId.length > 0;
  } catch {
    return false;
  }
}
