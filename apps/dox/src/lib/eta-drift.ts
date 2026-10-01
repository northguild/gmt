/**
 * Pure helpers for the ETA Drift Chart (TRAN-57): `bestAvailable` and
 * `estimateDrift` over the timestamps of one event, plotted by when each was
 * recorded.
 *
 * Every pick, drift, revision count and `exceedsTolerance` comes from a real
 * `PunctualityLib` call. `@js-temporal/polyfill` is used only through
 * `punctuality-widgets.ts` for drawing (instants, tick positions). The tool's
 * one naive value is the latest-recorded event of any class, ties to the later
 * index (`naivePick`).
 *
 * No DOM and no gmt import: the library comes in from the mount.
 */

import type { Temporal } from "@js-temporal/polyfill";
import {
  epochMs,
  isoToMinutes,
  minuteTickLabel,
  minuteTicks,
  walkTicks,
  dayTickLabel,
  hourTickLabel,
  writtenParts,
  type DriftReport,
  type ClassifiedTimestamp,
  type PunctualityLib,
  type TimestampClass,
  type TimestampEvent,
} from "./punctuality-widgets";

export const MAX_EVENTS = 6;

/** Which of the site's four series colours repeats each class. A shape plus a
 *  word always names a class, so the colour only echoes it. ACT is teal, not
 *  green: the most authoritative class must not read as a success colour. */
export const CLASS_SERIES: Readonly<Record<TimestampClass, 1 | 2 | 3 | 4>> = {
  EST: 1,
  PLN: 2,
  REQ: 3,
  ACT: 4,
};
export const CUSTOM_PRESET_ID = "custom";

export interface DriftState {
  /** `"1"` to `"6"`: the first this many events are visible. */
  eventCount: string;
  /** Always six; unused ones are blank strings. */
  events: TimestampEvent[];
  tolerance: string;
}

/** What a chat call or a permalink hands over. */
export interface EtaDriftArgs {
  events?: { classifier: string; at: string; recordedAt: string }[];
  preset?: string;
  eventCount?: string;
  tolerance?: string;
  [key: string]: unknown;
}

export interface DriftPreset {
  id: string;
  label: string;
  description: string;
  events: readonly TimestampEvent[];
  tolerance: string;
}

const ev = (
  classifier: TimestampClass,
  at: string,
  recordedAt: string,
): TimestampEvent => ({ classifier, at, recordedAt });

/** Appendix Z rows E1 to E4. */
const E1: readonly TimestampEvent[] = [
  ev("EST", "2024-06-20T08:00:00Z", "2024-06-01T00:00:00Z"),
  ev("EST", "2024-06-20T12:00:00Z", "2024-06-05T00:00:00Z"),
  ev("EST", "2024-06-20T17:00:00Z", "2024-06-10T00:00:00Z"),
];
const E2: readonly TimestampEvent[] = [
  ev("PLN", "2024-06-15T12:00:00Z", "2024-06-01T00:00:00Z"),
  ev("EST", "2024-06-15T12:40:00Z", "2024-06-14T00:00:00Z"),
  ev("ACT", "2024-06-15T12:52:00Z", "2024-06-15T12:53:00Z"),
  ev("EST", "2024-06-15T13:05:00Z", "2024-06-15T14:00:00Z"),
];
const E3: readonly TimestampEvent[] = [
  ev("EST", "2024-06-15T12:40:00Z", "2024-06-14T00:00:00Z"),
  ev("REQ", "2024-06-15T12:30:00Z", "2024-06-12T00:00:00Z"),
  ev("EST", "2024-06-15T12:45:00Z", "2024-06-14T06:00:00Z"),
];
const E4: readonly TimestampEvent[] = [
  ev("PLN", "2024-06-15T12:00:00Z", "2024-06-01T00:00:00Z"),
  ev("EST", "2024-06-15T12:40:00Z", "2024-06-14T00:00:00Z"),
];

