/**
 * Pure helpers for the Holiday Rule Builder (CORE-54).
 *
 * The reader edits an ordered list of holiday rules, a weekend, a zone and a
 * year. Every closed day, every moved date and every printed result comes from
 * the library (`attributeRules` in `holiday-widgets.ts` calls it); this module
 * holds the editor's state, the presets, the arguments a link or the chat can
 * seed, the printed call, and the hand-off to the Free Time Ledger.
 *
 * No DOM. Anything that reads the library takes a `HolidayLib` as its first
 * argument. No string here names a country, a statute or an operator: a preset
 * says what it computes, and carries its zone as a literal field.
 */
import type {
  CalendarSystem,
  HolidayRule,
  IsoWeekday,
  ObservancePolicy,
  WeekdayOrdinal,
} from "@northguild/gmt";
import { Temporal } from "@js-temporal/polyfill";
import {
  MAX_RULES,
  formatPolicyText,
  formatRuleLines,
  parsePolicyText,
  parseRuleLines,
} from "./holiday-codec";
import type { HolidayLib } from "./holiday-lib";
import {
  monthName,
  weekdayShort,
  withoutWalks,
  type RulePair,
} from "./holiday-widgets";
import { encodeWidgetPermalink } from "./widget-permalink";

export type RuleKind = HolidayRule["kind"];

export const RULE_KINDS: readonly RuleKind[] = [
  "fixed",
  "calendarFixed",
  "nthWeekday",
  "easterRelative",
  "dates",
];

export const KIND_LABELS: Record<RuleKind, string> = {
  fixed: "Fixed day",
  calendarFixed: "Fixed day in another calendar",
  nthWeekday: "Nth weekday of a month",
  easterRelative: "Days from Easter",
  dates: "Listed dates",
};

/** Kinds that carry an observance policy. */
export function hasPolicy(kind: RuleKind): boolean {
  return kind === "fixed" || kind === "calendarFixed";
}

export const CUSTOM_PRESET_ID = "custom";
const DEFAULT_WEEKEND: readonly number[] = [6, 7];
/** The year range a permalink can seed (`seedFromLocation`). */
export const YEAR_MIN = 1900;
export const YEAR_MAX = 2100;

// ---------------------------------------------------------------------------
// Row state: what the controls hold, as the text typed
// ---------------------------------------------------------------------------

/** One rule row's controls, as strings, which is what the DOM holds. */
export interface RowState {
  name: string;
  kind: RuleKind;
  /** `fixed` and `nthWeekday`. */
  month: string;
  /** `fixed` and `calendarFixed`. */
  day: string;
  calendar: string;
  monthCode: string;
  /** `nthWeekday`: ISO weekday `1`..`7`. */
  weekday: string;
  /** `nthWeekday`: `1`..`5`, `-1`..`-5` or `last`. */
  ordinal: string;
  /** `easterRelative`. */
  offset: string;
  julian: boolean;
  /** `dates`: ISO dates separated by commas. */
  dates: string;
  /** Policy text (`6<5 7>1`); `""` is no policy. */
  policy: string;
}

export interface BuilderState {
  rows: RowState[];
  /** ISO weekday numbers, ascending. */
  weekend: number[];
  zone: string;
  year: string;
}

/** A new row: no policy, and nothing filled in. */
export function blankRow(kind: RuleKind = "fixed"): RowState {
  return {
    name: "",
    kind,
    month: "",
    day: "",
    calendar: "",
    monthCode: "",
    weekday: "1",
    ordinal: "1",
    offset: "",
    julian: false,
    dates: "",
    policy: "",
  };
}

function numberOf(text: string): number {
  return text.trim() === "" ? Number.NaN : Number(text);
}

/**
 * The rule a row asks for. A blank policy is left out of the rule, never
 * filled in. Text that is not a number gives `NaN`, which the library judges
 * (`isValidHolidayRule` is `false`).
 */
