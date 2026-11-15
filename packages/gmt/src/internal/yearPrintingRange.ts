import type { YearRangeContext } from "./rangeHooks";
import { rangeFieldsEqual } from "./rangeFieldValues";
import { fallbackTemplate, joinFallback } from "./rangeFallback";
import { Temporal } from "./temporal";
import { formatRangeChecked } from "./weekYearRange";
import { type DigitRun, digitRuns } from "./weekYearText";

/*
 * CORE-112: the range half of D25 and D27 (`yearPrinting.ts` holds the single-date half).
 * Installed by `rangeRepairs.ts` through `rangeHooks.ts`, so a bundle that formats single dates
 * never carries it. Removing it retires only the range repairs of D25 and D27: delete this file
 * and its entry in the `registerRangeHooks` call.
 *
 * - Both ends before 1873: a field pattern takes the Gregorian twin's range; a style pattern takes
 *   it too, with the Gregorian era written where the engine's japanese pattern puts its era for
 *   the same dates 400 years or more later (ECMA-402 PartitionDateTimeRangePattern: the range
 *   collapses on the twin's own fields, and one era follows the one year the collapsed pattern
 *   prints).
 * - One end before 1873: each end in its own era, joined by the locale's fallback (UTS #35 Part 4).
 * - D27: an era year printed with one digit in a range gains the formatter's zero.
 */

/** The first ISO year the japanese calendar prints a Japanese era for. */
const FIRST_ERA_YEAR = 1873;

/** The Gregorian cycle in years: a shift by whole cycles keeps the month, day and weekday. */
const CYCLE = 400;

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

/**
 * D27 in a range: the digit run that changes when an endpoint moves by whole years is an era
 * year; one digit gains a zero. Each way of moving the endpoints (both, only the first, only the
 * second) counts only when the number of digit runs is the same, so a year that prints as 元 is
 * left alone.
 */
function paddedRange(
  context: YearRangeContext,
  text: string,
  a: number,
  b: number,
): string {
  const shiftedA = context.shiftOf(a);
  const shiftedB = context.shiftOf(b);
  if (shiftedA === null || shiftedB === null) {
    return text;
  }
  const runs = digitRuns(text, context.digitSet);
  const starts = new Set<number>();
  for (const [x, y] of [
    [shiftedA, shiftedB],
    [shiftedA, b],
    [a, shiftedB],
  ] as const) {
    const other = formatRangeChecked(context.formatter, context.options, x, y);
    for (const start of changedSingleDigits(runs, other, context.digitSet)) {
      starts.add(start);
    }
  }
  return insertZeros(text, runs, starts, context.zero);
}

/**
 * The range as the locale's fallback writes it from the wrapper's own single texts, or `""` when
 * the joiner or a single is unavailable (the house value).
 */
function joinedSingles(
  context: YearRangeContext,
  a: number,
  b: number,
): string {
  const { locale, numberingSystem } = context.resolved;
  const template = fallbackTemplate(locale, numberingSystem, "gregory");
  const first = context.single(a);
  const last = context.single(b);
  return template === null || first === "" || last === ""
    ? ""
    : joinFallback(template, first, last);
}

/** The index of the next whole-word occurrence of `era` in `text` from `start`, or -1. */
function eraAt(text: string, era: string, start = 0): number {
  for (
    let at = text.indexOf(era, start);
    at >= 0;
    at = text.indexOf(era, at + 1)
  ) {
    const wordBefore = /\p{L}$/u.test(text.slice(0, at));
    const wordAfter = /^\p{L}/u.test(text.slice(at + era.length));
    if (!wordBefore && !wordAfter) {
      return at;
    }
  }
  return -1;
}

type Run = ReturnType<typeof digitRuns>[number];

/**
 * The pair shifted by whole Gregorian cycles to after 1872, and on until both dates sit in one
 * Japanese era: a pair that straddles an era boundary (1912-07-30, 1926-12-25, 1989-01-08,
 * 2019-05-01) prints two eras where the pair itself prints one. Every date from 2019-05-01 on is
 * Reiwa, so the loop ends: at most two steps past the first cycle that lands after 1872.
 */
function laterPair(
  context: YearRangeContext,
  a: number,
  b: number,
): [number, number] {
  const { timeZone } = context.resolved;
  const zoned = (ms: number) =>
    Temporal.Instant.fromEpochMilliseconds(ms).toZonedDateTimeISO(timeZone);
  const startZoned = zoned(a);
  const endZoned = zoned(b);
  const lowest = Math.min(startZoned.year, endZoned.year);
  let years = CYCLE * Math.max(1, Math.ceil((FIRST_ERA_YEAR - lowest) / CYCLE));
  for (;;) {
    const start = startZoned.add({ years }).epochMilliseconds;
    const end = endZoned.add({ years }).epochMilliseconds;
    if (
      context.japaneseEraNames(start)[0] === context.japaneseEraNames(end)[0]
    ) {
      return [start, end];
    }
    years += CYCLE;
  }
}

/** The digit run nearest to the era at `from` to `to`, and whether it lies before the era. */
function nearestRun(
  runs: readonly Run[],
  from: number,
  to: number,
): { index: number; after: boolean } {
  let best = { index: -1, after: false };
  let bestGap = Number.POSITIVE_INFINITY;
  for (const [index, run] of runs.entries()) {
    if (from - run.end >= 0 && from - run.end < bestGap) {
      best = { index, after: true };
      bestGap = from - run.end;
    }
    if (run.start - to >= 0 && run.start - to < bestGap) {
      best = { index, after: false };
      bestGap = run.start - to;
    }
  }
  return best;
}

