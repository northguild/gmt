/**
 * Pure helpers for the Terrestrial Time Stack.
 *
 * Terrestrial Time (TT) is the time scale an ephemeris takes as its argument. It sits above UTC
 * by three pieces laid end to end: TAI − UTC, which steps at each inserted second; TT − TAI,
 * which is constant; and TCG − TT, which drifts with time. The tool takes a time on UTC, TAI,
 * TT or TCG and shows the same instant on all four, then the three pieces.
 *
 * No DOM and no gmt import. Every function that calls the library takes a `TimescaleLib`
 * (`timescale-lib.ts`), loaded by the mount from the real package. The widget draws the
 * library's results and computes none of them:
 *
 * - `toTAI`, `toTT` and `toTCG` write the instant on each scale;
 * - `fromTAI`, `fromTT` and `fromTCG` read a label back to UTC;
 * - `taiMinusUtc` and `tcgMinusTt` give the first and last pieces;
 * - `diffUtcAsDuration` gives the constant piece and the whole gap.
 *
 * The slider's two ends are named here: the start of integer UTC, and the last year the library
 * writes with four digits. No gap is written here.
 */

import { runCall, type EdiCall } from "./edi-widgets";
import { labelParts, durationSecondsText } from "./gnss-widgets";
import type { PlateSpec } from "./ledger-widgets";
import {
  BEFORE_1972_NOTE,
  INSIDE_SECOND_TEXT,
  NO_RESULT_TEXT,
} from "./satellite-clock-converter";
import type { TimescaleLib } from "./timescale-lib";
import { INTEGER_UTC_FROM, lacksOffset } from "./timescale-widgets";

export { BEFORE_1972_NOTE, INSIDE_SECOND_TEXT, NO_RESULT_TEXT };

/** The one footnote a reading can carry. */
export const INSIDE_FOOTNOTE = `${INSIDE_SECOND_TEXT}: UTC has no instant to count the gap from.`;

export const CUSTOM_PRESET_ID = "custom";

/** The longest value the input takes, and the longest a permalink carries. */
export const MAX_VALUE_LENGTH = 64;

/** The slider's two ends: integer UTC begins, and the library's four-digit year limit. */
export const SLIDER_MIN = Number(INTEGER_UTC_FROM.slice(0, 4));
export const SLIDER_MAX = 9999;

/** Every Nth year of the slider gets a point on the drift lane. */
const SERIES_STEP = 25;

/** A scale of the stack, in the order the table lists them. */
export type ScaleKey = "UTC" | "TAI" | "TT" | "TCG";
export const SCALE_KEYS: readonly ScaleKey[] = ["UTC", "TAI", "TT", "TCG"];

/** The tokens after the space. */
const SCALE_TOKENS = ["TAI", "TT", "TCG"] as const;
type ScaleToken = (typeof SCALE_TOKENS)[number];

const isScaleToken = (t: string): t is ScaleToken =>
  (SCALE_TOKENS as readonly string[]).includes(t);

const TOKEN_LIST = "TAI, TT or TCG";

/** The names of the three pieces, and how each one behaves. */
export const SEGMENT_NAMES = {
  steps: "TAI − UTC",
  constant: "TT − TAI",
  drift: "TCG − TT",
} as const;
export const SEGMENT_WORDS = {
  steps: "steps at each inserted second",
  constant: "constant",
  drift: "drifts with time",
} as const;
export type SegmentKey = keyof typeof SEGMENT_NAMES;
export const SEGMENT_KEYS: readonly SegmentKey[] = [
  "steps",
  "constant",
  "drift",
];

/** The whole gap's name and what it means. */
export const GAP_NAME = "TT − UTC";
export const GAP_NOTE = "an ephemeris's time argument is this far ahead of UTC";

const EMPTY_TEXT =
  "Type a time on UTC, TAI, TT or TCG, or pick a preset, to see the stack.";

/** The five sentences the tool says in place of an answer. */
export const SENTENCES = {
  unknownToken: `The scale after the space is not one of ${TOKEN_LIST}.`,
  noLeapSecond: "No leap second was inserted at the end of that day.",
  before1972:
    "UTC has differed from TAI by whole seconds only since 1972-01-01, so the stack starts there.",
  notOnScale:
    "The library does not read this as a time on that scale: check the form of the label.",
  notAnInstant:
    "That is not a UTC instant: write it like 2026-01-01T00:00:00Z, or add a scale after a space, such as 2026-01-01T00:01:09.184 TT.",
} as const;

