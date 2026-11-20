import { markRangeHandled, rangeHooks } from "./rangeHooks";
import { Temporal } from "./temporal";
import {
  isCopticEpochEraCompatNeeded,
  isCopticEraCompatNeeded,
} from "./temporalCompat/capabilities";
import { digitRuns, digitSetOf, digitsOf, type DigitRun } from "./weekYearText";
import { showsEraOrYear, toMilliseconds } from "./yearPrinting";

/*
 * CORE-112, defect D31 (ICU-23277): the coptic calendar has one era, `am`, for every year (Intl
 * era/monthCode Table 2: eraYear -infinity to +infinity; 4.1.12: eraYear is year; test262
 * intl402/Temporal/PlainDate/from/non-positive-single-era-year.js keeps coptic eraYear -1 as -1).
 * ISO -000001-07-10 is coptic `-285 AM`. An ICU that still carries a second era prints `1 - year`
 * (286) and an empty era for a date before AM 1.
 *
 * The repair is dormant behind `isCopticEraCompatNeeded()`, and a formatter is wrapped only when
 * it is coptic and can show an era or a year. A call is repaired only when Temporal says the date's
 * coptic year is 0 or less. The date is shifted forward by whole 28-year cycles (28 coptic years
 * are 10227 days, exactly 1461 weeks, so month, day, weekday, leap status and time of day all
 * stay): the engine then prints the pattern, the era name and the era's place in its own words,
 * and only the year is written here, signed with the locale's minus in the formatter's numbering
 * system (`Intl.NumberFormat`). GMT owns no digit, minus sign or era name. A range is written the
 * same way: the shifted range and the range one cycle later differ only in their year runs, which
 * are then replaced. A fixed engine prints the same text, so deleting this file, its hook in
 * `formatterCache.ts` and the probe retires the workaround without changing an output.
 *
 * Defect D34 (WebKit 331724, fixed by WebKit/WebKit#81144) has a second source for the same
 * repair. 4.1.12 reads the era from the calendar date, so every instant of 1 Tout AM 1 (ISO
 * 0284-08-29) prints the era `am`. JavaScriptCore compares the instant with a fixed constant
 * (0284-08-29T07:52:58Z) and prints `Anno Martyrum` for the first hours of the day. The repair is
 * dormant behind `isCopticEpochEraCompatNeeded()`: an instant whose local date is that day is
 * moved by the same cycles, the engine names the era, and the year is written back as 1.
 */

/** The ISO date of 1 Tout AM 1: coptic year 1, month 1, day 1 (Calendrical Calculations, chapter 4). */
const EPOCH_DAY = "0284-08-29";

/** The instant JavaScriptCore changes the coptic era at (WebKit bug 331724): 0284-08-29T07:52:58Z. */
const ENGINE_ERA_SWITCH_MS = Temporal.Instant.from(
  "0284-08-29T07:52:58Z",
).epochMilliseconds;

/** The days in 28 coptic years: 1461 whole weeks, so a weekday survives the shift. */
const CYCLE_DAYS = 10227;

/** The coptic years in one cycle. */
const CYCLE_YEARS = 28;

/** The first year a date is moved to or past: four digits, so a `2-digit` pattern shows. */
const SHIFT_TO_YEAR = 1000;

/**
 * The Ethiopian Amete Alem year less this is the coptic year (Calendrical Calculations, chapter 4;
 * the polyfill cannot read `coptic` before AM 1, `ethioaa` it can).
 */
const COPTIC_YEAR_BIAS = 5776;

/** The Temporal coptic year of an instant in a zone, or `null` when the instant cannot be read. */
function copticYearAt(ms: number, timeZone: string): number | null {
  try {
    return (
      Temporal.Instant.fromEpochMilliseconds(ms)
        .toZonedDateTimeISO(timeZone)
        .withCalendar("ethioaa").year - COPTIC_YEAR_BIAS
    );
  } catch {
    return null;
  }
}

