/**
 * Pure helpers for the Leap-Day Birthday tool (CORE-102).
 *
 * The reader gives a yearly date (a month-day, a date of birth or a date-time),
 * a locale and a year. The tool reads three plates (the stored `--MM-DD`, how
 * it reads in the locale and the date it falls on in that year) and a table of
 * eight consecutive years. Every date on screen comes from the library
 * (`parseMonthDay`, `parseMonthDayFromDate`, `parseMonthDayFromDateTime`,
 * `formatMonthDay`, `monthDayToDate`, `compareMonthDays`, `areMonthDaysEqual`,
 * `isValidDate`, `addDate`); this module holds the state, the presets, the
 * arguments a link or the chat can seed, the rows, the verdict words and the
 * printed calls.
 *
 * No DOM. Anything that reads the library takes a `MonthDayLib` as its first
 * argument. The module never inspects a string to decide which reader to use,
 * never compares digits and never checks for a leap year: a verdict is the
 * library's `areMonthDaysEqual` and `compareMonthDays` on the library's own
 * results. No string here names a country or a statute.
 */
import type { MonthDayLib } from "./month-day-lib";
import { NO_SIGNAL_TEXT, literal } from "./holiday-rule-builder";
import { readersYear, sliderRange, yearNumber } from "./moving-feasts";

export { readersYear, sliderRange, yearNumber };

/** How many consecutive years the table draws, starting at the chosen one. */
export const ROW_COUNT = 8;

/** The library's year range for a PlainDate, which no row can leave. */
export const WIDEST_DATE = "+275760-09-13";

/** The locale the tool opens with. */
export const DEFAULT_LOCALE = "en";

export const READS_OPTIONS = { month: "long", day: "numeric" } as const;

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

export interface LeapPreset {
  id: string;
  label: string;
  description: string;
  value: string;
  /** `null` is the reader's year, so a preset never ages. */
  year: number | null;
  locale: string;
  /**
   * The preset's own data says the month has no such day. The library tells
   * every refused input apart from none other, so this is the only way the
   * page can name the reason, and only for this exact value.
   */
  noSuchDay?: true;
}

export const LEAP_PRESETS: readonly LeapPreset[] = [
  {
    id: "leap-day-birth",
    label: "A date of birth on 29 February",
    description:
      "A full date of birth is read for its month and day only. In a common year the library gives 28 February.",
    value: "2000-02-29",
    year: null,
    locale: "en",
  },
  {
    id: "century",
    label: "A century year",
    description:
      "A century year is a leap year only when it divides by 400, so 2100 has no 29 February and 2104 does.",
    value: "--02-29",
    year: 2097,
    locale: "en",
  },
  {
    id: "short-form",
    label: "The short form, MM-DD",
    description:
      "The leading dashes are optional on the way in. What is stored always has them.",
    value: "03-15",
    year: null,
    locale: "de-DE",
  },
  {
    id: "from-date-time",
    label: "A date-time",
    description:
      "A date-time is read for its month and day. The time never moves the day.",
    value: "2024-02-29T08:30:00",
    year: 2023,
    locale: "ja-JP",
  },
  {
    id: "not-a-day",
    label: "A day the month does not have",
    description:
      "Thirty February exists in no year, so no reader accepts it and nothing below is guessed.",
    value: "--02-30",
    year: null,
    locale: "en",
    noSuchDay: true,
  },
];

export const CUSTOM_PRESET_ID = "custom";

// ---------------------------------------------------------------------------
// State and arguments
// ---------------------------------------------------------------------------

export interface LeapState {
  /** The text typed: a month-day, a date or a date-time. */
  value: string;
  /** The text typed: any integer is passed to the library, which judges it. */
  year: string;
  /** A BCP 47 tag, passed to the library, which judges it. */
  locale: string;
}

export function presetState(
  preset: LeapPreset,
  thisYear: number = readersYear(),
): LeapState {
  return {
    value: preset.value,
    year: String(preset.year ?? thisYear),
    locale: preset.locale,
  };
}

export interface LeapDayArgs {
  /** A preset id, from a permalink. */
  preset?: string;
  value?: string;
  year?: number | string;
  locale?: string;
}

