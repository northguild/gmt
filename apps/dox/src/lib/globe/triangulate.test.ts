/// <reference types="vitest/globals" />

/**
 * Triangulation, checked against every polygon the site ships.
 *
 * The three properties that matter are area (the mesh must cover the polygon and
 * nothing else), maximum edge length (a long edge sags through the sphere), and
 * conformity (no T-junctions, or the mesh shows hairline cracks). The last is the
 * one a naive "split the longest edge" refinement gets wrong, so it is tested
 * directly rather than assumed from the implementation.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fillRing, preparePolygon, type PreparedPolygon } from "./geometry";
import { landPolygons } from "./land";
import {
  MAX_INTERIOR_ANGLE_DEG,
  triangulatePolygon,
  triangulatePolygons,
  type Mesh,
} from "./triangulate";
import type { LngLat, PolygonRings } from "./types";

const DOX = path.resolve(import.meta.dirname, "..", "..", "..");

interface TzFeature {
  properties: { tzid: string };
  geometry:
    | { type: "Polygon"; coordinates: number[][][] }
    | { type: "MultiPolygon"; coordinates: number[][][][] };
}

const TZ: { features: TzFeature[] } = JSON.parse(
  readFileSync(path.join(DOX, "public/timezone-boundaries-globe.json"), "utf8"),
);

function polygonsOf(feature: TzFeature): PolygonRings[] {
  const raw =
    feature.geometry.type === "Polygon"
      ? [feature.geometry.coordinates]
      : feature.geometry.coordinates;
  return raw.map((poly) =>
    poly.map((ring) => ring.map((p) => [p[0], p[1]] as LngLat)),
  );
}

const ring = (...points: [number, number][]): PolygonRings => [
  points.map(([lng, lat]) => [lng, lat] as LngLat),
];

/** Signed area of a flat ring, by the shoelace formula. */
function ringArea(points: Float64Array): number {
  let sum = 0;
  const count = points.length / 2;
  for (let i = 0, j = count - 1; i < count; j = i++) {
    sum +=
      points[j * 2] * points[i * 2 + 1] - points[i * 2] * points[j * 2 + 1];
  }
  return Math.abs(sum) / 2;
}

/** Total area of a mesh's triangles. */
function meshArea(mesh: Mesh): number {
  let sum = 0;
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const a = mesh.indices[t] * 2;
    const b = mesh.indices[t + 1] * 2;
    const c = mesh.indices[t + 2] * 2;
    sum +=
      Math.abs(
        (mesh.vertices[b] - mesh.vertices[a]) *
          (mesh.vertices[c + 1] - mesh.vertices[a + 1]) -
          (mesh.vertices[c] - mesh.vertices[a]) *
            (mesh.vertices[b + 1] - mesh.vertices[a + 1]),
      ) / 2;
  }
  return sum;
}

/** The longest edge in a mesh, as an angle on the sphere in degrees. */
function longestEdge(mesh: Mesh): number {
  const DEG = Math.PI / 180;
  const unit = (lng: number, lat: number): [number, number, number] => {
    const cosLat = Math.cos(lat * DEG);
    return [
      cosLat * Math.cos(lng * DEG),
      cosLat * Math.sin(lng * DEG),
      Math.sin(lat * DEG),
    ];
  };
  let longest = 0;
  for (let t = 0; t < mesh.indices.length; t += 3) {
    for (const [p, q] of [
      [0, 1],
      [1, 2],
      [2, 0],
    ] as const) {
      const a = mesh.indices[t + p] * 2;
      const b = mesh.indices[t + q] * 2;
      const u = unit(mesh.vertices[a], mesh.vertices[a + 1]);
      const v = unit(mesh.vertices[b], mesh.vertices[b + 1]);
      const dot = Math.min(
        1,
        Math.max(-1, u[0] * v[0] + u[1] * v[1] + u[2] * v[2]),
      );
      longest = Math.max(longest, Math.acos(dot) / DEG);
    }
  }
  return longest;
}