// ---------------------------------------------------------------------------
// State, presets, permalink
// ---------------------------------------------------------------------------

/** The widget's one text control. */
export interface StackState {
  value: string;
}

/** Seed arguments: the permalink's flat string key, or a chat call's `value`. */
export type TerrestrialTimeStackArgs = Record<string, unknown>;

interface StackPreset {
  id: string;
  label: string;
  description: string;
  state: StackState;
}

/**
 * Every preset is a worked case whose result a real run of the library
 * decided. The tests assert each description's numbers against the library.
 */
export const STACK_PRESETS: readonly StackPreset[] = [
  {
    id: "utc-2026",
    label: "The start of 2026, in UTC",
    description:
      "At the start of 2026 in UTC, TT is 69.184 seconds ahead, and TCG is about 1.08 seconds ahead of TT.",
    state: { value: "2026-01-01T00:00:00Z" },
  },
  {
    id: "tt-label",
    label: "A TT label",
    description:
      "A TT clock that reads 1 minute 9.184 seconds past midnight at the start of 2026 is reading midnight in UTC.",
    state: { value: "2026-01-01T00:01:09.184 TT" },
  },
  {
    id: "tcg-label",
    label: "A TCG label",
    description:
      "The same instant written on TCG: 1 minute 10.261661917 seconds past midnight, which reads back to midnight in UTC.",
    state: { value: "2026-01-01T00:01:10.261661917 TCG" },
  },
  {
    id: "epoch",
    label: "Where TCG and TT agree",
    description:
      "TCG and TT read the same at 32.184 seconds past midnight on 1977-01-01 TT. In UTC that is 1976-12-31T23:59:45Z, and TCG − TT is 0.",
    state: { value: "1977-01-01T00:00:32.184 TT" },
  },
  {
    id: "first-integer-utc",
    label: "The first day of integer UTC",
    description:
      "Before the epoch above, TCG reads behind TT. At the start of 1972 TCG − TT is −0.11001219 seconds.",
    state: { value: "1972-01-01T00:00:00Z" },
  },
  {
    id: "inside-leap-second",
    label: "Inside a leap second",
    description:
      "At the end of 2016 UTC added a second, written 23:59:60. TAI, TT and TCG each have a label for it, but UTC has no gap to state.",
    state: { value: "2016-12-31T23:59:60Z" },
  },
  {
    id: "far-future",
    label: "The year 9999",
    description:
      "At the start of 9999 TCG − TT is 176.427468382 seconds, more than TT − UTC is today.",
    state: { value: "9999-01-01T00:00:00Z" },
  },
  {
    id: "before-1972",
    label: "Before integer UTC",
    description:
      "Before 1972 UTC differed from TAI by fractions of a second, so the library gives no reading on any scale.",
    state: { value: "1971-12-31T23:59:59Z" },
  },
];

export const DEFAULT_PRESET = STACK_PRESETS[0]!;

export function presetState(preset: StackPreset): StackState {
  return { ...preset.state };
}

/** The preset whose value matches `state`, trimmed, or `custom`. */
export function matchPreset(state: StackState): string {
  const hit = STACK_PRESETS.find((p) => p.state.value === state.value.trim());
  return hit ? hit.id : CUSTOM_PRESET_ID;
}

/** Whether `args` carries anything the widget can seed from. */
export function isSeeded(args: TerrestrialTimeStackArgs | undefined): boolean {
  return (
    args !== undefined &&
    (typeof args["value"] === "string" || typeof args["preset"] === "string") &&
    (args["value"] ?? args["preset"]) !== ""
  );
}

/** The state a seed describes: `value` as written, else a preset by its id, else the default. */
export function readArgs(args: TerrestrialTimeStackArgs): StackState {
  const value = args["value"];
  if (typeof value === "string" && value !== "") {
    return { value: value.slice(0, MAX_VALUE_LENGTH) };
  }
  const named = STACK_PRESETS.find((p) => p.id === args["preset"]);
  return presetState(named ?? DEFAULT_PRESET);
}

/** The permalink key for `state`: the trimmed value. The default preset writes nothing. */
export function permalinkOf(state: StackState): Record<string, string> {
  const value = state.value.trim().slice(0, MAX_VALUE_LENGTH);
  return value === "" || value === DEFAULT_PRESET.state.value ? {} : { value };
}