export function ruleOfRow(row: RowState): HolidayRule {
  const observed = hasPolicy(row.kind) ? parsePolicyText(row.policy) : null;
  const withPolicy: { observed?: ObservancePolicy } =
    observed !== null && Object.keys(observed).length > 0 ? { observed } : {};
  switch (row.kind) {
    case "fixed":
      return {
        name: row.name,
        kind: "fixed",
        month: numberOf(row.month),
        day: numberOf(row.day),
        ...withPolicy,
      };
    case "calendarFixed":
      return {
        name: row.name,
        kind: "calendarFixed",
        calendar: row.calendar as CalendarSystem,
        monthCode: row.monthCode,
        day: numberOf(row.day),
        ...withPolicy,
      };
    case "nthWeekday":
      return {
        name: row.name,
        kind: "nthWeekday",
        month: numberOf(row.month),
        weekday: numberOf(row.weekday) as IsoWeekday,
        n: (row.ordinal === "last"
          ? "last"
          : numberOf(row.ordinal)) as WeekdayOrdinal,
      };
    case "easterRelative":
      return {
        name: row.name,
        kind: "easterRelative",
        offsetDays: numberOf(row.offset),
        ...(row.julian ? { computus: "julian" as const } : {}),
      };
    case "dates":
      return {
        name: row.name,
        kind: "dates",
        dates: row.dates
          .split(/[\s,]+/)
          .map((date) => date.trim())
          .filter((date) => date !== ""),
      };
  }
}

/** The row for a rule; `null` for a value that is not one of the five kinds. */
export function rowOfRule(rule: HolidayRule): RowState | null {
  if (typeof rule !== "object" || rule === null) return null;
  const base = blankRow();
  const name = typeof rule.name === "string" ? rule.name : "";
  // A blank field is `NaN` in the rule (`ruleOfRow`), and blank again here.
  const text = (v: unknown) =>
    v === undefined || v === null || Number.isNaN(v) ? "" : String(v);
  const policy = (observed: ObservancePolicy | undefined) =>
    observed === undefined ? "" : formatPolicyText(observed);
  switch (rule.kind) {
    case "fixed":
      return {
        ...base,
        name,
        kind: "fixed",
        month: text(rule.month),
        day: text(rule.day),
        policy: policy(rule.observed),
      };
    case "calendarFixed":
      return {
        ...base,
        name,
        kind: "calendarFixed",
        calendar: text(rule.calendar),
        monthCode: text(rule.monthCode),
        day: text(rule.day),
        policy: policy(rule.observed),
      };
    case "nthWeekday":
      return {
        ...base,
        name,
        kind: "nthWeekday",
        month: text(rule.month),
        weekday: text(rule.weekday),
        ordinal: text(rule.n),
      };
    case "easterRelative":
      return {
        ...base,
        name,
        kind: "easterRelative",
        offset: text(rule.offsetDays),
        julian: rule.computus === "julian",
      };
    case "dates":
      return {
        ...base,
        name,
        kind: "dates",
        dates: Array.isArray(rule.dates)
          ? rule.dates.map(String).join(", ")
          : "",
      };
    default:
      return null;
  }
}

export const rulesOf = (state: BuilderState): HolidayRule[] =>
  state.rows.map(ruleOfRow);

// ---------------------------------------------------------------------------
// Presets: examples with literal fields, never a holiday table
// ---------------------------------------------------------------------------

interface BuilderPreset {
  id: string;
  label: string;
  description: string;
  year: number;
  weekend: readonly number[];
  zone: string;
  rules: readonly HolidayRule[];
}

const NEXT_WORKING: ObservancePolicy = {
  6: "nextWorkingDay",
  7: "nextWorkingDay",
};
const FRIDAY_MONDAY: ObservancePolicy = {
  6: { previous: 5 },
  7: { next: 1 },
};
const FRI_SAT: ObservancePolicy = { 5: { previous: 4 }, 6: { next: 7 } };

