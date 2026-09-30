/**
 * Preparing geographic rings for a GPU that knows nothing about longitude
 * (#289).
 *
 * Pure, no DOM, no d3. Four problems, all of them real in the data this site
 * ships rather than theoretical:
 *
 * 1. **The antimeridian.** A ring that crosses ±180° is stored with a jump from
 *    `179.9` to `-179.9`. Read literally that edge sweeps most of the way round
 *    the planet. Four rings in `world-atlas/land-110m` do this (Eurasia twice,
 *    Antarctica, and two small islands), and one time zone does
 *    (`Antarctica/McMurdo`). `unwrapRing` makes each ring's longitudes
 *    continuous instead, so Eurasia runs −17…190 and the jump disappears. The
 *    camera takes any longitude, so nothing downstream minds the range.
 *
 * 2. **Rings that wind a pole.** Antarctica's coastline circles the south pole
 *    without ever reaching it: its unwrapped longitude spans a full 360° and its
 *    latitudes stop at −85.6°. As a polygon that is a closed loop with a hole
 *    where the pole should be, so filling it leaves the cap empty. `poleWinding`
 *    detects it and `closeAtPole` adds the two vertices that carry the ring down
 *    to the pole — for the fill only, never the outline, or a seam appears
 *    across the ice.
 *
 * 3. **Flat triangles inside a round planet.** The renderers place vertices on
 *    the sphere but interpolate straight lines between them, so a long edge cuts
 *    a chord under the surface and pulls the shape away from the limb.
 *    `densifyRing` splits edges until none spans more than a couple of degrees.
 *
 * 4. **Edges are straight in lng/lat, not great circles.** This is where d3 and
 *    this file deliberately part company, and it is a bug fix rather than a
 *    compromise. `d3.geoContains` treats every edge as a great-circle arc, so
 *    `Antarctica/McMurdo`'s boundary — which the dataset draws as a straight
 *    line along the −86° parallel — bows away from the pole and the polar cap
 *    falls outside the zone. The dataset means the parallel. `pointInPolygon`
 *    reads it that way, and the same densification above makes the drawn shape
 *    agree with the hit-tested one.
 */

import type { LngLat, PolygonRings, Ring } from "./types";

/**
 * How long an edge may be, in degrees of longitude or latitude, before it is
 * split.
 *
 * Chosen to match what `d3-geo`'s `precision(0.4)` buys the canvas-2D renderer:
 * a 2.5° chord on a sphere drawn at the largest radius this site reaches
 * (roughly 1400px, a hero-sized stage at zoom 5 on a 2× display) sags about a
 * third of a pixel away from the true surface.
 */
export const MAX_EDGE_DEG = 2.5;

/** A ring ready for a renderer: flat `[lng, lat, lng, lat, …]`. */
export interface PreparedRing {
  /** Interleaved coordinates. Flat because this is what `earcut` takes and what
   *  a vertex buffer wants, so nothing has to re-pack it later. */
  readonly points: Float64Array;
  /** Longitude bounds after unwrapping — `pointInPolygon` needs them to decide
   *  which 360° window a query point belongs in. */
  readonly lngMin: number;
  readonly lngMax: number;
}

export interface PreparedPolygon {
  readonly outer: PreparedRing;
  readonly holes: readonly PreparedRing[];
  /** `1` north, `-1` south, `0` for the ordinary case. Set when the outer ring
   *  circles a pole, so a fill knows to close over it. */
  readonly windsPole: -1 | 0 | 1;
}

/** `Number.EPSILON` is too tight for data quantised to 0.01°; this is a hair. */
const EPS = 1e-9;

/**
 * Make a ring's longitudes continuous, removing antimeridian jumps.
 *
 * Every step of more than 180° is read as the seam rather than as real travel,
 * and an accumulating offset cancels it. The result may run outside ±180, which
 * is the point: the ring becomes a simple planar curve.
 */
export function unwrapRing(ring: Ring): Float64Array {
  const out = new Float64Array(ring.length * 2);
  if (ring.length === 0) return out;
  let offset = 0;
  out[0] = ring[0][0];
  out[1] = ring[0][1];
  for (let i = 1; i < ring.length; i++) {
    const delta = ring[i][0] - ring[i - 1][0];
    if (delta > 180) offset -= 360;
    else if (delta < -180) offset += 360;
    out[i * 2] = ring[i][0] + offset;
    out[i * 2 + 1] = ring[i][1];
  }
  return out;
}

/**
 * Which pole an unwrapped ring encircles, if any.
 *
 * A ring that wraps the planet once covers a full 360° of longitude end to end;
 * an ordinary ring comes back to where it started. The pole it encloses is
 * whichever it sits nearer — a coastline circling the south pole has every
 * vertex in the southern hemisphere.
 */
