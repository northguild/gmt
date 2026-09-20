import type { DateTimeFormatOptions } from "../../types";
import { isValidZonedDateTime } from "../validate";
import { zonedDateTimeFrom } from "../../internal";
import { instantFormatOptions } from "../../internal/instantFormatOptions";

/**
 * Return the locale-formatted parts of a ZonedDateTime.
 *
 * - This is GMT's substitute for a token formatter (Luxon `toFormat`, date-fns
 *   `format`). A token pattern hard-codes field order and ships US ordering to
 *   every locale; `formatToParts` gives the caller full control over presentation
 *   while the *locale* keeps control of order. See Decision 1 in
 *   `context/roadmap/issues/J.md`.
 * - Each part is `{ type, value }` where `type` can be:
 *   `"era"`, `"year"`, `"relatedYear"`, `"yearName"`, `"month"`, `"day"`, `"weekday"`,
 *   `"hour"`, `"minute"`, `"second"`, `"fractionalSecond"`, `"dayPeriod"`,
 *   `"timeZoneName"`, `"literal"`.
 * - A lunisolar calendar adds two more: `zh-u-ca-chinese` and `ko-u-ca-dangi` emit
 *   `"relatedYear"` (the Gregorian year the cycle falls in) and `"yearName"` (the sexagenary
 *   cycle name) in place of, or beside, `"year"`. Code that looks up a `"year"` part must handle
 *   their absence.
 * - The caller should iterate the array as returned; reassembling in a fixed
 *   order reintroduces exactly the bug `formatToParts` exists to avoid.
 * - With no date/time field and no `dateStyle`/`timeStyle`, year, month, day,
 *   hour, minute and second default to `"numeric"` and `timeZoneName` to
 *   `"short"` unless given (ECMA-402 as amended by Temporal). The parts, joined,
 *   are the text `formatZonedDateTime` returns for the same arguments before its
 *   whitespace normalisation.
 * - A ZonedDateTime is formatted in its own zone: a `timeZone` option returns
 *   `[]`, as `ZonedDateTime#toLocaleString` throws a TypeError for one.
 * - Before the day period, `en-US` has used U+202F NARROW NO-BREAK SPACE since CLDR 42 (ICU 72), not
 *   an ordinary space; the examples write it as `"\u202f"` so the difference is visible.
 * - Returns `[]` for invalid input.
 * - **Compatibility:** before 1.16.0 a call with no field options returned only the date parts, with
 *   no time zone name. Pass `{ year: "numeric", month: "numeric", day: "numeric" }` to keep that output.
 *   Before 1.16.0 a `timeZone` option re-rendered the instant in that zone; `formatUtc` with its
 *   `timeZone` option gives that text.
 * - `options` null returns `[]`, as ECMA-402's CoerceOptionsToObject rejects it (a string or number
 *   options value formats with the defaults, as `Intl.DateTimeFormat` does).
 *
 * @param value zoned ISO 8601 datetime string
 * @param locale optional locale tag (e.g. "en-US"), or a preference list of tags (ECMA-402)
 * @param options optional Intl.DateTimeFormatOptions
 * @returns array of `{ type, value }` parts, or `[]` on invalid input
 *
 * @example formatZonedToParts("2024-03-15T14:30:00.000-04:00[America/New_York]", "en-US") // [{ type: "month", value: "3" }, { type: "literal", value: "/" }, { type: "day", value: "15" }, { type: "literal", value: "/" }, { type: "year", value: "2024" }, { type: "literal", value: ", " }, { type: "hour", value: "2" }, { type: "literal", value: ":" }, { type: "minute", value: "30" }, { type: "literal", value: ":" }, { type: "second", value: "00" }, { type: "literal", value: "\u202f" }, { type: "dayPeriod", value: "PM" }, { type: "literal", value: " " }, { type: "timeZoneName", value: "EDT" }]
 * @example formatZonedToParts("2024-03-15T14:30:00.000-04:00[America/New_York]", "en-US", { timeZoneName: "longOffset" }) // [{ type: "month", value: "3" }, { type: "literal", value: "/" }, { type: "day", value: "15" }, { type: "literal", value: "/" }, { type: "year", value: "2024" }, { type: "literal", value: ", " }, { type: "hour", value: "2" }, { type: "literal", value: ":" }, { type: "minute", value: "30" }, { type: "literal", value: ":" }, { type: "second", value: "00" }, { type: "literal", value: "\u202f" }, { type: "dayPeriod", value: "PM" }, { type: "literal", value: " " }, { type: "timeZoneName", value: "GMT-04:00" }]
 * @example formatZonedToParts("2024-03-15T14:30:00.000-04:00[America/New_York]", "en-US", { year: "numeric", month: "numeric", day: "numeric" }) // [{ type: "month", value: "3" }, { type: "literal", value: "/" }, { type: "day", value: "15" }, { type: "literal", value: "/" }, { type: "year", value: "2024" }] — the pre-1.16.0 default
 * @example formatZonedToParts("2024-03-15T14:30:00.000-04:00[America/New_York]", "en-US", { timeZone: "Asia/Tokyo" }) // [] — a ZonedDateTime keeps its own zone
 * @example formatZonedToParts("invalid", "en-US") // []
 * @example formatZonedToParts("2024-02-03T14:30:45+01:00[Europe/Paris]", ["fr-FR", "en-US"], { dateStyle: "medium", timeStyle: "short" }) // parts of "3 févr. 2024, 14:30"
 * @example formatZonedToParts("2024-02-03T14:30:00-05:00[America/New_York]", "en-US", null as never) // [] (null options, as ECMA-402 rejects them)
 */
export function formatZonedToParts(
  value: string,
  locale?: string | string[],
  options?: DateTimeFormatOptions,
): Array<{ type: string; value: string }> {
  // ECMA-402 CoerceOptionsToObject: null options throw TypeError, so they are invalid input.
  if (options === null) {
    return [];
  }
  if (!isValidZonedDateTime(value)) {
    return [];
  }

  try {
    // Intl.DateTimeFormat cannot format a Temporal.ZonedDateTime directly —
    // pass its instant (epochMilliseconds) and its own IANA zone as the
    // formatter's timeZone, with the options ZonedDateTime#toLocaleString
    // resolves to (GetDateTimeFormat ~any~, ~zoned-date-time~, ~all~).
    const zonedDateTime = zonedDateTimeFrom(value);
    const resolved = instantFormatOptions(
      options ?? {},
      zonedDateTime.timeZoneId,
      "zoned-date-time",
    );
    if (resolved === null) {
      return [];
    }
    return new Intl.DateTimeFormat(locale, resolved)
      .formatToParts(zonedDateTime.epochMilliseconds)
      .map((p) => ({ type: p.type, value: p.value }));
  } catch {
    return [];
  }
}
