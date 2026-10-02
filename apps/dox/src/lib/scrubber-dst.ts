/**
 * What the Zone Planner shows about daylight saving at the scrubbed instant:
 * each tile's state, the switch the scrub has crossed, and the next switch to
 * jump to.
 *
 * Every answer comes from `@northguild/gmt`: `getDstTransitions` for where a
 * zone's offset changes (its instants and the offsets either side), and
 * `isInDaylightSaving`, through `zone-clock`'s reading, for whether an instant
 * is in DST. Nothing here knows a transition date or does offset arithmetic
 * beyond reading `±HH:MM`. A transition is any offset change the library
 * reports, so a half-hour change (Lord Howe), a negative-DST zone (Dublin) and a
 * zone with several changes in a year (Casablanca around Ramadan) all work the
 * same way.
 *
 * No DOM, no `Date`.
 */

import { convertUnixToUtc } from "@northguild/gmt/unix/convert";
import { parseYearFromUtc } from "@northguild/gmt/utc/parse";
import { convertUtcToUnix } from "@northguild/gmt/utc/convert";
import { getDstTransitions } from "@northguild/gmt/zoned/get";

/** One offset change, with the instant as epoch milliseconds. */
export interface DstSwitch {
  zone: string;
  /** The instant of the change. */
  instant: string;
  instantMs: number;
  offsetBefore: string;
  offsetAfter: string;
  /** Minutes the clocks move: positive is forward (spring forward), negative back. */
  shiftMin: number;
}

/** What a tile says about DST at the scrubbed instant. */
export type DstStatus = "dst" | "standard" | "none";

const DAY_MS = 24 * 60 * 60 * 1000;

/** `±HH:MM` as minutes, or `null` for anything else. */
export function offsetMinutes(offset: string): number | null {
  const m = /^([+-])(\d{2}):(\d{2})$/.exec(offset);
  if (!m) return null;
  const minutes = Number(m[2]) * 60 + Number(m[3]);
  return m[1] === "-" ? -minutes : minutes;
}

function yearOfMs(ms: number): number | null {
  const utc = convertUnixToUtc(ms, { epochUnit: "milliseconds" });
  const year = Number(parseYearFromUtc(utc));
  return Number.isInteger(year) ? year : null;
}

/**
 * Every offset change the library lists for a zone in a year, cached: a zone's
 * rules do not change while the page is open, and the planner asks again on
 * every step of a drag.
 */
const BY_ZONE_YEAR = new Map<string, readonly DstSwitch[]>();

export function zoneSwitchesInYear(
  zone: string,
  year: number,
): readonly DstSwitch[] {
  const key = `${zone}\u0000${year}`;
  const known = BY_ZONE_YEAR.get(key);
  if (known) return known;
  const list: DstSwitch[] = [];
  for (const t of getDstTransitions(zone, year)) {
    const instantMs = convertUtcToUnix(t.instant, {
      epochUnit: "milliseconds",
    });
    const before = offsetMinutes(t.offsetBefore);
    const after = offsetMinutes(t.offsetAfter);
    if (instantMs === null || before === null || after === null) continue;
    list.push({
      zone,
      instant: t.instant,
      instantMs,
      offsetBefore: t.offsetBefore,
      offsetAfter: t.offsetAfter,
      shiftMin: after - before,
    });
  }
  BY_ZONE_YEAR.set(key, list);
  return list;
}

/** The years that can hold a switch in `[fromMs, toMs]`. A switch is listed under
 *  the zone's local year, and offsets reach 14 hours, so each end is widened by a
 *  day. */
function yearsCovering(fromMs: number, toMs: number): number[] {
  const first = yearOfMs(Math.min(fromMs, toMs) - DAY_MS);
  const last = yearOfMs(Math.max(fromMs, toMs) + DAY_MS);
  if (first === null || last === null) return [];
  const years: number[] = [];
  for (let y = first; y <= last; y++) years.push(y);
  return years;
}

/** Every switch in `zone` after `fromMs` and up to and including `toMs`, in time order. */
export function switchesBetween(
  zone: string,
  fromMs: number,
  toMs: number,
): DstSwitch[] {
  const lo = Math.min(fromMs, toMs);
  const hi = Math.max(fromMs, toMs);
  const out: DstSwitch[] = [];
  for (const year of yearsCovering(lo, hi)) {
    for (const s of zoneSwitchesInYear(zone, year)) {
      if (s.instantMs > lo && s.instantMs <= hi) out.push(s);
    }
  }
  return out.sort((a, b) => a.instantMs - b.instantMs);
}

/**
 * The switch a scrub has crossed in `zone`: the one between the reference time
 * and the scrubbed instant that is nearest the scrubbed instant. `null` when the
 * scrub has crossed none.
 */
export function crossedSwitch(
  zone: string,
  referenceMs: number,
  scrubbedMs: number,
): DstSwitch | null {
  const between = switchesBetween(zone, referenceMs, scrubbedMs);
  if (between.length === 0) return null;
  return scrubbedMs >= referenceMs ? between[between.length - 1]! : between[0]!;
}

/**
 * A zone's DST state at an instant: `dst` when the library says the instant is in
 * DST, `standard` when it is not but the zone changes offset that year, `none`
 * when the zone keeps one offset all year (Tokyo, Reykjavik, a zone that stopped
 * observing DST). The year is the instant's own, so Istanbul in 2010 and in 2026
 * are different answers.
 */
export function dstStatus(
  zone: string,
  localYear: number,
  inDst: boolean,
): DstStatus {
  if (inDst) return "dst";
  return zoneSwitchesInYear(zone, localYear).length > 0 ? "standard" : "none";
}

/**
 * The earliest switch strictly after `afterMs` among `zones`, whichever kind it
 * is. Looks `YEARS_AHEAD` calendar years past the year of `afterMs`, which holds
 * every zone that has DST at all; a list of zones that keep one offset returns
 * `null`.
 */
export const YEARS_AHEAD = 2;

export function nextSwitch(
  zones: readonly string[],
  afterMs: number,
): DstSwitch | null {
  const first = yearOfMs(afterMs - DAY_MS);
  if (first === null) return null;
  let best: DstSwitch | null = null;
  for (const zone of zones) {
    for (let y = first; y <= first + YEARS_AHEAD + 1; y++) {
      for (const s of zoneSwitchesInYear(zone, y)) {
        if (s.instantMs > afterMs && (!best || s.instantMs < best.instantMs)) {
          best = s;
        }
      }
    }
  }
  return best;
}

/** The switches of every zone in the window around `centreMs`, for the marks on
 *  the slider's track. */
export function switchesInWindow(
  zones: readonly string[],
  centreMs: number,
  halfWidthMs: number,
): DstSwitch[] {
  const out: DstSwitch[] = [];
  for (const zone of zones) {
    out.push(
      ...switchesBetween(zone, centreMs - halfWidthMs, centreMs + halfWidthMs),
    );
  }
  return out.sort((a, b) => a.instantMs - b.instantMs);
}