/**
 * Count edges used by exactly one triangle.
 *
 * A watertight mesh has every interior edge shared by two triangles, so the
 * once-used edges are precisely the boundary. A T-junction shows up as a boundary
 * that is longer than the polygon's own perimeter — one neighbour split an edge
 * the other did not, leaving two short edges facing one long one.
 */
function boundaryLength(mesh: Mesh): number {
  const counts = new Map<string, number>();
  for (let t = 0; t < mesh.indices.length; t += 3) {
    for (const [p, q] of [
      [0, 1],
      [1, 2],
      [2, 0],
    ] as const) {
      const a = mesh.indices[t + p];
      const b = mesh.indices[t + q];
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  let total = 0;
  for (const [key, count] of counts) {
    if (count !== 1) continue;
    const [a, b] = key.split(":").map(Number);
    total += Math.hypot(
      mesh.vertices[a * 2] - mesh.vertices[b * 2],
      mesh.vertices[a * 2 + 1] - mesh.vertices[b * 2 + 1],
    );
  }
  return total;
}

/** Perimeter of a prepared polygon's rings, pole closure included. */
function perimeter(polygon: PreparedPolygon): number {
  let total = 0;
  for (const r of [polygon.outer, ...polygon.holes]) {
    const points = r.points;
    const count = points.length / 2;
    for (let i = 0, j = count - 1; i < count; j = i++) {
      total += Math.hypot(
        points[i * 2] - points[j * 2],
        points[i * 2 + 1] - points[j * 2 + 1],
      );
    }
  }
  return total;
}

describe("triangulatePolygon", () => {
  it("covers a square exactly", () => {
    const square = preparePolygon(ring([0, 0], [2, 0], [2, 2], [0, 2], [0, 0]));
    const mesh = triangulatePolygon(square);
    expect(meshArea(mesh)).toBeCloseTo(4, 9);
  });

  it("leaves a hole empty", () => {
    const withHole = preparePolygon([
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
        [0, 0],
      ] as LngLat[],
      [
        [4, 4],
        [6, 4],
        [6, 6],
        [4, 6],
        [4, 4],
      ] as LngLat[],
    ]);
    const mesh = triangulatePolygon(withHole);
    // 100 for the square less 4 for the hole.
    expect(meshArea(mesh)).toBeCloseTo(96, 6);
  });

  it("splits a long interior diagonal, not just the boundary", () => {
    /* A wide, shallow polygon: every boundary edge is already short, but ear
       clipping joins far-apart vertices, so only interior refinement can bring
       the mesh under the limit. */
    const points: [number, number][] = [];
    for (let lng = 0; lng <= 60; lng += 2) points.push([lng, 0]);
    for (let lng = 60; lng >= 0; lng -= 2) points.push([lng, 2]);
    const wide = preparePolygon(ring(...points));
    const mesh = triangulatePolygon(wide);
    expect(longestEdge(mesh)).toBeLessThanOrEqual(
      MAX_INTERIOR_ANGLE_DEG + 1e-6,
    );
    expect(meshArea(mesh)).toBeCloseTo(120, 6);
  });

  it("stays watertight while refining", () => {
    const points: [number, number][] = [];
    for (let lng = 0; lng <= 60; lng += 2) points.push([lng, 0]);
    for (let lng = 60; lng >= 0; lng -= 2) points.push([lng, 2]);
    const wide = preparePolygon(ring(...points));
    const mesh = triangulatePolygon(wide);
    /* With no T-junctions the once-used edges are exactly the polygon's
       boundary, so their total length matches its perimeter. A crack would add
       interior edges to that total. */
    expect(boundaryLength(mesh)).toBeCloseTo(perimeter(wide), 6);
  });

  it("fills the polar cap of a ring that circles the pole", () => {
    const points: [number, number][] = [];
    for (let lng = -180; lng <= 180; lng += 10) points.push([lng, -80]);
    const polar = preparePolygon(ring(...points));
    const mesh = triangulatePolygon(polar);
    // 360° of longitude by 10° of latitude down to the pole.
    expect(meshArea(mesh)).toBeCloseTo(3600, 3);
  });

  it("returns an empty mesh for a degenerate ring", () => {
    const degenerate = preparePolygon(ring([0, 0], [1, 1]));
    const mesh = triangulatePolygon(degenerate);
    expect(mesh.indices.length).toBe(0);
  });
});

describe("every shipped timezone polygon", () => {
  const prepared = TZ.features.flatMap((feature) =>
    polygonsOf(feature).map((poly) => ({
      tzid: feature.properties.tzid,
      polygon: preparePolygon(poly),
      rawArea: ringArea(preparePolygon(poly).outer.points),
    })),
  );

  it("has polygons to check", () => {
    expect(prepared.length).toBeGreaterThan(800);
  });

  it("triangulates with no edge over the limit and no T-junction", () => {
    const failures: string[] = [];
    for (const entry of prepared) {
      const mesh = triangulatePolygon(entry.polygon);
      if (mesh.indices.length === 0) continue;
      const edge = longestEdge(mesh);
      if (edge > MAX_INTERIOR_ANGLE_DEG + 1e-4) {
        failures.push(`${entry.tzid}: longest edge ${edge.toFixed(3)}°`);
      }
      /* A T-junction can only *add* to the boundary, so the comparison is
         one-sided. The tolerance is 1e-4 relative because a mesh stores its
         vertices as float32 while `perimeter` measures the float64 originals,
         and that difference accumulates over thousands of edges. A real crack
         adds a whole edge — at least the densification limit — which is orders
         of magnitude above this. */
      const boundary = boundaryLength(mesh);
      const expected = perimeter(entry.polygon);
      if (boundary - expected > 1e-4 * Math.max(1, expected)) {
        failures.push(
          `${entry.tzid}: boundary ${boundary.toFixed(4)} exceeds perimeter ${expected.toFixed(4)}`,
        );
      }
    }
    expect(failures.slice(0, 10)).toEqual([]);
  });

  it("preserves each polygon's area", () => {
    const failures: string[] = [];
    for (const entry of prepared) {
      // Holes and pole closures make the outer ring's own area the wrong
      // comparison, so only simple polygons are checked here.
      if (entry.polygon.holes.length > 0 || entry.polygon.windsPole !== 0)
        continue;
      const mesh = triangulatePolygon(entry.polygon);
      if (mesh.indices.length === 0) continue;
      const area = meshArea(mesh);
      if (Math.abs(area - entry.rawArea) > 1e-4 * Math.max(1, entry.rawArea)) {
        failures.push(
          `${entry.tzid}: mesh ${area.toFixed(5)} vs ring ${entry.rawArea.toFixed(5)}`,
        );
      }
    }
    expect(failures.slice(0, 10)).toEqual([]);
  });
});

/**
 * The exact form of the T-junction check, on the polygons most likely to show
 * one: a crack leaves a vertex sitting in the middle of a neighbour's edge.
 *
 * Quadratic in the mesh size, so it runs on a few named awkward cases rather
 * than the whole dataset — Antarctica winds a pole, Adak and Fiji are cut at the
 * antimeridian, and McMurdo has the dataset's longest edges.
 */
describe("no vertex sits inside another triangle's edge", () => {
  for (const tzid of [
    "Antarctica/McMurdo",
    "America/Adak",
    "Pacific/Fiji",
    "Europe/London",
  ]) {
    it(tzid, () => {
      const feature = TZ.features.find((f) => f.properties.tzid === tzid);
      expect(feature, `${tzid} is in the dataset`).toBeDefined();
      for (const poly of polygonsOf(feature!)) {
        const mesh = triangulatePolygon(preparePolygon(poly));
        if (mesh.indices.length === 0) continue;

        // Collect the edges used exactly once: the mesh's boundary.
        const counts = new Map<string, [number, number]>();
        const seen = new Map<string, number>();
        for (let t = 0; t < mesh.indices.length; t += 3) {
          for (const [p, q] of [
            [0, 1],
            [1, 2],
            [2, 0],
          ] as const) {
            const a = mesh.indices[t + p];
            const b = mesh.indices[t + q];
            const key = a < b ? `${a}:${b}` : `${b}:${a}`;
            seen.set(key, (seen.get(key) ?? 0) + 1);
            counts.set(key, [Math.min(a, b), Math.max(a, b)]);
          }
        }
        const boundary = [...seen.entries()]
          .filter(([, count]) => count === 1)
          .map(([key]) => counts.get(key)!);

        const vertexCount = mesh.vertices.length / 2;
        for (const [a, b] of boundary) {
          const ax = mesh.vertices[a * 2];
          const ay = mesh.vertices[a * 2 + 1];
          const bx = mesh.vertices[b * 2];
          const by = mesh.vertices[b * 2 + 1];
          const length = Math.hypot(bx - ax, by - ay);
          if (length === 0) continue;
          for (let v = 0; v < vertexCount; v++) {
            if (v === a || v === b) continue;
            const vx = mesh.vertices[v * 2];
            const vy = mesh.vertices[v * 2 + 1];
            const cross =
              Math.abs((bx - ax) * (vy - ay) - (by - ay) * (vx - ax)) / length;
            if (cross > 1e-5) continue;
            const along =
              ((vx - ax) * (bx - ax) + (vy - ay) * (by - ay)) /
              (length * length);
            expect(
              along > 1e-6 && along < 1 - 1e-6,
              `${tzid}: vertex ${v} lies on boundary edge ${a}-${b}`,
            ).toBe(false);
          }
        }
      }
    });
  }
});

/**
 * The land mesh, which is what the globe actually draws and what the timezone
 * polygons above do not exercise: `world-atlas`'s Afro-Eurasia is the one
 * polygon in either dataset that both crosses the antimeridian *and* has a hole,
 * and that combination is what broke it. Each ring unwraps on its own, so the
 * coastline moved a full turn west while the Caspian stayed put, and the
 * triangulator bridged across the landmass to reach a hole that was not there —
 * a band missing through northern Eurasia and the Mediterranean filled in.
 */
describe("the land mesh", () => {
  const polygons = landPolygons().map((rings) => preparePolygon(rings));

  it("covers every polygon's own area, holes excluded", () => {
    const failures: string[] = [];
    polygons.forEach((polygon, index) => {
      const outer = fillRing(polygon);
      const expected =
        ringArea(outer) -
        polygon.holes.reduce((sum, hole) => sum + ringArea(hole.points), 0);
      if (expected <= 0) return;
      const area = meshArea(triangulatePolygon(polygon));
      const relative = Math.abs(area - expected) / expected;
      if (relative > 1e-3) {
        failures.push(
          `polygon ${index}: expected ${expected.toFixed(2)}, got ${area.toFixed(2)} (${(relative * 100).toFixed(1)}% out)`,
        );
      }
    });
    expect(failures).toEqual([]);
  });

  it("keeps a hole in the same 360° window as its outer ring", () => {
    for (const polygon of polygons) {
      for (const hole of polygon.holes) {
        expect(hole.lngMin).toBeGreaterThanOrEqual(polygon.outer.lngMin - 1e-6);
        expect(hole.lngMax).toBeLessThanOrEqual(polygon.outer.lngMax + 1e-6);
      }
    }
  });

  it("builds one mesh with no edge over the limit", () => {
    const mesh = triangulatePolygons(polygons);
    expect(mesh.indices.length / 3).toBeGreaterThan(10_000);
    expect(longestEdge(mesh)).toBeLessThanOrEqual(
      MAX_INTERIOR_ANGLE_DEG + 1e-4,
    );
    for (const index of mesh.indices) {
      expect(index).toBeLessThan(mesh.vertices.length / 2);
    }
  });
});

describe("triangulatePolygons", () => {
  it("merges several polygons into one mesh, offsetting indices", () => {
    const a = preparePolygon(ring([0, 0], [2, 0], [2, 2], [0, 2], [0, 0]));
    const b = preparePolygon(ring([10, 0], [12, 0], [12, 2], [10, 2], [10, 0]));
    const merged = triangulatePolygons([a, b]);
    expect(meshArea(merged)).toBeCloseTo(8, 9);
    for (const index of merged.indices) {
      expect(index).toBeLessThan(merged.vertices.length / 2);
    }
  });
});
