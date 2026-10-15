/**
 * Pure helpers for the Journey Split widget (INT-14).
 *
 * The same hours, sorted two ways: in the order they happen, and gathered into
 * moving and waiting. The Delivery Scheduler draws the legs; this tool draws
 * the split. It takes the Delivery Scheduler's leg state (`readArgs`,
 * `legsOf`, `permalinkOf`), so a journey opens in either tool from the other.
 *
 * Words. On screen the stated `dwellAfter` is "handling", and the time spent
 * at a hand-off is "waiting". The printed call keeps the library's keys, so
 * "dwell" appears only inside a printed call or result.
 *
 * No DOM and no gmt import. Every function that calls the library takes a
 * `JourneyLib`, loaded by the mount (`transport-lib.ts`). The widget draws the
 * library's results and computes none of them:
 *
 * - `multimodalETA` gives the ETA and the two totals;
 * - `collectJourneyFacts` (`transport-widgets.ts`) gives each leg's departure,
 *   arrival and ready instant from `scheduleDelivery`, never by arithmetic;
 * - `diffUtcAsDuration` gives the time waited at each hand-off, the part of it
 *   beyond the stated handling, and the time door to door.
 *
 * Moving time for a leg is the caller's own `duration`. Positions on the
 * ribbons are drawing: a segment sits where its two instants fall. A test
 * asserts that the moving segments' widths add up to `totalTransit` and the
 * waiting ones to `totalDwell`, for every preset.
 *
 * Naming rule: GMT tracks no law, and the UI names no body. No string here
 * names a statute, an agency, a carrier or a court. A place may be named as an
 * example (a preset's zones).
 */

import {
  legsOf,
  optionsOf,
  permalinkOf,
  readArgs,
  type DeliverySchedulerArgs,
  type DeliveryState,
} from "./delivery-scheduler";
import { runCall, type EdiCall } from "./edi-widgets";
import {
  hourDurationText,
  localText,
  NO_RESULT,
  type PlateSpec,
  type SeriesNumber,
} from "./ledger-widgets";
import type { JourneyLib, MultimodalJourney } from "./transport-lib";
import {
  collectJourneyFacts,
  epochMs,
  failureText,
  type JourneyFacts,
  type LegFields,
  type ScheduleLeg,
  type ScheduleOptions,
} from "./transport-widgets";

export { permalinkOf, readArgs };

/** The widget's controls, as strings: the Delivery Scheduler's own leg state. */
export type JourneyState = DeliveryState;

/** Seed arguments: `legs` (the chat array) wins over the flat permalink keys. */
export type JourneySplitArgs = DeliverySchedulerArgs;

export const CUSTOM_PRESET_ID = "custom";

/** What a ribbon and the table say when the library returned no journey. */
export const NO_JOURNEY_TEXT =
  "No journey to draw: the library returned no result for these legs.";

/** What the table says for a journey of one leg, which has no hand-off. */
export const NO_HANDOFF_TEXT = "A single leg has no hand-off.";

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

export interface JourneyPreset {
  id: string;
  label: string;
  description: string;
  startTimeZone: string;
  legs: readonly LegFields[];
}

/** The ship's scheduled sailing: 14:00 on the 12th, Shanghai time. */
const SAILING = "2024-06-12T14:00:00+08:00[Asia/Shanghai]";

/**
 * Truck, ship and rail from Shanghai to Chicago. The ship's departure is the
 * one thing the two presets that share these legs differ in.
 */
const sailingLegs = (sailing: string): readonly LegFields[] => [
  {
    departure: "2024-06-10T08:00:00+08:00[Asia/Shanghai]",
    duration: "PT6H",
    timeZone: "Asia/Shanghai",
    dwellAfter: "PT6H",
    mode: "truck",
  },
  {
    departure: sailing,
    duration: "P14DT6H",
    timeZone: "America/Los_Angeles",
    dwellAfter: "PT36H",
    mode: "ship",
  },
  {
    departure: "",
    duration: "PT52H",
    timeZone: "America/Chicago",
    dwellAfter: "",
    mode: "rail",
  },
];

