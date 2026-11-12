/**
 * Pure helpers for the Report Time Resolver (AV-98), section 1: the METAR strip.
 *
 * A METAR, SPECI or TAF-issue time group (`YYGGggZ`, such as `302350Z`) names a day, an hour and
 * a minute and no month. The reader states the reference the report is read against (when it was
 * received), and `parseMetarTime` answers with the nearest candidate in exact time. This module
 * holds the state, the presets, the arguments a link or the chat can seed, the reasons, the
 * strip model (seven fixed slots, k = -3 to +3) and the printed calls. Every date, distance and
 * verdict is a library result.
 *
 * No DOM. Anything that reads the library takes an `AviationLib` as its first argument. The
 * module never reads the clock, never cuts the group into day, hour and minute, and never
 * calculates a month, a day count or a distance: the strip's candidates are `addUtc` on the
 * answer at the typed reference, a month's lack of a day is `addUtc` again with the default
 * overflow, and a distance is `diffUtcAsDuration`.
 *
 * Section 2 (NOTAM validity) has its own state and model, further down this file.
 */
import type { NotamValidity } from "@northguild/gmt/types";
import type { AviationLib, YearWindowOptions } from "./aviation-lib";
import { literal } from "./holiday-rule-builder";

/** What a plate reads while nothing has been typed: an empty field is not a refusal. */
export const NOTHING_TYPED = "nothing typed";

/** What a cell reads where there is nothing to say (a gap's side, an unmeasured distance). */
export const DASH = "—";

/** What the month column reads for a slot whose month lies outside the instant range. */
export const OUT_OF_RANGE_MONTH = "out of range";

/** The widest instant a plate shows: the last instant, with the finest fraction. */
export const INSTANT_SAMPLE = "+275760-09-13T00:00:00.000000001Z";

/** The strip's fixed slots, as a count of months from the anchor. */
export const SLOT_OFFSETS = [-3, -2, -1, 0, 1, 2, 3] as const;

/** The month ticks drawn under the lanes, as a count of months from the anchor. */
const TICK_OFFSETS = [-3, -2, -1, 0, 1, 2, 3, 4] as const;

/** How the month reads on the strip's axis and in the table. */
const MONTH_YEAR = {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
} as const;

/** How the month reads inside a gap's reason. */
const MONTH_ONLY = { month: "short", timeZone: "UTC" } as const;

/** How the day reads inside a gap's reason. */
const DAY_ONLY = { day: "numeric", timeZone: "UTC" } as const;

/** How a slider end reads. */
const END_DATE = {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
} as const;

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

/** The two presets whose fault no probe tells from a bad shape. */
export type PresetFault = "day32" | "hour24";

export interface MetarPreset {
  id: string;
  label: string;
  description: string;
  /** The group, exactly as it is typed. */
  group: string;
  /** The reference, exactly as it is typed; `""` is a real answer. */
  reference: string;
  /** A fault the preset itself marks, for that exact group and reference. */
  fault?: PresetFault;
}

export const METAR_PRESETS: readonly MetarPreset[] = [
  {
    id: "month-end",
    label: "Just after a month end",
    description:
      "The report was filed on the last day of the month; the reference is minutes into the next. The nearest candidate in exact time is read, not the reference's own month.",
    group: "302350Z",
    reference: "2024-07-01T00:05:00Z",
  },
  {
    id: "skip-june",
    label: "A month without the day",
    description:
      "A 30-day month has no 31st, so the candidates on either side are two months apart and the nearer one is read.",
    group: "312350Z",
    reference: "2024-07-01T00:05:00Z",
  },
  {
    id: "back-a-year",
    label: "Back across a year",
    description:
      "The reference is just into January; the report is from the last day of December.",
    group: "312350Z",
    reference: "2025-01-01T00:05:00Z",
  },
  {
    id: "next-month",
    label: "Forward to the next month",
    description:
      "The reference is minutes before a month end and the report is dated just after it.",
    group: "010010Z",
    reference: "2024-06-30T23:55:00Z",
  },
  {
    id: "tie",
    label: "Equally near",
    description:
      "Two candidates sit exactly the same time from the reference. A tie goes to the earlier.",
    group: "151200Z",
    reference: "2024-06-30T12:00:00Z",
  },
  {
    id: "nanosecond-past-tie",
    label: "A nanosecond past the tie",
    description:
      "One nanosecond later the tie is broken, and the later candidate is nearer.",
    group: "151200Z",
    reference: "2024-06-30T12:00:00.000000001Z",
  },
  {
    id: "april-31",
    label: "31 in a 30-day month",
    description:
      "The reference month has no 31st, so its candidate is skipped and the strip shows the gap.",
    group: "311200Z",
    reference: "2024-05-01T00:00:00Z",
  },
  {
    id: "february-31",
    label: "31 near February",
    description:
      "February has no 31st, so the nearest month with the day is two months back.",
    group: "312359Z",
    reference: "2024-03-01T00:00:00Z",
  },
  {
    id: "leap-29",
    label: "29 in a leap year",
    description: "A leap February has a 29th, so it is a candidate.",
    group: "292350Z",
    reference: "2024-03-01T00:05:00Z",
  },
  {
    id: "no-29th",
    label: "29 in a common year",
    description:
      "A common February has no 29th, so the nearest candidate is in March.",
    group: "292350Z",
    reference: "2025-03-01T00:05:00Z",
  },
  {
    id: "offset-reference",
    label: "A reference with an offset",
    description:
      "Months are counted in UTC, whatever offset the reference carries. This reference is still on 30 June in UTC.",
    group: "302350Z",
    reference: "2024-07-01T00:05:00+02:00",
  },
  {
    id: "annotated-reference",
    label: "A reference with a zone name",
    description:
      "A bracketed zone on the reference is read and does not change the answer: only its instant counts.",
    group: "251200Z",
    reference: "2024-06-25T13:20:00+01:00[Europe/London]",
  },
  {
    id: "lower-case",
    label: "Lower case",
    description:
      "The group is upper case only. The tool does not upper-case it for you.",
    group: "251200z",
    reference: "2024-06-25T12:20:00Z",
  },
  {
    id: "no-z",
    label: "No Z",
    description: "The Z is part of the group; without it nothing is read.",
    group: "251200",
    reference: "2024-06-25T12:20:00Z",
  },
  {
    id: "day-32",
    label: "Day 32",
    description: "A day of the month stops at 31.",
    group: "321200Z",
    reference: "2024-06-25T12:20:00Z",
    fault: "day32",
  },
  {
    id: "hour-24",
    label: "Hour 24",
    description: "The group is not read with hour 24: hours stop at 23.",
    group: "252400Z",
    reference: "2024-06-25T12:20:00Z",
    fault: "hour24",
  },
  {
    id: "no-reference",
    label: "No reference",
    description:
      "A report time names no month. With no reference stated, the library has nothing to read it against.",
    group: "251200Z",
    reference: "",
  },
  {
    id: "local-reference",
    label: "A reference without an offset",
    description:
      "A local time with no Z and no offset is not an instant, so it is no reference.",
    group: "251200Z",
    reference: "2024-06-25T12:20:00",
  },
];

