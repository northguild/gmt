/**
 * The Code B Day Ruler's logic, with no DOM (SPA-52).
 *
 * The reader picks two years and one day number. For each year the library says how many days
 * the year has, where each month starts and which date the day names. The site holds no
 * leap-year rule, no month length and no year length: every figure here is a library return,
 * and the printed call is the call that was made.
 *
 * - **Year length.** `parseCcsdsAsciiB` of day 366, then of day 365. The first that is not `""`
 *   gives the length.
 * - **Month starts.** `formatCcsdsAsciiB` of each month's first day, read from the day field.
 *   Twelve calls, made once for each year and never on a drag step.
 * - **The day.** `parseCcsdsAsciiB` of `YYYY-DDDT00:00:00Z`, then `formatCcsdsAsciiA` of what it
 *   returned. A drag step makes these two calls for each lane and no others.
 *
 * `YYYY` and `DDD` are the four- and three-digit field widths of the call's argument.
 */
import type { CcsdsLib } from "./ccsds-widgets";
import { runCall, type EdiCall } from "./edi-widgets";

/** The ruler's fixed scale: day columns 1 to this, for both lanes. */
export const SCALE_DAYS = 366;
export const NO_RESULT_TEXT = "no result";
export const TYPE_A_YEAR = "Type a year.";
export const MIN_YEAR = 1;
export const MAX_YEAR = 9999;
export const MONTH_COUNT = 12;

const MIDNIGHT = "T00:00:00Z";

// ---------------------------------------------------------------------------
// Presets, state and arguments
// ---------------------------------------------------------------------------

export interface RulerState {
  /** The text typed, passed on exactly as typed. */
  year: string;
  /** The text typed in the second box. */
  compare: string;
  day: number;
}

export interface RulerPreset {
  id: string;
  label: string;
  description: string;
  state: RulerState;
}

export const RULER_PRESETS: readonly RulerPreset[] = [
  {
    id: "after-leap-day",
    label: "After the leap day",
    description: "Day 061 is 1 March in 2024 and 2 March in 2026.",
    state: { year: "2024", compare: "2026", day: 61 },
  },
  {
    id: "leap-day",
    label: "The leap day",
    description: "Day 060 is 29 February in 2024 and 1 March in 2026.",
    state: { year: "2024", compare: "2026", day: 60 },
  },
  {
    id: "day-366",
    label: "Day 366",
    description: "Day 366 is 31 December in 2016 and does not exist in 2017.",
    state: { year: "2016", compare: "2017", day: 366 },
  },
  {
    id: "century",
    label: "A century year",
    description:
      "Day 060 is 29 February in 2000 and 1 March in 2100: the library's rule, not the site's.",
    state: { year: "2000", compare: "2100", day: 60 },
  },
  {
    id: "new-year",
    label: "New Year",
    description: "Day 001 is 1 January in both years.",
    state: { year: "2026", compare: "2028", day: 1 },
  },
];

export const DEFAULT_PRESET: RulerPreset = RULER_PRESETS[0]!;
export const CUSTOM_PRESET_ID = "custom";

export interface DayRulerArgs {
  /** A preset id, from a permalink. */
  preset?: string;
  year?: number | string;
  compare?: number | string;
  day?: number | string;
}

export function presetState(preset: RulerPreset): RulerState {
  return { ...preset.state };
}

/** Whether the args seed anything. */
export function isSeeded(args: DayRulerArgs): boolean {
  return Object.values(args).some((v) => v !== undefined);
}

const DIGITS = /^\d+$/;

function dayNumber(value: unknown): number | null {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string" && DIGITS.test(value)
        ? Number(value)
        : NaN;
  return Number.isInteger(n) && n >= 1 && n <= SCALE_DAYS ? n : null;
}

function yearText(value: unknown): string | null {
  if (typeof value === "number")
    return Number.isInteger(value) ? String(value) : null;
  return typeof value === "string" ? value : null;
}

/**
 * Seed arguments as a state. Typed values (the chat) and their text forms (a permalink) both
 * land here. A missing or unusable field takes the named preset's value, or the default
 * preset's; a year typed as any text is kept so a link can carry a blank or refused box.
 */
export function readArgs(args: DayRulerArgs): RulerState {
  const named = RULER_PRESETS.find((p) => p.id === args.preset);
  const state = presetState(named ?? DEFAULT_PRESET);
  const year = yearText(args.year);
  if (year !== null) state.year = year;
  const compare = yearText(args.compare);
  if (compare !== null) state.compare = compare;
  const day = dayNumber(args.day);
  if (day !== null) state.day = day;
  return state;
}

/** The preset the state matches, or `custom`. */
export function matchPreset(state: RulerState): string {
  const hit = RULER_PRESETS.find(
    (p) =>
      p.state.year === state.year &&
      p.state.compare === state.compare &&
      p.state.day === state.day,
  );
  return hit ? hit.id : CUSTOM_PRESET_ID;
}

/**
 * The permalink payload: nothing for the default state, `{ preset }` while the state matches
 * another preset, else the three values as strings.
 */
