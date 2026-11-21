import { normalizeDateTime } from "../internal/normalizeDateTime";
import { Temporal } from "../internal/temporal";
import { utcMs } from "./utcMs";

/*
 * The host's own wording for a value the library formats. The text comes from the host's own
 * `Intl.DateTimeFormat`; a workaround fixes a value to the standard only where its probe fails on
 * that host. A row asserts the value exactly (the date, the number, the year, the era) and takes
 * the wording (month and weekday names, abbreviations, word order, separators, zone names) from
 * what `Intl.DateTimeFormat` prints for the same input on the host that runs it, with the
 * library's normalisation of spaces, dashes and bidi marks.
 */

type Options = Intl.DateTimeFormatOptions;

/**
 * The host's formatter for a locale and options, as the library builds it. ECMA-402 ResolveLocale
 * drops every `-u-` keyword when the host has no data for the language and falls back to its
 * default locale (Chromium has none for `my`, `gl` or `fur`), so the host's text is the text the
 * library returns.
 */
export function hostFormatter(
  locale: string | readonly string[],
  options: Options,
): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(locale, options);
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
 * `text` with each end's printed year replaced by the year the calendar gives it. A host with a
 * defect prints the week-year (one more or one less), the ISO year (for `japanese` and `roc`) or
 * `1 - year` with no sign (coptic before AM 1, D31) in its place, so each end's printed year is
 * the first run of digits, at or after the previous end's, that holds one of those candidates.
 * A match never starts or ends inside a longer run of digits, and a minus sign right after a
 * digit is a separator, not a sign, so `18-11-286` holds 286 and never -286.
 */
function withYearsWritten(
  text: string,
  ends: readonly { year: number; iso: number }[],
  written: (value: number) => string,
): string {
  let result = text;
  let cursor = 0;
  for (const { year, iso } of ends) {
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
      const match = pattern.exec(result);
      if (match !== null && (best === undefined || match.index < best.at)) {
        best = { at: match.index, length: match[0].length };
      }
    }
    if (best === undefined) continue;
    const replacement = written(year);
    result =
      result.slice(0, best.at) +
      replacement +
      result.slice(best.at + best.length);
    cursor = best.at + replacement.length;
  }
  return result;
}

/** The host's formatter for UTC, and how it writes a number in its numbering system. */
function yearWriter(
  locale: string,
  options: Options,
): {
  formatter: Intl.DateTimeFormat;
  written: (value: number) => string;
} {
  const formatter = hostFormatter(locale, { ...options, timeZone: "UTC" });
  const resolved = formatter.resolvedOptions();
  const numbers = new Intl.NumberFormat(resolved.locale, {
    numberingSystem: resolved.numberingSystem,
    useGrouping: false,
  });
  return {
    formatter,
    written: (value) => normalizeDateTime(numbers.format(value)),
  };
}

/**
 * The host's range text between two calendar dates, printed in UTC, with the year of each end
 * written as the calendar gives it. The order, the separators, the era and the digits are the
 * host's own wording; the year is the value.
 */
export function hostRangeWithYears(
  locale: string,
  options: Options,
  fromIso: string,
  toIso: string,
  years: readonly [number, number],
): string {
  const { formatter, written } = yearWriter(locale, options);
  const isoYears = [fromIso, toIso].map(
    (iso) => Temporal.PlainDate.from(iso).year,
  );
  return withYearsWritten(
    normalizeDateTime(
      formatter.formatRange(utcMidnight(fromIso), utcMidnight(toIso)),
    ),
    years.map((year, end) => ({ year, iso: isoYears[end] ?? year })),
    written,
  );
}

/**
 * The host's two single dates, each with its year written as the calendar gives it, joined by the
 * locale fallback's ASCII dash (UTS #35 `{0} - {1}`). This is ECMA-402's `[[Default]]` range for a
 * host whose own range pattern drops, repeats or garbles a field of one date (D29): the text a
 * range prints when the host's own range cannot be used.
 */
export function hostJoinedWithYears(
  locale: string,
  options: Options,
  fromIso: string,
  toIso: string,
  years: readonly [number, number],
): string {
  const { formatter, written } = yearWriter(locale, options);
  return [fromIso, toIso]
    .map((iso, end) =>
      withYearsWritten(
        normalizeDateTime(formatter.format(utcMidnight(iso))),
        [
          {
            year: years[end] ?? 0,
            iso: Temporal.PlainDate.from(iso).year,
          },
        ],
        written,
      ),
    )
    .join(" - ");
}

/**
 * The host's short era name at a calendar date: its era-and-year text without the year. A number
 * inside a word stays, because an era is a name (UTS #35 Part 4 §8, `G`): ICU data without a
 * locale's coptic era names prints the placeholder `ERA1`. Which era a host names before coptic
 * AM 1 differs (D31: `ERA0`, or none), so a test strips it from the host's text and checks the
 * library's era on its own.
 */
export function hostEraAt(locale: string, isoDate: string): string {
  const text = hostFormatter(locale, {
    era: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(utcMidnight(isoDate));
  return normalizeDateTime(
    text.replace(/(?<!\p{L})\p{Nd}+(?!\p{L})/gu, ""),
  ).trim();
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
