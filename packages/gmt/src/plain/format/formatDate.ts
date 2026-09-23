import { Temporal } from "@js-temporal/polyfill";
import { normalizeDateTime } from "../../internal";
import { plainDateFormatOptions } from "../../internal/plainFormatOptions";
import type { DateTimeFormatOptions } from "../../types";
import { isValidDate } from "../validate";

/**
 * Return a localized string for a PlainDate ISO input using Intl options.
 *
 * - Formats as Temporal's ECMA-402 PlainDate format (`PlainDate#toLocaleString`) does, through
 *   the runtime's `Intl.DateTimeFormat`: the requested fields and widths are kept, and
 *   `timeZoneName` is ignored (a PlainDate has no zone).
 * - Accepts optional BCP 47 locale and Intl.DateTimeFormatOptions.
 * - Returns "" for invalid input, for a `timeStyle` (with or without `dateStyle`) and for only
 *   time fields, where `PlainDate#toLocaleString` throws a TypeError.
 * - **Compatibility:** before 1.16.0 some locales and calendars lost a requested width (ja-JP with
 *   the japanese calendar and `month: "long"` gave `"R6/2"`), `timeZoneName` alone returned `""`,
 *   and a `timeStyle` beside `dateStyle` was ignored. Pass the numeric fields to keep the numeric
 *   text, and pass only `dateStyle` to keep the styled text.
 * - `options` null returns `""`, as ECMA-402's CoerceOptionsToObject rejects it. Any
 *   other non-object — a string, a number, a boolean — formats with the defaults, as
 *   `Intl.DateTimeFormat` does: CoerceOptionsToObject calls ToObject on it and the wrapper
 *   carries no recognised option. Only `null` and `undefined` are special-cased.
 *
 * @param value ISO PlainDate string
 * @param locale optional BCP 47 locale identifier (default: runtime default), or a preference list of tags (ECMA-402)
 * @param options optional Intl.DateTimeFormatOptions
 * @returns localized date string or "" on invalid input
 *
 * @example formatDate("2024-03-15", "en-US", { year: "numeric", month: "long", day: "numeric" }) // "March 15, 2024"
 * @example formatDate("2024-03-15", "de-DE", { year: "numeric", month: "long", day: "numeric" }) // "15. März 2024"
 * @example formatDate("2024-02-03", "ja-JP-u-ca-japanese", { year: "numeric", month: "long" }) // "令和6年2月"
 * @example formatDate("2024-02-03", "ja-JP-u-ca-japanese", { year: "numeric", month: "numeric" }) // "R6/2" — the pre-1.16.0 text
 * @example formatDate("2024-02-03", "en-US", { timeZoneName: "long" }) // "2/3/2024"
 * @example formatDate("2024-02-03", "en-US", { dateStyle: "short", timeStyle: "short" }) // "" — a PlainDate has no time
 * @example formatDate("2024-02-03", "en-US", { dateStyle: "short" }) // "2/3/24" — the pre-1.16.0 text
 * @example formatDate("invalid") // ""
 * @example formatDate("2024-02-03", ["fr-FR", "en-US"], { year: "numeric", month: "2-digit", day: "2-digit" }) // "03/02/2024" (the first listed locale)
 */
export function formatDate(
  value: string,
  locale?: string | string[],
  options?: DateTimeFormatOptions,
): string {
  if (!isValidDate(value)) {
    return "";
  }

  try {
    // The runtime's Intl.DateTimeFormat formats the date's instant at the UTC
    // anchor with the options Temporal's PlainDate format resolves to
    // (CreateDateTimeFormat ~date~, ~date~), so the requested fields and
    // widths are kept. Constructing with the caller's options first surfaces
    // the TypeError or RangeError Intl.DateTimeFormat raises for invalid ones.
    new Intl.DateTimeFormat(locale, options);
    // CreateDateTimeFormat: required ~date~ with a timeStyle is a TypeError.
    if (options?.timeStyle !== undefined) {
      return "";
    }
    const resolved = plainDateFormatOptions(options ?? {});
    if (resolved === null) {
      return "";
    }
    const epochMilliseconds =
      Temporal.PlainDate.from(value).toZonedDateTime("UTC").epochMilliseconds;
    return normalizeDateTime(
      new Intl.DateTimeFormat(locale, resolved).format(epochMilliseconds),
    );
  } catch {
    return "";
  }
}
