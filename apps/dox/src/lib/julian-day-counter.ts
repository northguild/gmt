/**
 * Pure helpers for the Julian Day Counter.
 *
 * One instant is written four ways on the scale the reader picks: a two-part Julian Date, a
 * single Julian Date, a Modified Julian Date and seconds since J2000.0. Each is read back to UTC
 * and the gap is measured, so the page shows what a single double keeps and what it drops. A
 * two-day ruler shows that a JD day turns at noon, while the MJD day and the calendar day turn
 * at midnight.
 *
 * No DOM and no gmt import. Every function that calls the library takes a `DayCountLib`
 * (`timescale-lib.ts`). The tool computes no day count and holds no epoch: the ruler's marks
 * are instants the library wrote, placed by spans the library measured.
 */
import { NO_RESULT_TEXT } from "./satellite-clock-converter";
import { runCall, type EdiCall } from "./edi-widgets";
import {
  FORMS,
  FROM_FN,
  LAST_INSTANT,
  SCALES,
  microsText,
  numberText,
  parseNumber,
  parseParts,
  partsText,
  shiftNs,
  spell,
  type Form,
  type JdParts,
  type Scale,
  type Spelling,
} from "./day-count-widgets";
import type { DayCountLib } from "./timescale-lib";
import { INTEGER_UTC_FROM, lacksOffset } from "./timescale-widgets";

export { NO_RESULT_TEXT };

export const CUSTOM_PRESET_ID = "custom";
export const MAX_VALUE_LENGTH = 64;

export type ReadMode = "instant" | "jd" | "mjd" | "j2000";

export const READ_MODES: readonly { value: ReadMode; label: string }[] = [
  { value: "instant", label: "Instant" },
  { value: "jd", label: "JD" },
  { value: "mjd", label: "MJD" },
  { value: "j2000", label: "J2000 s" },
];

const isReadMode = (v: unknown): v is ReadMode =>
  READ_MODES.some((m) => m.value === v);
const isScale = (v: unknown): v is Scale => SCALES.some((s) => s === v);

/** The names of the four forms, as the plates and the table's rows read. */
export const FORM_NAMES: Record<Form, string> = {
  parts: "Two-part JD",
  jd: "Single JD",
  mjd: "MJD",
  j2000: "J2000 seconds",
};

/** The form each read mode reads with. A `jd` reading may be one number or two parts. */
const MODE_FORM: Record<Exclude<ReadMode, "instant">, Form> = {
  jd: "jd",
  mjd: "mjd",
  j2000: "j2000",
};

// ---------------------------------------------------------------------------
// Sentences
// ---------------------------------------------------------------------------

export const EMPTY_TEXT =
  "Type an instant or a count, or pick a preset, to see it written four ways.";

export const SENTENCES = {
  missingOffset:
    "That time has no offset: end it with Z, as in 2026-01-01T12:00:00Z.",
  noInsertedSecond: "No second was inserted at the end of that day.",
  notAnInstant:
    "That is not a UTC instant: write it like 2026-01-01T12:00:00Z.",
  range: "The library counts days only from 1972-01-01 to the end of 9999.",
  notANumber:
    "That is not a number: write one plain decimal, or two joined by +, such as 2461042 + 0.5.",
  outside:
    "That count falls outside the days the library counts, which run from 1972-01-01 to the end of 9999 on the chosen scale.",
} as const;

/** The footnote when a single double cannot hold the instant. */
export const EDGE_NOTE = `${NO_RESULT_TEXT}: a single number cannot hold an instant this close to an end of the range. The two-part form can.`;
/** The note a leap-second window carries. */
export const LEAP_NOTE =
  "This window holds an inserted second. On UTC that day still counts as one JD day (a quasi-JD), so its fraction runs slightly slower.";
/** The J2000 plate's note: which scale each function counts on when none is named. */
export const DEFAULT_SCALE_NOTE =
  "toJ2000Seconds counts on TT when no scale is named; the other three count on UTC. This tool names the scale in every call.";

export const FOOTNOTES = [EDGE_NOTE] as const;

