/**
 * The Morocco map of the clock-change checker (CORE-89): the Lambert projection that fits the
 * region's frame to the drawing's box, and the Morocco `ZoneMapConfig` the shared zone map
 * (`zone-map.ts`) draws with. The map's code is in `zone-map.ts`; everything here is a fact about
 * Morocco and its neighbours.
 */
import { geoConicConformal } from "d3-geo";
import type { GeoProjection } from "d3-geo";
import {
  MOROCCO_KIND_LABELS,
  MOROCCO_ZONES,
  MOROCCO_RELEASE,
  MOROCCO_STOPPED,
} from "./morocco-clock-change";
import regionZones from "./morocco-region-zones.json";
import { withBase } from "./site";
import { MAP_WIDTH } from "./zone-map";
import type { BoundaryCollection, ZoneMapConfig } from "./zone-map";

/** The map's frame in degrees: `[west, south, east, north]`. The boundary script clips to it. */
export const MOROCCO_FRAME = [-19, 20.5, 5, 44.5] as const;

/**
 * The frame projected at `MAP_WIDTH` is 861 px tall, rounded to the nearest 10. The drawing's
 * width is the shared `MAP_WIDTH`.
 */
export const MAP_HEIGHT = 860;

/**
 * Lambert conformal conic, two standard parallels (EPSG method 9802, "Lambert Conic Conformal
 * (2SP)", defined in IOGP Guidance Note 7-2 and implemented by d3's `geoConicConformal`).
 * Standard parallels 24.5 and 40.5 degrees north (one sixth of the frame's latitude span in from
 * each edge), central meridian 7 degrees west, latitude of origin 32.5 degrees north. It is
 * conformal, so shapes keep their form.
 *
 * No EPSG projected CRS covers Morocco, Western Sahara, Iberia, the Canary Islands and Madeira
 * together (EPSG registry v12.029, searched by the frame's area: only world-wide systems contain
 * it; the nearest, EPSG:3034 "ETRS89-extended / LCC Europe", ends at 24.6 degrees north and so
 * leaves out Western Sahara's south). So the parameters are the frame's own.
 *
 * The projection is fitted to the frame, not to the data: the same box whatever file is drawn.
 * Shapes are clipped to the box (`clipExtent`).
 */
export function moroccoProjection(
  _boundaries?: BoundaryCollection,
  width = MAP_WIDTH,
  height = MAP_HEIGHT,
): GeoProjection {
  const [west, south, east, north] = MOROCCO_FRAME;
  // The frame's edges follow meridians and parallels, which a conic draws as curves; sample them
  // every half degree rather than letting d3 join the corners with great circles.
  const edge: [number, number][] = [];
  for (let lon = west; lon <= east; lon += 0.5)
    edge.push([lon, south], [lon, north]);
  for (let lat = south; lat <= north; lat += 0.5)
    edge.push([west, lat], [east, lat]);
  const projection = geoConicConformal()
    .parallels([24.5, 40.5])
    .rotate([7, 0])
    .center([0, 32.5]);
  projection.fitExtent(
    [
      [0, 0],
      [width, height],
    ],
    { type: "MultiPoint", coordinates: edge } as unknown as Parameters<
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
 * A stated nudge, in degrees `[east, north]`, for the two rings that would overlap. Ceuta and
 * Gibraltar lie 0.25 degrees apart, about 8 px at the drawing's width, and a ring is 12 px across,
 * so unmoved they cover each other and a press can land on the wrong zone. Each ring moves 0.12
 * degrees away from the other (Gibraltar north, Ceuta south), which leaves a gap between them.
 * A ring marks "a zone is here", not a survey point, and the shapes themselves are not moved.
 */
export const MARKER_NUDGE: Readonly<Record<string, readonly [number, number]>> =
  {
    "Europe/Gibraltar": [0, 0.12],
    "Africa/Ceuta": [0, -0.12],
  };

/**
 * Where the small-shape rings go: the `zone.tab` coordinate of each zone, written by the script,
 * plus `MARKER_NUDGE`.
 */
export const MAP_MARKERS: Readonly<Record<string, readonly [number, number]>> =
  Object.fromEntries(
    Object.entries(regionZones.coords).map(([id, at]) => {
      const [dx, dy] = MARKER_NUDGE[id] ?? [0, 0];
      return [id, [at[0]! + dx, at[1]! + dy] as const];
    }),
  );

/**
 * Where the two permanent labels sit, `[lon, lat]`, each inside its zone's land: Casablanca in
 * Morocco's interior, El Aaiun in the north of Western Sahara's drawn part, away from the coast.
 */
export const MOROCCO_ANCHORS: Readonly<
  Record<string, readonly [number, number]>
> = {
  "Africa/Casablanca": [-6.5, 32],
  "Africa/El_Aaiun": [-13.5, 25],
};

/** The tzdb release that recorded the change, for a zone that stops changing in 2026. */
export function releaseOf(id: string): string | null {
  return MOROCCO_STOPPED.has(id) ? MOROCCO_RELEASE : null;
}

export const MOROCCO_MAP: ZoneMapConfig = {
  idPrefix: "morocco",
  height: MAP_HEIGHT,
  boundariesUrl: withBase("/timezone-boundaries-morocco.json"),
  projection: moroccoProjection,
  stopped: MOROCCO_STOPPED,
  kindLabels: MOROCCO_KIND_LABELS,
  releaseOf,
  releaseRange: "2026c to 2026e",
  mapLabel:
    "Map of the time zones of Morocco and its neighbours. The zone list holds the same zones.",
  markerMinPx: 12,
  markers: MAP_MARKERS,
  labelled: MOROCCO_ZONES,
  anchors: MOROCCO_ANCHORS,
};