/** The instant `cycles` cycles later at the same wall-clock time, or `null` when there is none. */
function shiftedBy(
  ms: number,
  timeZone: string,
  cycles: number,
): number | null {
  try {
    const start =
      Temporal.Instant.fromEpochMilliseconds(ms).toZonedDateTimeISO(timeZone);
    const moved = start.add({ days: CYCLE_DAYS * cycles });
    return moved.toPlainTime().equals(start.toPlainTime())
      ? moved.epochMilliseconds
      : null;
  } catch {
    return null;
  }
}

/** The cycles that bring a coptic year to `SHIFT_TO_YEAR` or later. */
function cyclesFor(year: number): number {
  return Math.ceil((SHIFT_TO_YEAR - year) / CYCLE_YEARS);
}

/** The value of a digit run, in a numbering system's digit table. */
function valueOf(run: string, table: readonly string[]): number {
  let value = 0;
  for (const character of run) {
    value = value * 10 + Math.max(0, table.indexOf(character));
  }
  return value;
}

/**
 * Whether D34 can print an instant of coptic year 1 in the wrong era: its local date is 1 Tout AM 1,
 * or it is a later date of year 1 that is still before the engine's fixed instant (a zone east of
 * +16:07:02 reaches 1 Tout 2 AM 1 before 0284-08-29T07:52:58Z).
 */
function isEpochDay(ms: number, timeZone: string): boolean {
  try {
    const date = Temporal.Instant.fromEpochMilliseconds(ms)
      .toZonedDateTimeISO(timeZone)
      .toPlainDate();
    return (
      date.equals(EPOCH_DAY) ||
      (ms < ENGINE_ERA_SWITCH_MS &&
        Temporal.PlainDate.compare(date, EPOCH_DAY) > 0)
    );
  } catch {
    return false;
  }
}

/**
 * Whether the engine can print an instant in the wrong era: its year is 0 or less while D31 holds,
 * or its local date is 1 Tout AM 1 while D34 holds.
 */
function atRisk(
  ms: number,
  timeZone: string,
  year: number,
  signed: boolean,
): boolean {
  return (
    (signed && year <= 0) ||
    (year === 1 && isCopticEpochEraCompatNeeded() && isEpochDay(ms, timeZone))
  );
}

/**
 * The instant a coptic date on 1 Tout AM 1 is read at instead, with its true year (1), or `null`:
 * the engine has no D34, the local date is not that day, or no same-time twin exists. The twin is
 * one or more whole 28-year cycles later, so the engine names the era `am` and prints the same
 * month, day, weekday and time.
 *
 * @example copticEpochTwin(Date.UTC(284, 7, 29), "UTC") // { ms: 36 cycles later, year: 1 } on WebKit, null elsewhere
 */
export function copticEpochTwin(
  ms: number,
  timeZone: string,
): { readonly ms: number; readonly year: number } | null {
  if (!isCopticEpochEraCompatNeeded() || !isEpochDay(ms, timeZone)) {
    return null;
  }
  const moved = shiftedBy(ms, timeZone, cyclesFor(1));
  return moved === null ? null : { ms: moved, year: 1 };
}

/**
 * The instant the D29 field reader reads a coptic instant at instead, with its true year, or
 * `null` when the engine's own reading is right. An instant on 1 Tout AM 1 is read at its D34 twin
 * (year 1); while D31 holds, an instant whose coptic year is 0 or less is read one or more cycles
 * later, so the engine names the era `am` where it would name the wrong one (D31), and the year is
 * the true, signed one.
 *
 * @example copticFieldTwin(Date.UTC(284, 7, 28), "UTC") // { ms: 36 cycles later, year: 0 } while D31 holds, null elsewhere
 */
export function copticFieldTwin(
  ms: number,
  timeZone: string,
): { readonly ms: number; readonly year: number } | null {
  const epoch = copticEpochTwin(ms, timeZone);
  if (epoch !== null || !isCopticEraCompatNeeded()) {
    return epoch;
  }
  const year = copticYearAt(ms, timeZone);
  if (year === null || year > 0) {
    return null;
  }
  const moved = shiftedBy(ms, timeZone, cyclesFor(year));
  return moved === null ? null : { ms: moved, year };
}