export function poleWinding(points: Float64Array): -1 | 0 | 1 {
  const count = points.length / 2;
  if (count < 3) return 0;
  const span = points[(count - 1) * 2] - points[0];
  if (Math.abs(Math.abs(span) - 360) > 1) return 0;
  let latSum = 0;
  for (let i = 0; i < count; i++) latSum += points[i * 2 + 1];
  return latSum >= 0 ? 1 : -1;
}

/**
 * Carry a pole-winding ring down to the pole, so filling it covers the cap.
 *
 * Two vertices: straight down to the pole at the ring's finishing longitude, and
 * back along the pole to its starting one. Closing the ring is then the caller's
 * implicit final edge, as for any other polygon.
 *
 * For fills only. Stroking these edges would draw a line down one meridian and
 * along the pole, which is not a coastline.
 */
export function closeAtPole(points: Float64Array, pole: -1 | 1): Float64Array {
  const lat = pole * 90;
  const count = points.length / 2;
  const out = new Float64Array(points.length + 4);
  out.set(points, 0);
  out[count * 2] = points[(count - 1) * 2];
  out[count * 2 + 1] = lat;
  out[count * 2 + 2] = points[0];
  out[count * 2 + 3] = lat;
  return out;
}

/**
 * Split every edge until none spans more than `maxDeg` in either axis.
 *
 * Midpoints are taken in lng/lat, not on the sphere: the whole pipeline treats
 * an edge as straight in this space (see this file's header), and a great-circle
 * midpoint would quietly bend `McMurdo`'s parallel back into the shape the bug
 * came from.
 *
 * Splits are powers of two of the original edge so that two rings sharing a
 * vertex keep sharing it.
 */
export function densifyRing(
  points: Float64Array,
  maxDeg: number = MAX_EDGE_DEG,
): Float64Array {
  const count = points.length / 2;
  if (count < 2) return points;

  // Sized first, so the result is one allocation rather than a growing array.
  let total = 1;
  const splits = new Uint32Array(count - 1);
  for (let i = 0; i < count - 1; i++) {
    const dLng = Math.abs(points[(i + 1) * 2] - points[i * 2]);
    const dLat = Math.abs(points[(i + 1) * 2 + 1] - points[i * 2 + 1]);
    const pieces = Math.max(1, Math.ceil(Math.max(dLng, dLat) / maxDeg));
    splits[i] = pieces;
    total += pieces;
  }
  if (total === count) return points;

  const out = new Float64Array(total * 2);
  out[0] = points[0];
  out[1] = points[1];
  let w = 1;
  for (let i = 0; i < count - 1; i++) {
    const lng0 = points[i * 2];
    const lat0 = points[i * 2 + 1];
    const lng1 = points[(i + 1) * 2];
    const lat1 = points[(i + 1) * 2 + 1];
    const pieces = splits[i];
    for (let step = 1; step <= pieces; step++) {
      const t = step / pieces;
      out[w * 2] = lng0 + (lng1 - lng0) * t;
      out[w * 2 + 1] = lat0 + (lat1 - lat0) * t;
      w++;
    }
  }
  return out;
}

/** Longitude bounds of an unwrapped ring. */
function lngBounds(points: Float64Array): { lngMin: number; lngMax: number } {
  let lngMin = Infinity;
  let lngMax = -Infinity;
  for (let i = 0; i < points.length; i += 2) {
    if (points[i] < lngMin) lngMin = points[i];
    if (points[i] > lngMax) lngMax = points[i];
  }
  return { lngMin, lngMax };
}

/**
 * Drop a ring's duplicated closing vertex, if it has one.
 *
 * GeoJSON repeats the first point last. `earcut` and the crossing test both
 * close rings themselves, and the repeat shows up as a zero-length edge.
 */
function dropClosingPoint(points: Float64Array): Float64Array {
  const count = points.length / 2;
  if (count < 2) return points;
  const sameLng = Math.abs(points[(count - 1) * 2] - points[0]) < EPS;
  const sameLat = Math.abs(points[(count - 1) * 2 + 1] - points[1]) < EPS;
  return sameLng && sameLat ? points.subarray(0, (count - 1) * 2) : points;
}

function prepareRing(ring: Ring, maxDeg: number): PreparedRing {
  const points = dropClosingPoint(densifyRing(unwrapRing(ring), maxDeg));
  return { points, ...lngBounds(points) };
}

/**
 * Shift a hole by whole turns so it sits inside its outer ring's window.
 *
 * Each ring is unwrapped on its own, which can leave the two in different 360°
 * windows: Afro-Eurasia crosses the antimeridian, so unwrapping puts its
 * coastline at −378…−170, while its one hole — the Caspian, around +50° —
 * unwraps to itself and lands a full turn away. A triangulator handed that pair
 * sees a hole outside the polygon, bridges to it across the whole landmass, and
 * returns a mesh with a band missing and the Mediterranean filled in.
 */