export const ETA_PRESETS: readonly DriftPreset[] = [
  {
    id: "vessel-slide",
    label: "A vessel ETA slides 9 hours against an 8-hour tolerance",
    description:
      "Three estimates of one vessel's arrival on 20 June 2024, recorded on 1, 5 and 10 June: 08:00, 12:00, then 17:00 UTC. The estimate moved 9 hours, more than the 8-hour tolerance. Drag the tolerance to exactly 9 hours: equal does not exceed.",
    events: E1,
    tolerance: "PT8H",
  },
  {
    id: "est-after-act",
    label: "An estimate recorded after the actual",
    description:
      "The vessel berthed at 12:52, recorded at 12:53. At 14:00 a late feed delivered an estimate of 13:05. The newest record is an estimate; bestAvailable still returns the actual. With no tolerance, exceedsTolerance is null.",
    events: E2,
    tolerance: "",
  },
  {
    id: "req-beats-est",
    label: "A requested time beats a later estimate",
    description:
      "A berth was requested for 12:30. Two estimates followed, 12:40 then 12:45. bestAvailable never returns an estimate when a request exists, however much later the estimate was recorded.",
    events: E3,
    tolerance: "PT15M",
  },
  {
    id: "one-estimate",
    label: "One estimate: no drift to measure",
    description:
      "A plan and one estimate. There is no drift from one sample, so estimateDrift returns null. The plan is the best available: an estimate never replaces it.",
    events: E4,
    tolerance: "PT15M",
  },
];

const presetById = (id: string): DriftPreset | undefined =>
  ETA_PRESETS.find((p) => p.id === id);

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const t = (s: string) => s.trim();

const BLANK: TimestampEvent = {
  classifier: "" as TimestampClass,
  at: "",
  recordedAt: "",
};

/** Six slots: the events given, then blanks. */
function padEvents(events: readonly TimestampEvent[]): TimestampEvent[] {
  return Array.from({ length: MAX_EVENTS }, (_, i) => ({
    ...(events[i] ?? BLANK),
  }));
}

export function presetState(preset: DriftPreset): DriftState {
  return {
    eventCount: String(preset.events.length),
    events: padEvents(preset.events),
    tolerance: preset.tolerance,
  };
}

/**
 * The state a chat call or a permalink names. An `events` array (the chat) or
 * flat `classifier1…` keys replace the events and carry no preset, so the
 * tolerance is exactly what the call gives (absent is blank). Otherwise the
 * preset named by `args.preset` (else the first) is the base, and `tolerance`
 * overrides its own (`"none"` clears it).
 */
export function readArgs(args: EtaDriftArgs): DriftState {
  const hasEvents =
    Array.isArray(args.events) || args.classifier1 !== undefined;
  let state: DriftState;
  if (hasEvents) {
    let list: TimestampEvent[];
    if (Array.isArray(args.events)) {
      list = args.events.slice(0, MAX_EVENTS).map((e) => ({
        classifier: str(
          (e as Partial<TimestampEvent> | null)?.classifier,
        ) as TimestampClass,
        at: str((e as Partial<TimestampEvent> | null)?.at),
        recordedAt: str((e as Partial<TimestampEvent> | null)?.recordedAt),
      }));
    } else {
      const declared = Number.parseInt(str(args.eventCount), 10);
      let count = Number.isInteger(declared) ? declared : 0;
      if (count < 1) {
        while (
          count < MAX_EVENTS &&
          args[`classifier${count + 1}`] !== undefined
        ) {
          count++;
        }
      }
      count = Math.min(MAX_EVENTS, Math.max(1, count));
      list = Array.from({ length: count }, (_, i) => ({
        classifier: str(args[`classifier${i + 1}`]) as TimestampClass,
        at: str(args[`at${i + 1}`]),
        recordedAt: str(args[`recordedAt${i + 1}`]),
      }));
    }
    state = {
      eventCount: String(Math.max(1, list.length)),
      events: padEvents(list),
      tolerance: "",
    };
  } else {
    const named =
      typeof args.preset === "string" ? presetById(args.preset) : undefined;
    state = presetState(named ?? ETA_PRESETS[0]!);
  }
  if (args.tolerance !== undefined) {
    const tolerance = str(args.tolerance);
    state.tolerance = tolerance === "none" ? "" : tolerance;
  }
  return state;
}

