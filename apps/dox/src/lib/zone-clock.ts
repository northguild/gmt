/**
 * Shared zone-reading helper for the globe (DOX-E1a) and the multi-zone
 * scrubber (DOX-E1b).
 *
 * Everything here is computed from `@northguild/gmt`'s already-exported
 * functions — `getZonedNow`, `getTimeZoneOffset`, `convertZonedToZoned`,
 * `isInDaylightSaving`, `hasDaylightSaving` — imported at module-barrel
 * granularity so the bundler tree-shakes the rest of each barrel. The
 * `@js-temporal/polyfill` those functions depend on rides along in this
 * (lazy-loaded) chunk; it is never on a page's critical path.
 *
 * Two of those calls are cached, because the globe's clock list reads every
 * visible row once a second and the polyfill is not cheap. See the caches
 * below: both are keyed so that an entry goes stale exactly when its answer can
 * change, never on a timer and never on a guess. That is a claim about
 * correctness, not memory: no entry is ever removed (see `IN_DST`).
 *
 * A sentinel return (`""` from a gmt function) surfaces as `ok: false`, which
 * the widgets render as the design system's "signal lost" state rather than a
 * blank field.
 */

import { isInDaylightSaving } from "@northguild/gmt/zoned/compare";
import { convertZonedToZoned } from "@northguild/gmt/zoned/convert";
import {
  getSystemTimeZone,
  getTimeZoneOffset,
  getZonedNow,
} from "@northguild/gmt/zoned/get";
import { hasDaylightSaving } from "@northguild/gmt/zoned/validate";

export interface ZoneReading {
  id: string;
  /** false => a gmt function returned its sentinel; render "signal lost". */
  ok: boolean;
  /** Local wall date, `YYYY-MM-DD`. */
  date: string;
  /** Local wall time, `HH:MM:SS`. */
  time: string;
  /** UTC offset, `±HH:MM` (or `+00:00` for `Z`). */
  offset: string;
  /** Whether this instant is in daylight saving in this zone. */
  inDst: boolean;
  /** Whether the zone observes DST at all. */
  observesDst: boolean;
}

const ZONED_PATTERN =
  /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})/;

const SENTINEL: Omit<ZoneReading, "id" | "observesDst"> = {
  ok: false,
  date: "",
  time: "",
  offset: "",
  inDst: false,
};

/**
 * Whether a zone observes DST at all, cached.
 *
 * This is a property of the zone's rules, not of any instant, so it cannot
 * change while the page is open — and the globe's clock list was paying for it
 * again on every visible row, every second. Under the Temporal polyfill that is
 * the single most expensive call in a tick.
 */
const OBSERVES_DST = new Map<string, boolean>();

function observesDstCached(id: string): boolean {
  const known = OBSERVES_DST.get(id);
  if (known !== undefined) return known;
  const value = hasDaylightSaving(id);
  OBSERVES_DST.set(id, value);
  return value;
}

/**
 * Whether an instant is in DST, cached against the zone, **the year** and the
 * offset.
 *
 * The key is the complete input set of `isInDaylightSaving`, which is what
 * makes this exact rather than a guess: that function reads the zone, the
 * offset, and the year — it compares the offset against the smaller of that
 * year's own January and July offsets.
 *
 * The year is load-bearing, not belt-and-braces. Keying on `(zone, offset)`
 * alone looks sound — daylight saving *is* a change of offset — but the same
 * offset can be DST in one year and standard in another, whenever a zone stops
 * observing it and keeps the summer offset all year:
 *
 *     2016-07-01T12:00:00+03:00[Europe/Istanbul] -> true   (DST)
 *     2026-07-01T12:00:00+03:00[Europe/Istanbul] -> false  (permanent +03:00)
 *
 * Turkey went permanently +03:00 in 2016. Without the year both of those hash
 * to one entry, and whichever is read first answers for the other — which the
 * scrubber can reach, since it takes an arbitrary anchor date from the user.
 *
 * A zone still recomputes at most once per transition per year rather than
 * once per second, which is the whole point of the cache.
 *
 * It is never cleared. Unlike `OBSERVES_DST`, whose ~420 keys are a hard
 * ceiling, this key space is open: the scrubber takes any anchor date, so a
 * reader dragging across a century adds an entry per zone, year and offset
 * visited. That is tens of thousands of short strings at most, which a docs
 * page can afford, so there is deliberately no eviction.
 */
const IN_DST = new Map<string, boolean>();

function inDstCached(
  id: string,
  year: string,
  offset: string,
  zoned: string,
): boolean {
  const key = `${id}\u0000${year}\u0000${offset}`;
  const known = IN_DST.get(key);
  if (known !== undefined) return known;
  const value = isInDaylightSaving(zoned);
  IN_DST.set(key, value);
  return value;
}

function parseZoned(
  id: string,
  zoned: string,
  observesDst: boolean,
): ZoneReading {
  const match = ZONED_PATTERN.exec(zoned);
  if (!match) return { id, observesDst, ...SENTINEL };
  const [, date, time, rawOffset] = match;
  const offset = rawOffset === "Z" ? "+00:00" : rawOffset;
  return {
    id,
    ok: true,
    date,
    time,
    offset,
    inDst: inDstCached(id, date.slice(0, 4), offset, zoned),
    observesDst,
  };
}

/** Current local reading for a zone. */
export function readZoneNow(id: string): ZoneReading {
  const observesDst = observesDstCached(id);
  const zoned = getZonedNow(id);
  if (!zoned) return { id, observesDst, ...SENTINEL };
  return parseZoned(id, zoned, observesDst);
}

/**
 * Reading for a zone at the instant described by `anchorZoned` (a zoned ISO
 * string in any zone — the scrubber keeps it in UTC). Uses `convertZonedToZoned`
 * exactly as DOX-E1b's Definition of Done requires.
 */
export function readZoneAt(id: string, anchorZoned: string): ZoneReading {
  const observesDst = observesDstCached(id);
  const zoned = convertZonedToZoned(anchorZoned, id);
  if (!zoned) return { id, observesDst, ...SENTINEL };
  return parseZoned(id, zoned, observesDst);
}

/**
 * The viewer's own local date, `YYYY-MM-DD`, or `""` if the browser will not
 * name its zone.
 *
 * This is the reference every "yesterday / tomorrow" call-out is measured
 * against, so it is read rather than assumed — and it is read fresh on each
 * clock tick rather than captured once at mount, because it changes at the
 * viewer's own midnight and every card's day-shift flips with it.
 */
export function readViewerDate(): string {
  return readViewerStamp().date;
}

/**
 * The viewer's own local date and minute, `YYYY-MM-DD` and `HH:MM`.
 *
 * The minute is what paces the globe's zone-bucket scan. Every zone's local day
 * and DST state changes only on a whole-minute boundary — IANA offsets are
 * whole minutes, and so are transitions — so rescanning all ~420 zones once a
 * second would recompute an answer that provably cannot have moved. Both fields
 * come from one reading, so asking for them costs one call, not two.
 */
export function readViewerStamp(): { date: string; minute: string } {
  const id = getSystemTimeZone();
  if (!id) return { date: "", minute: "" };
  const reading = readZoneNow(id);
  return { date: reading.date, minute: reading.time.slice(0, 5) };
}

/**
 * Offset for a zone at a UTC instant, as `±HH:MM`, or `""` on sentinel.
 * Thin pass-through to `getTimeZoneOffset` — kept here so callers touch one
 * import surface.
 */
export function offsetAt(id: string, instantUtc: string): string {
  return getTimeZoneOffset(id, instantUtc);
}
