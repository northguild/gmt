import { normalizeDateTime } from "../../internal/normalizeDateTime";
import { normalizeTimeZone } from "../../internal/normalizeTimeZone";
import { toInstantFromUtc } from "../../internal/toInstantFromUtc";
import { isValidUtc } from "../validate";

/**
 * Options for `formatUtc`. Extends `Intl.DateTimeFormatOptions`; only the
 * added/overridden members are listed below. All `Intl.DateTimeFormatOptions`
 * (`dateStyle`, `timeStyle`, etc.) apply to the time-of-day portion.
 *
 * @remarks Members:
 *
 * | Member | Type | Default | Description |
 * | --- | --- | --- | --- |
 * | `timeZone` | `string` | `"UTC"` | IANA zone for rendering; invalid/omitted falls back to UTC via `normalizeTimeZone`. |
 * | `includeTimeZoneName` | `boolean` | `false` | Appends the localized zone name (style via `Intl`) when true. |
 *
 * @example
 * import { FormatUtcOptions } from "@northguild/gmt/utc";
 * const opts: FormatUtcOptions = { includeTimeZoneName: true };
 */
export interface FormatUtcOptions extends Intl.DateTimeFormatOptions {
  timeZone?: string;
  includeTimeZoneName?: boolean;
}

/**
 * Format a UTC ISO string as a localized date/time string.
 *
 * - Returns `""` if the input is not a valid UTC string.
 * - `timeZone` controls the IANA zone used for rendering; defaults to `"UTC"`.
 * - `includeTimeZoneName` appends the localized timezone name when true.
 *
 * @param value UTC ISO string to format
 * @param locale optional: BCP 47 locale tag
 * @param options optional: { timeZone, includeTimeZoneName }
 * @returns the formatted date/time string, or "" on invalid input
 *
 * @example formatUtc("2026-03-16T18:30:00Z") // "3/16/2026, 6:30:00 PM"
 * @example formatUtc("2026-03-16T18:30:00Z", "en-US", { timeZone: "America/New_York" }) // "3/16/2026, 2:30:00 PM"
 * @example formatUtc("2026-03-16T18:30:00Z", "en-US", { timeZone: "America/New_York", includeTimeZoneName: true }) // "3/16/2026, 2:30:00 PM EDT"
 * @example formatUtc("not-a-date") // ""
 */
export function formatUtc(
  value: string,
  locale?: string,
  options?: FormatUtcOptions,
): string {
  if (!isValidUtc(value)) return "";

  const {
    timeZone,
    includeTimeZoneName = false,
    ...intlOptions
  } = options ?? {};

  const instant = toInstantFromUtc(value);
  if (instant === null) return "";

  try {
    const tz = normalizeTimeZone(timeZone);
    const zdt = instant.toZonedDateTimeISO(tz);

    const out = includeTimeZoneName
      ? zdt.toLocaleString(locale, intlOptions)
      : zdt.toPlainDateTime().toLocaleString(locale, intlOptions);

    return normalizeDateTime(out);
  } catch {
    return "";
  }
}
