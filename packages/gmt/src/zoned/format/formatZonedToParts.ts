import type { DateTimeFormatOptions } from "../../types";
import { isValidZonedDateTime } from "../validate";
import { zonedDateTimeFrom } from "../../internal";

// ECMA-402 GetDateTimeFormat (as amended by TC39 Temporal), requiredOptions
// for `~any~`: when none of these nor dateStyle/timeStyle is given, the
// ZonedDateTime format (`~any~, ~zoned-date-time~`) sets every DEFAULT_FIELDS
// entry to "numeric" and timeZoneName to "short" unless the caller gave one.
// `era` and `timeZoneName` are deliberately absent from REQUIRED_FIELDS.
const REQUIRED_FIELDS = [
  "weekday",
  "year",
  "month",
  "day",
  "dayPeriod",
  "hour",
  "minute",
  "second",
  "fractionalSecondDigits",
] as const;

const DEFAULT_FIELDS = {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
} as const;

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
 * - With no date/time field and no `dateStyle`/`timeStyle`, year, month, day,
 *   hour, minute and second default to `"numeric"` and `timeZoneName` to
 *   `"short"` unless given (ECMA-402 as amended by Temporal), so the parts
 *   rebuild exactly what `Temporal.ZonedDateTime#toLocaleString` returns for
 *   the same value.
 * - Before the day period, `en-US` has used U+202F NARROW NO-BREAK SPACE since CLDR 42 (ICU 72), not
 *   an ordinary space; the examples write it as `"\u202f"` so the difference is visible.
 * - Returns `[]` for invalid input.
 * - **Compatibility:** before 1.16.0 a call with no field options returned only the date parts, with
 *   no time zone name. Pass `{ year: "numeric", month: "numeric", day: "numeric" }` to keep that output.
 *
 * @param value zoned ISO 8601 datetime string
 * @param locale optional locale tag (e.g. "en-US")
 * @param options optional Intl.DateTimeFormatOptions
 * @returns array of `{ type, value }` parts, or `[]` on invalid input
 *
 * @example formatZonedToParts("2024-03-15T14:30:00.000-04:00[America/New_York]", "en-US") // [{ type: "month", value: "3" }, { type: "literal", value: "/" }, { type: "day", value: "15" }, { type: "literal", value: "/" }, { type: "year", value: "2024" }, { type: "literal", value: ", " }, { type: "hour", value: "2" }, { type: "literal", value: ":" }, { type: "minute", value: "30" }, { type: "literal", value: ":" }, { type: "second", value: "00" }, { type: "literal", value: "\u202f" }, { type: "dayPeriod", value: "PM" }, { type: "literal", value: " " }, { type: "timeZoneName", value: "EDT" }]
 * @example formatZonedToParts("2024-03-15T14:30:00.000-04:00[America/New_York]", "en-US", { timeZoneName: "longOffset" }) // [{ type: "month", value: "3" }, { type: "literal", value: "/" }, { type: "day", value: "15" }, { type: "literal", value: "/" }, { type: "year", value: "2024" }, { type: "literal", value: ", " }, { type: "hour", value: "2" }, { type: "literal", value: ":" }, { type: "minute", value: "30" }, { type: "literal", value: ":" }, { type: "second", value: "00" }, { type: "literal", value: "\u202f" }, { type: "dayPeriod", value: "PM" }, { type: "literal", value: " " }, { type: "timeZoneName", value: "GMT-04:00" }]
 * @example formatZonedToParts("2024-03-15T14:30:00.000-04:00[America/New_York]", "en-US", { year: "numeric", month: "numeric", day: "numeric" }) // [{ type: "month", value: "3" }, { type: "literal", value: "/" }, { type: "day", value: "15" }, { type: "literal", value: "/" }, { type: "year", value: "2024" }] — the pre-1.16.0 default
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
    const zonedDateTime = zonedDateTimeFrom(value);
    const needDefaults =
      options?.dateStyle === undefined &&
      options?.timeStyle === undefined &&
      REQUIRED_FIELDS.every((field) => options?.[field] === undefined);
    // Defaults spread after the caller's options: needDefaults guarantees
    // every default field is undefined there, even when present as a key.
    const formatter = new Intl.DateTimeFormat(locale, {
      ...options,
      ...(needDefaults
        ? {
            ...DEFAULT_FIELDS,
            timeZoneName: options?.timeZoneName ?? "short",
          }
        : {}),
      timeZone: options?.timeZone ?? zonedDateTime.timeZoneId,
    });
    return formatter
      .formatToParts(zonedDateTime.epochMilliseconds)
      .map((p) => ({ type: p.type, value: p.value }));
  } catch {
    return [];
  }
}
