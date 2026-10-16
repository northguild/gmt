/**
 * Pure helpers for the GNSS Rollover Checker.
 *
 * Every satellite week counter wraps. A receiver whose firmware fixes the era
 * (or counts from a build date) starts reporting dates one counter period early
 * once the real clock passes the end of the window it was built for. The tool
 * answers "is my receiver affected, and when?" for any counter and either
 * firmware model, and lists the next wrap of every counter.
 *
 * No DOM and no gmt import. Every function that calls the library takes a
 * `GnssLib` (`gnss-lib.ts`), loaded by the mount from the real package. The
 * widget draws the library's results and computes none of them:
 *
 * - `utcToGnssWeek` gives the true reading and its era; `gnssWeekToUtc` gives
 *   the date the firmware reports for it, the start of each era and the date
 *   the rolling rule picks;
 * - `areUtcEqual` and `diffUtcAsDuration` give the verdict and every time left.
 *
 * The only numbers written here are drawing (a mark's place on the strip is its
 * instant as a share of the window) and the formatting of a duration the
 * library returned as words.
 *
 * Naming rule: GMT tracks no law, and the UI names no body. Counters are named
 * by the library's own names (`GPS-LNAV`, `GAL`, `IRN-L1NV`).
 */

import { runCall, type EdiCall } from "./edi-widgets";
import { toEpochMs } from "./dwell-ledger";
import {
  GNSS_WEEK_COUNTERS,
  ROLLOVER_NOW_MODES,
  type GnssWeekCounter,
  type RolloverNowMode,
} from "./gnss-names";
import type { GnssLib, RolloverEra } from "./gnss-lib";
import {
  NO_RESULT_TEXT,
  beforeFirstWeekText,
  eraStart,
  firstRefusedWeek,
} from "./gnss-widgets";
import type { PlateSpec } from "./ledger-widgets";
import type { ToolHandoff } from "./widget-permalink";

export { NO_RESULT_TEXT };

export const CUSTOM_PRESET_ID = "custom";

/** The longest a typed instant can be, and the longest a seed can carry. */
export const MAX_VALUE_LENGTH = 64;

/** How the receiver's firmware counts passes of the counter. */
export const FIRMWARE_MODELS = ["pivot", "era"] as const;
export type FirmwareModel = (typeof FIRMWARE_MODELS)[number];

export const FIRMWARE_MODEL_LABELS: Record<FirmwareModel, string> = {
  pivot: "Build date",
  era: "Fixed era",
};

export const NOW_MODE_LABELS: Record<RolloverNowMode, string> = {
  today: "Today",
  date: "A date",
};

/** What the rolling row says when the check date is not today. */
export const ROLLING_DATE_TEXT =
  "rolling reads the device's real clock; switch to Today to see it";

export const RIGHT_DATE_TEXT = "the right date";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** The widget's controls, as strings. */
export interface RolloverState {
  counter: GnssWeekCounter;
  model: FirmwareModel;
  pivot: string;
  era: string;
  nowMode: RolloverNowMode;
  date: string;
}

/** Seed arguments: the permalink's flat string keys, or a chat call's. */
export type GnssRolloverCheckerArgs = Record<string, unknown>;

export interface RolloverPreset {
  id: string;
  label: string;
  description: string;
  state: RolloverState;
}

const BASE: RolloverState = {
  counter: "IRN-LNAV",
  model: "pivot",
  pivot: "2020-01-01T00:00:00Z",
  era: "1",
  nowMode: "date",
  date: "2026-10-15T00:00:00Z",
};

const built = (
  counter: GnssWeekCounter,
  pivot: string,
  date: string,
): RolloverState => ({ ...BASE, counter, model: "pivot", pivot, date });

const fixed = (
  counter: GnssWeekCounter,
  era: string,
  date: string,
): RolloverState => ({ ...BASE, counter, model: "era", era, date });

/**
 * Every preset is a worked case whose result a real run of the library decided.
 * The tests assert each one against the library.
 */