/** The state a widget opens on: the call's when it names events or a preset,
 *  else the first preset. */
export function initialState(args: EtaDriftArgs): DriftState {
  const seeded =
    args.events !== undefined ||
    args.classifier1 !== undefined ||
    args.preset !== undefined;
  return seeded ? readArgs(args) : presetState(ETA_PRESETS[0]!);
}

/** How many events are visible: 1 to 6. */
export function visibleCount(state: DriftState): number {
  const n = Number.parseInt(state.eventCount, 10);
  return Number.isInteger(n) ? Math.min(MAX_EVENTS, Math.max(1, n)) : 1;
}

/** The visible events, trimmed. */
export function eventsOf(state: DriftState): TimestampEvent[] {
  return state.events.slice(0, visibleCount(state)).map((e) => ({
    classifier: t(e.classifier) as TimestampClass,
    at: t(e.at),
    recordedAt: t(e.recordedAt),
  }));
}

const sameEvents = (
  a: readonly TimestampEvent[],
  b: readonly TimestampEvent[],
): boolean =>
  a.length === b.length &&
  a.every(
    (e, i) =>
      t(e.classifier) === t(b[i]!.classifier) &&
      t(e.at) === t(b[i]!.at) &&
      t(e.recordedAt) === t(b[i]!.recordedAt),
  );

/** The preset whose events and tolerance equal the state's, else `"custom"`. */
export function matchPreset(state: DriftState): string {
  const events = eventsOf(state);
  const hit = ETA_PRESETS.find(
    (p) =>
      sameEvents(p.events, events) && t(p.tolerance) === t(state.tolerance),
  );
  return hit ? hit.id : CUSTOM_PRESET_ID;
}

/**
 * The permalink for the state, strings only, each 1 to 64 characters. When the
 * events are a preset's: `{ preset }` plus `tolerance` when it differs (`"none"`
 * when cleared). Otherwise the flat form, which reproduces what the reader
 * sees.
 */
export function permalinkOf(state: DriftState): Record<string, string> {
  const events = eventsOf(state);
  const preset = ETA_PRESETS.find((p) => sameEvents(p.events, events));
  if (preset) {
    const out: Record<string, string> = { preset: preset.id };
    if (t(state.tolerance) === "") {
      if (t(preset.tolerance) !== "") out.tolerance = "none";
    } else if (t(state.tolerance) !== t(preset.tolerance)) {
      out.tolerance = t(state.tolerance);
    }
    return out;
  }
  const out: Record<string, string> = { eventCount: String(events.length) };
  events.forEach((e, i) => {
    if ((e.classifier as string) !== "")
      out[`classifier${i + 1}`] = e.classifier;
    if (e.at !== "") out[`at${i + 1}`] = e.at;
    if (e.recordedAt !== "") out[`recordedAt${i + 1}`] = e.recordedAt;
  });
  if (t(state.tolerance) !== "") out.tolerance = t(state.tolerance);
  return out;
}

// ---------------------------------------------------------------------------
// The naive pick
// ---------------------------------------------------------------------------

export interface Pick {
  index: number;
  event: TimestampEvent;
}

/**
 * The tool's one naive value: the event recorded last, of any class. A tie goes
 * to the later index. `null` when any `recordedAt` is not an instant.
 */
export function naivePick(events: readonly TimestampEvent[]): Pick | null {
  let best: Pick | null = null;
  let bestMs = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < events.length; i++) {
    let ms: number;
    try {
      ms = epochMs(events[i]!.recordedAt);
    } catch {
      return null;
    }
    if (ms >= bestMs) {
      best = { index: i, event: events[i]! };
      bestMs = ms;
    }
  }
  return best;
}

/**
 * Which event a `bestAvailable` result names: the event of that class and time
 * with the latest `recordedAt`, a tie going to the later index. `null` when no
 * event matches. A pointer into the input for drawing a ring; the pick itself
 * is the library's.
 */
