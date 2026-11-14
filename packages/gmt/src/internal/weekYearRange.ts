import { Temporal } from "./temporal";
import {
  digitRuns as textDigitRuns,
  digitsOf,
  referenceFor,
} from "./weekYearText";

/*
 * CORE-112 slice 3c (defect D24 in ranges): the calendar year in `formatRange` text.
 *
 * A range pattern is a different pattern from the single-date one, so a formatter whose `format`
 * is right can still print the week-based year (`Y`) in `formatRange` (UTS #35 Part 4 §8, rows `y`
 * and `Y`): kok-u-ca-japanese 2018-12-27 to 2019-12-27 ends in the year `2019` where the Reiwa
 * year `1` is meant, my-u-ca-buddhist prints `2026` for 2569. ECMA-402 FormatDateTimePattern
 * prints the calendar year (the era year with an era), so the verdict compares each year run with
 * ICU's own calendar year and the repair writes that year.
 *
 * This module reads range text with `format` and `formatRange` only. It never calls a parts
 * method: V8 without commit 0426b0d1045d aborts the process there on a `Y` pattern (defect D23,
 * nodejs/node#67076). The verdict is lazy, computed on a formatter's first range call and kept
 * per formatter. The reference year is the one the single repair uses (`und`, `year: "numeric"`,
 * the formatter's calendar, numbering system and zone).
 *
 * Deleting this file and its hook lines retires the workaround with the rest of D24.
 */

const ANY_DIGIT = /\p{Nd}/u;
const MINUS = new Set(["-", "−", "‐", "‑", "‒", "–", "﹣", "－"]);
const BIDI = new Set(["‎", "‏", "؜"]);
const RELATED = new Set(["chinese", "dangi"]);

/**
 * The polyfill (0.5.1) throws "Era am ... was not matched by any era" for every `coptic` and
 * `ethiopic` date, so their dates are computed in `ethioaa`, which it handles. The three calendars
 * have the same twelve 30-day months, five or six epagomenal days and leap rule; they differ only
 * in the year number. The Ethiopian (Amete Mihret) year is the Amete Alem year less 5500, and the
 * Coptic year is the Ethiopian year less 276 (Calendrical Calculations, chapter 4; the CLDR/ICU
 * calendars of the same names). Only the year number is converted; ICU still prints the text.
 */
const TEMPORAL_STAND_IN: Readonly<
  Record<string, { calendar: string; bias: number }>
> = {
  coptic: { calendar: "ethioaa", bias: 5776 },
  ethiopic: { calendar: "ethioaa", bias: 5500 },
};

/** A digit run with its value (in the formatter's numbering system) and code point count. */
interface Run {
  readonly start: number;
  readonly end: number;
  readonly text: string;
  readonly count: number;
  readonly value: number;
}

/** ICU's calendar year at a moment: its digits, value and sign. */
interface RefYear {
  readonly digits: string;
  readonly count: number;
  readonly value: number;
  readonly negative: boolean;
}

/** What is read from a formatter once and shared by every range of its calendar, zone and locale. */
interface Env {
  readonly weekday: boolean;
  readonly calendar: string;
  /** The Temporal calendar that computes this one's dates (see `TEMPORAL_STAND_IN`). */
  readonly temporalCalendar: string;
  /** What `temporalCalendar` adds to this calendar's year number. */
  readonly yearBias: number;
  readonly timeZone: string;
  readonly numberingSystem: string;
  readonly digits: ReadonlySet<string>;
  readonly digitValue: ReadonlyMap<string, number>;
  readonly zero: string;
  readonly reference: Intl.DateTimeFormat;
  readonly eraFormat: Intl.DateTimeFormat;
  readonly monthDayFormat: Intl.DateTimeFormat;
  readonly monthDay: Map<number, string>;
  readonly eras: Map<number, string>;
  readonly years: Map<number, RefYear>;
  readonly minusSign: string;
  readonly referenceMinus: string;
  readonly firstDay: number | undefined;
}

const MAX_ENVS = 64;
let envs = new Map<string, Env>();
let verdicts = new WeakMap<object, boolean>();
/** Stand-ins whose own `formatRange` already repairs the year. */
const handled = new WeakSet<object>();

/** Forget every verdict and environment (a replaced `Intl`, a test seam). */
export function forgetWeekYearRange(): void {
  envs = new Map();
  verdicts = new WeakMap();
}

/** Record a stand-in whose `formatRange` is `formatRangeChecked` already. */
export function markRangeHandled(standIn: object): void {
  handled.add(standIn);
}

/** The text a negative number carries before its digits, as ECMA-402 FormatNumeric prints it. */
function negativePrefix(locale: string, numberingSystem: string): string {
  const text = new Intl.NumberFormat(locale, {
    numberingSystem,
    useGrouping: false,
  }).format(-1);
  return text.slice(0, text.search(ANY_DIGIT));
}

/** The first day of the week of a locale (1 = Monday), when the engine says. */
function firstDayOf(locale: string): number | undefined {
  try {
    const intlLocale = new Intl.Locale(locale) as Intl.Locale & {
      getWeekInfo?: () => { firstDay?: number };
      weekInfo?: { firstDay?: number };
    };
    const info =
      typeof intlLocale.getWeekInfo === "function"
        ? intlLocale.getWeekInfo()
        : intlLocale.weekInfo;
    return info?.firstDay;
  } catch {
    return undefined;
  }
}

