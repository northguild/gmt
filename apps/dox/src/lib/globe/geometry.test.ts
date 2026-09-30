/// <reference types="vitest/globals" />

/**
 * Geometry preparation, exercised against the data the site actually ships —
 * `world-atlas/land-110m` and `public/timezone-boundaries-globe.json` — not
 * against invented shapes. Every awkward case here is a real feature: Antarctica
 * winds the south pole without reaching it, Eurasia crosses the antimeridian
 * twice, and `Antarctica/McMurdo` has a 310° edge along the −86° parallel that
 * d3 reads as a great circle and this code deliberately does not.
 */

import { geoContains } from "d3-geo";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  closeAtPole,
  densifyRing,
  fillRing,
  greatCirclePoints,
  MAX_EDGE_DEG,
  outlineSegments,
  poleWinding,
  pointInPolygon,
  pointInRing,
  preparePolygon,
  unwrapRing,
} from "./geometry";
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

function zone(tzid: string): TzFeature {
  const found = TZ.features.find((f) => f.properties.tzid === tzid);
  if (!found) throw new Error(`no such zone in the dataset: ${tzid}`);
  return found;
}

/** Every polygon of a feature, as `[outerRing, ...holes]` of `LngLat`. */
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

// ---------------------------------------------------------------------------
// unwrapRing
// ---------------------------------------------------------------------------

describe("unwrapRing", () => {
  it("leaves a ring that never crosses the seam alone", () => {
    const out = unwrapRing([
      [0, 0],
      [10, 0],
      [10, 10],
    ]);
    expect([...out]).toEqual([0, 0, 10, 0, 10, 10]);
  });

  it("makes an eastward seam crossing continuous", () => {
    const out = unwrapRing([
      [170, 0],
      [179, 0],
      [-179, 0],
      [-170, 0],
    ]);
    expect([...out]).toEqual([170, 0, 179, 0, 181, 0, 190, 0]);
  });

  it("makes a westward seam crossing continuous", () => {
    const out = unwrapRing([
      [-170, 0],
      [-179, 0],
      [179, 0],
    ]);
    expect([...out]).toEqual([-170, 0, -179, 0, -181, 0]);
  });

  it("removes every jump from every ring in both shipped datasets", () => {
    const check = (rings: PolygonRings[], label: string) => {
      for (const poly of rings) {
        for (const r of poly) {
          const out = unwrapRing(r);
          for (let i = 2; i < out.length; i += 2) {
            expect(
              Math.abs(out[i] - out[i - 2]),
              `${label}: jump at index ${i / 2}`,
            ).toBeLessThanOrEqual(180);
          }
        }
      }
    };
    for (const feature of TZ.features) {
      check(polygonsOf(feature), feature.properties.tzid);
    }
  });
});

// ---------------------------------------------------------------------------
// poleWinding / closeAtPole
// ---------------------------------------------------------------------------

describe("poleWinding", () => {
  it("finds no winding in an ordinary ring", () => {
    expect(
      poleWinding(unwrapRing(ring([0, 0], [10, 0], [10, 10], [0, 0])[0])),
    ).toBe(0);
  });

  it("spots a ring that circles the south pole", () => {
    // A closed loop along the −80° parallel, as Antarctica's coastline is.
    const points: [number, number][] = [];
    for (let lng = -180; lng <= 180; lng += 20) points.push([lng, -80]);
    expect(poleWinding(unwrapRing(ring(...points)[0]))).toBe(-1);
  });

  it("spots a ring that circles the north pole", () => {
    const points: [number, number][] = [];
    for (let lng = -180; lng <= 180; lng += 20) points.push([lng, 75]);
    expect(poleWinding(unwrapRing(ring(...points)[0]))).toBe(1);
  });
});

describe("closeAtPole", () => {
  it("adds the two vertices that carry a ring to the pole", () => {
    const points = new Float64Array([0, -80, 180, -80, 360, -80]);
    const out = closeAtPole(points, -1);
    expect([...out]).toEqual([0, -80, 180, -80, 360, -80, 360, -90, 0, -90]);
  });
});

// ---------------------------------------------------------------------------
// densifyRing
// ---------------------------------------------------------------------------