/** One endpoint of a range: its instant, its coptic year, and whether that year is before AM 1. */
interface Endpoint {
  readonly ms: number;
  readonly year: number;
  readonly before: boolean;
}

/** A year the engine printed for a moved end, beside the year the end really has. */
interface Printed {
  readonly year: number;
  readonly printed: number;
}

/**
 * The years the engine printed in a moved range, in text order: each end's true year plus the
 * cycles it moved. Two ends in one year print one run, so `count` decides whether they merge.
 * `null` when the runs that changed do not match the ends that moved.
 */
function wantedYears(
  ends: readonly [Endpoint, Endpoint],
  cycles: readonly [number, number],
  count: number,
): Printed[] | null {
  const moved = ends.flatMap((point, at) =>
    cycles[at] === 0
      ? []
      : [
          {
            year: point.year,
            printed: point.year + CYCLE_YEARS * (cycles[at] as number),
          },
        ],
  );
  const sameYear = moved.length === 2 && moved[0]?.year === moved[1]?.year;
  const wanted = sameYear && count === 1 ? moved.slice(0, 1) : moved;
  return count === wanted.length ? wanted : null;
}

/**
 * Writes each true year over the run the engine printed for it. A run that does not hold the value
 * the cycles predict is not a year, and the whole text is given up (`""`).
 */
function replaceYears(
  text: string,
  changed: readonly DigitRun[],
  wanted: readonly Printed[],
  table: readonly string[],
  yearText: (year: number, twoDigit: boolean) => string,
): string {
  const twoDigit = changed.every((run) => [...run.text].length <= 2);
  let result = text;
  for (const [at, run] of [...changed.entries()].toReversed()) {
    const target = wanted[at];
    const printed = valueOf(run.text, table);
    if (
      target === undefined ||
      printed !== (twoDigit ? target.printed % 100 : target.printed)
    ) {
      return "";
    }
    result =
      result.slice(0, run.start) +
      yearText(target.year, twoDigit) +
      result.slice(run.end);
  }
  return result;
}

/**
 * The two endpoints of a range moved forward `extra` cycles past the first shift, with each end's
 * cycle count (0 when it stays). Both move together, so the range keeps its pattern; when that
 * cannot be done (the date range ends) only the ends before AM 1 move.
 */
function moveRange(
  [a, b]: readonly [Endpoint, Endpoint],
  timeZone: string,
  extra: number,
): { ends: [number, number]; cycles: [number, number] } | null {
  const common = cyclesFor(Math.min(a.year, b.year)) + extra;
  const together = [
    shiftedBy(a.ms, timeZone, common),
    shiftedBy(b.ms, timeZone, common),
  ];
  if (together[0] !== null && together[1] !== null) {
    return { ends: [together[0], together[1]], cycles: [common, common] };
  }
  const cyclesOf = (end: Endpoint): number =>
    end.before ? cyclesFor(end.year) + extra : 0;
  const own = [a, b].map((end) =>
    end.before ? shiftedBy(end.ms, timeZone, cyclesOf(end)) : end.ms,
  );
  return own[0] !== null && own[1] !== null
    ? { ends: [own[0], own[1]], cycles: [cyclesOf(a), cyclesOf(b)] }
    : null;
}

/**
 * The formatter itself, or a wrapper that prints a coptic date before AM 1 with its signed year and
 * the era the engine names for AM, where the engine prints `1 - year` and no era (D31).
 *
 * @param formatter the formatter the earlier repairs returned
 * @param callerOptions the options it was built with
 * @returns the formatter, or its wrapper
 *
 * @example repairCopticEra(new Intl.DateTimeFormat("en-u-ca-gregory"), {}) // the same formatter
 * @example repairCopticEra(new Intl.DateTimeFormat("en-u-ca-coptic", { era: "short", year: "numeric", timeZone: "UTC" }), { era: "short", year: "numeric", timeZone: "UTC" }).format(Date.UTC(-1, 6, 10)) // "-285 AM" where the engine prints "286 "
 */