/**
 * The twin's range with the Gregorian era written where the engine's japanese pattern puts its
 * era. The japanese range of the same two dates shifted by whole Gregorian cycles to after 1872
 * shows where: each occurrence of the Japanese era name sits next to one digit run (a year), on
 * one side, with a glue between. The twin's range has the same digit runs, so the Gregorian era
 * goes next to the same run. `null` when the two shapes do not match (another number of runs, an
 * era name that is not found, two different eras), and the caller joins the singles instead.
 */
function spliceEra(
  context: YearRangeContext,
  range: string,
  a: number,
  b: number,
): string | null {
  const name = context.eraNameOf(a);
  if (name === null || context.eraNameOf(b) !== name) {
    return null;
  }
  const [a2, b2] = laterPair(context, a, b);
  const japanese = formatRangeChecked(
    context.formatter,
    context.options,
    a2,
    b2,
  );
  const gregorian = formatRangeChecked(context.twin(), context.options, a2, b2);
  if (japanese === null || gregorian === null) {
    return null;
  }
  const era = context
    .japaneseEraNames(a2)
    .find((candidate) => eraAt(japanese, candidate) >= 0);
  if (era === undefined) {
    return null;
  }
  const runsJapanese = digitRuns(japanese, context.digitSet);
  const runsGregorian = digitRuns(gregorian, context.digitSet);
  const runsRange = digitRuns(range, context.digitSet);
  if (
    runsJapanese.length !== runsGregorian.length ||
    runsGregorian.length !== runsRange.length
  ) {
    return null;
  }
  const inserts = eraInserts(
    japanese,
    era,
    name,
    runsJapanese,
    runsGregorian,
    runsRange,
  );
  return inserts === null ? null : insertAll(range, inserts);
}

/** One insert: the era name beside the target run, with the glue the japanese text has when it is only space. */
function eraInsert(
  japanese: string,
  [from, to]: readonly [number, number],
  run: Run,
  target: Run,
  after: boolean,
  name: string,
): { at: number; text: string } {
  const gap = after
    ? japanese.slice(run.end, from)
    : japanese.slice(to, run.start);
  const glue = /^\s*$/u.test(gap) ? gap : "";
  return after
    ? { at: target.end, text: glue + name }
    : { at: target.start, text: name + glue };
}

/**
 * Where the Gregorian era goes in the twin's range: next to the run each japanese era sits next
 * to, on the same side with the same glue. `null` when an era has no run, or its run reads alike
 * in both calendars (nothing to place an era against), or no era occurs.
 */
function eraInserts(
  japanese: string,
  era: string,
  name: string,
  runsJapanese: readonly Run[],
  runsGregorian: readonly Run[],
  runsRange: readonly Run[],
): { at: number; text: string }[] | null {
  const inserts: { at: number; text: string }[] = [];
  for (
    let from = eraAt(japanese, era);
    from >= 0;
    from = eraAt(japanese, era, from + era.length)
  ) {
    const to = from + era.length;
    const { index, after } = nearestRun(runsJapanese, from, to);
    const run = runsJapanese[index];
    const target = runsRange[index];
    if (
      run === undefined ||
      target === undefined ||
      run.text === runsGregorian[index]?.text
    ) {
      return null;
    }
    inserts.push(eraInsert(japanese, [from, to], run, target, after, name));
  }
  return inserts.length === 0 ? null : inserts;
}

/** The text with each insert placed at its index, last index first so the others stay valid. */
function insertAll(
  text: string,
  inserts: readonly { at: number; text: string }[],
): string {
  return inserts
    .toSorted((x, y) => y.at - x.at)
    .reduce(
      (out, { at, text: added }) => out.slice(0, at) + added + out.slice(at),
      text,
    );
}

/**
 * Both ends before 1873 under a style pattern: the single when the field values are equal (ECMA-402
 * PartitionDateTimeRangePattern; never the printed text), else the twin's
 * range with the era added, else the joined singles.
 */
function eraTwinRange(
  context: YearRangeContext,
  a: number,
  b: number,
): string | null {
  if (
    rangeFieldsEqual(
      context.options,
      context.twin().resolvedOptions(),
      a,
      b,
      true,
    )
  ) {
    return context.twinText(a);
  }
  const range = formatRangeChecked(context.twin(), context.options, a, b);
  if (range === null) {
    return null;
  }
  return spliceEra(context, range, a, b) ?? joinedSingles(context, a, b);
}

/**
 * The range of a wrapped formatter (D25, D27).
 *
 * @param context the wrapper's state
 * @param a the start in epoch milliseconds
 * @param b the end in epoch milliseconds
 * @param before whether the start and the end precede 1873-01-01
 * @returns the text, `""` when a joiner is unavailable, or `null` when a year run cannot be repaired
 *
 * @example yearRangeText(context, Date.UTC(1872, 11, 30), Date.UTC(1872, 11, 31), [true, true]) // "Dec 30 – 31, 1872 AD" for `en-u-ca-japanese` with `dateStyle: "medium"`
 */
export function yearRangeText(
  context: YearRangeContext,
  a: number,
  b: number,
  before: readonly [boolean, boolean],
): string | null {
  if (before[0] && before[1]) {
    return context.eraSeat && context.styled
      ? eraTwinRange(context, a, b)
      : formatRangeChecked(context.twin(), context.options, a, b);
  }
  if (before[0] || before[1]) {
    return joinedSingles(context, a, b);
  }
  const text = formatRangeChecked(context.formatter, context.options, a, b);
  return text !== null && context.pad ? paddedRange(context, text, a, b) : text;
}
