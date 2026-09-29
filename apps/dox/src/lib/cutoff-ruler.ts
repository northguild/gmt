/**
 * Pure helpers for the Cut-off Ruler widget (TRAN-10): one departure's "N
 * days before" read three ways by `cutoffAt` — calendar days, exact hours
 * and a pinned local time — on one axis, with the DST change between them
 * marked.
 *
 * Every reading, and the hours before departure beside it, comes from
 * `cutoffAt` and `timeToCutoff` alone. `@js-temporal/polyfill`'s
 * `getTimeZoneTransition` finds the one DST change between the readings and
 * the departure, for drawing a marker — never to move a reading.
 *
 * No DOM and no gmt import: `CutoffLib` comes in from the mount.
 */

import { Temporal } from "@js-temporal/polyfill";
import {
  isZoneless,
  localLabel,
  type CutoffAtOptions,
  type CutoffLib,
} from "./cutoff-widgets";

export const CUSTOM_PRESET_ID = "custom";

export interface RulerState {
  anchor: string;
  timeZone: string;
  /** `"1"`..`"7"`. */
  days: string;
  atLocalTime: string;
}

export interface CutoffRulerArgs {
  anchor?: string;
  timeZone?: string;
  days?: number | string;
  atLocalTime?: string;
}

export interface RulerPreset {
  id: string;
  label: string;
  description: string;
  anchor: string;
  timeZone: string;
  days: string;
  atLocalTime: string;
}

const NY = "America/New_York";
const AMS = "Europe/Amsterdam";

/** Every preset is a section 9 row (appendix Z). */
export const RULER_PRESETS: readonly RulerPreset[] = [
  {
    id: "new-york-fall-back",
    label: "New York, Monday 4 November 2024: the clocks go back in between",
    description:
      "A ship leaves New York at 18:00 on Monday 4 November 2024. The clocks went back on Sunday, so two calendar days is 49 hours, 48 hours lands at 19:00, and two days at 17:00 is 50 hours: three answers an hour apart.",
    anchor: "2024-11-04T18:00:00-05:00[America/New_York]",
    timeZone: NY,
    days: "2",
    atLocalTime: "17:00",
  },
  {
    id: "amsterdam-june",
    label: "Amsterdam, Friday 14 June 2024: no clock change",
    description:
      "With no clock change in between, two calendar days and 48 hours land on the same 18:00. Only the pinned reading differs, at 17:00.",
    anchor: "2024-06-14T16:00:00Z",
    timeZone: AMS,
    days: "2",
    atLocalTime: "17:00",
  },
  {
    id: "new-york-spring-forward",
    label: "New York, Monday 11 March 2024: the clocks go forward in between",
    description:
      "The clocks went forward on Sunday 10 March, so two calendar days is only 47 hours, and 48 hours lands at 17:00, the same instant as the pinned reading: an agreement by accident.",
    anchor: "2024-03-11T22:00:00Z",
    timeZone: NY,
    days: "2",
    atLocalTime: "17:00",
  },
  {
    id: "repeated-hour",
    label: "1 day before at 01:30, on New York's fall-back night",
    description:
      "01:30 happened twice on 3 November 2024. The pinned reading takes the first pass, 01:30 EDT.",
    anchor: "2024-11-04T23:00:00Z",
    timeZone: NY,
    days: "1",
    atLocalTime: "01:30",
  },
  {
    id: "skipped-hour",
    label: "1 day before at 02:30, on New York's spring-forward night",
    description:
      '02:30 never showed on a New York clock on 10 March 2024. The pinned reading returns "", the other two still resolve.',
    anchor: "2024-03-11T22:00:00Z",
    timeZone: NY,
    days: "1",
    atLocalTime: "02:30",
  },
];

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const numStr = (v: unknown): string => {
  if (typeof v === "number" && Number.isInteger(v)) return String(v);
  return typeof v === "string" ? v : "";
};

export function readArgs(args: CutoffRulerArgs): RulerState {
  return {
    anchor: str(args.anchor),
    timeZone: str(args.timeZone),
    days: numStr(args.days),
    atLocalTime: str(args.atLocalTime),
  };
}

export function presetState(preset: RulerPreset): RulerState {
  return {
    anchor: preset.anchor,
    timeZone: preset.timeZone,
    days: preset.days,
    atLocalTime: preset.atLocalTime,
  };
}

