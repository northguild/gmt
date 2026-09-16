import { Temporal } from "@js-temporal/polyfill";
import { plainDateFormatOptions } from "../../internal/plainFormatOptions";
import type { DateTimeFormatOptions } from "../../types";
import { isValidDate } from "../validate";

/**
 * Return the locale-formatted parts of a PlainDate.
 *
 * - This is GMT's substitute for a token formatter (Luxon `toFormat`, date-fns
 *   `format`). A token pattern hard-codes field order and ships US ordering to
 *   every locale; `formatToParts` gives the caller full control over presentation
 *   while the *locale* keeps control of order. See Decision 1 in
 *   `context/roadmap/issues/J.md`.
 * - Each part is `{ type, value }` where `type` is one of:
 *   `"era"`, `"year"`, `"month"`, `"day"`, `"weekday"`, `"literal"`.
 * - The caller should iterate the array as returned; reassembling in a fixed
 *   order reintroduces exactly the bug `formatToParts` exists to avoid.
 * - A PlainDate has no time or zone, so no `hour`/`minute`/`second`/`dayPeriod`/`timeZoneName`
 *   part is ever returned, following Temporal's ECMA-402 PlainDate format: `timeStyle` without
 *   `dateStyle`, or only time fields, yields `[]` (as `formatDate` yields `""`); with `dateStyle`
 *   the `timeStyle` is dropped; `timeZoneName` is ignored.
 * - Returns `[]` for invalid input.
 * - **Compatibility:** before 1.16.0 time options leaked a UTC midnight and a `"UTC"` zone name
 *   into the parts. `formatZonedToParts` on the date at midnight UTC returns those parts.
 *
 * @param value ISO PlainDate string
 * @param locale optional BCP 47 locale identifier (default: runtime default)
 * @param options optional Intl.DateTimeFormatOptions
 * @returns array of `{ type, value }` parts, or `[]` on invalid input
 *
 * @example formatDateToParts("2024-03-15", "en-US") // [{ type: "month", value: "3" }, { type: "literal", value: "/" }, { type: "day", value: "15" }, { type: "literal", value: "/" }, { type: "year", value: "2024" }]
 * @example formatDateToParts("2024-03-15", "de-DE") // [{ type: "day", value: "15" }, { type: "literal", value: "." }, { type: "month", value: "3" }, { type: "literal", value: "." }, { type: "year", value: "2024" }]
 * @example formatDateToParts("2024-02-29", "en-US", { dateStyle: "full", timeStyle: "full" }) // [{ type: "weekday", value: "Thursday" }, { type: "literal", value: ", " }, { type: "month", value: "February" }, { type: "literal", value: " " }, { type: "day", value: "29" }, { type: "literal", value: ", " }, { type: "year", value: "2024" }]
 * @example formatDateToParts("2024-02-29", "en-US", { timeStyle: "long" }) // [] — a PlainDate has no time
 * @example formatZonedToParts("2024-02-29T00:00:00+00:00[UTC]", "en-US", { timeStyle: "long" }) // [{ type: "hour", value: "12" }, { type: "literal", value: ":" }, { type: "minute", value: "00" }, { type: "literal", value: ":" }, { type: "second", value: "00" }, { type: "literal", value: "\u202f" }, { type: "dayPeriod", value: "AM" }, { type: "literal", value: " " }, { type: "timeZoneName", value: "UTC" }] — the pre-1.16.0 parts
 * @example formatDateToParts("invalid") // []
 */
export function formatDateToParts(
  value: string,
  locale?: string,
  options?: DateTimeFormatOptions,
): Array<{ type: string; value: string }> {
  if (!isValidDate(value)) {
    return [];
  }

  try {
    // Temporal.PlainDate has no formatToParts of its own. The runtime's
    // Intl.DateTimeFormat does the part-level locale work on the date's
    // instant at the UTC anchor; the options are first narrowed to what a
    // PlainDate format may contain, so no time or zone field can appear.
    // Constructing with the caller's options first surfaces the TypeError or
    // RangeError Intl.DateTimeFormat raises for invalid ones.
    new Intl.DateTimeFormat(locale, options);
    const resolved = plainDateFormatOptions(options ?? {});
    if (resolved === null) {
      return [];
    }
    const epochMilliseconds =
      Temporal.PlainDate.from(value).toZonedDateTime("UTC").epochMilliseconds;
    return new Intl.DateTimeFormat(locale, resolved)
      .formatToParts(epochMilliseconds)
      .map((p) => ({ type: p.type, value: p.value }));
  } catch {
    return [];
  }
}
