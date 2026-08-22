import { Temporal } from "@js-temporal/polyfill";
import { isValidDateTime } from "../validate";

/**
 * Return the locale-formatted parts of a PlainDateTime.
 *
 * - This is GMT's substitute for a token formatter (Luxon `toFormat`, date-fns
 *   `format`). A token pattern hard-codes field order and ships US ordering to
 *   every locale; `formatToParts` gives the caller full control over presentation
 *   while the *locale* keeps control of order. See Decision 1 in
 *   `context/roadmap/issues/J.md`.
 * - Each part is `{ type, value }` where `type` can be:
 *   `"era"`, `"year"`, `"month"`, `"day"`, `"weekday"`, `"hour"`,
 *   `"minute"`, `"second"`, `"fractionalSecond"`, `"dayPeriod"`, `"literal"`.
 * - The caller should iterate the array as returned; reassembling in a fixed
 *   order reintroduces exactly the bug `formatToParts` exists to avoid.
 * - Returns `[]` for invalid input.
 *
 * @param value ISO PlainDateTime string
 * @param locale optional BCP 47 locale identifier
 * @param options optional Intl.DateTimeFormatOptions
 * @returns array of `{ type, value }` parts, or `[]` on invalid input
 *
 * @example formatDateTimeToParts("2024-03-15T14:30:00", "en-US") // [{ type: "month", value: "3" }, { type: "literal", value: "/" }, { type: "day", value: "15" }, { type: "literal", value: "/" }, { type: "year", value: "2024" }, { type: "literal", value: "," }, { type: "literal", value: " " }, { type: "hour", value: "2" }, { type: "literal", value: ":" }, { type: "minute", value: "30" }, { type: "literal", value: " " }, { type: "dayPeriod", value: "PM" }]
 * @example formatDateTimeToParts("2024-03-15T14:30:00", "de-DE") // [{ type: "day", value: "15" }, { type: "literal", value: "." }, { type: "month", value: "3" }, { type: "literal", value: "." }, { type: "year", value: "2024" }, { type: "literal", value: "," }, { type: "literal", value: " " }, { type: "hour", value: "14" }, { type: "literal", value: ":" }, { type: "minute", value: "30" }]
 * @example formatDateTimeToParts("invalid") // []
 */
export function formatDateTimeToParts(
  value: string,
  locale?: string,
  options?: Intl.DateTimeFormatOptions,
): Array<{ type: string; value: string }> {
  if (!isValidDateTime(value)) {
    return [];
  }

  try {
    // Temporal.PlainDateTime has no formatToParts of its own — anchor it to
    // an instant in UTC and hand that to Intl.DateTimeFormat, which does the
    // part-level locale work. UTC is arbitrary but stable: a plain date-time
    // has no zone, so any fixed zone reproduces the same clock fields.
    const epochMilliseconds =
      Temporal.PlainDateTime.from(value).toZonedDateTime(
        "UTC",
      ).epochMilliseconds;
    const formatter = new Intl.DateTimeFormat(locale, {
      ...options,
      timeZone: "UTC",
    });
    return formatter
      .formatToParts(epochMilliseconds)
      .map((p) => ({ type: p.type, value: p.value }));
  } catch {
    return [];
  }
}