function envOf(formatter: Intl.DateTimeFormat): Env {
  const resolved = formatter.resolvedOptions();
  // A weekday can be printed by `weekday` or by any `dateStyle`; its digits (vi "Thứ 4") must not
  // move, so shifted dates keep the weekday only for such formatters.
  const weekday =
    resolved.weekday !== undefined || resolved.dateStyle !== undefined;
  const key = `${resolved.locale}|${resolved.calendar}|${resolved.numberingSystem}|${resolved.timeZone}|${weekday}`;
  const known = envs.get(key);
  if (known !== undefined) {
    return known;
  }
  const { calendar, numberingSystem, timeZone } = resolved;
  const base = { calendar, numberingSystem, timeZone };
  const digitList = digitsOf(numberingSystem);
  const digitValue = new Map<string, number>();
  digitList.forEach((digit, value) => digitValue.set(digit, value));
  const env: Env = {
    weekday,
    calendar,
    temporalCalendar: TEMPORAL_STAND_IN[calendar]?.calendar ?? calendar,
    yearBias: TEMPORAL_STAND_IN[calendar]?.bias ?? 0,
    timeZone,
    numberingSystem,
    digits: new Set(digitList),
    digitValue,
    zero: digitList[0] ?? "0",
    reference: referenceFor(calendar, numberingSystem, timeZone).format,
    eraFormat: new Intl.DateTimeFormat("und", {
      ...base,
      era: "short",
      year: "numeric",
    }),
    monthDayFormat: new Intl.DateTimeFormat("und", {
      ...base,
      month: "numeric",
      day: "numeric",
    }),
    monthDay: new Map(),
    eras: new Map(),
    years: new Map(),
    minusSign: negativePrefix(resolved.locale, numberingSystem),
    referenceMinus: negativePrefix("und", numberingSystem),
    firstDay: firstDayOf(resolved.locale),
  };
  if (envs.size >= MAX_ENVS) {
    envs.clear();
  }
  envs.set(key, env);
  return env;
}

// ---------- text helpers ----------

/** The value of one digit character: its place in the numbering system, else in its Unicode block. */
function digitValueOf(character: string, env: Env): number {
  const known = env.digitValue.get(character);
  if (known !== undefined) {
    return known;
  }
  // Unicode Nd characters come in aligned 0-9 blocks: walk back to the block's zero.
  const codePoint = character.codePointAt(0) ?? 0;
  let steps = 0;
  while (
    steps < 10 &&
    ANY_DIGIT.test(String.fromCodePoint(codePoint - steps - 1))
  ) {
    steps++;
  }
  return steps % 10;
}

function runsOf(text: string, env: Env): Run[] {
  return textDigitRuns(text, env.digits).map((run) => {
    const characters = [...run.text];
    return {
      ...run,
      count: characters.length,
      value: characters.reduce(
        (sum, character) => sum * 10 + digitValueOf(character, env),
        0,
      ),
    };
  });
}

const isSignish = (character: string): boolean =>
  MINUS.has(character) || BIDI.has(character);

/** How many copies of the minus text `minus` end at position `at`. */
function zoneCount(text: string, at: number, minus: string): number {
  let count = 0;
  while (
    minus.length > 0 &&
    at - minus.length * (count + 1) >= 0 &&
    text.slice(at - minus.length * (count + 1), at - minus.length * count) ===
      minus
  ) {
    count++;
  }
  return count;
}

const range = (
  formatter: Intl.DateTimeFormat,
  start: number,
  end: number,
): string => formatter.formatRange(start, end);

function monthDayText(ms: number, env: Env): string {
  let text = env.monthDay.get(ms);
  if (text === undefined) {
    text = env.monthDayFormat.format(ms);
    env.monthDay.set(ms, text);
  }
  return text;
}

function eraText(ms: number, env: Env): string {
  let text = env.eras.get(ms);
  if (text === undefined) {
    text = env.eraFormat.format(ms);
    env.eras.set(ms, text);
  }
  return text;
}

const maskEra = (text: string): string =>
  [...text].filter((c) => !ANY_DIGIT.test(c) && !isSignish(c)).join("");

/** ICU's calendar year at `ms`, the source the single repair uses. */
function refYear(ms: number, env: Env): RefYear {
  let year = env.years.get(ms);
  if (year === undefined) {
    const text = env.reference.format(ms);
    const run = runsOf(text, env)[0];
    year =
      run === undefined
        ? { digits: "", count: 0, value: 0, negative: false }
        : {
            digits: run.text,
            count: run.count,
            value: run.value,
            negative: zoneCount(text, run.start, env.referenceMinus) > 0,
          };
    env.years.set(ms, year);
  }
  return year;
}

// ---------- Temporal helpers ----------

const zonedOf = (ms: number, env: Env): Temporal.ZonedDateTime =>
  Temporal.Instant.fromEpochMilliseconds(ms)
    .toZonedDateTimeISO(env.timeZone)
    .withCalendar(env.temporalCalendar);

/**
 * Move a moment by `k` calendar years, keeping month code, day and wall time. `exact` (used to
 * locate year runs) also keeps the weekday and ICU's own month and day, so only year fields can
 * change; the loose form (used to read a pattern's literals) keeps only the time.
 */
function computeShift(
  ms: number,
  k: number,
  env: Env,
  exact: boolean,
  keepWeekday: boolean,
): number | null {
  const zoned = zonedOf(ms, env);
  let moved: Temporal.ZonedDateTime;
  try {
    moved = zoned.with(
      { year: zoned.year + k, monthCode: zoned.monthCode, day: zoned.day },
      {
        overflow: exact ? "reject" : "constrain",
        disambiguation: "compatible",
        offset: "ignore",
      },
    );
  } catch {
    return null;
  }
  if (
    moved.hour !== zoned.hour ||
    moved.minute !== zoned.minute ||
    moved.second !== zoned.second ||
    moved.millisecond !== zoned.millisecond
  ) {
    return null;
  }
  if (!exact) {
    return moved.epochMilliseconds;
  }
  // ICU's lunisolar and pre-1582 dates can be a day or two off Temporal's: take the nearby day on
  // which ICU prints the same month and day, with the same weekday.
  const want = monthDayText(ms, env);
  for (const adjust of [0, -1, 1, -2, 2]) {
    const candidate = adjust === 0 ? moved : moved.add({ days: adjust });
    if (keepWeekday && candidate.dayOfWeek !== zoned.dayOfWeek) {
      continue;
    }
    if (monthDayText(candidate.epochMilliseconds, env) === want) {
      return candidate.epochMilliseconds;
    }
  }
  return null;
}

