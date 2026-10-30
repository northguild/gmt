/**
 * Pure helpers for the Leap Second Timeline widget (MAR-16).
 *
 * UTC took 27 inserted seconds between 1972 and 2016, none since, and none after
 * continuous UTC begins. The tool draws every inserted second the library lists
 * on one axis, reads TAI - UTC on a date, counts the leap seconds between two
 * dates and says whether a `23:59:60` was really inserted.
 *
 * No DOM. Every function that reads the library takes a
 * `TimescaleLib` (`timescale-lib.ts`), loaded by the mount. The widget draws the
 * library's results and computes none: each inserted second, step, count and
 * verdict is a library call. The only arithmetic here places things on the
 * axis (milliseconds from `convertUtcToUnix`, used for drawing and for the slider's
 * days, never shown as a result).
 *
 * Naming rule: GMT tracks no law, and the text names no body. The only dates
 * the site holds are the two constants in `timescale-widgets.ts`.
 */

import { Temporal } from "@js-temporal/polyfill";
import { convertUnixToUtc } from "@northguild/gmt/unix/convert";
import { convertUtcToUnix } from "@northguild/gmt/utc/convert";
import { runCall, type EdiCall } from "./edi-widgets";
import type { PlateSpec } from "./ledger-widgets";
import type { ToolHandoff } from "./widget-permalink";
import type { TimescaleLib } from "./timescale-lib";
import {
  CONTINUOUS_UTC_FROM,
  INTEGER_UTC_FROM,
  insertions,
  insertionsBetween,
  lacksOffset,
  secondAfter,
} from "./timescale-widgets";

export const CUSTOM_PRESET_ID = "custom";

/** What the reader sees when a rule of the library gives no value for a date. */
export const BEFORE_1972_TEXT =
  "UTC has differed from TAI by whole seconds only since 1972-01-01.";
export const NOT_INSTANT_TEXT = "This is not an ISO 8601 instant.";
export const NO_OFFSET_TEXT =
  "This is not an ISO 8601 instant with an offset or Z.";
export const NOT_INSERTED_TEXT =
  "No leap second was inserted at the end of that day.";
/** Shown in the next-insertion line when the library lists none later. */
const NONE_AFTER_TEXT = "none after this date";

export const VERDICT_INSERTED = "inserted: a real leap second";
export const VERDICT_NOT_INSERTED =
  "well-formed, but nothing was inserted at the end of that day";
export const VERDICT_VALID_INSTANT = "a valid instant, but not a second 60";

// ---------------------------------------------------------------------------
// State and seeds
// ---------------------------------------------------------------------------

/** The widget's controls, as strings, which is what the DOM holds. */
export interface TimelineState {
  date: string;
  check: string;
  from: string;
  to: string;
}

/** Seed arguments: the chat tool's input and a permalink's strings. */
export interface LeapSecondTimelineArgs {
  date?: string;
  check?: string;
  from?: string;
  to?: string;
}

const ARG_KEYS = ["date", "check", "from", "to"] as const;

