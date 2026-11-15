import { Temporal } from "./temporal";
import {
  isIslamicEraCompatNeeded,
  isJapaneseEraCompatNeeded,
  isJapaneseTwoDigitYearCompatNeeded,
  isRelatedYearWidthCompatNeeded,
} from "./temporalCompat/capabilities";
import { nowInstant } from "./temporalCompat/clock";
import { markRangeHandled, rangeHooks } from "./rangeHooks";
import { digitSetOf, digitsOf } from "./weekYearText";

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
 * - D27 (ICU-23620): `year: "2-digit"` in `ja` japanese leaves the era year unpadded, and its
 *   `jpanyear` numbering ignores `nu`. ECMA-402 FormatDateTimePattern pads it to two digits and
 *   prints it in the resolved numbering system (FormatNumeric); year 1 stays 元 (owner decision).
 * - D28 (ICU-23621): `year: "2-digit"` in chinese and dangi pads the related year, which ECMA-402 prints at
 *   full width. The formatter is built with `year: "numeric"`, the same pattern at full width.
 * - D25 and D27 in a range are `yearPrintingRange.ts`, installed by `rangeFields.ts` through
 *   `rangeHooks.ts`, so single formatting carries none of it.
 * - D29 (`rangeFields.ts`) and D30 (`formatterCache.ts`) are repaired beside this module: a range
 *   that drops, repeats or garbles a field is written from its two singles, and `islamic` and
 *   `islamic-rgsa` resolve as Intl era/monthCode CreateDateTimeFormat says.
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
export function showsEraOrYear(options: Intl.DateTimeFormatOptions): boolean {
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

/** The ISO year (in the formatter's zone) and the Hijra check of an instant. */
function zonedAt(ms: number, timeZone: string): Temporal.ZonedDateTime {
  return Temporal.Instant.fromEpochMilliseconds(ms).toZonedDateTimeISO(
    timeZone,
  );
}

/**
 * Where a japanese pattern puts its era relative to the year: after it or before it, and the
 * literal between them. `null` when the pattern prints no era. Read from the engine's own parts of
 * a date after 1873 (the era of a date before it is what the twin supplies).
 */
function eraSeatOf(
  formatter: Intl.DateTimeFormat,
): { after: boolean; glue: string } | null {
  try {
    const parts = formatter.formatToParts(1720569600000); // 2024-07-10
    const era = parts.findIndex((part) => part.type === "era");
    const year = parts.findIndex((part) => part.type === "year");
    if (era < 0 || year < 0) {
      return null;
    }
    const between = parts.slice(Math.min(era, year) + 1, Math.max(era, year));
    return {
      after: era > year,
      glue:
        between.length === 1 && between[0]?.type === "literal"
          ? between[0].value
          : "",
    };
  } catch {
    return null;
  }
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
  const styled =
    callerOptions.dateStyle !== undefined ||
    callerOptions.timeStyle !== undefined;
  // The japanese pattern prints an era with its year, so the twin of a date before 1873 does too
  // (`1872 AD`): a field pattern gets `era: "short"`; a style pattern cannot be combined with
  // `era`, so the era is written where the japanese pattern puts it (`eraSplice`).
  const eraSeat =
    era && callerOptions.era === undefined ? eraSeatOf(formatter) : null;
  let gregorian: Intl.DateTimeFormat | undefined;
  const twin = (): Intl.DateTimeFormat =>
    (gregorian ??= twinOf({
      ...callerOptions,
      calendar: "gregory",
      ...(eraSeat !== null && !styled ? { era: "short" as const } : {}),
    }));
  let eraName: Intl.DateTimeFormat | undefined;
  const japaneseForms: Intl.DateTimeFormat[] = [];
  const japaneseEraNames = (ms: number): string[] => {
    if (japaneseForms.length === 0) {
      for (const era of ["long", "short", "narrow"] as const) {
        japaneseForms.push(
          twinOf({ calendar: "japanese", era, year: "numeric", timeZone }),
        );
      }
    }
    const names = japaneseForms.flatMap((form) =>
      form
        .formatToParts(ms)
        .filter((part) => part.type === "era" && part.value !== "")
        .map((part) => part.value),
    );
    return [...new Set(names)].toSorted((x, y) => y.length - x.length);
  };
  const eraPart = (ms: number): Intl.DateTimeFormatPart | undefined => {
    eraName ??= twinOf({
      calendar: "gregory",
      era: "short",
      year: "numeric",
      timeZone,
    });
    return eraName.formatToParts(ms).find((part) => part.type === "era");
  };
  /** The twin's parts of a date before 1873, with the Gregorian era added to a style pattern. */
  const twinParts = (ms: number): Intl.DateTimeFormatPart[] => {
    const parts = twin().formatToParts(ms);
    if (eraSeat === null || !styled) {
      return parts;
    }
    const name = eraPart(ms);
    const at = parts.findIndex((part) => part.type === "year");
    if (name === undefined || at < 0) {
      return parts;
    }
    const extra: Intl.DateTimeFormatPart[] = eraSeat.after
      ? [
          ...(eraSeat.glue
            ? [{ type: "literal" as const, value: eraSeat.glue }]
            : []),
          name,
        ]
      : [
          name,
          ...(eraSeat.glue
            ? [{ type: "literal" as const, value: eraSeat.glue }]
            : []),
        ];
    return parts.toSpliced(eraSeat.after ? at + 1 : at, 0, ...extra);
  };
  const twinText = (ms: number): string =>
    eraSeat !== null && styled
      ? twinParts(ms)
          .map((part) => part.value)
          .join("")
      : twin().format(ms);

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

  const standIn: Intl.DateTimeFormat = {
    format(date?: Date | number): string {
      const ms = toMilliseconds(date);
      if (beforeHijra(ms)) {
        return "";
      }
      if (beforeEras(ms)) {
        return twinText(ms);
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
        return twinParts(ms);
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
      const hooks = rangeHooks();
      if (hooks === undefined) {
        return formatter.formatRange(a, b);
      }
      const text = hooks.yearRange(
        {
          formatter,
          options: callerOptions,
          resolved,
          twin,
          eraNameOf: (ms) => eraPart(ms)?.value ?? null,
          japaneseEraNames,
          twinText,
          eraSeat: eraSeat !== null,
          styled,
          pad,
          single: (ms) => standIn.format(ms),
          zero,
          digitSet,
          shiftOf,
        },
        a,
        b,
        [beforeEras(a), beforeEras(b)],
      );
      return text ?? "";
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
  return standIn;
}