/**
 * Every preset is a worked case whose result a real run decided. The mount test
 * asserts each one against the library, so a value on screen is one the
 * library gave.
 */
export const JOURNEY_PRESETS: readonly JourneyPreset[] = [
  {
    id: "scheduled-sailing",
    label: "Truck, ship and rail with a scheduled sailing",
    description:
      "A truck, a ship and a train take cargo from Shanghai to Chicago. The ship sails at a scheduled 14:00 on 12 June, so the cargo waits for it after its handling time ends: 6 hours of handling, then 42 more for the sailing.",
    startTimeZone: "",
    legs: sailingLegs(SAILING),
  },
  {
    id: "no-schedule",
    label: "The same legs with no scheduled sailing",
    description:
      "The same legs, but the ship has no scheduled departure. Each leg leaves when the handling time before it ends, so the only waiting is the handling.",
    startTimeZone: "",
    legs: sailingLegs(""),
  },
  {
    id: "missed-connection",
    label: "A sailing inside the handling time",
    description:
      "Two legs. The cargo arrives at 10:00 and needs two hours of handling, but the second leg is scheduled to leave at 11:00. The library returns no journey.",
    startTimeZone: "",
    legs: [
      {
        departure: "2024-06-15T00:00:00Z",
        duration: "PT10H",
        timeZone: "UTC",
        dwellAfter: "PT2H",
        mode: "",
      },
      {
        departure: "2024-06-15T11:00:00Z",
        duration: "PT1H",
        timeZone: "UTC",
        dwellAfter: "",
        mode: "",
      },
    ],
  },
  {
    id: "across-a-clock-change",
    label: "A train across a clock change",
    description:
      "A train leaves New York at 20:00 on the night before the clocks spring forward. It runs for 10 hours, so the wall clock shows 11. The moving time counts the 10 hours that passed, then two hours of handling, then 3 hours by truck.",
    startTimeZone: "",
    legs: [
      {
        departure: "2024-03-09T20:00:00-05:00[America/New_York]",
        duration: "PT10H",
        timeZone: "America/New_York",
        dwellAfter: "PT2H",
        mode: "rail",
      },
      {
        departure: "",
        duration: "PT3H",
        timeZone: "America/New_York",
        dwellAfter: "",
        mode: "truck",
      },
    ],
  },
];

/** Whether the args carry a journey, as the Delivery Scheduler decides it. */
export function isSeeded(args: JourneySplitArgs): boolean {
  return (
    args.legs !== undefined ||
    args.legCount !== undefined ||
    args.duration1 !== undefined
  );
}

/** A preset as control values. */
export function presetState(p: JourneyPreset): JourneyState {
  return readArgs({
    legs: p.legs as unknown as Partial<LegFields>[],
    ...(p.startTimeZone === "" ? {} : { startTimeZone: p.startTimeZone }),
  });
}

/** The preset whose controls match `state`, trimmed, or `custom`. */
export function matchPreset(state: JourneyState): string {
  const t = (s: string) => s.trim();
  const n = Number.parseInt(state.legCount, 10) || 0;
  const hit = JOURNEY_PRESETS.find((p) => {
    if (p.legs.length !== n) return false;
    if (t(p.startTimeZone) !== t(state.startTimeZone)) return false;
    return p.legs.every((a, i) => {
      const b = state.legs[i]!;
      return (
        t(a.departure) === t(b.departure) &&
        t(a.duration) === t(b.duration) &&
        t(a.timeZone) === t(b.timeZone) &&
        t(a.dwellAfter) === t(b.dwellAfter) &&
        t(a.mode) === t(b.mode)
      );
    });
  });
  return hit ? hit.id : CUSTOM_PRESET_ID;
}

// ---------------------------------------------------------------------------
// Type setting
// ---------------------------------------------------------------------------

