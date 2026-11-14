import { Temporal } from "./temporal";

/*
 * CORE-112 (defect D24): the text half of the week-year workaround, read from `format` alone.
 *
 * Some CLDR 48 patterns use `Y`, the year of the week-of-year, where `y`, the calendar year, is
 * meant (UTS #35 Part 4 §8, rows `y` and `Y`), so a date near a year end prints next year's number
 * (Scottish Gaelic `Dùbh 2025` for 30 December 2024), and the Buddhist, Japanese and ROC calendars
 * print the Gregorian week-year all year. `weekYearGuard.ts` decides which formatters do, using
 * this module's reading of a formatter's digit runs; the year in each run is then written as
 * ECMA-402 gives it: `numeric` unpadded and ungrouped, `2-digit` the last two digits padded
 * (FormatDateTimePattern, the `year` steps), in the formatter's numbering system.
 *
 * Nothing here calls a parts method, so it never reaches the V8 abort of defect D23
 * (nodejs/node#67076). Only the year changes: every other choice CLDR made stays.
 */

/** A maximal run of digits in a formatted text, as UTF-16 offsets. */
export interface DigitRun {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

const ANY_DIGIT = /\p{Nd}/u;

/**
 * The digit runs of `text`, walked by code point: Adlam, Chakma and other digit sets lie outside
 * the Basic Multilingual Plane.
 */
export function digitRuns(
  text: string,
  digits: ReadonlySet<string>,
): DigitRun[] {
  const runs: DigitRun[] = [];
  let start = -1;
  let index = 0;
  for (const character of text) {
    const isDigit = digits.has(character) || ANY_DIGIT.test(character);
    if (isDigit && start < 0) {
      start = index;
    } else if (!isDigit && start >= 0) {
      runs.push({ start, end: index, text: text.slice(start, index) });
      start = -1;
    }
    index += character.length;
  }
  if (start >= 0) {
    runs.push({ start, end: index, text: text.slice(start, index) });
  }
  return runs;
}

/** The number of code points in `text`. */
function codePointLength(text: string): number {
  return [...text].length;
}

/** The last two code points of `text`. */
function lastTwo(text: string): string {
  return [...text].slice(-2).join("");
}

const MAX_CACHED = 64;
const digitSets = new Map<string, readonly string[]>();
const references = new Map<string, Reference>();

/** Forget every digit set and reference formatter (a replaced `Intl`, a test seam). */
export function forgetWeekYearText(): void {
  digitSets.clear();
  references.clear();
}

/** The digits 0 to 9 of a numbering system, by value. */
export function digitsOf(numberingSystem: string): readonly string[] {
  let digits = digitSets.get(numberingSystem);
  if (digits === undefined) {
    digits = [
      ...new Intl.NumberFormat("und", {
        numberingSystem,
        useGrouping: false,
      }).format(9876543210),
    ].reverse();
    if (digitSets.size >= MAX_CACHED) {
      digitSets.clear();
    }
    digitSets.set(numberingSystem, digits);
  }
  return digits;
}

/** The set of a numbering system's digit characters. */
export function digitSetOf(numberingSystem: string): ReadonlySet<string> {
  return new Set(digitsOf(numberingSystem));
}

/**
 * A root-locale formatter that prints the year alone in a calendar: its single digit run at a date
 * is the calendar's year as ICU counts it, the same calendar arithmetic that prints the month and
 * the day beside the year in the formatter under test.
 */
export interface Reference {
  readonly format: Intl.DateTimeFormat;
  readonly digits: ReadonlySet<string>;
}

/** The reference for a calendar, numbering system and time zone, built once. */
export function referenceFor(
  calendar: string,
  numberingSystem: string,
  timeZone: string,
): Reference {
  const key = `${calendar}|${numberingSystem}|${timeZone}`;
  let reference = references.get(key);
  if (reference === undefined) {
    reference = {
      format: new Intl.DateTimeFormat("und", {
        calendar,
        numberingSystem,
        year: "numeric",
        timeZone,
      }),
      digits: digitSetOf(numberingSystem),
    };
    if (references.size >= MAX_CACHED) {
      references.clear();
    }
    references.set(key, reference);
  }
  return reference;
}

/** The calendar year the reference prints at `ms`, or `null` when it prints no single number. */
export function referenceYear(reference: Reference, ms: number): string | null {
  const runs = digitRuns(reference.format.format(ms), reference.digits);
  return runs.length === 1 ? (runs[0]?.text ?? null) : null;
}

/** The calendar year of a mid-year date, the anchor every probe date is counted from. */
export function anchorYear(calendar: string): number {
  return Temporal.PlainDate.from("2024-07-01").withCalendar(calendar).year;
}

/** The date `month` / `day` of `year` in a calendar. */
export function dateIn(
  calendar: string,
  year: number,
  month: number,
  day: number,
): Temporal.PlainDate {
  return Temporal.PlainDate.from({ calendar, year, month, day });
}

/**
 * The indexes of the digit runs that hold the year, or `null` when the run count changes between
 * the three probe dates.
 *
 * A year run is equal a week apart in mid-January and different in the first following year whose
 * 15 January falls on the same weekday: equal weekdays keep a weekday name with digits (luy `J4`)
 * out of the set.
 *
 * @param runsAt the formatter's digit runs at a date
 */
export function yearRunIndexes(
  calendar: string,
  runsAt: (date: Temporal.PlainDate) => DigitRun[],
): number[] | null {
  const first = anchorYear(calendar);
  const january = dateIn(calendar, first, 1, 15);
  let other = dateIn(calendar, first + 1, 1, 15);
  for (let step = 1; step <= 14 && other.dayOfWeek !== january.dayOfWeek;) {
    other = dateIn(calendar, first + step, 1, 15);
    step++;
  }
  const base = runsAt(january);
  const week = runsAt(january.add({ days: 7 }));
  const year = runsAt(other);
  if (base.length !== week.length || base.length !== year.length) {
    return null;
  }
  return base.flatMap((run, index) =>
    run.text === week[index]?.text && run.text !== year[index]?.text
      ? [index]
      : [],
  );
}

/** How a year run is written: `full` or the last `two` digits, and any number glued to it. */
export interface YearStyle {
  readonly kind: "full" | "two";
  /** Where the year sits in a run that also holds another number, else `undefined`. */
  readonly glued?: "start" | "end";
  /** The length of the other number in a glued run. */
  readonly rest?: number;
}

/** The kind of field a digit run holds, found by moving one field at a time. */
export type RunLabel =
  | "year"
  | "day"
  | "month"
  | "hour"
  | "minute"
  | "second"
  | "fractionalSecond"
  | "literal"
  | "text";

/** What `analyse` reads from a formatter once, so a repair never re-reads it. */
export interface WeekYearAnalysis {
  readonly calendar: string;
  readonly timeZone: string;
  readonly numberingSystem: string;
  readonly digits: ReadonlySet<string>;
  readonly reference: Reference;
  /** Digit run indexes that hold the year. */
  readonly yearRuns: readonly number[];
  /** How each year run is written, in the order of `yearRuns`. */
  readonly styles: readonly YearStyle[];
  /** The field each digit run holds. */
  readonly labels: readonly RunLabel[];
  /** The digit run count of the formatter's text. */
  readonly count: number;
}

/** The style of a year run read at mid-year, against the reference's year `year` there. */
function styleOf(run: string, year: string | null): YearStyle {
  return (
    (year === null ? null : styleAgainst(run, year)) ?? {
      // The run is wrong even mid-year (Buddhist, Japanese and ROC print the Gregorian week-year):
      // its own width decides, two digits meaning `2-digit`.
      kind: codePointLength(run) === 2 ? "two" : "full",
    }
  );
}

/** The style of a run that matches the reference year in some form, or `null`. */
function styleAgainst(run: string, year: string): YearStyle | null {
  if (run === year) {
    return { kind: "full" };
  }
  if (
    codePointLength(run) === 2 &&
    (run === lastTwo(year) || [...run][1] === year)
  ) {
    return { kind: "two" };
  }
  if (run.length > year.length && run.startsWith(year)) {
    return { kind: "full", glued: "start", rest: run.length - year.length };
  }
  if (run.length > year.length && run.endsWith(year)) {
    return { kind: "full", glued: "end", rest: run.length - year.length };
  }
  return null;
}

const PERTURBED_FIELDS = [
  ["day", { days: 1 }],
  ["month", { months: 1 }],
  ["hour", { hours: 1 }],
  ["minute", { minutes: 1 }],
  ["second", { seconds: 1 }],
  ["fractionalSecond", { milliseconds: 1 }],
] as const;

/**
 * Read a formatter's digit runs once: which hold the year, how each is written, and what field
 * every other one holds. Only `format` is called, on the formatter itself, in its zone and with its
 * time fields. `null` when the run count changes between probe dates.
 */
export function analyse(
  format: (ms: number) => string,
  resolved: Intl.ResolvedDateTimeFormatOptions,
): WeekYearAnalysis | null {
  const calendar = resolved.calendar;
  const timeZone = resolved.timeZone;
  const numberingSystem = resolved.numberingSystem;
  const digits = digitSetOf(numberingSystem);
  const reference = referenceFor(calendar, numberingSystem, timeZone);
  const zoned = (date: Temporal.PlainDate) =>
    date.toZonedDateTime({ timeZone, plainTime: "10:20:30.456" });
  const runsAt = (date: Temporal.PlainDate) =>
    digitRuns(format(zoned(date).epochMilliseconds), digits);
  const yearRuns = yearRunIndexes(calendar, runsAt);
  if (yearRuns === null) {
    return null;
  }
  const first = anchorYear(calendar);
  const midYear = zoned(dateIn(calendar, first, 6, 1)).epochMilliseconds;
  const midRuns = digitRuns(format(midYear), digits);
  const midYearText = referenceYear(reference, midYear);
  const styles = yearRuns.map((index) =>
    styleOf(midRuns[index]?.text ?? "", midYearText),
  );
  const start = zoned(dateIn(calendar, first, 1, 15));
  const base = digitRuns(format(start.epochMilliseconds), digits);
  const moved = PERTURBED_FIELDS.map(([field, amount]) => ({
    field,
    runs: digitRuns(format(start.add(amount).epochMilliseconds), digits),
  }));
  const labels = base.map((run, index): RunLabel => {
    if (yearRuns.includes(index)) {
      return "year";
    }
    const changed = moved.filter(
      (entry) =>
        entry.runs.length === base.length &&
        entry.runs[index]?.text !== run.text,
    );
    // Several fields move it: digits inside a name (haw `P3`). None: a literal number.
    const [only] = changed;
    return changed.length === 1 && only !== undefined
      ? only.field
      : changed.length === 0
        ? "literal"
        : "text";
  });
  return {
    calendar,
    timeZone,
    numberingSystem,
    digits,
    reference,
    yearRuns,
    styles,
    labels,
    count: base.length,
  };
}

/** The year as ECMA-402 writes it for a style: `numeric` is the reference's run, `2-digit` its last two digits, padded. */
function yearText(
  analysis: WeekYearAnalysis,
  ms: number,
  style: YearStyle,
): string | null {
  const year = referenceYear(analysis.reference, ms);
  if (year === null || style.kind === "full") {
    return year;
  }
  return codePointLength(year) >= 2
    ? lastTwo(year)
    : (digitsOf(analysis.numberingSystem)[0] ?? "0") + year;
}

/** One year run replaced in a text. */
export interface YearEdit {
  /** The run in the native text. */
  readonly from: number;
  readonly to: number;
  /** The span of the year in the repaired text. */
  readonly start: number;
  readonly end: number;
  readonly value: string;
}

/** A text with every year run holding the calendar year. */
export interface RepairedText {
  readonly text: string;
  readonly edits: readonly YearEdit[];
  readonly runs: readonly DigitRun[];
}

/**
 * `text` with every year run holding the calendar year, or `null` when the run count differs from
 * the analysis (the text has a shape it did not read: the data canary fails on any such date, so a
 * CLDR change that causes one is caught, not shipped).
 */
export function repairText(
  analysis: WeekYearAnalysis,
  text: string,
  ms: number,
): RepairedText | null {
  const runs = digitRuns(text, analysis.digits);
  if (runs.length !== analysis.count) {
    return null;
  }
  let out = "";
  let position = 0;
  const edits: YearEdit[] = [];
  for (const [n, index] of analysis.yearRuns.entries()) {
    const style = analysis.styles[n];
    const run = runs[index];
    const value = style === undefined ? null : yearText(analysis, ms, style);
    if (style === undefined || run === undefined || value === null) {
      return null;
    }
    let from = run.start;
    let to = run.end;
    if (style.glued === "start") {
      to = run.end - (style.rest ?? 0);
    } else if (style.glued === "end") {
      from = run.start + (style.rest ?? 0);
    }
    out += text.slice(position, from);
    edits.push({
      from,
      to,
      start: out.length,
      end: out.length + value.length,
      value,
    });
    out += value;
    position = to;
  }
  return { text: out + text.slice(position), edits, runs };
}

/**
 * Native parts with each year run written as the `year` part holding the calendar year. WebKit
 * types the week-year `unknown`; a part that holds more than the run (a year glued to another
 * number) keeps its type and has the run's slice replaced.
 *
 * @returns the patched parts, or `null` when a run is split across parts or the patched parts do
 * not read as the repaired text
 */
export function patchYearParts(
  parts: readonly Intl.DateTimeFormatPart[],
  repaired: RepairedText,
): Intl.DateTimeFormatPart[] | null {
  let offset = 0;
  const out: Intl.DateTimeFormatPart[] = [];
  for (const part of parts) {
    const start = offset;
    const end = start + part.value.length;
    offset = end;
    const inside = repaired.edits.filter(
      (edit) => edit.from < end && edit.to > start,
    );
    let value = part.value;
    for (const edit of inside.toReversed()) {
      if (edit.from < start || edit.to > end) {
        return null;
      }
      value =
        value.slice(0, edit.from - start) +
        edit.value +
        value.slice(edit.to - start);
    }
    const exact =
      inside.length === 1 && inside[0]?.from === start && inside[0].to === end;
    out.push({
      type: exact ? "year" : part.type,
      value,
    } as Intl.DateTimeFormatPart);
  }
  return out.map((part) => part.value).join("") === repaired.text ? out : null;
}

/** The first of the three digit-run checks `weekYearGuard.ts` makes at a boundary. */
export type BoundaryCheck = "ok" | "bad" | "shape";

/**
 * Whether every year run at `date` still reads as it does at the inside date `mid`, where the
 * calendar year is the same.
 *
 * A run printing the week-year differs at a year boundary; a run printing the calendar year does
 * not. A year glued to another number is compared by the year inside it: the boundary run must hold
 * the boundary date's calendar year in the same form (full or last two digits).
 */
export function checkYearRuns(
  yearRuns: readonly number[],
  at: readonly DigitRun[],
  mid: readonly DigitRun[],
  yearAt: string | null,
  yearMid: string | null,
): boolean {
  return yearRuns.every((index) =>
    runMoves(at[index]?.text ?? "", mid[index]?.text ?? "", yearAt, yearMid),
  );
}

/** Whether one year run changes between the boundary and mid-year by exactly the year it holds. */
function runMoves(
  here: string,
  inside: string,
  yearAt: string | null,
  yearMid: string | null,
): boolean {
  if (here === inside) {
    return true;
  }
  if (yearMid === null || yearAt === null) {
    return false;
  }
  if (inside.includes(yearMid)) {
    return inside.length > yearMid.length && here.includes(yearAt);
  }
  if (codePointLength(yearMid) > 2 && inside.includes(lastTwo(yearMid))) {
    return codePointLength(inside) > 2 && here.includes(lastTwo(yearAt));
  }
  return false;
}
