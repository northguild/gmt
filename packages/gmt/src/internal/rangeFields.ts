import { DATE_KEYS, TIME_KEYS, verdictKey } from "./patternKey";
import { rangeVerdict } from "./rangeDetector";
import {
  dayPeriodOf,
  forgetFieldReaders,
  localFieldsOf,
  rangeFieldsEqual,
} from "./rangeFieldValues";
import { fallbackTemplate, joinFallback } from "./rangeFallback";
import { ensureRangeHooks, formatRangeChecked } from "./rangeRepairs";
import { isRangeFieldCompatNeeded } from "./temporalCompat/capabilities";

/*
 * CORE-112 slice 7, D29: the range a formatter prints when its engine's range pattern drops,
 * repeats or garbles a field.
 *
 * ECMA-402 PartitionDateTimeRangePattern gives a range whose pattern has no interval data as the
 * two full patterns joined by the fallback (UTS #35 `intervalFormatFallback`). Where the CLDR
 * interval data or ICU breaks the rule that a range holds the fields each date's single prints (a field both dates share may print once), the
 * range is written that way: `P + format(start) + J + format(end) + S`. The check is lazy, runs on a
 * UTC clone, and is kept per pattern under the D24 verdict key. It is dormant behind
 * `isRangeFieldCompatNeeded`, so a fixed engine runs nothing here.
 *
 * Retiring it deletes this file and `rangeDetector.ts`, and sends `formatDateRange`,
 * `formatDateTimeRange` and `zonedRangeText` back to `formatRangeChecked` (`rangeRepairs.ts`).
 * `rangeFallback.ts` stays while D25 uses it, `patternKey.ts` while D24 does.
 */

/**
 * At most this many verdicts; past it the whole map clears (one `Map#clear`, then each pattern is
 * judged again on its next range: a cost of one detector run per live pattern, never a wrong text).
 */
const MAX_VERDICTS = 256;

const verdicts = new Map<string, readonly string[]>();
let verdictsBuiltWith: unknown;

/** A UTC, zone-free clone of the formatter: the same pattern, with no zone to move an instant. */
function cloneOf(
  options: Intl.DateTimeFormatOptions,
  resolved: Intl.ResolvedDateTimeFormatOptions,
): Intl.DateTimeFormat {
  const twin: Intl.DateTimeFormatOptions = {
    calendar: resolved.calendar,
    numberingSystem: resolved.numberingSystem,
    timeZone: "UTC",
  };
  if (resolved.hourCycle !== undefined) {
    twin.hourCycle = resolved.hourCycle;
  }
  if (options.formatMatcher !== undefined) {
    twin.formatMatcher = options.formatMatcher;
  }
  for (const key of [...DATE_KEYS, ...TIME_KEYS]) {
    if (options[key] !== undefined) {
      Object.assign(twin, { [key]: options[key] });
    }
  }
  return new Intl.DateTimeFormat(resolved.locale, twin);
}

/**
 * The class of the greatest field that differs between two instants in the formatter's calendar and
 * zone, named as the detector's probes are: `G` era, `y` year, `M` month, `d` day, `a` AM or PM,
 * `B` flexible day period, `h` hour, `m` minute; `null` when only seconds or less differ. The order
 * is ECMA-402 Table 6.
 */
function greatestClass(
  options: Intl.DateTimeFormatOptions,
  resolved: Intl.ResolvedDateTimeFormatOptions,
  startMs: number,
  endMs: number,
): string | null {
  const x = localFieldsOf(resolved, startMs);
  const y = localFieldsOf(resolved, endMs);
  const differs = (...types: string[]): boolean =>
    types.some((type) => x[type] !== y[type]);
  if (differs("era")) {
    return "G";
  }
  if (differs("year", "relatedYear", "yearName")) {
    return "y";
  }
  if (differs("month")) {
    return "M";
  }
  if (differs("day")) {
    return "d";
  }
  if (
    Math.floor(Number(x["hour"]) / 12) !== Math.floor(Number(y["hour"]) / 12)
  ) {
    return "a";
  }
  if (
    dayPeriodOf(options, resolved, startMs) !==
    dayPeriodOf(options, resolved, endMs)
  ) {
    return "B";
  }
  if (differs("hour")) {
    return "h";
  }
  return differs("minute") ? "m" : null;
}

