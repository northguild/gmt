// fallow-ignore-file code-duplication -- sibling of copticEra.ts (D31): each era repair keeps its own guard, shift and stand-in; the shared parts move to one helper when D31 retires

import { markRangeHandled, rangeHooks } from "./rangeHooks";
import { Temporal } from "./temporal";
import { isIslamicEpochEraCompatNeeded } from "./temporalCompat/capabilities";
import { digitRuns, digitSetOf, digitsOf } from "./weekYearText";
import { showsEraOrYear, toMilliseconds } from "./yearPrinting";

/*
 * CORE-112, defect D32 (WebKit 331724): Intl era/monthCode Table 2 and 4.1.12 start the era `ah`
 * on 1 Muharram of year 1, the whole calendar day in every zone, and the day before is the last day
 * of year 0 (`bh` era year 1). JavaScriptCore changes the era at one fixed instant instead
 * (0622-07-19T07:52:58Z, a day earlier for `islamic-tbla`), so the first hours of 1 Muharram print
 * year 0 in the era `Before Hijra`, and in a zone west of UTC the last hours of year 0 print `AH`.
 *
 * The repair is dormant behind `isIslamicEpochEraCompatNeeded()`. An islamic formatter that can
 * show an era or a year is wrapped; an instant whose local date is the epoch day or the day before
 * is moved by whole 210-year cycles at the same wall-clock time (7 tabular cycles of 30 years are
 * 74417 days, exactly 10631 weeks, so month, day, weekday and time all stay). A date on or after
 * the Hijra moves forward and a date before it moves backward, so the engine itself names the era
 * AH or `Before Hijra` and prints the pattern; only the year is written here, as 1 (year 0 is era
 * year 1 of `bh`), in the formatter's numbering system. GMT owns no digit and no era name. A range
 * moves both ends and replaces the year runs that differ between two cycle counts. A fixed engine
 * prints the same text, so deleting this file, its hook in `formatterCache.ts` and the probe
 * retires the workaround without changing an output.
 */

/** The days in 210 islamic years (7 cycles of 30 tabular years): 10631 whole weeks. */
const CYCLE_DAYS = 74417;

/** The years in one cycle. */
const CYCLE_YEARS = 210;

/**
 * Days in year 0 and in year 1: both are common years of 354 days in the 30-year tabular cycle
 * (Calendrical Calculations, chapter 6: the leap years are 2, 5, 7, 10, 13, 16, 18, 21, 24, 26
 * and 29), which the umalqura calendar follows before its table.
 */
const YEAR_DAYS = 354;

/** The ISO date of 1 Muharram of year 1 (Calendrical Calculations, chapter 6). */
const EPOCH_DAY: Readonly<Record<string, string>> = {
  "islamic-civil": "0622-07-19",
  "islamic-tbla": "0622-07-18",
  "islamic-umalqura": "0622-07-19",
};

/** The cycle counts tried for a range, so a far end cannot print the year a moved end prints. */
const TRIES = [1, 3, 5] as const;

/** The local days of `ms` since 1 Muharram of year 1 in a zone, or `null` when there is none. */
function daysSinceEpoch(
  ms: number,
  timeZone: string,
  epoch: Temporal.PlainDate,
): number | null {
  try {
    return Temporal.Instant.fromEpochMilliseconds(ms)
      .toZonedDateTimeISO(timeZone)
      .toPlainDate()
      .since(epoch, { largestUnit: "days" }).days;
  } catch {
    return null;
  }
}

/** The instant `cycles` cycles later (earlier when negative) at the same wall-clock time. */
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

/** What `rewriteYears` needs of the formatter's numbering system. */
interface Numerals {
  readonly digitSet: ReadonlySet<string>;
  readonly table: readonly string[];
  readonly one: string;
  readonly twoDigitOne: string;
}

/** What `rewriteYears` knows of the moved range: the cycles, how many ends moved, and whether both sides. */
interface Moves {
  readonly cycles: number;
  readonly moving: number;
  readonly mixed: boolean;
}

/** The value of a digit run, in a numbering system's digit table. */
function valueOf(run: string, table: readonly string[]): number {
  return [...run].reduce(
    (sum, character) => sum * 10 + Math.max(0, table.indexOf(character)),
    0,
  );
}

/**
 * The range text with each year run that differs between the moved range (`text`) and the range
 * one cycle further (`later`) written as year 1, or `null` when those runs are not the years the
 * moves predict (a far end printed the same year, or the engine laid the range out differently).
 */
function rewriteYears(
  text: string,
  later: string,
  { digitSet, table, one, twoDigitOne }: Numerals,
  { cycles, moving, mixed }: Moves,
): string | null {
  const runs = digitRuns(text, digitSet);
  const twins = digitRuns(later, digitSet);
  if (runs.length !== twins.length) {
    return null;
  }
  const changed = runs.filter((run, at) => run.text !== twins[at]?.text);
  if (changed.length < (mixed ? 2 : 1) || changed.length > moving) {
    return null;
  }
  const twoDigit = changed.every((run) => [...run.text].length <= 2);
  const printed = 1 + CYCLE_YEARS * cycles;
  if (
    !changed.every(
      (run) =>
        valueOf(run.text, table) === (twoDigit ? printed % 100 : printed),
    )
  ) {
    return null;
  }
  let result = text;
  for (const run of changed.toReversed()) {
    result =
      result.slice(0, run.start) +
      (twoDigit ? twoDigitOne : one) +
      result.slice(run.end);
  }
  return result;
}