export function indexOfPick(
  events: readonly TimestampEvent[],
  pick: ClassifiedTimestamp | null,
): number | null {
  if (pick === null) return null;
  let found: number | null = null;
  let foundMs = Number.NEGATIVE_INFINITY;
  events.forEach((e, i) => {
    if (e.classifier !== pick.classifier || e.at !== pick.at) return;
    let ms = Number.NEGATIVE_INFINITY;
    try {
      ms = epochMs(e.recordedAt);
    } catch {
      /* keep -Infinity */
    }
    if (ms >= foundMs) {
      found = i;
      foundMs = ms;
    }
  });
  return found;
}

// ---------------------------------------------------------------------------
// Facts: every figure is a library call
// ---------------------------------------------------------------------------

export interface DriftFacts {
  events: TimestampEvent[];
  best: ClassifiedTimestamp | null;
  drift: DriftReport | null;
  naive: Pick | null;
  /** Visible events whose classifier is `"EST"`, read from the input. */
  estCount: number;
}

export function collectDriftFacts(
  state: DriftState,
  lib: PunctualityLib,
): DriftFacts {
  const events = eventsOf(state);
  const tolerance = t(state.tolerance);
  return {
    events,
    best: lib.bestAvailable(events),
    drift: lib.estimateDrift(events, tolerance ? { tolerance } : undefined),
    naive: naivePick(events),
    estCount: events.filter((e) => e.classifier === "EST").length,
  };
}

// ---------------------------------------------------------------------------
// Why NO SIGNAL
// ---------------------------------------------------------------------------

export type DriftNullReasonKind =
  | "invalid-event"
  | "invalid-tolerance"
  | "one-estimate"
  | "no-estimate";

export interface DriftNullReason {
  kind: DriftNullReasonKind;
  /** 1-based, for `invalid-event`. */
  event?: number;
}

/** Appendix Z's E1, a valid set of estimates every tolerance probe is judged
 *  against. */
const PROBE_EVENTS = E1 as TimestampEvent[];

/**
 * Why a result is NO SIGNAL, found by probing the library, in this order: the
 * first event that is not a timestamp, a tolerance that is not an exact
 * duration, then fewer than two estimates. `null` when every result is real.
 */
export function driftNullReason(
  state: DriftState,
  facts: DriftFacts,
  lib: PunctualityLib,
): DriftNullReason | null {
  if (facts.best === null) {
    const bad = facts.events.findIndex((e) => lib.bestAvailable([e]) === null);
    return { kind: "invalid-event", event: (bad < 0 ? 0 : bad) + 1 };
  }
  const tolerance = t(state.tolerance);
  if (
    facts.drift === null &&
    tolerance !== "" &&
    lib.estimateDrift(PROBE_EVENTS, { tolerance }) === null
  ) {
    return { kind: "invalid-tolerance" };
  }
  if (facts.drift === null && facts.estCount === 1) {
    return { kind: "one-estimate" };
  }
  if (facts.drift === null && facts.estCount === 0) {
    return { kind: "no-estimate" };
  }
  return null;
}

