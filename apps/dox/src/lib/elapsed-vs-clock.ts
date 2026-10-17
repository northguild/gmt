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
 * the count is `leapSecondsBetween`. The only arithmetic here lays out the
 * cells of the rulers (`drawMs`, `rulerModel`), never a shown result.
 *
 * Naming rule: GMT tracks no law, and the text names no body.
 */

import { Temporal } from "@js-temporal/polyfill";
import { runCall, type EdiCall } from "./edi-widgets";
import type { PlateSpec } from "./ledger-widgets";
import type { ToolHandoff } from "./widget-permalink";
import {
  BEFORE_1972_TEXT,
  NOT_INSERTED_TEXT,
  NOT_INSTANT_TEXT,
  NO_OFFSET_TEXT,
  drawMs,
} from "./leap-second-timeline";
import type { TimescaleLib } from "./timescale-lib";
import {
  insertionsBetween,
  lacksOffset,
  secondsText,
} from "./timescale-widgets";

export {
  BEFORE_1972_TEXT,
  NOT_INSERTED_TEXT,
  NOT_INSTANT_TEXT,
  NO_OFFSET_TEXT,
};

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
  if (ends.some((x) => lacksOffset(lib, x))) return NO_OFFSET_TEXT;
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
  if (lacksOffset(lib, bad)) return NO_OFFSET_TEXT;
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

