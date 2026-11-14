import { plainOptionEntries } from "./plainOptionEntries";
import { Temporal } from "./temporal";
import { nowInstant } from "./temporalCompat/clock";
import {
  forgetWeekYearRange,
  formatRangeChecked,
  markRangeHandled,
} from "./weekYearRange";
import { createPartsSynth } from "./weekYearSynth";
import {
  analyse,
  anchorYear,
  checkYearRuns,
  dateIn,
  digitRuns,
  forgetWeekYearText,
  patchYearParts,
  referenceFor,
  referenceYear,
  repairText,
  yearRunIndexes,
  type RepairedText,
  type WeekYearAnalysis,
} from "./weekYearText";

/*
 * CORE-112, defects D23 and D24: the formatters that print or abort on the week-of-year year.
 *
 * D24: CLDR 48 patterns for some locales and calendars use `Y` (the year of the week-of-year)
 * where `y` (the calendar year) is meant, so a date near a year end prints next year's number.
 * D23: V8 without commit 0426b0d1045d aborts the process (nodejs/node#67076) in `formatToParts`
 * and `formatRangeToParts` on such a pattern.
 *
 * This module is the only place in `src` that decides which formatters are affected. A formatter
 * that passes is returned as it is. Deleting this file, `weekYearSynth.ts`, `weekYearText.ts` and
 * the one hook line in `formatterCache.ts` retires the workaround (the D24 canary says when).
 */

/** The options that make a formatter print time. */
const TIME_KEYS = [
  "hour",
  "minute",
  "second",
  "fractionalSecondDigits",
  "dayPeriod",
  "timeZoneName",
  "timeStyle",
] as const;

/** The options that give a formatter a date pattern. */
const DATE_KEYS = [
  "era",
  "year",
  "month",
  "day",
  "weekday",
  "dateStyle",
] as const;

/** ECMA-402 CreateDateTimeFormat reads these to decide whether to add the date defaults. */
const FIELD_KEYS = [
  "weekday",
  "year",
  "month",
  "day",
  "dayPeriod",
  "hour",
  "minute",
  "second",
  "fractionalSecondDigits",
  "dateStyle",
  "timeStyle",
] as const;

/** At most this many verdicts; past it the map clears. */
const MAX_VERDICTS = 256;

const verdicts = new Map<string, boolean>();
let verdictsBuiltWith: unknown;

/** Forget every verdict (the `Intl.DateTimeFormat` constructor was replaced, a test seam). */
export function forgetWeekYearVerdicts(): void {
  verdicts.clear();
  verdictsBuiltWith = undefined;
  forgetWeekYearText();
  forgetWeekYearRange();
}

/**
 * Whether the formatter can print a year at all (ECMA-402 CreateDateTimeFormat, the `needDefaults`
 * step with required ~any~ and defaults ~date~: `era` is not one of the fields it checks, so
 * `{ era }` alone gets year, month and day).
 */
function printsYear(options: Intl.DateTimeFormatOptions): boolean {
  return (
    options.year !== undefined ||
    options.dateStyle !== undefined ||
    FIELD_KEYS.every((key) => options[key] === undefined)
  );
}

/** The noon of a date in UTC, as epoch milliseconds. */
function noonUtc(date: Temporal.PlainDate): number {
  return date.toZonedDateTime({ timeZone: "UTC", plainTime: "12:00" })
    .epochMilliseconds;
}

/**
 * The first day of calendar year `year` as the reference (ICU's own calendar) counts it: month 1
 * day 1 by Temporal, moved by at most four days until the reference's year changes there.
 */
function yearStart(
  reference: ReturnType<typeof referenceFor>,
  calendar: string,
  year: number,
): Temporal.PlainDate {
  const at = (date: Temporal.PlainDate) =>
    referenceYear(reference, noonUtc(date));
  const middle = at(dateIn(calendar, year, 1, 15));
  let start = dateIn(calendar, year, 1, 1);
  for (let step = 0; step < 4; step++) {
    const previous = start.subtract({ days: 1 });
    if (at(previous) !== at(start)) {
      break;
    }
    start = at(start) === middle ? previous : start.add({ days: 1 });
  }
  return start;
}

