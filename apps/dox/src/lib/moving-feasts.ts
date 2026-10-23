/**
 * Pure helpers for Moving Feasts (CORE-54).
 *
 * Section 1 draws the two Easter Sundays of a year, how far apart they fall,
 * and a set of dates counted from each. Section 2 picks an ordinal weekday of a
 * month and labels every occurrence of that weekday with its ordinals. Every
 * date on screen comes from the library (`easterSunday`, `holidayDates`,
 * `nthWeekdayOfMonth`, `diffDate`, `areDatesEqual`); this module holds the
 * state, the presets, the arguments a link or the chat can seed, the marks the
 * month grid draws, the printed calls and the hand-off to the Builder.
 *
 * No DOM. Anything that reads the library takes a `FeastsLib` as its first
 * argument. No string here names a country, a statute or an operator; the
 * labels name the feast, which is the date's name in every calendar that uses
 * it.
 */
import { Temporal } from "@js-temporal/polyfill";
import type { HolidayRule, WeekdayOrdinal } from "@northguild/gmt";
import type { FeastsLib } from "./feasts-lib";
import { MAX_RULES, formatRuleLines } from "./holiday-codec";
import {
  NO_SIGNAL_TEXT,
  YEAR_MAX,
  YEAR_MIN,
  literal,
} from "./holiday-rule-builder";
import { monthName, type CellMark, type SeriesNumber } from "./holiday-widgets";
import { encodeWidgetPermalink } from "./widget-permalink";

// ---------------------------------------------------------------------------
// The offsets, the series and the presets
// ---------------------------------------------------------------------------

export interface FeastOffset {
  offset: number;
  label: string;
}

/** The days from Easter the page offers, each with the feast's name. */
export const FEAST_OFFSETS: readonly FeastOffset[] = [
  { offset: -46, label: "Easter −46 (Ash Wednesday)" },
  { offset: -2, label: "Easter −2 (Good Friday)" },
  { offset: 0, label: "Easter Sunday" },
  { offset: 1, label: "Easter +1 (Easter Monday)" },
  { offset: 39, label: "Easter +39 (Ascension)" },
  { offset: 49, label: "Easter +49 (Pentecost)" },
  { offset: 50, label: "Easter +50 (Whit Monday)" },
];

export const DEFAULT_OFFSETS: readonly number[] = [-2, 0, 1];

export type Computus = "gregorian" | "julian";
export type ComputusChoice = Computus | "both";
export const COMPUTUS_CHOICES: readonly ComputusChoice[] = [
  "gregorian",
  "julian",
  "both",
];
export const COMPUTUS_LABELS: Record<ComputusChoice, string> = {
  gregorian: "Gregorian",
  julian: "Julian",
  both: "Both",
};

/** The pick series of a date: the Gregorian series, the Julian series, or both
 *  (the crosshatch carries both patterns). */
const SERIES: Record<Computus, SeriesNumber> = { gregorian: 1, julian: 2 };
const BOTH_SERIES: SeriesNumber = 3;

/** The grid's months when nothing falls outside them. */
export const GRID_FROM = 2;
export const GRID_TO = 6;
/** The slider spans the reader's year plus or minus this. */
export const SLIDER_SPAN = 100;

export const SECTION_TWO_HINT = "The year is the one in section 1.";

export interface FeastPreset {
  id: string;
  label: string;
  description: string;
  /** Carried as a literal; the page never reads the clock for a preset. */
  year: number;
  month: number;
  weekday: number;
  ordinal: string;
}