export function matchPreset(state: RulerState): string {
  const t = (s: string) => s.trim();
  const hit = RULER_PRESETS.find(
    (p) =>
      t(p.anchor) === t(state.anchor) &&
      t(p.timeZone) === t(state.timeZone) &&
      t(p.days) === t(state.days) &&
      t(p.atLocalTime) === t(state.atLocalTime),
  );
  return hit ? hit.id : CUSTOM_PRESET_ID;
}

export function permalinkOf(state: RulerState): Record<string, string> {
  const out: Record<string, string> = {};
  const anchor = state.anchor.trim();
  const timeZone = state.timeZone.trim();
  const days = state.days.trim();
  const atLocalTime = state.atLocalTime.trim();
  if (anchor !== "") out.anchor = anchor;
  if (timeZone !== "") out.timeZone = timeZone;
  if (days !== "") out.days = days;
  if (atLocalTime !== "") out.atLocalTime = atLocalTime;
  return out;
}

// ---------------------------------------------------------------------------
// The three readings
// ---------------------------------------------------------------------------

export type RulerReadingKey = "calendar" | "exact" | "pinned";

export interface RulerCallSpec {
  key: RulerReadingKey;
  label: string;
  offset: string;
  options: CutoffAtOptions;
}

/** Building `"PT{24n}H"` from `days` constructs an input; it computes no
 *  result. Each of the three is its own `cutoffAt` call. */
export function readingsOf(state: RulerState): RulerCallSpec[] {
  const n = Number.parseInt(state.days, 10) || 0;
  const timeZone = state.timeZone.trim();
  const atLocalTime = state.atLocalTime.trim();
  const hours = n * 24;
  return [
    {
      key: "calendar",
      label: `${n} calendar days (P${n}D)`,
      offset: `P${n}D`,
      options: { timeZone },
    },
    {
      key: "exact",
      label: `${hours} exact hours (PT${hours}H)`,
      offset: `PT${hours}H`,
      options: { timeZone },
    },
    {
      key: "pinned",
      label: `${n} days before at ${atLocalTime}`,
      offset: `P${n}D`,
      options: atLocalTime === "" ? { timeZone } : { timeZone, atLocalTime },
    },
  ];
}

export interface RulerReading {
  key: RulerReadingKey;
  label: string;
  offset: string;
  atLocalTime: string | undefined;
  at: string;
  hoursBefore: string;
}

export interface RulerFacts {
  readings: RulerReading[];
  departure: string;
}

/**
 * Each reading stands alone: one `""` (R5's pinned reading) does not blank
 * the others.
 */
export function collectRulerFacts(
  state: RulerState,
  lib: CutoffLib,
): RulerFacts {
  const anchor = state.anchor.trim();
  const timeZone = state.timeZone.trim();
  const specs = readingsOf(state);
  const readings = specs.map((spec) => {
    const at = lib.cutoffAt(anchor, spec.offset, spec.options);
    return {
      key: spec.key,
      label: spec.label,
      offset: spec.offset,
      atLocalTime: spec.options.atLocalTime,
      at,
      hoursBefore: lib.timeToCutoff(at, anchor),
    };
  });
  return { readings, departure: lib.etaAtZone(anchor, timeZone) };
}

// ---------------------------------------------------------------------------
// Why null
// ---------------------------------------------------------------------------

export type RulerNullReason =
  | "invalid-zone"
  | "zoneless-anchor"
  | "invalid-anchor"
  | "invalid-offset"
  | "invalid-time"
  | "skipped-hour";

const RULER_NULL_TEXT: Record<RulerNullReason, string> = {
  "invalid-zone": "The terminal clock is not a time zone this browser knows.",
  "zoneless-anchor":
    "The departure has no offset or zone, so it is not a moment. Write its offset, or its zone in brackets.",
  "invalid-anchor": "The departure is not an instant or a zoned date-time.",
  "invalid-offset":
    "This offset is not an ISO 8601 duration such as P2D or PT48H, or it leaves the range of instants.",
  "invalid-time": "This local time is not a time of day such as 17:00.",
  "skipped-hour":
    'This reading lands on a local time the clock skipped that day. cutoffAt never shifts a skipped time: it returns "".',
};

export function rulerNullText(reason: RulerNullReason): string {
  return RULER_NULL_TEXT[reason];
}

