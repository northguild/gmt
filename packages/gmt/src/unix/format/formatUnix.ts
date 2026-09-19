// fallow-ignore-file code-duplication -- cross-family Temporal type clone, by design (rule 5)
import { formatWallClockOrZoned } from "../../internal/instantFormatOptions";
import { normalizeDateTime } from "../../internal/normalizeDateTime";
import { normalizeTimeZone } from "../../internal/normalizeTimeZone";
import {
  resolveUnixEpochUnit,
  unixEpochToInstant,
} from "../../internal/unixEpochValue";
import type { UnixUnit } from "../validate";

export interface FormatUnixOptions extends Intl.DateTimeFormatOptions {
  epochUnit?: UnixUnit;
  timeZone?: string;
  // When true, format via ZonedDateTime so the localized timezone name is
  // included for full/long styles. Defaults to false (matches the original
  // behavior of formatting a wall-clock PlainDateTime).
  includeTimeZoneName?: boolean;
}

/**
 * Format a unix epoch value (string or number) as a localized date/time string.
 *
 * - Returns `""` if the input is not a valid unix epoch value for the given `epochUnit`.
 * - `epochUnit` controls whether the input is interpreted as `"milliseconds"` or `"seconds"`; defaults to `"milliseconds"`.
 * - `value` is a safe integer or a string of optionally negative ASCII digits (no whitespace, `+`,
 *   decimal point or exponent); `epochUnit` also accepts `"second"` / `"millisecond"`.
 * - `timeZone` controls the IANA zone used for rendering; defaults to `"UTC"`, `"local"` is the
 *   system zone, and an unknown zone returns `""` (ECMA-402 throws RangeError for it).
 * - `includeTimeZoneName` appends the localized timezone name when true.
 * - Without `includeTimeZoneName` the wall clock is formatted as Temporal's ECMA-402 PlainDateTime
 *   format does (`timeZoneName` is ignored); with it, as the ZonedDateTime format does (a short
 *   zone name is added to the defaults). Either way the requested fields and style widths are kept,
 *   and `era` alone still gets the date and time defaults.
 * - **Compatibility:** before 1.16.0 some locales and calendars lost a requested width (ja-JP with
 *   the japanese calendar and `month: "long"` gave `"R6/2"`), a `long`/`full` `timeStyle` replaced
 *   the `dateStyle` width, `era` alone dropped the time, and `timeZoneName` alone without
 *   `includeTimeZoneName` returned `""`. Pass the fields the old text showed to keep it.
 * - `options` null returns `""`, as ECMA-402's CoerceOptionsToObject rejects it.
 *
 * @param value unix epoch value to format (string or number, per `epochUnit`)
 * @param locale optional: BCP 47 locale tag, or a preference list of tags (ECMA-402)
 * @param options optional: { epochUnit, timeZone, includeTimeZoneName }
 * @returns the formatted date/time string, or "" on invalid input
 *
 * @example formatUnix("1710685845000", "en-US", { epochUnit: "milliseconds" }) // "3/17/2024, 2:30:45 PM"
 * @example formatUnix(1710685845000, "en-US", { epochUnit: "milliseconds" }) // "3/17/2024, 2:30:45 PM"
 * @example formatUnix("1710685845", "en-US", { epochUnit: "seconds" }) // "3/17/2024, 2:30:45 PM"
 * @example formatUnix("1710685845000", "en-US", { epochUnit: "milliseconds", includeTimeZoneName: true }) // "3/17/2024, 2:30:45 PM UTC"
 * @example formatUnix(1706970645, "ja-JP-u-ca-japanese", { epochUnit: "seconds", year: "numeric", month: "long" }) // "令和6年2月"
 * @example formatUnix(1706970645, "ja-JP-u-ca-japanese", { epochUnit: "seconds", year: "numeric", month: "numeric" }) // "R6/2" — the pre-1.16.0 text
 * @example formatUnix(1706970645, "en-US", { epochUnit: "seconds", era: "long" }) // "2/3/2024 Anno Domini, 2:30:45 PM"
 * @example formatUnix(1706970645, "en-US", { epochUnit: "seconds", era: "long", year: "numeric", month: "numeric", day: "numeric" }) // "2/3/2024 Anno Domini" — the pre-1.16.0 text
 * @example formatUnix(0, "en-US", { timeZoneName: "short" }) // "1/1/1970, 12:00:00 AM"
 * @example formatUnix(1710685845000, "en-US", { timeZone: "America/New_Yrok" }) // "" (unknown zone)
 * @example formatUnix("1710685845000.0") // "" (not a digit string)
 * @example formatUnix(0, "en-US", null as never) // "" (null options, as ECMA-402 rejects them)
 * @example formatUnix("not-a-number") // ""
 * @example formatUnix(1710685845000, ["fr-FR", "en-US"], { dateStyle: "long" }) // "17 mars 2024"
 */
export function formatUnix(
  value: string | number,
  locale?: string | string[],
  options?: FormatUnixOptions,
): string {
  // ECMA-402 CoerceOptionsToObject: undefined is defaults; null is a TypeError.
  if (options === null) return "";
  const {
    epochUnit,
    timeZone,
    includeTimeZoneName = false,
    ...intlOptions
  } = options ?? {};

  const resolvedUnit = resolveUnixEpochUnit(epochUnit);
  if (resolvedUnit === null) return "";

  const instant = unixEpochToInstant(value, resolvedUnit);
  if (instant === null) return "";

  const tz = normalizeTimeZone(timeZone);
  if (!tz) return "";

  try {
    const zdt = instant.toZonedDateTimeISO(tz);
    return normalizeDateTime(
      formatWallClockOrZoned(zdt, locale, intlOptions, includeTimeZoneName),
    );
  } catch {
    return "";
  }
}