/** `computeShift` answers, kept per environment: they depend on its calendar and zone only. */
const shiftCache = new WeakMap<Env, Map<string, number | null>>();

/** `computeShift`, remembered: every formatter of an environment probes the same moments. */
function shiftYears(
  ms: number,
  k: number,
  env: Env,
  exact: boolean,
  keepWeekday: boolean,
): number | null {
  let byKey = shiftCache.get(env);
  if (byKey === undefined) {
    byKey = new Map();
    shiftCache.set(env, byKey);
  }
  const key = `${ms}|${k}|${exact}|${keepWeekday}`;
  const known = byKey.get(key);
  if (known !== undefined || byKey.has(key)) {
    return known ?? null;
  }
  const moved = computeShift(ms, k, env, exact, keepWeekday);
  byKey.set(key, moved);
  return moved;
}

// Multiples of 60 keep a sexagenary year name; multiples of 100 are left out, since they would
// leave a two-digit year unchanged.
const K_ORDER = [
  3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 60, 120, 180, 240, 360, 420, 480, 540, 660,
  720, 780, 840, 960, 1020, 1080, 1140, 1260, 1320, 13, 14, 15, 16, 17, 18, 19,
  20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38,
  39, 40,
];

const kCandidates = (direction: number): number[] => [
  ...K_ORDER.map((k) => direction * k),
  ...K_ORDER.map((k) => -direction * k),
];

/** A year in the calendar and in ISO 8601 at `ms`. */
function yearsOf(ms: number, env: Env): { calendar: number; iso: number } {
  const zoned = zonedOf(ms, env);
  return {
    calendar: zoned.year - env.yearBias,
    iso: zoned.withCalendar("iso8601").year,
  };
}

// ---------- locating the year runs of a range text ----------

/** Digit runs of one text with the placeholder `\0` in place of the runs at `indexes`. */
function masked(text: string, runs: readonly Run[], indexes: number[]): string {
  let out = "";
  let position = 0;
  for (const index of indexes) {
    const run = runs[index];
    if (run !== undefined) {
      out += text.slice(position, run.start) + "\u0000";
      position = run.end;
    }
  }
  return out + text.slice(position);
}

function changedRuns(before: readonly Run[], after: readonly Run[]): number[] {
  const changed: number[] = [];
  before.forEach((run, index) => {
    if (run.text !== after[index]?.text) {
      changed.push(index);
    }
  });
  return changed;
}

/** The glued form of a year in front of another numeric field (ha `yyyyMM`). */
function movedGlued(before: Run, after: Run, k: number): boolean {
  const size = Math.abs(k);
  for (let m = 1; m <= 2 && m < Math.min(before.count, after.count); m++) {
    const first = [...before.text];
    const second = [...after.text];
    if (first.slice(-m).join("") !== second.slice(-m).join("")) {
      continue;
    }
    const shift = Math.abs(
      Math.floor(after.value / 10 ** m) - Math.floor(before.value / 10 ** m),
    );
    if (Math.abs(shift - size) <= 1) {
      return true;
    }
  }
  return false;
}

/**
 * Whether a run moved as a year under a shift of `k` years: by `k` (era years count down, a
 * week-year may differ by one), modulo 100 for a two-digit run, modulo 60 for a sexagenary number.
 */
function movedLikeYear(before: Run, after: Run, k: number, env: Env): boolean {
  // Padding alone ("01" to "1") is a pattern change, not a year that moved.
  if (after.value === before.value) {
    return false;
  }
  if (
    RELATED.has(env.calendar) &&
    k % 60 !== 0 &&
    before.value >= 1 &&
    before.value <= 60 &&
    after.value >= 1 &&
    after.value <= 60
  ) {
    // A sexagenary year number wraps at 60.
    const wrapped = (((after.value - before.value) % 60) + 60) % 60;
    if ([k - 1, k, k + 1].some((want) => wrapped === ((want % 60) + 60) % 60)) {
      return true;
    }
  }
  if (Math.abs(Math.abs(after.value - before.value) - Math.abs(k)) <= 1) {
    return true;
  }
  if (movedGlued(before, after, k)) {
    return true;
  }
  if (before.count <= 2 && after.count <= 2) {
    const wrapped = (((after.value - before.value) % 100) + 100) % 100;
    return [k - 1, k, k + 1, -k - 1, -k, -k + 1].some(
      (want) => wrapped === ((want % 100) + 100) % 100,
    );
  }
  return false;
}

const unlettered = (text: string): string =>
  text.replace(/[\p{L}\p{M}]+/gu, "");

/** A pair of moments for the range under a shift of `k` years, or `null` when it cannot be made. */
type Reshift = (k: number) => [number, number] | null;

/** One shifted trial's result. */
interface Trial {
  readonly runs: Run[];
  readonly changed: number[];
}

/**
 * A shift by a multiple of 60 keeps a sexagenary year number, so an unchanged text there could
 * hide one. A small shift changes it: when the digit runs all stay the same under one (letters,
 * such as a year name or weekday, may change), no digit run depends on the year.
 */
function noDigitYear(
  formatter: Intl.DateTimeFormat,
  before: readonly Run[],
  env: Env,
  reshift: Reshift,
): boolean {
  // From 2: under a one-year shift a week-year can stay the same (2025-12-29 and 2026-12-29 are
  // both in week-year 2026); under 2..12 every year number, era year and sexagenary number moves.
  for (let k = 2; k <= 12; k++) {
    const pair = reshift(k);
    if (pair === null) {
      continue;
    }
    const after = runsOf(range(formatter, pair[0], pair[1]), env);
    if (after.length !== before.length) {
      continue;
    }
    return changedRuns(before, after).length === 0;
  }
  return false;
}