// ---------------------------------------------------------------------------
// State, presets, permalink
// ---------------------------------------------------------------------------

export interface CounterState {
  value: string;
  read: ReadMode;
  scale: Scale;
}

/** Seed arguments: the permalink's flat string keys, or a chat call's `value`, `read`, `scale`. */
export type JulianDayCounterArgs = Record<string, unknown>;

interface CounterPreset {
  id: string;
  label: string;
  description: string;
  state: CounterState;
}

/**
 * Every preset is a worked case whose result the library decides; the tests read each one
 * through the library. The descriptions state no figure the tests do not check.
 */
export const COUNTER_PRESETS: readonly CounterPreset[] = [
  {
    id: "j2000",
    label: "J2000.0, a JD on TT",
    description: "J2000.0 is noon on TT, which is 11:58:55.816 on a UTC clock.",
    state: { value: "2451545", read: "jd", scale: "TT" },
  },
  {
    id: "midnight",
    label: "Midnight is a half day",
    description: "At midnight the JD ends in .5 and the MJD is a whole number.",
    state: { value: "2000-01-01T00:00:00Z", read: "instant", scale: "UTC" },
  },
  {
    id: "lost",
    label: "Twenty microseconds a double drops",
    description:
      "The single JD cannot keep 20 µs of a day; the two parts keep every one.",
    state: {
      value: "2026-01-01T12:00:00.00002Z",
      read: "instant",
      scale: "UTC",
    },
  },
  {
    id: "leap",
    label: "Inside a leap second",
    description:
      "The inserted second falls inside one UTC day, so the JD stays a quasi-JD.",
    state: { value: "2016-12-31T23:59:60.5Z", read: "instant", scale: "UTC" },
  },
  {
    id: "tt-vs-utc",
    label: "The same instant on TT",
    description:
      "The same UTC instant gives a different JD when the days are counted on TT.",
    state: { value: "2026-01-01T12:00:00Z", read: "instant", scale: "TT" },
  },
  {
    id: "last",
    label: "The last day the library counts",
    description: "The range ends in 9999.",
    state: { value: "9999-12-31T12:00:00Z", read: "instant", scale: "UTC" },
  },
];

export const DEFAULT_PRESET = COUNTER_PRESETS[0]!;

export function presetState(preset: CounterPreset): CounterState {
  return { ...preset.state };
}

/** The preset whose value, read mode and scale match `state`, or `custom`. */
export function matchPreset(state: CounterState): string {
  const hit = COUNTER_PRESETS.find(
    (p) =>
      p.state.value === state.value.trim() &&
      p.state.read === state.read &&
      p.state.scale === state.scale,
  );
  return hit ? hit.id : CUSTOM_PRESET_ID;
}

const filled = (v: unknown): boolean => typeof v === "string" && v !== "";

/** Whether `args` names anything `readArgs` seeds from. */
export function isSeeded(args: JulianDayCounterArgs | undefined): boolean {
  return (
    args !== undefined &&
    (filled(args["value"]) ||
      filled(args["preset"]) ||
      filled(args["read"]) ||
      filled(args["scale"]))
  );
}

/**
 * The state a seed describes. A `value` is taken as written; with no `read` it reads as a JD when
 * it is a number and as an instant otherwise. A scale that is not named is UTC: a scale is never
 * guessed. With no value, a preset by its id (else the default) is the base, and a named `read`
 * or `scale` replaces its own.
 */
export function readArgs(args: JulianDayCounterArgs): CounterState {
  const read = isReadMode(args["read"]) ? args["read"] : undefined;
  const scale = isScale(args["scale"]) ? args["scale"] : undefined;
  const value = args["value"];
  if (typeof value === "string" && value !== "") {
    const text = value.slice(0, MAX_VALUE_LENGTH);
    const numeric = parseNumber(text) !== null || parseParts(text) !== null;
    return {
      value: text,
      read: read ?? (numeric ? "jd" : "instant"),
      scale: scale ?? "UTC",
    };
  }
  const named = COUNTER_PRESETS.find((p) => p.id === args["preset"]);
  return {
    ...presetState(named ?? DEFAULT_PRESET),
    ...(read === undefined ? {} : { read }),
    ...(scale === undefined ? {} : { scale }),
  };
}

