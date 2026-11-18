/**
 * The clock pins the ice wall leaves on the Earth: which zones get a shard, and the label each
 * one carries. The times come from gmt (`getZonedNow`), imported after first paint like every
 * other clock on the deck.
 */
import { arcDegrees, labelOf, resolvePlace, type PlacePoint } from "./places";

/** How many shards become pins. */
export const WALL_PINS = 12;

type ZonedNow = (zone: string, options?: { smallestUnit?: "minute" }) => string;

let zoned: Promise<ZonedNow> | undefined;

/** gmt's `getZonedNow`, imported on first use, so the polyfill behind it stays off first paint. */
export const loadZonedNow = (): Promise<ZonedNow> =>
  (zoned ??= import("@northguild/gmt/zoned/get").then((m) => m.getZonedNow));

/** The `count` zones nearest a point on the Earth, nearest first. Ties keep the list's order. */
export function nearestZones(
  zones: readonly string[],
  from: PlacePoint,
  count: number,
): string[] {
  return zones
    .map((zone, index) => {
      const place = resolvePlace(zone);
      const at: PlacePoint =
        place.kind === "zone" || place.kind === "point"
          ? [place.lng, place.lat]
          : from;
      return { zone, index, arc: arcDegrees(from, at) };
    })
    .sort((a, b) => a.arc - b.arc || a.index - b.index)
    .slice(0, count)
    .map((z) => z.zone);
}

/** `Tokyo 23:30`: the city, then the zone's local time to the minute. */
export function clockLabel(zone: string, zonedNow: ZonedNow): string {
  const place = resolvePlace(zone);
  const city =
    place.kind === "zone" || place.kind === "point" ? labelOf(place) : zone;
  const text = zonedNow(zone, { smallestUnit: "minute" });
  // "2024-02-29T23:30+09:00[Asia/Tokyo]": the time is characters 11 to 16.
  const time = text.slice(11, 16);
  return /^\d\d:\d\d$/.test(time) ? `${city} ${time}` : city;
}