export const FEAST_PRESETS: readonly FeastPreset[] = [
  {
    id: "third-wednesday",
    label: "Third Wednesday of March",
    description:
      "The third Wednesday of a month falls between the 15th and the 21st, so it is never earlier or later than that.",
    year: 2026,
    month: 3,
    weekday: 3,
    ordinal: "3",
  },
  {
    id: "last-sunday-march",
    label: "Last Sunday of March",
    description:
      "In 2026 March has five Sundays, so the last Sunday is also the fifth: the day carries the ordinals 5 and -1.",
    year: 2026,
    month: 3,
    weekday: 7,
    ordinal: "last",
  },
  {
    id: "last-sunday-october",
    label: "Last Sunday of October",
    description:
      "The last Sunday of a month is a rule that stays put while its date moves from year to year.",
    year: 2026,
    month: 10,
    weekday: 7,
    ordinal: "last",
  },
  {
    id: "fifth-friday",
    label: "Fifth Friday of February",
    description:
      "February 2026 has four Fridays, so there is no fifth one and the answer is empty. Switch the month to January, which has five.",
    year: 2026,
    month: 2,
    weekday: 5,
    ordinal: "5",
  },
];

export const CUSTOM_PRESET_ID = "custom";

// ---------------------------------------------------------------------------
// State and arguments
// ---------------------------------------------------------------------------

export interface FeastsState {
  /** The text typed: any integer is passed to the library, which judges it. */
  year: string;
  /** Toggled offsets, ascending, each one of `FEAST_OFFSETS`. */
  offsets: number[];
  computus: ComputusChoice;
  month: string;
  /** ISO weekday `1`..`7`. */
  weekday: string;
  /** `1`..`5`, `-1`..`-5` or `last`. */
  ordinal: string;
}

export function presetState(
  preset: FeastPreset,
  keep?: Pick<FeastsState, "offsets" | "computus">,
): FeastsState {
  return {
    year: String(preset.year),
    offsets: keep ? [...keep.offsets] : [...DEFAULT_OFFSETS],
    computus: keep ? keep.computus : "both",
    month: String(preset.month),
    weekday: String(preset.weekday),
    ordinal: preset.ordinal,
  };
}

export const ORDINAL_VALUES: readonly string[] = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "-1",
  "-2",
  "-3",
  "-4",
  "-5",
  "last",
];

/** The ten ordinals a weekday can have in a month. */
const ORDINAL_NUMBERS: readonly WeekdayOrdinal[] = [
  1, 2, 3, 4, 5, -1, -2, -3, -4, -5,
];

export interface MovingFeastsArgs {
  /** A preset id, from a permalink. */
  preset?: string;
  year?: number | string;
  offsets?: number[] | string;
  computus?: string;
  month?: number | string;
  weekday?: number | string;
  ordinal?: number | string;
  /** The chat's name for `ordinal`. */
  n?: number | string;
}

/** Whether the args seed anything. */
export function isSeeded(args: MovingFeastsArgs): boolean {
  return Object.values(args).some((v) => v !== undefined && v !== "");
}

const INTEGER = /^-?\d+$/;

function integerText(value: unknown): string | null {
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : null;
  }
  if (typeof value === "string" && INTEGER.test(value.trim())) {
    return String(Number(value.trim()));
  }
  return null;
}

function offsetsOfArg(value: unknown): number[] | null {
  const items: unknown[] | null = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\s,]+/).filter((s) => s !== "")
      : null;
  if (items === null) return null;
  // An empty list is the reader's choice of no offsets, not a missing value.
  if (items.length === 0) return [];
  const known = new Set(FEAST_OFFSETS.map((o) => o.offset));
  const picked = new Set(
    items.map(Number).filter((n) => Number.isInteger(n) && known.has(n)),
  );
  return picked.size === 0
    ? null
    : FEAST_OFFSETS.map((o) => o.offset).filter((n) => picked.has(n));
}

function ordinalOfArg(value: unknown): string | null {
  if (value === "last") return "last";
  const text = integerText(value);
  return text !== null && ORDINAL_VALUES.includes(text) ? text : null;
}

/**
 * Seed arguments as controls. Typed values (the chat) and their text forms (a
 * permalink) both land here; anything unusable falls back to the first
 * preset's value for that control. An offset the page does not offer is
 * dropped. An empty `offsets` list toggles every offset off.
 */
