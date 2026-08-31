import { Temporal } from "@js-temporal/polyfill";
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
 * - Returns `[]` for invalid input.
 *
 * @param value ISO PlainDate string
 * @param locale optional BCP 47 locale identifier (default: runtime default)
 * @param options optional Intl.DateTimeFormatOptions
 * @returns array of `{ type, value }` parts, or `[]` on invalid input
 *
 * @example formatDateToParts("2024-03-15", "en-US") // [{ type: "month", value: "3" }, { type: "literal", value: "/" }, { type: "day", value: "15" }, { type: "literal", value: "/" }, { type: "year", value: "2024" }]
 * @example formatDateToParts("2024-03-15", "de-DE") // [{ type: "day", value: "15" }, { type: "literal", value: "." }, { type: "month", value: "3" }, { type: "literal", value: "." }, { type: "year", value: "2024" }]
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
    // Temporal.PlainDate has no formatToParts of its own — anchor it to an
    // instant in UTC (midnight) and hand that to Intl.DateTimeFormat, which
    // does the part-level locale work. UTC is arbitrary but stable: a plain
    // date has no zone, so any fixed zone reproduces the same date fields.
    const epochMilliseconds =
      Temporal.PlainDate.from(value).toZonedDateTime("UTC").epochMilliseconds;
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