export const CUSTOM_PRESET_ID = "custom";

/** The preset the tool opens with when a link or the chat names nothing. */
export const DEFAULT_PRESET_ID = "month-end";

// ---------------------------------------------------------------------------
// State and arguments
// ---------------------------------------------------------------------------

export interface MetarState {
  /** The group as typed: never trimmed, never upper-cased. */
  group: string;
  /** The base reference as typed: never trimmed. Empty is a real answer. */
  reference: string;
  /** Whole minutes the slider has moved the reference from the typed one. */
  shift: number;
}

/** The state with nothing typed. */
export function blankState(): MetarState {
  return { group: "", reference: "", shift: 0 };
}

export function presetState(preset: MetarPreset): MetarState {
  return { group: preset.group, reference: preset.reference, shift: 0 };
}

/** A new group; the slider goes back to the typed reference. */
export function withGroup(state: MetarState, group: string): MetarState {
  return { ...state, group, shift: 0 };
}

/** A new reference; the slider goes back to it. */
export function withReference(
  state: MetarState,
  reference: string,
): MetarState {
  return { ...state, reference, shift: 0 };
}

export interface MetarArgs {
  /** A preset id, from a permalink. */
  metarPreset?: string;
  group?: string;
  /** The reference as typed. The chat tool calls it `reference`. */
  ref?: string;
  /** Whole minutes, as a number or its text form. */
  shift?: string | number;
}

/** Whether the args seed anything. */
export function isSeeded(args: MetarArgs): boolean {
  return (["metarPreset", "group", "ref", "shift"] as const).some(
    (k) => args[k] !== undefined,
  );
}

const INTEGER = /^-?\d+$/;

/**
 * Seed arguments as controls. Typed values (the chat) and their text forms (a permalink) both
 * land here. A link or a call with no `reference` opens with the reference blank: a preset's
 * reference is taken only through the preset's own id, and the chat never states one the reader
 * did not.
 */
export function readArgs(args: MetarArgs): MetarState {
  const named = METAR_PRESETS.find((p) => p.id === args.metarPreset);
  const state = named === undefined ? blankState() : presetState(named);
  if (typeof args.group === "string") state.group = args.group;
  if (typeof args.ref === "string") state.reference = args.ref;
  if (typeof args.shift === "number" && Number.isInteger(args.shift)) {
    state.shift = args.shift;
  } else if (typeof args.shift === "string" && INTEGER.test(args.shift)) {
    state.shift = Number(args.shift);
  }
  return state;
}

/** The preset the controls match, or `custom`. A shifted reference is not a preset. */
export function matchPreset(state: MetarState): string {
  if (state.shift !== 0) return CUSTOM_PRESET_ID;
  const hit = METAR_PRESETS.find(
    (p) => p.group === state.group && p.reference === state.reference,
  );
  return hit ? hit.id : CUSTOM_PRESET_ID;
}

/** The fault the matching preset marks for this exact group and reference, if any. */
function presetFault(state: MetarState): PresetFault | undefined {
  return METAR_PRESETS.find(
    (p) => p.group === state.group && p.reference === state.reference,
  )?.fault;
}

/**
 * The permalink payload: `{ metarPreset }` alone while the state matches one, else the group and
 * reference as typed, and the shift while it is not zero. An empty reference is a real answer
 * and survives the link.
 */
export function permalinkOf(state: MetarState): Record<string, unknown> {
  const preset = matchPreset(state);
  if (preset !== CUSTOM_PRESET_ID) return { metarPreset: preset };
  const link: Record<string, unknown> = {
    group: state.group,
    ref: state.reference,
  };
  if (state.shift !== 0) link["shift"] = String(state.shift);
  return link;
}

// ---------------------------------------------------------------------------
// The reference the slider moves
// ---------------------------------------------------------------------------

export type SliderHintKey = "moves" | "needsReference" | "cannotMove";

export const SLIDER_HINTS: Record<SliderHintKey, string> = {
  moves:
    "Moves the reference in exact minutes and keeps its offset. A bracketed zone is dropped: a zone's offset can change within the month.",
  needsReference: "State a reference to move it.",
  cannotMove:
    "This reference cannot be moved: toOffsetInstant does not split it.",
};