/** The permalink keys for `state`. The default writes nothing. */
export function permalinkOf(state: CounterState): Record<string, string> {
  const value = state.value.trim().slice(0, MAX_VALUE_LENGTH);
  if (value === "") return {};
  if (matchPreset({ ...state, value }) === DEFAULT_PRESET.id) {
    return {};
  }
  return { value, read: state.read, scale: state.scale };
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export interface FormRow {
  form: Form;
  name: string;
  /** The call that wrote the form, or `null` before a reading. */
  call: EdiCall | null;
  value: string;
  back: string;
  shift: string;
}

export interface PlateSpec {
  role: string;
  caption: string;
  value: string | null;
  lines: readonly string[];
  series?: 1 | 2 | 3 | 4;
  quiet?: boolean;
}

export interface RulerMark {
  at: number;
  label: string;
  series: 1 | 2 | 3 | 4;
}

export interface RulerLane {
  name: string;
  marks: RulerMark[];
}

export interface Ruler {
  lanes: RulerLane[];
  /** Where the instant falls, 0 to 1. */
  cursor: number;
  ticks: { at: number; label: string }[];
  /** The window holds an inserted second. */
  leap: boolean;
  /** Every fact the drawing shows, in words. */
  aria: string;
}

export interface CounterRead {
  state: CounterState;
  status: "ok" | "empty" | "sentinel";
  failure: string | null;
  emptyText: string | null;
  /** The UTC instant every form is made from. */
  utc: string | null;
  rows: FormRow[];
  plates: PlateSpec[];
  footnote: string;
  calls: EdiCall[];
  ruler: Ruler | null;
}

const PLATE_ROLES: Record<Form, string> = {
  parts: "hero-parts",
  jd: "hero-jd",
  mjd: "hero-mjd",
  j2000: "hero-j2000",
};

/** The plates of a reading. `null` draws the empty plates. */
function platesOf(spellings: readonly Spelling[] | null): PlateSpec[] {
  return FORMS.map((form, i): PlateSpec => {
    const s = spellings?.[i] ?? null;
    return {
      role: PLATE_ROLES[form],
      caption: FORM_NAMES[form],
      value: s === null ? null : valueText(s),
      lines: s === null ? [] : linesOf(s),
      series: (i + 1) as 1 | 2 | 3 | 4,
    };
  });
}

function valueText(s: Spelling): string | null {
  if (s.value === null) return null;
  return typeof s.value === "number" ? numberText(s.value) : partsText(s.value);
}

/** The shift as a plate says it. */
function shiftLine(s: Spelling): string {
  if (s.shift === null) return "";
  if (s.shift === 0n) return "shift 0 ns";
  return s.form === "parts"
    ? `shift ${microsText(s.shift)}`
    : `this double is ${microsText(s.shift)} from the instant`;
}

function linesOf(s: Spelling): string[] {
  const note = s.form === "j2000" ? [DEFAULT_SCALE_NOTE] : [];
  if (s.value === null) return note;
  return [
    `back to UTC: ${s.back === "" ? NO_RESULT_TEXT : s.back}`,
    shiftLine(s),
    ...note,
  ];
}

function rowOf(s: Spelling): FormRow {
  return {
    form: s.form,
    name: FORM_NAMES[s.form],
    call: s.to,
    value: valueText(s) ?? NO_RESULT_TEXT,
    back: s.value === null || s.back === "" ? NO_RESULT_TEXT : s.back,
    shift:
      s.shift === null
        ? NO_RESULT_TEXT
        : s.shift === 0n
          ? "0 ns"
          : microsText(s.shift),
  };
}

function blank(
  state: CounterState,
  status: "empty" | "sentinel",
  text: string,
  calls: EdiCall[],
): CounterRead {
  return {
    state,
    status,
    failure: status === "sentinel" ? text : null,
    emptyText: status === "empty" ? text : null,
    utc: null,
    rows: FORMS.map((form) => ({
      form,
      name: FORM_NAMES[form],
      call: null,
      value: NO_RESULT_TEXT,
      back: NO_RESULT_TEXT,
      shift: NO_RESULT_TEXT,
    })),
    plates: platesOf(null),
    footnote: "",
    calls,
    ruler: null,
  };
}

/** The reading of an empty widget. */
export function emptyRead(): CounterRead {
  return blank(
    { value: "", read: "instant", scale: "UTC" },
    "empty",
    EMPTY_TEXT,
    [],
  );
}

/** Why the library gave no day count for a typed instant. */
function whyNotInstant(lib: DayCountLib, value: string): string {
  if (lacksOffset(lib, value)) return SENTENCES.missingOffset;
  if (lib.hasSecond60(value)) return SENTENCES.noInsertedSecond;
  if (lib.isValidInstant(value)) return SENTENCES.range;
  return SENTENCES.notAnInstant;
}

/**
 * Read the counter's one value with the library. An instant goes straight to the four `to`
 * functions; a count is first read to UTC with its own `from` function. Every form is then
 * read back and measured against the instant.
 *
 * A state with no value makes no library call and is `empty`, not a sentinel.
 */
export function readCounter(
  lib: DayCountLib,
  state: CounterState,
): CounterRead {
  const value = state.value.trim();
  if (value === "") return blank(state, "empty", EMPTY_TEXT, []);
  const calls: EdiCall[] = [];
  let utc = value;
  if (state.read !== "instant") {
    const given =
      state.read === "jd"
        ? (parseParts(value) ?? parseNumber(value))
        : parseNumber(value);
    if (given === null)
      return blank(state, "sentinel", SENTENCES.notANumber, []);
    // Two parts are read with the two-part function, whatever the mode.
    const form: Form =
      typeof given === "number" ? MODE_FORM[state.read] : "parts";
    const call = runCall(lib, FROM_FN[form], given, state.scale);
    calls.push(call);
    if (call.result === "" || typeof call.result !== "string") {
      return blank(state, "sentinel", SENTENCES.outside, calls);
    }
    utc = call.result;
  }
  const spellings = FORMS.map((form) => spell(lib, utc, form, state.scale));
  const [parts] = spellings as [Spelling, ...Spelling[]];
  if (parts.value === null || typeof parts.value === "number") {
    const why =
      state.read === "instant" ? whyNotInstant(lib, value) : SENTENCES.outside;
    return blank(state, "sentinel", why, [...calls, parts.to]);
  }
  for (const s of spellings) {
    calls.push(s.to);
    if (s.call !== null) calls.push(s.call);
  }
  const edge = spellings.some((s) => s.value === null);
  return {
    state,
    status: "ok",
    failure: null,
    emptyText: null,
    utc,
    rows: spellings.map(rowOf),
    plates: platesOf(spellings),
    footnote: edge ? EDGE_NOTE : "",
    calls,
    ruler: rulerOf(lib, utc, parts.value, state.scale),
  };
}

// ---------------------------------------------------------------------------
// The ruler
// ---------------------------------------------------------------------------

/** The most calls one reading makes: one `from` call to read a count, then a `to` and a `from` for each form. */
export const MAX_CALLS = 1 + FORMS.length * 2;

const within = (at: number | null): at is number =>
  at !== null && at >= 0 && at <= 1;

/**
 * Two days on the chosen scale, midnight to midnight, around the instant. Every end and mark is
 * an instant the library wrote (`fromJulianDateParts`, `startOfUtc`, `addUtc`), and a position is
 * one library span over the window's own, so a day with an inserted second is drawn one second
 * longer. A mark the library cannot write (past 9999) is left out, and the window ends at the end
 * of the range.
 */
export function rulerOf(
  lib: DayCountLib,
  utc: string,
  parts: JdParts,
  scale: Scale,
): Ruler | null {
  const day = parts.jd1;
  const write = (jd1: number, jd2: number): string =>
    lib.fromJulianDateParts({ jd1, jd2 }, scale);
  const startMark = write(day - 1, 0.5);
  const endMark = write(day + 1, 0.5);
  const start = startMark === "" ? INTEGER_UTC_FROM : startMark;
  const end = endMark === "" ? LAST_INSTANT : endMark;
  const total = shiftNs(lib, start, end);
  if (total === null || total <= 0n) return null;
  const place = (x: string): number | null => {
    if (x === "") return null;
    const n = shiftNs(lib, start, x);
    return n === null ? null : Number(n) / Number(total);
  };
  const cursor = place(utc);
  if (cursor === null) return null;

  const noonA = write(day, 0);
  const noonB = write(day + 1, 0);
  const midnight = write(day, 0.5);

  const at = (x: string): { at: number; text: string } | null => {
    const p = place(x);
    return within(p) ? { at: p, text: x } : null;
  };
  const marksOf = (
    list: readonly { text: string; label: string }[],
    series: 1 | 2 | 3,
  ): RulerMark[] =>
    list.flatMap((m) => {
      const p = at(m.text);
      return p === null ? [] : [{ at: p.at, label: m.label, series }];
    });

  const jdLane = marksOf(
    [
      { text: noonA, label: `JD day ${day} begins at noon` },
      { text: noonB, label: `JD day ${day + 1} begins at noon` },
    ],
    1,
  );
  const midLane = marksOf(
    [
      ...(startMark === ""
        ? []
        : [{ text: start, label: `${scale} midnight` }]),
      { text: midnight, label: `${scale} midnight` },
      ...(endMark === "" ? [] : [{ text: end, label: `${scale} midnight` }]),
    ],
    2,
  );
  const lanes: RulerLane[] = [
    { name: "JD day", marks: jdLane },
    { name: `MJD and calendar day on ${scale}`, marks: midLane },
  ];
  if (scale !== "UTC") {
    const first = lib.startOfUtc(start, "day");
    const days = [0, 1, 2].map((n) =>
      n === 0 ? first : lib.addUtc(first, { days: n }),
    );
    lanes.push({
      name: "UTC calendar day",
      marks: marksOf(
        days.map((text) => ({ text, label: "UTC midnight" })),
        3,
      ),
    });
  }
  for (const l of lanes)
    l.marks.push({ at: cursor, label: "the instant", series: 4 });

  const ticks = [
    ...(startMark === "" ? [] : [{ at: 0, label: "00h" }]),
    ...jdLane.slice(0, 1).map((m) => ({ at: m.at, label: "12h" })),
    ...midLane
      .filter((m) => m.at > 0 && m.at < 1)
      .map((m) => ({ at: m.at, label: "00h" })),
    ...jdLane.slice(1).map((m) => ({ at: m.at, label: "12h" })),
    ...(endMark === "" ? [] : [{ at: 1, label: "00h" }]),
  ];

  const leapSeconds = lib.leapSecondsBetween(start, end);
  const leap = leapSeconds !== null && leapSeconds > 0;
  const aria = [
    `Two days on ${scale}, from ${start} to ${end}, written in UTC.`,
    `The instant ${utc} is in JD day ${day}.`,
    `JD days begin at noon: ${noonA === "" ? NO_RESULT_TEXT : noonA} and ${noonB === "" ? NO_RESULT_TEXT : noonB}.`,
    `${scale} days begin at midnight: ${start}, ${midnight === "" ? NO_RESULT_TEXT : midnight} and ${end}.`,
    ...(scale === "UTC"
      ? []
      : [
          "UTC days begin at midnight on the UTC clock, which is not the scale's midnight.",
        ]),
    ...(leap ? [LEAP_NOTE] : []),
  ].join(" ");

  return { lanes, cursor, ticks, leap, aria };
}

/** The status line: what changed, in words. */
export function summaryText(read: CounterRead): string {
  if (read.status === "sentinel") return read.failure ?? "";
  if (read.status === "empty") return read.emptyText ?? "";
  return read.plates
    .filter((p) => p.value !== null)
    .map((p) => `${p.caption} ${p.value}`)
    .join(". ");
}