export function permalinkOf(state: RulerState): Record<string, unknown> {
  const preset = matchPreset(state);
  if (preset === DEFAULT_PRESET.id) return {};
  if (preset !== CUSTOM_PRESET_ID) return { preset };
  return {
    year: state.year,
    compare: state.compare,
    day: String(state.day),
  };
}

// ---------------------------------------------------------------------------
// What the library says about a year
// ---------------------------------------------------------------------------

/** The four-digit year field of a call's argument. */
export const fieldYear = (year: string): string => year.padStart(4, "0");
/** The three-digit day field of a call's argument. */
export const fieldDay = (day: number): string => String(day).padStart(3, "0");
const fieldMonth = (month: number): string => String(month).padStart(2, "0");

/** The day field of a Code B text, or `null` when the text is not one. */
function dayFieldOf(codeB: string): number | null {
  const n = Number(codeB.split(/[-T]/)[1]);
  return Number.isInteger(n) ? n : null;
}

export interface YearFacts {
  /** The year as a call's argument. */
  year: string;
  /** The library's year length, or `null` when it reads no Code B in the year. */
  length: number | null;
  /** The day each month starts on, from the library; empty when there is no year length. */
  starts: readonly number[];
}

export type LaneStatus = "ok" | "empty" | "none";

export interface LaneRead {
  status: LaneStatus;
  /** The year as typed. */
  typed: string;
  /** The year as a call's argument. */
  year: string;
  length: number | null;
  /** `2024 · 366 days`, or the reason there is nothing to say. */
  header: string;
  /** The Code B text sent, `""` when none was. */
  codeB: string;
  /** The library's Code A, `""` when none. */
  codeA: string;
  /** The date in words, or `No day 366 in YYYY`, or the reason. */
  date: string;
  /** The Code A month and day, as the library returned them (`03-01`), for the comparison. */
  monthDay: string;
  /** True when the library read the year and has no such day in it. */
  missing: boolean;
  starts: readonly number[];
  /** The lane's accessible name. */
  aria: string;
  calls: EdiCall[];
}

export interface RulerRead {
  day: number;
  dayText: string;
  lanes: [LaneRead, LaneRead];
  sentence: string;
  /** Every call a step made, in order. */
  calls: EdiCall[];
}

export interface Ruler {
  /** The library's short and long English month names. */
  shortNames: readonly string[];
  longNames: readonly string[];
  /** The longest long month name, to size a date. */
  longestName: string;
  facts(year: string): YearFacts;
  read(state: RulerState): RulerRead;
}

export const noDaySentence = (day: string, year: string): string =>
  `No day ${day} in ${year}`;

const longest = (names: readonly string[]): string =>
  names.reduce((a, c) => (c.length > a.length ? c : a), "");

export function createRuler(lib: CcsdsLib): Ruler {
  const shortNames = lib.getLocaleMonthNames("en", "short");
  const longNames = lib.getLocaleMonthNames("en", "long");
  const cache = new Map<string, YearFacts>();

  function facts(typed: string): YearFacts {
    const cached = cache.get(typed);
    if (cached) return cached;
    const year = fieldYear(typed);
    const parse = (day: number): string =>
      lib.parseCcsdsAsciiB(`${year}-${fieldDay(day)}${MIDNIGHT}`);
    const length =
      parse(SCALE_DAYS) !== ""
        ? 366
        : parse(SCALE_DAYS - 1) !== ""
          ? 365
          : null;
    const starts: number[] = [];
    if (length !== null) {
      for (let month = 1; month <= MONTH_COUNT; month++) {
        const start = dayFieldOf(
          lib.formatCcsdsAsciiB(
            `${year}-${fieldMonth(month)}-01${MIDNIGHT}`,
            0,
          ),
        );
        if (start === null) {
          starts.length = 0;
          break;
        }
        starts.push(start);
      }
    }
    const made: YearFacts = { year, length, starts };
    cache.set(typed, made);
    return made;
  }

  function lane(typed: string, day: number): LaneRead {
    const blank = (status: LaneStatus, date: string): LaneRead => ({
      status,
      typed,
      year: fieldYear(typed),
      length: null,
      header: typed === "" ? "No year" : `${typed} · ${NO_RESULT_TEXT}`,
      codeB: "",
      codeA: "",
      date,
      monthDay: "",
      missing: false,
      starts: [],
      aria:
        status === "empty"
          ? "No year typed"
          : `${typed}: the library reads no Code B in this year`,
      calls: [],
    });
    if (typed === "") return blank("empty", TYPE_A_YEAR);
    const f = facts(typed);
    if (f.length === null) {
      return blank("none", `The library reads no Code B in year ${f.year}.`);
    }
    const codeB = `${f.year}-${fieldDay(day)}${MIDNIGHT}`;
    const calls: EdiCall[] = [];
    const parsed = runCall(lib, "parseCcsdsAsciiB", codeB);
    calls.push(parsed);
    const march = f.starts[2];
    const aria = `${f.year}: ${f.length} days${
      march === undefined
        ? ""
        : `, ${longNames[2] ?? "month 3"} starts on day ${fieldDay(march)}`
    }`;
    const base: LaneRead = {
      ...blank("ok", ""),
      year: f.year,
      length: f.length,
      header: `${f.year} · ${f.length} days`,
      codeB,
      starts: f.starts,
      aria,
      calls,
    };
    const instantText = parsed.result as string;
    if (instantText === "") {
      return day === SCALE_DAYS && f.length < SCALE_DAYS
        ? {
            ...base,
            date: noDaySentence(fieldDay(day), f.year),
            missing: true,
          }
        : { ...base, status: "none", date: NO_RESULT_TEXT };
    }
    const written = runCall(lib, "formatCcsdsAsciiA", instantText, 0);
    calls.push(written);
    const codeA = written.result as string;
    const [, month, dom] = codeA.split(/[-T]/);
    const name = longNames[Number(month) - 1];
    if (codeA === "" || name === undefined || dom === undefined) {
      return { ...base, status: "none", date: NO_RESULT_TEXT };
    }
    return {
      ...base,
      codeA,
      date: `${Number(dom)} ${name}`,
      monthDay: `${month}-${dom}`,
    };
  }

  function read(state: RulerState): RulerRead {
    const dayText = fieldDay(state.day);
    const a = lane(state.year, state.day);
    const b = lane(state.compare, state.day);
    return {
      day: state.day,
      dayText,
      lanes: [a, b],
      sentence: sentenceOf(dayText, a, b),
      calls: [...a.calls, ...b.calls],
    };
  }

  return {
    shortNames,
    longNames,
    longestName: longest(longNames),
    facts,
    read,
  };
}