export const BUILDER_PRESETS: readonly BuilderPreset[] = [
  {
    id: "chain",
    label: "Two adjacent holidays, next working day",
    description:
      "Two holidays on 25 and 26 December 2021, a Saturday and a Sunday, each moved to the next working day. The first walks to Monday and the second to Tuesday, because each walk passes the days the rules above it closed.",
    year: 2021,
    weekend: [6, 7],
    zone: "Europe/London",
    rules: [
      {
        name: "25 Dec",
        kind: "fixed",
        month: 12,
        day: 25,
        observed: NEXT_WORKING,
      },
      {
        name: "26 Dec",
        kind: "fixed",
        month: 12,
        day: 26,
        observed: NEXT_WORKING,
      },
    ],
  },
  {
    id: "closing",
    label: "Six fixed and Easter-relative closing days",
    description:
      "Two fixed days at the year's ends, one in May, and two days around Easter, with no observance shift. The Easter days come from the Easter rule, not from a date.",
    year: 2026,
    weekend: [6, 7],
    zone: "Europe/Berlin",
    rules: [
      { name: "1 Jan", kind: "fixed", month: 1, day: 1 },
      {
        name: "Easter −2 (Good Friday)",
        kind: "easterRelative",
        offsetDays: -2,
      },
      {
        name: "Easter +1 (Easter Monday)",
        kind: "easterRelative",
        offsetDays: 1,
      },
      { name: "1 May", kind: "fixed", month: 5, day: 1 },
      { name: "25 Dec", kind: "fixed", month: 12, day: 25 },
      { name: "26 Dec", kind: "fixed", month: 12, day: 26 },
    ],
  },
  {
    id: "friday-monday",
    label: "Weekend holidays to Friday and Monday",
    description:
      "A Saturday holiday moves to the Friday before, a Sunday holiday to the Monday after. 1 January 2028 is a Saturday, so 2027 closes on 31 December.",
    year: 2027,
    weekend: [6, 7],
    zone: "Australia/Sydney",
    rules: [
      {
        name: "1 Jan",
        kind: "fixed",
        month: 1,
        day: 1,
        observed: FRIDAY_MONDAY,
      },
      {
        name: "25 Dec",
        kind: "fixed",
        month: 12,
        day: 25,
        observed: FRIDAY_MONDAY,
      },
      {
        name: "26 Dec",
        kind: "fixed",
        month: 12,
        day: 26,
        observed: FRIDAY_MONDAY,
      },
    ],
  },
  {
    id: "fri-sat",
    label: "Friday–Saturday weekend",
    description:
      "A weekend of Friday and Saturday. A Friday holiday moves back to Thursday and a Saturday holiday on to Sunday. The third rule is a day in another calendar.",
    year: 2026,
    weekend: [5, 6],
    zone: "UTC",
    rules: [
      {
        name: "1 Jan",
        kind: "fixed",
        month: 1,
        day: 1,
        observed: FRI_SAT,
      },
      {
        name: "1 May",
        kind: "fixed",
        month: 5,
        day: 1,
        observed: FRI_SAT,
      },
      {
        name: "islamic-umalqura M10 1",
        kind: "calendarFixed",
        calendar: "islamic-umalqura",
        monthCode: "M10",
        day: 1,
      },
    ],
  },
  {
    id: "midweek",
    label: "Mid-week holidays moved to Monday, original kept closed",
    description:
      "17 June 2026 is a Wednesday. The second rule moves it to the Monday before; the first, listed with no policy, keeps the original day closed as well.",
    year: 2026,
    weekend: [6, 7],
    zone: "America/Sao_Paulo",
    rules: [
      { name: "17 Jun", kind: "fixed", month: 6, day: 17 },
      {
        name: "17 Jun moved",
        kind: "fixed",
        month: 6,
        day: 17,
        observed: {
          2: { previous: 1 },
          3: { previous: 1 },
          4: { next: 1 },
          5: { next: 1 },
        },
      },
    ],
  },
  {
    id: "lunisolar",
    label: "Dates in other calendars",
    description:
      "Three days given in other calendars: Islamic (Umm al-Qura), Hebrew and Persian. The library works out where each falls in the Gregorian year.",
    year: 2026,
    weekend: [6, 7],
    zone: "Asia/Kolkata",
    rules: [
      {
        name: "islamic-umalqura M10 1",
        kind: "calendarFixed",
        calendar: "islamic-umalqura",
        monthCode: "M10",
        day: 1,
      },
      {
        name: "hebrew M07 15",
        kind: "calendarFixed",
        calendar: "hebrew",
        monthCode: "M07",
        day: 15,
        observed: { 4: { next: 1 } },
      },
      {
        name: "persian M01 1",
        kind: "calendarFixed",
        calendar: "persian",
        monthCode: "M01",
        day: 1,
      },
    ],
  },
];