export function readArgs(args: MovingFeastsArgs): FeastsState {
  const named = FEAST_PRESETS.find((p) => p.id === args.preset);
  const state = presetState(named ?? FEAST_PRESETS[0]!);
  const year = integerText(args.year);
  if (year !== null) state.year = year;
  const offsets = offsetsOfArg(args.offsets);
  if (offsets !== null) state.offsets = offsets;
  if (
    typeof args.computus === "string" &&
    (COMPUTUS_CHOICES as readonly string[]).includes(args.computus)
  ) {
    state.computus = args.computus as ComputusChoice;
  }
  const month = integerText(args.month);
  if (month !== null && Number(month) >= 1 && Number(month) <= 12) {
    state.month = month;
  }
  const weekday = integerText(args.weekday);
  if (weekday !== null && Number(weekday) >= 1 && Number(weekday) <= 7) {
    state.weekday = weekday;
  }
  const ordinal = ordinalOfArg(args.ordinal ?? args.n);
  if (ordinal !== null) state.ordinal = ordinal;
  return state;
}

/** The preset the section 2 controls and the year match, or `custom`. */
export function matchPreset(state: FeastsState): string {
  const hit = FEAST_PRESETS.find(
    (p) =>
      String(p.year) === state.year &&
      String(p.month) === state.month &&
      String(p.weekday) === state.weekday &&
      p.ordinal === state.ordinal,
  );
  return hit ? hit.id : CUSTOM_PRESET_ID;
}

/** The permalink payload: `preset` first when the state matches one. */
export function permalinkOf(state: FeastsState): Record<string, unknown> {
  const preset = matchPreset(state);
  return {
    ...(preset === CUSTOM_PRESET_ID ? {} : { preset }),
    year: state.year,
    offsets: state.offsets.join(","),
    computus: state.computus,
    month: state.month,
    weekday: state.weekday,
    ordinal: state.ordinal,
  };
}

/** The slider's ends from the reader's year. */
export function sliderRange(thisYear: number): { min: number; max: number } {
  return { min: thisYear - SLIDER_SPAN, max: thisYear + SLIDER_SPAN };
}

/** The year the clock shows, for the slider only. */
export function readersYear(): number {
  return Temporal.Now.plainDateISO().year;
}

/** The text typed as a number the library is asked about. Text that is no
 *  integer is `NaN`, which the library answers with `""`. */
export function yearNumber(text: string): number {
  return INTEGER.test(text.trim()) ? Number(text.trim()) : Number.NaN;
}

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

const WEEKDAY_LONG = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export function weekdayLong(weekday: number): string {
  return WEEKDAY_LONG[weekday - 1] ?? "";
}

const POSITIVE_WORDS = ["first", "second", "third", "fourth", "fifth"];
const COUNT_WORDS = ["no", "one", "two", "three", "four", "five"];

/** An ordinal as a phrase: `3` is "third", `-1` is "last", `-2` is
 *  "second-last". */
export function ordinalWord(ordinal: string): string {
  if (ordinal === "last") return "last";
  const n = Number(ordinal);
  if (n > 0) return POSITIVE_WORDS[n - 1] ?? ordinal;
  if (n === -1) return "last";
  return `${POSITIVE_WORDS[-n - 1] ?? ordinal}-last`;
}

/** "−2", "0", "+1": the offset as the labels write it. */
export function offsetText(offset: number): string {
  if (offset === 0) return "0";
  return offset > 0 ? `+${offset}` : `−${-offset}`;
}

function plural(count: number, word: string): string {
  return count === 1 ? word : `${word}s`;
}

// ---------------------------------------------------------------------------
// Section 1: Easter
// ---------------------------------------------------------------------------

export interface EasterPlates {
  gregorian: string | null;
  julian: string | null;
  /** "35 days" or "same day"; `null` when either Easter is missing. */
  apart: string | null;
  /** Which side the Julian date falls on, in words; "" when same or missing. */
  side: string;
}

/** The two Easter Sundays and the distance between them, all from the library.
 *  `""` from the library becomes `null`: NO SIGNAL. */
