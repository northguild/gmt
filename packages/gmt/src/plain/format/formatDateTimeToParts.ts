import { Temporal } from "@js-temporal/polyfill";
import { plainDateTimeFormatOptions } from "../../internal/plainFormatOptions";
import type { DateTimeFormatOptions } from "../../types";
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
 * - With no date/time field and no `dateStyle`/`timeStyle`, year, month, day,
 *   hour, minute and second default to `"numeric"` (ECMA-402 as amended by
 *   Temporal), so the parts rebuild exactly what
 *   `Temporal.PlainDateTime#toLocaleString` returns for the same value.
 * - A zoneless value never yields a `"timeZoneName"` part (Temporal's PlainDateTime format has no
 *   zone field): a `timeZoneName` option is ignored, and a `"long"`/`"full"` `timeStyle` keeps its
 *   hour, minute and second and drops the zone, formatting as the locale's `"medium"` time. As in
 *   `Intl.DateTimeFormat`, `timeZoneName` together with `dateStyle`/`timeStyle` yields `[]`.
 * - Before the day period, `en-US` has used U+202F NARROW NO-BREAK SPACE since CLDR 42 (ICU 72), not
 *   an ordinary space; the examples write it as `"\u202f"` so the difference is visible.
 * - Returns `[]` for invalid input.
 * - **Compatibility:** before 1.16.0 a call with no field options returned only the date parts.
 *   Pass `{ year: "numeric", month: "numeric", day: "numeric" }` to keep that output.
 * - **Compatibility:** before 1.16.0 a `"long"`/`"full"` `timeStyle` added the internal UTC anchor
 *   as a `timeZoneName` part. `formatZonedToParts` on the value at UTC returns those parts.
 *
 * @param value ISO PlainDateTime string
 * @param locale optional BCP 47 locale identifier (default: runtime default)
 * @param options optional Intl.DateTimeFormatOptions
 * @returns array of `{ type, value }` parts, or `[]` on invalid input
 *
 * @example formatDateTimeToParts("2024-03-15T14:30:00", "en-US") // [{ type: "month", value: "3" }, { type: "literal", value: "/" }, { type: "day", value: "15" }, { type: "literal", value: "/" }, { type: "year", value: "2024" }, { type: "literal", value: ", " }, { type: "hour", value: "2" }, { type: "literal", value: ":" }, { type: "minute", value: "30" }, { type: "literal", value: ":" }, { type: "second", value: "00" }, { type: "literal", value: "\u202f" }, { type: "dayPeriod", value: "PM" }]
 * @example formatDateTimeToParts("2024-03-15T14:30:00", "de-DE") // [{ type: "day", value: "15" }, { type: "literal", value: "." }, { type: "month", value: "3" }, { type: "literal", value: "." }, { type: "year", value: "2024" }, { type: "literal", value: ", " }, { type: "hour", value: "14" }, { type: "literal", value: ":" }, { type: "minute", value: "30" }, { type: "literal", value: ":" }, { type: "second", value: "00" }]
 * @example formatDateTimeToParts("2024-03-15T14:30:00", "en-US", { year: "numeric", month: "numeric", day: "numeric" }) // [{ type: "month", value: "3" }, { type: "literal", value: "/" }, { type: "day", value: "15" }, { type: "literal", value: "/" }, { type: "year", value: "2024" }] — the pre-1.16.0 default
 * @example formatDateTimeToParts("2024-02-29T12:00:00", "en-US", { timeStyle: "long" }) // [{ type: "hour", value: "12" }, { type: "literal", value: ":" }, { type: "minute", value: "00" }, { type: "literal", value: ":" }, { type: "second", value: "00" }, { type: "literal", value: "\u202f" }, { type: "dayPeriod", value: "PM" }]
 * @example formatZonedToParts("2024-02-29T12:00:00+00:00[UTC]", "en-US", { timeStyle: "long" }) // [{ type: "hour", value: "12" }, { type: "literal", value: ":" }, { type: "minute", value: "00" }, { type: "literal", value: ":" }, { type: "second", value: "00" }, { type: "literal", value: "\u202f" }, { type: "dayPeriod", value: "PM" }, { type: "literal", value: " " }, { type: "timeZoneName", value: "UTC" }] — the pre-1.16.0 parts
 * @example formatDateTimeToParts("invalid") // []
 */
export function formatDateTimeToParts(
  value: string,
  locale?: string,
  options?: DateTimeFormatOptions,
): Array<{ type: string; value: string }> {
  if (!isValidDateTime(value)) {
    return [];
  }

  try {
    // Temporal.PlainDateTime has no formatToParts of its own. The runtime's
    // Intl.DateTimeFormat does the part-level locale work on the value's
    // instant at the UTC anchor; the options are first narrowed to what a
    // PlainDateTime format may contain, so no zone field can appear.
    // Constructing with the caller's options first surfaces the TypeError or
    // RangeError Intl.DateTimeFormat raises for invalid ones.
    new Intl.DateTimeFormat(locale, options);
    const epochMilliseconds =
      Temporal.PlainDateTime.from(value).toZonedDateTime(
        "UTC",
      ).epochMilliseconds;
    return new Intl.DateTimeFormat(
      locale,
      plainDateTimeFormatOptions(options ?? {}),
    )
      .formatToParts(epochMilliseconds)
      .map((p) => ({ type: p.type, value: p.value }));
  } catch {
    return [];
  }
}