export function presetState(preset: BuilderPreset): BuilderState {
  return {
    rows: preset.rules
      .map(rowOfRule)
      .filter((row): row is RowState => row !== null),
    weekend: [...preset.weekend],
    zone: preset.zone,
    year: String(preset.year),
  };
}

// ---------------------------------------------------------------------------
// Arguments: the chat tool sends typed values, a permalink only strings
// ---------------------------------------------------------------------------

export interface HolidayRuleBuilderArgs {
  /** A preset id, from a permalink. */
  preset?: string;
  /** `HolidayRule` objects (the chat), or the codec's lines (a permalink). */
  rules?: unknown;
  weekend?: number[] | string;
  zone?: string;
  timeZone?: string;
  year?: number | string;
}

export function normaliseWeekend(days: readonly number[]): number[] {
  return [...new Set(days.filter((d) => Number.isInteger(d)))]
    .filter((d) => d >= 1 && d <= 7)
    .sort((a, b) => a - b);
}

/** Whether the args seed anything. */
export function isSeeded(args: HolidayRuleBuilderArgs): boolean {
  return Object.values(args).some((v) => v !== undefined && v !== "");
}

function rowsOfArg(rules: unknown): RowState[] | null {
  if (typeof rules === "string") {
    return parseRuleLines(rules)
      .map((rule) => (rule === null ? null : rowOfRule(rule)))
      .filter((row): row is RowState => row !== null);
  }
  if (Array.isArray(rules)) {
    return rules
      .slice(0, MAX_RULES)
      .map((rule) => rowOfRule(rule as HolidayRule))
      .filter((row): row is RowState => row !== null);
  }
  return null;
}

/**
 * Seed arguments as controls. Typed values (the chat) and their text forms (a
 * permalink) both land here; anything unusable falls back to the first
 * preset's value for that control, never to a guess about the reader's rules.
 * A missing weekend means `[6, 7]`; an empty one means no weekend.
 */
export function readArgs(args: HolidayRuleBuilderArgs): BuilderState {
  const base = BUILDER_PRESETS[0]!;
  const named = BUILDER_PRESETS.find((p) => p.id === args.preset);
  const fromPreset = presetState(named ?? base);
  const rows = rowsOfArg(args.rules);
  const weekendItems =
    typeof args.weekend === "string"
      ? args.weekend
          .split(/[\s,]+/)
          .filter((s) => s !== "")
          .map(Number)
      : Array.isArray(args.weekend)
        ? args.weekend.map(Number)
        : null;
  const year = Number(args.year);
  const zone = args.zone ?? args.timeZone;
  const seededRules = rows !== null;
  return {
    rows: seededRules ? rows : fromPreset.rows,
    weekend:
      weekendItems === null
        ? seededRules
          ? [...DEFAULT_WEEKEND]
          : fromPreset.weekend
        : normaliseWeekend(weekendItems),
    zone: typeof zone === "string" && zone !== "" ? zone : fromPreset.zone,
    year:
      Number.isInteger(year) && year >= YEAR_MIN && year <= YEAR_MAX
        ? String(year)
        : fromPreset.year,
  };
}

