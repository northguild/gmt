import { Temporal } from "./temporal";
import {
  isIslamicEraCompatNeeded,
  isJapaneseEraCompatNeeded,
  isJapaneseTwoDigitYearCompatNeeded,
  isRelatedYearWidthCompatNeeded,
} from "./temporalCompat/capabilities";
import { nowInstant } from "./temporalCompat/clock";
import { formatRangeChecked, markRangeHandled } from "./weekYearRange";
import { type DigitRun, digitRuns, digitSetOf, digitsOf } from "./weekYearText";

/*
 * CORE-112 slice 7, defects D25 to D28: years an engine prints wrongly outside the week-year.
 *
 * Each repair is dormant behind one cached engine probe (`temporalCompat/capabilities.ts`), and a
 * formatter is wrapped only when its probe fails and the formatter can show the defect, so a fixed
 * engine runs no per-format work. One wrapper holds D25, D26 and D27 (each needs the date of the
 * call, and a formatter has one calendar, so at most two apply); D28 is a change of the options a
 * formatter is built with. Every replacement text comes from the engine's own formatters or
 * `Intl.NumberFormat`: GMT owns no era name, digit or locale datum. Deleting this file, its hook in
 * `formatterCache.ts` and the four probes retires the workaround.
 *
 * - D25 (ICU-23341, ICU-23619): the japanese calendar prints Japanese eras before 1873-01-01. Intl
 *   era/monthCode Table 2 as amended by tc39/proposal-intl-era-monthcode#86 (test262
 *   tc39/test262#4877) uses the Gregorian eras up to and including 1872-12-31. Those dates format
 *   through a `calendar: "gregory"` twin.
 * - D26 (ICU-23327): an islamic calendar prints a date before the Hijra as a negative year; the
 *   specification gives the era `bh`, which this engine cannot name, so the date has no printable
 *   year and the house empty value answers (`""`, or `[]` for parts).
 * - D27 (ICU-23620): `year: "2-digit"` in `ja` japanese leaves the era year unpadded.
 *   ECMA-402 FormatDateTimePattern pads it to two digits; year 1 stays 元 (owner decision).
 * - D28 (ICU-23621): `year: "2-digit"` in chinese and dangi pads the related year, which ECMA-402 prints at
 *   full width. The formatter is built with `year: "numeric"`, the same pattern at full width.
 */

/** The options that give a formatter a date pattern when none of these is set. */
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

/** Whether the formatter can print an era or a year (ECMA-402 CreateDateTimeFormat defaults). */
function showsEraOrYear(options: Intl.DateTimeFormatOptions): boolean {
  return (
    options.era !== undefined ||
    options.year !== undefined ||
    options.dateStyle !== undefined ||
    FIELD_KEYS.every((key) => options[key] === undefined)
  );
}

/** A time value as `Intl` reads it: a number, a `Date`, or `undefined` for now. */
function toMilliseconds(date: Date | number | undefined): number {
  if (typeof date === "number") {
    return date;
  }
  return date === undefined ? nowInstant().epochMilliseconds : Number(date);
}

/** The first date the japanese calendar prints a Japanese era for: ISO 1873 (Meiji 6). */
const FIRST_JAPANESE_ERA_YEAR = 1873;

/** The year shifts D27 tries to find an endpoint the same day of the year, at the same time. */
const SHIFTS = [4, 8, 12, 16, 20, 24, 28, 32, 36, 40] as const;

/**
 * The options a chinese or dangi formatter is built with: `year: "2-digit"` becomes `"numeric"`
 * when the engine pads the related year (D28), else the options as given.
 *
 * @param callerOptions the options the formatter was asked for
 * @param calendar the calendar the formatter resolved
 * @returns the options to build with
 *
 * @example widenRelatedYear({ year: "2-digit" }, "chinese") // { year: "numeric" } where the engine pads the related year
 * @example widenRelatedYear({ year: "2-digit" }, "gregory") // { year: "2-digit" }
 */