export const ROLLOVER_PRESETS: readonly RolloverPreset[] = [
  {
    id: "navic-built-2020",
    label: "NavIC receiver built in 2020, checked in 2026",
    description:
      "A receiver whose firmware counts from 1 January 2020 reads the right date in October 2026. It goes wrong one pass of the 10-bit counter after its build date.",
    state: built("IRN-LNAV", "2020-01-01T00:00:00Z", "2026-10-15T00:00:00Z"),
  },
  {
    id: "navic-built-2020-after-wrap",
    label: "The same receiver, checked in 2040",
    description:
      "The same firmware after its window has ended: it reports a date 7168 days early, which is 1024 weeks.",
    state: built("IRN-LNAV", "2020-01-01T00:00:00Z", "2040-01-01T00:00:00Z"),
  },
  {
    id: "qzss-built-2005",
    label: "QZS receiver built in 2005, checked in 2026",
    description:
      "Firmware built in mid 2005 for the 10-bit counter went wrong one pass after its build date, before the check date, so it already reports a date about 20 years early.",
    state: built("QZS-LNAV", "2005-06-01T00:00:00Z", "2026-10-15T00:00:00Z"),
  },
  {
    id: "galileo-built-2024",
    label: "Galileo receiver built in 2024",
    description:
      "Galileo's 12-bit counter is four times as long, so firmware built in 2024 stays right until 2102.",
    state: built("GAL", "2024-01-01T00:00:00Z", "2026-10-15T00:00:00Z"),
  },
  {
    id: "beidou-built-2024",
    label: "BDT receiver built in 2024",
    description:
      "BDT counts weeks on a 13-bit counter, so firmware built in 2024 stays right for over a century.",
    state: built("BDT", "2024-01-01T00:00:00Z", "2026-10-15T00:00:00Z"),
  },
  {
    id: "navic-fixed-era",
    label: "NavIC receiver fixed on era 1",
    description:
      "Firmware that always assumes era 1 of the 10-bit counter reads the right date until that era ends.",
    state: fixed("IRN-LNAV", "1", "2026-10-15T00:00:00Z"),
  },
  {
    id: "navic-fixed-era-after-2038",
    label: "The same receiver, checked in 2039",
    description:
      "After era 1 ends the same firmware reports a date 7168 days early.",
    state: fixed("IRN-LNAV", "1", "2039-01-01T00:00:00Z"),
  },
  {
    id: "galileo-fixed-first-wrap",
    label: "Galileo receiver fixed on era 0, after the first wrap",
    description:
      "Galileo's 12-bit counter wraps for the first time in 2078. Firmware fixed on era 0 then reports a date a little under 79 years early.",
    state: fixed("GAL", "0", "2078-03-01T00:00:00Z"),
  },
  {
    id: "gps-lnav-fixed-era",
    label: "GPS-LNAV receiver fixed on era 2",
    description:
      "Firmware fixed on era 2 of the 10-bit GPS counter reads the right date until the next wrap in 2038.",
    state: fixed("GPS-LNAV", "2", "2026-10-15T00:00:00Z"),
  },
  {
    id: "firmware-ahead",
    label: "QZS receiver fixed on an era that has not begun",
    description:
      "Firmware fixed on era 3 is a pass ahead of the clock, so it reports a date 7168 days late.",
    state: fixed("QZS-LNAV", "3", "2026-10-15T00:00:00Z"),
  },
  {
    id: "today",
    label: "Galileo receiver built in 2024, today",
    description:
      "The same Galileo check against your own clock, counting down live.",
    state: {
      ...BASE,
      counter: "GAL",
      pivot: "2024-01-01T00:00:00Z",
      nowMode: "today",
    },
  },
];

export const DEFAULT_PRESET = ROLLOVER_PRESETS[0]!;

/** The fields the state reads, for matching a preset and writing a permalink. */
function usedFields(s: RolloverState): string[] {
  const t = (v: string) => v.trim();
  return [
    s.counter,
    s.model,
    s.model === "pivot" ? t(s.pivot) : t(s.era),
    s.nowMode,
    s.nowMode === "date" ? t(s.date) : "",
  ];
}

/** The preset whose controls match `state`, trimmed, or `custom`. */
export function matchPreset(state: RolloverState): string {
  const mine = usedFields(state).join("\u0000");
  const hit = ROLLOVER_PRESETS.find(
    (p) => usedFields(p.state).join("\u0000") === mine,
  );
  return hit ? hit.id : CUSTOM_PRESET_ID;
}

export function presetState(preset: RolloverPreset): RolloverState {
  return { ...preset.state };
}

// ---------------------------------------------------------------------------
// Permalink and seed
// ---------------------------------------------------------------------------

const KEYS = [
  "preset",
  "counter",
  "firmwareNotBefore",
  "firmwareEra",
  "date",
] as const;

const isText = (v: unknown): v is string => typeof v === "string";