/** The preset the controls match, or `custom`. */
export function matchPreset(state: BuilderState): string {
  const lines = formatRuleLines(rulesOf(state));
  const hit = BUILDER_PRESETS.find(
    (p) =>
      String(p.year) === state.year &&
      p.zone === state.zone &&
      p.weekend.join(",") === state.weekend.join(",") &&
      formatRuleLines(p.rules) === lines,
  );
  return hit ? hit.id : CUSTOM_PRESET_ID;
}

/** The permalink payload: `preset` first when the state matches one. */
export function permalinkOf(state: BuilderState): Record<string, unknown> {
  const preset = matchPreset(state);
  return {
    ...(preset === CUSTOM_PRESET_ID ? {} : { preset }),
    rules: formatRuleLines(rulesOf(state)),
    weekend: state.weekend.join(","),
    zone: state.zone,
    year: state.year,
  };
}

/** The year as a number, or `null` outside the range a link can carry. */
export function yearOf(state: BuilderState): number | null {
  const year = Number(state.year);
  return state.year.trim() !== "" &&
    Number.isInteger(year) &&
    year >= YEAR_MIN &&
    year <= YEAR_MAX
    ? year
    : null;
}

// ---------------------------------------------------------------------------
// The printed call
// ---------------------------------------------------------------------------

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/** A value as source, one line: keys unquoted, as the guide writes it. */
export function literal(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (Array.isArray(value)) return `[${value.map(literal).join(", ")}]`;
  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([, v]) => v !== undefined,
  );
  if (entries.length === 0) return "{}";
  return `{ ${entries
    .map(
      ([k, v]) =>
        `${IDENTIFIER.test(k) || /^\d+$/.test(k) ? k : JSON.stringify(k)}: ${literal(v)}`,
    )
    .join(", ")} }`;
}

/** What `buildBusinessCalendar` is called with. */
function callSpec(state: BuilderState, year: number) {
  return {
    timeZone: state.zone,
    weekend: state.weekend,
    rules: rulesOf(state),
    years: { from: year, to: year },
  };
}

/** The call's argument as source, one rule to a line. */
export function callArgsText(state: BuilderState, year: number): string {
  const spec = callSpec(state, year);
  const rules =
    spec.rules.length === 0
      ? "[]"
      : `[\n${spec.rules.map((r) => `    ${literal(r)},`).join("\n")}\n  ]`;
  return (
    `{\n  timeZone: ${literal(spec.timeZone)},\n` +
    `  weekend: ${literal(spec.weekend)},\n` +
    `  rules: ${rules},\n` +
    `  years: ${literal(spec.years)},\n}`
  );
}

/** The call as the reader would write it. */
export function callSource(state: BuilderState, year: number): string {
  return `buildBusinessCalendar(${callArgsText(state, year)})`;
}

// ---------------------------------------------------------------------------
// Row results, in words
// ---------------------------------------------------------------------------

export const NO_SIGNAL_TEXT = "⟨ NO SIGNAL — invalid input ⟩";

/** Why `isValidHolidayRule` says no, by kind. It names what to check; the
 *  library holds the rule. */
export const INVALID_REASON: Record<RuleKind, string> = {
  fixed: "needs a month 1 to 12 and a day that exists in it",
  calendarFixed:
    "needs a calendar id, a month code such as M01 and a day that exists",
  nthWeekday: "needs a month 1 to 12, a weekday and an ordinal",
  easterRelative: "needs a whole number of days from Easter",
  dates: "needs ISO dates, such as 2026-01-01",
};

/** "Mon 27 Dec", with the year only when it is not the one on screen. */
export function shortDate(date: string, year: number): string {
  try {
    const d = Temporal.PlainDate.from(date);
    return (
      `${weekdayShort(d.dayOfWeek)} ${d.day} ${monthName(d.month).slice(0, 3)}` +
      (d.year === year ? "" : ` ${d.year}`)
    );
  } catch {
    return date;
  }
}

export type RowResult =
  | { state: "signal"; text: string }
  | { state: "empty"; text: string }
  | { state: "sentinel"; text: string };