export function easterPlates(lib: FeastsLib, year: number): EasterPlates {
  const g = lib.easterSunday(year);
  const j = lib.easterSunday(year, { computus: "julian" });
  const gregorian = g === "" ? null : g;
  const julian = j === "" ? null : j;
  if (gregorian === null || julian === null) {
    return { gregorian, julian, apart: null, side: "" };
  }
  if (lib.areDatesEqual(gregorian, julian)) {
    return { gregorian, julian, apart: "same day", side: "" };
  }
  const days = lib.diffDate(gregorian, julian, "days");
  const count = Math.abs(days);
  return {
    gregorian,
    julian,
    apart: `${count} ${plural(count, "day")}`,
    side: days > 0 ? "Julian after Gregorian" : "Julian before Gregorian",
  };
}

export function offsetLabel(offset: number): string {
  return FEAST_OFFSETS.find((o) => o.offset === offset)?.label ?? "";
}

/** The series a state draws. */
export function seriesOf(choice: ComputusChoice): Computus[] {
  return choice === "both" ? ["gregorian", "julian"] : [choice];
}

/** The rule one toggled offset makes under one computus. */
export function feastRule(offset: number, computus: Computus): HolidayRule {
  const label = offsetLabel(offset);
  return computus === "julian"
    ? {
        name: `Julian ${label}`,
        kind: "easterRelative",
        offsetDays: offset,
        computus: "julian",
      }
    : { name: label, kind: "easterRelative", offsetDays: offset };
}

export interface FeastMarks {
  marks: Record<string, CellMark>;
  /** Every returned date, in call order. */
  dates: string[];
  /** The `holidayDates` calls, with their results, as source. */
  calls: string[];
}

/**
 * One `holidayDates` call per toggled offset and series. A date a Gregorian
 * offset and a Julian offset both land on carries the crosshatch (series 3) and
 * both words; a chip names each as `G−2` or `J+1`.
 */
export function feastMarks(
  lib: FeastsLib,
  year: number,
  offsets: readonly number[],
  choice: ComputusChoice,
): FeastMarks {
  const marks: Record<string, CellMark> = {};
  const hit = new Map<string, Set<Computus>>();
  const dates: string[] = [];
  const calls: string[] = [];
  for (const computus of seriesOf(choice)) {
    for (const offset of offsets) {
      const rule = feastRule(offset, computus);
      const found = lib.holidayDates(rule, year);
      calls.push(
        `holidayDates(${literal(rule)}, ${year}); // ${literal(found)}`,
      );
      for (const date of found) {
        dates.push(date);
        const mark = (marks[date] ??= { chips: [], words: [] });
        (mark.chips as string[]).push(
          `${computus === "julian" ? "J" : "G"}${offsetText(offset)}`,
        );
        (mark.words as string[]).push(
          `${computus === "julian" ? "Julian" : "Gregorian"} ${offsetLabel(offset)}`,
        );
        const set = hit.get(date) ?? new Set<Computus>();
        set.add(computus);
        hit.set(date, set);
      }
    }
  }
  for (const [date, set] of hit) {
    marks[date]!.pick =
      set.size > 1 ? BOTH_SERIES : SERIES[[...set][0] as Computus];
  }
  return { marks, dates, calls };
}

/** The year and month of a returned date, or `null` when the polyfill cannot
 *  place it. */
function yearMonthOf(date: string): { year: number; month: number } | null {
  try {
    const d = Temporal.PlainDate.from(date);
    return { year: d.year, month: d.month };
  } catch {
    return null;
  }
}

/**
 * The months the grid draws: February to June, widened to the months the
 * returned dates of this year span. A date in another year is not drawn, and
 * is counted in `outside` so the page can say so.
 */
export function gridMonths(
  dates: readonly string[],
  year: number,
): { from: number; to: number; outside: number } {
  let from = GRID_FROM;
  let to = GRID_TO;
  let outside = 0;
  for (const date of dates) {
    const at = yearMonthOf(date);
    if (at === null || at.year !== year) {
      outside += 1;
      continue;
    }
    from = Math.min(from, at.month);
    to = Math.max(to, at.month);
  }
  return { from, to, outside };
}

