/**
 * Which zones the globe's clock list and markers are currently showing.
 *
 * The list carries ~420 zones, and once it tells you each one's local day and
 * DST state (see `zone-readout.ts`) the obvious next question is "show me only
 * the ones that are on tomorrow", or "only the ones in DST". This module is the
 * model behind those toggles: the filter itself, the bucket a reading falls
 * into, and the counts the UI needs to decide which toggles are worth showing.
 *
 * Pure — no DOM and no clock. `zone-filter-ui.ts` renders it, `globe.ts` owns
 * one instance and applies it to both the clock list and the globe's markers.
 *
 * Every axis is something the reader can already see. Day and DST are on each
 * card; the sky is the globe's own day/night terminator, and the tooltip names
 * it. A filter that sorted by something invisible would be a puzzle; every
 * toggle here turns off something you can point at.
 */

import type { ZoneReading } from "./zone-clock";
import type { SkyState } from "./zone-sky";
import { SKY_ICON_PATHS, skyFilterLabel } from "./zone-sky";
import { ICON_STROKE } from "./widget-ui";
import {
  type DayShift,
  type DstState,
  dayShift,
  dstState,
} from "./zone-readout";

/** Day buckets, in the order the toggles list them: past, present, future. */
export const DAY_SHIFTS = ["prev", "same", "next"] as const;

/** DST buckets, in the order the toggles list them. */
export const DST_STATES = ["dst", "standard", "none"] as const;

/** Sky buckets, brightest first. */
export const SKY_STATES = ["day", "twilight", "night"] as const;

export interface ZoneFilter {
  days: Record<DayShift, boolean>;
  dst: Record<DstState, boolean>;
  sky: Record<SkyState, boolean>;
}

/** The axes a single zone falls on. */
export interface ZoneBucket {
  day: DayShift;
  dst: DstState;
  sky: SkyState;
}

export interface BucketCounts {
  days: Record<DayShift, number>;
  dst: Record<DstState, number>;
  sky: Record<SkyState, number>;
}

/** Everything on — nothing hidden. The state the globe mounts in. */
export function defaultZoneFilter(): ZoneFilter {
  return {
    days: { prev: true, same: true, next: true },
    dst: { dst: true, standard: true, none: true },
    sky: { day: true, twilight: true, night: true },
  };
}

/**
 * Whether the filter is actually hiding anything.
 *
 * Load-bearing, not a convenience: while nothing is filtered there is no need
 * to know any zone's bucket, so `globe.ts` skips the whole scan. The default
 * state costs nothing.
 */
export function isFilterEngaged(filter: ZoneFilter): boolean {
  return (
    DAY_SHIFTS.some((day) => !filter.days[day]) ||
    DST_STATES.some((state) => !filter.dst[state]) ||
    SKY_STATES.some((state) => !filter.sky[state])
  );
}

/**
 * The bucket a reading belongs to.
 *
 * A reading that hit its sentinel has no day and no DST rules to speak of, so
 * it lands in `same`/`none` — the buckets that are on by default. A zone whose
 * clock is broken should not also silently vanish from the list.
 */
export function bucketFor(
  reading: ZoneReading,
  viewerDate: string,
  sky: SkyState,
): ZoneBucket {
  if (!reading.ok) return { day: "same", dst: "none", sky };
  return {
    day: viewerDate ? dayShift(reading.date, viewerDate) : "same",
    dst: dstState(reading),
    sky,
  };
}

export function matchesFilter(bucket: ZoneBucket, filter: ZoneFilter): boolean {
  return (
    filter.days[bucket.day] && filter.dst[bucket.dst] && filter.sky[bucket.sky]
  );
}

/** How many zones sit in each bucket, for the toggle labels. */
export function countBuckets(buckets: Iterable<ZoneBucket>): BucketCounts {
  const counts: BucketCounts = {
    days: { prev: 0, same: 0, next: 0 },
    dst: { dst: 0, standard: 0, none: 0 },
    sky: { day: 0, twilight: 0, night: 0 },
  };
  for (const bucket of buckets) {
    counts.days[bucket.day] += 1;
    counts.dst[bucket.dst] += 1;
    counts.sky[bucket.sky] += 1;
  }
  return counts;
}

/** Toggle wording for a day bucket. Sentence case — these are controls, not prose. */
export function dayFilterLabel(day: DayShift): string {
  if (day === "prev") return "Yesterday";
  if (day === "next") return "Tomorrow";
  return "Today";
}

/** Toggle wording for a DST bucket. */
export function dstFilterLabel(state: DstState): string {
  if (state === "dst") return "In DST";
  if (state === "standard") return "Standard time";
  return "No DST";
}

/**
 * Whether a toggle should be on screen at all.
 *
 * Shown when its bucket has zones in it — an empty "Yesterday" is noise, and
 * for most of the day there is no such bucket. But *also* shown whenever it is
 * unchecked, however empty it is: a filter you switched off must always be
 * reachable to switch back on. Without that second clause, unchecking the last
 * bucket would remove the only control that could undo it.
 */
export function showToggle(count: number, checked: boolean): boolean {
  return count > 0 || !checked;
}

/**
 * Glyphs for the day toggles, at the same stroke weight as the DST pair the
 * rows already draw. Direction is the whole idea: yesterday points back,
 * tomorrow points forward, today is a mark on the spot.
 */
export const DAY_ICON_PATHS: Readonly<Record<DayShift, string>> = {
  prev: `<g ${ICON_STROKE}><path d="M19 12H5"/><path d="m11 6-6 6 6 6"/></g>`,
  same: `<g ${ICON_STROKE}><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5"/></g>`,
  next: `<g ${ICON_STROKE}><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></g>`,
};

/**
 * Glyphs for the DST toggles: three clocks, because daylight saving is a
 * property of the clock and not of the sky.
 *
 * Sun and moon stood here first and were wrong — see `dstBadge` in
 * `zone-readout.ts` for why, in short: this widget sits beside a globe that
 * draws a day/night terminator, so a sun reads as "daytime" before it reads as
 * anything else. A clock whose hand is being pushed forward is what DST
 * actually is; a plain clock is the standard offset; a struck-through clock is
 * a zone with no DST rules to shift.
 */
export const DST_FILTER_ICON_PATHS: Readonly<Record<DstState, string>> = {
  dst: `<g ${ICON_STROKE}><circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 1.5"/><path d="m17.5 5.5 2.5-2M20 3v3h-3"/></g>`,
  standard: `<g ${ICON_STROKE}><circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 1.5"/></g>`,
  none: `<g ${ICON_STROKE}><circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 1.5"/><path d="m6.5 17.5 11-11"/></g>`,
};

/** Inner SVG markup for one toggle, by axis and bucket. */
export function filterIconPath(axis: FilterAxis, key: string): string {
  if (axis === "day") return DAY_ICON_PATHS[key as DayShift] ?? "";
  if (axis === "dst") return DST_FILTER_ICON_PATHS[key as DstState] ?? "";
  return SKY_ICON_PATHS[key as SkyState] ?? "";
}

/** The axes a toggle can belong to. */
export type FilterAxis = "day" | "dst" | "sky";

/**
 * The accordion's own trigger glyph — a settings gear, drawn at the same
 * weight as everything else in here.
 */
export const FILTER_SETTINGS_ICON = `<g ${ICON_STROKE}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V15Z"/></g>`;

/** Toggle wording for a sky bucket. */
export { skyFilterLabel };
