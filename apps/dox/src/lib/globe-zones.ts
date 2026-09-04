/**
 * Zone list + coordinate resolution for the DOX-E1a globe and the DOX-E1b
 * scrubber.
 *
 * `@northguild/gmt`'s `getTimeZones()` returns IANA identifiers only, with no
 * coordinates. `TZ_COORDINATES` (generated from tzdb's `zone1970.tab` — see
 * `scripts/prepare-tz-coordinates.mjs`) supplies the lat/lng. The globe plots
 * and lists only zones present in *both* — a zone the runtime cannot resolve
 * cannot show a live clock, and a zone with no coordinate cannot be placed.
 *
 * Pure module: no `@northguild/gmt` import, no DOM. The caller passes the
 * runtime zone list in, which keeps this unit-testable and keeps the polyfill
 * out of anything that only needs the coordinate table.
 */

import { TZ_COORDINATES, type ZoneCoordinate } from "./tz-coordinates";

export type { ZoneCoordinate };

/**
 * Curated spread of offsets and DST behaviours. Kept in step with
 * `scripts/build-utils/build-utils.ts`'s `CURATED_TIMEZONES` (the DST inspector /
 * playground list) by `globe-zones.test.ts` — inlined rather than imported
 * because `build-utils.ts` pulls in the TypeScript compiler, which must never
 * reach a browser bundle.
 */
const CURATED = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Australia/Sydney",
  "Australia/Adelaide",
  "Pacific/Auckland",
  "Pacific/Honolulu",
  "Africa/Cairo",
  "Africa/Lagos",
  "Africa/Johannesburg",
] as const;

/** Lookup built once from the generated table. */
export const COORDINATES_BY_ID: ReadonlyMap<string, ZoneCoordinate> = new Map(
  TZ_COORDINATES.map((zone) => [zone.id, zone]),
);

/**
 * The always-visible, always-labelled markers, and the default clock-panel
 * list — the curated set minus any the coordinate table happens not to carry.
 */
export const GLOBE_PRIMARY_ZONES: readonly string[] = CURATED.filter((id) =>
  COORDINATES_BY_ID.has(id),
);

export interface GlobeZone extends ZoneCoordinate {
  /** A primary zone is labelled and shown by default; others are search-only. */
  primary: boolean;
}

/**
 * Intersect the runtime's available zones with the coordinate table.
 *
 * @param availableZones result of `getTimeZones()` — pass `[]` and every
 *   coordinate-table zone is used as the fallback (e.g. older runtimes where
 *   `Intl.supportedValuesOf` is missing).
 */
export function resolveGlobeZones(
  availableZones: readonly string[],
): GlobeZone[] {
  const primary = new Set(GLOBE_PRIMARY_ZONES);
  const allow =
    availableZones.length > 0
      ? new Set(availableZones)
      : new Set(TZ_COORDINATES.map((zone) => zone.id));

  return TZ_COORDINATES.filter((zone) => allow.has(zone.id))
    .map((zone) => ({ ...zone, primary: primary.has(zone.id) }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** Rotation `[λ, φ]` that brings a zone to the centre of the visible hemisphere. */
export function rotationForZone(zone: ZoneCoordinate): [number, number] {
  return [-zone.lng, -zone.lat];
}