export interface ReferenceModel {
  /** The typed reference is empty. */
  blank: boolean;
  /** `toOffsetInstant` split it, so it can move. */
  movable: boolean;
  /** The reference, in UTC, as `toOffsetInstant` returned it; `null` when it split nothing. */
  base: string | null;
  offset: string | null;
  /** The shift in force: the state's, kept inside the bounds, or 0 when it cannot move. */
  shift: number;
  /** The slider's bounds, in minutes. */
  min: number;
  max: number;
  /** The instants the bounds reach, or `null` at the edge of the instant range. */
  lo: string | null;
  hi: string | null;
  /** The reference every group call is made with: the typed one, or the moved one. */
  current: string;
  /** The current reference in UTC, or `null`. */
  utc: string | null;
  hint: SliderHintKey;
  /** The calls that moved the reference, printed with the answer's. */
  calls: string[];
  /** The calls that found the slider's bounds, printed with the strip's. */
  boundCalls: string[];
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * The reference the group is read against, and the slider that moves it. At a shift of 0 the
 * typed reference is passed as typed. Otherwise the offset is kept and any `[zone]` is dropped:
 * the moved reference is `fromOffsetInstant` of the moved instant with the original offset.
 * The bounds are one month either side, in minutes; an edge of the instant range is a bound of 0.
 */
export function referenceModel(
  lib: AviationLib,
  state: MetarState,
): ReferenceModel {
  const reference = state.reference;
  const blank = reference === "";
  const split = blank ? null : lib.toOffsetInstant(reference);
  const boundCalls: string[] = [];
  if (!blank) {
    boundCalls.push(
      `toOffsetInstant(${literal(reference)}); // ${literal(split)}`,
    );
  }
  if (split === null) {
    return {
      blank,
      movable: false,
      base: null,
      offset: null,
      shift: 0,
      min: 0,
      max: 0,
      lo: null,
      hi: null,
      current: reference,
      utc: null,
      hint: blank ? "needsReference" : "cannotMove",
      calls: [],
      boundCalls,
    };
  }

  const base = split.instant;
  const loText = lib.addUtc(base, { months: -1 });
  boundCalls.push(
    `addUtc(${literal(base)}, { months: -1 }); // ${literal(loText)}`,
  );
  const hiText = lib.addUtc(base, { months: 1 });
  boundCalls.push(
    `addUtc(${literal(base)}, { months: 1 }); // ${literal(hiText)}`,
  );
  let min = 0;
  let max = 0;
  if (loText !== "") {
    min = lib.diffUtc(base, loText, "minutes") ?? 0;
    boundCalls.push(
      `diffUtc(${literal(base)}, ${literal(loText)}, "minutes"); // ${literal(min)}`,
    );
  }
  if (hiText !== "") {
    max = lib.diffUtc(base, hiText, "minutes") ?? 0;
    boundCalls.push(
      `diffUtc(${literal(base)}, ${literal(hiText)}, "minutes"); // ${literal(max)}`,
    );
  }

  const shift = clamp(state.shift, min, max);
  const calls: string[] = [];
  let current = reference;
  let utc = base;
  if (shift !== 0) {
    calls.push(`toOffsetInstant(${literal(reference)}); // ${literal(split)}`);
    const moved = lib.addUtc(base, { minutes: shift });
    calls.push(
      `addUtc(${literal(base)}, { minutes: ${shift} }); // ${literal(moved)}`,
    );
    const pair = { instant: moved, offset: split.offset };
    current = lib.fromOffsetInstant(pair);
    calls.push(`fromOffsetInstant(${literal(pair)}); // ${literal(current)}`);
    utc = moved;
  }
  return {
    blank,
    movable: true,
    base,
    offset: split.offset,
    shift,
    min,
    max,
    lo: loText === "" ? null : loText,
    hi: hiText === "" ? null : hiText,
    current,
    utc: utc === "" ? null : utc,
    hint: "moves",
    calls,
    boundCalls,
  };
}

/** The slider's end labels: the formatted bounds, or the base when the bound is the edge. */
export function sliderEnds(
  lib: AviationLib,
  ref: ReferenceModel,
): readonly [string, string] {
  const end = (instant: string | null): string => {
    if (instant === null) return DASH;
    const text = lib.formatUtc(instant, "en", END_DATE);
    return text === "" ? DASH : text;
  };
  return [end(ref.lo), end(ref.hi)];
}

/**
 * How far the reference has moved, as the library writes a duration: the span from the base to
 * the base moved by `shift` minutes. The chip is a narrow box that rides the thumb, so it takes
 * the narrow style; a table cell takes the short one.
 */
export function shiftText(
  lib: AviationLib,
  base: string,
  shift: number,
  calls?: string[],
): string {
  if (shift === 0) return NOT_MOVED;
  const moved = lib.addUtc(base, { minutes: shift });
  if (moved === "") return NOT_MOVED;
  const duration = lib.diffUtcAsDuration(base, moved, "days");
  const text = lib.formatDuration(duration, "en", { style: "narrow" });
  calls?.push(
    `diffUtcAsDuration(${literal(base)}, ${literal(moved)}, "days"); // ${literal(duration)}`,
    `formatDuration(${literal(duration)}, "en", { style: "narrow" }); // ${literal(text)}`,
  );
  if (text === "") return NOT_MOVED;
  return shift > 0 ? `+${text}` : text;
}

/** The slider's value text at the shift in force. */
export function sliderText(
  lib: AviationLib,
  ref: ReferenceModel,
  calls?: string[],
): string {
  return ref.base === null
    ? NOT_MOVED
    : shiftText(lib, ref.base, ref.shift, calls);
}

/** What the slider's chip reads at a shift of 0. */
export const NOT_MOVED = "not moved";

// ---------------------------------------------------------------------------
// The answer
// ---------------------------------------------------------------------------

export type AnswerReasonKey =
  | "empty"
  | "read"
  | "noReference"
  | "referenceNotInstant"
  | "lowerCase"
  | "day32"
  | "hour24"
  | "shape";

export const ANSWER_REASONS: Record<AnswerReasonKey, string> = {
  empty:
    "Type a METAR, SPECI or TAF-issue time group, such as 302350Z, to read it.",
  read: "Read against the reference you stated. The group names no month, so the nearest candidate in exact time is the answer.",
  noReference:
    "A report time names no month. State when it was received; the tool never uses now.",
  referenceNotInstant: "The reference needs Z or an offset.",
  lowerCase: "The group is upper case only.",
  day32: "Day 32 does not exist: a day of the month runs 01 to 31.",
  hour24: "Hour 24 is not read: hours run 00 to 23.",
  shape:
    "Not a DDHHMMZ group: two digits each for day, hour and minute, then Z.",
};

export interface AnswerResult {
  /** Nothing was typed: no call was made. */
  blank: boolean;
  /** `parseMetarTime`, or `null` for the sentinel. */
  answer: string | null;
  /** `isValidMetarTime`, or `null` while nothing was typed. */
  valid: boolean | null;
  reason: AnswerReasonKey;
  calls: string[];
}

/**
 * Read the typed group against the current reference. A refusal is named by asking the library
 * again, each probe printed with the calls, in this order:
 *
 * 1. **No reference.** The typed reference is empty.
 * 2. **Not an instant.** `isValidInstant` refuses the typed reference.
 * 3. **The case.** The group upper-cased. `toUpperCase` does not depend on the locale, so the
 *    probe cannot be moved by the reader's machine.
 * 4. **A preset's own fault.** `day-32` and `hour-24` are marked by the preset, for that exact
 *    group and reference: no probe tells them from a bad shape without the site cutting the
 *    group.
 *
 * Whatever is left has the wrong shape. The group is never trimmed, upper-cased or repaired
 * before the call.
 */
export function readAnswer(
  lib: AviationLib,
  state: MetarState,
  current: string,
): AnswerResult {
  if (state.group === "") {
    return {
      blank: true,
      answer: null,
      valid: null,
      reason: "empty",
      calls: [],
    };
  }
  const calls: string[] = [];
  const read = lib.parseMetarTime(state.group, current);
  calls.push(
    `parseMetarTime(${literal(state.group)}, ${literal(current)}); // ${literal(read)}`,
  );
  const valid = lib.isValidMetarTime(state.group, current);
  calls.push(
    `isValidMetarTime(${literal(state.group)}, ${literal(current)}); // ${literal(valid)}`,
  );
  if (read !== "") {
    return { blank: false, answer: read, valid, reason: "read", calls };
  }

  let reason: AnswerReasonKey;
  if (state.reference === "") {
    reason = "noReference";
  } else {
    const instant = lib.isValidInstant(state.reference);
    calls.push(
      `isValidInstant(${literal(state.reference)}); // ${literal(instant)}`,
    );
    if (!instant) {
      reason = "referenceNotInstant";
    } else {
      const upper = state.group.toUpperCase();
      let upperReads = false;
      if (upper !== state.group) {
        upperReads = lib.isValidMetarTime(upper, current);
        calls.push(
          `isValidMetarTime(${literal(upper)}, ${literal(current)}); // ${literal(upperReads)}`,
        );
      }
      const fault = presetFault(state);
      if (upperReads) reason = "lowerCase";
      else if (fault !== undefined) reason = fault;
      else reason = "shape";
    }
  }
  return { blank: false, answer: null, valid, reason, calls };
}

// ---------------------------------------------------------------------------
// The strip
// ---------------------------------------------------------------------------

export type SideKey = "before" | "at" | "after";

export const SIDE_TEXTS: Record<SideKey, string> = {
  before: "before",
  at: "at the reference",
  after: "after",
};

export interface StripSlot {
  /** Months from the anchor. */
  k: number;
  /** The month, as `formatUtc` writes it, or `OUT_OF_RANGE_MONTH`. */
  month: string;
  /** The candidate instant, or `null` for a gap. */
  candidate: string | null;
  /** Why a gap is a gap; `null` when the slot has a candidate. */
  gap: string | null;
  side: SideKey | null;
  /** The distance from the reference, as `formatDuration` writes it. */
  distance: string | null;
  /** The library chose this candidate. */
  chosen: boolean;
  /** Position on the axis, 0 to 1. */
  at: number;
  /** What the candidate's mark says to a screen reader, without the "chosen". */
  label: string;
}

export interface StripTick {
  j: number;
  label: string;
  at: number;
}

export interface StripModel {
  /** The anchor A0, or `""` when there is none. */
  anchor: string;
  /** The strip has an answer to draw. */
  drawn: boolean;
  slots: StripSlot[];
  ticks: StripTick[];
  /** The reference's position on the axis, or `null`. */
  referenceAt: number | null;
  /** What the reference's mark says to a screen reader. */
  referenceLabel: string;
  /** The slot the answer sits in, or `null`. */
  chosenK: number | null;
  /** There is an answer, and no slot holds it. */
  beyond: boolean;
  calls: string[];
}

/** The text a gap reads when the month has no such day. */
export function noDayText(day: string, month: string): string {
  return `no ${day} in ${month}`;
}

/** The text a gap reads when the month is outside the instant range. */
export const OUTSIDE_RANGE = "outside the instant range";

/** How a mark's instant reads aloud. */
const MARK_FORMAT = {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
} as const;

function markLabel(lib: AviationLib, instant: string, calls: string[]): string {
  const text = lib.formatUtc(instant, "en", MARK_FORMAT);
  calls.push(
    `formatUtc(${literal(instant)}, "en", ${literal(MARK_FORMAT)}); // ${literal(text)}`,
  );
  return text === "" ? instant : `${text} UTC`;
}

function emptySlots(): StripSlot[] {
  return SLOT_OFFSETS.map((k) => ({
    k,
    month: "",
    candidate: null,
    gap: null,
    side: null,
    distance: null,
    chosen: false,
    at: 0,
    label: "",
  }));
}

/** The anchor: the answer at the typed reference, at a shift of 0. */
export function anchorOf(
  lib: AviationLib,
  state: MetarState,
  answerAtZero: string | null,
  calls: string[],
): string {
  if (state.group === "" || state.reference === "") return "";
  if (answerAtZero !== null) return answerAtZero;
  const anchor = lib.parseMetarTime(state.group, state.reference);
  calls.push(
    `parseMetarTime(${literal(state.group)}, ${literal(state.reference)}); // ${literal(anchor)}`,
  );
  return anchor;
}

/**
 * The strip around the anchor. The anchor does not move while the slider does, so the ticks,
 * the labels, the candidates and the gaps stay put and only the reference's mark and the chosen
 * mark move. Seven slots always: months that have a given day are at most two months apart, and
 * the answer is at most a month from a reference that is at most a month from the typed one, so
 * the answer is one of k = -3 to +3 except at the edge of the instant range, where `beyond` says
 * so.
 */
export function buildStrip(
  lib: AviationLib,
  anchor: string,
  answer: string | null,
  referenceUtc: string | null,
): StripModel {
  if (anchor === "" || answer === null || answer === "") {
    return {
      anchor,
      drawn: false,
      slots: emptySlots(),
      ticks: [],
      referenceAt: null,
      referenceLabel: "",
      chosenK: null,
      beyond: false,
      calls: [],
    };
  }
  const calls: string[] = [];
  const candidates = SLOT_OFFSETS.map((k) => {
    const c = lib.addUtc(anchor, { months: k }, { overflow: "reject" });
    calls.push(
      `addUtc(${literal(anchor)}, { months: ${k} }, { overflow: "reject" }); // ${literal(c)}`,
    );
    return c;
  });

  // Ticks: the first of each month, j = -3 to +4. An empty tick at the edge is skipped.
  const ticks: { j: number; instant: string }[] = [];
  for (const j of TICK_OFFSETS) {
    const moved = lib.addUtc(anchor, { months: j });
    const start = moved === "" ? "" : lib.startOfUtc(moved, "month");
    calls.push(
      `startOfUtc(addUtc(${literal(anchor)}, { months: ${j} }), "month"); // ${literal(start)}`,
    );
    if (start !== "") ticks.push({ j, instant: start });
  }
  const axisStart = ticks[0]?.instant ?? "";
  const axisEnd = ticks[ticks.length - 1]?.instant ?? "";
  const total =
    axisStart === "" || axisEnd === "" ? null : lib.spanNs(axisStart, axisEnd);
  const place = (instant: string): number => {
    if (total === null || total === 0n) return 0;
    const part = lib.spanNs(axisStart, instant);
    return part === null ? 0 : Number(part) / Number(total);
  };

  const slots: StripSlot[] = [];
  let chosenK: number | null = null;
  for (let i = 0; i < SLOT_OFFSETS.length; i += 1) {
    const k = SLOT_OFFSETS[i]!;
    const candidate = candidates[i]!;
    // The month and the reason a gap is a gap ask the library again, without `reject`.
    const constrained = lib.addUtc(anchor, { months: k });
    if (candidate === "") {
      calls.push(
        `addUtc(${literal(anchor)}, { months: ${k} }); // ${literal(constrained)}`,
      );
    }
    const month =
      constrained === ""
        ? OUT_OF_RANGE_MONTH
        : lib.formatUtc(constrained, "en", MONTH_YEAR);
    if (candidate === "") {
      let gap = OUTSIDE_RANGE;
      if (constrained !== "") {
        gap = noDayText(
          lib.formatUtc(anchor, "en", DAY_ONLY),
          lib.formatUtc(constrained, "en", MONTH_ONLY),
        );
      }
      slots.push({
        k,
        month,
        candidate: null,
        gap,
        side: null,
        distance: null,
        chosen: false,
        at: 0,
        label: "",
      });
      continue;
    }

    let side: SideKey | null = null;
    let distance: string | null = null;
    if (referenceUtc !== null) {
      const before = lib.isBeforeUtc(candidate, referenceUtc);
      calls.push(
        `isBeforeUtc(${literal(candidate)}, ${literal(referenceUtc)}); // ${literal(before)}`,
      );
      let earlier = candidate;
      let later = referenceUtc;
      if (before) {
        side = "before";
      } else {
        const same = lib.areUtcEqual(candidate, referenceUtc);
        calls.push(
          `areUtcEqual(${literal(candidate)}, ${literal(referenceUtc)}); // ${literal(same)}`,
        );
        side = same ? "at" : "after";
        earlier = referenceUtc;
        later = candidate;
      }
      const span = lib.diffUtcAsDuration(earlier, later, "days");
      calls.push(
        `diffUtcAsDuration(${literal(earlier)}, ${literal(later)}, "days"); // ${literal(span)}`,
      );
      const text = lib.formatDuration(span, "en", { style: "short" });
      distance = text === "" ? null : text;
    }
    slots.push({
      k,
      month,
      candidate,
      gap: null,
      side,
      distance,
      chosen: false,
      at: place(candidate),
      label: markLabel(lib, candidate, calls),
    });
  }

  for (const slot of slots) {
    if (slot.candidate === null) continue;
    const same = lib.areUtcEqual(slot.candidate, answer);
    calls.push(
      `areUtcEqual(${literal(slot.candidate)}, ${literal(answer)}); // ${literal(same)}`,
    );
    if (same) {
      slot.chosen = true;
      chosenK = slot.k;
      break;
    }
  }

  return {
    anchor,
    drawn: true,
    slots,
    ticks: ticks.map((t) => ({
      j: t.j,
      label: lib.formatUtc(t.instant, "en", MONTH_YEAR),
      at: place(t.instant),
    })),
    referenceAt: referenceUtc === null ? null : place(referenceUtc),
    referenceLabel:
      referenceUtc === null ? "" : markLabel(lib, referenceUtc, calls),
    chosenK,
    beyond: chosenK === null,
    calls,
  };
}

// ---------------------------------------------------------------------------
// The whole model
// ---------------------------------------------------------------------------

export interface MetarModel {
  reference: ReferenceModel;
  answer: AnswerResult;
  strip: StripModel;
  /** The calls shown with the answer, in the order they ran. */
  calls: string[];
  /** The calls shown under "Strip calls": the bounds, the anchor, the slider's text and the strip. */
  stripCalls: string[];
  /** The slider's value text. */
  sliderText: string;
  sliderEnds: readonly [string, string];
}

/** Everything the page draws that depends on the typed fields. */
export function buildModel(lib: AviationLib, state: MetarState): MetarModel {
  const reference = referenceModel(lib, state);
  const answer = readAnswer(lib, state, reference.current);
  const stripCalls: string[] = [...reference.boundCalls];
  // At a shift of 0 the answer is the anchor; otherwise the anchor is one call of its own.
  const anchor = anchorOf(
    lib,
    state,
    reference.shift === 0 && !answer.blank ? answer.answer : null,
    stripCalls,
  );
  const text = sliderText(lib, reference, stripCalls);
  const strip = buildStrip(lib, anchor, answer.answer, reference.utc);
  stripCalls.push(...strip.calls);
  return {
    reference,
    answer,
    strip,
    calls: [...reference.calls, ...answer.calls],
    stripCalls,
    sliderText: text,
    sliderEnds: sliderEnds(lib, reference),
  };
}

// ---------------------------------------------------------------------------
// Printed calls at their widest, for the frames' reserved height
// ---------------------------------------------------------------------------

/**
 * The calls at their widest: the lines the mount prints, built by the same functions over a
 * library whose every call takes its longest path. A frame is the hidden twin's height, so it
 * holds one height whatever the reader types.
 */
function widestLib(): AviationLib {
  let n = 0;
  return {
    parseMetarTime: () => "",
    isValidMetarTime: () => false,
    isValidInstant: () => true,
    toOffsetInstant: () => ({
      instant: "2024-07-01T00:05:00Z",
      offset: "+02:00",
    }),
    fromOffsetInstant: () => "2024-07-01T02:05:00+02:00",
    addUtc: () => {
      n += 1;
      return `2024-${String((n % 12) + 1).padStart(2, "0")}-01T00:05:00Z`;
    },
    startOfUtc: (v: string) => v,
    diffUtc: () => 44640,
    diffUtcAsDuration: () => "P31D",
    isBeforeUtc: () => false,
    areUtcEqual: () => false,
    formatUtc: () => "Jun 2024",
    formatDuration: () => "31 days",
    spanNs: () => 1n,
  } as unknown as AviationLib;
}

export type CallsSection = "answer" | "strip";

export function callsSizerText(section: CallsSection): string {
  const lib = widestLib();
  const state: MetarState = {
    group: "251200z",
    reference: "2024-07-01T00:05:00+02:00",
    shift: 60,
  };
  const reference = referenceModel(lib, state);
  if (section === "answer") {
    // Slid, refused, and with the case probe run: every printed call.
    const read = readAnswer(
      {
        ...lib,
        isValidMetarTime: () => true,
      } as unknown as AviationLib,
      state,
      reference.current,
    );
    return [...reference.calls, ...read.calls].join("\n");
  }
  const stripCalls: string[] = [...reference.boundCalls];
  sliderText(lib, reference, stripCalls);
  stripCalls.push(
    ...buildStrip(
      lib,
      "2024-06-30T23:50:00Z",
      "2024-06-30T23:50:00Z",
      "2024-07-01T00:05:00Z",
    ).calls,
  );
  stripCalls.push(
    `parseMetarTime("251200z", "2024-07-01T00:05:00+02:00"); // ""`,
  );
  return stripCalls.join("\n");
}

// ===========================================================================
// Section 2 · NOTAM validity
// ===========================================================================
//
// Items B) and C) are read one at a time with `parseNotamValidity`, in a window the reader
// states. The model computes no date: an instant, an estimate and "permanent" are what the
// library returned. Ordering the two items is outside the library's scope, so it is outside
// this page's: no B)-against-C) check and no length of validity.

/** What a plate reads for item C) `PERM`: the library returned no instant, on purpose. */
export const PERMANENT_TEXT = "permanent, no date";

/** The widest instant a NOTAM plate shows. */
export const NOTAM_INSTANT_SAMPLE = "9999-12-31T23:59:00Z";

/** Where a preset marks a fault no probe can tell from a bad shape. */
export type NotamFaultKey = "end2400" | "wie" | "ufn" | "spaceBeforeEst";

export interface NotamPreset {
  id: string;
  label: string;
  description: string;
  /** Item B), exactly as typed. */
  itemB: string;
  /** Item C), exactly as typed. */
  itemC: string;
  /** `"rolling"`, a first year as text, or `""` for no window. */
  window: string;
  /** A fault the preset marks on one of its own items, for that exact value. */
  fault?: { item: "b" | "c"; key: NotamFaultKey };
}

const WINDOW_NOTE = "The window is this example's pick: change it.";

export const NOTAM_PRESETS: readonly NotamPreset[] = [
  {
    id: "opadd-estimate",
    label: "OPADD example: an estimated end",
    description: `OPADD's own example: in force from 1 July 2014 at 12:00, ending about 3 July at 12:30, to be replaced or cancelled by a later NOTAM. ${WINDOW_NOTE}`,
    itemB: "1407011200",
    itemC: "1407031230EST",
    window: "2000",
  },
  {
    id: "opadd-pair",
    label: "OPADD example: a firm end",
    description: `Ten digits each: the NOTAM ends at the time it says. ${WINDOW_NOTE}`,
    itemB: "1407011200",
    itemC: "1407022030",
    window: "2000",
  },
  {
    id: "permanent",
    label: "Permanent",
    description: `PERM in item C) is information that goes into the AIP. It has no end date. ${WINDOW_NOTE}`,
    itemB: "2506151200",
    itemC: "PERM",
    window: "2000",
  },
  {
    id: "archive",
    label: "An archive window",
    description:
      "A window from 1950 places 99 in 1999 and 50 in 2050. The window is this example's pick: change it.",
    itemB: "9912312359",
    itemC: "5001010000",
    window: "1950",
  },
  {
    id: "rolling",
    label: "A rolling window",
    description:
      "A live feed's window moves with today, so the same two digits can mean another year next century.",
    itemB: "7506151200",
    itemC: "7606151200",
    window: "rolling",
  },
  {
    id: "no-window",
    label: "No window",
    description:
      "Nothing says which century 25 is, so the reader states it. Without a window there is no date, and PERM is refused too.",
    itemB: "2506151200",
    itemC: "PERM",
    window: "",
  },
  {
    id: "est-in-b",
    label: "EST in item B)",
    description: `The library reads it. ICAO allows EST in item C) only, so the page adds a note. ${WINDOW_NOTE}`,
    itemB: "1407031230EST",
    itemC: "PERM",
    window: "2000",
  },
  {
    id: "end-2400",
    label: "Write the end of a day as 2400",
    description: `ICAO writes the end of a day as 2359. GMT corrects nothing. ${WINDOW_NOTE}`,
    itemB: "2506151200",
    itemC: "2506152400",
    window: "2000",
    fault: { item: "c", key: "end2400" },
  },
  {
    id: "wie",
    label: "WIE in item B)",
    description: `Some feeds write WIE ("with immediate effect"). OPADD does not allow it. ${WINDOW_NOTE}`,
    itemB: "WIE",
    itemC: "2506151200",
    window: "2000",
    fault: { item: "b", key: "wie" },
  },
  {
    id: "ufn",
    label: "UFN in item C)",
    description: `Some feeds write UFN ("until further notice"). OPADD does not allow it. ${WINDOW_NOTE}`,
    itemB: "2506151200",
    itemC: "UFN",
    window: "2000",
    fault: { item: "c", key: "ufn" },
  },
  {
    id: "space-before-est",
    label: "A space before EST",
    description: `EST follows the ten digits directly. ${WINDOW_NOTE}`,
    itemB: "1407011200",
    itemC: "1407031230 EST",
    window: "2000",
    fault: { item: "c", key: "spaceBeforeEst" },
  },
  {
    id: "lower-case",
    label: "Lower case",
    description: `The letters of PERM and EST are upper case only. ${WINDOW_NOTE}`,
    itemB: "2506151200",
    itemC: "perm",
    window: "2000",
  },
];

/** The preset the tool opens its NOTAM section with when a link or the chat names nothing. */
export const DEFAULT_NOTAM_PRESET_ID = "opadd-estimate";

export interface NotamState {
  /** Item B) as typed: never trimmed, never upper-cased. */
  itemB: string;
  /** Item C) as typed. */
  itemC: string;
  mode: "fixed" | "rolling";
  /** The first year as typed; unused while `mode` is rolling. */
  first: string;
}

export function blankNotam(): NotamState {
  return { itemB: "", itemC: "", mode: "fixed", first: "" };
}

export function notamPresetState(preset: NotamPreset): NotamState {
  return {
    itemB: preset.itemB,
    itemC: preset.itemC,
    mode: preset.window === "rolling" ? "rolling" : "fixed",
    first: preset.window === "rolling" ? "" : preset.window,
  };
}

/** The window as one string: `"rolling"`, the first year as typed, or `""`. */
export function notamWindowOf(state: NotamState): string {
  return state.mode === "rolling" ? "rolling" : state.first;
}

export interface NotamArgs {
  /** A NOTAM preset id, from a permalink. */
  notamPreset?: string;
  /** Item B) as typed. The chat tool calls it `itemB`. */
  b?: string;
  /** Item C) as typed. The chat tool calls it `itemC`. */
  c?: string;
  /** `"rolling"`, a year as text or a number, or `""` for no window. */
  window?: string | number;
}

const NOTAM_ARG_KEYS = ["notamPreset", "b", "c", "window"] as const;

/** Whether the args seed the NOTAM section. */
export function isNotamSeeded(args: NotamArgs): boolean {
  return NOTAM_ARG_KEYS.some((k) => args[k] !== undefined);
}

/**
 * Seed arguments as controls. A link or a call with no `window` opens with the window blank: a
 * preset's window is taken only through the preset's own id, and the chat never picks a century.
 */
export function readNotamArgs(args: NotamArgs): NotamState {
  const named = NOTAM_PRESETS.find((p) => p.id === args.notamPreset);
  const state = named === undefined ? blankNotam() : notamPresetState(named);
  if (typeof args.b === "string") state.itemB = args.b;
  if (typeof args.c === "string") state.itemC = args.c;
  if (args.window === "rolling") {
    state.mode = "rolling";
    state.first = "";
  } else if (typeof args.window === "number") {
    state.mode = "fixed";
    state.first = String(args.window);
  } else if (typeof args.window === "string") {
    state.mode = "fixed";
    state.first = args.window;
  }
  return state;
}

/** The preset the controls match, or `custom`. */
export function matchNotamPreset(state: NotamState): string {
  const hit = NOTAM_PRESETS.find(
    (p) =>
      p.itemB === state.itemB &&
      p.itemC === state.itemC &&
      p.window === notamWindowOf(state),
  );
  return hit ? hit.id : CUSTOM_PRESET_ID;
}

/** The permalink payload: `{ notamPreset }` while a preset matches, else the fields as typed. */
export function notamPermalinkOf(state: NotamState): Record<string, unknown> {
  const notamPreset = matchNotamPreset(state);
  if (notamPreset !== CUSTOM_PRESET_ID) return { notamPreset };
  return {
    b: state.itemB,
    c: state.itemC,
    window: notamWindowOf(state),
  };
}

/**
 * The options every NOTAM call takes. A blank or non-integer first year sends no `yearWindow`,
 * so the library answers with its sentinel; an integer goes through whatever it is.
 */
export function notamOptionsOf(state: NotamState): YearWindowOptions {
  if (state.mode === "rolling") return { yearWindow: "rolling" };
  const text = state.first.trim();
  return INTEGER.test(text) ? { yearWindow: Number(text) } : {};
}

export type NotamReasonKey =
  | "emptyB"
  | "emptyC"
  | "read"
  | "estimated"
  | "permanent"
  | "markedInB"
  | "noWindow"
  | "lowerCase"
  | "end2400"
  | "wie"
  | "ufn"
  | "spaceBeforeEst"
  | "shape";

export const NOTAM_REASONS: Record<NotamReasonKey, string> = {
  emptyB:
    "Type item B) as ten digits, YYMMDDHHMM, such as 1407011200, to read it.",
  emptyC:
    "Type item C) as ten digits, ten digits then EST, or PERM, to read it.",
  read: "Ten digits name one instant in UTC, read in the window you gave.",
  estimated:
    "An estimated end. It needs a later NOTAM to replace or cancel it.",
  permanent: "Permanent information. No end date to compare against.",
  markedInB:
    "ICAO allows EST and PERM in item C) only. A reader of item B) treats this as malformed.",
  noWindow: "A two-digit year names no century. State the window.",
  lowerCase: "Letters are upper case only.",
  end2400: "ICAO writes the end of a day as 2359; GMT corrects nothing.",
  wie: "OPADD does not allow WIE or UFN; GMT corrects nothing.",
  ufn: "OPADD does not allow WIE or UFN; GMT corrects nothing.",
  spaceBeforeEst: "No space before EST.",
  shape:
    "Not an item B) or C) value: ten digits YYMMDDHHMM, ten digits then EST, or PERM.",
};

export interface NotamItemResult {
  /** Nothing was typed: no call was made. */
  blank: boolean;
  /** `parseNotamValidity`, or `null` for the sentinel (also while blank). */
  value: NotamValidity | null;
  /** `isValidNotamValidity`, or `null` while nothing was typed. */
  valid: boolean | null;
  reason: NotamReasonKey;
  calls: string[];
}

/**
 * Read one item. A refusal is named by asking the library again, each probe printed:
 *
 * 1. **No window.** The state states none.
 * 2. **The case.** The item upper-cased. `toUpperCase` does not depend on the locale.
 * 3. **A preset's own fault**, for that exact item value: no probe tells these from a bad shape.
 *
 * Whatever is left has the wrong shape. The item is never trimmed, upper-cased or repaired
 * before the call. A result is described from `kind` and `estimated` only.
 */
export function readNotamItem(
  lib: AviationLib,
  state: NotamState,
  which: "b" | "c",
): NotamItemResult {
  const item = which === "b" ? state.itemB : state.itemC;
  if (item === "") {
    return {
      blank: true,
      value: null,
      valid: null,
      reason: which === "b" ? "emptyB" : "emptyC",
      calls: [],
    };
  }
  const options = notamOptionsOf(state);
  const shown = literal(options);
  const calls: string[] = [];
  const value = lib.parseNotamValidity(item, options);
  calls.push(
    `parseNotamValidity(${literal(item)}, ${shown}); // ${literal(value)}`,
  );
  const valid = lib.isValidNotamValidity(item, options);
  calls.push(
    `isValidNotamValidity(${literal(item)}, ${shown}); // ${literal(valid)}`,
  );
  if (value !== null) {
    let reason: NotamReasonKey = "read";
    if (which === "b" && (value.kind === "permanent" || value.estimated)) {
      reason = "markedInB";
    } else if (value.kind === "permanent") {
      reason = "permanent";
    } else if (value.estimated) {
      reason = "estimated";
    }
    return { blank: false, value, valid, reason, calls };
  }

  let reason: NotamReasonKey;
  if (options.yearWindow === undefined) {
    reason = "noWindow";
  } else {
    const upper = item.toUpperCase();
    let upperReads = false;
    if (upper !== item) {
      upperReads = lib.isValidNotamValidity(upper, options);
      calls.push(
        `isValidNotamValidity(${literal(upper)}, ${shown}); // ${literal(upperReads)}`,
      );
    }
    const fault = NOTAM_PRESETS.find(
      (p) =>
        p.fault !== undefined &&
        p.fault.item === which &&
        (which === "b" ? p.itemB : p.itemC) === item,
    )?.fault?.key;
    if (upperReads) reason = "lowerCase";
    else if (fault !== undefined) reason = fault;
    else reason = "shape";
  }
  return { blank: false, value: null, valid, reason, calls };
}

export interface NotamModel {
  b: NotamItemResult;
  c: NotamItemResult;
  /** The printed calls, item B) then item C), in the order they ran. */
  calls: string[];
}

export function buildNotamModel(
  lib: AviationLib,
  state: NotamState,
): NotamModel {
  const b = readNotamItem(lib, state, "b");
  const c = readNotamItem(lib, state, "c");
  return { b, c, calls: [...b.calls, ...c.calls] };
}

/** The NOTAM calls at their widest: both items refused, with the case probe run. */
export function notamCallsSizerText(): string {
  const lib = {
    parseNotamValidity: () => null,
    isValidNotamValidity: () => false,
  } as unknown as AviationLib;
  const state: NotamState = {
    itemB: "1407031230est",
    itemC: "1407031230est",
    mode: "rolling",
    first: "",
  };
  return buildNotamModel(lib, state).calls.join("\n");
}
