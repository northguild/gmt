/**
 * The land outline, prepared once for the GPU renderer (#289).
 *
 * `world-atlas`'s `land-110m` is a TopoJSON of merged coastlines — land, not
 * country borders. It is 55 KB, and decoding plus triangulating it takes a few
 * milliseconds, so it happens at mount and is cached at module scope: two globes
 * on one page share the result.
 *
 * Only the WebGPU renderer uses this. The canvas-2D fallback keeps d3's `geoPath`
 * over the raw topology, which is a deliberate duplication — see the header of
 * `canvas2d/renderer-canvas2d.ts`.
 *
 * ## The two awkward rings
 *
 * Measured, not assumed: of 126 rings, four cross the antimeridian (Eurasia
 * twice, plus two small islands) and exactly one — Antarctica, 556 points —
 * circles the south pole without reaching it, stopping at 85.6°S. `geometry.ts`
 * handles both: unwrapping removes the jumps, and the pole closure fills the cap
 * for the mesh while leaving it out of the outline, so no seam is stroked across
 * the ice.
 */

import { feature } from "topojson-client";
import land110m from "world-atlas/land-110m.json";
import {
  outlineSegments,
  preparePolygon,
  type PreparedPolygon,
} from "./geometry";
import {
  MAX_INTERIOR_ANGLE_DEG,
  triangulatePolygons,
  type Mesh,
} from "./triangulate";
import type { LngLat, PolygonRings } from "./types";

export interface LandGeometry {
  /** Triangles for the fill, in lng/lat. */
  mesh: Mesh;
  /** Segment pairs for the outline: `[lngA, latA, lngB, latB, …]`. */
  outline: Float32Array<ArrayBuffer>;
}

let cached: LandGeometry | null = null;

/** Build (or reuse) the land mesh and outline. */
export function landGeometry(
  maxAngleDeg: number = MAX_INTERIOR_ANGLE_DEG,
): LandGeometry {
  if (cached) return cached;
  const polygons = landPolygons().map((rings) => preparePolygon(rings));
  cached = {
    mesh: triangulatePolygons(polygons, maxAngleDeg),
    outline: collectOutline(polygons),
  };
  return cached;
}

/** The raw rings, exposed for tests that need to count what came out of the file. */
export function landPolygons(): PolygonRings[] {
  type TopologyLike = Parameters<typeof feature>[0];
  const topology = land110m as unknown as TopologyLike;
  const objects = (topology as { objects: Record<string, unknown> }).objects;
  const collection = feature(
    topology,
    objects.land as Parameters<typeof feature>[1],
  ) as unknown as {
    features: {
      geometry:
        | { type: "Polygon"; coordinates: number[][][] }
        | { type: "MultiPolygon"; coordinates: number[][][][] };
    }[];
  };

  const polygons: PolygonRings[] = [];
  for (const entry of collection.features) {
    const raw =
      entry.geometry.type === "Polygon"
        ? [entry.geometry.coordinates]
        : entry.geometry.coordinates;
    for (const polygon of raw) {
      polygons.push(
        polygon.map((ring) =>
          ring.map((point) => [point[0], point[1]] as LngLat),
        ),
      );
    }
  }
  return polygons;
}

function collectOutline(
  polygons: readonly PreparedPolygon[],
): Float32Array<ArrayBuffer> {
  const parts = polygons.map((polygon) => outlineSegments(polygon));
  let total = 0;
  for (const part of parts) total += part.length;
  const out = new Float32Array(total);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}
