import { cachedFormatter } from "../../internal/formatterCache";
import { normalizeDateTime } from "../../internal";
import { zonedDateTimeOf } from "../../internal/zonedWallClock";
import { instantFormatOptions } from "../../internal/instantFormatOptions";
import type { DateTimeFormatOptions } from "../../types";
import { readDateTimeFormatOptions } from "../../internal/readDateTimeFormatOptions";
import { timeZoneEquals } from "../../internal/temporalCompat";
import { repairRangeParts } from "../../internal/repairRangeParts";
import {
  ensureRangeHooks,
  formatRangeChecked,
} from "../../internal/rangeRepairs";
import { rangeFieldsText } from "../../internal/rangeFields";
import { repairRangeText } from "../../internal/repairRangeText";
import {
  isRangeDayPeriodCompatNeeded,
  isRangeZoneNameCompatNeeded,
} from "../../internal/temporalCompat";

/** The `timeZoneName` part's value, or `undefined` when the parts carry none. */
function zoneNameOf(parts: Intl.DateTimeFormatPart[]): string | undefined {
  return parts.find((part) => part.type === "timeZoneName")?.value;
}

/** The engine's own formatters built on the `TypeError` path, by locale and options. */
const ownFormatters = new Map<string, Intl.DateTimeFormat>();
const MAX_OWN_FORMATTERS = 32;

/**
 * The engine's own formatter for these arguments, built once and kept while `Intl.DateTimeFormat`
 * is the constructor that built it.
 */
function ownFormatter(
  locale: string | string[] | undefined,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = JSON.stringify([locale, options]);
  const hit = ownFormatters.get(key);
  if (hit !== undefined && hit.constructor === Intl.DateTimeFormat) {
    return hit;
  }
  if (ownFormatters.size >= MAX_OWN_FORMATTERS) {
    ownFormatters.clear();
  }
  const built = new Intl.DateTimeFormat(locale, options);
  ownFormatters.set(key, built);
  return built;
}

/**
 * The carrier's range parts. A formatter whose years are repaired (CORE-112, D23 to D27) is a
 * stand-in with no range parts method (it throws a `TypeError`), so the engine's own formatter,
 * which needs no year repair for a day period or a zone name, gives them. The host that turns this
 * repair on is SpiderMonkey, which has no week-year abort on range parts (D23).
 */
function rangePartsOf(
  carrier: Intl.DateTimeFormat,
  locale: string | string[] | undefined,
  formatOptions: Intl.DateTimeFormatOptions,
  shortZone: boolean,
  ms1: number,
  ms2: number,
): ReturnType<Intl.DateTimeFormat["formatRangeToParts"]> {
  try {
    return carrier.formatRangeToParts(ms1, ms2);
  } catch (error) {
    if (!(error instanceof TypeError)) {
      throw error;
    }
    return ownFormatter(
      locale,
      shortZone ? { ...formatOptions, timeZoneName: "short" } : formatOptions,
    ).formatRangeToParts(ms1, ms2);
  }
}

/**
 * The range with the parts a host gets wrong written in the requested form: the `timeZoneName`
 * width (defect D16, ICU-20548) and the flexible `dayPeriod` (defect D17). The part merge is
 * `repairRangeParts`. For D16 the carrier formatter uses a `short` zone name, which the engine
 * keeps; for D17 it is the requested formatter.
 *
 * `formatRangeToParts` is called only here, and a V8 that aborts on it (CORE-112, defect D23) never
 * turns the D17 gate on: only SpiderMonkey does, which has no such abort. D16 alone takes
 * `rangeWithRepairedZoneNames` and never calls a range parts method.
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
    rangePartsOf(carrier, locale, formatOptions, repair.zoneNames, ms1, ms2),
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
 * The range with the carrier's `short` zone names replaced by the requested ones (defect D16),
 * read off the `formatRange` string by `repairRangeText`, with no range parts call. A range
 * pattern is not visible through `resolvedOptions`, so a V8 that aborts on a week-of-year year
 * field (CORE-112, defect D23) cannot be told which range parts call is safe: this one makes none.
 * The zone names come from single-date parts, which `cachedFormatter` guards.
 *
 * @returns the repaired range, or `""` when a zone name cannot be given to an endpoint
 */