/** The lowest and highest ISO year the library takes. */
export const YEAR_LOWEST = -271821;
export const YEAR_HIGHEST = 275760;

/** Whether the library takes this year at all. Anything else is NO SIGNAL
 *  with an empty grid; a year inside is always answered from library calls. */
export function yearTaken(year: number): boolean {
  return Number.isInteger(year) && year >= YEAR_LOWEST && year <= YEAR_HIGHEST;
}

/** The ISO year of a returned date, or `null` when it cannot be placed. */
export function yearOfDate(date: string): number | null {
  return yearMonthOf(date)?.year ?? null;
}

function monthDrawable(year: number, month: number): boolean {
  try {
    const first = Temporal.PlainDate.from({ year, month, day: 1 });
    first.with({ day: first.daysInMonth });
    return true;
  } catch {
    return false;
  }
}

/**
 * The months of `months` the grid can draw whole. Next to either end of
 * Temporal's range a month is cut off (April of -271821, September of 275760),
 * and a grid needs every day of a month it draws.
 */
export function drawableMonths(
  year: number,
  months: { from: number; to: number },
): { from: number; to: number } | null {
  let { from, to } = months;
  while (from <= to && !monthDrawable(year, from)) from += 1;
  while (to >= from && !monthDrawable(year, to)) to -= 1;
  return from <= to ? { from, to } : null;
}

/** The dates among `dates` that fall in `year` but in a month not drawn. */
export function undrawnCount(
  dates: readonly string[],
  year: number,
  drawn: { from: number; to: number } | null,
): number {
  let count = 0;
  for (const date of dates) {
    const at = yearMonthOf(date);
    if (at === null || at.year !== year) continue;
    if (drawn === null || at.month < drawn.from || at.month > drawn.to) {
      count += 1;
    }
  }
  return count;
}

export interface YearNoteInput {
  /** The year as typed. */
  year: string;
  taken: boolean;
  gregorian: string | null;
  julian: string | null;
  /** Dates the library returned that fall in another ISO year. */
  outside: number;
  /** Dates in this year in a month the grid cannot draw. */
  undrawn: number;
}

export const NOTE_NOT_TAKEN = `${NO_SIGNAL_TEXT}: the library takes years ${YEAR_LOWEST} to ${YEAR_HIGHEST}.`;

/**
 * What the note under the Easter grid says, in words built from the values.
 * It names a plate whose date lies in another ISO year than the grid, a plate
 * the library did not place for a year it takes, and dates the grid does not
 * show. `""` when plates and grid agree.
 */
export function yearNote(i: YearNoteInput): string {
  if (!i.taken) return NOTE_NOT_TAKEN;
  const parts: string[] = [];
  const named: [string, string | null][] = [
    ["Gregorian", i.gregorian],
    ["Julian", i.julian],
  ];
  for (const [name, date] of named) {
    if (date === null) {
      parts.push(
        `easterSunday places no ${name} Easter for ${i.year} inside the range the library takes, but dates counted from neighbouring years can fall in ${i.year}.`,
      );
    } else if (yearOfDate(date) !== Number(i.year)) {
      parts.push(
        `The ${name} Easter of ${i.year} falls on ${date}, in another calendar year, and the grid shows the dates that fall in ${i.year}.`,
      );
    }
  }
  const hidden = i.outside + i.undrawn;
  if (hidden > 0) {
    parts.push(
      `${hidden} marked ${hidden === 1 ? "date falls" : "dates fall"} outside the months drawn for ${i.year}.`,
    );
  }
  return parts.join(" ");
}