/**
 * One shifted trial: same run count, same text outside the runs that changed, and every run that
 * changed moved like a year.
 */
function trial(
  formatter: Intl.DateTimeFormat,
  original: { text: string; runs: Run[] },
  start: number,
  end: number,
  env: Env,
  k: number,
  reshift: Reshift,
): Trial | null {
  const text = range(formatter, start, end);
  const runs = runsOf(text, env);
  if (runs.length !== original.runs.length) {
    return null;
  }
  const changed = changedRuns(original.runs, runs);
  // No run moved: the text prints no year, unless k keeps a sexagenary year number unchanged.
  if (
    changed.length === 0 &&
    RELATED.has(env.calendar) &&
    k % 60 === 0 &&
    !noDigitYear(formatter, original.runs, env, reshift)
  ) {
    return null;
  }
  // Letters and marks are set aside: weekday, month and sexagenary year names change with the
  // date; the digit runs and the punctuation between them are the evidence.
  if (
    unlettered(masked(original.text, original.runs, changed)) !==
    unlettered(masked(text, runs, changed))
  ) {
    return null;
  }
  const moved = changed.every((index) => {
    const before = original.runs[index];
    const after = runs[index];
    return (
      before !== undefined &&
      after !== undefined &&
      movedLikeYear(before, after, k, env)
    );
  });
  return moved ? { runs, changed } : null;
}

/** A year run found in a range text: its index, whose endpoint it holds, and its shifted text. */
interface YearRun {
  readonly index: number;
  readonly owner: "a" | "b";
  readonly shiftedText: string;
  readonly shiftedMs: number;
}

/** A range text with the runs that hold a year. */
interface Located {
  readonly text: string;
  readonly runs: Run[];
  readonly years: YearRun[];
}

/**
 * A printed weekday must stay put under small shifts, since a weekday digit (vi "Thứ 4") moving by
 * up to 6 could pass for a two-digit year moved by k. Under a multiple of 60 that is not a
 * multiple of 100 it cannot: no rule in `movedLikeYear` accepts a change of -6..6 there.
 */
const keepsWeekday = (k: number): boolean => k % 60 !== 0;

const yearRunsOf = (
  found: Trial,
  owner: "a" | "b",
  shiftedMs: number,
): YearRun[] =>
  found.changed.map((index) => ({
    index,
    owner,
    shiftedText: found.runs[index]?.text ?? "",
    shiftedMs,
  }));

/** Locate the year runs when both endpoints are in one era: both move together. */
function locateTogether(
  formatter: Intl.DateTimeFormat,
  original: { text: string; runs: Run[] },
  a: number,
  b: number,
  env: Env,
  both: Reshift,
): YearRun[] | null {
  const ya = yearsOf(a, env);
  const direction = ya.calendar <= 0 || ya.iso <= 0 ? -1 : 1;
  for (const k of kCandidates(direction)) {
    const shiftedStart = shiftYears(a, k, env, true, keepsWeekday(k));
    if (shiftedStart === null) {
      continue;
    }
    const shiftedEnd = shiftYears(b, k, env, true, keepsWeekday(k));
    if (shiftedEnd === null) {
      continue;
    }
    const found = trial(
      formatter,
      original,
      shiftedStart,
      shiftedEnd,
      env,
      k,
      both,
    );
    if (found !== null) {
      return yearRunsOf(found, "a", shiftedStart);
    }
  }
  return null;
}

/**
 * Locate one endpoint's year runs by moving that endpoint alone, away from the other; `side` is
 * the direction of the move (the start goes back, the end goes forward).
 */
function locateAlone(
  formatter: Intl.DateTimeFormat,
  original: { text: string; runs: Run[] },
  a: number,
  b: number,
  env: Env,
  owner: "a" | "b",
): { runs: YearRun[]; changed: number[] } | null {
  const own = owner === "a" ? a : b;
  const other = owner === "a" ? b : a;
  const direction = owner === "a" ? -1 : 1;
  const pair = (moved: number): [number, number] =>
    owner === "a" ? [moved, b] : [a, moved];
  for (const k of kCandidates(direction)) {
    const moved = shiftYears(own, k, env, true, keepsWeekday(k));
    if (moved === null || eraText(moved, env) === eraText(other, env)) {
      continue;
    }
    const alone: Reshift = (kk) => {
      const shifted = shiftYears(own, direction * kk, env, true, false);
      return shifted === null || eraText(shifted, env) === eraText(other, env)
        ? null
        : pair(shifted);
    };
    const [from, to] = pair(moved);
    const found = trial(formatter, original, from, to, env, k, alone);
    if (found !== null) {
      return { runs: yearRunsOf(found, owner, moved), changed: found.changed };
    }
  }
  return null;
}

/** The year runs of `formatRange(a, b)`, or `null` when no shift keeps the pattern. */
function locate(
  formatter: Intl.DateTimeFormat,
  a: number,
  b: number,
  env: Env,
  text = range(formatter, a, b),
): Located | null {
  const runs = runsOf(text, env);
  const original = { text, runs };
  const both: Reshift = (k) => {
    const start = shiftYears(a, k, env, true, false);
    const end = shiftYears(b, k, env, true, false);
    return start === null || end === null ? null : [start, end];
  };
  const none = (): Located | null =>
    noDigitYear(formatter, runs, env, both) ? { text, runs, years: [] } : null;
  if (eraText(a, env) === eraText(b, env)) {
    const years = locateTogether(formatter, original, a, b, env, both);
    return years === null ? none() : { text, runs, years };
  }
  // Different calendar years: move each endpoint alone, away from the other.
  const first = locateAlone(formatter, original, a, b, env, "a");
  if (first === null) {
    return none();
  }
  const second = locateAlone(formatter, original, a, b, env, "b");
  if (second === null) {
    return none();
  }
  if (first.changed.some((index) => second.changed.includes(index))) {
    return none();
  }
  return {
    text,
    runs,
    years: [...first.runs, ...second.runs].sort((x, y) => x.index - y.index),
  };
}