function alignHoleTo(outer: PreparedRing, hole: PreparedRing): PreparedRing {
  const outerCentre = (outer.lngMin + outer.lngMax) / 2;
  const holeCentre = (hole.lngMin + hole.lngMax) / 2;
  const turns = Math.round((outerCentre - holeCentre) / 360);
  if (turns === 0) return hole;
  const shift = turns * 360;
  const points = new Float64Array(hole.points.length);
  for (let i = 0; i < hole.points.length; i += 2) {
    points[i] = hole.points[i] + shift;
    points[i + 1] = hole.points[i + 1];
  }
  return { points, lngMin: hole.lngMin + shift, lngMax: hole.lngMax + shift };
}

/**
 * Turn GeoJSON polygon rings into something a renderer can fill and hit-test.
 *
 * `windsPole` is reported rather than applied: a fill wants the pole closure, an
 * outline does not, and both read the same prepared polygon.
 */
export function preparePolygon(
  rings: PolygonRings,
  maxDeg: number = MAX_EDGE_DEG,
): PreparedPolygon {
  const outerRaw = unwrapRing(rings[0] ?? []);
  const windsPole = poleWinding(outerRaw);
  const outer = prepareRing(rings[0] ?? [], maxDeg);
  return {
    outer,
    holes: rings
      .slice(1)
      .map((hole) => alignHoleTo(outer, prepareRing(hole, maxDeg))),
    windsPole,
  };
}

/**
 * The polygon's outer ring as a fill wants it: pole-closed where that applies.
 *
 * The closure is added after densification, deliberately. Those two edges are a
 * meridian and a run along the pole, where every longitude is the same point, so
 * splitting them adds vertices that buy nothing.
 */
export function fillRing(polygon: PreparedPolygon): Float64Array {
  if (polygon.windsPole === 0) return polygon.outer.points;
  return closeAtPole(polygon.outer.points, polygon.windsPole);
}

/**
 * Shift a query longitude into the window the ring occupies.
 *
 * An unwrapped ring can live anywhere on the number line — Eurasia at −17…190,
 * a McMurdo ring beyond ±180 — while a query point arrives in ±180. Without
 * this a point in eastern Siberia is compared against a ring sitting 360° away
 * and always reads as outside.
 */
function alignLng(lng: number, lngMin: number, lngMax: number): number {
  let value = lng;
  while (value < lngMin - 180) value += 360;
  while (value > lngMax + 180) value -= 360;
  return value;
}

/**
 * Crossing-number test against one ring, treating edges as straight in lng/lat.
 *
 * The half-open rule on latitude (`>` on one end, `<=` on the other) is what
 * keeps a point level with a shared vertex from counting twice.
 */
export function pointInRing(
  ring: PreparedRing,
  lng: number,
  lat: number,
): boolean {
  const points = ring.points;
  const count = points.length / 2;
  if (count < 3) return false;
  const x = alignLng(lng, ring.lngMin, ring.lngMax);
  if (x < ring.lngMin || x > ring.lngMax) return false;

  let inside = false;
  for (let i = 0, j = count - 1; i < count; j = i++) {
    const xi = points[i * 2];
    const yi = points[i * 2 + 1];
    const xj = points[j * 2];
    const yj = points[j * 2 + 1];
    if (yi > lat !== yj > lat) {
      const t = (lat - yi) / (yj - yi);
      if (x < xi + t * (xj - xi)) inside = !inside;
    }
  }
  return inside;
}

/** Inside the outer ring and outside every hole. */
export function pointInPolygon(
  polygon: PreparedPolygon,
  lng: number,
  lat: number,
): boolean {
  const outer: PreparedRing =
    polygon.windsPole === 0
      ? polygon.outer
      : /* The cap belongs to the region, so the pole-closed ring is the one to
           test — otherwise a point at −88° sits in the gap the winding leaves. */
        (() => {
          const points = closeAtPole(polygon.outer.points, polygon.windsPole);
          return { points, ...lngBounds(points) };
        })();
  if (!pointInRing(outer, lng, lat)) return false;
  for (const hole of polygon.holes) {
    if (pointInRing(hole, lng, lat)) return false;
  }
  return true;
}

/**
 * The edges to stroke, as flat `[lng0, lat0, lng1, lat1, …]` segment pairs.
 *
 * Two kinds of edge are dropped, because both are artefacts of storing a round
 * planet in a rectangle rather than anything on the ground:
 *
 * - edges lying along the antimeridian, where a dataset cut a country in two;
 * - edges lying along a pole, where every longitude is the same point.
 *
 * Without this, Fiji and the Chukotka zones show a bright vertical line down the
 * 180th meridian, and a pole-closed Antarctica gets a line drawn across the ice.
 */