/** The three result plates, in the order of the sum they make: clock difference + leap seconds = seconds that passed. A plate with no result keeps its lines. */
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
      role: "hero-count",
      caption: "Leap seconds between",
      value: read.count === null ? null : String(read.count),
      lines: [`from ${day(state.start)}`, `to ${day(state.end)}`],
      series: 3,
    },
    {
      role: "hero-elapsed",
      caption: "Seconds that passed",
      value: read.elapsed === null ? null : secondsText(read.elapsed),
      lines: ["read through TAI", "counts every second"],
      series: 1,
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

// ---------------------------------------------------------------------------
// The rulers: the clock face above, the seconds that passed below
// ---------------------------------------------------------------------------

/** One second on a ruler: a clock second, or an inserted one. */
export interface RulerCell {
  /** `true` for the inserted second, which the clock face writes `:60`. */
  leap: boolean;
  /** The wall time the clock face shows for it, `23:59:60` for the inserted one. */
  time: string;
  /** The UTC date it falls on. */
  day: string;
  /** Whether the clock face prints `time` on it. */
  label: boolean;
  /** Its count among the seconds that passed, or `null` in a compressed ruler. */
  ordinal: number | null;
  /** The width it asks for, in px; the rulers share it so the rows line up. */
  basis: number;
  /** An inserted second drawn narrow, with no room for its time. */
  compact: boolean;
}

/** A run of consecutive seconds, a break where seconds are left out, or many inserted seconds in one cell. */
export type RulerPiece =
  | { kind: "run"; cells: RulerCell[] }
  | { kind: "break"; px: number; skipped: number }
  | { kind: "many"; count: number };

export interface RulerModel {
  pieces: RulerPiece[];
  /** The clock seconds in the span: what the clock difference counts. */
  clockSeconds: number;
  /** The inserted seconds in the span. */
  leaps: number;
  /** Whether seconds are left out between the first and last runs. */
  compressed: boolean;
}

const SECOND_60 = /(:\d{2}:)60(?=[.,Z+-]|$)/;
const iso = (ms: number): string =>
  Temporal.Instant.fromEpochMilliseconds(ms).toString();
const wall = (ms: number): string => iso(ms).slice(11, 19);
const dayOf = (ms: number): string => iso(ms).slice(0, 10);

/** Basis in px of a cell that carries a time (a stretched inserted second is wider). */
const LABELLED_PX = 66;
const PLAIN_PX = 22;
const COMPACT_LEAP_PX = 34;
const FULL_PX = 64;
const FULL_LEAP_PX = 104;
const FRAME_PAD_PX = 28;
const DEFAULT_WIDTH_PX = 760;

/** How wide a break is: it grows with the log of the seconds it leaves out, so a longer span reads longer. */
function breakPx(skipped: number): number {
  const w = 12 + 3 * (Math.log10(Math.max(skipped, 1)) - 1);
  return Math.round(Math.min(34, Math.max(12, w)));
}

/**
 * What the two rulers draw for `state`, or `null` when an endpoint cannot be
 * placed. Placement only, never a shown result: the counts come from `read`.
 *
 * Both rulers show one cell per second from the earlier endpoint to the later.
 * A short span shows every second. A longer one shows the seconds next to each
 * end with a break between, and keeps each inserted second as its own cell
 * (with the second before it); when the width cannot hold them all, one cell
 * says how many were left out. `width` is the frame's pixel width, `0` if
 * unknown.
 */
export function rulerModel(
  state: ElapsedState,
  read: ElapsedRead,
  width: number,
): RulerModel | null {
  const a = drawMs(state.start);
  const b = drawMs(state.end);
  if (a === null || b === null) return null;
  const sixty = (t: string) => SECOND_60.test(t.trim());
  const keyA = a + (sixty(state.start) ? 0.5 : 0);
  const keyB = b + (sixty(state.end) ? 0.5 : 0);
  const [early, late, earlyIs60, lateIs60] =
    keyA <= keyB
      ? [a, b, sixty(state.start), sixty(state.end)]
      : [b, a, sixty(state.end), sixty(state.start)];
  // An endpoint written as a second 60 is placed on its own 59, one second back.
  const low = Math.floor(early / 1000) * 1000 + (earlyIs60 ? 1000 : 0);
  const high = Math.floor(late / 1000) * 1000 + (lateIs60 ? 1000 : 0);
  const seconds = Math.max(0, Math.round((high - low) / 1000));

  const leaps = read.counted
    .flatMap((insertion) => {
      const ms = drawMs(insertion);
      return ms === null
        ? []
        : [{ k: Math.round((ms - low) / 1000), day: dayOf(ms), ms }];
    })
    .sort((x, y) => x.k - y.k);
  const total = seconds + leaps.length;
  const strip = Math.max(0, (width || DEFAULT_WIDTH_PX) - FRAME_PAD_PX);

  const second = (idx: number, label: boolean, basis: number): RulerCell => ({
    leap: false,
    time: wall(low + idx * 1000),
    day: dayOf(low + idx * 1000),
    label,
    ordinal: null,
    basis,
    compact: false,
  });
  const leapCell = (l: (typeof leaps)[number], basis: number): RulerCell => ({
    leap: true,
    time: `${wall(l.ms).slice(0, 6)}60`,
    day: l.day,
    label: true,
    ordinal: null,
    basis,
    compact: basis < LABELLED_PX,
  });

  const fullMax = Math.min(16, Math.max(3, Math.floor(strip / FULL_PX)));
  if (total <= fullMax) {
    const cells: RulerCell[] = [];
    const leapAt = (k: number) => leaps.filter((l) => l.k === k);
    for (const l of leapAt(-1)) cells.push(leapCell(l, FULL_LEAP_PX));
    for (let idx = 0; idx < seconds; idx++) {
      cells.push(second(idx, true, FULL_PX));
      for (const l of leapAt(idx)) cells.push(leapCell(l, FULL_LEAP_PX));
    }
    cells.forEach((c, i) => (c.ordinal = i + 1));
    return {
      pieces: cells.length === 0 ? [] : [{ kind: "run", cells }],
      clockSeconds: seconds,
      leaps: leaps.length,
      compressed: false,
    };
  }

  const win = strip >= 340 ? 2 : 1;
  const assemble = (
    withLeaps: boolean,
  ): { pieces: RulerPiece[]; px: number } => {
    const keyed = new Map<number, RulerCell>();
    const put = (idx: number) => {
      if (idx < 0 || idx >= seconds || keyed.has(idx)) return;
      keyed.set(idx, second(idx, false, PLAIN_PX));
    };
    for (let i = 0; i < win; i++) {
      put(i);
      put(seconds - 1 - i);
    }
    if (withLeaps) {
      for (const l of leaps) {
        keyed.set(l.k + 0.5, leapCell(l, COMPACT_LEAP_PX));
      }
    }
    const keys = [...keyed.keys()].sort((x, y) => x - y);
    const pieces: RulerPiece[] = [];
    let run: RulerCell[] = [];
    let px = 0;
    let prev: number | null = null;
    const flush = () => {
      if (run.length === 0) return;
      if (!run[0]!.leap) {
        run[0]!.label = true;
        run[0]!.basis = LABELLED_PX;
      }
      px += run.reduce((n, c) => n + c.basis, 0);
      pieces.push({ kind: "run", cells: run });
      run = [];
    };
    for (const key of keys) {
      if (prev !== null && key - prev > 1) {
        flush();
        const skipped = Math.floor(key) - Math.floor(prev) - 1;
        const brk = breakPx(skipped);
        px += brk;
        pieces.push({ kind: "break", px: brk, skipped });
      }
      run.push(keyed.get(key)!);
      prev = key;
    }
    flush();
    return { pieces, px };
  };

  let built = assemble(true);
  let many = false;
  if (built.px > strip && leaps.length > 0) {
    built = assemble(false);
    many = true;
  }
  let pieces = built.pieces;
  if (many) {
    const firstBreak = pieces.findIndex((p) => p.kind === "break");
    const cell: RulerPiece = { kind: "many", count: leaps.length };
    if (firstBreak === -1) pieces = [...pieces, cell];
    else {
      const brk = pieces[firstBreak]!;
      pieces = [
        ...pieces.slice(0, firstBreak),
        brk,
        cell,
        brk,
        ...pieces.slice(firstBreak + 1),
      ];
    }
  }
  return {
    pieces,
    clockSeconds: seconds,
    leaps: leaps.length,
    compressed: pieces.some((p) => p.kind === "break"),
  };
}

/** Whether both endpoints can be placed on the rulers. */
export function canDrawRulers(state: ElapsedState): boolean {
  return drawMs(state.start) !== null && drawMs(state.end) !== null;
}

/** One call's result as printed, a bigint written with its `n`. */
export function resultText(result: unknown): string {
  return typeof result === "bigint" ? `${result}n` : JSON.stringify(result);
}

/** The results of a group's calls, one per line. */
export function resultsText(calls: readonly EdiCall[]): string {
  return calls.map((c) => resultText(c.result)).join("\n");
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
