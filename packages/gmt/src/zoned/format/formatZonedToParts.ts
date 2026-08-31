import { Temporal } from "@js-temporal/polyfill";
import type { DateTimeFormatOptions } from "../../types";
import { isValidZonedDateTime } from "../validate";

/**
 * Return the locale-formatted parts of a ZonedDateTime.
 *
 * - This is GMT's substitute for a token formatter (Luxon `toFormat`, date-fns
 *   `format`). A token pattern hard-codes field order and ships US ordering to
 *   every locale; `formatToParts` gives the caller full control over presentation
 *   while the *locale* keeps control of order. See Decision 1 in
 *   `context/roadmap/issues/J.md`.
 * - Each part is `{ type, value }` where `type` can be:
 *   `"era"`, `"year"`, `"month"`, `"day"`, `"weekday"`, `"hour"`,
 *   `"minute"`, `"second"`, `"fractionalSecond"`, `"dayPeriod"`,
 *   `"timeZoneName"`, `"literal"`.
 * - The caller should iterate the array as returned; reassembling in a fixed
 *   order reintroduces exactly the bug `formatToParts` exists to avoid.
 * - Returns `[]` for invalid input.
 *
 * @param value zoned ISO 8601 datetime string
 * @param locale optional locale tag (e.g. "en-US")
 * @param options optional Intl.DateTimeFormatOptions
 * @returns array of `{ type, value }` parts, or `[]` on invalid input
 *
 * @example formatZonedToParts("2024-03-15T14:30:00.000-04:00[America/New_York]", "en-US") // [{ type: "month", value: "3" }, { type: "literal", value: "/" }, { type: "day", value: "15" }, { type: "literal", value: "/" }, { type: "year", value: "2024" }, { type: "literal", value: "," }, { type: "literal", value: " " }, { type: "hour", value: "2" }, { type: "literal", value: ":" }, { type: "minute", value: "30" }, { type: "literal", value: " " }, { type: "dayPeriod", value: "PM" }]
 * @example formatZonedToParts("2024-03-15T14:30:00.000-04:00[America/New_York]", "en-US", { timeZoneName: "longOffset" }) // includes { type: "timeZoneName", value: "GMT-4" }
 * @example formatZonedToParts("invalid", "en-US") // []
 */
export function formatZonedToParts(
  value: string,
  locale?: string,
  options?: DateTimeFormatOptions,
): Array<{ type: string; value: string }> {
  if (!isValidZonedDateTime(value)) {
    return [];
  }

  try {
    // Intl.DateTimeFormat cannot format a Temporal.ZonedDateTime directly —
    // pass its instant (epochMilliseconds) and its own IANA zone as the
    // formatter's timeZone, mirroring formatTimeZoneName's approach.
    const zonedDateTime = Temporal.ZonedDateTime.from(value);
    const formatter = new Intl.DateTimeFormat(locale, {
      timeZone: zonedDateTime.timeZoneId,
      ...options,
    });
    return formatter
      .formatToParts(zonedDateTime.epochMilliseconds)
      .map((p) => ({ type: p.type, value: p.value }));
  } catch {
    return [];
  }
}
