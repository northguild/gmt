/**
 * Pure helpers for the Observance Comparator (CORE-54).
 *
 * The reader picks one to three month-day holidays, a span of years, a weekend
 * and two to four policy columns. One cell is one holiday in one year under one
 * policy. Every observed date comes from the library: `attributeRules` in
 * `holiday-widgets.ts` calls `holidayDates` and `observedDate` in the library's
 * two passes, exactly as the Builder does. This module holds the state,
 * the presets, the seed arguments, the model the matrix is drawn from, the
 * printed call and the two hand-offs between the Builder and the Comparator.
 *
 * No DOM. Anything that reads the library takes a `HolidayLib` as its first
 * argument. No string here names a country, a statute or an operator: a policy
 * is labelled by what it does, and a preset says what it computes.
 *
 * Observance has no default. A column with no policy is a real column, "Not
 * moved"; a blank policy is left out of the rule, never filled in.
 */
import type { HolidayRule, ObservancePolicy } from "@northguild/gmt";
import { Temporal } from "@js-temporal/polyfill";
import {
  formatPolicyText,
  formatRuleLines,
  parsePolicyText,
} from "./holiday-codec";
import type { HolidayLib } from "./holiday-lib";
import {
  YEAR_MAX,
  YEAR_MIN,
  literal,
  normaliseWeekend,
  shortDate,
  type RowState,
} from "./holiday-rule-builder";
import {
  attributeRules,
  marksFromAttribution,
  monthName,
  policySummary,
  weekdayShort,
  withoutWalks,
  type Attribution,
  type CellMark,
} from "./holiday-widgets";
import { encodeWidgetPermalink } from "./widget-permalink";

export const MAX_HOLIDAYS = 3;
export const MIN_COLUMNS = 2;
export const MAX_COLUMNS = 4;
/** The most years one matrix shows. A longer span is cut here, with a note. */
export const MAX_YEARS = 12;
/** The zone every Comparator calendar uses: it has none of its own, and the
 *  Builder needs one on the hand-off. */
export const COMPARATOR_ZONE = "UTC";
/** The container width under which a custom column's policy editor folds, in
 *  px (30rem), as the Builder's does. */
export const FOLD_WIDTH = 480;
/** A column that is not a preset: `custom:` and then the policy text. */
export const CUSTOM_PREFIX = "custom:";
/** The select value for "a policy the reader writes". */
export const CUSTOM_OPTION = "custom";

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

export interface PolicyPreset {
  id: string;
  label: string;
  /** Policy text (`6<5 7>1`); `""` moves nothing. */
  text: string;
}

/** Labelled by what each does. None is the default of anything. */
export const POLICY_PRESETS: readonly PolicyPreset[] = [
  { id: "none", label: "Not moved", text: "" },
  {
    id: "fri-mon",
    label: "Saturday to Friday, Sunday to Monday",
    text: "6<5 7>1",
  },
  { id: "mon-mon", label: "Saturday and Sunday to Monday", text: "6>1 7>1" },
  { id: "sun-only", label: "Sunday to Monday only", text: "7>1" },
  { id: "next-working", label: "Next working day", text: "6w 7w" },
  {
    id: "fri-sat-weekend",
    label: "Friday to Thursday, Saturday to Sunday",
    text: "5<4 6>7",
  },
];

export interface ComparatorPreset {
  id: string;
  label: string;
  description: string;
  holidays: readonly { month: number; day: number }[];
  from: number;
  to: number;
  weekend: readonly number[];
  /** Policy preset ids. */
  columns: readonly string[];
}

/** The year span is a preset's literal data. It is not an ageing constant:
 *  no code reads it as "now". */
