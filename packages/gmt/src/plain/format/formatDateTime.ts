import { Temporal } from "@js-temporal/polyfill";
import { normalizeDateTime } from "../../internal";
import { plainDateTimeFormatOptions } from "../../internal/plainFormatOptions";
import type { DateTimeFormatOptions } from "../../types";
import { isValidDateTime } from "../validate";

/**
 * Return a localized string for a PlainDateTime ISO input using Intl options.
 *
 * - Formats as Temporal's ECMA-402 PlainDateTime format (`PlainDateTime#toLocaleString`) does,
 *   through the runtime's `Intl.DateTimeFormat`: the requested fields and style widths are kept,
 *   `era` alone still gets the date and time defaults, and `timeZoneName` is ignored.
 * - **Compatibility:** before 1.16.0 some locales and calendars lost a requested width, a
 *   `long`/`full` `timeStyle` replaced the `dateStyle` width (`{ dateStyle: "short", timeStyle:
 *   "full" }` gave `"2/3/2024, 2:30:45 PM"`), `era` alone dropped the time, and `timeZoneName`
 *   alone returned `""`. Pass the fields the old text showed to keep it.
 * - Accepts optional BCP 47 locale and Intl.DateTimeFormatOptions.
 * - Returns "" for invalid input.
 * - Output is normalized: dash separators become ASCII "-" (unspaced between digits, spaced
 *   otherwise), and no-break, narrow and thin spaces become U+0020.
 * - `options` null returns `""`, as ECMA-402's CoerceOptionsToObject rejects it. Any
 *   other non-object — a string, a number, a boolean — formats with the defaults, as
 *   `Intl.DateTimeFormat` does: CoerceOptionsToObject calls ToObject on it and the wrapper
 *   carries no recognised option. Only `null` and `undefined` are special-cased.
 *
 * @param value ISO PlainDateTime string
 * @param locale optional BCP 47 locale identifier (default: runtime default), or a preference list of tags (ECMA-402)
 * @param options optional Intl.DateTimeFormatOptions
 * @returns localized date-time string or "" on invalid input
 *
 * @example formatDateTime("2024-03-15T14:30:00", "en-US", { dateStyle: "medium", timeStyle: "short" }) // "Mar 15, 2024, 2:30 PM"
 * @example formatDateTime("2024-03-15T14:30:00", "en-US", { dateStyle: "long", timeStyle: "short" }) // "March 15, 2024 at 2:30 PM"
 * @example formatDateTime("2024-03-15T14:30:00", "de-DE", { dateStyle: "medium", timeStyle: "short" }) // "15.03.2024, 14:30"
 * @example formatDateTime("2024-02-03T14:30:45", "en-US", { dateStyle: "short", timeStyle: "full" }) // "2/3/24, 2:30:45 PM"
 * @example formatDateTime("2024-02-03T14:30:45", "en-US", { year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }) // "2/3/2024, 2:30:45 PM" — the pre-1.16.0 text
 * @example formatDateTime("2024-02-03T14:30:45", "en-US", { era: "long" }) // "2/3/2024 Anno Domini, 2:30:45 PM"
 * @example formatDateTime("2024-02-03T14:30:45", "en-US", { era: "long", year: "numeric", month: "numeric", day: "numeric" }) // "2/3/2024 Anno Domini" — the pre-1.16.0 text
 * @example formatDateTime("invalid") // ""
 * @example formatDateTime("2024-02-03T14:30:45", ["fr-FR", "en-US"], { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) // "03/02/2024 14:30"
 */
export function formatDateTime(
  value: string,
  locale?: string | string[],
  options?: DateTimeFormatOptions,
): string {
  if (!isValidDateTime(value)) {
    return "";
  }

  try {
    // The runtime's Intl.DateTimeFormat formats the value's instant at the UTC
    // anchor with the options Temporal's PlainDateTime format resolves to
    // (GetDateTimeFormat ~any~, ~all~, ~relevant~), so the requested fields
    // and style widths are kept. Constructing with the caller's options first
    // surfaces the TypeError or RangeError Intl.DateTimeFormat raises for
    // invalid ones.
    new Intl.DateTimeFormat(locale, options);
    const epochMilliseconds =
      Temporal.PlainDateTime.from(value).toZonedDateTime(
        "UTC",
      ).epochMilliseconds;
    return normalizeDateTime(
      new Intl.DateTimeFormat(
        locale,
        plainDateTimeFormatOptions(options ?? {}),
      ).format(epochMilliseconds),
    );
  } catch {
    return "";
  }
}