/** The longest notes the line can show, so the note's slot holds that height. */
export function yearNoteSizers(): string[] {
  const edge = "+275760-09-13";
  const worst = yearNote({
    year: String(YEAR_LOWEST),
    taken: true,
    gregorian: edge,
    julian: edge,
    outside: 99,
    undrawn: 99,
  });
  const absent = yearNote({
    year: String(YEAR_LOWEST),
    taken: true,
    gregorian: null,
    julian: null,
    outside: 99,
    undrawn: 99,
  });
  return [worst, absent, NOTE_NOT_TAKEN];
}

// ---------------------------------------------------------------------------
// Section 2: ordinal weekdays
// ---------------------------------------------------------------------------

export interface NthModel {
  /** The picked ordinal's date; `""` when the library has none. */
  date: string;
  /** Every occurrence of the weekday, ascending, with its ordinals. */
  occurrences: { date: string; ordinals: string[] }[];
  marks: Record<string, CellMark>;
  /** Why there is no date, in words from the inputs; "" when there is one. */
  reason: string;
  calls: string[];
}

function weekdayOrdinal(ordinal: string): WeekdayOrdinal {
  return (ordinal === "last" ? "last" : Number(ordinal)) as WeekdayOrdinal;
}

/**
 * The picked date, and the ten calls that label every occurrence of the
 * weekday. A `""` from the library is the verdict; the words around it come
 * from the inputs and the count of occurrences those ten calls found.
 */
