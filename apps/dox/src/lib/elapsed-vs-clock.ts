/**
 * Pure helpers for the Elapsed vs. Clock Difference widget (MAR-16).
 *
 * Subtracting two UTC readings gives the clock difference, which counts no
 * inserted second. The seconds that really passed include every one between
 * the two. The tool reads both through the library and sets them side by side.
 *
 * No DOM. Every function that reads the library takes a `TimescaleLib`
 * (`timescale-lib.ts`), loaded by the mount. The widget draws the library's
 * results and computes none: the clock difference is `spanNs` of the two UTC
 * readings, the elapsed time is `spanNs` of their two `toTAI` readings, and
 * the count is `leapSecondsBetween`. The only arithmetic here places marks on
 * the rulers (`drawMs`), never a shown result.
 *
 * Naming rule: GMT tracks no law, and the text names no body.
 */

import { runCall, type EdiCall } from "./edi-widgets";
import type { PlateSpec } from "./ledger-widgets";
import type { ToolHandoff } from "./widget-permalink";
import {
  BEFORE_1972_TEXT,
  NOT_INSERTED_TEXT,
  NOT_INSTANT_TEXT,
  drawMs,
} from "./leap-second-timeline";
import type { TimescaleLib } from "./timescale-lib";
import {
  insertionsBetween,
  secondAfter,
  secondsText,
} from "./timescale-widgets";

export { BEFORE_1972_TEXT, NOT_INSERTED_TEXT, NOT_INSTANT_TEXT };

export const CUSTOM_PRESET_ID = "custom";

/** Why a clock difference cannot be read when an endpoint is a listed second 60. */
export const CLOCK_REFUSES_TEXT =
  "A clock difference cannot place 23:59:60: the span functions, like every function outside the leap-second ones, refuse second 60.";

// ---------------------------------------------------------------------------
// State and seeds
// ---------------------------------------------------------------------------

/** The widget's controls, as strings, which is what the DOM holds. */
export interface ElapsedState {
  start: string;
  end: string;
}

/** Seed arguments: the chat tool's input and a permalink's strings. */
export interface ElapsedVsClockArgs {
  start?: string;
  end?: string;
}

const ARG_KEYS = ["start", "end"] as const;

