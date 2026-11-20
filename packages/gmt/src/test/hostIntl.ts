import { normalizeDateTime } from "../internal/normalizeDateTime";
import { Temporal } from "../internal/temporal";
import { utcMs } from "./utcMs";

/*
 * The host's own wording for a value the library formats. Compat README rule 7: the value a call
 * returns (the date, the number, the year, the era) is the same on every host, and the wording
 * (month and weekday names, abbreviations, word order, separators, zone names) is the host's CLDR
 * and ICU data, which differs between engines. A row asserts the value exactly and takes the
 * wording from what `Intl.DateTimeFormat` prints for the same input on the host that runs it,
 * with the library's normalisation of spaces, dashes and bidi marks.
 */

type Options = Intl.DateTimeFormatOptions;

/**
 * The host's formatter for a locale tag, with the tag's `-u-ca-` keyword passed again as the
 * `calendar` option. ECMA-402 ResolveLocale drops every `-u-` keyword when the host has no data
 * for the language and falls back to its default locale (Chromium has none for `my`, `gl` or
 * `fur`), and the `calendar` option survives that fallback. The library passes the calendar the
 * same way, so the host's text is for the calendar the caller named.
 */
export function hostFormatter(
  locale: string | readonly string[],
  options: Options,
): Intl.DateTimeFormat {
  const tag =
    typeof locale === "string"
      ? locale
      : Intl.DateTimeFormat.supportedLocalesOf(locale)[0];
  const calendar =
    options.calendar ??
    (tag === undefined ? undefined : new Intl.Locale(tag).calendar);
  return new Intl.DateTimeFormat(
    locale,
    calendar === undefined ? options : { ...options, calendar },
  );
}

/** The epoch milliseconds and the zone of a zoned date-time string. */
function zonedInput(zoned: string): { ms: number; timeZone: string } {
  const value = Temporal.ZonedDateTime.from(zoned);
  return { ms: value.epochMilliseconds, timeZone: value.timeZoneId };
}

/** The host's text for a date-time at one instant in a zone. */
export function hostText(
  locale: string,
  options: Options,
  zoned: string,
): string {
  const { ms, timeZone } = zonedInput(zoned);
  return normalizeDateTime(
    hostFormatter(locale, { ...options, timeZone }).format(ms),
  );
}

/** The host's text for a calendar date (`YYYY-MM-DD`), printed in UTC. */
export function hostDateText(
  locale: string | readonly string[],
  options: Options,
  isoDate: string,
): string {
  return normalizeDateTime(
    hostFormatter(locale, { ...options, timeZone: "UTC" }).format(
      utcMs(`${isoDate}T00:00:00Z`),
    ),
  );
}

/**
 * The host's text for a wall-clock date-time (`YYYY-MM-DDTHH:mm:ss`), printed in UTC. A plain
 * value has no zone: Temporal's ECMA-402 AdjustDateTimeStyleFormat removes `timeZoneName` from a
 * `long` or `full` `timeStyle` and lets the format matcher pick the pattern, so GMT's documented
 * pick, the locale's `medium` time format, is used here too.
 */
export function hostDateTimeText(
  locale: string | readonly string[],
  options: Options,
  isoDateTime: string,
): string {
  const ms =
    Temporal.PlainDateTime.from(isoDateTime).toZonedDateTime(
      "UTC",
    ).epochMilliseconds;
  const zoneless =
    options.timeStyle === "long" || options.timeStyle === "full"
      ? { ...options, timeStyle: "medium" as const }
      : options;
  return normalizeDateTime(
    hostFormatter(locale, { ...zoneless, timeZone: "UTC" }).format(ms),
  );
}

/**
 * The host's range text between two wall-clock values (`YYYY-MM-DD` or `YYYY-MM-DDTHH:mm:ss`),
 * printed in UTC, with the `timeStyle` mapped as in {@link hostDateTimeText}.
 */
export function hostPlainRangeText(
  locale: string,
  options: Options,
  from: string,
  to: string,
): string {
  const ms = (value: string): number =>
    Temporal.PlainDateTime.from(value).toZonedDateTime("UTC").epochMilliseconds;
  const zoneless =
    options.timeStyle === "long" || options.timeStyle === "full"
      ? { ...options, timeStyle: "medium" as const }
      : options;
  return normalizeDateTime(
    hostFormatter(locale, { ...zoneless, timeZone: "UTC" }).formatRange(
      ms(from),
      ms(to),
    ),
  );
}

type Part = Intl.DateTimeFormatPart;
type RangePart = Intl.DateTimeRangeFormatPart;

/** The value of the first part of a type, or `undefined`. */
function valueOf(parts: Part[], type: string): string | undefined {
  return parts.find((part) => part.type === type)?.value;
}

/**
 * The host's range text between two zoned date-times of one zone.
 *
 * Engines cut the requested zone name width in a range (ICU-20548) and print AM/PM for a flexible
 * day period beside a zone name, so the host's range keeps the right pattern and the wrong
 * zone-name and day-period words. Those two words come from the host's single text of each end
 * (ECMA-402 PartitionDateTimeRangePattern: each date's part holds every field its own `format`
 * prints); everything else is the host's range pattern. A part shared by both ends takes the word
 * of the end whose `short` zone name or own day period the range printed.
 */