export const COMPARATOR_PRESETS: readonly ComparatorPreset[] = [
  {
    id: "adjacent",
    label: "Two adjacent holidays",
    description:
      "Two holidays on consecutive days. When both land on a weekend, a next-working-day policy pushes the second past the first, and the other policies do not.",
    holidays: [
      { month: 12, day: 25 },
      { month: 12, day: 26 },
    ],
    from: 2020,
    to: 2031,
    weekend: [6, 7],
    columns: ["none", "fri-mon", "mon-mon", "next-working"],
  },
  {
    id: "new-year",
    label: "A holiday that can move into the year before",
    description:
      "One holiday on 1 January. A policy that moves Saturday back to Friday observes it in the year before, so the row for one year shows a date in the year earlier.",
    holidays: [{ month: 1, day: 1 }],
    from: 2020,
    to: 2031,
    weekend: [6, 7],
    columns: ["none", "fri-mon", "sun-only", "next-working"],
  },
  {
    id: "fri-sat",
    label: "Friday–Saturday weekend",
    description:
      "Two holidays in a week that closes Friday and Saturday. The policies move a holiday off those days, toward the days around them.",
    holidays: [
      { month: 1, day: 1 },
      { month: 5, day: 1 },
    ],
    from: 2020,
    to: 2031,
    weekend: [5, 6],
    columns: ["none", "fri-sat-weekend", "next-working"],
  },
];

// ---------------------------------------------------------------------------
// State: what the controls hold, as the text typed
// ---------------------------------------------------------------------------

export interface HolidayState {
  month: string;
  day: string;
}

export interface ComparatorState {
  holidays: HolidayState[];
  from: string;
  to: string;
  /** ISO weekday numbers, ascending. */
  weekend: number[];
  /** A policy preset id, or `custom:` and the policy text. */
  columns: string[];
  /** The selected row's year; `""` picks the first row that disagrees. */
  year: string;
  /** The selected column; `-1` picks the first column that moves anything. */
  column: number;
  /** The columns, by index, that `readArgs` added from the preset because the
   *  args gave fewer than `MIN_COLUMNS`. The widget names them until the
   *  reader changes one. */
  presetColumns: number[];
}

export function presetState(preset: ComparatorPreset): ComparatorState {
  return {
    holidays: preset.holidays.map((h) => ({
      month: String(h.month),
      day: String(h.day),
    })),
    from: String(preset.from),
    to: String(preset.to),
    weekend: [...preset.weekend],
    columns: [...preset.columns],
    year: "",
    column: -1,
    presetColumns: [],
  };
}

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

export interface ColumnModel {
  /** The state's id: a preset id or `custom:…`. */
  id: string;
  label: string;
  /** The policy text, `""` for none. */
  text: string;
  /** The policy to call with, `null` for none or for text that cannot be read. */
  policy: ObservancePolicy | null;
  custom: boolean;
  valid: boolean;
  /** Why the column is NO SIGNAL; `""` when it is not. */
  reason: string;
}

/** The text of a column id. */
export function columnText(id: string): string {
  if (id.startsWith(CUSTOM_PREFIX)) return id.slice(CUSTOM_PREFIX.length);
  return POLICY_PRESETS.find((p) => p.id === id)?.text ?? "";
}

/** The column id for a policy text: the preset with that policy, or custom. */
export function columnIdOfText(text: string): string {
  const parsed = parsePolicyText(text);
  if (parsed === null) return `${CUSTOM_PREFIX}${text}`;
  const normal = formatPolicyText(parsed);
  const hit = POLICY_PRESETS.find((p) => {
    const own = parsePolicyText(p.text);
    return own !== null && formatPolicyText(own) === normal;
  });
  return hit ? hit.id : `${CUSTOM_PREFIX}${normal}`;
}

const fixedRule = (
  name: string,
  month: number,
  day: number,
  policy: ObservancePolicy | null,
): HolidayRule => ({
  name,
  kind: "fixed",
  month,
  day,
  ...(policy !== null && Object.keys(policy).length > 0
    ? { observed: policy }
    : {}),
});

/** "25 Dec": the name a holiday gets, with no comma or semicolon in it. */
export function holidayName(month: number, day: number): string {
  return `${day} ${monthName(month).slice(0, 3)}`;
}

const REASON_UNREADABLE =
  "the policy text cannot be read; use tokens like 6<5, 7>1 or 6w";
const REASON_REJECTED =
  "the library rejects this policy; check that no weekday moves to itself";

/** One column as the matrix reads it. Validity is the library's answer for a
 *  rule that carries the policy. */
export function columnOf(lib: HolidayLib, id: string): ColumnModel {
  const custom = id.startsWith(CUSTOM_PREFIX);
  const text = columnText(id);
  const policy = parsePolicyText(text);
  if (policy === null) {
    return {
      id,
      label: "Custom, unreadable",
      text,
      policy: null,
      custom,
      valid: false,
      reason: REASON_UNREADABLE,
    };
  }
  const preset = POLICY_PRESETS.find((p) => p.id === id);
  const label = custom
    ? `Custom: ${policySummary(policy)}`
    : (preset?.label ?? id);
  const valid = lib.isValidHolidayRule(fixedRule("probe", 1, 1, policy));
  return {
    id,
    label,
    text,
    policy,
    custom,
    valid,
    reason: valid ? "" : REASON_REJECTED,
  };
}