export function repairCopticEra(
  formatter: Intl.DateTimeFormat,
  callerOptions: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  let resolved: Intl.ResolvedDateTimeFormatOptions;
  try {
    resolved = formatter.resolvedOptions();
  } catch {
    return formatter;
  }
  const signed = isCopticEraCompatNeeded();
  if (
    resolved.calendar !== "coptic" ||
    !showsEraOrYear(callerOptions) ||
    !(signed || isCopticEpochEraCompatNeeded())
  ) {
    return formatter;
  }
  const { timeZone, numberingSystem, locale } = resolved;
  const table = digitsOf(numberingSystem);
  const digitSet = digitSetOf(numberingSystem);
  const numberOptions = { numberingSystem, useGrouping: false } as const;
  const full = new Intl.NumberFormat(locale, numberOptions);
  const two = new Intl.NumberFormat(locale, {
    ...numberOptions,
    minimumIntegerDigits: 2,
  });
  const negative = full.format(-1);
  const minus = negative.slice(0, negative.search(/\p{Nd}/u));

  const endpointOf = (ms: number): Endpoint | null => {
    const year = copticYearAt(ms, timeZone);
    return year === null
      ? null
      : { ms, year, before: atRisk(ms, timeZone, year, signed) };
  };

  /** A coptic year as ECMA-402 FormatNumeric writes it: signed, `2-digit` the last two digits. */
  const yearText = (year: number, twoDigit: boolean): string =>
    (year < 0 ? minus : "") +
    (twoDigit ? two.format(Math.abs(year) % 100) : full.format(Math.abs(year)));

  const partsOf = (ms: number): Intl.DateTimeFormatPart[] => {
    const point = endpointOf(ms);
    if (point === null || !point.before) {
      return formatter.formatToParts(ms);
    }
    const { year } = point;
    const moved = shiftedBy(ms, timeZone, cyclesFor(year));
    if (moved === null) {
      return formatter.formatToParts(ms);
    }
    return formatter
      .formatToParts(moved)
      .map((part) =>
        part.type === "year"
          ? { ...part, value: yearText(year, [...part.value].length <= 2) }
          : part,
      );
  };

  const rangeOf = (a: number, b: number): string => {
    const hooks = rangeHooks();
    return (
      (hooks ? hooks.checked(formatter, callerOptions, a, b) : null) ??
      formatter.formatRange(a, b)
    );
  };

  const repairedRange = (start: number, end: number): string => {
    const from = endpointOf(start);
    const to = endpointOf(end);
    if (from === null || to === null || !(from.before || to.before)) {
      return rangeOf(start, end);
    }
    const ends = [from, to] as const;
    const first = moveRange(ends, timeZone, 0);
    const later = moveRange(ends, timeZone, 1);
    if (first === null || later === null) {
      return "";
    }
    const text = rangeOf(...first.ends);
    const runs = digitRuns(text, digitSet);
    const twins = digitRuns(rangeOf(...later.ends), digitSet);
    if (runs.length !== twins.length) {
      return "";
    }
    const changed = runs.filter((run, at) => run.text !== twins[at]?.text);
    const wanted = wantedYears(ends, first.cycles, changed.length);
    return wanted === null
      ? ""
      : replaceYears(text, changed, wanted, table, yearText);
  };

  const standIn: Intl.DateTimeFormat = {
    format(date?: Date | number): string {
      return partsOf(toMilliseconds(date))
        .map((part) => part.value)
        .join("");
    },
    formatToParts(date?: Date | number): Intl.DateTimeFormatPart[] {
      return partsOf(toMilliseconds(date));
    },
    formatRange(start: Date | number, end: Date | number): string {
      return repairedRange(toMilliseconds(start), toMilliseconds(end));
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
