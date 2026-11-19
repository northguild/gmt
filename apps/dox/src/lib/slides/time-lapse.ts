/**
 * The deck's time-lapses: on the bug slides the camera holds still and time moves. A lapse scrubs
 * the Earth's sun instant across a window, so the terminator sweeps the planet, and reads each
 * named zone's own local date and time at every instant, so a pin flips its date when that zone's
 * clock passes midnight.
 *
 * Every instant and every local date comes from gmt (`LapseTools`, imported after first paint); this
 * file does no offset arithmetic of its own. The window is 24 hours from now, or, for a zone's
 * recorded jump, the hours round the jump gmt finds in that zone's own data. The sun is the same
 * at both ends of a day-long window, so one lapse ends where the next one begins.
 *
 * A day-long lapse that follows another, forward or back, carries on from the instant on screen
 * and at the speed the sun is going (`LapseCarry`), so a step never sends the sun back to now to
 * sweep the same day again. Its window is still a whole day, so every pin still flips once.
 */
import { play, type Frames } from "./frames";
import type { DeckGmt } from "./gmt-loader";
import { firstTransition } from "./transition-ms";

/** A lapse: the zones whose pins carry dates, and the window. */
export interface LapseDef {
  zones: readonly string[];
  /** A window centred on this zone's transition in these local years, instead of the next 24 hours. */
  around?: { zone: string; years: readonly number[] };
  /** A window of `hours` that stops on this UTC instant, instead of the next 24 hours. */
  endsAt?: { utc: string; hours: number };
  /** How long the lapse takes on stage; `LAPSE_MS` when absent. */
  durationMs?: number;
}

/** How long a day-long lapse takes on stage: slow enough to read as time passing. */
export const LAPSE_MS = 24000;
/** The hours either side of a recorded jump that a window holds. */
const JUMP_WINDOW_HOURS = 18;

/** What the lapse needs from gmt. */
export interface LapseTools {
  /** Epoch milliseconds now. */
  nowMs(): number;
  /** `ms` plus whole hours (negative for before), or `null` for a value gmt rejects. */
  addHours(ms: number, hours: number): number | null;
  /** The zone's wall time at `ms` as `YYYY-MM-DDTHH:MM`, or `""` for a zone gmt does not know. */
  stamp(zone: string, ms: number): string;
  /** The epoch milliseconds of a UTC instant (`…Z`), or `null` for one gmt rejects. */
  utcMs(iso: string): number | null;
  /** The epoch milliseconds of the zone's first offset change in any of these local years. */
  jumpMs(zone: string, years: readonly number[]): number | null;
}

export function lapseToolsFrom(gmt: DeckGmt): LapseTools {
  return {
    nowMs: () => gmt.unixGet.getUnixNow(),
    addHours: (ms, hours) => gmt.unixCalculate.addUnix(ms, { hours }),
    stamp: (zone, ms) =>
      gmt.unixConvert.convertUnixToZoned(ms, zone).slice(0, 16),
    utcMs: (iso) => gmt.utcConvert.convertUtcToUnix(iso),
    jumpMs: (zone, years) =>
      firstTransition(zone, years, {
        getDstTransitions: gmt.zonedGet.getDstTransitions,
        convertZonedToUnix: gmt.zonedConvert.convertZonedToUnix,
      })?.ms ?? null,
  };
}

interface LapsePlan {
  name: string;
  zones: readonly string[];
  fromMs: number;
  toMs: number;
  durationMs: number;
  /** The sun's speed at the start, in sun milliseconds per stage millisecond; 0 starts at rest. */
  startRate?: number;
}

/** Where a day-long lapse that follows another takes over: the instant on screen and its speed. */
interface LapseCarry {
  ms: number;
  /** Sun milliseconds per stage millisecond. */
  rate: number;
}

/** Whether a lapse runs a day from now, rather than a window fixed in history. */
export const isDayLong = (def: LapseDef): boolean => !def.endsAt && !def.around;

/**
 * The window for a lapse, or `null` when gmt cannot give one (a zone with no recorded jump). A
 * day-long lapse given `carry` starts there instead of now.
 */
export function planLapse(
  name: string,
  def: LapseDef,
  tools: LapseTools,
  carry: LapseCarry | null = null,
): LapsePlan | null {
  const base = {
    name,
    zones: def.zones,
    durationMs: def.durationMs ?? LAPSE_MS,
  };
  if (def.endsAt) {
    const to = tools.utcMs(def.endsAt.utc);
    if (to === null) return null;
    const from = tools.addHours(to, -def.endsAt.hours);
    return from === null ? null : { ...base, fromMs: from, toMs: to };
  }
  if (def.around) {
    const jump = tools.jumpMs(def.around.zone, def.around.years);
    if (jump === null) return null;
    const from = tools.addHours(jump, -JUMP_WINDOW_HOURS);
    const to = tools.addHours(jump, JUMP_WINDOW_HOURS);
    return from === null || to === null
      ? null
      : { ...base, fromMs: from, toMs: to };
  }
  const from = carry?.ms ?? tools.nowMs();
  const to = tools.addHours(from, 24);
  if (to === null) return null;
  const rate = Math.max(0, carry?.rate ?? 0);
  return rate > 0
    ? { ...base, fromMs: from, toMs: to, startRate: rate }
    : { ...base, fromMs: from, toMs: to };
}