export function driftReasonText(reason: DriftNullReason): string {
  switch (reason.kind) {
    case "invalid-event":
      return `Event ${reason.event} is not a timestamp: its class must be PLN, EST, REQ or ACT, and at and recordedAt need an offset or a zone. One invalid event makes both calls return null.`;
    case "invalid-tolerance":
      return "The tolerance is not an exact duration that is zero or more. Write it as PT8H or PT30M: weeks, months and years have no fixed length.";
    case "one-estimate":
      return "There is no drift from one estimate: estimateDrift returns null with fewer than two EST records.";
    case "no-estimate":
      return "No EST records: estimateDrift reads only estimates.";
  }
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

export interface PlotWindow {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

/**
 * The plot's extent: x runs over every `recordedAt`, y over every `at` (and the
 * tolerance band's two edges when one is drawn), x padded 8% and y 16%. A zero span
 * pads one day on x and one hour on y. Events that are not instants are left
 * out; `null` when none is. Drawing only.
 */
export function plotWindow(
  events: readonly TimestampEvent[],
  band?: { lowMs: number; highMs: number } | null,
): PlotWindow | null {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const e of events) {
    try {
      const rec = epochMs(e.recordedAt);
      const at = epochMs(e.at);
      xs.push(rec);
      ys.push(at);
    } catch {
      /* not drawn */
    }
  }
  if (xs.length === 0) return null;
  if (band) ys.push(band.lowMs, band.highMs);
  const pad = (
    lo: number,
    hi: number,
    whenZero: number,
    share: number,
  ): [number, number] => {
    const span = hi - lo;
    if (span === 0) return [lo - whenZero, hi + whenZero];
    return [lo - span * share, hi + span * share];
  };
  // y pads more than x: the labels of the top and bottom marks need room above
  // or below them, clear of the join line.
  const [xMin, xMax] = pad(Math.min(...xs), Math.max(...xs), DAY_MS, 0.08);
  const [yMin, yMax] = pad(Math.min(...ys), Math.max(...ys), HOUR_MS, 0.16);
  return { xMin, xMax, yMin, yMax };
}

/** The zone the plot's tick labels read in: the first valid `at`'s own zone, a
 *  numeric offset as itself, `Z` as UTC. */
export function plotZone(events: readonly TimestampEvent[]): string {
  for (const e of events) {
    const p = writtenParts(e.at);
    if (p.date === "") continue;
    if (p.zone !== "") return p.zone;
    return p.offset === "Z" ? "UTC" : p.offset;
  }
  return "UTC";
}

/** The step, in minutes, of the y ticks: the smallest nice step that leaves at
 *  most five labels. */
export function yTickStep(spanMs: number): number {
  const steps = [
    5, 10, 15, 30, 60, 120, 180, 360, 720, 1440, 2880, 7200, 14400, 43200,
    129600,
  ];
  const minutes = spanMs / 60_000;
  return steps.find((s) => minutes / s <= 4) ?? 525600;
}

export interface PlotTick {
  ms: number;
  label: string;
}

/** Y ticks: the time each height names, at most five. A window over 36 hours
 *  adds the date to each label. Drawing only. */
export function yTicks(win: PlotWindow, zone: string): PlotTick[] {
  const span = win.yMax - win.yMin;
  const label =
    span > 36 * HOUR_MS
      ? (z: Temporal.ZonedDateTime) =>
          `${dayTickLabel(z)} ${minuteTickLabel(z)}`
      : minuteTickLabel;
  return minuteTicks(win.yMin, win.yMax, zone, yTickStep(span), label);
}

/** X ticks: hours inside three days, days beyond, one every `step`. */
export function xTicks(win: PlotWindow, zone: string): PlotTick[] {
  const span = win.xMax - win.xMin;
  if (span <= 3 * DAY_MS) {
    const step = span <= 6 * HOUR_MS ? 1 : span <= DAY_MS ? 3 : 6;
    return walkTicks(win.xMin, win.xMax, zone, "hours", step, hourTickLabel);
  }
  const step = span <= 14 * DAY_MS ? 2 : span <= 30 * DAY_MS ? 5 : 10;
  return walkTicks(win.xMin, win.xMax, zone, "days", step, dayTickLabel);
}

/** The band a tolerance draws around the first estimate, in epoch ms, or
 *  `null` when there is no first estimate or the tolerance is not readable. */
export function toleranceBand(
  drift: DriftReport | null,
  tolerance: string,
): { lowMs: number; highMs: number; minutes: number } | null {
  if (drift === null) return null;
  const minutes = isoToMinutes(tolerance);
  if (minutes === null || minutes < 0) return null;
  try {
    const center = epochMs(drift.first);
    return {
      lowMs: center - minutes * 60_000,
      highMs: center + minutes * 60_000,
      minutes,
    };
  } catch {
    return null;
  }
}