// ---------------------------------------------------------------------------
// The slider's years
// ---------------------------------------------------------------------------

/** The slider's year for a UTC instant. */
export function yearOf(utc: string): number {
  return Number(utc.slice(0, 4));
}

/** The first instant of `year`, in UTC. */
export function yearInstant(year: number): string {
  return `${String(year).padStart(4, "0")}-01-01T00:00:00Z`;
}

/** The years the drift lane has a point for: every 25th, and both ends of the slider. */
export function driftYears(): number[] {
  const years = new Set<number>([SLIDER_MIN, SLIDER_MAX]);
  for (let y = SLIDER_MIN; y <= SLIDER_MAX; y++) {
    if (y % SERIES_STEP === 0) years.add(y);
  }
  return [...years].sort((a, b) => a - b);
}

/** One point of the drift lane. `value` is `null` where the library gave no reading. */
export interface DriftPoint {
  year: number;
  value: number | null;
}

/** `tcgMinusTt` at the start of each year, for drawing only. */
export function driftSeries(
  lib: Pick<TimescaleLib, "tcgMinusTt">,
  years: readonly number[],
): DriftPoint[] {
  return years.map((year) => ({
    year,
    value: lib.tcgMinusTt(yearInstant(year)),
  }));
}

// ---------------------------------------------------------------------------
// Reading the library
// ---------------------------------------------------------------------------

/** Seconds as the stack writes them: U+2212 for a minus, no exponent. */
export function secondsText(n: number): string {
  let text = String(n);
  if (/e/i.test(text)) {
    text = n.toFixed(9).replace(/0+$/, "").replace(/\.$/, "");
  }
  return text.replace("-", "−");
}

/** One piece of the stack, or the whole gap. */
export interface Segment {
  kind: "seconds" | "inside" | "none";
  /** The library's number of seconds, for drawing; `null` unless `kind` is `seconds`. */
  seconds: number | null;
  /** The value in words: "37 s", "inside an inserted second", "no result". */
  text: string;
}

const NONE: Segment = { kind: "none", seconds: null, text: NO_RESULT_TEXT };
const INSIDE: Segment = {
  kind: "inside",
  seconds: null,
  text: INSIDE_SECOND_TEXT,
};

function segmentOf(seconds: number | null): Segment {
  return seconds === null || !Number.isFinite(seconds)
    ? NONE
    : { kind: "seconds", seconds, text: `${secondsText(seconds)} s` };
}

/** A duration the library wrote (an ISO 8601 `PT…S` string) as a segment. */
function durationSegment(duration: string): Segment {
  const text = durationSecondsText(duration);
  return text === null ? NONE : segmentOf(Number(text));
}

/** One row of the table. */
export interface ScaleRow {
  scale: ScaleKey;
  /** The label of the instant on this scale; `""` when the library gave none. */
  label: string;
  /** The call that wrote the label, or `null` for UTC. */
  call: EdiCall | null;
  /** The label read back to UTC; `""` when the library gave none. */
  back: string;
  /** The call that read it back, or `null` for UTC. */
  backCall: EdiCall | null;
  /** The scale the reader typed. */
  yours: boolean;
}

export interface StackRead {
  state: StackState;
  status: "ok" | "empty" | "sentinel";
  /** The one sentence a sentinel says. */
  failure: string | null;
  /** What an empty state says. */
  emptyText: string | null;
  /** The scale the reader's value is on, or `null` before it is known. */
  scale: ScaleKey | null;
  /** The UTC instant every row is made from. */
  utc: string | null;
  /** Always four rows. */
  rows: ScaleRow[];
  /** TAI − UTC, TT − TAI and TCG − TT. */
  segments: Record<SegmentKey, Segment>;
  /** TT − UTC. */
  gap: Segment;
  plates: PlateSpec[];
  /** The footnote under the table, or `""`. */
  footnote: string;
  /** The calls made, in the order they were made. */
  calls: EdiCall[];
}