export function outlineSegments(polygon: PreparedPolygon): Float64Array {
  const rings = [polygon.outer, ...polygon.holes];
  const segments: number[] = [];
  for (const ring of rings) {
    const points = ring.points;
    const count = points.length / 2;
    if (count < 2) continue;
    for (let i = 0, j = count - 1; i < count; j = i++) {
      const lngA = points[j * 2];
      const latA = points[j * 2 + 1];
      const lngB = points[i * 2];
      const latB = points[i * 2 + 1];
      if (isSeamEdge(lngA, latA, lngB, latB)) continue;
      segments.push(lngA, latA, lngB, latB);
    }
  }
  return new Float64Array(segments);
}

/** An edge that exists only because the data is stored in a rectangle. */
function isSeamEdge(
  lngA: number,
  latA: number,
  lngB: number,
  latB: number,
): boolean {
  // Along a pole.
  if (Math.abs(Math.abs(latA) - 90) < EPS && Math.abs(latA - latB) < EPS) {
    return true;
  }
  // Along the antimeridian — compared in the wrapped frame, since an unwrapped
  // ring puts the same meridian at 180, −180, 540 and so on.
  const wrapA = Math.abs(((((lngA + 180) % 360) + 360) % 360) - 180);
  const wrapB = Math.abs(((((lngB + 180) % 360) + 360) % 360) - 180);
  return (
    Math.abs(wrapA - 180) < 1e-6 &&
    Math.abs(wrapB - 180) < 1e-6 &&
    Math.abs(latA - latB) > EPS
  );
}

/**
 * A great-circle path between two points, as a densified lng/lat polyline.
 *
 * Used by route arcs. Spherical interpolation here, not linear: an arc is
 * *defined* as the great circle, unlike the region boundaries above, whose
 * straight-in-lng/lat reading is what their datasets mean.
 */
export function greatCirclePoints(
  from: LngLat,
  to: LngLat,
  maxDeg: number = MAX_EDGE_DEG,
): Float64Array {
  const rad = Math.PI / 180;
  const [lng0, lat0] = from;
  const [lng1, lat1] = to;
  const phi0 = lat0 * rad;
  const phi1 = lat1 * rad;
  const lambda0 = lng0 * rad;
  const lambda1 = lng1 * rad;
  const cosPhi0 = Math.cos(phi0);
  const cosPhi1 = Math.cos(phi1);
  const a: [number, number, number] = [
    cosPhi0 * Math.cos(lambda0),
    cosPhi0 * Math.sin(lambda0),
    Math.sin(phi0),
  ];
  const b: [number, number, number] = [
    cosPhi1 * Math.cos(lambda1),
    cosPhi1 * Math.sin(lambda1),
    Math.sin(phi1),
  ];
  const dot = Math.min(
    1,
    Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]),
  );
  const angle = Math.acos(dot);
  const steps = Math.max(1, Math.ceil(angle / rad / maxDeg));
  const out = new Float64Array((steps + 1) * 2);
  const sinAngle = Math.sin(angle);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    let x: number;
    let y: number;
    let z: number;
    if (sinAngle < 1e-12) {
      // Coincident or antipodal: nothing to interpolate along.
      x = a[0] + (b[0] - a[0]) * t;
      y = a[1] + (b[1] - a[1]) * t;
      z = a[2] + (b[2] - a[2]) * t;
    } else {
      const wa = Math.sin((1 - t) * angle) / sinAngle;
      const wb = Math.sin(t * angle) / sinAngle;
      x = a[0] * wa + b[0] * wb;
      y = a[1] * wa + b[1] * wb;
      z = a[2] * wa + b[2] * wb;
    }
    out[i * 2] = Math.atan2(y, x) / rad;
    out[i * 2 + 1] = Math.asin(Math.min(1, Math.max(-1, z))) / rad;
  }
  // The arc may cross the seam; callers stroke it, so keep it continuous.
  return unwrapFlat(out);
}

/** `unwrapRing` for an already-flat array. */
export function unwrapFlat(points: Float64Array): Float64Array {
  const count = points.length / 2;
  if (count < 2) return points;
  const out = new Float64Array(points.length);
  out[0] = points[0];
  out[1] = points[1];
  let offset = 0;
  for (let i = 1; i < count; i++) {
    const delta = points[i * 2] - points[(i - 1) * 2];
    if (delta > 180) offset -= 360;
    else if (delta < -180) offset += 360;
    out[i * 2] = points[i * 2] + offset;
    out[i * 2 + 1] = points[i * 2 + 1];
  }
  return out;
}
