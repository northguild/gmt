/**
 * The pinhole camera, checked against a model written here from first principles: a camera at
 * `(P, 0, 0)` looking at the origin, and a ray through the pixel intersected with the unit sphere by
 * the quadratic. Nothing below calls `rayHit` to produce an expectation.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createCamera, project, unproject } from "./camera";
import {
  G,
  P,
  RIM,
  focal,
  projectDirection,
  projectPoint,
  rayHit,
  directionAt,
  rotationMatrix,
  toView,
  type Screen,
  type Vec3,
} from "./pinhole";

const CX = 320;
const CY = 240;
const RADIUS = 200;
const LENS = { centreX: CX, centreY: CY, radius: RADIUS };
const DEG = Math.PI / 180;

/** A small seeded generator (mulberry32), so the rows are the same on every run. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * First-principles check of a projected pixel, by vector geometry and not by the projection's
 * formula: the pixel lies in the direction of the point's (right, up) components, and its distance
 * from the centre is `f * tan(angle)` where the angle is between the optical axis (towards the
 * origin) and the line of sight from the camera to the point.
 */
function expectOnLineOfSight(out: Screen, p: Vec3): void {
  const f = RADIUS * Math.sqrt(P * P - 1);
  const sight = [p[0] - P, p[1], p[2]] as Vec3; // camera to point
  const cosAngle = -sight[0] / Math.hypot(...sight); // against the axis (-1, 0, 0)
  const distance = f * Math.tan(Math.acos(cosAngle));
  expect(Math.abs(Math.hypot(out.x - CX, out.y - CY) - distance)).toBeLessThan(
    1e-8,
  );
  // Same side as the point's (right, up) components: the cross product vanishes, the dot is >= 0.
  const dx = out.x - CX;
  const dy = CY - out.y;
  expect(Math.abs(dx * p[2] - dy * p[1])).toBeLessThan(1e-7);
  expect(dx * p[1] + dy * p[2]).toBeGreaterThanOrEqual(-1e-9);
}

/** First-principles hit: ray from (P,0,0) through the pixel, smaller root of |C + s d|^2 = 1. */
function referenceHit(u: number, v: number): Vec3 | null {
  const f = Math.sqrt(P * P - 1); // in silhouette radii
  const d: Vec3 = [-f, u, v]; // towards the origin, screen right, screen up
  const a = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
  const b = 2 * P * d[0];
  const c = P * P - 1;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const s = (-b - Math.sqrt(disc)) / (2 * a);
  return [P + s * d[0], s * d[1], s * d[2]];
}

function randomUnit(random: () => number): Vec3 {
  const z = random() * 2 - 1;
  const phi = random() * 2 * Math.PI;
  const r = Math.sqrt(1 - z * z);
  return [r * Math.cos(phi), r * Math.sin(phi), z];
}

describe("constants", () => {
  it("is the geostationary camera", () => {
    expect(P).toBeCloseTo(6.610729, 6);
    expect(G).toBeCloseTo(6.534657, 6);
    expect(RIM).toBeCloseTo(1 / P, 12);
    expect(focal(RADIUS)).toBeCloseTo(RADIUS * G, 9);
  });
});

describe("projectPoint", () => {
  it("puts the centre of the sphere at the lens centre", () => {
    const out: Screen = { x: 0, y: 0 };
    expect(projectPoint(LENS, [1, 0, 0], out)).toBe(true);
    expect(out.x).toBe(CX);
    expect(out.y).toBe(CY);
  });

  it("draws the silhouette at exactly the radius", () => {
    const out: Screen = { x: 0, y: 0 };
    const s = Math.sqrt(1 - RIM * RIM);
    for (let i = 0; i < 360; i++) {
      const a = i * DEG;
      projectPoint(LENS, [RIM, s * Math.cos(a), s * Math.sin(a)], out);
      expect(Math.hypot(out.x - CX, out.y - CY)).toBeCloseTo(RADIUS, 7);
    }
  });

  it("switches visibility at the cap edge", () => {
    const out: Screen = { x: 0, y: 0 };
    const edge = Math.acos(RIM);
    const at = (angle: number): Vec3 => [Math.cos(angle), Math.sin(angle), 0];
    expect(projectPoint(LENS, at(edge - 0.01 * DEG), out)).toBe(true);
    expect(projectPoint(LENS, at(edge + 0.01 * DEG), out)).toBe(false);
  });

  it("matches the first-principles camera on the visible cap", () => {
    const random = seeded(1);
    const out: Screen = { x: 0, y: 0 };
    let checked = 0;
    while (checked < 500) {
      const p = randomUnit(random);
      if (p[0] <= RIM) continue;
      projectPoint(LENS, p, out);
      expectOnLineOfSight(out, p);
      /* And the ray back through the pixel, intersected with the sphere by the quadratic, is p. */
      const back = referenceHit((out.x - CX) / RADIUS, (CY - out.y) / RADIUS)!;
      for (let i = 0; i < 3; i++) {
        expect(Math.abs(back[i]! - p[i]!)).toBeLessThan(1e-9);
      }
      checked += 1;
    }
  });

  it("writes into the array it was given and returns it from toView", () => {
    const v: Vec3 = [0, 0, 0];
    expect(toView(createCamera([0, 0]), 0, 0, v)).toBe(v);
    expect(v).toEqual([1, 0, 0]);
  });
});