/**
 * Whether the year runs of a formatter hold a year other than the calendar year at a year
 * boundary: read from `format` alone, on the formatter or a UTC twin.
 *
 * @param format the formatter's (or its twin's) `format`
 */
function isWeekYear(
  format: (ms: number) => string,
  calendar: string,
  numberingSystem: string,
): boolean {
  const reference = referenceFor(calendar, numberingSystem, "UTC");
  const digits = new Set(
    new Intl.NumberFormat("und", {
      numberingSystem,
      useGrouping: false,
    }).format(1234567890),
  );
  const runsAt = (date: Temporal.PlainDate) =>
    digitRuns(format(noonUtc(date)), digits);
  const yearRuns = yearRunIndexes(calendar, runsAt);
  if (yearRuns === null || yearRuns.length === 0) {
    return false;
  }
  const first = anchorYear(calendar);
  for (let year = first + 1; year <= first + 3; year++) {
    const start = yearStart(reference, calendar, year);
    const last = start.subtract({ days: 1 });
    for (const [date, inside] of [
      [start, start.add({ days: 14 })],
      [last, last.subtract({ days: 14 })],
    ] as const) {
      const at = runsAt(date);
      const mid = runsAt(inside);
      if (
        at.length === mid.length &&
        !checkYearRuns(
          yearRuns,
          at,
          mid,
          referenceYear(reference, noonUtc(date)),
          referenceYear(reference, noonUtc(inside)),
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

/** The formatter's own, or a UTC date-only twin when a time field or a zone would move digits. */
function textSource(
  formatter: Intl.DateTimeFormat,
  options: Intl.DateTimeFormatOptions,
  resolved: Intl.ResolvedDateTimeFormatOptions,
): Intl.DateTimeFormat {
  if (
    resolved.timeZone === "UTC" &&
    TIME_KEYS.every((key) => options[key] === undefined)
  ) {
    return formatter;
  }
  const twin: Intl.DateTimeFormatOptions = {
    calendar: resolved.calendar,
    numberingSystem: resolved.numberingSystem,
    timeZone: "UTC",
  };
  for (const key of DATE_KEYS) {
    if (options[key] !== undefined) {
      Object.assign(twin, { [key]: options[key] });
    }
  }
  return new Intl.DateTimeFormat(resolved.locale, twin);
}

/** The verdict-cache key: the pattern, never the zone (a zone moves the instant, not the pattern). */
function verdictKey(
  options: Intl.DateTimeFormatOptions,
  resolved: Intl.ResolvedDateTimeFormatOptions,
): string | null {
  const entries = plainOptionEntries(options);
  if (entries === null) {
    return null;
  }
  const rest = entries.filter(([name]) => name !== "timeZone");
  return JSON.stringify([
    resolved.locale,
    resolved.calendar,
    resolved.numberingSystem,
    resolved.hourCycle ?? "",
    rest,
  ]);
}

/** Whether the text of this pattern prints a year other than the calendar year, remembered per pattern. */
function isFlagged(
  formatter: Intl.DateTimeFormat,
  options: Intl.DateTimeFormatOptions,
  resolved: Intl.ResolvedDateTimeFormatOptions,
): boolean {
  if (verdictsBuiltWith !== Intl.DateTimeFormat) {
    verdicts.clear();
    verdictsBuiltWith = Intl.DateTimeFormat;
  }
  const key = verdictKey(options, resolved);
  const known = key === null ? undefined : verdicts.get(key);
  if (known !== undefined) {
    return known;
  }
  const source = textSource(formatter, options, resolved);
  const flagged = isWeekYear(
    (ms) => source.format(ms),
    resolved.calendar,
    resolved.numberingSystem,
  );
  if (key !== null) {
    if (verdicts.size >= MAX_VERDICTS) {
      verdicts.clear();
    }
    verdicts.set(key, flagged);
  }
  return flagged;
}

/** A time value as `Intl` reads it: a number, a `Date`, or `undefined` for now. */
function toMilliseconds(date: Date | number | undefined): number {
  if (typeof date === "number") {
    return date;
  }
  return date === undefined ? nowInstant().epochMilliseconds : Number(date);
}

/** The formatter that stands in for a flagged one; `format` and the parts hold the calendar year. */
function guarded(
  native: Intl.DateTimeFormat,
  options: Intl.DateTimeFormatOptions,
  resolved: Intl.ResolvedDateTimeFormatOptions,
  crashes: boolean,
): Intl.DateTimeFormat {
  let analysis: WeekYearAnalysis | null | undefined;
  const read = (): WeekYearAnalysis | null => {
    analysis ??= analyse((ms) => native.format(ms), resolved);
    return analysis;
  };
  const repaired = (ms: number): RepairedText | null => {
    const read1 = read();
    return read1 === null ? null : repairText(read1, native.format(ms), ms);
  };
  let synth: ((ms: number) => Intl.DateTimeFormatPart[] | null) | undefined;
  const standIn = {
    format(date?: Date | number): string {
      const ms = toMilliseconds(date);
      return repaired(ms)?.text ?? native.format(ms);
    },
    formatToParts(date?: Date | number): Intl.DateTimeFormatPart[] {
      const ms = toMilliseconds(date);
      const text = repaired(ms);
      if (text === null) {
        return [];
      }
      if (!crashes && options.dateStyle === undefined) {
        const patched = patchYearParts(native.formatToParts(ms), text);
        if (patched !== null) {
          return patched;
        }
      }
      const known = read();
      if (known === null) {
        return [];
      }
      synth ??= createPartsSynth(options, resolved, known, repaired);
      return synth(ms) ?? [];
    },
    formatRange(start: Date | number, end: Date | number): string {
      // Slice 3c: the range pattern is another pattern, so the year is repaired here too. `null`
      // (a year run that cannot be located) is the empty string, as in the library's range
      // functions.
      return (
        formatRangeChecked(
          native,
          options,
          toMilliseconds(start),
          toMilliseconds(end),
        ) ?? ""
      );
    },
    formatRangeToParts(): never {
      throw new TypeError(
        "formatRangeToParts is not available on a formatter that can print the week-year (CORE-112)",
      );
    },
    resolvedOptions(): Intl.ResolvedDateTimeFormatOptions {
      const own = native.resolvedOptions();
      const known = read();
      if (own.year !== undefined || known === null) {
        return own;
      }
      return {
        ...own,
        year: known.styles[0]?.kind === "two" ? "2-digit" : "numeric",
      };
    },
  };
  markRangeHandled(standIn);
  return standIn as Intl.DateTimeFormat;
}

/**
 * The formatter itself when its pattern cannot print the week-of-year year (defects D23, D24),
 * else a formatter whose year is the calendar year and whose parts never reach the engine's `Y`
 * field.
 *
 * @param formatter the formatter just built
 * @param callerOptions the options it was built with; options that are not plain values are
 * left unguarded
 * @returns the formatter, or its stand-in
 *
 * @example guardDateTimeFormat(new Intl.DateTimeFormat("en", { year: "numeric" }), { year: "numeric" }) // the same formatter
 * @example guardDateTimeFormat(new Intl.DateTimeFormat("gd", { year: "numeric", month: "short", timeZone: "UTC" }), { year: "numeric", month: "short", timeZone: "UTC" }).format(Date.UTC(2024, 11, 30)) // "Dùbh 2024"
 */
export function guardDateTimeFormat(
  formatter: Intl.DateTimeFormat,
  callerOptions: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  // Options with a getter or a value `Intl` coerces by running caller code are never read again
  // here (`formatterCache` builds no key from them either). Library code snapshots a caller's
  // options into plain values first, so this is only a hand-built object.
  const entries = plainOptionEntries(callerOptions);
  if (entries === null) {
    return formatter;
  }
  const options: Intl.DateTimeFormatOptions = Object.fromEntries(entries);
  if (!printsYear(options)) {
    return formatter;
  }
  try {
    const resolved = formatter.resolvedOptions();
    // Unfixed V8 resolves a pattern with `Y` without `year`; the fix reports it (0426b0d1045d). The
    // two cyclic calendars have no year letter V8 lists, and V8 handles them in parts.
    const crashes =
      options.dateStyle === undefined &&
      resolved.year === undefined &&
      resolved.calendar !== "chinese" &&
      resolved.calendar !== "dangi";
    if (!crashes && !isFlagged(formatter, options, resolved)) {
      return formatter;
    }
    return guarded(formatter, options, resolved, crashes);
  } catch {
    return formatter;
  }
}