// ---------- the sign of a year run ----------

/**
 * Week-years lie within one of the extended or ISO year, so both >= 1 means no value below 0.
 */
function surelyPositive(ms: number, env: Env): boolean {
  const years = yearsOf(ms, env);
  return years.calendar >= 1 && years.iso >= 1 && !refYear(ms, env).negative;
}

/**
 * The pattern's skeleton: the punctuation between consecutive digit runs, with letters, marks,
 * spaces and bidi marks left out, and the minus copies before each year run (those are what is
 * being measured).
 */
function skeleton(
  text: string,
  runs: readonly Run[],
  yearIndexes: ReadonlySet<number>,
  env: Env,
): string {
  const out: string[] = [];
  for (let index = 1; index < runs.length; index++) {
    const previous = runs[index - 1];
    const current = runs[index];
    if (previous === undefined || current === undefined) {
      continue;
    }
    let literal = text.slice(previous.end, current.start);
    if (yearIndexes.has(index)) {
      const copies = zoneCount(text, current.start, env.minusSign);
      literal = literal.slice(
        0,
        literal.length - copies * env.minusSign.length,
      );
    }
    // A letter takes its abbreviation dots with it ("B.R.O.C." against "Minguo").
    out.push(
      literal.replace(/[\p{L}\p{M}]+\.?/gu, "").replace(/[\p{Z}\s‎‏؜]+/gu, ""),
    );
  }
  return out.join("#");
}

/** The same range moved by whole years to where both endpoints are positive. */
interface Far {
  readonly text: string;
  readonly runs: Run[];
}

function farRange(
  formatter: Intl.DateTimeFormat,
  located: Located,
  a: number,
  b: number,
  env: Env,
): Far | null {
  const ya = yearsOf(a, env);
  const yb = yearsOf(b, env);
  const k0 = 2000 - Math.min(ya.iso, ya.calendar, yb.iso, yb.calendar);
  // Prefer a move that keeps both weekdays, so weekday names and numbers stay put.
  const weekday = (ms: number): number => zonedOf(ms, env).dayOfWeek;
  let pick: [number, number] | null = null;
  for (let k = k0; k < k0 + 400 && pick === null; k++) {
    const start = shiftYears(a, k, env, false, false);
    const end = shiftYears(b, k, env, false, false);
    if (
      start !== null &&
      end !== null &&
      weekday(start) === weekday(a) &&
      weekday(end) === weekday(b)
    ) {
      pick = [start, end];
    }
  }
  if (pick === null) {
    const start = shiftYears(a, k0, env, false, false);
    const end = shiftYears(b, k0, env, false, false);
    if (start !== null && end !== null) {
      pick = [start, end];
    }
  }
  if (
    pick === null ||
    !surelyPositive(pick[0], env) ||
    !surelyPositive(pick[1], env)
  ) {
    return null;
  }
  const text = range(formatter, pick[0], pick[1]);
  const runs = runsOf(text, env);
  const yearIndexes = new Set(located.years.map((year) => year.index));
  return runs.length === located.runs.length &&
    skeleton(text, runs, yearIndexes, env) ===
      skeleton(located.text, located.runs, yearIndexes, env)
    ? { text, runs }
    : null;
}

/** A run's sign: whether it is negative and how many characters the minus takes. */
interface Sign {
  readonly negative: boolean;
  readonly length: number;
}

/** The copies of the minus text before a run that belong to the pattern, not to the number. */
function literalCount(
  formatter: Intl.DateTimeFormat,
  located: Located,
  year: YearRun,
  a: number,
  b: number,
  env: Env,
  cache: { far?: Far | null },
): number | null {
  // 1. The matching year run of the other endpoint's half, when that endpoint is positive.
  const mine = located.years
    .filter((entry) => entry.owner === year.owner)
    .map((entry) => entry.index);
  const other = located.years
    .filter((entry) => entry.owner !== year.owner)
    .map((entry) => entry.index);
  if (
    mine.length === other.length &&
    surelyPositive(year.owner === "a" ? b : a, env)
  ) {
    const run = located.runs[other[mine.indexOf(year.index)] ?? -1];
    return run === undefined
      ? null
      : zoneCount(located.text, run.start, env.minusSign);
  }
  // 2. The same range moved by whole years to where both endpoints are positive, when the pattern
  // is unchanged.
  if (cache.far === undefined) {
    cache.far = farRange(formatter, located, a, b, env);
  }
  const run = cache.far?.runs[year.index];
  return cache.far === null || run === undefined
    ? null
    : zoneCount(cache.far.text, run.start, env.minusSign);
}