const HOURS = /^PT(?:(\d+)H)?(?:(\d+)M)?$/;

/**
 * An exact duration the library returned, in hours and minutes only:
 * `"PT484H"` is "484 h", `"PT139H30M"` is "139 h 30 min". It returns the
 * string as it came for a duration these units cannot show exactly.
 */
export function hoursText(iso: string): string {
  const m = HOURS.exec(iso);
  if (!m || (m[1] === undefined && m[2] === undefined)) return iso;
  const hours = Number(m[1] ?? 0);
  const minutes = Number(m[2] ?? 0);
  if (!Number.isSafeInteger(hours) || !Number.isSafeInteger(minutes)) {
    return iso;
  }
  const out: string[] = [];
  if (hours > 0) out.push(`${hours} h`);
  if (minutes > 0) out.push(`${minutes} min`);
  return out.length === 0 ? "0 h" : out.join(" ");
}

/** A duration the library returned, set in type. */
const durationLabel = (iso: string): string =>
  hourDurationText(iso) || iso || NO_RESULT;

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/** One hand-off: the cargo arrives, is handled, is ready, and leaves. */
export interface Hop {
  /** The leg before the hand-off, 1-based. */
  after: number;
  /** The zone the hand-off happens in: the arriving leg's `timeZone`. */
  zone: string;
  /** The instants `scheduleDelivery` gave, all `Z`. */
  arrival: string;
  ready: string;
  departure: string;
  /** `diffUtcAsDuration(arrival, departure, "hours")`: the time waited. */
  waited: string;
  /** `diffUtcAsDuration(ready, departure, "hours")`: the wait beyond the handling. */
  beyond: string;
  /** `diffUtcAsDuration(arrival, ready, "hours")`: the stated handling. */
  handling: string;
  /** Positions only: the gap between `arrival` and `ready`, which sizes a segment. */
  handlingMs: number;
  /** Positions only: the gap between `ready` and `departure`. */
  beyondMs: number;
}

export type SegmentKind = "moving" | "handling" | "scheduled";

/** A stretch of the journey, where its two instants fall. */
export interface Segment {
  kind: SegmentKind;
  /** A moving segment's leg, or the leg before a wait; 1-based. */
  leg: number;
  startMs: number;
  endMs: number;
}

export interface JourneyRead {
  legs: ScheduleLeg[];
  options: ScheduleOptions | undefined;
  facts: JourneyFacts;
  /** `multimodalETA`'s result, or `null`. */
  journey: MultimodalJourney | null;
  /** One entry for each hand-off. Empty when there is no journey to draw. */
  hops: Hop[];
  /** `diffUtcAsDuration(first departure, last arrival, "hours")`, or `null`. */
  doorToDoor: string | null;
  /** Moving and waiting stretches in time order. Empty with no journey. */
  segments: Segment[];
  /** Every call made, in order, for the call frame. */
  calls: EdiCall[];
  /** Why the library returned no journey, in one sentence, else `null`. */
  failure: string | null;
}

/**
 * The journey and its split. `multimodalETA` and `scheduleDelivery` are called
 * for the reader's legs and options; `collectJourneyFacts` asks the library for
 * every instant; and `diffUtcAsDuration` measures each wait and the whole. A
 * `null` journey has no hops, no segments and a sentence that says why.
 */
