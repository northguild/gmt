/**
 * Turning prepared polygons into triangle meshes the GPU can fill (#289).
 *
 * Pure, no DOM. Two steps:
 *
 * 1. **`earcut`** on the unwrapped lng/lat ring, holes included. Ear clipping is
 *    a planar algorithm, which is exactly right here: RFC 7946 §3.1.1 defines a
 *    GeoJSON edge as a straight line in the coordinate reference system, so
 *    lng/lat *is* the plane the polygon lives in. `geometry.ts` has already
 *    removed the antimeridian jumps that would otherwise make a ring
 *    self-intersecting.
 *
 * 2. **Conforming refinement** of the interior, for one specific reason.
 *
 * ## What interior refinement is and is not for
 *
 * It does *not* control the drawn silhouette. Adjacent triangles share an edge,
 * and that edge's two endpoints project to the same two screen points for both,
 * so every interior edge cancels in the union: the filled screen region is
 * bounded purely by the projected boundary ring, whose accuracy comes from
 * `densifyRing` in `geometry.ts`. A huge interior triangle is invisible, because
 * the fill is a flat colour and the shading underneath it comes from the surface
 * shader.
 *
 * What it does control is the **limb fold**. A triangle straddling the horizon has
 * part of itself on the far hemisphere, which projects back over the near one, so
 * the flat screen triangle covers a region the sphere folds in two. No per-fragment
 * depth trick fixes that — the magnitude of the true depth is known exactly from a
 * fragment's distance from the centre, but its *sign* changes inside the triangle,
 * and one flat triangle cannot carry both. The fold has to be made small by
 * splitting.
 *
 * So the limit is **angular**, not planar, and set by how wide a band at the limb
 * may be wrong: a 5° edge folds over about 1.3px at the largest radius this site
 * reaches (a hero stage at zoom 5 on a 2× display). Measured against the
 * alternatives, an angular 5° limit produces 73k triangles for the land mesh where
 * a planar 2.5° one produced 556k — 7.6 times the geometry, and 3 times the build
 * time, for an invisible difference.
 *
 * ## Why refinement has to be conforming
 *
 * The obvious fix — split each triangle whose own longest edge is too long —
 * leaves T-junctions: a neighbour that did not need splitting keeps one long edge
 * against the new vertex, and the crack between them shows as a hairline gap.
 *
 * So edges are marked globally, by a key built from the two vertex indices, and
 * every triangle then splits according to *which of its edges are marked*, in the
 * standard red–green patterns (one marked edge gives 2 triangles, two give 3,
 * three give 4). Two triangles sharing an edge therefore always agree on whether
 * it is split and on the midpoint vertex it splits at, because that midpoint is
 * memoised against the same key. The result is watertight by construction rather
 * than by tolerance.
 */

import earcut from "earcut";
import { fillRing, type PreparedPolygon } from "./geometry";

/**
 * A triangle mesh in lng/lat.
 *
 * The buffer parameters are spelled out because these arrays go straight to
 * `GPUQueue.writeBuffer`, whose `BufferSource` excludes a `SharedArrayBuffer`
 * backing. A bare `Float32Array` is `Float32Array<ArrayBufferLike>`, which
 * admits one; saying `ArrayBuffer` states what is actually true here and saves a
 * cast at every upload.
 */
export interface Mesh {
  /** Interleaved `[lng, lat, …]`. */
  vertices: Float32Array<ArrayBuffer>;
  indices: Uint32Array<ArrayBuffer>;
}

/**
 * Longest interior edge, as an angle on the sphere in degrees.
 *
 * Sized by the limb fold this leaves: about 1.3px at a 1400px radius, which is
 * the largest this site reaches. See the note on interior refinement above for
 * why this is the only thing the limit controls.
 */
export const MAX_INTERIOR_ANGLE_DEG = 5;

/** Refinement stops here regardless; each pass at least halves every long edge. */
const MAX_REFINE_PASSES = 12;

const DEG = Math.PI / 180;

/**
 * Triangulate one prepared polygon.
 *
 * A pole-winding outer ring is taken pole-closed (see `fillRing`), so filling
 * Antarctica covers the cap its coastline circles but never reaches.
 */
export function triangulatePolygon(
  polygon: PreparedPolygon,
  maxAngleDeg: number = MAX_INTERIOR_ANGLE_DEG,
): Mesh {
  const outer = fillRing(polygon);
  const coordinates: number[] = Array.from(outer);
  const holeIndices: number[] = [];
  for (const hole of polygon.holes) {
    if (hole.points.length < 6) continue; // fewer than 3 points is not a hole
    holeIndices.push(coordinates.length / 2);
    for (const value of hole.points) coordinates.push(value);
  }

  const indices = earcut(
    coordinates,
    holeIndices.length ? holeIndices : undefined,
    2,
  );
  return refine(coordinates, indices, maxAngleDeg);
}