/** The plates of a reading. `null` draws the empty plates. */
export function platesOf(
  parts: { gap: Segment; segments: Record<SegmentKey, Segment> } | null,
): PlateSpec[] {
  const value = (s: Segment | undefined): string | null =>
    s === undefined || s.kind === "none" ? null : s.text;
  return [
    {
      role: "hero-gap",
      caption: GAP_NAME,
      value: value(parts?.gap),
      lines: [GAP_NOTE],
      series: 1,
    },
    ...SEGMENT_KEYS.map((key, i): PlateSpec => ({
      role: `hero-${key}`,
      caption: SEGMENT_NAMES[key],
      value: value(parts?.segments[key]),
      lines: [SEGMENT_WORDS[key]],
      series: (i + 2) as 2 | 3 | 4,
      quiet: true,
    })),
  ];
}

function emptyRows(): ScaleRow[] {
  return SCALE_KEYS.map((scale) => ({
    scale,
    label: "",
    call: null,
    back: "",
    backCall: null,
    yours: false,
  }));
}

function blank(
  state: StackState,
  status: "empty" | "sentinel",
  text: string,
  scale: ScaleKey | null,
  calls: EdiCall[],
): StackRead {
  return {
    state,
    status,
    failure: status === "sentinel" ? text : null,
    emptyText: status === "empty" ? text : null,
    scale,
    utc: null,
    rows: emptyRows(),
    segments: { steps: NONE, constant: NONE, drift: NONE },
    gap: NONE,
    plates: platesOf(null),
    footnote: "",
    calls,
  };
}

/** The stack before anything is typed. */
export function emptyRead(): StackRead {
  return blank({ value: "" }, "empty", EMPTY_TEXT, null, []);
}

const READ_BACK = {
  TAI: "fromTAI",
  TT: "fromTT",
  TCG: "fromTCG",
} as const satisfies Record<ScaleToken, keyof TimescaleLib>;

const WRITE = {
  TAI: "toTAI",
  TT: "toTT",
  TCG: "toTCG",
} as const satisfies Record<ScaleToken, keyof TimescaleLib>;

/** The sentence for a value the library did not read as UTC. */
function whyNotUtc(lib: TimescaleLib, value: string): string {
  if (lacksOffset(lib, value)) return SENTENCES.notAnInstant;
  if (lib.hasSecond60(value) && !lib.isLeapSecond(value)) {
    return SENTENCES.noLeapSecond;
  }
  if (lib.isValidInstant(value) && lib.taiMinusUtc(value) === null) {
    return SENTENCES.before1972;
  }
  return SENTENCES.notAnInstant;
}

/** The date-time part of a label, written with `Z` for `diffUtcAsDuration`. */
const asUtc = (label: string): string => `${label.split(" ")[0] ?? ""}Z`;

/**
 * Read the stack's one value with the library. The value is trimmed, and the scale it is on is
 * the token after its one space: `TAI`, `TT` or `TCG` goes to the matching `from` function, and
 * no space means UTC as typed. The UTC instant then goes to `toTAI`, `toTT` and `toTCG`, and
 * each label comes back through its `from` function.
 *
 * A state with no value makes no library call and is `empty`, not a sentinel.
 */