export function readJourney(state: JourneyState, lib: JourneyLib): JourneyRead {
  const legs = legsOf(state);
  const options = optionsOf(state);
  const optionArgs = options === undefined ? [] : [options];
  const etaCall = runCall(lib, "multimodalETA", legs, ...optionArgs);
  const scheduleCall = runCall(lib, "scheduleDelivery", legs, ...optionArgs);
  const facts = collectJourneyFacts(legs, options, lib);
  const journey = etaCall.result as MultimodalJourney | null;
  const calls: EdiCall[] = [etaCall, scheduleCall];

  const none = (failure: string | null): JourneyRead => ({
    legs,
    options,
    facts,
    journey,
    hops: [],
    doorToDoor: null,
    segments: [],
    calls,
    failure,
  });

  if (journey === null || facts.result === null) {
    return none(
      facts.failure === null
        ? "The library returned no journey for these legs."
        : failureText(facts.failure, facts, legs, lib),
    );
  }

  const hops: Hop[] = [];
  const segments: Segment[] = [];
  const last = legs.length - 1;
  for (let i = 0; i <= last; i++) {
    const departure = facts.departures[i];
    const arrival = facts.arrivals[i];
    if (!departure || !arrival) {
      return none("The library gave no time for one of the legs.");
    }
    segments.push({
      kind: "moving",
      leg: i + 1,
      startMs: epochMs(departure),
      endMs: epochMs(arrival),
    });
    if (i === last) continue;
    const ready = facts.readies[i];
    const next = facts.departures[i + 1];
    if (!ready || !next) {
      return none("The library gave no time for one of the hand-offs.");
    }
    const handling = runCall(lib, "diffUtcAsDuration", arrival, ready, "hours");
    const waited = runCall(lib, "diffUtcAsDuration", arrival, next, "hours");
    const beyond = runCall(lib, "diffUtcAsDuration", ready, next, "hours");
    calls.push(handling, waited, beyond);
    const arrivalMs = epochMs(arrival);
    const readyMs = epochMs(ready);
    const nextMs = epochMs(next);
    hops.push({
      after: i + 1,
      zone: legs[i]!.timeZone,
      arrival,
      ready,
      departure: next,
      handling: handling.result as string,
      waited: waited.result as string,
      beyond: beyond.result as string,
      handlingMs: readyMs - arrivalMs,
      beyondMs: nextMs - readyMs,
    });
    if (readyMs > arrivalMs) {
      segments.push({
        kind: "handling",
        leg: i + 1,
        startMs: arrivalMs,
        endMs: readyMs,
      });
    }
    if (nextMs > readyMs) {
      segments.push({
        kind: "scheduled",
        leg: i + 1,
        startMs: readyMs,
        endMs: nextMs,
      });
    }
  }

  const door = runCall(
    lib,
    "diffUtcAsDuration",
    facts.departures[0]!,
    facts.arrivals[last]!,
    "hours",
  );
  calls.push(door);
  return {
    legs,
    options,
    facts,
    journey,
    hops,
    doorToDoor: door.result as string,
    segments,
    calls,
    failure: null,
  };
}

// ---------------------------------------------------------------------------
// The ribbons
// ---------------------------------------------------------------------------

/** A segment placed on a ribbon: how far from the left edge, in ms of the journey. */
export interface Placed extends Segment {
  fromMs: number;
  toMs: number;
}

export interface Ribbons {
  /** The length of the journey: first departure to last arrival. */
  spanMs: number;
  /** "As it happens": each segment where its instants fall. */
  happens: Placed[];
  /** "Gathered": the moving segments from the left, the waiting ones after them. */
  gathered: Placed[];
}

/** The total length of the moving segments and of the waiting ones. */
export function segmentTotals(segments: readonly Segment[]): {
  movingMs: number;
  waitingMs: number;
} {
  let movingMs = 0;
  let waitingMs = 0;
  for (const s of segments) {
    const width = s.endMs - s.startMs;
    if (s.kind === "moving") movingMs += width;
    else waitingMs += width;
  }
  return { movingMs, waitingMs };
}

/**
 * The two ribbons on one scale. "As it happens" keeps each segment where it
 * falls. "Gathered" packs the same segments, moving at the left in leg order
 * and waiting at the right in hand-off order, so the two groups meet where the
 * moving time ends.
 */
