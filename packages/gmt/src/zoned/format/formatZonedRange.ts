import { cachedFormatter } from "../../internal/formatterCache";
import type { Temporal } from "../../internal/temporal";
import { normalizeDateTime, zonedDateTimeFrom } from "../../internal";
import { instantFormatOptions } from "../../internal/instantFormatOptions";
import type { DateTimeFormatOptions } from "../../types";
import { isValidZonedDateTime } from "../validate";
import { readDateTimeFormatOptions } from "../../internal/readDateTimeFormatOptions";
import { repairRangeParts } from "../../internal/repairRangeParts";
import {
  isRangeDayPeriodCompatNeeded,
  isRangeZoneNameCompatNeeded,
} from "../../internal/temporalCompat";

/**
 * The range with the parts a host gets wrong written in the requested form: the `timeZoneName`
 * width (defect D16, ICU-20548) and the flexible `dayPeriod` (defect D17). The part merge is
 * `repairRangeParts`. For D16 the carrier formatter uses a `short` zone name, which the engine
 * keeps; for D17 it is the requested formatter.
 */
function rangeWithRepairedParts(
  locale: string | string[] | undefined,
  formatOptions: Intl.DateTimeFormatOptions,
  ms1: number,
  ms2: number,
  repair: { zoneNames: boolean; dayPeriods: boolean },
): string {
  const want = cachedFormatter("DateTimeFormat", locale, formatOptions);
  const carrier = repair.zoneNames
    ? cachedFormatter("DateTimeFormat", locale, {
        ...formatOptions,
        timeZoneName: "short",
      })
    : want;
  const wanted = [want.formatToParts(ms1), want.formatToParts(ms2)] as const;
  return repairRangeParts(
    carrier.formatRangeToParts(ms1, ms2),
    wanted,
    carrier === want
      ? wanted
      : ([carrier.formatToParts(ms1), carrier.formatToParts(ms2)] as const),
    [
      ...(repair.zoneNames ? ["timeZoneName"] : []),
      ...(repair.dayPeriods ? ["dayPeriod"] : []),
    ],
  );
}

/**
 * Format a zoned datetime range using the Temporal Intl.DateTimeFormat formatRange API.
 *
 * - Both datetimes must have the same timezone.
 * - Formats both instants as Temporal's ECMA-402 Instant format does, through the runtime's
 *   `Intl.DateTimeFormat#formatRange` in the endpoints' zone: the requested fields and widths are
 *   kept, and with no date or time field (`era` alone included) the date and time are the
 *   defaults.
 * - The requested `timeZoneName` style is kept, also on engines whose ICU drops it from ranges
 *   (ICU-20548), and a flexible `dayPeriod` next to a zone name stays "in the morning" on engines
 *   that write AM/PM in ranges.
 * - Returns "" for invalid input, mismatched timezones, or a `timeZone` option (a ZonedDateTime
 *   keeps its own zone).
 * - **Compatibility:** before 1.21.0 on V8 and JSC, `long`, `longGeneric` and the offset zone names
 *   came out short or missing in ranges, and on Firefox a `dayPeriod` with a `timeZoneName` came out
 *   as AM or PM. Before 1.16.0 some locales lost a requested width (zh-CN with
 *   `{ year: "numeric", month: "long" }` gave `"2024/2"`), `era` alone dropped the time, and a
 *   `timeZone` option was silently overridden by the endpoints' zone. Pass the fields the old text
 *   showed to keep it, and drop the `timeZone` option to keep the endpoints' zone.
 * - Output is normalized: dash separators become ASCII "-" (unspaced between digits, spaced
 *   otherwise), and no-break, narrow and thin spaces become U+0020.
 * - `options` null returns `""`, as ECMA-402's CoerceOptionsToObject rejects it (a string or number
 *   options value formats with the defaults, as `Intl.DateTimeFormat` does).
 *
 * @param from zoned ISO 8601 datetime string (range start)
 * @param to zoned ISO 8601 datetime string (range end)
 * @param locale optional locale tag, or a preference list of tags (ECMA-402)
 * @param options optional Intl.DateTimeFormatOptions
 * @returns localized range string or "" when invalid
 *
 * @example formatZonedRange("2024-02-29T12:00:00.000+00:00[UTC]", "2024-02-29T14:00:00.000+00:00[UTC]", "de-DE", { dateStyle: "long", timeStyle: "short" }) // "29. Februar 2024, 12:00-14:00 Uhr"
 * @example formatZonedRange("2024-02-29T12:00:00.000+00:00[UTC]", "2024-02-29T14:00:00.000+00:00[UTC]", "en-GB", { dateStyle: "short", timeStyle: "short" }) // "29/02/2024, 12:00-14:00"
 * @example formatZonedRange("2024-02-03T14:30:45+08:00[Asia/Shanghai]", "2024-02-03T15:30:45+08:00[Asia/Shanghai]", "zh-CN", { year: "numeric", month: "long" }) // "2024年2月"
 * @example formatZonedRange("2024-02-03T14:30:45+00:00[Europe/London]", "2024-02-03T15:30:45+00:00[Europe/London]", "en-GB", { era: "long" }) // "03/02/2024 Anno Domini, 14:30:45 - 15:30:45"
 * @example formatZonedRange("2024-02-29T10:00:00+09:00[Asia/Tokyo]", "2024-02-29T12:00:00+09:00[Asia/Tokyo]", "ja-JP", { hour: "numeric", timeZone: "UTC" }) // "" — a ZonedDateTime keeps its own zone
 * @example formatZonedRange("2024-02-29T10:00:00+00:00[Europe/London]", "2024-02-29T12:00:00+00:00[Europe/London]", "en-GB", { hour: "numeric", minute: "numeric", timeZoneName: "short" }) // "10:00-12:00 GMT" — the pre-1.16.0 text
 * @example formatZonedRange("2024-02-29T10:00:00-05:00[America/New_York]", "2024-02-29T12:00:00-05:00[America/New_York]", "en-US", { hour: "numeric", minute: "numeric", timeZoneName: "long" }) // "10:00 AM - 12:00 PM Eastern Standard Time"
 * @example formatZonedRange("invalid", "2024-02-29T14:00:00.000+00:00[UTC]", "fr-FR") // "" (invalid input)
 * @example formatZonedRange("2024-02-03T14:30:45+01:00[Europe/Paris]", "2024-02-03T16:46:15+01:00[Europe/Paris]", ["fr-FR", "en-US"], { dateStyle: "short", timeStyle: "short" }) // "03/02/2024, 14:30 - 16:46"
 * @example formatZonedRange("2024-02-03T14:30:00-03:00[America/Sao_Paulo]", "2024-02-05T17:00:00-03:00[America/Sao_Paulo]", "pt-BR", null as never) // "" (null options, as ECMA-402 rejects them)
 */