/** The classes of range this formatter's pattern gets wrong, kept per pattern. */
function wrongClasses(
  options: Intl.DateTimeFormatOptions,
  resolved: Intl.ResolvedDateTimeFormatOptions,
): readonly string[] {
  if (verdictsBuiltWith !== Intl.DateTimeFormat) {
    verdicts.clear();
    forgetFieldReaders();
    verdictsBuiltWith = Intl.DateTimeFormat;
  }
  const key = verdictKey(options, resolved);
  const known = verdicts.get(key);
  if (known !== undefined) {
    return known;
  }
  const clone = cloneOf(options, resolved);
  const { classes } = rangeVerdict(
    {
      format: (ms) => clone.format(ms),
      formatRange: (a, b) => clone.formatRange(a, b),
      ...(options.dayPeriod === undefined
        ? {}
        : {
            // The probes are UTC instants read through a UTC clone, so the period is read in UTC.
            dayPeriod: (ms: number) =>
              dayPeriodOf(options, { ...resolved, timeZone: "UTC" }, ms),
          }),
    },
    resolved.calendar,
  );
  if (verdicts.size >= MAX_VERDICTS) {
    verdicts.clear();
  }
  verdicts.set(key, classes);
  return classes;
}

/**
 * The range text where the engine's range pattern drops, repeats or garbles a field (defect D29)
 * for this pair of instants, or `null` when the engine's own range is right and is to be used.
 *
 * The verdict is per pattern and per class of the greatest field that differs, because an engine's
 * interval data is per class: a pattern wrong for a day-apart range prints a same-day range right,
 * and that range is not replaced. Two instants whose field values are equal in every row ECMA-402
 * PartitionDateTimeRangePattern checks are the one single text; printed text is never compared.
 *
 * @param formatter the formatter whose range is asked for
 * @param options the options it was built with
 * @param startMs the start in epoch milliseconds
 * @param endMs the end in epoch milliseconds
 * @returns the repaired text, `""` when the fallback joiner is unavailable, or `null` to use the engine's range
 *
 * @example rangeFieldsText(new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }), { dateStyle: "medium" }, 0, 86_400_000) // null on an engine whose ranges are right
 */
export function rangeFieldsText(
  formatter: Intl.DateTimeFormat,
  options: Intl.DateTimeFormatOptions,
  startMs: number,
  endMs: number,
): string | null {
  if (!isRangeFieldCompatNeeded()) {
    return null;
  }
  try {
    const resolved = formatter.resolvedOptions();
    const classes = wrongClasses(options, resolved);
    if (!classes.length) {
      return null;
    }
    if (rangeFieldsEqual(options, resolved, startMs, endMs)) {
      return formatter.format(startMs);
    }
    const wrong = classes.includes(
      greatestClass(options, resolved, startMs, endMs) ?? "",
    );
    return wrong ? rangeFromSingles(formatter, startMs, endMs) : null;
  } catch {
    return null;
  }
}

/**
 * The range as the locale's fallback writes it from the formatter's own single texts, or `""` when
 * the joiner or a single is unavailable (the house value).
 *
 * @example rangeFromSingles(new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }), 1715731200000, 1715904000000) // "May 15, 2024 – May 17, 2024"
 */
export function rangeFromSingles(
  formatter: Intl.DateTimeFormat,
  startMs: number,
  endMs: number,
): string {
  try {
    const { locale, numberingSystem, calendar } = formatter.resolvedOptions();
    const template = fallbackTemplate(locale, numberingSystem, calendar);
    const first = formatter.format(startMs);
    const last = formatter.format(endMs);
    return template === null || first === "" || last === ""
      ? ""
      : joinFallback(template, first, last);
  } catch {
    return "";
  }
}

/**
 * The text of a range: the fields repair of D29 where this pair needs it, else the year repair
 * (`formatRangeChecked`) of the engine's own range. The one call the range functions make.
 *
 * @returns the text, or `null` when a flagged formatter's year runs cannot be repaired
 *
 * @example formatRangeRepaired(new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }), { dateStyle: "medium" }, 1715731200000, 1715904000000) // "May 15 – 17, 2024"
 */
export function formatRangeRepaired(
  formatter: Intl.DateTimeFormat,
  options: Intl.DateTimeFormatOptions,
  startMs: number,
  endMs: number,
): string | null {
  ensureRangeHooks();
  return (
    rangeFieldsText(formatter, options, startMs, endMs) ??
    formatRangeChecked(formatter, options, startMs, endMs)
  );
}