/** Whether the args name anything, so the widget opens on them and not on a preset. */
export function isSeeded(args: ElapsedVsClockArgs): boolean {
  return ARG_KEYS.some((key) => args[key] !== undefined);
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Seed arguments as control values. A key the seed lacks stays blank. */
export function readArgs(args: ElapsedVsClockArgs): ElapsedState {
  return { start: str(args.start), end: str(args.end) };
}

/** Every non-blank control under its permalink key. Strings only. */
export function permalinkOf(state: ElapsedState): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of ARG_KEYS) {
    const value = state[key].trim();
    if (value !== "") out[key] = value;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

export interface ElapsedPreset extends ElapsedState {
  id: string;
  label: string;
  description: string;
}

/** Each preset is a worked case. The mount test runs each against the library. */
export const ELAPSED_PRESETS: readonly ElapsedPreset[] = [
  {
    id: "across-2016",
    label: "Across the end of 2016",
    description:
      "Two seconds on the clock, from 23:59:59 to 00:00:01, and three seconds that passed, because a second 60 sits between them.",
    start: "2016-12-31T23:59:59Z",
    end: "2017-01-01T00:00:01Z",
  },
  {
    id: "start-is-the-leap-second",
    label: "Starting on the leap second",
    description:
      "The span starts on the inserted second itself. A clock difference cannot place a second 60, but the seconds that passed and the count can still be read.",
    start: "2016-12-31T23:59:60Z",
    end: "2017-01-01T00:00:00Z",
  },
  {
    id: "twenty-four-years",
    label: "Twenty-four years",
    description:
      "Over a long span the clock difference falls short by the number of seconds inserted in it, and the list names each one.",
    start: "2000-01-01T00:00:00Z",
    end: "2024-01-01T00:00:00Z",
  },
  {
    id: "no-insertions",
    label: "No second inserted",
    description:
      "From 2020 to 2024 nothing was inserted, so the clock difference and the seconds that passed are the same number.",
    start: "2020-01-01T00:00:00Z",
    end: "2024-01-01T00:00:00Z",
  },
  {
    id: "backwards",
    label: "Counted backwards",
    description:
      "The same long span read from the later date to the earlier one. Both differences and the count change sign.",
    start: "2024-01-01T00:00:00Z",
    end: "2000-01-01T00:00:00Z",
  },
  {
    id: "not-inserted",
    label: "A second 60 that never happened",
    description:
      "The end of 2017 is written as a second 60, and it is well-formed, but no second was inserted that day, so nothing can be read.",
    start: "2017-12-31T23:59:60Z",
    end: "2018-01-01T00:00:00Z",
  },
  {
    id: "before-1972",
    label: "Starting before 1972",
    description:
      "The clock difference still reads, but before 1972 UTC and TAI did not differ by whole seconds, so the seconds that passed and the count have no answer.",
    start: "1971-01-01T00:00:00Z",
    end: "2024-01-01T00:00:00Z",
  },
];

/** A preset as control values. */
export function presetState(p: ElapsedPreset): ElapsedState {
  return { start: p.start, end: p.end };
}

/** The preset whose controls match `state`, or `custom`. */
export function matchPreset(state: ElapsedState): string {
  const hit = ELAPSED_PRESETS.find(
    (p) => p.start === state.start.trim() && p.end === state.end.trim(),
  );
  return hit ? hit.id : CUSTOM_PRESET_ID;
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/** TAI reads `2017-01-01T00:00:36 TAI`; with `Z` in place of ` TAI` it is an instant. */
function taiAsInstant(tai: string): string {
  return tai.endsWith(" TAI") ? `${tai.slice(0, -4)}Z` : "";
}

export interface ElapsedRead {
  /** `spanNs(start, end)`, or one call when either endpoint is blank. */
  clockCalls: EdiCall[];
  /** `toTAI(start)`, `toTAI(end)` and, when both read, `spanNs` of the two. */
  elapsedCalls: EdiCall[];
  countCalls: EdiCall[];
  /** Nanoseconds, or `null`. */
  clock: bigint | null;
  elapsed: bigint | null;
  count: number | null;
  /** The counted insertions, named. Empty when the count is 0 or `null`. */
  counted: string[];
  clockReason: string;
  elapsedReason: string;
  countReason: string;
}

/** Why the clock difference gives no value: a second 60 or a bad instant. */
function clockReason(lib: TimescaleLib, state: ElapsedState): string {
  const ends = [state.start, state.end];
  if (ends.some((x) => !lib.hasSecond60(x) && !lib.isValidInstant(x))) {
    return NOT_INSTANT_TEXT;
  }
  const sixty = ends.find((x) => lib.hasSecond60(x));
  if (sixty === undefined) return NOT_INSTANT_TEXT;
  return lib.isLeapSecond(sixty) ? CLOCK_REFUSES_TEXT : NOT_INSERTED_TEXT;
}

/** Why TAI gives no value: the first endpoint it cannot read, in a sentence. */
function taiReason(
  lib: TimescaleLib,
  state: ElapsedState,
  tai: string[],
): string {
  const bad = [state.start, state.end].find((_, i) => tai[i] === "");
  if (bad === undefined) return NOT_INSTANT_TEXT;
  if (lib.hasSecond60(bad) && !lib.isLeapSecond(bad)) return NOT_INSERTED_TEXT;
  if (lib.isValidInstant(bad)) return BEFORE_1972_TEXT;
  return NOT_INSTANT_TEXT;
}

const EMPTY_READ: ElapsedRead = {
  clockCalls: [],
  elapsedCalls: [],
  countCalls: [],
  clock: null,
  elapsed: null,
  count: null,
  counted: [],
  clockReason: "",
  elapsedReason: "",
  countReason: "",
};

/** Everything the widget draws and prints for `state`, from the library. */
export function readElapsed(
  lib: TimescaleLib,
  state: ElapsedState,
): ElapsedRead {
  const s: ElapsedState = { start: state.start.trim(), end: state.end.trim() };
  if (s.start === "" || s.end === "") return EMPTY_READ;

  const clockCall = runCall(lib, "spanNs", s.start, s.end);
  const clock = clockCall.result as bigint | null;

  const taiStart = runCall(lib, "toTAI", s.start);
  const taiEnd = runCall(lib, "toTAI", s.end);
  const tai = [taiStart.result as string, taiEnd.result as string];
  const elapsedCalls: EdiCall[] = [taiStart, taiEnd];
  let elapsed: bigint | null = null;
  if (tai[0] !== "" && tai[1] !== "") {
    const span = runCall(
      lib,
      "spanNs",
      taiAsInstant(tai[0]!),
      taiAsInstant(tai[1]!),
    );
    elapsedCalls.push(span);
    elapsed = span.result as bigint | null;
  }

  const countCall = runCall(lib, "leapSecondsBetween", s.start, s.end);
  const count = countCall.result as number | null;
  const taiWhy = taiReason(lib, s, tai);

  return {
    clockCalls: [clockCall],
    elapsedCalls,
    countCalls: [countCall],
    clock,
    elapsed,
    count,
    counted:
      count === null ? [] : insertionsBetween(lib, s.start, s.end, count),
    clockReason: clock === null ? clockReason(lib, s) : "",
    elapsedReason: elapsed === null ? taiWhy : "",
    countReason: count === null ? taiWhy : "",
  };
}

// ---------------------------------------------------------------------------
// Plates and sentences
// ---------------------------------------------------------------------------

/** The three result plates, in order. A plate with no result keeps its lines. */
export function elapsedPlates(
  read: ElapsedRead,
  state: ElapsedState,
): PlateSpec[] {
  const day = (t: string) => t.trim().slice(0, 10);
  return [
    {
      role: "hero-clock",
      caption: "Clock difference",
      value: read.clock === null ? null : secondsText(read.clock),
      lines: ["read as UTC", "counts no inserted second"],
      series: 2,
    },
    {
      role: "hero-elapsed",
      caption: "Seconds that passed",
      value: read.elapsed === null ? null : secondsText(read.elapsed),
      lines: ["read through TAI", "counts every second"],
      series: 1,
    },
    {
      role: "hero-count",
      caption: "Leap seconds between",
      value: read.count === null ? null : String(read.count),
      lines: [`from ${day(state.start)}`, `to ${day(state.end)}`],
      series: 3,
    },
  ];
}

/** The plates before anything is read: three empty plates. */
export function blankPlates(): PlateSpec[] {
  return elapsedPlates(EMPTY_READ, { start: "", end: "" });
}

/** The one sentence a screen reader gets for the whole reading. */
export function summaryText(state: ElapsedState, read: ElapsedRead): string {
  if (read.clockCalls.length === 0)
    return "Give a start and an end to compare.";
  const parts: string[] = [];
  parts.push(
    read.clock === null
      ? `Clock difference: no signal. ${read.clockReason}`
      : `The clock difference is ${secondsText(read.clock)}.`,
  );
  parts.push(
    read.elapsed === null
      ? `Seconds that passed: no signal. ${read.elapsedReason}`
      : `${secondsText(read.elapsed)} passed.`,
  );
  parts.push(
    read.count === null
      ? `Leap seconds between: no signal. ${read.countReason}`
      : `${read.count} leap seconds between ${state.start.trim()} and ${state.end.trim()}.`,
  );
  return parts.join(" ");
}

/** Where the counted seconds sit between the endpoints, as percentages, for drawing. */
export interface RulerMark {
  insertion: string;
  pct: number;
}

/**
 * The ruler's marks: each counted second at its place between the earlier and
 * the later endpoint, or none when an endpoint cannot be placed. A mark sits at
 * the first instant after its inserted second (`secondAfter`), where the clock
 * and the elapsed time part company. Placement only.
 */
export function rulerMarks(
  lib: TimescaleLib,
  state: ElapsedState,
  read: ElapsedRead,
): RulerMark[] {
  const a = drawMs(state.start);
  const b = drawMs(state.end);
  if (a === null || b === null) return [];
  const from = Math.min(a, b);
  const span = Math.max(a, b) - from;
  const marks: RulerMark[] = [];
  for (const insertion of read.counted) {
    const ms = drawMs(secondAfter(lib, insertion)) ?? drawMs(insertion);
    if (ms === null) continue;
    const raw = span === 0 ? 0 : ((ms - from) / span) * 100;
    marks.push({
      insertion,
      pct: Math.round(Math.min(100, Math.max(0, raw)) * 100) / 100,
    });
  }
  return marks;
}

/** Whether both endpoints can be placed on the rulers. */
export function canDrawRulers(state: ElapsedState): boolean {
  return drawMs(state.start) !== null && drawMs(state.end) !== null;
}

/** The results of a group's calls, one per line, a bigint written with its `n`. */
export function resultsText(calls: readonly EdiCall[]): string {
  return calls
    .map((c) =>
      typeof c.result === "bigint" ? `${c.result}n` : JSON.stringify(c.result),
    )
    .join("\n");
}

// ---------------------------------------------------------------------------
// Links to the other tools
// ---------------------------------------------------------------------------

/** The links row: the dates on the timeline, and every clock at the start. */
export const ELAPSED_LINKS = [
  { role: "link-timeline", text: "See these dates on the timeline" },
  { role: "link-clocks", text: "Every clock at the start" },
] as const;

/**
 * Where each link goes, or `null` while the library gave no value for the
 * span: with no clock difference, elapsed time or count there is nothing to
 * send.
 */
export function elapsedHandoffs(
  state: ElapsedState,
  read: ElapsedRead,
): { timeline: ToolHandoff | null; clocks: ToolHandoff | null } {
  const start = state.start.trim();
  const end = state.end.trim();
  const result =
    read.clock !== null || read.elapsed !== null || read.count !== null;
  return {
    timeline:
      result && start !== "" && end !== ""
        ? { kind: "leapline", args: { from: start, to: end } }
        : null,
    clocks:
      result && start !== ""
        ? { kind: "satclock", args: { value: start } }
        : null,
  };
}