// ---------------------------------------------------------------------------
// Arguments: the chat tool sends typed values, a permalink only strings
// ---------------------------------------------------------------------------

export interface ObservanceComparatorArgs {
  /** A preset id, from a permalink. */
  preset?: string;
  /** `"12-25"`. */
  holiday1?: string;
  holiday2?: string;
  holiday3?: string;
  from?: number | string;
  to?: number | string;
  weekend?: number[] | string;
  /** A policy preset id, or `custom:` and the policy text. */
  column1?: string;
  column2?: string;
  column3?: string;
  column4?: string;
  /** The selected row. */
  year?: number | string;
  // The chat's typed forms.
  holidays?: { month: number; day: number }[];
  years?: { from: number; to: number };
  policies?: ObservancePolicy[];
}

/** Whether the args seed anything. */
export function isSeeded(args: ObservanceComparatorArgs): boolean {
  return Object.values(args).some((v) => v !== undefined && v !== "");
}

// Either side may be blank: a half-filled holiday keeps its row in a link.
const MONTH_DAY = /^(\d*)-(\d*)$/;

function holidaysOfArgs(args: ObservanceComparatorArgs): HolidayState[] | null {
  if (Array.isArray(args.holidays)) {
    return args.holidays
      .slice(0, MAX_HOLIDAYS)
      .filter((h) => h !== null && typeof h === "object")
      .map((h) => ({ month: String(h.month), day: String(h.day) }));
  }
  const found: HolidayState[] = [];
  for (const text of [args.holiday1, args.holiday2, args.holiday3]) {
    const match = typeof text === "string" ? MONTH_DAY.exec(text) : null;
    if (match) found.push({ month: match[1]!, day: match[2]! });
  }
  return found.length > 0 ? found : null;
}

function columnsOfArgs(args: ObservanceComparatorArgs): string[] | null {
  if (Array.isArray(args.policies)) {
    return args.policies
      .slice(0, MAX_COLUMNS)
      .filter((p) => p !== null && typeof p === "object")
      .map((p) => columnIdOfText(formatPolicyText(p)));
  }
  const found = [args.column1, args.column2, args.column3, args.column4].filter(
    (c): c is string => typeof c === "string" && c !== "",
  );
  return found.length > 0 ? found : null;
}

function wholeNumber(value: number | string | undefined): string | null {
  if (value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) ? String(n) : null;
}

/**
 * Seed arguments as controls. Typed values (the chat) and their text forms (a
 * permalink) both land here; anything missing falls back to the named preset's
 * (or the first preset's) value for that control, never to a guess about the
 * reader's policy. A single column is topped up from the preset's columns so
 * the matrix has the two it needs, and `presetColumns` says which were added.
 */
export function readArgs(args: ObservanceComparatorArgs): ComparatorState {
  const base = COMPARATOR_PRESETS[0]!;
  const named = COMPARATOR_PRESETS.find((p) => p.id === args.preset);
  const fallback = presetState(named ?? base);
  const holidays = holidaysOfArgs(args);
  let columns = columnsOfArgs(args);
  const presetColumns: number[] = [];
  if (columns !== null && columns.length < MIN_COLUMNS) {
    for (const id of fallback.columns) {
      if (columns.length >= MIN_COLUMNS) break;
      if (columns.includes(id)) continue;
      presetColumns.push(columns.length);
      columns.push(id);
    }
  }
  columns = columns ?? fallback.columns;
  const from = wholeNumber(args.from ?? args.years?.from);
  const to = wholeNumber(args.to ?? args.years?.to);
  const weekendItems =
    typeof args.weekend === "string"
      ? args.weekend
          .split(/[\s,]+/)
          .filter((s) => s !== "")
          .map(Number)
      : Array.isArray(args.weekend)
        ? args.weekend.map(Number)
        : null;
  return {
    holidays: holidays ?? fallback.holidays,
    from: from ?? fallback.from,
    to: to ?? fallback.to,
    weekend:
      weekendItems === null ? fallback.weekend : normaliseWeekend(weekendItems),
    columns,
    year: wholeNumber(args.year) ?? "",
    column: -1,
    presetColumns,
  };
}

