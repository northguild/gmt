/** The globe's time-zone boundaries as shipped (`src/assets/timezone-boundaries-globe.json`), for the geometry tests. */
import { readFileSync } from "node:fs";
import path from "node:path";

export interface TzFeature {
  properties: { tzid: string };
  geometry:
    | { type: "Polygon"; coordinates: number[][][] }
    | { type: "MultiPolygon"; coordinates: number[][][][] };
}

export const TZ_GLOBE: { features: TzFeature[] } = JSON.parse(
  readFileSync(
    path.resolve(
      import.meta.dirname,
      "../assets/timezone-boundaries-globe.json",
    ),
    "utf8",
  ),
);
