/**
 * Pure facts for the Operating Schedule Checker.
 *
 * The reader pastes an `OperatingSchedule` as JSON and types an interval. `checkSchedule` makes
 * the calls and returns what they said: refused, closed or open. The tool draws the library's
 * answers and computes none. It holds no list of weekday keys, time patterns, date limits or zone
 * rules, so a schedule is refused exactly when `isValidOperatingSchedule` says so. The refused
 * parts are named by asking the library again (`schedule-probe.ts`).
 *
 * No DOM. The text is parsed with `JSON.parse` here and nowhere else, and is passed on as
 * typed: windows, dates and zones are never trimmed or repaired. The interval's two boxes are
 * never defaulted.
 */

import {
  OPERATING_SCHEDULE_PRESETS,
  type OperatingSchedulePreset,
} from "~/data/operating-schedule-presets";
import { runCall, type EdiCall } from "./edi-widgets";
import type { HoursLib } from "./hours-lib";
import { probeScheduleParts, type ScheduleProbe } from "./schedule-probe";
import { SCHEDULE_TEXT_MAX } from "./schedule-text-max";

export {
  OPERATING_SCHEDULE_PRESETS,
  SCHEDULE_TEXT_MAX,
  type OperatingSchedulePreset,
  type ScheduleProbe,
};

export const CUSTOM_PRESET_ID = "custom";

/** The interval's boxes take this many characters. */
export const INTERVAL_MAX_CHARS = 64;

export type Interval = ReturnType<HoursLib["operatingIntervals"]>[number];

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

export const NOT_JSON_TEXT = "Not JSON";
export const REFUSED_TITLE = "Refused";
export const CLOSED_TITLE = "Closed in this interval";
export const OPEN_TITLE = "Open in this interval";
const NO_INTERVAL_DETAIL = "Type an interval to see whether it is open.";
const NOT_JSON_DETAIL = "Paste the schedule as JSON.";
const NO_SIGNAL_MARK = "⟨ NO SIGNAL ⟩";
const REFUSED_DETAIL = `${NO_SIGNAL_MARK} isValidOperatingSchedule returns false, so operatingIntervals returns [] for it.`;
const INTERVAL_REFUSED_DETAIL = `${NO_SIGNAL_MARK} isValidInterval returns false for this interval, so operatingIntervals returns [] for it.`;
const CLOSED_DETAIL =
  "The schedule is valid and has no open time here: operatingIntervals returns [].";
const OPEN_DETAIL = "The schedule is valid and open for part of this interval.";
const VALID_TITLE = "Valid";
const NOT_CHECKED_TITLE = "Not checked";

/** The sentences under a refused verdict, one per part the library refuses on its own. */
export function refusedLines(probe: ScheduleProbe): string[] {
  switch (probe.kind) {
    case "accepted":
      return [];
    case "not-an-object":
      return ["A schedule is an object with a `timeZone` and a `weekly`."];
    case "zone-refused":
      return [
        "The zone is refused. The other parts are checked once it is accepted.",
      ];
    case "refused-together":
      return [
        "Every part is accepted on its own. Together they are refused, for example two overrides for one date.",
      ];
    case "parts-refused":
      return probe.parts.map((p) => `${p} is refused on its own.`);
  }
}

// ---------------------------------------------------------------------------
// State and seeds
// ---------------------------------------------------------------------------

/** The widget's controls, as strings, which is what the DOM holds. */
export interface CheckerState {
  schedule: string;
  start: string;
  end: string;
}

/** Seed arguments: the chat tool's input and a permalink's strings. */
export interface ScheduleCheckerArgs {
  schedule?: string;
  start?: string;
  end?: string;
  preset?: string;
}

const isBlank = (s: string | undefined): boolean =>
  s === undefined || s.trim() === "";

/** Whether the args name anything, so the widget opens on them and not on the first preset. */
export function isSeeded(args: ScheduleCheckerArgs): boolean {
  return !isBlank(args.schedule) || args.preset !== undefined;
}

/** The state of a preset. */
export function presetState(p: OperatingSchedulePreset): CheckerState {
  return { schedule: p.text, start: p.start, end: p.end };
}

/**
 * The seed as control values. A schedule the args leave out comes from the named preset, or from
 * the first one. The interval is never defaulted: a preset gives its own, text given without one
 * leaves the boxes empty.
 */
export function readArgs(args: ScheduleCheckerArgs): CheckerState {
  const named = OPERATING_SCHEDULE_PRESETS.find((p) => p.id === args.preset);
  const base = named ?? OPERATING_SCHEDULE_PRESETS[0]!;
  const fromPreset = args.schedule === undefined || named !== undefined;
  return {
    schedule: isBlank(args.schedule) ? base.text : (args.schedule ?? ""),
    start: args.start ?? (fromPreset ? base.start : ""),
    end: args.end ?? (fromPreset ? base.end : ""),
  };
}

/** The permalink's strings: what is typed, and nothing for an empty box. */
export function permalinkOf(state: CheckerState): Record<string, string> {
  const out: Record<string, string> = {};
  if (state.schedule !== "") out["schedule"] = state.schedule;
  if (state.start !== "") out["start"] = state.start;
  if (state.end !== "") out["end"] = state.end;
  return out;
}