function signOf(
  formatter: Intl.DateTimeFormat,
  located: Located,
  year: YearRun,
  a: number,
  b: number,
  env: Env,
  cache: { far?: Far | null },
  digitsMatch: boolean,
): Sign | null {
  const run = located.runs[year.index];
  if (run === undefined) {
    return null;
  }
  const minus = env.minusSign;
  const copies = zoneCount(located.text, run.start, minus);
  if (copies === 0) {
    return { negative: false, length: 0 };
  }
  const ms = year.owner === "a" ? a : b;
  const ref = refYear(ms, env);
  // The calendar's own year is negative here and the run prints it: it is that year.
  if (ref.negative && run.text === ref.digits) {
    return { negative: true, length: minus.length };
  }
  // Both years positive: neither y nor a week-year (within one of either) can be negative.
  if (surelyPositive(ms, env)) {
    return { negative: false, length: 0 };
  }
  const literal = literalCount(formatter, located, year, a, b, env, cache);
  if (literal !== null) {
    if (copies - literal === 0) {
      return { negative: false, length: 0 };
    }
    return copies - literal === 1
      ? { negative: true, length: minus.length }
      : null;
  }
  if (digitsMatch) {
    return null;
  }
  // The digits are wrong either way; for the repair, read the sign from the week-year window: a
  // week-year is within one year of the calendar's extended year or of the ISO year.
  const window = weekYearWindow(ms, env);
  const positive = window.has(run.value);
  const negative = window.has(-run.value);
  if (positive === negative) {
    return null;
  }
  return negative
    ? { negative: true, length: minus.length }
    : { negative: false, length: 0 };
}

/** The values a week-year can take at `ms`: within one of the extended or the ISO year. */
function weekYearWindow(ms: number, env: Env): Set<number> {
  const years = yearsOf(ms, env);
  return new Set([
    years.calendar - 1,
    years.calendar,
    years.calendar + 1,
    years.iso - 1,
    years.iso,
    years.iso + 1,
  ]);
}

// ---------- the expected year text ----------

/** The last two digits of a year's digits, padded. */
function lastTwo(digits: string, env: Env): string {
  const characters = [...digits];
  return characters.length >= 2
    ? characters.slice(-2).join("")
    : env.zero + characters.join("");
}

/**
 * Sexagenary position of ICU's related year (chinese, dangi): year 4 CE is jia-zi, position 1.
 * Taken from ICU's own year, since ICU and Temporal can place a lunar new year a day apart.
 */
const cyclic = (ref: RefYear): number =>
  ((((ref.value - 4) % 60) + 60) % 60) + 1;

/** Whether a year glued to another numeric field (brx `d/My`) shows `ref` in this run. */
function gluedMatch(
  run: Run,
  ref: RefYear,
  y: YearRun,
  env: Env,
  two: boolean,
): boolean {
  const ref1 = refYear(y.shiftedMs, env);
  const forms: [string, string][] = [
    [lastTwo(ref.digits, env), lastTwo(ref1.digits, env)],
  ];
  if (!two) {
    forms.unshift([ref.digits, ref1.digits]);
  }
  return forms.some(([digits, shifted]) => {
    if (run.text.length <= digits.length) {
      return false;
    }
    return (
      (run.text.endsWith(digits) &&
        y.shiftedText ===
          run.text.slice(0, run.text.length - digits.length) + shifted) ||
      (run.text.startsWith(digits) &&
        y.shiftedText === shifted + run.text.slice(digits.length))
    );
  });
}

/**
 * Whether the run holds ICU's calendar year. `two`: the formatter asked for year "2-digit", whose
 * output ECMA-402 FormatDateTimePattern cuts to two digits; an ICU week-year field keeps its own
 * width there ("1617" for "17"), which is wrong as well.
 */
function digitsMatch(
  run: Run,
  ref: RefYear,
  env: Env,
  y: YearRun | undefined,
  two: boolean,
): boolean {
  // The whole year, never a glued form. Under "2-digit" more than two digits cannot come from a
  // two-digit year field.
  if (run.text === ref.digits) {
    return !(two && run.count > 2);
  }
  if (run.count === 2 && run.text === lastTwo(ref.digits, env)) {
    return true;
  }
  if (y !== undefined && gluedMatch(run, ref, y, env, two)) {
    return true;
  }
  if (RELATED.has(env.calendar)) {
    const position = cyclic(ref);
    return (
      run.value === position ||
      (run.count === 2 && run.value === position % 100)
    );
  }
  return false;
}

/** A run found wrong: it holds neither ICU's year nor its sign. */
interface Wrong {
  readonly run: Run;
  readonly sign: Sign;
  readonly ref: RefYear;
  readonly ms: number;
}

/** Check one range: the located year runs, and which of them do not hold the calendar year. */
function checkRange(
  formatter: Intl.DateTimeFormat,
  a: number,
  b: number,
  options: Intl.DateTimeFormatOptions,
  env: Env,
): { located: Located; wrong: Wrong[] } | null {
  const located = locate(formatter, a, b, env);
  if (located === null) {
    return null;
  }
  const cache: { far?: Far | null } = {};
  const wrong: Wrong[] = [];
  // ECMA-402 fixes "2-digit" at two digits for the year field only; in chinese and dangi the
  // reference is the related year, which FormatNumeric prints in full whatever the option.
  const two = options.year === "2-digit" && !RELATED.has(env.calendar);
  for (const year of located.years) {
    const ms = year.owner === "a" ? a : b;
    const run = located.runs[year.index];
    if (run === undefined) {
      return null;
    }
    const ref = refYear(ms, env);
    const matches = digitsMatch(run, ref, env, year, two);
    const sign = signOf(formatter, located, year, a, b, env, cache, matches);
    if (sign === null) {
      return null;
    }
    if (!(sign.negative === ref.negative && matches)) {
      wrong.push({ run, sign, ref, ms });
    }
  }
  return { located, wrong };
}

// ---------- the verdict ----------

const atDate = (date: Temporal.PlainDate, env: Env, time = "12:00"): number =>
  date.toZonedDateTime({ timeZone: env.timeZone, plainTime: time })
    .epochMilliseconds;

type Probe = [number, number];