/** Eases in and out, so the sun starts and stops without a jolt. */
export const ease = (t: number): number =>
  0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, t)));

/**
 * The largest start slope (in the window's span per duration) the curve takes: above about 2.4 it
 * would run backwards near the end. A carried sun is at most π/2 of that.
 */
const MAX_START_SLOPE = 2;

/** The start slope of a plan, as a share of its span per its duration. */
const startSlope = (plan: LapsePlan): number => {
  const span = plan.toMs - plan.fromMs;
  if (!plan.startRate || span <= 0) return 0;
  return Math.min(MAX_START_SLOPE, (plan.startRate * plan.durationMs) / span);
};

/**
 * Progress along the window at `t`: the ease, plus a term that sets the start's speed and fades
 * to nothing at both ends (the Hermite basis `t(1-t)²`), so a carried sun neither stops nor jumps.
 */
const progressAt = (slope: number, t: number): number => {
  const c = Math.min(1, Math.max(0, t));
  return ease(c) + slope * c * (1 - c) ** 2;
};

/** The instant at progress `t` (0 to 1) of a plan. */
export const instantAt = (plan: LapsePlan, t: number): number =>
  Math.round(
    plan.fromMs + (plan.toMs - plan.fromMs) * progressAt(startSlope(plan), t),
  );

/** The sun's speed at progress `t` of a plan, in sun milliseconds per stage millisecond. */
export function rateAt(plan: LapsePlan, t: number): number {
  if (t <= 0 && plan.startRate) return plan.startRate;
  if (t >= 1 || plan.durationMs <= 0) return 0;
  const c = Math.max(0, t);
  const slope =
    (Math.PI / 2) * Math.sin(Math.PI * c) +
    startSlope(plan) * (1 - c) * (1 - 3 * c);
  return ((plan.toMs - plan.fromMs) * slope) / plan.durationMs;
}

/** The instant a lapse stops on, or `null` when it has no fixed end (or gmt rejects it). */
export const lapseEndMs = (def: LapseDef, tools: LapseTools): number | null =>
  def.endsAt ? tools.utcMs(def.endsAt.utc) : null;

/** What a frame of a lapse says. */
export interface LapseFrame {
  ms: number;
  /** The sun's speed, in sun milliseconds per stage millisecond: 0 once the lapse is done. */
  rate: number;
  /** Each lapse zone's wall time as `YYYY-MM-DDTHH:MM`. */
  stamps: Readonly<Record<string, string>>;
  done: boolean;
}

export function frameAt(
  plan: LapsePlan,
  tools: LapseTools,
  t: number,
): LapseFrame {
  const ms = instantAt(plan, t);
  return {
    ms,
    rate: rateAt(plan, t),
    stamps: Object.fromEntries(
      plan.zones.map((zone) => [zone, tools.stamp(zone, ms)]),
    ),
    done: t >= 1,
  };
}

/** `Tehran 2026-11-19 00:12`: the city, the local date and the local time. */
export function lapseLabel(city: string, stamp: string): string {
  return /^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(stamp)
    ? `${city} ${stamp.slice(0, 10)} ${stamp.slice(11)}`
    : city;
}

/** The local date of a stamp, `YYYY-MM-DD`, or `""`. */
export const dateOf = (stamp: string): string =>
  /^\d{4}-\d\d-\d\d/.test(stamp) ? stamp.slice(0, 10) : "";

/**
 * Plays a plan, one frame per animation frame, and calls `onFrame` for each. With `reduced` it
 * calls once with the end state. Returns a function that stops it. The browser's frame stamp
 * measures the elapsed time; nothing here reads a clock.
 */
export function runLapse(o: {
  plan: LapsePlan;
  tools: LapseTools;
  win: Frames;
  reduced: boolean;
  onFrame: (frame: LapseFrame) => void;
}): () => void {
  if (o.reduced) {
    o.onFrame(frameAt(o.plan, o.tools, 1));
    return () => {};
  }
  // The first frame shows the start, so a new lapse never opens on the last one's end.
  return play(o.win, o.plan.durationMs, (t) =>
    o.onFrame(frameAt(o.plan, o.tools, t)),
  );
}