/** The preset whose text the box holds, or `custom`. */
export function matchPreset(text: string): string {
  return (
    OPERATING_SCHEDULE_PRESETS.find((p) => p.text === text)?.id ??
    CUSTOM_PRESET_ID
  );
}

// ---------------------------------------------------------------------------
// The check
// ---------------------------------------------------------------------------

export type Calls = readonly EdiCall[];

export type CheckerFacts =
  /** The text is not JSON: the text area's own error, and no call was made. */
  | { kind: "not-json" }
  /** `isValidOperatingSchedule` returned `false`. `calls` holds `operatingIntervals` too, when an interval is typed. */
  | { kind: "refused"; probe: ScheduleProbe; calls: Calls }
  /** The schedule is valid and the interval is blank: `operatingIntervals` was not called. */
  | { kind: "no-interval"; calls: Calls }
  /** The schedule is valid and `isValidInterval` refused the interval. */
  | { kind: "interval-refused"; calls: Calls }
  /** The schedule is valid and `operatingIntervals` returned `[]`. */
  | { kind: "closed"; calls: Calls }
  | {
      kind: "open";
      intervals: readonly Interval[];
      openTime: string;
      calls: Calls;
    };

/** Which of the interval's boxes are filled. A box is blank only when it is the empty string. */
const hasInterval = (s: CheckerState): boolean =>
  s.start !== "" && s.end !== "";

/** Makes the calls for one state and says what they returned. */
export function checkSchedule(
  lib: HoursLib,
  state: CheckerState,
): CheckerFacts {
  let schedule: unknown;
  try {
    schedule = JSON.parse(state.schedule);
  } catch {
    return { kind: "not-json" };
  }
  const range = { start: state.start, end: state.end };
  const valid = runCall(lib, "isValidOperatingSchedule", schedule);
  if (valid.result !== true) {
    const calls = hasInterval(state)
      ? [valid, runCall(lib, "operatingIntervals", schedule, range)]
      : [valid];
    return {
      kind: "refused",
      probe: probeScheduleParts(schedule, lib.isValidOperatingSchedule),
      calls,
    };
  }
  if (!hasInterval(state)) return { kind: "no-interval", calls: [valid] };
  const interval = runCall(lib, "isValidInterval", range);
  const found = runCall(lib, "operatingIntervals", schedule, range);
  const calls = [valid, interval, found];
  if (interval.result !== true) return { kind: "interval-refused", calls };
  const intervals = found.result as Interval[];
  if (intervals.length === 0) return { kind: "closed", calls };
  const time = runCall(
    lib,
    "operatingTimeBetween",
    state.start,
    state.end,
    schedule,
  );
  return {
    kind: "open",
    intervals,
    openTime: time.result as string,
    calls: [...calls, time],
  };
}

/** The verdict line's tone, title and detail for one reading. */
export interface CheckerVerdict {
  tone: "neutral" | "sentinel";
  title: string;
  detail: string;
}

/** Every verdict the tool can show, so its box can hold the largest. */
export const VERDICTS = {
  notJson: {
    tone: "neutral",
    title: NOT_CHECKED_TITLE,
    detail: NOT_JSON_DETAIL,
  },
  refused: { tone: "sentinel", title: REFUSED_TITLE, detail: REFUSED_DETAIL },
  intervalRefused: {
    tone: "sentinel",
    title: REFUSED_TITLE,
    detail: INTERVAL_REFUSED_DETAIL,
  },
  noInterval: {
    tone: "neutral",
    title: VALID_TITLE,
    detail: NO_INTERVAL_DETAIL,
  },
  closed: { tone: "neutral", title: CLOSED_TITLE, detail: CLOSED_DETAIL },
  open: { tone: "neutral", title: OPEN_TITLE, detail: OPEN_DETAIL },
} as const satisfies Record<string, CheckerVerdict>;

/** The verdict for a reading. Closed and open are plain words, never the sentinel's amber. */
export function verdictOf(facts: CheckerFacts): CheckerVerdict {
  switch (facts.kind) {
    case "not-json":
      return VERDICTS.notJson;
    case "refused":
      return VERDICTS.refused;
    case "interval-refused":
      return VERDICTS.intervalRefused;
    case "no-interval":
      return VERDICTS.noInterval;
    case "closed":
      return VERDICTS.closed;
    case "open":
      return VERDICTS.open;
  }
}

/** What `isValidOperatingSchedule` said, or `null` when no call was made. */
export function validResult(facts: CheckerFacts): boolean | null {
  return facts.kind === "not-json" ? null : facts.calls[0]?.result === true;
}

/** `operatingIntervals`'s list, or `null` when it was not called. */
export function intervalsResult(
  facts: CheckerFacts,
): readonly Interval[] | null {
  const call =
    "calls" in facts
      ? facts.calls.find((c) => c.fn === "operatingIntervals")
      : undefined;
  return call === undefined ? null : (call.result as Interval[]);
}
