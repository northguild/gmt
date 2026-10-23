/**
 * The Canada map of the clock-change checker (CORE-88): the Lambert projection that fits Canada
 * to the drawing's box, and the Canada `ZoneMapConfig` the shared zone map (`zone-map.ts`) draws
 * with. The map's code is in `zone-map.ts`; everything here is a fact about Canada.
 */
import { geoConicConformal } from "d3-geo";
import type { GeoProjection } from "d3-geo";
import {
  CLOCK_ZONES,
  KIND_LABELS,
  PROBE_ZONES,
  STOPPED_ZONES,
} from "./canada-clock-change";
import { withBase } from "./site";
import { MAP_WIDTH, zonesOnly } from "./zone-map";
import type { BoundaryCollection, ZoneMapConfig } from "./zone-map";

/** The drawing's height; its width is the shared `MAP_WIDTH`. */
export const MAP_HEIGHT = 640;
const INSET = 16;

/**
 * Lambert conformal conic with the parameters of EPSG:3347 ("NAD83 / Statistics Canada Lambert"):
 * standard parallels 49 and 77 degrees north, central meridian 91.866667 degrees west, latitude
 * of origin 63.390675 degrees north. Source: the IOGP EPSG Geodetic Parameter Registry
 * (<https://epsg.org/crs_3347/>); Statistics Canada publishes the same projection for its
 * boundary files. The result is fitted to the zones' bounds in the drawing's box with an inset on every side, and
 * clipped to the box, so the land around the zones ends at the box's edge.
 */
export function canadaProjection(
  boundaries: BoundaryCollection,
  width = MAP_WIDTH,
  height = MAP_HEIGHT,
): GeoProjection {
  const projection = geoConicConformal()
    .parallels([49, 77])
    .rotate([91.866667, 0])
    .center([0, 63.390675]);
  projection.fitExtent(
    [
      [INSET, INSET],
      [width - INSET, height - INSET],
    ],
    // The zones only: the land feature around them never changes the scale.
    zonesOnly(boundaries) as unknown as Parameters<
      GeoProjection["fitExtent"]
    >[1],
  );
  projection.clipExtent([
    [0, 0],
    [width, height],
  ]);
  return projection;
}

/**
 * Where the five permanent labels sit, `[lon, lat]`, each inside its zone's land. Stated rather
 * than computed so the labels stay apart down to a 400 px frame (`zone-map.test.ts` checks it):
 * Vancouver in the south of British Columbia; Edmonton in the zone's north (the Northwest
 * Territories), Winnipeg in northern Manitoba and Inuvik in the far north, so the three western
 * labels sit in three bands; Toronto in the east of Ontario, away from Winnipeg's.
 */
export const CANADA_ANCHORS: Readonly<
  Record<string, readonly [number, number]>
> = {
  "America/Vancouver": [-122.8, 50.2],
  "America/Edmonton": [-114.5, 63.5],
  "America/Inuvik": [-126.3, 66.7],
  "America/Winnipeg": [-98.5, 59.5],
  "America/Toronto": [-78, 51.5],
};

/** The tzdb release that recorded the change, for a zone that stops changing in 2026. */
export function releaseOf(id: string): string | null {
  return PROBE_ZONES.find((fact) => fact.zone === id)?.release ?? null;
}

export const CANADA_MAP: ZoneMapConfig = {
  idPrefix: "canada",
  height: MAP_HEIGHT,
  boundariesUrl: withBase("/timezone-boundaries-canada.json"),
  projection: canadaProjection,
  stopped: STOPPED_ZONES,
  kindLabels: KIND_LABELS,
  releaseOf,
  releaseRange: "2026b to 2026e",
  mapLabel: "Map of Canada's time zones. The zone list holds the same zones.",
  labelled: CLOCK_ZONES,
  anchors: CANADA_ANCHORS,
};
