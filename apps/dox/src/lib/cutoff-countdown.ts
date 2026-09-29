/**
 * Pure helpers for the Cut-off Countdown widget (TRAN-10): `isPastCutoff`
 * and `timeToCutoff` compared against the viewer's clock or a dragged time,
 * with the half-open rule shown.
 *
 * Every verdict — on time, closed, late — and every time-left value comes
 * from `isPastCutoff` and `timeToCutoff` alone. `@js-temporal/polyfill` is
 * used only to build the `now` string a slider position or a live clock
 * reading names (`nowFromSlider`) and to size the drawn axis (`axisWindow`)
 * — never to decide late or on time itself.
 *
 * No DOM and no gmt import: `CutoffLib` comes in from the mount.
 */

import { Temporal } from "@js-temporal/polyfill";
import {
  durationText,
  epochMs,
  isZoneless,
  type CutoffLib,
} from "./cutoff-widgets";

export const CUSTOM_PRESET_ID = "custom";

export type CountdownMode = "pinned" | "live";

export interface CountdownState {
  cutoff: string;
  /** The last clock reading, in `live` mode. */
  now: string;
  timeZone: string;
  mode: CountdownMode;
}

export interface CutoffCountdownArgs {
  cutoff?: string;
  now?: string;
  timeZone?: string;
}

export interface CountdownPreset {
  id: string;
  label: string;
  description: string;
  cutoff: string;
  now: string;
  timeZone: string;
}

const AMS = "Europe/Amsterdam";
const NY = "America/New_York";
const GATEIN = "2024-06-12T17:00:00+02:00[Europe/Amsterdam]";

/** Every preset is a section 9 row (appendix Z). */
export const COUNTDOWN_PRESETS: readonly CountdownPreset[] = [
  {
    id: "late",
    label: "Gate-in closed at 17:00; you arrive at 17:20",
    description:
      "Gate-in at the Rotterdam terminal closed at 17:00 on 12 June 2024. You arrive at 17:20: twenty minutes late, and timeToCutoff says so with a negative duration.",
    cutoff: GATEIN,
    now: "2024-06-12T17:20:00+02:00",
    timeZone: AMS,
  },
  {
    id: "on-time",
    label: "You arrive at 16:10: 50 minutes to spare",
    description: "Fifty minutes before the cut-off: not past, PT50M left.",
    cutoff: GATEIN,
    now: "2024-06-12T16:10:00+02:00",
    timeZone: AMS,
  },
  {
    id: "at-cutoff",
    label: "You arrive at 17:00 exactly: already closed",
    description:
      "At 17:00:00 exactly the window has closed. The window to meet a cut-off is half-open, so isPastCutoff is true and timeToCutoff is PT0S.",
    cutoff: GATEIN,
    now: "2024-06-12T17:00:00+02:00",
    timeZone: AMS,
  },
  {
    id: "other-clock",
    label: "Now read on a New York clock: 11:00",
    description:
      "The same instant written on a New York clock. Both are compared as instants, so the zone each is written in does not matter.",
    cutoff: GATEIN,
    now: "2024-06-12T11:00:00-04:00[America/New_York]",
    timeZone: AMS,
  },
  {
    id: "repeated-hour",
    label: "Two 01:30s on New York's fall-back night",
    description:
      "The cut-off is the first 01:30, EDT. Now is the second 01:30, EST, an hour later. The offsets tell them apart.",
    cutoff: "2024-11-03T01:30:00-04:00[America/New_York]",
    now: "2024-11-03T01:30:00-05:00[America/New_York]",
    timeZone: NY,
  },
  {
    id: "zoneless-now",
    label: "Now with no offset: not a moment",
    description:
      "A wall time with no offset is not a moment. isPastCutoff returns false, which here means invalid input, not on time.",
    cutoff: GATEIN,
    now: "2024-06-12T17:20:00",
    timeZone: AMS,
  },
];

const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** `now` present -> `pinned`; absent -> `live`. */
export function readArgs(args: CutoffCountdownArgs): CountdownState {
  return {
    cutoff: str(args.cutoff),
    now: str(args.now),
    timeZone: str(args.timeZone),
    mode: args.now !== undefined ? "pinned" : "live",
  };
}

export function presetState(preset: CountdownPreset): CountdownState {
  return {
    cutoff: preset.cutoff,
    now: preset.now,
    timeZone: preset.timeZone,
    mode: "pinned",
  };
}

export function matchPreset(state: CountdownState): string {
  if (state.mode !== "pinned") return CUSTOM_PRESET_ID;
  const t = (s: string) => s.trim();
  const hit = COUNTDOWN_PRESETS.find(
    (p) =>
      t(p.cutoff) === t(state.cutoff) &&
      t(p.now) === t(state.now) &&
      t(p.timeZone) === t(state.timeZone),
  );
  return hit ? hit.id : CUSTOM_PRESET_ID;
}