/** The weekday offsets (1..6 from the first day of the week) of year starts, one date for each. */
function yearStarts(env: Env, anchor: number): Map<number, Temporal.PlainDate> {
  const byOffset = new Map<number, Temporal.PlainDate>();
  for (
    let year = anchor + 1;
    year <= anchor + 80 && byOffset.size < 6;
    year++
  ) {
    let first = Temporal.PlainDate.from({
      calendar: env.temporalCalendar,
      year,
      monthCode: "M01",
      day: 1,
    });
    // Year boundaries as ICU's own calendar year sees them.
    for (
      let steps = 0;
      refYear(atDate(first, env), env).digits ===
        refYear(atDate(first.subtract({ days: 1 }), env), env).digits &&
      steps < 4;
      steps++
    ) {
      first = first.add({ days: 1 });
    }
    const offset = (first.dayOfWeek - (env.firstDay ?? 1) + 7) % 7;
    if (offset !== 0 && !byOffset.has(offset)) {
      byOffset.set(offset, first);
    }
  }
  return byOffset;
}

/** Which year-start offsets to probe: two just after a week start (`L`) and two just before (`H`). */
function pickedOffsets(
  offsets: readonly number[],
  hasFirstDay: boolean,
): string[] {
  if (!hasFirstDay) {
    return offsets.flatMap((o) => [`L${o}`, `H${o}`]);
  }
  const unique = (keys: string[]): string[] => [...new Set(keys)];
  const low = offsets.find((o) => o >= 1);
  const lower = offsets.find((o) => o >= 2);
  const high = [...offsets].reverse().find((o) => o <= 6);
  const higher = [...offsets].reverse().find((o) => o <= 5);
  return unique([
    ...[low, lower].flatMap((o) => (o === undefined ? [] : [`L${o}`])),
    ...[high, higher].flatMap((o) => (o === undefined ? [] : [`H${o}`])),
  ]);
}

/** The day, month, year and time ranges on one side of a year boundary. */
function sideProbes(
  first: Temporal.PlainDate,
  side: "L" | "H",
  env: Env,
): Probe[] {
  const last = first.subtract({ days: 1 });
  const at = (date: Temporal.PlainDate, time?: string): number =>
    atDate(date, env, time);
  if (side === "L") {
    return [
      [at(last.subtract({ days: 1 })), at(last)],
      [at(last.subtract({ months: 1 })), at(last)],
      [at(last), at(first)],
      [at(last.subtract({ years: 1 })), at(last)],
      [at(last, "10:00"), at(last, "15:00")],
      [at(last, "10:00"), at(last, "10:30")],
    ];
  }
  return [
    [at(first), at(first.add({ days: 1 }))],
    [at(first), at(first.add({ months: 1 }))],
    [at(last), at(first)],
    [at(first), at(first.add({ years: 1 }))],
    [at(first, "10:00"), at(first, "15:00")],
    [at(first, "10:00"), at(first, "10:30")],
  ];
}

/** Probes in an earlier era (Temporal and ICU both see an era change), and across the era. */
function earlierEraProbes(
  anchor: number,
  env: Env,
  picked: readonly string[],
  starts: ReadonlyMap<number, Temporal.PlainDate>,
): Probe[] {
  const here = atDate(
    Temporal.PlainDate.from({
      calendar: env.temporalCalendar,
      year: anchor,
      monthCode: "M06",
      day: 1,
    }),
    env,
  );
  for (const step of [
    1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584,
  ]) {
    let earlier: Temporal.PlainDate;
    try {
      earlier = Temporal.PlainDate.from({
        calendar: env.temporalCalendar,
        year: anchor - step,
        monthCode: "M06",
        day: 1,
      });
    } catch {
      continue;
    }
    const start = atDate(earlier, env);
    if (maskEra(eraText(start, env)) === maskEra(eraText(here, env))) {
      continue;
    }
    const across = picked.flatMap((key): Probe[] => {
      const first = starts.get(Number(key.slice(1)));
      return first === undefined
        ? []
        : [
            [
              start,
              atDate(
                key.startsWith("L") ? first.subtract({ days: 1 }) : first,
                env,
              ),
            ],
          ];
    });
    return [
      [start, atDate(earlier.add({ days: 1 }), env)],
      [start, atDate(earlier.add({ months: 1 }), env)],
      [start, atDate(earlier.add({ years: 1 }), env)],
      [atDate(earlier, env, "10:00"), atDate(earlier, env, "15:00")],
      [atDate(earlier, env, "10:00"), atDate(earlier, env, "10:30")],
      ...across,
    ];
  }
  return [];
}

/**
 * The probe ranges of a calendar: year boundaries from 2024 on at weekday offsets 1 to 6 from the
 * locale's first day of the week, where `Y` and `y` differ, with day, month, year and time ranges
 * on both sides; and day, month, year, time and cross-era ranges in an earlier era.
 */
function computeProbes(env: Env): Probe[] {
  const anchor = Temporal.PlainDate.from("2024-07-01").withCalendar(
    env.temporalCalendar,
  ).year;
  const starts = yearStarts(env, anchor);
  const offsets = [...starts.keys()].sort((x, y) => x - y);
  const picked = pickedOffsets(offsets, env.firstDay !== undefined);
  const edges = picked.flatMap((key) => {
    const first = starts.get(Number(key.slice(1)));
    return first === undefined
      ? []
      : sideProbes(first, key.startsWith("L") ? "L" : "H", env);
  });
  return [...edges, ...earlierEraProbes(anchor, env, picked, starts)];
}

/** The probes of an environment, built once: they depend on its calendar, zone and locale only. */
const probeCache = new WeakMap<Env, Probe[]>();
function probes(env: Env): Probe[] {
  let list = probeCache.get(env);
  if (list === undefined) {
    list = computeProbes(env);
    probeCache.set(env, list);
  }
  return list;
}

