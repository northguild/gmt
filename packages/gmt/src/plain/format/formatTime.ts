import { Temporal } from "@js-temporal/polyfill";
import { normalizeDateTime } from "../../internal";
import { plainTimeFormatOptions } from "../../internal/plainFormatOptions";
import type { DateTimeFormatOptions } from "../../types";
import { isValidTime } from "../validate";

/**
 * Return a localized string for a PlainTime ISO input using Intl options.
 *
 * - Formats as Temporal's ECMA-402 PlainTime format (`PlainTime#toLocaleString`) does, through
 *   the runtime's `Intl.DateTimeFormat`. `era` and `timeZoneName` are ignored, so alone they get
 *   the hour, minute and second defaults.
 * - Accepts optional BCP 47 locale and Intl.DateTimeFormatOptions.
 * - Returns "" for invalid input, for a `dateStyle` (with or without `timeStyle`) and for only
 *   date fields, where `PlainTime#toLocaleString` throws a TypeError.
 * - **Compatibility:** before 1.16.0 `era` or `timeZoneName` alone returned `""`, `era` beside a
 *   time field added the era name, and a `dateStyle` beside `timeStyle` was ignored. Pass only
 *   `timeStyle` to keep the styled text.
 * - `options` null returns `""`, as ECMA-402's CoerceOptionsToObject rejects it. Any
 *   other non-object — a string, a number, a boolean — formats with the defaults, as
 *   `Intl.DateTimeFormat` does: CoerceOptionsToObject calls ToObject on it and the wrapper
 *   carries no recognised option. Only `null` and `undefined` are special-cased.
 *
 * @param value ISO PlainTime string
 * @param locale optional BCP 47 locale identifier, or a preference list of tags (ECMA-402)
 * @param options optional Intl.DateTimeFormatOptions
 * @returns localized time string or "" on invalid input
 *
 * @example formatTime("14:30:00", "en-US", { timeStyle: "short" }) // "2:30 PM"
 * @example formatTime("14:30:00", "de-DE", { timeStyle: "short" }) // "14:30"
 * @example formatTime("14:30:45", "en-US", { era: "long" }) // "2:30:45 PM"
 * @example formatTime("14:30:45", "en-US", { dateStyle: "short", timeStyle: "short" }) // "" — a PlainTime has no date
 * @example formatTime("14:30:45", "en-US", { timeStyle: "short" }) // "2:30 PM" — the pre-1.16.0 text
 * @example formatTime("invalid") // ""
 * @example formatTime("14:30:45", ["fr-FR", "en-US"], { hour: "2-digit", minute: "2-digit" }) // "14:30"
 */
export function formatTime(
  value: string,
  locale?: string | string[],
  options?: DateTimeFormatOptions,
): string {
  if (!isValidTime(value)) {
    return "";
  }

  try {
    // The runtime's Intl.DateTimeFormat formats the time at the UTC anchor on
    // 1970-01-01 with the options Temporal's PlainTime format resolves to
    // (CreateDateTimeFormat ~time~, ~time~). Constructing with the caller's
    // options first surfaces the TypeError or RangeError Intl.DateTimeFormat
    // raises for invalid ones.
    new Intl.DateTimeFormat(locale, options);
    const resolved = plainTimeFormatOptions(options ?? {});
    if (resolved === null) {
      return "";
    }
    const epochMilliseconds = Temporal.PlainDate.from("1970-01-01")
      .toPlainDateTime(Temporal.PlainTime.from(value))
      .toZonedDateTime("UTC").epochMilliseconds;
    return normalizeDateTime(
      new Intl.DateTimeFormat(locale, resolved).format(epochMilliseconds),
    );
  } catch {
    return "";
  }
}
