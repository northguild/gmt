import { Temporal } from "@js-temporal/polyfill";
import { normalizeDateTime } from "../../internal";
import { plainDateTimeFormatOptions } from "../../internal/plainFormatOptions";
import type { DateTimeFormatOptions } from "../../types";
import { isValidDateTime } from "../validate";

/**
 * Format a plain datetime range using the Temporal Intl.DateTimeFormat formatRange API.
 *
 * - Plain counterpart of `formatZonedRange` — same parameter order and option shape.
 * - Uses Temporal.PlainDateTime.from for both endpoints; no timezone is involved.
 * - Formats as Temporal's ECMA-402 PlainDateTime format does, through the runtime's
 *   `Intl.DateTimeFormat#formatRange`: the requested fields and style widths are kept, `era`
 *   alone still gets the date and time defaults, and `timeZoneName` is ignored.
 * - **Compatibility:** before 1.16.0 some locales lost a requested width (zh-CN with
 *   `{ year: "numeric", month: "long" }` gave `"2024/2"`), `era` alone dropped the time, and
 *   `timeZoneName` alone returned `""`. Pass the fields the old text showed to keep it.
 * - Locale elides shared fields between `start` and `end` (e.g. same day/month/year).
 * - Returns "" for invalid input on either endpoint.
 * - Output is normalized: dash separators become ASCII "-" (unspaced between digits, spaced
 *   otherwise), and no-break, narrow and thin spaces become U+0020.
 * - `options` null returns `""`, as ECMA-402's CoerceOptionsToObject rejects it. Any
 *   other non-object — a string, a number, a boolean — formats with the defaults, as
 *   `Intl.DateTimeFormat` does: CoerceOptionsToObject calls ToObject on it and the wrapper
 *   carries no recognised option. Only `null` and `undefined` are special-cased.
 *
 * @param start ISO PlainDateTime string (range start)
 * @param end ISO PlainDateTime string (range end)
 * @param locale optional locale tag (default: runtime default), or a preference list of tags (ECMA-402)
 * @param options optional Intl.DateTimeFormatOptions
 * @returns localized range string or "" when invalid
 *
 * @example formatDateTimeRange("2024-02-03T09:00:00", "2024-02-03T17:00:00", "en-US", { dateStyle: "long", timeStyle: "short" }) // "February 3, 2024, 9:00 AM - 5:00 PM"
 * @example formatDateTimeRange("2024-02-03T09:00:00", "2024-02-10T17:00:00", "en-US", { dateStyle: "long", timeStyle: "short" }) // "February 3, 2024 at 9:00 AM - February 10, 2024 at 5:00 PM"
 * @example formatDateTimeRange("2024-02-03T09:00:00", "2024-02-03T17:00:00", "zh-CN", { year: "numeric", month: "long" }) // "2024年2月"
 * @example formatDateTimeRange("2024-02-03T09:00:00", "2024-02-03T17:00:00", "zh-CN", { year: "numeric", month: "numeric" }) // "2024/2" — the pre-1.16.0 text
 * @example formatDateTimeRange("2024-02-03T09:00:00", "2024-02-03T17:00:00", "en-US", { era: "long" }) // "2/3/2024 Anno Domini, 9:00:00 AM - 5:00:00 PM"
 * @example formatDateTimeRange("invalid", "2024-02-03T17:00:00", "en-US") // "" (invalid input)
 * @example formatDateTimeRange("2024-02-03T14:30:45", "2024-02-03T16:46:15", ["fr-FR", "en-US"], { hour: "numeric", minute: "numeric" }) // "14:30 - 16:46"
 */
export function formatDateTimeRange(
  start: string,
  end: string,
  locale?: string | string[],
  options?: DateTimeFormatOptions,
): string {
  if (!isValidDateTime(start) || !isValidDateTime(end)) {
    return "";
  }

  try {
    // The runtime's Intl.DateTimeFormat formats both values' instants at the
    // UTC anchor with the options Temporal's PlainDateTime format resolves to
    // (GetDateTimeFormat ~any~, ~all~, ~relevant~). Constructing with the
    // caller's options first surfaces the TypeError or RangeError
    // Intl.DateTimeFormat raises for invalid ones.
    new Intl.DateTimeFormat(locale, options);
    const out = new Intl.DateTimeFormat(
      locale,
      plainDateTimeFormatOptions(options ?? {}),
    ).formatRange(
      Temporal.PlainDateTime.from(start).toZonedDateTime("UTC")
        .epochMilliseconds,
      Temporal.PlainDateTime.from(end).toZonedDateTime("UTC").epochMilliseconds,
    );
    return normalizeDateTime(out);
  } catch {
    return "";
  }
}