/** Which columns came from the preset, and why, for the widget to say: `""`
 *  when the reader gave every column. */
export function presetColumnsNote(state: ComparatorState): string {
  const added = state.presetColumns.map((i) => i + 1);
  if (added.length === 0) return "";
  const which =
    added.length === 1
      ? `Column ${added[0]} was`
      : `Columns ${added.join(" and ")} were`;
  return `${which} added from the preset: a comparison needs at least ${MIN_COLUMNS} policies.`;
}

/** The preset the controls match, or `""` for none. */
export function matchPreset(state: ComparatorState): string {
  const holidays = (h: readonly HolidayState[]) =>
    h.map((x) => `${x.month}-${x.day}`).join(",");
  const hit = COMPARATOR_PRESETS.find((p) => {
    const own = presetState(p);
    return (
      holidays(own.holidays) === holidays(state.holidays) &&
      own.from === state.from &&
      own.to === state.to &&
      own.weekend.join(",") === state.weekend.join(",") &&
      own.columns.join("|") === state.columns.join("|")
    );
  });
  return hit ? hit.id : "";
}

/** Two digits, and a blank left blank rather than written as `00`. */
const pad2 = (text: string): string =>
  text === "" ? "" : text.padStart(2, "0");

/** The permalink payload: `preset` first when the state matches one. */
export function permalinkOf(state: ComparatorState): Record<string, unknown> {
  const preset = matchPreset(state);
  const out: Record<string, unknown> = preset === "" ? {} : { preset };
  state.holidays.forEach((h, i) => {
    out[`holiday${i + 1}`] = `${pad2(h.month)}-${pad2(h.day)}`;
  });
  out["from"] = state.from;
  out["to"] = state.to;
  out["weekend"] = state.weekend.join(",");
  state.columns.forEach((c, i) => {
    out[`column${i + 1}`] = c;
  });
  if (state.year !== "") out["year"] = state.year;
  return out;
}

// ---------------------------------------------------------------------------
// The model: every cell, from library calls
// ---------------------------------------------------------------------------

export type CellState = "date" | "none" | "sentinel";

export interface HolidayCell {
  /** `date`: a date. `none`: a correct answer, no occurrence this year.
   *  `sentinel`: NO SIGNAL. */
  state: CellState;
  unshifted: string;
  observed: string;
  /** "Mon 27 Dec", with the year when it is not the row's. */
  line1: string;
  /** "moved from Sat", or `""`. */
  line2: string;
  /** Said when the observed date is in another year than the row. */
  note: string;
}

export interface HolidayModel {
  name: string;
  month: number;
  day: number;
  valid: boolean;
}

export interface YearRow {
  year: number;
  /** `cells[column][holiday]`. */
  cells: HolidayCell[][];
  /** Per column, the library's attribution, or `null` for a NO SIGNAL column. */
  attributions: (Attribution | null)[];
  /** Two non-sentinel columns put some holiday on different days. */
  disagree: boolean;
  /** The columns whose dates differ from the reference column's. */
  differing: number[];
  /** The first column with a date for a holiday that has one. */
  reference: number;
}

export interface ComparatorModel {
  holidays: HolidayModel[];
  columns: ColumnModel[];
  /** `null` when the span is not a run of whole years from 1900 to 2100. */
  years: number[] | null;
  /** The span was longer than `MAX_YEARS` and was cut. */
  clamped: boolean;
  rows: YearRow[];
  weekend: number[];
}

const SENTINEL_CELL: HolidayCell = {
  state: "sentinel",
  unshifted: "",
  observed: "",
  line1: "",
  line2: "",
  note: "",
};

function yearOfDate(date: string): number {
  return Number.parseInt(date, 10);
}

function intOf(text: string): number {
  return text.trim() === "" ? Number.NaN : Number(text);
}

/** The years a span asks for, and whether it was cut. */
export function yearSpan(
  fromText: string,
  toText: string,
): { years: number[] | null; clamped: boolean } {
  const from = intOf(fromText);
  const to = intOf(toText);
  if (
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from < YEAR_MIN ||
    to > YEAR_MAX ||
    to < from
  ) {
    return { years: null, clamped: false };
  }
  const last = Math.min(to, from + MAX_YEARS - 1);
  return {
    years: Array.from({ length: last - from + 1 }, (_, i) => from + i),
    clamped: last < to,
  };
}