describe("rotationMatrix", () => {
  it("is toView, as one matrix, for 200 seeded rotations and points", () => {
    const random = seeded(5);
    for (let i = 0; i < 200; i++) {
      const lambda = random() * 720 - 360;
      const phi = random() * 180 - 90;
      const lng = random() * 360 - 180;
      const lat = random() * 180 - 90;
      const expected = toView(
        {
          cosLambda: Math.cos(lambda * DEG),
          sinLambda: Math.sin(lambda * DEG),
          cosPhi: Math.cos(phi * DEG),
          sinPhi: Math.sin(phi * DEG),
        },
        lng,
        lat,
        [0, 0, 0],
      );
      const m = rotationMatrix(lambda, phi);
      const unit = [
        Math.cos(lat * DEG) * Math.cos(lng * DEG),
        Math.cos(lat * DEG) * Math.sin(lng * DEG),
        Math.sin(lat * DEG),
      ];
      for (let k = 0; k < 3; k++)
        expect(
          Math.abs(
            m[k * 3]! * unit[0]! +
              m[k * 3 + 1]! * unit[1]! +
              m[k * 3 + 2]! * unit[2]! -
              expected[k]!,
          ),
        ).toBeLessThan(1e-12);
    }
  });
});

describe("rayHit", () => {
  it("matches the quadratic for 500 pixels in the disc", () => {
    const random = seeded(2);
    const out: Vec3 = [0, 0, 0];
    let checked = 0;
    while (checked < 500) {
      const u = random() * 2 - 1;
      const v = random() * 2 - 1;
      if (u * u + v * v > 1) continue;
      expect(rayHit(u, v, out)).toBe(true);
      const expected = referenceHit(u, v)!;
      for (let i = 0; i < 3; i++) {
        expect(Math.abs(out[i]! - expected[i]!)).toBeLessThan(1e-12);
      }
      checked += 1;
    }
  });

  it("lands on the silhouette at the rim and misses outside it", () => {
    const out: Vec3 = [0, 0, 0];
    expect(rayHit(1, 0, out)).toBe(true);
    expect(Math.abs(out[0] - RIM)).toBeLessThan(1e-12);
    expect(rayHit(Math.sqrt(1 + 1e-9), 0, out)).toBe(false);
  });
});

describe("projectDirection", () => {
  it("puts the point straight behind the Earth at the centre", () => {
    const out: Screen = { x: 0, y: 0 };
    expect(projectDirection(LENS, [-1, 0, 0], out)).toBe(true);
    expect(out.x).toBe(CX);
    expect(out.y).toBe(CY);
  });

  it("refuses a direction that is not in front of the camera, leaving out alone", () => {
    const out: Screen = { x: 7, y: 9 };
    expect(projectDirection(LENS, [1, 0, 0], out)).toBe(false);
    expect(projectDirection(LENS, [0, 1, 0], out)).toBe(false);
    expect(out).toEqual({ x: 7, y: 9 });
  });

  it("agrees with a far point in the same direction", () => {
    const random = seeded(3);
    const a: Screen = { x: 0, y: 0 };
    const b: Screen = { x: 0, y: 0 };
    for (let i = 0; i < 50; i++) {
      const d = randomUnit(random);
      d[0] = -Math.abs(d[0]) - 0.5;
      const n = Math.hypot(...d);
      const unit: Vec3 = [d[0] / n, d[1] / n, d[2] / n];
      expect(projectDirection(LENS, unit, a)).toBe(true);
      projectPoint(LENS, [unit[0] * 1e9, unit[1] * 1e9, unit[2] * 1e9], b);
      expect(Math.abs(a.x - b.x)).toBeLessThan(1e-3);
      expect(Math.abs(a.y - b.y)).toBeLessThan(1e-3);
    }
  });
});

