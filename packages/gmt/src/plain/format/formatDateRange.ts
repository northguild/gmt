import { Temporal } from "@js-temporal/polyfill";
import { normalizeDateTime } from "../../internal";
import { plainDateFormatOptions } from "../../internal/plainFormatOptions";
import type { DateTimeFormatOptions } from "../../types";
import { isValidDate } from "../validate";

/**
 * Format a plain date range using the Temporal Intl.DateTimeFormat formatRange API.
 *
 * - Plain counterpart of `formatZonedRange` — same parameter order and option shape.
 * - Uses Temporal.PlainDate.from for both endpoints; no timezone is involved.
 * - Formats as Temporal's ECMA-402 PlainDate format does, through the runtime's
 *   `Intl.DateTimeFormat#formatRange`: `timeZoneName` is ignored, and a `timeStyle` without
 *   `dateStyle`, or only time fields, returns `""`.
 * - **Compatibility:** before 1.16.0 `timeZoneName` alone returned `""`; only that sentinel
 *   became a value.
 * - Locale elides shared fields between `start` and `end` (e.g. same month/year).
 * - Returns "" for invalid input on either endpoint.
 * - Output is normalized: dash separators become ASCII "-" (unspaced between digits, spaced
 *   otherwise), and no-break, narrow and thin spaces become U+0020.
 *
 * @param start ISO PlainDate string (range start)
 * @param end ISO PlainDate string (range end)
 * @param locale optional locale tag (default: runtime default)
 * @param options optional Intl.DateTimeFormatOptions
 * @returns localized range string or "" when invalid
 *
 * @example formatDateRange("2024-02-03", "2024-02-05", "en-US", { dateStyle: "long" }) // "February 3 - 5, 2024"
 * @example formatDateRange("2024-02-03", "2024-06-10", "en-US", { dateStyle: "long" }) // "February 3 - June 10, 2024"
 * @example formatDateRange("2024-02-03", "2024-02-05", "en-US", { timeZoneName: "short" }) // "2/3/2024 - 2/5/2024"
 * @example formatDateRange("invalid", "2024-02-05", "en-US") // "" (invalid input)
 */
export function formatDateRange(
  start: string,
  end: string,
  locale?: string,
  options?: DateTimeFormatOptions,
): string {
  if (!isValidDate(start) || !isValidDate(end)) {
    return "";
  }

  try {
    // The runtime's Intl.DateTimeFormat formats both dates' instants at the
    // UTC anchor with the options Temporal's PlainDate format resolves to
    // (GetDateTimeFormat ~date~, ~date~, ~relevant~). Constructing with the
    // caller's options first surfaces the TypeError or RangeError
    // Intl.DateTimeFormat raises for invalid ones.
    new Intl.DateTimeFormat(locale, options);
    const resolved = plainDateFormatOptions(options ?? {});
    if (resolved === null) {
      return "";
    }
    const out = new Intl.DateTimeFormat(locale, resolved).formatRange(
      Temporal.PlainDate.from(start).toZonedDateTime("UTC").epochMilliseconds,
      Temporal.PlainDate.from(end).toZonedDateTime("UTC").epochMilliseconds,
    );
    return normalizeDateTime(out);
  } catch {
    return "";
  }
}