/** The holiday rules of a column: the holidays as `fixed` rules, in order. */
export function columnRules(
  holidays: readonly HolidayModel[],
  column: ColumnModel,
): HolidayRule[] {
  return holidays.map((h) =>
    fixedRule(h.name, h.month, h.day, column.valid ? column.policy : null),
  );
}

function cellOf(
  year: number,
  attribution: Attribution | null,
  index: number,
  holiday: HolidayModel,
): HolidayCell {
  const row = attribution?.rows[index];
  if (!holiday.valid || row === undefined || !row.valid) return SENTINEL_CELL;
  const pair = row.pairs.find((p) => yearOfDate(p.unshifted) === year);
  if (pair === undefined) {
    return {
      state: "none",
      unshifted: "",
      observed: "",
      line1: "No date",
      line2: "",
      note: "",
    };
  }
  if (pair.observed === "") return SENTINEL_CELL;
  const moved = pair.observed !== pair.unshifted;
  const crosses = yearOfDate(pair.observed) !== year;
  const from = Temporal.PlainDate.from(pair.unshifted);
  return {
    state: "date",
    unshifted: pair.unshifted,
    observed: pair.observed,
    // The year goes on the second line, so a cell stays narrow.
    line1: shortDate(pair.observed, yearOfDate(pair.observed)),
    line2: crosses
      ? `${yearOfDate(pair.observed)} · from ${weekdayShort(from.dayOfWeek)}`
      : moved
        ? `moved from ${weekdayShort(from.dayOfWeek)}`
        : "",
    note: crosses
      ? `${holiday.name} ${year} is observed on ${shortDate(pair.observed, year)}, in the year ${yearOfDate(pair.observed) < year ? "before" : "after"}. The row keeps the year of the holiday itself.`
      : "",
  };
}

/**
 * Every cell of the matrix. Each column and year is one `attributeRules` call,
 * with the holidays as `fixed` rules in the order shown. A column the library
 * rejects, or a holiday it rejects, is NO SIGNAL in every cell it touches; a
 * holiday with no date in a year is "No date", which is a correct answer.
 *
 * A row disagrees when, for some holiday, two columns' observed dates fail
 * `areDatesEqual`. A NO SIGNAL cell has no date to compare and is left out, so
 * one rejected column does not make every row disagree.
 */
export function compare(
  lib: HolidayLib,
  state: ComparatorState,
): ComparatorModel {
  const holidays: HolidayModel[] = state.holidays.map((h) => {
    const month = intOf(h.month);
    const day = intOf(h.day);
    return {
      name:
        Number.isInteger(month) && Number.isInteger(day)
          ? holidayName(month, day)
          : "A holiday",
      month,
      day,
      valid: lib.isValidHolidayRule(fixedRule("probe", month, day, null)),
    };
  });
  const columns = state.columns.map((id) => columnOf(lib, id));
  const { years, clamped } = yearSpan(state.from, state.to);
  const rows: YearRow[] = (years ?? []).map((year) => {
    const attributions = columns.map((column) =>
      column.valid
        ? attributeRules(
            lib,
            {
              timeZone: COMPARATOR_ZONE,
              weekend: state.weekend,
              rules: columnRules(holidays, column),
            },
            year,
          )
        : null,
    );
    const cells = attributions.map((attribution, c) =>
      holidays.map((holiday, i) =>
        columns[c]!.valid
          ? cellOf(year, attribution, i, holiday)
          : SENTINEL_CELL,
      ),
    );
    const differing = new Set<number>();
    let reference = -1;
    holidays.forEach((_, i) => {
      const first = cells.findIndex((col) => col[i]!.state === "date");
      if (first < 0) return;
      if (reference < 0) reference = first;
      cells.forEach((col, c) => {
        const cell = col[i]!;
        if (
          c !== first &&
          cell.state === "date" &&
          !lib.areDatesEqual(cell.observed, cells[first]![i]!.observed)
        ) {
          differing.add(c);
        }
      });
    });
    return {
      year,
      cells,
      attributions,
      disagree: differing.size > 0,
      differing: [...differing].sort((a, b) => a - b),
      reference,
    };
  });
  return { holidays, columns, years, clamped, rows, weekend: state.weekend };
}