export function readStack(lib: TimescaleLib, state: StackState): StackRead {
  const value = state.value.trim();
  if (value === "") return blank(state, "empty", EMPTY_TEXT, null, []);

  const calls: EdiCall[] = [];
  let scale: ScaleKey = "UTC";
  let utc: string;

  if (value.includes(" ")) {
    const parts = labelParts(value);
    if (parts === null) {
      return blank(state, "sentinel", SENTENCES.notAnInstant, null, calls);
    }
    if (!isScaleToken(parts.token)) {
      return blank(state, "sentinel", SENTENCES.unknownToken, null, calls);
    }
    scale = parts.token;
    const call = runCall(lib, READ_BACK[parts.token], value);
    calls.push(call);
    utc = call.result as string;
    if (utc === "") {
      return blank(state, "sentinel", SENTENCES.notOnScale, scale, calls);
    }
  } else {
    // The library's own `Z` spelling of what was typed, asked without a recorded call.
    utc = lib.fromTT(lib.toTT(value));
    if (utc === "") {
      return blank(state, "sentinel", whyNotUtc(lib, value), scale, calls);
    }
  }

  const inside = lib.hasSecond60(utc);
  const labels = {} as Record<ScaleToken, EdiCall>;
  for (const token of SCALE_TOKENS) {
    labels[token] = runCall(lib, WRITE[token], utc);
    calls.push(labels[token]);
  }
  const back = {} as Record<ScaleToken, EdiCall>;
  for (const token of SCALE_TOKENS) {
    back[token] = runCall(lib, READ_BACK[token], labels[token].result);
    calls.push(back[token]);
  }

  const taiLabel = labels.TAI.result as string;
  const ttLabel = labels.TT.result as string;

  const stepsCall = runCall(lib, "taiMinusUtc", utc);
  calls.push(stepsCall);
  const steps = segmentOf(stepsCall.result as number | null);

  let constant = NONE;
  if (taiLabel !== "" && ttLabel !== "") {
    const call = runCall(
      lib,
      "diffUtcAsDuration",
      asUtc(taiLabel),
      asUtc(ttLabel),
      "seconds",
    );
    calls.push(call);
    constant = durationSegment(call.result as string);
  }

  const driftCall = runCall(lib, "tcgMinusTt", utc);
  calls.push(driftCall);
  const drift = segmentOf(driftCall.result as number | null);

  // A second 60 has no `Z` instant the duration can start from: the gap is stated as inside.
  let gap = NONE;
  if (inside) {
    gap = INSIDE;
  } else if (ttLabel !== "") {
    const call = runCall(
      lib,
      "diffUtcAsDuration",
      utc,
      asUtc(ttLabel),
      "seconds",
    );
    calls.push(call);
    gap = durationSegment(call.result as string);
  }

  const rows: ScaleRow[] = SCALE_KEYS.map((key): ScaleRow => {
    if (key === "UTC") {
      return {
        scale: key,
        label: utc,
        call: null,
        back: utc,
        backCall: null,
        yours: scale === "UTC",
      };
    }
    return {
      scale: key,
      label: labels[key].result as string,
      call: labels[key],
      back: back[key].result as string,
      backCall: back[key],
      yours: scale === key,
    };
  });

  const segments = { steps, constant, drift };
  return {
    state,
    status: "ok",
    failure: null,
    emptyText: null,
    scale,
    utc,
    rows,
    segments,
    gap,
    plates: platesOf({ gap, segments }),
    footnote: inside ? INSIDE_FOOTNOTE : "",
    calls,
  };
}

// ---------------------------------------------------------------------------
// The scale's reach
// ---------------------------------------------------------------------------

/**
 * The longest stack the bar has to hold, in seconds: the larger of TT − UTC plus TCG − TT at the
 * two ends of the slider. Read once, so the bar never rescales while the reader drags.
 */
export function stackReach(lib: TimescaleLib): number {
  const at = (year: number): number => {
    const utc = yearInstant(year);
    const tt = lib.toTT(utc);
    const gap =
      tt === ""
        ? null
        : durationSegment(lib.diffUtcAsDuration(utc, asUtc(tt), "seconds"))
            .seconds;
    const drift = lib.tcgMinusTt(utc);
    return (gap ?? 0) + (drift ?? 0);
  };
  return Math.max(at(SLIDER_MIN), at(SLIDER_MAX));
}

/** The pieces' sum for a reading, for the bar's aria-label. */
export function stackAria(read: StackRead): string {
  if (read.status !== "ok") {
    return read.failure ?? read.emptyText ?? "No stack to draw";
  }
  return SEGMENT_KEYS.map(
    (key) => `${SEGMENT_NAMES[key]} ${read.segments[key].text}`,
  ).join(", ");
}

/** The sentence a screen reader hears when the plates change. */
export function summaryText(read: StackRead): string {
  if (read.status === "sentinel") return read.failure ?? "";
  if (read.status === "empty") return read.emptyText ?? "";
  return read.plates
    .filter((p) => p.value !== null)
    .map((p) => `${p.caption} ${p.value}`)
    .join(". ");
}

/** The drift lane in words: its two ends as the library returned them, and the reader's year. */
export function laneAria(
  series: readonly DriftPoint[],
  read: StackRead,
): string {
  const ends = [series[0], series.at(-1)].filter(
    (p): p is DriftPoint => p !== undefined && p.value !== null,
  );
  const span =
    ends.length === 2
      ? `from ${secondsText(ends[0]!.value!)} s in ${ends[0]!.year} to ${secondsText(ends[1]!.value!)} s in ${ends[1]!.year}`
      : "";
  const here =
    read.status === "ok" && read.utc !== null
      ? `; at ${yearOf(read.utc)} it is ${read.segments.drift.text}`
      : "";
  return `${SEGMENT_NAMES.drift} against the year${span === "" ? "" : `, ${span}`}${here}`;
}