export function nthModel(
  lib: FeastsLib,
  year: number,
  month: number,
  weekday: number,
  ordinal: string,
): NthModel {
  const date = lib.nthWeekdayOfMonth(
    year,
    month,
    weekday,
    weekdayOrdinal(ordinal),
  );
  const byDate = new Map<string, string[]>();
  const calls: string[] = [
    `nthWeekdayOfMonth(${year}, ${month}, ${weekday}, ${literal(weekdayOrdinal(ordinal))}); // ${literal(date)}`,
  ];
  for (const n of ORDINAL_NUMBERS) {
    const found = lib.nthWeekdayOfMonth(year, month, weekday, n);
    if (found === "") continue;
    byDate.set(found, [...(byDate.get(found) ?? []), String(n)]);
  }
  const occurrences = [...byDate]
    .map(([d, ordinals]) => ({ date: d, ordinals }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const marks: Record<string, CellMark> = {};
  for (const occurrence of occurrences) {
    marks[occurrence.date] = {
      chips: occurrence.ordinals,
      words: [`ordinals ${occurrence.ordinals.join(", ")}`],
      ...(occurrence.date === date ? { pick: 1 as SeriesNumber } : {}),
    };
  }
  let reason = "";
  if (date === "") {
    reason = nthReason(ordinal, weekday, occurrences.length);
  }
  return { date, occurrences, marks, reason, calls };
}

/** Why a month has no such weekday, in words from the inputs. */
function nthReason(ordinal: string, weekday: number, count: number): string {
  return count === 0
    ? "The library places no weekday in that year."
    : `This month has no ${ordinalWord(ordinal)} ${weekdayLong(weekday)} (${COUNT_WORDS[count] ?? count} ${plural(count, weekdayLong(weekday))}).`;
}

/**
 * The longest notes the line under the ordinal grid can show: the reason for
 * every ordinal and weekday a month can lack, with the NO SIGNAL lead the
 * mount writes, longest first. They are the note's sizers, so its slot holds
 * the height of the worst case at every width, derived from the same words.
 */
export function nthNoteSizers(): string[] {
  const texts = new Set<string>([`${NO_SIGNAL_TEXT}: ${nthReason("1", 1, 0)}`]);
  for (const ordinal of ORDINAL_VALUES) {
    for (let weekday = 1; weekday <= 7; weekday++) {
      // A month holds four or five of a weekday; the ordinal is missing from
      // the shorter ones.
      for (const count of [4, 5]) {
        texts.add(`${NO_SIGNAL_TEXT}: ${nthReason(ordinal, weekday, count)}`);
      }
    }
  }
  return [...texts].sort((a, b) => b.length - a.length).slice(0, 4);
}

/** The line under the Date plate: what was asked, from the inputs. */
export function nthSentence(
  year: string,
  month: number,
  weekday: number,
  ordinal: string,
): string {
  return `${ordinalWord(ordinal)} ${weekdayLong(weekday)} of ${monthName(month)} ${year}`;
}

// ---------------------------------------------------------------------------
// The hand-off to the Builder
// ---------------------------------------------------------------------------

export const HINT_NO_OFFSET = "Toggle an offset first.";
export const HINT_TOO_MANY = `The Builder takes ${MAX_RULES} rules at most: toggle some offsets off, or pick one computus.`;
export const HINT_YEAR = `The Builder takes years ${YEAR_MIN} to ${YEAR_MAX}.`;
export const HINT_NO_YEAR = "Type a year the library places first.";

export const FEASTS_ZONE = "UTC";
export const FEASTS_WEEKEND = "6,7";

/** The rules the toggles make: the Gregorian series, then the Julian one. */
export function builderRules(state: FeastsState): HolidayRule[] {
  return seriesOf(state.computus).flatMap((computus) =>
    state.offsets.map((offset) => feastRule(offset, computus)),
  );
}

/**
 * "Build a calendar from these": the Builder, seeded with one
 * `easterRelative` rule per toggled offset under the selected computus, the
 * year, a Saturday and Sunday weekend and `UTC`. `hint` says why there is no
 * link.
 */
export function builderHandoff(
  state: FeastsState,
  yearIsPlaced: boolean,
): { href: string | null; hint: string } {
  const year = INTEGER.test(state.year.trim())
    ? Number(state.year.trim())
    : NaN;
  if (!yearIsPlaced) return { href: null, hint: HINT_NO_YEAR };
  if (state.offsets.length === 0) return { href: null, hint: HINT_NO_OFFSET };
  if (!(year >= YEAR_MIN && year <= YEAR_MAX)) {
    return { href: null, hint: HINT_YEAR };
  }
  const rules = builderRules(state);
  if (rules.length > MAX_RULES) return { href: null, hint: HINT_TOO_MANY };
  return {
    href: encodeWidgetPermalink("holidays", {
      rules: formatRuleLines(rules),
      year: String(year),
      weekend: FEASTS_WEEKEND,
      zone: FEASTS_ZONE,
    }),
    hint: "",
  };
}

/**
 * The printed calls at their widest: the same lines the mount prints, built by
 * the same functions over a library that answers every call with the widest
 * date, the widest year and a signed day count. It is the frame's hidden twin,
 * so the frame holds one height whatever year the reader drags to.
 */
export function callsSizerText(i: {
  offsets: readonly number[];
  computus: ComputusChoice;
  month: number;
  weekday: number;
  ordinal: string;
}): string {
  const widest = "+275760-09-13";
  const wide = {
    nthWeekdayOfMonth: () => widest,
    easterSunday: () => widest,
    holidayDates: () => [widest],
    areDatesEqual: () => false,
    diffDate: () => -35,
  } as unknown as FeastsLib;
  return [
    ...easterCalls(wide, YEAR_LOWEST),
    ...feastMarks(wide, YEAR_LOWEST, i.offsets, i.computus).calls,
    ...nthModel(wide, YEAR_LOWEST, i.month, i.weekday, i.ordinal).calls,
  ].join("\n");
}

/** The Easter calls, as source, with the library's results. */
export function easterCalls(lib: FeastsLib, year: number): string[] {
  const g = lib.easterSunday(year);
  const j = lib.easterSunday(year, { computus: "julian" });
  const lines = [
    `easterSunday(${year}); // ${literal(g)}`,
    `easterSunday(${year}, { computus: "julian" }); // ${literal(j)}`,
  ];
  if (g !== "" && j !== "") {
    lines.push(
      `areDatesEqual(${literal(g)}, ${literal(j)}); // ${literal(lib.areDatesEqual(g, j))}`,
      `diffDate(${literal(g)}, ${literal(j)}, "days"); // ${lib.diffDate(g, j, "days")}`,
    );
  }
  return lines;
}