/** Triangulate several polygons into one mesh, so a layer is a single draw. */
export function triangulatePolygons(
  polygons: readonly PreparedPolygon[],
  maxAngleDeg: number = MAX_INTERIOR_ANGLE_DEG,
): Mesh {
  const meshes = polygons.map((polygon) =>
    triangulatePolygon(polygon, maxAngleDeg),
  );
  let vertexCount = 0;
  let indexCount = 0;
  for (const mesh of meshes) {
    vertexCount += mesh.vertices.length;
    indexCount += mesh.indices.length;
  }
  const vertices = new Float32Array(vertexCount);
  const indices = new Uint32Array(indexCount);
  let vertexAt = 0;
  let indexAt = 0;
  for (const mesh of meshes) {
    const offset = vertexAt / 2;
    vertices.set(mesh.vertices, vertexAt);
    vertexAt += mesh.vertices.length;
    for (let i = 0; i < mesh.indices.length; i++) {
      indices[indexAt + i] = mesh.indices[i] + offset;
    }
    indexAt += mesh.indices.length;
  }
  return { vertices, indices };
}

/**
 * Split triangles until no edge is longer than `maxEdgeDeg`, without leaving
 * T-junctions. See this file's header for why the marking is global.
 */
function refine(
  coordinates: number[],
  startIndices: readonly number[],
  maxAngleDeg: number,
): Mesh {
  const vertices = coordinates.slice();
  let triangles = Array.from(startIndices);

  /* Unit vectors kept alongside the coordinates, so the edge-length test is a
     dot product. Comparing against `cos(limit)` rather than taking `acos` per
     edge per pass matters: that inverse cosine was the single largest cost in
     building the land mesh. */
  const units: number[] = [];
  const addUnit = (index: number): void => {
    const lambda = vertices[index * 2] * DEG;
    const phi = vertices[index * 2 + 1] * DEG;
    const cosLat = Math.cos(phi);
    units[index * 3] = cosLat * Math.cos(lambda);
    units[index * 3 + 1] = cosLat * Math.sin(lambda);
    units[index * 3 + 2] = Math.sin(phi);
  };
  for (let i = 0; i < vertices.length / 2; i++) addUnit(i);

  const cosLimit = Math.cos(maxAngleDeg * DEG);

  const edgeKey = (a: number, b: number): number =>
    a < b ? a * 0x8_00_00_00 + b : b * 0x8_00_00_00 + a;

  const tooLong = (a: number, b: number): boolean => {
    const dot =
      units[a * 3] * units[b * 3] +
      units[a * 3 + 1] * units[b * 3 + 1] +
      units[a * 3 + 2] * units[b * 3 + 2];
    return dot < cosLimit;
  };

  for (let pass = 0; pass < MAX_REFINE_PASSES; pass++) {
    // Mark every edge that is too long, across every triangle at once.
    const marked = new Set<number>();
    for (let t = 0; t < triangles.length; t += 3) {
      const a = triangles[t];
      const b = triangles[t + 1];
      const c = triangles[t + 2];
      if (tooLong(a, b)) marked.add(edgeKey(a, b));
      if (tooLong(b, c)) marked.add(edgeKey(b, c));
      if (tooLong(c, a)) marked.add(edgeKey(c, a));
    }
    if (marked.size === 0) break;

    /* One midpoint per marked edge, memoised by the same key both neighbours
       compute — this is what makes the refinement watertight. */
    const midpoints = new Map<number, number>();
    const midpoint = (a: number, b: number): number => {
      const key = edgeKey(a, b);
      const existing = midpoints.get(key);
      if (existing !== undefined) return existing;
      const index = vertices.length / 2;
      vertices.push(
        (vertices[a * 2] + vertices[b * 2]) / 2,
        (vertices[a * 2 + 1] + vertices[b * 2 + 1]) / 2,
      );
      addUnit(index);
      midpoints.set(key, index);
      return index;
    };

    const next: number[] = [];
    for (let t = 0; t < triangles.length; t += 3) {
      let a = triangles[t];
      let b = triangles[t + 1];
      let c = triangles[t + 2];
      let mask =
        (marked.has(edgeKey(a, b)) ? 1 : 0) |
        (marked.has(edgeKey(b, c)) ? 2 : 0) |
        (marked.has(edgeKey(c, a)) ? 4 : 0);

      if (mask === 0) {
        next.push(a, b, c);
        continue;
      }

      if (mask === 7) {
        const mab = midpoint(a, b);
        const mbc = midpoint(b, c);
        const mca = midpoint(c, a);
        next.push(a, mab, mca, mab, b, mbc, mca, mbc, c, mab, mbc, mca);
        continue;
      }

      /* Rotate the triangle until the marked edges sit in a canonical place, so
         there are two patterns to write instead of six. Rotating `(a,b,c)` to
         `(b,c,a)` moves each edge's bit down one position. */
      const rotate = () => {
        const a0 = a;
        a = b;
        b = c;
        c = a0;
        mask = (mask >> 1) | ((mask & 1) << 2);
      };

      if (mask === 1 || mask === 2 || mask === 4) {
        while (mask !== 1) rotate();
        const mab = midpoint(a, b);
        next.push(a, mab, c, mab, b, c);
        continue;
      }

      // Two marked edges: `ab` and `bc` after rotation.
      while (mask !== 3) rotate();
      const mab = midpoint(a, b);
      const mbc = midpoint(b, c);
      next.push(a, mab, mbc, mab, b, mbc, a, mbc, c);
    }
    triangles = next;
  }

  return {
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(triangles),
  };
}