/**
 * A row's held line. A rule the library calls invalid is NO SIGNAL with the
 * reason; a valid rule with no date in the year is a plain, correct answer and
 * not a sentinel; a date the library could not shift is NO SIGNAL.
 */
export function rowResult(
  rule: HolidayRule,
  valid: boolean,
  pairs: readonly RulePair[],
  year: number,
): RowResult {
  if (!valid) {
    return {
      state: "sentinel",
      text: `${NO_SIGNAL_TEXT}: ${INVALID_REASON[rule.kind]}.`,
    };
  }
  if (pairs.length === 0) {
    return { state: "empty", text: `No date in ${year}.` };
  }
  if (pairs.some((p) => p.observed === "")) {
    return {
      state: "sentinel",
      text: `${NO_SIGNAL_TEXT}: the shift cannot place ${shortDate(pairs.find((p) => p.observed === "")!.unshifted, year)}.`,
    };
  }
  const parts = pairs.map((p) =>
    p.observed === p.unshifted
      ? `Closes ${shortDate(p.observed, year)}`
      : `Closes ${shortDate(p.observed, year)}, moved from ${shortDate(p.unshifted, year)}`,
  );
  return { state: "signal", text: parts.join("; ") };
}

/** Easter offsets are labelled with the offset and the feast. */
const FEASTS: Readonly<Record<number, string>> = {
  [-2]: "Good Friday",
  0: "Easter Sunday",
  1: "Easter Monday",
  39: "Ascension Day",
  49: "Pentecost",
  50: "Whit Monday",
};

export function easterLabel(offset: string): string {
  const n = Number(offset);
  if (offset.trim() === "" || !Number.isInteger(n)) return "";
  const sign = n === 0 ? "" : n < 0 ? ` −${-n}` : ` +${n}`;
  const feast = FEASTS[n];
  return `Easter${sign}${feast === undefined ? "" : ` (${feast})`}`;
}

/** The folded per-rule calls: `holidayDates` and each `observedDate`. */
export function ruleCallLines(
  rules: readonly HolidayRule[],
  pairsByRule: readonly (readonly RulePair[])[],
  year: number,
): string[] {
  return rules.map((rule, i) => {
    const pairs = pairsByRule[i] ?? [];
    const plain =
      "observed" in rule
        ? (({ observed: _o, ...rest }) => rest)(
            rule as HolidayRule & { observed?: unknown },
          )
        : rule;
    const dates = pairs
      .map((p) => p.unshifted)
      .filter((d) => Number.parseInt(d, 10) === year);
    const lines = [
      `${i + 1}. holidayDates(${literal(plain)}, ${year}) // ${literal(dates)}`,
    ];
    if ("observed" in rule && rule.observed !== undefined) {
      // A shift that walks reads a calendar; every other shift reads none.
      for (const p of pairs) {
        lines.push(
          p.walks
            ? `   observedDate(${literal(p.unshifted)}, ${literal(rule.observed)}, calendar) // ${literal(p.observed)}`
            : `   observedDate(${literal(p.unshifted)}, ${literal(withoutWalks(rule.observed))}) // ${literal(p.observed)}`,
        );
      }
      if (pairs.some((p) => p.walks)) {
        lines.push(
          i === 0
            ? `   // calendar: the weekend and every holiday that does not walk`
            : `   // calendar: the weekend, every holiday that does not walk, and the walks of rules 1 to ${i}`,
        );
      }
    }
    return lines.join("\n");
  });
}

/**
 * The most lines, and the widest line, the rule-call frame prints in any year the year field
 * accepts, so the frame holds that height and overflows the same way while the year steps. It is
 * exact because it is the maximum of the real output: `linesIn(year)` prints the calls for that
 * year, and this takes the largest over every year from `YEAR_MIN` to `YEAR_MAX`. The width is
 * in characters, which is exact in the monospace face the frame uses.
 *
 * Printing 201 years of up to twelve rules takes tens of milliseconds, so it is a job the mount
 * runs in slices (`step`) between the reader's keystrokes; `ruleCallExtent` runs it whole.
 */