export function layoutRibbons(segments: readonly Segment[]): Ribbons {
  if (segments.length === 0) return { spanMs: 0, happens: [], gathered: [] };
  const origin = Math.min(...segments.map((s) => s.startMs));
  const end = Math.max(...segments.map((s) => s.endMs));
  const happens = segments.map((s) => ({
    ...s,
    fromMs: s.startMs - origin,
    toMs: s.endMs - origin,
  }));
  const { movingMs } = segmentTotals(segments);
  let movingAt = 0;
  let waitingAt = movingMs;
  const gathered = segments.map((s) => {
    const width = s.endMs - s.startMs;
    if (s.kind === "moving") {
      const placed = { ...s, fromMs: movingAt, toMs: movingAt + width };
      movingAt += width;
      return placed;
    }
    const placed = { ...s, fromMs: waitingAt, toMs: waitingAt + width };
    waitingAt += width;
    return placed;
  });
  return { spanMs: end - origin, happens, gathered };
}

export interface AxisTick {
  /** Where the tick sits, in ms from the first departure. */
  ms: number;
  label: string;
}

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const DAY_STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
const HOUR_STEPS = [1, 2, 3, 4, 6, 12];

/**
 * The scale's ticks: elapsed time from the first departure, in days for a
 * journey of three days or more and in hours for a shorter one. The step is the
 * smallest that gives six ticks or fewer after the first.
 */
export function axisTicks(spanMs: number): AxisTick[] {
  if (!(spanMs > 0)) return [{ ms: 0, label: "0" }];
  const days = spanMs >= 3 * DAY_MS;
  const unit = days ? DAY_MS : HOUR_MS;
  const suffix = days ? "d" : "h";
  const steps = days ? DAY_STEPS : HOUR_STEPS;
  const count = spanMs / unit;
  const step = steps.find((s) => count / s <= 6) ?? steps[steps.length - 1]!;
  const ticks: AxisTick[] = [{ ms: 0, label: "0" }];
  for (let at = step; at * unit <= spanMs; at += step) {
    ticks.push({ ms: at * unit, label: `${at} ${suffix}` });
  }
  return ticks;
}

/**
 * Left edges, in px, for number badges centred over their stems and kept apart:
 * each badge keeps its order, none overlaps the one before it, and all stay
 * inside `trackPx`. `centersPx` are in leg order.
 */
export function nudgeBadges(
  centersPx: readonly number[],
  badgePx: number,
  trackPx: number,
  gapPx = 2,
): number[] {
  const lefts = centersPx.map((c) => c - badgePx / 2);
  for (let i = 0; i < lefts.length; i++) {
    const floor = i === 0 ? 0 : lefts[i - 1]! + badgePx + gapPx;
    lefts[i] = Math.max(lefts[i]!, floor);
  }
  for (let i = lefts.length - 1; i >= 0; i--) {
    const ceiling =
      i === lefts.length - 1
        ? trackPx - badgePx
        : lefts[i + 1]! - badgePx - gapPx;
    lefts[i] = Math.min(lefts[i]!, ceiling);
  }
  return lefts;
}

/** The left edge, in px, of a chip of `chipPx` centred on `centerPx` and kept inside `trackPx`. */
export function clampChip(
  centerPx: number,
  chipPx: number,
  trackPx: number,
): number {
  return Math.max(0, Math.min(centerPx - chipPx / 2, trackPx - chipPx));
}

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

/** The series (1 to 4) of a leg's stem and badge. */
export function legSeries(leg: number): SeriesNumber {
  return (((leg - 1) % 4) + 1) as SeriesNumber;
}

/**
 * What a chip under a wait says. The stated handling and the wait for a
 * scheduled departure are named apart; a wait that is all handling names the
 * handling alone, and one that is all waiting for a departure names that.
 */
export function waitChipText(hop: Hop): string {
  const waited = durationLabel(hop.waited);
  const handling = hop.handlingMs > 0 ? hoursText(hop.handling) : "";
  const beyond = hop.beyondMs > 0 ? hoursText(hop.beyond) : "";
  if (handling !== "" && beyond !== "") {
    return `${waited}: ${handling} handling + ${beyond} for the scheduled departure`;
  }
  if (handling !== "") return `${waited} of handling`;
  if (beyond !== "") return `${waited} for the scheduled departure`;
  return "no wait";
}

