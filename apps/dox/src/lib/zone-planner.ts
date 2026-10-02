/**
 * Pure helpers for the Zone Planner as a mountable widget: how a tool call or a
 * permalink names the pinned zones and the reference time.
 *
 * No DOM, no gmt import, no `dox-tools`, no `zod`, no `ai`.
 *
 * `seedFromLocation` keeps only top-level strings of 1 to 64 characters, so a
 * list of zones cannot travel as one string: a permalink carries `zone1` to
 * `zone8`, as the Delivery Scheduler's carries `departure1` to `mode4`. The
 * chat tool sends `zones` as an array, and that wins when both are present.
 */

/** The planner's own limit on pinned zones from a seed. A reader can still add
 *  more by hand. */
export const MAX_SEEDED_ZONES = 8;

export interface ZonePlannerArgs {
  zones?: string[];
  /** A UTC instant ending in `Z`, the reference time the slider shifts from. */
  time?: string;
  zone1?: string;
  zone2?: string;
  zone3?: string;
  zone4?: string;
  zone5?: string;
  zone6?: string;
  zone7?: string;
  zone8?: string;
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** The pinned zone ids a seed names, in order and without repeats. Empty when it
 *  names none, which leaves the planner on its default zones. */
export function seededZones(args: ZonePlannerArgs): string[] {
  const rec = args as Record<string, unknown>;
  const raw = Array.isArray(args.zones)
    ? args.zones.map(str)
    : Array.from({ length: MAX_SEEDED_ZONES }, (_, i) =>
        str(rec[`zone${i + 1}`]),
      );
  return [...new Set(raw.filter((z) => z !== ""))].slice(0, MAX_SEEDED_ZONES);
}

/** The state as a permalink payload: strings only, as `seedFromLocation`
 *  requires. */
export function permalinkOf(
  pinned: readonly string[],
  utcInstant: string,
): Record<string, string> {
  const out: Record<string, string> = { time: utcInstant };
  pinned.slice(0, MAX_SEEDED_ZONES).forEach((zone, i) => {
    out[`zone${i + 1}`] = zone;
  });
  return out;
}
