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
 */

/** A named lapse: the zones whose pins carry dates, and the window. */
export interface LapseDef {
  zones: readonly string[];
  /** A window centred on this zone's transition in these local years, instead of the next 24 hours. */
  around?: { zone: string; years: readonly number[] };
}

/** The lapses a slide or build may name with `lapse`. */
export const LAPSES = {
  /** Galicia keeps Madrid's clock. */
  abort: { zones: ["Europe/Madrid"] },
  tehran: { zones: ["Asia/Tehran"] },
  tokyo: { zones: ["Asia/Tokyo"] },
  kolkata: { zones: ["Asia/Kolkata"] },
  shanghai: { zones: ["Asia/Shanghai"] },
  /** Manila's calendar jump at the end of 1844, found in the zone's data. */
  manila: {
    zones: ["Asia/Manila"],
    around: { zone: "Asia/Manila", years: [1844, 1845] },
  },
  /** The sun alone, no zone dated. */
  sun: { zones: [] },
} as const satisfies Record<string, LapseDef>;

export type LapseName = keyof typeof LAPSES;

export const isLapseName = (name: string): name is LapseName =>
  Object.hasOwn(LAPSES, name);

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
  /** The epoch milliseconds of the zone's first offset change in any of these local years. */
  jumpMs(zone: string, years: readonly number[]): number | null;
}

export async function loadLapseTools(): Promise<LapseTools> {
  const [get, unix, zonedGet, zonedConvert, calc] = await Promise.all([
    import("@northguild/gmt/unix/get"),
    import("@northguild/gmt/unix/convert"),
    import("@northguild/gmt/zoned/get"),
    import("@northguild/gmt/zoned/convert"),
    import("@northguild/gmt/unix/calculate"),
  ]);
  return {
    nowMs: () => get.getUnixNow(),
    addHours: (ms, hours) => calc.addUnix(ms, { hours }),
    stamp: (zone, ms) => unix.convertUnixToZoned(ms, zone).slice(0, 16),
    jumpMs(zone, years) {
      for (const year of years) {
        const first = zonedGet.getDstTransitions(zone, year)[0];
        if (!first) continue;
        // A transition's instant ends in `Z`; the converter reads the offset form.
        const ms = zonedConvert.convertZonedToUnix(
          first.instant.replace(/Z$/, "+00:00[UTC]"),
        );
        if (ms !== null) return ms;
      }
      return null;
    },
  };
}

export interface LapsePlan {
  name: LapseName;
  zones: readonly string[];
  fromMs: number;
  toMs: number;
  durationMs: number;
}

/** The window for a lapse, or `null` when gmt cannot give one (a zone with no recorded jump). */
export function planLapse(
  name: LapseName,
  tools: LapseTools,
): LapsePlan | null {
  const def: LapseDef = LAPSES[name];
  const base = {
    name,
    zones: def.zones,
    durationMs: LAPSE_MS,
  };
  if (def.around) {
    const jump = tools.jumpMs(def.around.zone, def.around.years);
    if (jump === null) return null;
    const from = tools.addHours(jump, -JUMP_WINDOW_HOURS);
    const to = tools.addHours(jump, JUMP_WINDOW_HOURS);
    return from === null || to === null
      ? null
      : { ...base, fromMs: from, toMs: to };
  }
  const from = tools.nowMs();
  const to = tools.addHours(from, 24);
  return to === null ? null : { ...base, fromMs: from, toMs: to };
}

/** Eases in and out, so the sun starts and stops without a jolt. */
export const ease = (t: number): number =>
  0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, t)));

/** The instant at progress `t` (0 to 1) of a plan. */
export const instantAt = (plan: LapsePlan, t: number): number =>
  Math.round(plan.fromMs + (plan.toMs - plan.fromMs) * ease(t));

/** What a frame of a lapse says. */
export interface LapseFrame {
  ms: number;
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

interface Frames {
  requestAnimationFrame(callback: (stamp: number) => void): number;
  cancelAnimationFrame(handle: number): void;
}

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
  let handle = 0;
  let start: number | null = null;
  let stopped = false;
  const step = (stamp: number): void => {
    if (stopped) return;
    start ??= stamp;
    const t = Math.min(1, (stamp - start) / o.plan.durationMs);
    o.onFrame(frameAt(o.plan, o.tools, t));
    if (t < 1) handle = o.win.requestAnimationFrame(step);
  };
  // The first frame shows the start, so a new lapse never opens on the last one's end.
  o.onFrame(frameAt(o.plan, o.tools, 0));
  handle = o.win.requestAnimationFrame(step);
  return () => {
    stopped = true;
    o.win.cancelAnimationFrame(handle);
  };
}