/** The last leg's zone: the clock the ETA is read on. */
export function etaZone(read: JourneyRead): string {
  return read.legs[read.legs.length - 1]?.timeZone ?? "";
}

/** The three result plates. With no journey they keep their boxes and read "no result". */
export function journeyPlates(read: JourneyRead | null): PlateSpec[] {
  const journey = read?.journey ?? null;
  const ok = read !== null && journey !== null && read.failure === null;
  const zone = ok ? etaZone(read) : "";
  return [
    {
      role: "hero-eta",
      caption: "ETA",
      series: 1,
      value: ok ? localText(journey.eta, zone) || journey.eta : null,
      lines: [
        zone,
        ok && read.doorToDoor !== null
          ? `${hoursText(read.doorToDoor)} door to door`
          : "",
      ],
    },
    {
      role: "hero-moving",
      caption: "Moving",
      series: 2,
      value: ok ? durationLabel(journey.totalTransit) : null,
      lines: [ok ? journey.totalTransit : ""],
    },
    {
      role: "hero-waiting",
      caption: "Waiting",
      series: 3,
      value: ok ? durationLabel(journey.totalDwell) : null,
      lines: [ok ? journey.totalDwell : ""],
    },
  ];
}

/** The text of one hand-off table row, in the order of the columns. */
export function hopCells(hop: Hop): [string, string, string, string, string] {
  const at = (instant: string) => localText(instant, hop.zone) || instant;
  return [
    `Leg ${hop.after}: ${at(hop.arrival)}`,
    durationLabel(hop.handling),
    at(hop.ready),
    at(hop.departure),
    durationLabel(hop.waited),
  ];
}

export const TABLE_COLUMNS = [
  "Arrives",
  "Handling",
  "Ready",
  "Departs",
  "Waited",
] as const;

/** The bracket chips under the gathered ribbon, as the library returned the totals. */
export function bracketTexts(journey: MultimodalJourney): {
  moving: string;
  waiting: string;
} {
  return {
    moving: `moving · ${journey.totalTransit}`,
    waiting: `waiting · ${journey.totalDwell}`,
  };
}

/** The accessible name of the two ribbons. */
export function ribbonsAria(read: JourneyRead): string {
  if (read.journey === null || read.segments.length === 0) {
    return `Moving and waiting: ${NO_JOURNEY_TEXT}`;
  }
  // Every duration named is a library result. A leg's moving time is its own
  // `duration`, so the ribbon's name gives the leg and the totals give the sums.
  const parts = read.segments.map((s) => {
    if (s.kind === "moving") return `leg ${s.leg} moving`;
    const hop = read.hops.find((h) => h.after === s.leg);
    if (!hop) return `a wait after leg ${s.leg}`;
    return s.kind === "handling"
      ? `${durationLabel(hop.handling)} of handling after leg ${s.leg}`
      : `${durationLabel(hop.beyond)} of waiting for the scheduled departure after leg ${s.leg}`;
  });
  const { totalTransit, totalDwell } = read.journey;
  return (
    `As it happens: ${parts.join(", then ")}. ` +
    `Gathered: moving ${durationLabel(totalTransit)}, then waiting ${durationLabel(totalDwell)}.`
  );
}

/** One sentence for the visually hidden live region. */
export function summaryText(read: JourneyRead): string {
  if (read.journey === null || read.failure !== null) {
    return `No journey. ${read.failure ?? ""}`.trim();
  }
  const { eta, totalTransit, totalDwell } = read.journey;
  const zone = etaZone(read);
  const when = localText(eta, zone) || eta;
  const door =
    read.doorToDoor === null
      ? ""
      : `, ${hoursText(read.doorToDoor)} door to door`;
  return (
    `Moving ${durationLabel(totalTransit)} and waiting ${durationLabel(totalDwell)}. ` +
    `ETA ${when}${zone === "" ? "" : ` in ${zone}`}${door}.`
  );
}