export function widenRelatedYear(
  callerOptions: Intl.DateTimeFormatOptions,
  calendar: string,
): Intl.DateTimeFormatOptions {
  if (
    callerOptions.year === "2-digit" &&
    (calendar === "chinese" || calendar === "dangi") &&
    isRelatedYearWidthCompatNeeded()
  ) {
    return { ...callerOptions, year: "numeric" };
  }
  return callerOptions;
}

/**
 * The starts of the one-digit runs of `runs` whose text differs in `other`'s runs, when `other` has
 * as many runs (else none: a year printed as 元 changed the count).
 */
function changedSingleDigits(
  runs: readonly DigitRun[],
  other: string | null,
  digitSet: ReadonlySet<string>,
): number[] {
  const moved = other === null ? [] : digitRuns(other, digitSet);
  if (moved.length !== runs.length) {
    return [];
  }
  return runs
    .filter(
      (run, index) => run.text.length === 1 && run.text !== moved[index]?.text,
    )
    .map((run) => run.start);
}

/** The text with `zero` written before each run that starts at one of `starts`. */
function insertZeros(
  text: string,
  runs: readonly DigitRun[],
  starts: ReadonlySet<number>,
  zero: string,
): string {
  return runs
    .filter((run) => starts.has(run.start))
    .toReversed()
    .reduce(
      (out, run) => out.slice(0, run.start) + zero + out.slice(run.start),
      text,
    );
}

/** The ISO year (in the formatter's zone) and the Hijra check of an instant. */
function zonedAt(ms: number, timeZone: string): Temporal.ZonedDateTime {
  return Temporal.Instant.fromEpochMilliseconds(ms).toZonedDateTimeISO(
    timeZone,
  );
}

/**
 * The formatter itself, or a wrapper that repairs the years of D25, D26 and D27 where the engine
 * prints them wrongly.
 *
 * @param formatter the formatter the week-year guard returned
 * @param callerOptions the options it was built with
 * @param twinOf the cached formatter for other options and the same locale (a Gregorian twin)
 * @returns the formatter, or its wrapper
 *
 * @example repairYearPrinting(new Intl.DateTimeFormat("en", { year: "numeric" }), { year: "numeric" }, () => new Intl.DateTimeFormat("en")) // the same formatter
 * @example repairYearPrinting(new Intl.DateTimeFormat("ja-u-ca-japanese", { year: "2-digit", timeZone: "UTC" }), { year: "2-digit", timeZone: "UTC" }, () => new Intl.DateTimeFormat("ja")).format(Date.UTC(2024, 6, 10)) // "令和06年" where the engine prints 令和6年
 */