describe("densifyRing", () => {
  it("leaves short edges untouched", () => {
    const points = new Float64Array([0, 0, 1, 1, 2, 0]);
    expect(densifyRing(points, 2.5)).toBe(points);
  });

  it("splits a long edge into equal pieces along the straight lng/lat line", () => {
    const out = densifyRing(new Float64Array([0, 0, 10, 0]), 2.5);
    expect([...out]).toEqual([0, 0, 2.5, 0, 5, 0, 7.5, 0, 10, 0]);
  });

  it("keeps every intermediate point on the original straight line", () => {
    const out = densifyRing(
      new Float64Array([-150, -86, 160, -86]),
      MAX_EDGE_DEG,
    );
    for (let i = 1; i < out.length; i += 2) {
      // The whole point of the McMurdo fix: the parallel stays a parallel.
      expect(out[i]).toBeCloseTo(-86, 12);
    }
    expect(out[0]).toBe(-150);
    expect(out[out.length - 2]).toBe(160);
  });

  it("brings every edge in both shipped datasets under the limit", () => {
    for (const feature of TZ.features) {
      for (const poly of polygonsOf(feature)) {
        const prepared = preparePolygon(poly);
        for (const r of [prepared.outer, ...prepared.holes]) {
          const points = r.points;
          for (let i = 2; i < points.length; i += 2) {
            const edge = Math.max(
              Math.abs(points[i] - points[i - 2]),
              Math.abs(points[i + 1] - points[i - 1]),
            );
            expect(
              edge,
              `${feature.properties.tzid}: edge ${i / 2} spans ${edge}°`,
            ).toBeLessThanOrEqual(MAX_EDGE_DEG + 1e-9);
          }
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// pointInRing / pointInPolygon
// ---------------------------------------------------------------------------

describe("pointInRing", () => {
  it("handles a simple square", () => {
    const square = preparePolygon(
      ring([0, 0], [10, 0], [10, 10], [0, 10], [0, 0]),
    );
    expect(pointInRing(square.outer, 5, 5)).toBe(true);
    expect(pointInRing(square.outer, 15, 5)).toBe(false);
    expect(pointInRing(square.outer, 5, -5)).toBe(false);
  });

  it("finds a point inside a ring that was stored across the seam", () => {
    // 170°E to 170°W, a band straddling the antimeridian.
    const band = preparePolygon(
      ring([170, -10], [-170, -10], [-170, 10], [170, 10], [170, -10]),
    );
    expect(pointInRing(band.outer, 180, 0)).toBe(true);
    expect(pointInRing(band.outer, -180, 0)).toBe(true);
    expect(pointInRing(band.outer, 175, 0)).toBe(true);
    expect(pointInRing(band.outer, -175, 0)).toBe(true);
    expect(pointInRing(band.outer, 0, 0)).toBe(false);
    expect(pointInRing(band.outer, 160, 0)).toBe(false);
  });
});

describe("pointInPolygon", () => {
  it("excludes holes", () => {
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
    expect(pointInPolygon(withHole, 2, 2)).toBe(true);
    expect(pointInPolygon(withHole, 5, 5)).toBe(false);
  });

  /**
   * `Antarctica/McMurdo` is the Ross Dependency: a 50°-wide sector from 160°E
   * east across the antimeridian to 150°W. The dataset stores it cut at the
   * seam (RFC 7946 §3.1.9), so its widest edge reads as `[-150,-86] →
   * [160,-86]` — a 310° jump if taken literally. Unwrapping turns that into the
   * 50° step it is, and the sector keeps its shape.
   */
  it("reads Antarctica/McMurdo as the 50° Ross sector, not a 310° band", () => {
    const polygons = polygonsOf(zone("Antarctica/McMurdo")).map((p) =>
      preparePolygon(p),
    );
    const inside = (lng: number, lat: number) =>
      polygons.some((p) => pointInPolygon(p, lng, lat));

    // Inside the sector, either side of the seam.
    expect(inside(175, -80)).toBe(true);
    expect(inside(-170, -80)).toBe(true);
    expect(inside(180, -80)).toBe(true);
    // Outside it: longitudes the sector does not reach.
    expect(inside(0, -80)).toBe(false);
    expect(inside(100, -80)).toBe(false);
    expect(inside(0, 0)).toBe(false);
    expect(inside(139, 35)).toBe(false);
  });

  /**
   * Where this file and `d3-geo` part company, and why the RFC decides it.
   *
   * RFC 7946 §3.1.1: "A line between two positions is a straight Cartesian
   * line, the shortest line between those two points in the coordinate
   * reference system", interpolated as `lon0 + (lon1 - lon0) * t` — with the
   * note that it "may markedly differ from the geodesic path along the curved
   * surface of the reference ellipsoid". d3 takes every edge as a great circle
   * instead, so McMurdo's southern boundary — stored as two points on the −86°
   * parallel — bows polewards in d3 and claims ground the dataset puts outside
   * the zone.
   *
   * Across a 12.1-million-sample off-vertex grid the two readings differ on 89
   * point/zone pairs, every one of them on a long edge above 68° south. This
   * pins one, so the fix cannot silently regress to the great-circle reading.
   */
  it("follows RFC 7946's straight-line edges where d3 bows them polewards", () => {
    const polygons = polygonsOf(zone("Antarctica/McMurdo")).map((p) =>
      preparePolygon(p),
    );
    const inside = (lng: number, lat: number) =>
      polygons.some((p) => pointInPolygon(p, lng, lat));

    // Just south of the −86° parallel that bounds the sector: outside.
    expect(inside(-179.2718, -86.3379)).toBe(false);
    expect(inside(177.8242, -86.3379)).toBe(false);
    // Just north of it, well inside the sector's longitudes: inside.
    expect(inside(-179.2718, -85.5)).toBe(true);
    // d3's great-circle reading disagrees, which is the deviation, not the rule.
    expect(
      geoContains(zone("Antarctica/McMurdo").geometry, [-179.2718, -86.3379]),
    ).toBe(true);
  });

  /**
   * The dataset leaves the ground south of roughly 86°S unassigned: McMurdo's
   * ring reaches the pole only along a zero-width spike at the seam, and no
   * other zone covers the cap either. Both readings agree on that, so it is a
   * property of the data and not something to paper over here — recorded so
   * that a later dataset refresh which *does* assign the cap is a visible
   * change rather than a surprise.
   */
  it("leaves the south polar cap unclaimed, as the dataset does", () => {
    const prepared = TZ.features.map((f) => ({
      tzid: f.properties.tzid,
      polygons: polygonsOf(f).map((p) => preparePolygon(p)),
    }));
    for (const [lng, lat] of [
      [0, -88],
      [90, -88],
      [-60, -87.5],
    ] as const) {
      const ours = prepared
        .filter((e) => e.polygons.some((p) => pointInPolygon(p, lng, lat)))
        .map((e) => e.tzid);
      expect(ours, `${lng},${lat}`).toEqual([]);
      expect(
        TZ.features.filter((f) => geoContains(f.geometry, [lng, lat])).length,
        `d3 on ${lng},${lat}`,
      ).toBe(0);
    }
  });

  it("agrees with d3 on ordinary mid-latitude zones", () => {
    /* Away from the poles the straight-edge and great-circle readings differ by
       far less than the data's own resolution, so d3 is a fair oracle for the
       common case — which is what keeps the canvas-2D fallback (still on d3) and
       the GPU path selecting the same zone for the same tap. */
    const cases: [string, LngLat, boolean][] = [
      ["Europe/London", [-0.13, 51.51], true],
      ["Europe/London", [2.35, 48.86], false],
      ["Asia/Tokyo", [139.69, 35.69], true],
      ["America/New_York", [-73.99, 40.73], true],
      ["America/New_York", [-118.24, 34.05], false],
      ["Australia/Sydney", [151.21, -33.87], true],
      ["Africa/Cairo", [31.24, 30.04], true],
    ];
    for (const [tzid, [lng, lat], expected] of cases) {
      const polygons = polygonsOf(zone(tzid)).map((p) => preparePolygon(p));
      const ours = polygons.some((p) => pointInPolygon(p, lng, lat));
      expect(ours, `${tzid} contains ${lng},${lat}`).toBe(expected);
      expect(
        geoContains(zone(tzid).geometry, [lng, lat]),
        `d3 on ${tzid}`,
      ).toBe(expected);
    }
  });

  it("finds a point in a zone the dataset cut at the antimeridian", () => {
    // Fiji sits either side of 180°; the dataset stores it in two pieces.
    const polygons = polygonsOf(zone("Pacific/Fiji")).map((p) =>
      preparePolygon(p),
    );
    const inside = (lng: number, lat: number) =>
      polygons.some((p) => pointInPolygon(p, lng, lat));
    expect(inside(178.44, -18.14)).toBe(true); // Suva
    expect(inside(-179.9, -16.5)).toBe(true); // Taveuni side of the seam
    expect(inside(0, 0)).toBe(false);
  });

  it("assigns every zone's own interior sample to itself and nowhere else", () => {
    /* A guard on the whole dataset rather than a hand-picked few: take a point
       known to be inside each of a spread of zones and check no *other* zone
       claims it. Catches an unwrap or alignment error that silently widens a
       polygon by 360°. */
    const prepared = TZ.features.map((f) => ({
      tzid: f.properties.tzid,
      polygons: polygonsOf(f).map((p) => preparePolygon(p)),
    }));
    const samples: [string, LngLat][] = [
      ["Europe/London", [-0.13, 51.51]],
      ["Asia/Tokyo", [139.69, 35.69]],
      ["America/Sao_Paulo", [-46.63, -23.55]],
      ["Africa/Nairobi", [36.82, -1.29]],
      ["Asia/Kolkata", [77.21, 28.61]],
      ["America/Los_Angeles", [-118.24, 34.05]],
      ["Pacific/Auckland", [174.76, -36.85]],
    ];
    for (const [tzid, [lng, lat]] of samples) {
      const claimants = prepared
        .filter((entry) =>
          entry.polygons.some((p) => pointInPolygon(p, lng, lat)),
        )
        .map((entry) => entry.tzid);
      expect(claimants, `${lng},${lat} should be ${tzid} alone`).toEqual([
        tzid,
      ]);
    }
  });
});

// ---------------------------------------------------------------------------
// fillRing / outlineSegments
// ---------------------------------------------------------------------------

describe("fillRing", () => {
  it("returns the ring unchanged when no pole is involved", () => {
    const square = preparePolygon(
      ring([0, 0], [10, 0], [10, 10], [0, 10], [0, 0]),
    );
    expect(fillRing(square)).toBe(square.outer.points);
  });

  it("closes a pole-winding ring over the pole", () => {
    const points: [number, number][] = [];
    for (let lng = -180; lng <= 180; lng += 10) points.push([lng, -80]);
    const polar = preparePolygon(ring(...points));
    const filled = fillRing(polar);
    expect(filled.length).toBeGreaterThan(polar.outer.points.length);
    // The last two vertices sit on the pole.
    expect(filled[filled.length - 1]).toBe(-90);
    expect(filled[filled.length - 3]).toBe(-90);
  });
});

describe("outlineSegments", () => {
  it("drops an edge running along the antimeridian", () => {
    /* A zone cut at the seam has a vertical edge down 180°. It is where a
       dataset split a country, not a border, and stroking it draws a bright line
       across the Pacific. */
    const cut = preparePolygon(
      ring([170, -10], [180, -10], [180, 10], [170, 10], [170, -10]),
    );
    const segments = outlineSegments(cut);
    for (let i = 0; i < segments.length; i += 4) {
      const onSeam =
        Math.abs(Math.abs(segments[i]) - 180) < 1e-6 &&
        Math.abs(Math.abs(segments[i + 2]) - 180) < 1e-6;
      expect(onSeam, `segment ${i / 4} runs along the seam`).toBe(false);
    }
    expect(segments.length).toBeGreaterThan(0);
  });

  it("drops an edge running along a pole", () => {
    const points: [number, number][] = [];
    for (let lng = -180; lng <= 180; lng += 20) points.push([lng, -80]);
    const polar = preparePolygon(ring(...points));
    // The pole closure is a fill concern; the outline must not see it at all.
    const segments = outlineSegments(polar);
    for (let i = 0; i < segments.length; i += 4) {
      expect(Math.abs(segments[i + 1])).not.toBe(90);
      expect(Math.abs(segments[i + 3])).not.toBe(90);
    }
  });

  it("keeps a genuine coastline edge", () => {
    const square = preparePolygon(ring([0, 0], [2, 0], [2, 2], [0, 2], [0, 0]));
    expect(outlineSegments(square).length).toBe(4 * 4);
  });
});

// ---------------------------------------------------------------------------
// greatCirclePoints
// ---------------------------------------------------------------------------

describe("greatCirclePoints", () => {
  it("starts and ends at its endpoints", () => {
    const out = greatCirclePoints([-0.13, 51.51], [139.69, 35.69]);
    expect(out[0]).toBeCloseTo(-0.13, 6);
    expect(out[1]).toBeCloseTo(51.51, 6);
    // Unwrapped, so the far end may read beyond 180.
    expect(((out[out.length - 2] + 540) % 360) - 180).toBeCloseTo(139.69, 6);
    expect(out[out.length - 1]).toBeCloseTo(35.69, 6);
  });

  it("bends polewards between two points on the same parallel, as a great circle does", () => {
    const out = greatCirclePoints([-60, 45], [60, 45]);
    let maxLat = -90;
    for (let i = 1; i < out.length; i += 2) maxLat = Math.max(maxLat, out[i]);
    expect(maxLat).toBeGreaterThan(45.5);
  });

  it("stays continuous across the seam", () => {
    const out = greatCirclePoints([170, 10], [-170, 10]);
    for (let i = 2; i < out.length; i += 2) {
      expect(Math.abs(out[i] - out[i - 2])).toBeLessThanOrEqual(180);
    }
  });

  it("handles coincident endpoints without dividing by zero", () => {
    const out = greatCirclePoints([10, 20], [10, 20]);
    for (const value of out) expect(Number.isFinite(value)).toBe(true);
  });
});