export function ruleCallExtentJob(
  linesIn: (year: number) => readonly string[],
  firstYear: number = YEAR_MIN,
): {
  /** Prints years until `budgetMs` has passed; `true` once every year is done. */
  step(budgetMs: number): boolean;
  /** The largest so far, which is the answer once `step` says it is done. */
  extent(): { lines: number; widest: string };
} {
  // The year in view first, so the likeliest answer is in before the rest.
  const all = Array.from(
    { length: YEAR_MAX - YEAR_MIN + 1 },
    (_, i) => YEAR_MIN + i,
  );
  const years = all.includes(firstYear)
    ? [firstYear, ...all.filter((y) => y !== firstYear)]
    : all;
  let next = 0;
  let lines = 1;
  let widest = "";
  return {
    step(budgetMs) {
      const until = performance.now() + budgetMs;
      while (next < years.length && performance.now() < until) {
        const printed = linesIn(years[next++]!).join("\n").split("\n");
        lines = Math.max(lines, printed.length);
        for (const line of printed) {
          if (line.length > widest.length) widest = line;
        }
      }
      return next >= years.length;
    },
    extent: () => ({ lines, widest }),
  };
}

/** `ruleCallExtentJob` run to the end. */
export function ruleCallExtent(linesIn: (year: number) => readonly string[]): {
  lines: number;
  widest: string;
} {
  const job = ruleCallExtentJob(linesIn);
  job.step(Number.POSITIVE_INFINITY);
  return job.extent();
}

// ---------------------------------------------------------------------------
// The year's plates
// ---------------------------------------------------------------------------

/** Pairs whose observed date differs from the unshifted one. */
export function movedCount(
  lib: HolidayLib,
  pairsByRule: readonly (readonly RulePair[])[],
): number {
  let count = 0;
  for (const pairs of pairsByRule) {
    for (const p of pairs) {
      if (p.observed !== "" && !lib.areDatesEqual(p.observed, p.unshifted)) {
        count++;
      }
    }
  }
  return count;
}

export function weekendNames(weekend: readonly number[]): string {
  const names = [...weekend]
    .sort((a, b) => a - b)
    .map((d) => weekdayShort(d))
    .filter((n) => n !== "");
  return names.length === 0 ? "none" : names.join(", ");
}

// ---------------------------------------------------------------------------
// Hand-off to the Free Time Ledger
// ---------------------------------------------------------------------------

/** The cap on `holidays` in a link (`LONG_STRING_KEYS`). */
export const HOLIDAYS_LINK_CAP = 1000;

type Handoff = { href: string } | { href: null; hint: string };

export const HANDOFF_NO_CALENDAR =
  "There is no calendar to send: fix the rows marked NO SIGNAL first.";
export const HANDOFF_TOO_LONG = "The calendar is too long to send in a link.";
export const HANDOFF_NO_YEAR =
  "There is no calendar to send: the year is not valid.";

/**
 * The link to the Free Time Ledger: the weekend, the closed dates, the zone and
 * `basis: "working"`, the only basis on which the Ledger reads a calendar. The
 * clock, the free days and the charge basis are not sent; the Ledger keeps its
 * own.
 */
export function ledgerHandoff(
  full: { holidays: readonly string[] } | null,
  zone: string,
  weekend: readonly number[],
): Handoff {
  if (full === null) return { href: null, hint: HANDOFF_NO_CALENDAR };
  const holidays = full.holidays.join(",");
  if (holidays.length > HOLIDAYS_LINK_CAP) {
    return { href: null, hint: HANDOFF_TOO_LONG };
  }
  return {
    href: encodeWidgetPermalink("freetime", {
      weekend: weekend.join(","),
      holidays,
      zone,
      basis: "working",
    }),
  };
}

export const BUILDER_LINKS = [
  { role: "link-ledger", text: "Count free time on this calendar" },
] as const;