/** Strings only; `now` omitted in `live` mode. */
export function permalinkOf(state: CountdownState): Record<string, string> {
  const out: Record<string, string> = {};
  const cutoff = state.cutoff.trim();
  const timeZone = state.timeZone.trim();
  if (cutoff !== "") out.cutoff = cutoff;
  if (timeZone !== "") out.timeZone = timeZone;
  if (state.mode === "pinned") {
    const now = state.now.trim();
    if (now !== "") out.now = now;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Facts and the verdict — from isPastCutoff / timeToCutoff alone
// ---------------------------------------------------------------------------

export interface CountdownFacts {
  past: boolean;
  left: string;
  nowLocal: string;
  cutoffLocal: string;
}

export function collectCountdownFacts(
  state: CountdownState,
  lib: CutoffLib,
): CountdownFacts {
  const cutoff = state.cutoff.trim();
  const now = state.now.trim();
  const timeZone = state.timeZone.trim();
  return {
    past: lib.isPastCutoff(now, cutoff),
    left: lib.timeToCutoff(now, cutoff),
    nowLocal: lib.etaAtZone(now, timeZone),
    cutoffLocal: lib.etaAtZone(cutoff, timeZone),
  };
}

export type VerdictKind = "none" | "on-time" | "closed" | "late";

export interface Verdict {
  kind: VerdictKind;
  text: string;
}

/** `HH:MM[:SS]` out of a zoned string the library returned. */
function localTimeOf(zoned: string): string {
  const m = /T(\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)/.exec(zoned);
  return m ? m[1]! : "";
}

/**
 * The verdict, from the library alone. `left === ""` means the inputs are
 * invalid, so there is no verdict — the reason aside explains why.
 */
export function verdict(facts: CountdownFacts): Verdict {
  if (facts.left === "") return { kind: "none", text: "" };
  if (!facts.past) {
    return {
      kind: "on-time",
      text: `On time: ${durationText(facts.left)} left.`,
    };
  }
  if (facts.left === "PT0S") {
    const time = localTimeOf(facts.cutoffLocal);
    return {
      kind: "closed",
      text: `Closed: now is the cut-off itself. The window to meet a cut-off is half-open, so at ${time} it has already closed.`,
    };
  }
  return { kind: "late", text: `Late by ${durationText(facts.left)}.` };
}

// ---------------------------------------------------------------------------
// Why null
// ---------------------------------------------------------------------------

export type CountdownNullReason =
  | "no-cutoff"
  | "zoneless-now"
  | "zoneless-cutoff"
  | "invalid-zone"
  | "invalid-instant";

const COUNTDOWN_NULL_TEXT: Record<CountdownNullReason, string> = {
  "no-cutoff":
    'No cut-off. cutoffAt\'s "" sentinel reads as not past: isPastCutoff returns false and timeToCutoff returns "". Check the cut-off is not "" before trusting a false.',
  "zoneless-now":
    "Now has no offset or zone, so it is not a moment. isPastCutoff's false here means invalid input, not on time.",
  "zoneless-cutoff":
    "The cut-off has no offset or zone, so it is not a moment. isPastCutoff's false here means invalid input, not on time.",
  "invalid-zone": "The clock is not a time zone this browser knows.",
  "invalid-instant":
    "Now or the cut-off is not an instant or a zoned date-time.",
};

export function countdownNullText(reason: CountdownNullReason): string {
  return COUNTDOWN_NULL_TEXT[reason];
}

export function countdownNullReason(
  state: CountdownState,
  lib: CutoffLib,
): CountdownNullReason {
  const cutoff = state.cutoff.trim();
  const now = state.now.trim();
  if (cutoff === "") return "no-cutoff";
  if (isZoneless(now, lib)) return "zoneless-now";
  if (isZoneless(cutoff, lib)) return "zoneless-cutoff";
  if (!lib.isValidTimeZone(state.timeZone.trim())) return "invalid-zone";
  return "invalid-instant";
}

// ---------------------------------------------------------------------------
// Drawing: the axis window and the slider's own instant
// ---------------------------------------------------------------------------

export interface AxisWindow {
  startMs: number;
  endMs: number;
}

/** `[min − pad, max + pad]`, `pad = max(30 min, 25% of |now − cutoff|)`,
 *  rounded outward to whole minutes. `null` when either is not a real
 *  instant. */
export function axisWindow(cutoff: string, now: string): AxisWindow | null {
  try {
    const cutoffMs = epochMs(cutoff);
    const nowMs = epochMs(now);
    if (Number.isNaN(cutoffMs) || Number.isNaN(nowMs)) return null;
    const diff = Math.abs(nowMs - cutoffMs);
    const pad = Math.ceil(Math.max(30 * 60_000, diff * 0.25) / 60_000) * 60_000;
    return {
      startMs: Math.min(cutoffMs, nowMs) - pad,
      endMs: Math.max(cutoffMs, nowMs) + pad,
    };
  } catch {
    return null;
  }
}

/** The instant a slider position names: `minutes` away from `cutoff`, read
 *  back in `timeZone` — the input the library is then asked about, never a
 *  verdict computed here. */
export function nowFromSlider(
  cutoff: string,
  minutes: number,
  timeZone: string,
): string {
  try {
    return Temporal.Instant.from(cutoff)
      .add({ minutes })
      .toZonedDateTimeISO(timeZone)
      .toString();
  } catch {
    return "";
  }
}