/** 1 for a day of year 1, -1 for a day of year 0, 0 for any other day. */
function kindOf(days: number | null): -1 | 0 | 1 {
  if (days === null) {
    return 0;
  }
  if (days >= 0 && days < YEAR_DAYS) {
    return 1;
  }
  return days < 0 && days >= -YEAR_DAYS ? -1 : 0;
}

/** Whether a day is one JavaScriptCore can print with the wrong era: the epoch day or the day before. */
function isAtRisk(days: number | null): boolean {
  return days === 0 || days === -1;
}

/**
 * The instant a date on the epoch day or the day before is read at instead, with its era side (1
 * for the Hijra and after, -1 before it), or `null` when the instant needs no move: the calendar
 * is not islamic, the engine has no D32, the local date is not at risk or no same-time twin exists.
 *
 * @example epochTwin(Date.UTC(622, 6, 19), "islamic-civil", "UTC") // { ms: 74417-day-later instant, side: 1 }
 */
export function epochTwin(
  ms: number,
  calendar: string,
  timeZone: string,
): { readonly ms: number; readonly side: -1 | 1 } | null {
  const epochText = EPOCH_DAY[calendar];
  if (epochText === undefined || !isIslamicEpochEraCompatNeeded()) {
    return null;
  }
  const days = daysSinceEpoch(ms, timeZone, Temporal.PlainDate.from(epochText));
  if (!isAtRisk(days)) {
    return null;
  }
  const side = kindOf(days) === 1 ? 1 : -1;
  const moved = shiftedBy(ms, timeZone, side);
  return moved === null ? null : { ms: moved, side };
}

/**
 * The formatter itself, or a wrapper that prints the first day of year 1 of an islamic calendar as
 * year 1 in the era AH, and the last day of year 0 as the formatter prints any other date before
 * the Hijra, where the engine changes the era in the middle of the day (D32).
 *
 * @param formatter the formatter the earlier repairs returned
 * @param callerOptions the options it was built with
 * @returns the formatter, or its wrapper
 *
 * @example repairIslamicEpochEra(new Intl.DateTimeFormat("en-u-ca-gregory"), {}) // the same formatter
 * @example repairIslamicEpochEra(new Intl.DateTimeFormat("en-u-ca-islamic-civil", { era: "short", year: "numeric", timeZone: "UTC" }), { era: "short", year: "numeric", timeZone: "UTC" }).format(Date.UTC(622, 6, 19)) // "1 AH" where the engine prints "0 Before Hijra"
 */
export function repairIslamicEpochEra(
  formatter: Intl.DateTimeFormat,
  callerOptions: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  let resolved: Intl.ResolvedDateTimeFormatOptions;
  try {
    resolved = formatter.resolvedOptions();
  } catch {
    return formatter;
  }
  const epochText = EPOCH_DAY[resolved.calendar];
  if (
    epochText === undefined ||
    !showsEraOrYear(callerOptions) ||
    !isIslamicEpochEraCompatNeeded()
  ) {
    return formatter;
  }
  const { timeZone, numberingSystem, locale } = resolved;
  const epoch = Temporal.PlainDate.from(epochText);
  const table = digitsOf(numberingSystem);
  const digitSet = digitSetOf(numberingSystem);
  const numberOptions = { numberingSystem, useGrouping: false } as const;
  const one = new Intl.NumberFormat(locale, numberOptions).format(1);
  const twoDigitOne = new Intl.NumberFormat(locale, {
    ...numberOptions,
    minimumIntegerDigits: 2,
  }).format(1);

  const partsOf = (ms: number): Intl.DateTimeFormatPart[] => {
    const days = daysSinceEpoch(ms, timeZone, epoch);
    if (!isAtRisk(days)) {
      return formatter.formatToParts(ms);
    }
    const moved = shiftedBy(ms, timeZone, kindOf(days));
    if (moved === null) {
      return formatter.formatToParts(ms);
    }
    return formatter
      .formatToParts(moved)
      .map((part) =>
        part.type === "year"
          ? { ...part, value: [...part.value].length <= 2 ? twoDigitOne : one }
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
    const ends = [start, end] as const;
    const days = ends.map((ms) => daysSinceEpoch(ms, timeZone, epoch));
    if (!days.some(isAtRisk)) {
      return rangeOf(start, end);
    }
    const kinds = days.map(kindOf);
    const moving = kinds.filter((kind) => kind !== 0).length;
    const mixed = kinds.includes(1) && kinds.includes(-1);
    const movedBy = (cycles: number): [number, number] | null => {
      const out = ends.map((ms, at) =>
        kinds[at] === 0
          ? ms
          : shiftedBy(ms, timeZone, (kinds[at] as number) * cycles),
      );
      return out[0] === null || out[1] === null ? null : [out[0], out[1]];
    };
    for (const cycles of TRIES) {
      const first = movedBy(cycles);
      const later = movedBy(cycles + 1);
      if (first === null || later === null) {
        return rangeOf(start, end);
      }
      const text = rangeOf(...first);
      if (text === "") {
        return "";
      }
      const rewritten = rewriteYears(
        text,
        rangeOf(...later),
        { digitSet, table, one, twoDigitOne },
        { cycles, moving, mixed },
      );
      if (rewritten !== null) {
        return rewritten;
      }
    }
    return "";
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