/** The year the detail shows: the one asked for, else the first row that
 *  disagrees, else the first. `null` when there are no rows. */
export function selectedYear(
  model: ComparatorModel,
  state: ComparatorState,
): number | null {
  if (model.rows.length === 0) return null;
  const asked = Number(state.year);
  const named = model.rows.find((r) => r.year === asked);
  if (named) return named.year;
  return (model.rows.find((r) => r.disagree) ?? model.rows[0]!).year;
}

/** The column the detail shows: the one asked for, else the first that moves
 *  something, else the first. */
export function selectedColumn(
  model: ComparatorModel,
  state: ComparatorState,
): number {
  if (state.column >= 0 && state.column < model.columns.length) {
    return state.column;
  }
  const moving = model.columns.findIndex(
    (c) => c.valid && c.policy !== null && Object.keys(c.policy).length > 0,
  );
  return moving >= 0 ? moving : 0;
}

// ---------------------------------------------------------------------------
// The year: plates and strip clusters
// ---------------------------------------------------------------------------

/** The latest observed date of a row, and the first column that has it. */
export function latestObserved(
  row: YearRow,
): { date: string; column: number } | null {
  let best: { date: string; column: number } | null = null;
  row.cells.forEach((col, c) => {
    for (const cell of col) {
      if (cell.state !== "date") continue;
      if (
        best === null ||
        Temporal.PlainDate.compare(
          Temporal.PlainDate.from(cell.observed),
          Temporal.PlainDate.from(best.date),
        ) > 0
      ) {
        best = { date: cell.observed, column: c };
      }
    }
  });
  return best;
}

export interface Cluster {
  from: string;
  to: string;
}

/**
 * Dates grouped into runs of nearby weeks. A date within the same or the next
 * ISO week of the run before it joins that run, so two holidays in December
 * share a strip and a holiday in January and one in May do not.
 */
export function clusterDates(dates: readonly string[]): Cluster[] {
  const sorted = [...new Set(dates)].sort();
  const clusters: Cluster[] = [];
  const monday = (date: string) => {
    const d = Temporal.PlainDate.from(date);
    return d.subtract({ days: d.dayOfWeek - 1 });
  };
  for (const date of sorted) {
    const last = clusters.at(-1);
    if (last !== undefined) {
      const gap = monday(date).since(monday(last.to), { largestUnit: "days" });
      if (gap.days <= 7) {
        last.to = date;
        continue;
      }
    }
    clusters.push({ from: date, to: date });
  }
  return clusters;
}

/** Every date a column puts on the strip for a year: each holiday's own date and
 *  where it is observed. */
export function laneDates(attribution: Attribution | null): string[] {
  if (attribution === null) return [];
  return attribution.rows.flatMap((r) =>
    r.pairs.flatMap((p) =>
      p.observed === "" ? [p.unshifted] : [p.unshifted, p.observed],
    ),
  );
}

/**
 * A lane's marks. `marksFromAttribution` marks closed days inside the year; a
 * date observed in the year before or after (1 Jan 2028 moved to 31 Dec 2027)
 * is closed too, and the lane shows it as closed.
 */
export function laneMarks(
  lib: HolidayLib,
  attribution: Attribution,
  year: number,
): Record<string, CellMark> {
  const marks = marksFromAttribution(lib, attribution, year);
  if (attribution.full === null) return marks;
  for (const row of attribution.rows) {
    for (const { unshifted, observed } of row.pairs) {
      if (observed === "" || yearOfDate(observed) === year) continue;
      const mark = (marks[observed] ??= {});
      mark.closed = true;
      delete mark.movedFrom;
      if (yearOfDate(unshifted) === year) marks[unshifted] ??= {};
    }
  }
  return marks;
}

// ---------------------------------------------------------------------------
// The printed call
// ---------------------------------------------------------------------------

/**
 * The calls behind one cell column: for each holiday, the `observedDate` call
 * that placed it, with the calendar it read when it walked to the next working
 * day. The results are what the matrix shows, taken from the model.
 */
