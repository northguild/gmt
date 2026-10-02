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
 * Nothing is cached. The library's rule for daylight time (a forward change of
 * the clocks up to the backward change of the same size that undoes it) reads
 * the zone's transitions around the instant, so no key short of the instant's
 * own offset period is complete, and an answer for "this zone, this year, this
 * offset" is wrong for a zone like America/Asuncion, which is in daylight time
 * in January 2024 and not in December 2024 at the same offset. A scrub step
 * with eight zones costs about 5 ms (both calls, measured), and a reading is
 * only taken when something moves, so the calls are made as asked.
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

function parseZoned(id: string, zoned: string): ZoneReading {
  const match = ZONED_PATTERN.exec(zoned);
  // Whether the zone observes DST is asked for the instant read, not for today:
  // the scrubber reads other dates, and a zone can stop (or start) observing it.
  const observesDst = hasDaylightSaving(id, { at: zoned });
  if (!match) return { id, observesDst: false, ...SENTINEL };
  const [, date, time, rawOffset] = match;
  const offset = rawOffset === "Z" ? "+00:00" : rawOffset;
  return {
    id,
    ok: true,
    date,
    time,
    offset,
    inDst: isInDaylightSaving(zoned),
    observesDst,
  };
}

/** Current local reading for a zone. */
export function readZoneNow(id: string): ZoneReading {
  const zoned = getZonedNow(id);
  if (!zoned) return { id, observesDst: false, ...SENTINEL };
  return parseZoned(id, zoned);
}

/**
 * Reading for a zone at the instant described by `anchorZoned` (a zoned ISO
 * string in any zone — the scrubber keeps it in UTC). Uses `convertZonedToZoned`
 * exactly as DOX-E1b's Definition of Done requires.
 */
export function readZoneAt(id: string, anchorZoned: string): ZoneReading {
  const zoned = convertZonedToZoned(anchorZoned, id);
  if (!zoned) return { id, observesDst: false, ...SENTINEL };
  return parseZoned(id, zoned);
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