/**
 * Whether the formatter's range pattern prints a week-based year where the calendar year is meant
 * (defect D24 in ranges). A digit run is a year run when it moves exactly as a year under a shift
 * of one or both endpoints by k years; each is compared with ICU's calendar year for its
 * endpoint, signed with the locale's minus, and under `year: "2-digit"` only the last two digits
 * (chinese and dangi print the related year at full width). A formatter whose range text holds no
 * decimal year is not flagged. A probe whose year runs cannot be located counts as flagged.
 *
 * Computed once per formatter, on its first range call; only `format` and `formatRange` are called.
 *
 * @param formatter the formatter whose range text is read
 * @param options the options it was built with
 * @returns `true` when its range text needs `repairRangeYear`
 *
 * @example rangeYearVerdict(new Intl.DateTimeFormat("en", { year: "numeric", month: "short" }), { year: "numeric", month: "short" }) // false
 * @example rangeYearVerdict(new Intl.DateTimeFormat("my-u-ca-buddhist", { year: "numeric", month: "short", day: "numeric" }), { year: "numeric", month: "short", day: "numeric" }) // true
 */
export function rangeYearVerdict(
  formatter: Intl.DateTimeFormat,
  options: Intl.DateTimeFormatOptions,
): boolean {
  const known = verdicts.get(formatter);
  if (known !== undefined) {
    return known;
  }
  let flagged: boolean;
  try {
    const env = envOf(formatter);
    flagged = false;
    for (const [a, b] of probes(env)) {
      const checked = checkRange(formatter, a, b, options, env);
      if (checked === null || checked.wrong.length > 0) {
        flagged = true;
        break;
      }
    }
  } catch {
    flagged = false;
  }
  verdicts.set(formatter, flagged);
  return flagged;
}

// ---------- the repair ----------

/** How a year run is written: full, or the last two digits. */
function styleFor(
  run: Run,
  options: Intl.DateTimeFormatOptions,
  env: Env,
): "two" | "full" {
  if (RELATED.has(env.calendar)) {
    return run.count === 2 ? "two" : "full";
  }
  if (options.year === "2-digit") {
    return "two";
  }
  if (options.year === "numeric") {
    return "full";
  }
  return run.count === 2 ? "two" : "full";
}

/** Whether the run holds one whole week-year value (within one of the extended or ISO year). */
function isWholeWeekYear(wrong: Wrong, env: Env): boolean {
  const window = weekYearWindow(wrong.ms, env);
  const value = wrong.sign.negative ? -wrong.run.value : wrong.run.value;
  return (
    window.has(value) ||
    (wrong.run.count === 2 &&
      [...window].some(
        (candidate) =>
          candidate < 0 === wrong.sign.negative &&
          Math.abs(candidate) % 100 === wrong.run.value,
      ))
  );
}

/** Whether the polyfill can project the instant onto the formatter's calendar. */
const readable = (ms: number, env: Env): boolean => {
  try {
    return Number.isFinite(yearsOf(ms, env).calendar);
  } catch {
    return false;
  }
};

/**
 * The range text with each week-based year run replaced by the endpoint's calendar year: ICU's
 * year, signed with the locale's minus, in the formatter's numbering system, ungrouped, at the
 * width printed (full, or the last two digits). Only the runs found wrong change, and every other
 * character is kept.
 *
 * @param formatter the formatter that prints the range
 * @param options the options it was built with
 * @param startMs the start of the range, in epoch milliseconds
 * @param endMs the end of the range, in epoch milliseconds
 * @returns the repaired text, or `null` when the year runs cannot be located or a run is not one
 *   whole week-year value
 *
 * @example repairRangeYear(new Intl.DateTimeFormat("kok-u-ca-japanese", { year: "numeric", month: "numeric", day: "numeric", timeZone: "UTC" }), { year: "numeric", month: "numeric", day: "numeric", timeZone: "UTC" }, Date.UTC(2018, 11, 27), Date.UTC(2019, 11, 27)) // the end year is 1 (Reiwa), not 2019
 */
export function repairRangeYear(
  formatter: Intl.DateTimeFormat,
  options: Intl.DateTimeFormatOptions,
  startMs: number,
  endMs: number,
): string | null {
  try {
    const env = envOf(formatter);
    if (!readable(startMs, env) || !readable(endMs, env)) {
      // The polyfill refuses a date the calendar cannot project (`indian` before ISO year 1,
      // V8 bug 10529), so no week-year can be measured there: ICU's text stands.
      return formatter.formatRange(startMs, endMs);
    }
    const checked = checkRange(formatter, startMs, endMs, options, env);
    if (checked === null) {
      return null;
    }
    if (!checked.wrong.every((wrong) => isWholeWeekYear(wrong, env))) {
      return null;
    }
    let out = checked.located.text;
    for (const wrong of checked.wrong.toSorted(
      (x, y) => y.run.start - x.run.start,
    )) {
      const digits =
        styleFor(wrong.run, options, env) === "two"
          ? lastTwo(wrong.ref.digits, env)
          : wrong.ref.digits;
      const sign = wrong.ref.negative ? env.minusSign : "";
      out =
        out.slice(0, wrong.run.start - wrong.sign.length) +
        sign +
        digits +
        out.slice(wrong.run.end);
    }
    return out;
  } catch {
    return null;
  }
}

/**
 * The formatter's range text with the calendar year where the engine prints the week-year: the
 * one call every library `formatRange` goes through. The verdict is computed on the formatter's
 * first call and kept; a formatter that is not flagged answers with the engine's own text, and a
 * stand-in that repairs its own range is called as it is.
 *
 * @returns the text, or `null` when a flagged formatter's year runs cannot be repaired
 */
export function formatRangeChecked(
  formatter: Intl.DateTimeFormat,
  options: Intl.DateTimeFormatOptions,
  startMs: number,
  endMs: number,
): string | null {
  if (handled.has(formatter) || !rangeYearVerdict(formatter, options)) {
    return formatter.formatRange(startMs, endMs);
  }
  return repairRangeYear(formatter, options, startMs, endMs);
}