/** A number or a string as text; anything else as `""`. */
function textOf(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

/** Whether `args` carries anything the widget can seed from. */
export function isSeeded(args: GnssRolloverCheckerArgs | undefined): boolean {
  return args !== undefined && KEYS.some((k) => k in args && args[k] !== "");
}

/**
 * The state a seed describes: a preset (`preset`), then any key that differs
 * from it. A seed with no `date` and no preset checks today; a `date` pins the
 * check. A seed that names a build date uses it, else one that names an era.
 */
export function readArgs(args: GnssRolloverCheckerArgs): RolloverState {
  const named = ROLLOVER_PRESETS.find((p) => p.id === args["preset"]);
  const state: RolloverState = { ...(named ?? DEFAULT_PRESET).state };
  if (named === undefined) state.nowMode = "today";

  const counter = args["counter"];
  if (
    isText(counter) &&
    (GNSS_WEEK_COUNTERS as readonly string[]).includes(counter)
  ) {
    state.counter = counter as GnssWeekCounter;
  }
  const pivot = textOf(args["firmwareNotBefore"]);
  const era = textOf(args["firmwareEra"]);
  if (pivot !== "") {
    state.model = "pivot";
    state.pivot = pivot.slice(0, MAX_VALUE_LENGTH);
  } else if (era !== "") {
    state.model = "era";
    state.era = era.slice(0, MAX_VALUE_LENGTH);
  }
  const date = textOf(args["date"]);
  if (date !== "") {
    state.nowMode = "date";
    state.date = date.slice(0, MAX_VALUE_LENGTH);
  }
  return state;
}

/**
 * The permalink keys for `state`: `preset` alone when it is exactly a preset,
 * else the counter, the firmware key its model uses and, when the check is
 * pinned, the date. Every value is a string, because `seedFromLocation` keeps
 * strings.
 */
export function permalinkOf(state: RolloverState): Record<string, string> {
  const id = matchPreset(state);
  if (id !== CUSTOM_PRESET_ID) return { preset: id };
  const t = (v: string) => v.trim().slice(0, MAX_VALUE_LENGTH);
  const out: Record<string, string> = { counter: state.counter };
  if (state.model === "pivot") out["firmwareNotBefore"] = t(state.pivot);
  else out["firmwareEra"] = t(state.era);
  if (state.nowMode === "date") out["date"] = t(state.date);
  return out;
}

// ---------------------------------------------------------------------------
// Words for a duration the library returned
// ---------------------------------------------------------------------------

export interface Span {
  negative: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/** An ISO 8601 duration of days, hours, minutes and seconds, as numbers.
 *  `null` for any other shape. */
export function parseSpan(duration: string): Span | null {
  const m =
    /^(-?)P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(
      duration,
    );
  if (m === null || duration === "P" || duration.endsWith("T")) return null;
  return {
    negative: m[1] === "-",
    days: Number(m[2] ?? 0),
    hours: Number(m[3] ?? 0),
    minutes: Number(m[4] ?? 0),
    seconds: Number(m[5] ?? 0),
  };
}

/** "4419 days 23 h 59 min 42 s": the span's non-zero parts, largest first. */
export function spanText(span: Span): string {
  const parts: string[] = [];
  if (span.days > 0)
    parts.push(`${span.days} ${span.days === 1 ? "day" : "days"}`);
  if (span.hours > 0) parts.push(`${span.hours} h`);
  if (span.minutes > 0) parts.push(`${span.minutes} min`);
  if (span.seconds > 0) parts.push(`${span.seconds} s`);
  return parts.length === 0 ? "0 s" : parts.join(" ");
}

/** "4419 days": the whole days of a span, for the table. */
export function wholeDaysText(span: Span): string {
  return `${span.days} ${span.days === 1 ? "day" : "days"}`;
}

// ---------------------------------------------------------------------------
// Sentences
// ---------------------------------------------------------------------------

const SENTENCES = {
  era: "The era is a whole number from 0.",
  pivot: "The build date is not an ISO 8601 instant.",
  date: "This is not an ISO 8601 instant with an offset or Z.",
  secondSixty: "Pick a date outside an inserted second.",
  beyond: "The firmware's window runs past the year 9999.",
} as const;

export const ROLLOVER_SENTENCES = SENTENCES;

export const EMPTY_TEXTS = {
  pivot: "Type the build date to check a receiver.",
  era: "Type the era the firmware assumes.",
  date: "Type a date to check.",
} as const;

/** The sentence for a build date before the counter's first week. */
export function pivotBeforeText(firstInstant: string): string {
  return `The build date is before the counter's first week, which starts at ${firstInstant}.`;
}

// ---------------------------------------------------------------------------
// Reading the library
// ---------------------------------------------------------------------------

/** One counter in the table of next wraps. */
export interface WrapRow {
  counter: GnssWeekCounter;
  /** "weeks below 1024". */
  width: string;
  nextWrap: string;
  /** Whole days left, "4419 days". */
  left: string;
  /** Among the counters whose next wrap is the soonest. */
  soonest: boolean;
  /** The receiver's own counter. */
  yours: boolean;
  /** The library gave no reading on this counter at the check date. */
  none: boolean;
}

/** A mark on the window strip: an instant, its place and its words. */
export interface Mark {
  key: "start" | "wrap" | "wrong" | "check" | "today";
  label: string;
  at: string;
  /** 0 to 100 along the window, or `null` when outside it. */
  pos: number | null;
}

export interface Strip {
  start: string;
  end: string;
  wrongFrom: string;
  /**
   * Where the firmware's window sits on the timeline, as shares of it. They are
   * not clamped: a window can start before the timeline or run past it, and the
   * drawing clips to it.
   */
  span: { from: number; wrong: number; end: number };
  /** The stretch of fuse still to burn, from the check date (or the window's
   *  start) to the wrong-from date; `null` once it is past. */
  fuse: { from: number; to: number } | null;
  marks: Mark[];
}

// ---------------------------------------------------------------------------
// The fuse timeline: one track per counter
// ---------------------------------------------------------------------------

/** The timeline runs from before the first satellite week to past the last
 *  first wrap of any counter. These two instants are drawing, not data. */
export const FUSE_AXIS_START = "1980-01-01T00:00:00Z";
export const FUSE_AXIS_END = "2170-01-01T00:00:00Z";

/** A wrap of one counter on its track. `next` is the first one after the
 *  check instant; `past` ones have gone. */
export interface FuseWrap {
  at: string;
  pos: number;
  state: "past" | "next" | "later";
}

export interface FuseTrack {
  counter: GnssWeekCounter;
  /** "weeks below 1024". */
  width: string;
  /** Where the counter's first week starts, as a share of the timeline. */
  born: number;
  /** The wraps from era 1 on, inside the timeline. */
  wraps: FuseWrap[];
  /** The receiver's own counter. */
  yours: boolean;
}

/** Counters of one width, drawn together. */
export interface FuseGroup {
  bits: number;
  label: string;
  tracks: FuseTrack[];
}

export interface Fuse {
  groups: FuseGroup[];
  /** The reader's clock as a share of the timeline, or `null` outside it. */
  today: number | null;
}

/** A year label on the timeline's axis. */
export interface FuseYear {
  year: number;
  pos: number;
  major: boolean;
}

/** The share, 0 to 100, an instant is along the timeline. Unclamped. */
export function axisPos(instant: string): number | null {
  const a = toEpochMs(FUSE_AXIS_START);
  const b = toEpochMs(FUSE_AXIS_END);
  const x = toEpochMs(instant);
  if (Number.isNaN(x)) return null;
  return ((x - a) / (b - a)) * 100;
}

const inAxis = (pos: number | null): number | null =>
  pos === null || pos < 0 || pos > 100 ? null : pos;

/** The axis's year labels, every 20 years; every other label is "major" and
 *  survives on a narrow screen. */
export function fuseYears(): FuseYear[] {
  const out: FuseYear[] = [];
  for (let year = 1980, i = 0; year <= 2160; year += 20, i++) {
    out.push({
      year,
      pos: axisPos(`${year}-01-01T00:00:00Z`) ?? 0,
      major: i % 2 === 0,
    });
  }
  return out;
}

interface FuseLayout {
  bits: number;
  label: string;
  tracks: {
    counter: GnssWeekCounter;
    width: string;
    born: number;
    wraps: { at: string; pos: number; ms: number }[];
  }[];
}

const FUSE_LAYOUTS = new WeakMap<GnssLib, FuseLayout[]>();

/**
 * The wraps of every counter, grouped by width, asked of the library once:
 * `gnssWeekToUtc(counter, 0, 0, era)` for each era whose start falls inside the
 * timeline. None of it depends on the check date.
 */
function fuseLayout(lib: GnssLib): FuseLayout[] {
  const hit = FUSE_LAYOUTS.get(lib);
  if (hit !== undefined) return hit;
  const end = toEpochMs(FUSE_AXIS_END);
  const byBits = new Map<number, FuseLayout>();
  for (const counter of GNSS_WEEK_COUNTERS) {
    const refused = firstRefusedWeek(lib, counter);
    const bits = Math.round(Math.log2(refused));
    const wraps: { at: string; pos: number; ms: number }[] = [];
    for (let era = 1; era < 80; era++) {
      const at = eraStart(lib, counter, era);
      const ms = toEpochMs(at);
      if (at === "" || Number.isNaN(ms) || ms >= end) break;
      wraps.push({ at, pos: axisPos(at) ?? 0, ms });
    }
    const group = byBits.get(bits) ?? {
      bits,
      label: `${bits}-bit counters, weeks below ${refused}`,
      tracks: [],
    };
    group.tracks.push({
      counter,
      width: `weeks below ${refused}`,
      born: Math.max(0, axisPos(eraStart(lib, counter, 0)) ?? 0),
      wraps,
    });
    byBits.set(bits, group);
  }
  const layout = [...byBits.values()].sort((a, b) => a.bits - b.bits);
  FUSE_LAYOUTS.set(lib, layout);
  return layout;
}

/** The timeline for a check instant: each track's wraps marked past, next or later. */
function buildFuse(
  lib: GnssLib,
  rows: WrapRow[],
  at: string,
  nowIso: string,
  yours: GnssWeekCounter,
): Fuse {
  const atMs = toEpochMs(at);
  const nextOf = new Map(
    rows.map((r) => [r.counter, r.none ? "" : r.nextWrap]),
  );
  return {
    groups: fuseLayout(lib).map((g) => ({
      bits: g.bits,
      label: g.label,
      tracks: g.tracks.map((t) => {
        const next = nextOf.get(t.counter) ?? "";
        return {
          counter: t.counter,
          width: t.width,
          born: t.born,
          yours: t.counter === yours,
          wraps: t.wraps.map((w) => ({
            at: w.at,
            pos: w.pos,
            state: w.ms <= atMs ? "past" : w.at === next ? "next" : "later",
          })),
        };
      }),
    })),
    today: inAxis(axisPos(nowIso)),
  };
}

/** The countdown as numbers, for the large readout. */
export interface Countdown {
  past: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export interface RolloverRead {
  state: RolloverState;
  /** `ok`, `empty` (a form with nothing to ask) or `sentinel` (the library gave nothing). */
  status: "ok" | "empty" | "sentinel";
  /** The one plain sentence that says why the library gave nothing. */
  failure: string | null;
  /** The words an empty form shows. */
  emptyText: string | null;
  /** The check instant the table and the receiver were read at. */
  at: string | null;
  rows: WrapRow[];
  reported: string | null;
  /** The week and time of week the counter broadcasts at the check instant. */
  broadcast: { week: number; timeOfWeekSeconds: number } | null;
  verdict: "right" | "early" | "late" | null;
  /** "the right date", "a date 7168 days early". */
  verdictText: string;
  wrongFrom: string | null;
  /** The countdown: "4419 days 23 h 59 min 42 s", or "past by 7168 days". */
  left: string | null;
  /** The rolling row's words. */
  rolling: string;
  strip: Strip | null;
  /** The fuse timeline: every counter's wraps, whenever the check instant is known. */
  fuse: Fuse | null;
  /** The countdown in parts, or `null` while there is none. */
  countdown: Countdown | null;
  plates: PlateSpec[];
  /** The calls behind the receiver, then behind the table, in the order made. */
  calls: { reading: EdiCall[]; counters: EdiCall[] };
}

const PLATE_ROLES = {
  reports: "hero-reports",
  wrong: "hero-wrong-from",
  left: "hero-left",
} as const;

/** The three plates. `null` draws them empty. */
export function platesOf(
  parts: {
    reported: string;
    verdictText: string;
    wrongFrom: string;
    wrongLine: string;
    left: string;
    leftLine: string;
  } | null,
): PlateSpec[] {
  const none = parts === null;
  return [
    {
      role: PLATE_ROLES.reports,
      caption: "The receiver reports",
      value: none ? null : parts.reported,
      lines: [none ? "" : parts.verdictText],
      series: 1,
    },
    {
      role: PLATE_ROLES.wrong,
      caption: "Wrong from",
      value: none ? null : parts.wrongFrom,
      lines: [none ? "" : parts.wrongLine],
      quiet: true,
    },
    {
      role: PLATE_ROLES.left,
      caption: "Time left",
      value: none ? null : parts.left,
      lines: [none ? "" : parts.leftLine],
      quiet: true,
    },
  ];
}

/** The lines a plate can show, for the holds. */
export function plateLines(): string[] {
  return [
    "the right date",
    "a date 49751 days 23 h 59 min 56 s early",
    "one counter period after the build date's reading",
    "until it reports an early date",
    "since it began reporting an early date",
  ];
}

/** `^\d+$` as a safe integer. */
export const wholeNumber = (text: string): number | null => {
  const t = text.trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isSafeInteger(n) ? n : null;
};

function blankRead(state: RolloverState): RolloverRead {
  return {
    state,
    status: "ok",
    failure: null,
    emptyText: null,
    at: null,
    rows: GNSS_WEEK_COUNTERS.map((counter) => ({
      counter,
      width: "",
      nextWrap: "",
      left: "",
      soonest: false,
      yours: counter === state.counter,
      none: true,
    })),
    reported: null,
    broadcast: null,
    verdict: null,
    verdictText: "",
    wrongFrom: null,
    left: null,
    rolling: "",
    strip: null,
    fuse: null,
    countdown: null,
    plates: platesOf(null),
    calls: { reading: [], counters: [] },
  };
}

/**
 * Read the library for `state`. `nowIso` is the reader's clock, a UTC instant
 * to the second; it is used only in Today mode, and the pure code never reads a
 * clock itself.
 */
export function readRollover(
  lib: GnssLib,
  state: RolloverState,
  nowIso: string,
): RolloverRead {
  const read = blankRead(state);
  const reading = read.calls.reading;
  const counters = read.calls.counters;
  const call = <F extends keyof GnssLib & string>(
    into: EdiCall[],
    fn: F,
    ...args: Parameters<GnssLib[F]>
  ): ReturnType<GnssLib[F]> => {
    const c = runCall(lib, fn, ...args);
    into.push(c);
    return c.result as ReturnType<GnssLib[F]>;
  };
  const fail = (sentence: string): RolloverRead => {
    read.status = "sentinel";
    read.failure = sentence;
    return read;
  };
  const empty = (text: string): RolloverRead => {
    read.status = "empty";
    read.emptyText = text;
    return read;
  };

  // 1. The check instant.
  let at: string;
  if (state.nowMode === "today") {
    at = nowIso;
  } else {
    at = state.date.trim();
    if (at === "") return empty(EMPTY_TEXTS.date);
    if (lib.hasSecond60(at)) return fail(SENTENCES.secondSixty);
    if (!lib.isValidInstant(at)) return fail(SENTENCES.date);
  }
  read.at = at;

  // 2. Every counter's next wrap, at the check instant.
  const firstWrap: string[] = [];
  read.rows = GNSS_WEEK_COUNTERS.map((counter) => {
    const row: WrapRow = {
      counter,
      width: `weeks below ${firstRefusedWeek(lib, counter)}`,
      nextWrap: "",
      left: "",
      soonest: false,
      yours: counter === state.counter,
      none: true,
    };
    const here = call(counters, "utcToGnssWeek", counter, at);
    if (here === null) return row;
    const next = call(counters, "gnssWeekToUtc", counter, 0, 0, here.era + 1);
    if (next === "") return row;
    const span = parseSpan(
      call(counters, "diffUtcAsDuration", at, next, "days"),
    );
    row.nextWrap = next;
    row.left = span === null ? "" : wholeDaysText(span);
    row.none = false;
    firstWrap.push(next);
    return row;
  });
  // The soonest wrap is the least of the library's own fixed-width instants.
  const soonest = [...firstWrap].sort()[0];
  for (const row of read.rows)
    row.soonest = !row.none && row.nextWrap === soonest;

  read.fuse = buildFuse(lib, read.rows, at, nowIso, state.counter);

  // 3. The firmware.
  const counter = state.counter;
  let firmware: RolloverEra;
  let pivot = "";
  let era = 0;
  if (state.model === "era") {
    if (state.era.trim() === "") return empty(EMPTY_TEXTS.era);
    const n = wholeNumber(state.era);
    if (n === null) return fail(SENTENCES.era);
    era = n;
    firmware = n;
  } else {
    pivot = state.pivot.trim();
    if (pivot === "") return empty(EMPTY_TEXTS.pivot);
    if (!lib.isValidInstant(pivot)) return fail(SENTENCES.pivot);
    firmware = { notBefore: pivot };
  }

  // 4. The true reading, and what the firmware makes of it.
  const first = eraStart(lib, counter, 0);
  const truth = call(reading, "utcToGnssWeek", counter, at);
  if (truth === null) return fail(beforeFirstWeekText(first));
  const reported = call(
    reading,
    "gnssWeekToUtc",
    counter,
    truth.week,
    truth.timeOfWeekSeconds,
    firmware,
  );

  // 5. The firmware's window, and the date it goes wrong.
  let start: string;
  let wrongFrom: string;
  let end: string;
  let wrongLine: string;
  let wrapEras: number[] = [];
  if (state.model === "pivot") {
    const own = call(reading, "utcToGnssWeek", counter, pivot);
    if (own === null) return fail(pivotBeforeText(first));
    start = pivot;
    wrongFrom = call(
      reading,
      "gnssWeekToUtc",
      counter,
      own.week,
      own.timeOfWeekSeconds,
      own.era + 1,
    );
    end = call(
      reading,
      "gnssWeekToUtc",
      counter,
      own.week,
      own.timeOfWeekSeconds,
      own.era + 2,
    );
    wrongLine = "the build date's reading, one era on";
    wrapEras = [own.era + 1, own.era + 2];
  } else {
    start = call(reading, "gnssWeekToUtc", counter, 0, 0, era);
    wrongFrom = call(reading, "gnssWeekToUtc", counter, 0, 0, era + 1);
    end = call(reading, "gnssWeekToUtc", counter, 0, 0, era + 2);
    wrongLine = `the end of era ${era}`;
  }
  if (reported === "" || start === "" || wrongFrom === "" || end === "") {
    return fail(SENTENCES.beyond);
  }

  // 6. The verdict.
  const judge = (
    result: string,
  ): { kind: "right" | "early" | "late"; text: string } => {
    if (call(reading, "areUtcEqual", result, at)) {
      return { kind: "right", text: RIGHT_DATE_TEXT };
    }
    const span = parseSpan(
      call(reading, "diffUtcAsDuration", at, result, "days"),
    );
    if (span === null) return { kind: "right", text: "" };
    const kind = span.negative ? "early" : "late";
    return {
      kind,
      text: `a date ${spanText({ ...span, negative: false })} ${kind}`,
    };
  };
  const verdict = judge(reported);
  read.reported = reported;
  read.broadcast = {
    week: truth.week,
    timeOfWeekSeconds: truth.timeOfWeekSeconds,
  };
  read.verdict = verdict.kind;
  read.verdictText = verdict.text;
  read.wrongFrom = wrongFrom;

  // 7. The countdown, from the check instant to the date it goes wrong.
  const toGo = parseSpan(
    call(reading, "diffUtcAsDuration", at, wrongFrom, "days"),
  );
  let leftLine = "until it reports an early date";
  if (toGo === null) {
    read.left = null;
  } else {
    const { negative, ...parts } = toGo;
    read.countdown = { past: negative, ...parts };
    if (negative) {
      read.left = `past by ${spanText({ ...toGo, negative: false })}`;
      leftLine = "since it began reporting an early date";
    } else {
      read.left = spanText(toGo);
    }
  }

  // 8. The rolling receiver, which only the reader's own clock can pin.
  if (state.nowMode === "today") {
    const rolled = call(
      reading,
      "gnssWeekToUtc",
      counter,
      truth.week,
      truth.timeOfWeekSeconds,
      "rolling",
    );
    if (rolled === "") read.rolling = NO_RESULT_TEXT;
    else {
      const r = judge(rolled);
      read.rolling = `rolling reads ${rolled}, ${r.text}`;
    }
  } else {
    read.rolling = ROLLING_DATE_TEXT;
  }

  // 9. The strip: the window on its counter's track, and the marks.
  const marks: Mark[] = [];
  const mark = (key: Mark["key"], label: string, instant: string) =>
    marks.push({ key, label, at: instant, pos: inAxis(axisPos(instant)) });
  mark(
    "start",
    state.model === "pivot" ? "build date" : `era ${era} starts`,
    start,
  );
  if (state.model === "pivot") {
    for (const wrap of wrapEras.map((e) => eraStart(lib, counter, e))) {
      if (
        wrap !== "" &&
        wrap !== wrongFrom &&
        toEpochMs(wrap) > toEpochMs(start) &&
        toEpochMs(wrap) < toEpochMs(end)
      ) {
        mark("wrap", "the counter wraps", wrap);
      }
    }
  }
  mark(
    "wrong",
    state.model === "pivot" ? "wrong from" : "the counter wraps, wrong from",
    wrongFrom,
  );
  mark("check", state.nowMode === "today" ? "today" : "check date", at);
  const span = {
    from: axisPos(start) ?? 0,
    wrong: axisPos(wrongFrom) ?? 0,
    end: axisPos(end) ?? 0,
  };
  const checkPos = axisPos(at) ?? 0;
  read.strip = {
    start,
    end,
    wrongFrom,
    span,
    fuse:
      checkPos < span.wrong
        ? { from: Math.max(checkPos, span.from), to: span.wrong }
        : null,
    marks,
  };

  read.plates = platesOf({
    reported,
    verdictText: verdict.text,
    wrongFrom,
    wrongLine,
    left: read.left ?? "",
    leftLine,
  });
  if (read.left === null) read.plates[2]!.value = null;
  return read;
}

// ---------------------------------------------------------------------------
// The slider
// ---------------------------------------------------------------------------

/** The slider's last day: whole days from the window's start to its end. */
export function windowDays(lib: GnssLib, read: RolloverRead): number | null {
  if (read.strip === null) return null;
  const span = parseSpan(
    lib.diffUtcAsDuration(read.strip.start, read.strip.end, "days"),
  );
  return span === null ? null : span.days;
}

/** The slider's day for a date, when the date is a whole number of days after
 *  the window's start; `null` otherwise. */
export function dayOfDate(
  lib: GnssLib,
  read: RolloverRead,
  date: string,
): number | null {
  if (read.strip === null || !lib.isValidInstant(date.trim())) return null;
  const span = parseSpan(
    lib.diffUtcAsDuration(read.strip.start, date.trim(), "days"),
  );
  if (span === null || span.negative) return null;
  if (span.hours + span.minutes + span.seconds !== 0) return null;
  return span.days;
}

/** The date `day` whole days after the window's start. */
export function dateOfDay(
  lib: GnssLib,
  read: RolloverRead,
  day: number,
): string {
  return read.strip === null ? "" : lib.addUtc(read.strip.start, { days: day });
}

// ---------------------------------------------------------------------------
// Words for the drawing
// ---------------------------------------------------------------------------

/** One sentence per mark, for the drawing's hidden list. */
export function markSentence(m: Mark): string {
  const where = m.pos === null ? " (outside the timeline drawn)" : "";
  return `${m.label}: ${m.at}${where}`;
}

/** The timeline's accessible name: the reading in words. */
export function stripAria(read: RolloverRead): string {
  const s = read.strip;
  if (s === null) return "No window to draw";
  const next = read.rows.find((r) => r.yours && !r.none)?.nextWrap;
  return (
    `Fuse timeline of the ${read.state.counter} counter against every other counter. ` +
    `The firmware reads right from ${s.start} to ${s.wrongFrom}, then reports one counter period early to ${s.end}. ` +
    (next === undefined ? "" : `This counter next wraps at ${next}. `) +
    `${s.marks.length} marks.`
  );
}

/** The status badge's words: what the receiver reports. */
export function verdictBadgeText(read: RolloverRead): string {
  if (read.status !== "ok" || read.verdict === null) return "";
  return read.verdict === "right"
    ? "Reports the right date"
    : `Reports ${read.verdictText}`;
}

/** The one live sentence for a reading. */
export function summaryText(read: RolloverRead): string {
  if (read.status !== "ok" || read.reported === null) return "";
  return `On ${read.at}, a ${read.state.counter} receiver reports ${read.reported}, ${read.verdictText}. It goes wrong from ${read.wrongFrom}; time left: ${read.left ?? "none"}.`;
}

export { ROLLOVER_NOW_MODES };

// ---------------------------------------------------------------------------
// Links to the other tools
// ---------------------------------------------------------------------------

/** The links row: every era of this reading. */
export const ROLLOVER_LINKS = [
  { role: "link-eras", text: "See every era of this reading" },
] as const;

/**
 * Where the link goes for `read`, or `null` while there is no reading. The
 * decoder gets the counter, the week and time of week the counter broadcasts at
 * the check instant, and the firmware's own form: the build date as
 * `rolloverNotBefore`, or the fixed era as `rolloverEra`.
 */
export function rolloverHandoffs(read: RolloverRead): {
  eras: ToolHandoff | null;
} {
  const { state, broadcast } = read;
  if (read.status !== "ok" || read.reported === null || broadcast === null) {
    return { eras: null };
  }
  const firmware: Record<string, string> =
    state.model === "pivot"
      ? { rolloverNotBefore: state.pivot.trim() }
      : { rolloverEra: String(wholeNumber(state.era) ?? "") };
  return {
    eras: {
      kind: "gnssweek",
      args: {
        mode: "broadcast",
        counter: state.counter,
        week: String(broadcast.week),
        timeOfWeekSeconds: String(broadcast.timeOfWeekSeconds),
        ...firmware,
      },
    },
  };
}