/**
 * Why a `""` reading came back, in the same probe order `stackNullReason`
 * uses for a zone, an anchor, an offset, a local time and a skipped hour
 * (steps 1, 5 and 6 there) — worded for one cut-off rather than a stack.
 * `null` when the reading is not `""`.
 */
export function rulerNullReason(
  reading: RulerReading,
  state: RulerState,
  lib: CutoffLib,
): RulerNullReason | null {
  if (reading.at !== "") return null;
  const anchor = state.anchor.trim();
  const timeZone = state.timeZone.trim();

  if (!lib.isValidTimeZone(timeZone)) return "invalid-zone";
  if (lib.cutoffAt(anchor, "PT0S", { timeZone }) === "") {
    return isZoneless(anchor, lib) ? "zoneless-anchor" : "invalid-anchor";
  }
  if (lib.cutoffAt(anchor, reading.offset, { timeZone: "UTC" }) === "") {
    return "invalid-offset";
  }
  if (
    reading.atLocalTime !== undefined &&
    lib.cutoffAt(anchor, "PT0S", {
      timeZone: "UTC",
      atLocalTime: reading.atLocalTime,
    }) === ""
  ) {
    return "invalid-time";
  }
  return "skipped-hour";
}

// ---------------------------------------------------------------------------
// The DST transition between the readings and the departure — for drawing
// ---------------------------------------------------------------------------

export interface RulerTransition {
  /** The transition instant, as an ISO instant string. */
  instant: string;
  before: string;
  after: string;
  wallBefore: string;
  wallAfter: string;
}

function parseOffsetMinutes(offset: string): number {
  const m = /^([+-])(\d{2}):(\d{2})/.exec(offset);
  if (!m) return 0;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * The next DST transition between the earliest resolved reading and the
 * departure, from the polyfill's own `getTimeZoneTransition("next")` —
 * drawing only, never a reading's own instant. `null` with no resolved
 * readings, no transition before the departure, or a transition with no
 * offset change.
 */
export function transitionBetween(
  state: RulerState,
  facts: RulerFacts,
): RulerTransition | null {
  const timeZone = state.timeZone.trim();
  const resolved = facts.readings.map((r) => r.at).filter((a) => a !== "");
  if (resolved.length === 0 || facts.departure === "") return null;
  try {
    const earliestMs = Math.min(
      ...resolved.map((a) => Temporal.Instant.from(a).epochMilliseconds),
    );
    const departureMs = Temporal.Instant.from(
      facts.departure,
    ).epochMilliseconds;
    const cur =
      Temporal.Instant.fromEpochMilliseconds(earliestMs).toZonedDateTimeISO(
        timeZone,
      );
    const next = cur.getTimeZoneTransition("next");
    if (!next || next.epochMilliseconds > departureMs) return null;
    const before = cur.offset;
    const after = next.offset;
    if (before === after) return null;
    const gapMinutes = parseOffsetMinutes(after) - parseOffsetMinutes(before);
    const afterTime = next.toPlainTime();
    const beforeTime = afterTime.subtract({ minutes: gapMinutes });
    return {
      instant: next.toInstant().toString(),
      before,
      after,
      wallBefore: `${pad2(beforeTime.hour)}:${pad2(beforeTime.minute)}`,
      wallAfter: `${pad2(afterTime.hour)}:${pad2(afterTime.minute)}`,
    };
  } catch {
    return null;
  }
}

/** `"Clocks go back 1 h: Sun 3 Nov, 02:00 → 01:00"` (or "go forward"). The
 *  weekday and date are read from the transition instant with the
 *  polyfill — drawing, not a library call. */
export function transitionLabel(t: RulerTransition, timeZone: string): string {
  const gapMinutes = parseOffsetMinutes(t.after) - parseOffsetMinutes(t.before);
  const direction = gapMinutes < 0 ? "back" : "forward";
  const hours = Math.abs(gapMinutes) / 60;
  const hoursText = hours === 1 ? "1 h" : `${hours} h`;
  const zoned = Temporal.Instant.from(t.instant)
    .toZonedDateTimeISO(timeZone)
    .toString();
  const dateLabel = localLabel(zoned).replace(/\s\d{2}:\d{2}$/, "");
  return `Clocks go ${direction} ${hoursText}: ${dateLabel}, ${t.wallBefore} → ${t.wallAfter}`;
}