/** Whether the args name anything, so the widget opens on them and not on a preset. */
export function isSeeded(args: LeapSecondTimelineArgs): boolean {
  return ARG_KEYS.some((key) => args[key] !== undefined);
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Seed arguments as control values. A key the seed lacks stays blank. */
export function readArgs(args: LeapSecondTimelineArgs): TimelineState {
  return {
    date: str(args.date),
    check: str(args.check),
    from: str(args.from),
    to: str(args.to),
  };
}

/** Every non-blank control under its permalink key. Strings only. */
export function permalinkOf(state: TimelineState): Record<string, string> {
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

interface TimelinePreset extends TimelineState {
  id: string;
  label: string;
  description: string;
}

/**
 * Each preset is a worked case of the timescale functions. A blank field means
 * that reading is left out, and its call is not made. The mount test runs each
 * against the library.
 */
export const TIMELINE_PRESETS: readonly TimelinePreset[] = [
  {
    id: "from-2000",
    label: "Since 2000",
    description:
      "Five seconds were inserted between 2000 and 2024. TAI - UTC was 32 s on the first day of 2000, and the last second 60 was at the end of 2016.",
    date: "2000-01-01T00:00:00Z",
    check: "2016-12-31T23:59:60Z",
    from: "2000-01-01T00:00:00Z",
    to: "2024-01-01T00:00:00Z",
  },
  {
    id: "last-insertion",
    label: "Just before the last insertion",
    description:
      "On the first day of 2016 the offset is 36 s, and the library knows the next inserted second is at the end of that year.",
    date: "2016-01-01T00:00:00Z",
    check: "",
    from: "",
    to: "",
  },
  {
    id: "after-the-table",
    label: "After the last insertion",
    description:
      "From 2017 the offset has stayed at 37 s. The library lists no later insertion, which is a real answer and not a failure.",
    date: "2024-01-01T00:00:00Z",
    check: "",
    from: "",
    to: "",
  },
  {
    id: "far-future",
    label: "Far in the future",
    description:
      "A date far past the axis. The library lists no insertion after 2016, so the offset is the same 37 s.",
    date: "2100-01-01T00:00:00Z",
    check: "",
    from: "",
    to: "",
  },
  {
    id: "not-inserted",
    label: "A second 60 that never happened",
    description:
      "The end of 2017 is written as a second 60, and it is well-formed, but no second was inserted that day.",
    date: "",
    check: "2017-12-31T23:59:60Z",
    from: "",
    to: "",
  },
  {
    id: "offset-spelling",
    label: "A second 60 with an offset",
    description:
      "The same real second at the end of 2008 UTC, written for a clock nine hours ahead. The library reads it back to the UTC day.",
    date: "",
    check: "2009-01-01T08:59:60+09:00",
    from: "",
    to: "",
  },
  {
    id: "backwards",
    label: "Counted backwards",
    description:
      "The same span read from the later date to the earlier one gives the same count with a minus sign.",
    date: "",
    check: "",
    from: "2024-01-01T00:00:00Z",
    to: "2000-01-01T00:00:00Z",
  },
  {
    id: "before-1972",
    label: "Before 1972",
    description:
      "Before 1972 the offset between UTC and TAI was not a whole number of seconds, so the library gives no value.",
    date: "1971-01-01T00:00:00Z",
    check: "",
    from: "1971-01-01T00:00:00Z",
    to: "2024-01-01T00:00:00Z",
  },
];

/** A preset as control values. */
export function presetState(p: TimelinePreset): TimelineState {
  return { date: p.date, check: p.check, from: p.from, to: p.to };
}

/** The preset whose controls match `state`, or `custom`. */
export function matchPreset(state: TimelineState): string {
  const hit = TIMELINE_PRESETS.find((p) => {
    const s = presetState(p);
    return ARG_KEYS.every((key) => s[key] === state[key].trim());
  });
  return hit ? hit.id : CUSTOM_PRESET_ID;
}

// ---------------------------------------------------------------------------
// The axis and the slider (placement only)
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;

/** The axis starts here. */
export const AXIS_START_MS = convertUtcToUnix(INTEGER_UTC_FROM) ?? 0;

/** The instant of a date-only constant, for placement. */
const CONTINUOUS_MS = convertUtcToUnix(`${CONTINUOUS_UTC_FROM}T00:00:00Z`) ?? 0;

/** The UTC midnight that begins `nowMs`'s day. */
function dayStart(nowMs: number): number {
  return Math.floor(nowMs / DAY_MS) * DAY_MS;
}

/** The slider's last day: the later of the reader's today and continuous UTC. */
export function sliderEndMs(nowMs: number): number {
  return Math.max(dayStart(nowMs), CONTINUOUS_MS);
}

/** The slider's positions are whole days from the start of 1972. */
export function sliderMax(nowMs: number): number {
  return Math.round((sliderEndMs(nowMs) - AXIS_START_MS) / DAY_MS);
}

/** The axis runs one year past the slider's end. */
export function axisEndMs(nowMs: number): number {
  const end = convertUnixToUtc(sliderEndMs(nowMs));
  const next = `${Number(end.slice(0, 4)) + 1}${end.slice(4)}`.replace(
    /^(\d+-02-)29/,
    "$128",
  );
  return convertUtcToUnix(next) ?? sliderEndMs(nowMs);
}

/** The date a slider position writes: `YYYY-MM-DDT00:00:00Z`. */
export function sliderDate(position: number): string {
  const iso = convertUnixToUtc(AXIS_START_MS + position * DAY_MS);
  return `${iso.slice(0, 10)}T00:00:00Z`;
}

/**
 * An instant read for drawing. A second 60 is placed on its own `59` (a
 * drawing position, not a result), and anything that does not parse is `null`.
 */
export function drawMs(text: string): number | null {
  const t = text.trim().replace(/(:\d{2}:)60(?=[.,Z+-]|$)/, "$159");
  if (!/^\d{4}-\d{2}-\d{2}/.test(t)) return null;
  const z = convertUtcToUnix(t);
  if (z !== null || !/[+-]\d{2}(:?\d{2})?$/.test(t)) return z;
  // An offset spelling: the polyfill places it for drawing only. The shown
  // results still come from the library.
  try {
    return Temporal.Instant.from(t).epochMilliseconds;
  } catch {
    return null;
  }
}

/**
 * The slider position of a typed date, clamped to the slider, or `null` when
 * the date cannot be placed. The slider is disabled for `null`.
 */
export function sliderPosition(text: string, nowMs: number): number | null {
  const ms = drawMs(text);
  if (ms === null) return null;
  const day = Math.round((dayStart(ms) - AXIS_START_MS) / DAY_MS);
  return Math.min(sliderMax(nowMs), Math.max(0, day));
}

/** A reading's place on the axis as a percentage, clamped, and whether it was. */
export function axisPercent(
  ms: number,
  nowMs: number,
): { pct: number; beyond: "before" | "after" | null } {
  const span = axisEndMs(nowMs) - AXIS_START_MS;
  const raw = ((ms - AXIS_START_MS) / span) * 100;
  const pct = Math.round(Math.min(100, Math.max(0, raw)) * 100) / 100;
  return { pct, beyond: raw < 0 ? "before" : raw > 100 ? "after" : null };
}

/** The place on the axis where continuous UTC begins, as a percentage. */
export function continuousPercent(nowMs: number): number {
  return axisPercent(CONTINUOUS_MS, nowMs).pct;
}

/** Year ticks every five years, from the first one on the axis. */
export function axisTicks(nowMs: number): { year: number; pct: number }[] {
  const lastYear = Number(convertUnixToUtc(axisEndMs(nowMs)).slice(0, 4));
  const ticks: { year: number; pct: number }[] = [];
  for (let year = 1975; year <= lastYear; year += 5) {
    ticks.push({
      year,
      pct: axisPercent(convertUtcToUnix(`${year}-01-01T00:00:00Z`) ?? 0, nowMs)
        .pct,
    });
  }
  return ticks;
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/** One inserted second and the step it begins. */
interface Step {
  /** The inserted second, `…T23:59:60Z`. */
  insertion: string;
  /** The first instant on the new offset. `""` if the library gave none. */
  after: string;
  /** TAI - UTC from `after` on. `null` if the library gave none. */
  offset: number | null;
  /** The step's place in time, for drawing. `null` if `after` did not parse. */
  ms: number | null;
}

/** What one date input reads, or why it does not. */
interface OffsetRead {
  /** The calls made, empty when the date is blank. */
  calls: EdiCall[];
  /** TAI - UTC on the date, or `null`. */
  offset: number | null;
  /** The next insertion after the date, `""` when there is none. */
  next: string;
  /** Why `offset` is `null`, in one sentence. `""` when it is not. */
  reason: string;
}

interface BetweenRead {
  calls: EdiCall[];
  count: number | null;
  /** The counted insertions, named. Empty when the count is 0 or `null`. */
  counted: string[];
  reason: string;
}

type CheckVerdict =
  | typeof VERDICT_INSERTED
  | typeof VERDICT_NOT_INSERTED
  | typeof VERDICT_VALID_INSTANT;

interface CheckRead {
  calls: EdiCall[];
  /** The verdict word, or `null` for NO SIGNAL. */
  verdict: CheckVerdict | null;
  /** The checked second as the library's list spells it (`…T23:59:60Z`), or `""`
   *  when it is not an inserted second. Read back through TAI. */
  insertion: string;
  /** What `isLeapSecond` and `hasSecond60` returned. */
  isLeap: boolean;
  hasSecond60: boolean;
  reason: string;
}

export interface TimelineRead {
  steps: Step[];
  /** TAI - UTC at the start of 1972, the left end of the step line. */
  startOffset: number | null;
  offset: OffsetRead;
  between: BetweenRead;
  check: CheckRead;
}

/**
 * Why a library call gave no value for `text`: a second 60 on a day with no
 * insertion, an instant before 1972, or not an instant at all. The probes are
 * library calls; the sentences are fixed text.
 */
function noValueReason(lib: TimescaleLib, text: string): string {
  if (lacksOffset(lib, text)) return NO_OFFSET_TEXT;
  if (lib.hasSecond60(text) && !lib.isLeapSecond(text)) {
    return NOT_INSERTED_TEXT;
  }
  if (lib.isValidInstant(text)) return BEFORE_1972_TEXT;
  return NOT_INSTANT_TEXT;
}

const STEPS = new WeakMap<TimescaleLib, Step[]>();

/** Every inserted second and its step, walked once per library. */
function readSteps(lib: TimescaleLib): Step[] {
  const cached = STEPS.get(lib);
  if (cached !== undefined) return cached;
  const steps = insertions(lib).map((insertion) => {
    const after = secondAfter(lib, insertion);
    return {
      insertion,
      after,
      offset: after === "" ? null : lib.taiMinusUtc(after),
      ms: after === "" ? null : drawMs(after),
    };
  });
  STEPS.set(lib, steps);
  return steps;
}

function readOffset(lib: TimescaleLib, date: string): OffsetRead {
  if (date === "") return { calls: [], offset: null, next: "", reason: "" };
  const offsetCall = runCall(lib, "taiMinusUtc", date);
  const nextCall = runCall(lib, "nextLeapSecond", date);
  const offset = offsetCall.result as number | null;
  return {
    calls: [offsetCall, nextCall],
    offset,
    next: nextCall.result as string,
    reason: offset === null ? noValueReason(lib, date) : "",
  };
}

function readBetween(lib: TimescaleLib, from: string, to: string): BetweenRead {
  if (from === "" || to === "") {
    return { calls: [], count: null, counted: [], reason: "" };
  }
  const call = runCall(lib, "leapSecondsBetween", from, to);
  const count = call.result as number | null;
  if (count === null) {
    const bad = [from, to].find((x) => lib.taiMinusUtc(x) === null);
    return {
      calls: [call],
      count,
      counted: [],
      reason: bad === undefined ? NOT_INSTANT_TEXT : noValueReason(lib, bad),
    };
  }
  return {
    calls: [call],
    count,
    counted: insertionsBetween(lib, from, to, count),
    reason: "",
  };
}

function readCheck(lib: TimescaleLib, check: string): CheckRead {
  if (check === "") {
    return {
      calls: [],
      verdict: null,
      insertion: "",
      isLeap: false,
      hasSecond60: false,
      reason: "",
    };
  }
  const has = runCall(lib, "hasSecond60", check);
  const leap = runCall(lib, "isLeapSecond", check);
  const valid = runCall(lib, "isValidInstant", check);
  const noOffset = lacksOffset(lib, check);
  const verdict: CheckVerdict | null = noOffset
    ? null
    : leap.result === true
      ? VERDICT_INSERTED
      : has.result === true
        ? VERDICT_NOT_INSERTED
        : valid.result === true
          ? VERDICT_VALID_INSTANT
          : null;
  return {
    calls: [has, leap, valid],
    verdict,
    insertion: leap.result === true ? lib.fromTAI(lib.toTAI(check)) : "",
    isLeap: leap.result === true,
    hasSecond60: has.result === true,
    reason:
      verdict === null ? (noOffset ? NO_OFFSET_TEXT : NOT_INSTANT_TEXT) : "",
  };
}

/** Everything the widget draws and prints for `state`, from the library. */
export function readTimeline(
  lib: TimescaleLib,
  state: TimelineState,
): TimelineRead {
  const s: TimelineState = {
    date: state.date.trim(),
    check: state.check.trim(),
    from: state.from.trim(),
    to: state.to.trim(),
  };
  return {
    steps: readSteps(lib),
    startOffset: lib.taiMinusUtc(INTEGER_UTC_FROM),
    offset: readOffset(lib, s.date),
    between: readBetween(lib, s.from, s.to),
    check: readCheck(lib, s.check),
  };
}

// ---------------------------------------------------------------------------
// Plates and sentences
// ---------------------------------------------------------------------------

/** The date part of an instant, for a plate's sub line. */
function dayOf(text: string): string {
  return text.trim().slice(0, 10);
}

/** The three result plates, in order. A plate with no result keeps its lines. */
export function timelinePlates(read: TimelineRead): PlateSpec[] {
  const o = read.offset;
  const b = read.between;
  const c = read.check;
  const hasNext = o.offset !== null && o.next !== "";
  return [
    {
      role: "hero-offset",
      caption: "TAI − UTC on the date",
      value: o.offset === null ? null : `${o.offset} s`,
      lines:
        o.offset === null
          ? ["", ""]
          : hasNext
            ? ["next insertion", dayOf(o.next)]
            : [NONE_AFTER_TEXT, ""],
      series: 1,
    },
    {
      role: "hero-between",
      caption: "Leap seconds between",
      value: b.count === null ? null : String(b.count),
      lines:
        b.count === null
          ? ["", ""]
          : [
              `from ${dayOf(b.calls[0]!.args[0] as string)}`,
              `to ${dayOf(b.calls[0]!.args[1] as string)}`,
            ],
      series: 2,
    },
    {
      role: "hero-check",
      caption: "Your second 60",
      value: c.verdict,
      lines:
        c.verdict === null
          ? ["", ""]
          : [`isLeapSecond ${c.isLeap}`, `hasSecond60 ${c.hasSecond60}`],
      series: 3,
      quiet: true,
    },
  ];
}

/** The plates before anything is read: three empty plates. */
export function blankPlates(): PlateSpec[] {
  return timelinePlates({
    steps: [],
    startOffset: null,
    offset: { calls: [], offset: null, next: "", reason: "" },
    between: { calls: [], count: null, counted: [], reason: "" },
    check: {
      calls: [],
      verdict: null,
      insertion: "",
      isLeap: false,
      hasSecond60: false,
      reason: "",
    },
  });
}

/** The one sentence a screen reader gets for the whole reading. */
export function summaryText(state: TimelineState, read: TimelineRead): string {
  const parts: string[] = [
    `${read.steps.length} leap seconds are inserted in the library's list.`,
  ];
  const o = read.offset;
  if (o.calls.length > 0) {
    parts.push(
      o.offset === null
        ? `TAI minus UTC on ${state.date.trim()}: no signal. ${o.reason}`
        : `TAI minus UTC on ${state.date.trim()} is ${o.offset} seconds; ${o.next === "" ? NONE_AFTER_TEXT : `the next insertion is ${o.next}`}.`,
    );
  }
  const b = read.between;
  if (b.calls.length > 0) {
    parts.push(
      b.count === null
        ? `Leap seconds between: no signal. ${b.reason}`
        : `${b.count} leap seconds between ${state.from.trim()} and ${state.to.trim()}.`,
    );
  }
  const c = read.check;
  if (c.calls.length > 0) {
    parts.push(
      c.verdict === null
        ? `${state.check.trim()}: no signal. ${c.reason}`
        : `${state.check.trim()}: ${c.verdict}.`,
    );
  }
  return parts.join(" ");
}

/** The step line's value range, from the library's own offsets. */
export function offsetRange(read: TimelineRead): { low: number; high: number } {
  const values = [read.startOffset, ...read.steps.map((s) => s.offset)].filter(
    (v): v is number => v !== null,
  );
  if (values.length === 0) return { low: 0, high: 1 };
  return { low: Math.min(...values) - 1, high: Math.max(...values) + 1 };
}

// ---------------------------------------------------------------------------
// Links to the other tools
// ---------------------------------------------------------------------------

/** The links row: count the real seconds, and every clock on the date. */
export const TIMELINE_LINKS = [
  {
    role: "link-elapsed",
    text: "Count the real seconds between these dates",
  },
  { role: "link-clocks", text: "Every clock on this date" },
] as const;

/**
 * Where each link goes, or `null` while the library gave no value for what it
 * would send: the span needs a count, the clocks link needs an offset.
 */
export function timelineHandoffs(
  state: TimelineState,
  read: TimelineRead,
): { elapsed: ToolHandoff | null; clocks: ToolHandoff | null } {
  const from = state.from.trim();
  const to = state.to.trim();
  const date = state.date.trim();
  return {
    elapsed:
      read.between.count !== null && from !== "" && to !== ""
        ? { kind: "elapsed", args: { start: from, end: to } }
        : null,
    clocks:
      read.offset.offset !== null && date !== ""
        ? { kind: "satclock", args: { value: date } }
        : null,
  };
}
