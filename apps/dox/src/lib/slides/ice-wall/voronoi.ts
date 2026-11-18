/**
 * Ice-break cells: a Voronoi diagram of the unit rectangle, pure and seeded.
 *
 * `cells(seed, count)` returns `count` convex polygons that tile `[0, 1] x [0, 1]`. Each is the
 * unit rectangle clipped by one half-plane per other site (n squared for n = 24: no dependency).
 * The sites come from a seeded generator and crowd the middle of the rectangle, where a break
 * lands: the shards there are small and the ones at the edge large, as ice breaks.
 */

export type Point = readonly [x: number, y: number];

export interface Cell {
  /** The site the cell was grown from; it lies inside the polygon. */
  site: Point;
  /** The polygon's corners, counter-clockwise (in a y-up frame). */
  poly: readonly Point[];
  /** Its area as a fraction of the unit rectangle. */
  area: number;
  /** The polygon's centre of mass. */
  centroid: Point;
}

/** A 32-bit string hash (FNV-1a) so a pane's id can seed its break. */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: a small seeded generator returning `[0, 1)`. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MIN_SITE_GAP = 0.025;
/** Pulls the radius of a site towards the middle: `u ** CROWD` with `u` uniform. */
const CROWD = 1.7;

/** Sites crowded towards the centre, none closer than `MIN_SITE_GAP`. */
function sites(random: () => number, count: number): Point[] {
  const out: Point[] = [];
  let guard = 0;
  while (out.length < count) {
    guard += 1;
    const radius = random() ** CROWD * 0.5;
    const angle = random() * Math.PI * 2;
    const x = 0.5 + radius * Math.cos(angle) * 2 * 0.98;
    const y = 0.5 + radius * Math.sin(angle) * 2 * 0.98;
    const inside = x > 0.01 && x < 0.99 && y > 0.01 && y < 0.99;
    // After many misses the gap is relaxed, so a big `count` still ends.
    const gap = guard > 5000 ? MIN_SITE_GAP / 4 : MIN_SITE_GAP;
    if (inside && out.every((s) => Math.hypot(s[0] - x, s[1] - y) >= gap))
      out.push([x, y]);
  }
  return out;
}

/** Keeps the part of a polygon on the `p . n <= c` side of a line (Sutherland-Hodgman). */
function clip(
  poly: readonly Point[],
  nx: number,
  ny: number,
  c: number,
): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const da = a[0] * nx + a[1] * ny - c;
    const db = b[0] * nx + b[1] * ny - c;
    if (da <= 0) out.push(a);
    if (da < 0 !== db < 0 && da !== db) {
      const u = da / (da - db);
      out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]);
    }
  }
  return out;
}

/** Area and centre of mass of a simple polygon (the shoelace formula). */
function measure(poly: readonly Point[]): { area: number; centroid: Point } {
  let twice = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const cross = a[0] * b[1] - b[0] * a[1];
    twice += cross;
    cx += (a[0] + b[0]) * cross;
    cy += (a[1] + b[1]) * cross;
  }
  if (Math.abs(twice) < 1e-15) return { area: 0, centroid: poly[0] ?? [0, 0] };
  return { area: twice / 2, centroid: [cx / (3 * twice), cy / (3 * twice)] };
}

/** The `count` cells of a seeded break. The same seed and count always give the same cells. */
export function cells(seed: number, count: number): Cell[] {
  const points = sites(mulberry32(seed), count);
  const square: Point[] = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ];
  return points.map((site, i) => {
    let poly = square;
    for (let j = 0; j < points.length; j += 1) {
      if (j === i) continue;
      const other = points[j]!;
      const nx = other[0] - site[0];
      const ny = other[1] - site[1];
      const mid = [(site[0] + other[0]) / 2, (site[1] + other[1]) / 2];
      poly = clip(poly, nx, ny, mid[0]! * nx + mid[1]! * ny);
    }
    const { area, centroid } = measure(poly);
    return { site, poly, area, centroid };
  });
}