// ---------------------------------------------------------------------------
// The comparison line
// ---------------------------------------------------------------------------

export const NEED_TWO_YEARS = "Give two years to compare.";

function sentenceOf(day: string, a: LaneRead, b: LaneRead): string {
  if (a.status === "empty" || b.status === "empty") return NEED_TWO_YEARS;
  if (a.status === "none" || b.status === "none") {
    return "The library reads no Code B in one of the years.";
  }
  if (a.missing && b.missing) {
    return `Day ${day} does not exist in ${a.year} or ${b.year}.`;
  }
  if (a.missing) {
    return `Day ${day} does not exist in ${a.year} and is ${b.date} in ${b.year}.`;
  }
  if (b.missing) {
    return `Day ${day} is ${a.date} in ${a.year} and does not exist in ${b.year}.`;
  }
  return a.monthDay === b.monthDay
    ? `Day ${day} is ${a.date} in both years.`
    : `Day ${day} is ${a.date} in ${a.year} and ${b.date} in ${b.year}.`;
}

/** Every sentence shape the line can take, at its widest, for a hold's ghosts. */
export function sentenceGhosts(longestName: string): string[] {
  const date = `88 ${longestName}`;
  return [
    NEED_TWO_YEARS,
    "The library reads no Code B in one of the years.",
    `Day 888 does not exist in 8888 or 8888.`,
    `Day 888 does not exist in 8888 and is ${date} in 8888.`,
    `Day 888 is ${date} in 8888 and does not exist in 8888.`,
    `Day 888 is ${date} in 8888 and ${date} in 8888.`,
    `Day 888 is ${date} in both years.`,
  ];
}

// ---------------------------------------------------------------------------
// Drawing geometry (positions only)
// ---------------------------------------------------------------------------

/** A day's place on the fixed scale, 0 (day 1) to 1 (day 366). */
export const dayAt = (day: number): number => (day - 1) / (SCALE_DAYS - 1);

export interface Band {
  /** The library's short month name. */
  label: string;
  at: number;
  span: number;
  /** Alternates, so the band edges show without colour. */
  pattern: "solid" | "hatch";
}

/** A lane's month bands, from the day each month starts to the day the next one does. */
export function bandsOf(lane: LaneRead, shortNames: readonly string[]): Band[] {
  if (lane.length === null || lane.starts.length === 0) return [];
  return lane.starts.map((start, i) => {
    const end = lane.starts[i + 1] ?? lane.length;
    return {
      label: shortNames[i] ?? "",
      at: dayAt(start),
      span: dayAt(end) - dayAt(start),
      pattern: i % 2 === 0 ? "solid" : "hatch",
    };
  });
}

/** The cell a common year lacks: the scale's last day. */
export function absentCell(
  lane: LaneRead,
): { at: number; span: number } | null {
  if (lane.length === null || lane.length >= SCALE_DAYS) return null;
  return { at: dayAt(lane.length), span: 1 - dayAt(lane.length) };
}

/** Day numbers the ruler's axis names. */
export const AXIS_DAYS = [1, 100, 200, 300, SCALE_DAYS] as const;

export const CODE_B_SAMPLE = "8888-888T00:00:00Z";
export const CODE_A_SAMPLE = "8888-88-88T00:00:00Z";
export const MAX_CALLS = 4;