export function repairYearPrinting(
  formatter: Intl.DateTimeFormat,
  callerOptions: Intl.DateTimeFormatOptions,
  twinOf: (options: Intl.DateTimeFormatOptions) => Intl.DateTimeFormat,
): Intl.DateTimeFormat {
  let resolved: Intl.ResolvedDateTimeFormatOptions;
  try {
    resolved = formatter.resolvedOptions();
  } catch {
    return formatter;
  }
  const { calendar, timeZone, numberingSystem } = resolved;
  const japanese = calendar === "japanese";
  const era =
    japanese && showsEraOrYear(callerOptions) && isJapaneseEraCompatNeeded();
  const islamic =
    calendar.startsWith("islamic") &&
    showsEraOrYear(callerOptions) &&
    isIslamicEraCompatNeeded();
  const pad =
    japanese &&
    callerOptions.year === "2-digit" &&
    new Intl.Locale(resolved.locale).language === "ja" &&
    isJapaneseTwoDigitYearCompatNeeded();
  if (!era && !islamic && !pad) {
    return formatter;
  }
  const zero = digitsOf(numberingSystem)[0] ?? "0";
  const digitSet = digitSetOf(numberingSystem);
  let gregorian: Intl.DateTimeFormat | undefined;
  const twin = (): Intl.DateTimeFormat =>
    (gregorian ??= twinOf({ ...callerOptions, calendar: "gregory" }));

  /** D25: the instant is before the first Japanese era (ISO year in the formatter's zone). */
  const beforeEras = (ms: number): boolean =>
    era && zonedAt(ms, timeZone).year < FIRST_JAPANESE_ERA_YEAR;

  /** D26: the instant is before the Hijra, decided by Temporal (era `bh`, or year 0 or less). */
  const beforeHijra = (ms: number): boolean => {
    if (!islamic) {
      return false;
    }
    try {
      const date = zonedAt(ms, timeZone).withCalendar(calendar);
      return date.era === "bh" || date.year <= 0;
    } catch {
      return false;
    }
  };

  /** D27: an era year printed with one digit gains the formatter's own zero (never 元). */
  const padPart = (part: Intl.DateTimeFormatPart): Intl.DateTimeFormatPart =>
    part.type === "year" && digitSet.has(part.value) && part.value.length === 1
      ? { ...part, value: zero + part.value }
      : part;

  /** The instants shifted by whole years that keep date and time, or `null` when none does. */
  const shiftOf = (ms: number): number | null => {
    const start = zonedAt(ms, timeZone);
    for (const years of SHIFTS) {
      const moved = start.add({ years });
      if (
        moved.month === start.month &&
        moved.day === start.day &&
        moved.toPlainTime().equals(start.toPlainTime())
      ) {
        return moved.epochMilliseconds;
      }
    }
    return null;
  };

  /**
   * D27 in a range: the digit run that changes when an endpoint moves by whole years is an era
   * year; one digit gains a zero. Each way of moving the endpoints (both, only the first, only the
   * second) counts only when the number of digit runs is the same, so a year that prints as 元 is
   * left alone.
   */
  const paddedRange = (text: string, a: number, b: number): string => {
    const shiftedA = shiftOf(a);
    const shiftedB = shiftOf(b);
    if (shiftedA === null || shiftedB === null) {
      return text;
    }
    const runs = digitRuns(text, digitSet);
    const starts = new Set<number>();
    for (const [x, y] of [
      [shiftedA, shiftedB],
      [shiftedA, b],
      [a, shiftedB],
    ] as const) {
      const other = formatRangeChecked(formatter, callerOptions, x, y);
      for (const start of changedSingleDigits(runs, other, digitSet)) {
        starts.add(start);
      }
    }
    return insertZeros(text, runs, starts, zero);
  };

  const standIn = {
    format(date?: Date | number): string {
      const ms = toMilliseconds(date);
      if (beforeHijra(ms)) {
        return "";
      }
      if (beforeEras(ms)) {
        return twin().format(ms);
      }
      return pad
        ? formatter
            .formatToParts(ms)
            .map((part) => padPart(part).value)
            .join("")
        : formatter.format(ms);
    },
    formatToParts(date?: Date | number): Intl.DateTimeFormatPart[] {
      const ms = toMilliseconds(date);
      if (beforeHijra(ms)) {
        return [];
      }
      if (beforeEras(ms)) {
        return twin().formatToParts(ms);
      }
      const parts = formatter.formatToParts(ms);
      return pad ? parts.map(padPart) : parts;
    },
    formatRange(start: Date | number, end: Date | number): string {
      const a = toMilliseconds(start);
      const b = toMilliseconds(end);
      if (beforeHijra(a) || beforeHijra(b)) {
        return "";
      }
      // A range that starts or ends before 1873 prints in one calendar, the Gregorian one.
      const text =
        beforeEras(a) || beforeEras(b)
          ? formatRangeChecked(twin(), callerOptions, a, b)
          : formatRangeChecked(formatter, callerOptions, a, b);
      if (text === null) {
        return "";
      }
      return pad && !(beforeEras(a) || beforeEras(b))
        ? paddedRange(text, a, b)
        : text;
    },
    formatRangeToParts(): never {
      throw new TypeError(
        "formatRangeToParts is not available on a formatter whose years are repaired (CORE-112)",
      );
    },
    resolvedOptions(): Intl.ResolvedDateTimeFormatOptions {
      return resolved;
    },
  };
  markRangeHandled(standIn);
  return standIn as Intl.DateTimeFormat;
}