export function callLines(
  model: ComparatorModel,
  row: YearRow,
  column: number,
): string[] {
  const col = model.columns[column];
  if (col === undefined) return [];
  if (!col.valid) {
    return [`// ${col.label}: NO SIGNAL, ${col.reason}.`];
  }
  const rules = columnRules(model.holidays, col);
  const lines: string[] = [];
  model.holidays.forEach((holiday, i) => {
    const cell = row.cells[column]?.[i];
    if (cell === undefined) return;
    if (cell.state === "sentinel") {
      lines.push(`// ${holiday.name}: NO SIGNAL, the library gave no date.`);
      return;
    }
    if (cell.state === "none") {
      lines.push(`// ${holiday.name}: no date in ${row.year}.`);
      return;
    }
    const rule = rules[i]!;
    if (!("observed" in rule) || rule.observed === undefined) {
      lines.push(
        `// ${holiday.name}: no policy, so the date stays ${literal(cell.unshifted)}.`,
      );
      return;
    }
    const walks =
      row.attributions[column]?.rows[i]?.pairs.find(
        (p) => p.unshifted === cell.unshifted,
      )?.walks === true;
    if (walks) {
      lines.push(
        `// calendar: ${literal(COMPARATOR_ZONE)}, weekend ${literal(model.weekend)}, ` +
          `every holiday that does not walk${i === 0 ? "" : `, and the walks of holidays 1 to ${i}`}`,
        `observedDate(${literal(cell.unshifted)}, ${literal(rule.observed)}, calendar); // ${literal(cell.observed)}`,
      );
    } else {
      lines.push(
        `observedDate(${literal(cell.unshifted)}, ${literal(withoutWalks(rule.observed))}); // ${literal(cell.observed)}`,
      );
    }
  });
  return lines;
}

// ---------------------------------------------------------------------------
// Hand-offs
// ---------------------------------------------------------------------------

function integerOf(text: string): number | null {
  const n = intOf(text);
  return Number.isInteger(n) ? n : null;
}

/**
 * "Build this column's calendar": the Builder, seeded with the holidays as
 * `fixed` rules that carry this column's policy, the weekend, the selected
 * row's year and `UTC`. `null` when a holiday is not a whole month and day, or
 * the column is NO SIGNAL.
 */
export function builderHandoffHref(
  state: ComparatorState,
  column: ColumnModel | undefined,
  year: number | null,
): string | null {
  if (column === undefined || !column.valid || year === null) return null;
  const rules: HolidayRule[] = [];
  for (const h of state.holidays) {
    const month = integerOf(h.month);
    const day = integerOf(h.day);
    if (month === null || day === null) return null;
    rules.push(fixedRule(holidayName(month, day), month, day, column.policy));
  }
  return encodeWidgetPermalink("holidays", {
    rules: formatRuleLines(rules),
    weekend: state.weekend.join(","),
    zone: COMPARATOR_ZONE,
    year: String(year),
  });
}

/**
 * "Compare policies for this date": the Comparator, seeded with a Builder row's
 * month and day, its weekend and its year. A row with a policy opens beside the
 * column that moves nothing; a row with none leaves the columns to the preset.
 * `null` unless the library judges the row a valid `fixed` rule, so a date
 * that is not on the calendar (31 February) has no link.
 */
export function compareHandoffHref(
  lib: HolidayLib,
  row: Pick<RowState, "month" | "day" | "policy">,
  weekend: readonly number[],
  year: number | null,
): string | null {
  const month = integerOf(row.month);
  const day = integerOf(row.day);
  if (month === null || day === null) return null;
  if (!lib.isValidHolidayRule(fixedRule("probe", month, day, null))) {
    return null;
  }
  const first = year ?? COMPARATOR_PRESETS[0]!.from;
  const payload: Record<string, string> = {
    holiday1: `${pad2(String(month))}-${pad2(String(day))}`,
    from: String(first),
    to: String(Math.min(first + MAX_YEARS - 1, YEAR_MAX)),
    weekend: weekend.join(","),
  };
  if (year !== null) payload["year"] = String(year);
  const parsed = parsePolicyText(row.policy);
  if (parsed !== null && Object.keys(parsed).length > 0) {
    payload["column1"] = "none";
    payload["column2"] = columnIdOfText(row.policy);
  }
  return encodeWidgetPermalink("observance", payload);
}

export const COMPARATOR_LINKS = [
  { role: "link-builder", text: "Build this column's calendar" },
] as const;

export const NO_YEARS_REASON = `Years must be whole numbers from ${YEAR_MIN} to ${YEAR_MAX}, with the first not after the last.`;