export function formatZonedRange(
  from: string,
  to: string,
  locale?: string | string[],
  options?: DateTimeFormatOptions,
): string {
  try {
    // ECMA-402 CoerceOptionsToObject: null options throw TypeError, so they are invalid input.
    if (options === null) {
      return "";
    }
    if (!isValidZonedDateTime(from) || !isValidZonedDateTime(to)) {
      return "";
    }

    let zdt1: Temporal.ZonedDateTime;
    let zdt2: Temporal.ZonedDateTime;
    try {
      zdt1 = zonedDateTimeFrom(from);
      zdt2 = zonedDateTimeFrom(to);
    } catch {
      return "";
    }

    if (zdt1.timeZoneId !== zdt2.timeZoneId) {
      return "";
    }

    // Both instants are formatted in the endpoints' own zone with the options
    // an Instant format resolves to (GetDateTimeFormat ~any~, ~all~, ~all~), so
    // the requested fields and widths are kept. A `timeZone` option is rejected
    // rather than silently overridden.
    const formatOptions = instantFormatOptions(
      readDateTimeFormatOptions(options),
      zdt1.timeZoneId,
      "all",
    );
    if (formatOptions === null) {
      return "";
    }

    try {
      const ms1 = zdt1.epochMilliseconds;
      const ms2 = zdt2.epochMilliseconds;
      // ICU-20548 (D16): an affected engine cuts a requested zone name width in a range. D17: an
      // affected engine writes AM/PM for a flexible `dayPeriod` next to a zone name. Both are
      // dormant elsewhere, and for no `timeZoneName` or `short` (D16), which the engine keeps. An
      // explicit hour cycle needs no exemption: the repair gives the single format's own value, so
      // it changes nothing on a range that is already right.
      const style = formatOptions.timeZoneName;
      const zoneNames =
        style !== undefined && isRangeZoneNameCompatNeeded(style);
      const dayPeriods =
        style !== undefined &&
        formatOptions.dayPeriod !== undefined &&
        isRangeDayPeriodCompatNeeded();
      const out =
        zoneNames || dayPeriods
          ? rangeWithRepairedParts(locale, formatOptions, ms1, ms2, {
              zoneNames,
              dayPeriods,
            })
          : cachedFormatter(
              "DateTimeFormat",
              locale,
              formatOptions,
            ).formatRange(ms1, ms2);
      return normalizeDateTime(out);
    } catch {
      return "";
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