describe("directionAt", () => {
  it("is the direction projectDirection draws at that pixel, at zoom 1 and 5", () => {
    const random = seeded(5);
    const d: Vec3 = [0, 0, 0];
    const out: Screen = { x: 0, y: 0 };
    for (const radius of [RADIUS, RADIUS * 5]) {
      const lens = { ...LENS, radius };
      for (let i = 0; i < 50; i++) {
        const x = random() * 2 * CX;
        const y = random() * 2 * CY;
        directionAt(lens, x, y, d);
        expect(d[0]).toBeLessThan(0);
        expect(projectDirection(lens, d, out)).toBe(true);
        expect(Math.abs(out.x - x)).toBeLessThan(1e-9);
        expect(Math.abs(out.y - y)).toBeLessThan(1e-9);
      }
    }
  });

  it("points straight away from the camera at the Earth's centre", () => {
    const d: Vec3 = [0, 0, 0];
    directionAt(LENS, CX, CY, d);
    expect(d).toEqual([-focal(RADIUS), 0, 0]);
  });
});

describe("camera round trip", () => {
  it("unproject(project(p)) is p at zoom 1 and 5, over several rotations", () => {
    const random = seeded(4);
    for (const zoom of [1, 5]) {
      for (const rotation of [
        [0, 0],
        [-139.69, -35.68],
        [73.99, -40.73],
        [-45, 60],
      ] as [number, number][]) {
        const camera = createCamera(rotation);
        camera.radius = RADIUS * zoom;
        camera.centreX = CX;
        camera.centreY = CY;
        let checked = 0;
        while (checked < 125) {
          const lng = random() * 360 - 180;
          const lat = Math.asin(random() * 1.8 - 0.9) / DEG;
          const at = project(camera, lng, lat);
          if (!at.visible) continue;
          const back = unproject(camera, at.x, at.y)!;
          expect(back).not.toBeNull();
          const dLng = ((back[0] - lng + 540) % 360) - 180;
          expect(Math.abs(dLng * Math.cos(lat * DEG))).toBeLessThan(1e-9);
          expect(Math.abs(back[1] - lat)).toBeLessThan(1e-9);
          checked += 1;
        }
      }
    }
  });
});

/* The camera's constants and the sphere-ray root, in every spelling a copy could take. */
const BANNED =
  /\b6\.61\d|35786|6378\.137|sqrt\(\s*P\s*\*\s*P\s*-\s*1\s*\)|sqrt\(\s*1(\.0)?\s*-\s*(dot\(|squared|[a-z]\w*\s*(\*|\*\*))/;

describe("one owner", () => {
  it.each([
    "const P = 6.6107;",
    "const alt = 35786;",
    "const re = 6378.137;",
    "Math.sqrt(P * P - 1)",
    "Math.sqrt(P*P-1)",
    "sqrt( P * P - 1 )",
    "Math.sqrt(1 - squared)",
    "Math.sqrt(1 - u ** 2)",
    "Math.sqrt(1 - u * u)",
    "sqrt(1.0 - dot(uv, uv))",
  ])("the scan catches %s", (form) => {
    expect(BANNED.test(form)).toBe(true);
  });

  it("does not trip on the interpolated shader constants", () => {
    expect(BANNED.test("const PINHOLE_P = `${P}`;")).toBe(false);
  });

  it("keeps the camera constants in pinhole.ts alone", () => {
    const lib = dirname(dirname(fileURLToPath(import.meta.url)));
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(ts|tsx|mjs)$/.test(name)) scan(path);
      }
    };
    const scan = (path: string) => {
      const rel = relative(lib, path);
      if (rel === join("globe", "pinhole.ts") || rel.endsWith(".test.ts"))
        return;
      const text = readFileSync(path, "utf8");
      if (BANNED.test(text)) hits.push(rel);
    };
    walk(lib);
    expect(hits).toEqual([]);
  });
});
