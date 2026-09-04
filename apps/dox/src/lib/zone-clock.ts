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
 * A sentinel return (`""` from a gmt function) surfaces as `ok: false`, which
 * the widgets render as the design system's "signal lost" state rather than a
 * blank field.
 */

import { isInDaylightSaving } from "@northguild/gmt/zoned/compare";
import { convertZonedToZoned } from "@northguild/gmt/zoned/convert";
import { getTimeZoneOffset, getZonedNow } from "@northguild/gmt/zoned/get";
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

function parseZoned(
  id: string,
  zoned: string,
  observesDst: boolean,
): ZoneReading {
  const match = ZONED_PATTERN.exec(zoned);
  if (!match) return { id, observesDst, ...SENTINEL };
  const [, date, time, rawOffset] = match;
  return {
    id,
    ok: true,
    date,
    time,
    offset: rawOffset === "Z" ? "+00:00" : rawOffset,
    inDst: isInDaylightSaving(zoned),
    observesDst,
  };
}

/** Current local reading for a zone. */
export function readZoneNow(id: string): ZoneReading {
  const observesDst = hasDaylightSaving(id);
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
  const observesDst = hasDaylightSaving(id);
  const zoned = convertZonedToZoned(anchorZoned, id);
  if (!zoned) return { id, observesDst, ...SENTINEL };
  return parseZoned(id, zoned, observesDst);
}

/**
 * Offset for a zone at a UTC instant, as `±HH:MM`, or `""` on sentinel.
 * Thin pass-through to `getTimeZoneOffset` — kept here so callers touch one
 * import surface.
 */
export function offsetAt(id: string, instantUtc: string): string {
  return getTimeZoneOffset(id, instantUtc);
}