function rangeWithRepairedZoneNames(
  locale: string | string[] | undefined,
  formatOptions: Intl.DateTimeFormatOptions,
  ms1: number,
  ms2: number,
): string {
  const want = cachedFormatter("DateTimeFormat", locale, formatOptions);
  const carrierOptions = { ...formatOptions, timeZoneName: "short" as const };
  const carrier = cachedFormatter("DateTimeFormat", locale, carrierOptions);
  // The year repair first, then the zone names: it changes digits only.
  const text = formatRangeChecked(carrier, carrierOptions, ms1, ms2);
  if (text === null) {
    return "";
  }
  return (
    repairRangeText(
      text,
      [
        zoneNameOf(carrier.formatToParts(ms1)),
        zoneNameOf(carrier.formatToParts(ms2)),
      ],
      [
        zoneNameOf(want.formatToParts(ms1)),
        zoneNameOf(want.formatToParts(ms2)),
      ],
    ) ?? ""
  );
}

/**
 * The text of a zoned range, before it is normalised: the engine's range, repaired for a zone name
 * (D16), a day period (D17) or a field the range pattern drops, repeats or garbles (D29).
 *
 * @param locale the locale or locale list
 * @param formatOptions the Instant-format options, zone already set
 * @param ms1 the start in epoch milliseconds
 * @param ms2 the end in epoch milliseconds
 * @returns the range text, or `null` when the year guard has no range for it
 */
function zonedRangeText(
  locale: string | string[] | undefined,
  formatOptions: Intl.DateTimeFormatOptions,
  ms1: number,
  ms2: number,
): string | null {
  ensureRangeHooks();
  // ICU-20548 (D16): an affected engine cuts a requested zone name width in a range. D17: an
  // affected engine writes AM/PM for a flexible `dayPeriod` next to a zone name. Both are
  // dormant elsewhere, and for no `timeZoneName` or `short` (D16), which the engine keeps. An
  // explicit hour cycle needs no exemption: the repair gives the single format's own value, so
  // it changes nothing on a range that is already right.
  const style = formatOptions.timeZoneName;
  const zoneNames = style !== undefined && isRangeZoneNameCompatNeeded(style);
  const dayPeriods =
    style !== undefined &&
    formatOptions.dayPeriod !== undefined &&
    isRangeDayPeriodCompatNeeded();
  let out: string;
  // D29: a range whose pattern drops, repeats or garbles a field is written from the two single
  // texts, which already carry the requested zone names and day periods. The parts repairs
  // below read the engine's own range parts, so they never see this text.
  const fields = rangeFieldsText(
    cachedFormatter("DateTimeFormat", locale, formatOptions),
    formatOptions,
    ms1,
    ms2,
  );
  if (fields !== null) {
    out = fields;
  } else if (dayPeriods) {
    out = rangeWithRepairedParts(locale, formatOptions, ms1, ms2, {
      zoneNames,
      dayPeriods,
    });
  } else if (zoneNames) {
    out = rangeWithRepairedZoneNames(locale, formatOptions, ms1, ms2);
  } else {
    const text = formatRangeChecked(
      cachedFormatter("DateTimeFormat", locale, formatOptions),
      formatOptions,
      ms1,
      ms2,
    );
    if (text === null) {
      return null;
    }
    out = text;
  }
  return out;
}

/**
 * Format a zoned datetime range using the Temporal Intl.DateTimeFormat formatRange API.
 *
 * - Both datetimes must have the same time zone: identifiers of one zone count as the same
 *   (`UTC` and `Etc/UTC` on every host; an IANA link such as `Europe/Kiev` and `Europe/Kyiv` where
 *   the host resolves it, which Safari 27 without `Temporal` does not).
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
    const zdt1 = zonedDateTimeOf(from);
    const zdt2 = zonedDateTimeOf(to);
    if (zdt1 === null || zdt2 === null) {
      return "";
    }

    if (!timeZoneEquals(zdt1, zdt2)) {
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
      const out = zonedRangeText(locale, formatOptions, ms1, ms2);
      if (out === null) {
        return "";
      }
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