export function hostRangeText(
  locale: string,
  options: Options,
  fromZoned: string,
  toZoned: string,
): string {
  const ends = [zonedInput(fromZoned), zonedInput(toZoned)];
  const timeZone = ends[0]?.timeZone;
  const withZone = (extra: Options): Intl.DateTimeFormat =>
    hostFormatter(locale, { ...options, timeZone, ...extra });
  const zoneName = options.timeZoneName;
  if (zoneName === undefined) {
    return normalizeDateTime(
      withZone({}).formatRange(ends[0]?.ms ?? 0, ends[1]?.ms ?? 0),
    );
  }
  const carrier = withZone({ timeZoneName: "short" });
  const wanted = withZone({});
  const swapped: string[] = ["timeZoneName"];
  if (options.dayPeriod !== undefined) swapped.push("dayPeriod");
  const singles = ends.map((end) => ({
    carrier: carrier.formatToParts(end.ms),
    wanted: wanted.formatToParts(end.ms),
  }));
  const parts: RangePart[] = carrier.formatRangeToParts(
    ends[0]?.ms ?? 0,
    ends[1]?.ms ?? 0,
  );
  return normalizeDateTime(
    parts
      .map((part) => {
        if (!swapped.includes(part.type)) return part.value;
        const index =
          part.source === "startRange"
            ? 0
            : part.source === "endRange"
              ? 1
              : singles.findIndex(
                  (single) => valueOf(single.carrier, part.type) === part.value,
                );
        const single = singles[index < 0 ? 0 : index];
        return valueOf(single?.wanted ?? [], part.type) ?? part.value;
      })
      .join(""),
  );
}

/** A string as a Unicode-mode regular expression that matches it literally. */
function escaped(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}

/** The epoch milliseconds of midnight UTC on an ISO date, years before 1 and after 9999 too. */
function utcMidnight(isoDate: string): number {
  return Temporal.PlainDate.from(isoDate).toZonedDateTime("UTC")
    .epochMilliseconds;
}

/**
 * The host's range text between two calendar dates, printed in UTC, with the year of each end
 * written as the calendar gives it. The order, the separators, the era and the digits are the
 * host's wording (compat README rule 7); the year is the value. A host with a defect prints the
 * week-year (one more or one less), the ISO year (for `japanese` and `roc`) or `1 - year` with no
 * sign (coptic before AM 1, D31) in its place, so each end's printed year is the first run of
 * digits, at or after the previous end's, that holds one of those candidates, and it is replaced
 * by the year passed. A match never starts or ends inside a longer run of digits, and a minus
 * sign right after a digit is a separator, not a sign, so `18-11-286` holds 286 and never -286.
 */
export function hostRangeWithYears(
  locale: string,
  options: Options,
  fromIso: string,
  toIso: string,
  years: readonly [number, number],
): string {
  const formatter = hostFormatter(locale, { ...options, timeZone: "UTC" });
  const resolved = formatter.resolvedOptions();
  const numbers = new Intl.NumberFormat(resolved.locale, {
    numberingSystem: resolved.numberingSystem,
    useGrouping: false,
  });
  const written = (value: number): string =>
    normalizeDateTime(numbers.format(value));
  const isoYears = [fromIso, toIso].map(
    (iso) => Temporal.PlainDate.from(iso).year,
  );
  let text = normalizeDateTime(
    formatter.formatRange(utcMidnight(fromIso), utcMidnight(toIso)),
  );
  let cursor = 0;
  years.forEach((year, end) => {
    const iso = isoYears[end] ?? year;
    const candidates = [
      year,
      year - 1,
      year + 1,
      1 - year,
      iso,
      iso - 1,
      iso + 1,
    ];
    let best: { at: number; length: number } | undefined;
    for (const candidate of candidates) {
      const pattern = new RegExp(
        `(?<!\\p{Nd})${escaped(written(candidate))}(?!\\p{Nd})`,
        "gu",
      );
      pattern.lastIndex = cursor;
      const match = pattern.exec(text);
      if (match !== null && (best === undefined || match.index < best.at)) {
        best = { at: match.index, length: match[0].length };
      }
    }
    if (best === undefined) return;
    const replacement = written(year);
    text =
      text.slice(0, best.at) + replacement + text.slice(best.at + best.length);
    cursor = best.at + replacement.length;
  });
  return text;
}

/**
 * The numbers in the numeric parts of formatted parts, read in the numbering system the host
 * resolves for the locale, keyed by part type. A part written with letters (a month or weekday
 * name, a day period, an era) is left out: its wording is the host's.
 */
export function numericPartValues(
  parts: readonly { type: string; value: string }[],
  locale: string,
): Record<string, number> {
  const { numberingSystem } = hostFormatter(locale, {}).resolvedOptions();
  const writer = new Intl.NumberFormat("en", { numberingSystem });
  const digits = new Map(
    Array.from({ length: 10 }, (_, digit) => [writer.format(digit), digit]),
  );
  const values: Record<string, number> = {};
  for (const { type, value } of parts) {
    if (type === "literal" || value === "") continue;
    const read = [...value].map((char) => digits.get(char));
    if (read.some((digit) => digit === undefined)) continue;
    values[type] = read.reduce<number>(
      (sum, digit) => sum * 10 + (digit ?? 0),
      0,
    );
  }
  return values;
}