/** Whether the args seed anything. */
export function isSeeded(args: LeapDayArgs): boolean {
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

/**
 * Seed arguments as controls. Typed values (the chat) and their text forms (a
 * permalink) both land here; anything unusable falls back to the first
 * preset's value for that control. A typed year that is not an integer keeps
 * its text, so a link can carry the "no signal" state it was copied from.
 */
export function readArgs(
  args: LeapDayArgs,
  thisYear: number = readersYear(),
): LeapState {
  const named = LEAP_PRESETS.find((p) => p.id === args.preset);
  const state = presetState(named ?? LEAP_PRESETS[0]!, thisYear);
  if (typeof args.value === "string") state.value = args.value;
  const year = integerText(args.year);
  if (year !== null) state.year = year;
  else if (typeof args.year === "string" && args.year.trim() !== "") {
    state.year = args.year;
  }
  if (typeof args.locale === "string" && args.locale.trim() !== "") {
    state.locale = args.locale.trim();
  }
  return state;
}

/** The preset the three controls match, or `custom`. */
export function matchPreset(
  state: LeapState,
  thisYear: number = readersYear(),
): string {
  const hit = LEAP_PRESETS.find((p) => {
    const want = presetState(p, thisYear);
    return (
      want.value === state.value &&
      want.year === state.year &&
      want.locale === state.locale
    );
  });
  return hit ? hit.id : CUSTOM_PRESET_ID;
}

/**
 * The permalink payload: `{ preset }` alone while the state matches one, else
 * the three strings. A string, not a number, because a year outside 1900 to
 * 2100 is dropped from a link when it is a number.
 */
export function permalinkOf(
  state: LeapState,
  thisYear: number = readersYear(),
): Record<string, unknown> {
  const preset = matchPreset(state, thisYear);
  if (preset !== CUSTOM_PRESET_ID) return { preset };
  return { value: state.value, year: state.year, locale: state.locale };
}

// ---------------------------------------------------------------------------
// Reading the input
// ---------------------------------------------------------------------------

export interface Reading {
  /** The canonical `--MM-DD`, or `""` when no reader accepted the input. */
  monthDay: string;
  /** The calls that ran, in order, as source with the library's results. */
  calls: string[];
}

/**
 * Reading the input is a dispatch, not a computation: `isValidMonthDay` and
 * `parseMonthDay`, then `parseMonthDayFromDate`, then
 * `parseMonthDayFromDateTime`, stopping at the first reader that does not
 * return `""`. Each call that ran is printed.
 */
export function readInput(lib: MonthDayLib, value: string): Reading {
  const calls: string[] = [];
  const valid = lib.isValidMonthDay(value);
  calls.push(`isValidMonthDay(${literal(value)}); // ${literal(valid)}`);
  const readers = [
    ["parseMonthDay", lib.parseMonthDay],
    ["parseMonthDayFromDate", lib.parseMonthDayFromDate],
    ["parseMonthDayFromDateTime", lib.parseMonthDayFromDateTime],
  ] as const;
  for (const [name, read] of readers) {
    const monthDay = read(value);
    calls.push(`${name}(${literal(value)}); // ${literal(monthDay)}`);
    if (monthDay !== "") return { monthDay, calls };
  }
  return { monthDay: "", calls };
}

// ---------------------------------------------------------------------------
// Verdicts and rows
// ---------------------------------------------------------------------------

export type Verdict = "kept" | "moved earlier" | "moved later" | "no date";

/** Every word a verdict slot can show, for its hidden sizer. */
export const VERDICT_WORDS: readonly Verdict[] = [
  "kept",
  "moved earlier",
  "moved later",
  "no date",
];

/** One cell: the library's date, or `null` for NO SIGNAL. */
export type Cell = string | null;

export interface YearRow {
  /** The year as printed, or `null` when the typed year is no integer. */
  year: number | null;
  /** `monthDayToDate(md, year)`. */
  gmt: Cell;
  verdict: Verdict;
  /** The year pasted onto the stored string, if the library reads it. */
  pasted: Cell;
  /** `isValidDate(pasted) ? pasted : …`: a caller's policy, never a gmt mode. */
  policy: Cell;
  policyVerdict: Verdict | null;
  calls: string[];
}

/**
 * Kept or moved, from the library alone: the month-day of the result against
 * the stored month-day. `compareMonthDays(back, stored)` is `-1` when the
 * result's day falls earlier in the year than the stored one.
 */
function verdictOf(
  lib: MonthDayLib,
  monthDay: string,
  result: string,
  calls: string[],
): Verdict {
  const back = lib.parseMonthDayFromDate(result);
  calls.push(`parseMonthDayFromDate(${literal(result)}); // ${literal(back)}`);
  const same = lib.areMonthDaysEqual(monthDay, back);
  calls.push(
    `areMonthDaysEqual(${literal(monthDay)}, ${literal(back)}); // ${literal(same)}`,
  );
  if (same) return "kept";
  const order = lib.compareMonthDays(back, monthDay);
  calls.push(
    `compareMonthDays(${literal(back)}, ${literal(monthDay)}); // ${literal(order)}`,
  );
  if (order === -1) return "moved earlier";
  if (order === 1) return "moved later";
  return "no date";
}

/**
 * The string a caller gets by pasting the year onto the stored month-day. A
 * year 0 to 9999 is padded to four digits; any other is written as it is, which
 * `isValidDate` refuses. That refusal is what the naive column shows.
 */
export function pastedString(monthDay: string, year: number): string {
  const year4 =
    year >= 0 && year <= 9999 ? String(year).padStart(4, "0") : String(year);
  return `${year4}-${monthDay.slice(2)}`;
}

/** One row of the table, with the calls it made. */
export function yearRow(
  lib: MonthDayLib,
  monthDay: string,
  year: number,
): YearRow {
  const calls: string[] = [];
  if (monthDay === "" || !Number.isInteger(year)) {
    const shown = Number.isInteger(year) ? String(year) : "NaN";
    if (monthDay !== "") {
      calls.push(
        `monthDayToDate(${literal(monthDay)}, ${shown}); // ${literal(lib.monthDayToDate(monthDay, year))}`,
      );
    }
    return {
      year: Number.isInteger(year) ? year : null,
      gmt: null,
      verdict: "no date",
      pasted: null,
      policy: null,
      policyVerdict: null,
      calls,
    };
  }
  const gmt = lib.monthDayToDate(monthDay, year);
  calls.push(
    `monthDayToDate(${literal(monthDay)}, ${year}); // ${literal(gmt)}`,
  );
  if (gmt === "") {
    return {
      year,
      gmt: null,
      verdict: "no date",
      pasted: null,
      policy: null,
      policyVerdict: null,
      calls,
    };
  }
  const verdict = verdictOf(lib, monthDay, gmt, calls);

  const pastedText = pastedString(monthDay, year);
  const pastedValid = lib.isValidDate(pastedText);
  calls.push(`isValidDate(${literal(pastedText)}); // ${literal(pastedValid)}`);

  // A caller's policy for a date the pasted year cannot hold: the day after
  // the library's answer. It only moves a date the library moved; a year
  // outside 0 to 9999 is refused for its width, not for its day.
  let policy: string;
  if (pastedValid) {
    policy = pastedText;
  } else if (verdict === "kept") {
    policy = gmt;
  } else {
    policy = lib.addDate(gmt, { days: 1 });
    calls.push(`addDate(${literal(gmt)}, { days: 1 }); // ${literal(policy)}`);
  }
  const policyVerdict =
    policy === "" ? "no date" : verdictOf(lib, monthDay, policy, calls);

  return {
    year,
    gmt,
    verdict,
    pasted: pastedValid ? pastedText : null,
    policy: policy === "" ? null : policy,
    policyVerdict,
    calls,
  };
}

export interface LeapModel {
  /** The stored month-day, or `null` for NO SIGNAL. */
  stored: string | null;
  /** The locale form, or `null` for NO SIGNAL. */
  reads: string | null;
  rows: YearRow[];
  /** The calls to print: the readers, the locale form and the chosen year's row. */
  calls: string[];
  reason: ReasonKey;
}

export type ReasonKey = "input" | "day" | "year" | "moved" | "kept";

export const REASONS: Record<ReasonKey, string> = {
  input: `${NO_SIGNAL_TEXT}: no reader accepted this. A month-day is --MM-DD or MM-DD, and a date or a date-time is read for its month and day. A day the month does not have, such as --02-30, is refused.`,
  day: `${NO_SIGNAL_TEXT}: the month has no such day, so no reader accepts it and nothing below is guessed.`,
  year: `${NO_SIGNAL_TEXT}: the year must be a whole number the library can place, from -271821 to 275760. The stored month-day above is still read.`,
  moved:
    "Where a year has no 29 February, the library gives the nearest earlier day, 28 February. The pasted year is refused, and a 1 March rule is a policy some contracts use: it is built here from library calls, and gmt has no such mode.",
  kept: "This day exists in every year, so the library keeps it. Only 29 February is ever moved, and the pasted year and the 1 March rule agree.",
};

/** Build everything the page draws for one state. */
export function buildModel(lib: MonthDayLib, state: LeapState): LeapModel {
  const reading = readInput(lib, state.value);
  const calls = [...reading.calls];
  const monthDay = reading.monthDay;

  let reads: string | null = null;
  if (monthDay !== "") {
    const text = lib.formatMonthDay(monthDay, state.locale, READS_OPTIONS);
    calls.push(
      `formatMonthDay(${literal(monthDay)}, ${literal(state.locale)}, ${literal(READS_OPTIONS)}); // ${literal(text)}`,
    );
    reads = text === "" ? null : text;
  }

  const start = yearNumber(state.year);
  const rows = Array.from({ length: ROW_COUNT }, (_, i) =>
    yearRow(lib, monthDay, Number.isInteger(start) ? start + i : Number.NaN),
  );
  calls.push(...rows[0]!.calls);

  // The library answers `""` for every refused input alike, so the page names
  // the missing day only for a value a preset's own data marks as such.
  const reason: ReasonKey =
    monthDay === ""
      ? LEAP_PRESETS.some((p) => p.noSuchDay && p.value === state.value)
        ? "day"
        : "input"
      : rows.some((r) => r.gmt === null)
        ? "year"
        : rows.some((r) => r.verdict !== "kept")
          ? "moved"
          : "kept";

  return {
    stored: monthDay === "" ? null : monthDay,
    reads,
    rows,
    calls,
    reason,
  };
}

/**
 * The longest month-day text the locale gives, for the "Reads as" plate's
 * reserved width: one library call per month, on the 28th, which every month
 * has.
 */
export function longestMonthText(lib: MonthDayLib, locale: string): string {
  let longest = "";
  for (let month = 1; month <= 12; month += 1) {
    const text = lib.formatMonthDay(
      `--${String(month).padStart(2, "0")}-28`,
      locale,
      READS_OPTIONS,
    );
    if (text.length > longest.length) longest = text;
  }
  return longest;
}

/**
 * The printed calls at their widest: the same lines the mount prints, built by
 * the same functions over a library whose every call takes its longest path.
 * It is the frame's hidden twin, so the frame holds one height whatever the
 * reader types or drags to.
 */
export function callsSizerText(): string {
  const input = "2024-02-29T08:30:00";
  const wide = {
    isValidMonthDay: () => false,
    isValidDate: () => false,
    parseMonthDay: () => "",
    // The date reader refuses the input, so all four reader calls print.
    parseMonthDayFromDate: (value: string) =>
      value === input ? "" : "--12-25",
    parseMonthDayFromDateTime: () => "--12-25",
    formatMonthDay: () => "December 25",
    compareMonthDays: () => 1,
    areMonthDaysEqual: () => false,
    monthDayToDate: () => WIDEST_DATE,
    addDate: () => WIDEST_DATE,
  } as unknown as MonthDayLib;
  return buildModel(wide, {
    value: input,
    year: "-271821",
    locale: "zh-TW",
  }).calls.join("\n");
}
