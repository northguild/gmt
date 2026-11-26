/**
 * The camera is a pinhole at geostationary distance (`pinhole.ts`). The oracle here is vector
 * geometry for a camera at `(P, 0, 0)`: a pixel's distance from the centre is `f * tan(angle)`
 * between the optical axis and the line of sight. The ray-sphere quadratic lives in
 * `pinhole.test.ts`, which pins the pinhole itself; these rows pin how the camera uses it.
 */

import {
  clampLat,
  createCamera,
  isVisible,
  project,
  rotatePoint,
  shortestAngle,
  sunDirection,
  syncCamera,
  unproject,
  wrapLng,
} from "./camera";
import { P, RIM } from "./pinhole";

const WIDTH = 640;
const HEIGHT = 480;
const RADIUS = 200;

function pair(rotation: [number, number]) {
  const camera = createCamera(rotation);
  camera.radius = RADIUS;
  camera.centreX = WIDTH / 2;
  camera.centreY = HEIGHT / 2;
  return { camera };
}

const ROTATIONS: [number, number][] = [
  [0, 0],
  [-10, -15],
  [-139.69, -35.68], // Tokyo centred
  [73.99, -40.73], // the other sign, New York's antipode side
  [180, 0],
  [-45, 80], // near the pole
  [120, -60],
];

const POINTS: [number, number][] = [
  [0, 0],
  [139.69, 35.68], // Tokyo
  [-73.99, 40.73], // New York
  [0, 90], // north pole
  [0, -90], // south pole
  [179.9, -0.1],
  [-179.9, 0.1],
  [18.42, -33.92], // Cape Town
  [-58.38, -34.6], // Buenos Aires
  [90, 0],
  [-90, 45],
];

describe("project", () => {
  it("agrees with the pinhole on both hemispheres", () => {
    for (const rotation of ROTATIONS) {
      const { camera } = pair(rotation);
      for (const [lng, lat] of POINTS) {
        const v = rotatePoint(camera, lng, lat, [0, 0, 0]);
        const at = project(camera, lng, lat);
        const f = RADIUS * Math.sqrt(P * P - 1);
        const sight = [v[0] - P, v[1], v[2]]; // camera to point
        const angle = Math.acos(-sight[0]! / Math.hypot(...sight));
        const dx = at.x - WIDTH / 2;
        const dy = HEIGHT / 2 - at.y;
        const label = `${rotation} / ${lng},${lat}`;
        expect(Math.hypot(dx, dy), label).toBeCloseTo(f * Math.tan(angle), 7);
        expect(dx * v[2]! - dy * v[1]!, label).toBeCloseTo(0, 6);
        expect(dx * v[1]! + dy * v[2]!, label).toBeGreaterThanOrEqual(-1e-9);
        expect(at.visible).toBe(v[0] > RIM);
      }
    }
  });

  it("puts the centred zone exactly at the sphere's centre", () => {
    for (const [lng, lat] of POINTS) {
      const { camera } = pair([-lng, -lat]);
      const at = project(camera, lng, lat);
      expect(at.x).toBeCloseTo(WIDTH / 2, 9);
      expect(at.y).toBeCloseTo(HEIGHT / 2, 9);
      expect(at.visible).toBe(true);
    }
  });

  it("keeps every projected point inside the sphere's circle", () => {
    for (const rotation of ROTATIONS) {
      const { camera } = pair(rotation);
      for (const [lng, lat] of POINTS) {
        const at = project(camera, lng, lat);
        const distance = Math.hypot(at.x - WIDTH / 2, at.y - HEIGHT / 2);
        expect(distance).toBeLessThanOrEqual(RADIUS + 1e-9);
      }
    }
  });
});

describe("isVisible", () => {
  /* The cap edge is where the camera-frame x equals `RIM`, 81.30 degrees from the centre. A point
     0.01 degree either side must land on the right side, and the horizon at 90 degrees is hidden. */
  it("switches at the cap edge, to well under a pixel", () => {
    const { camera } = pair([0, 0]);
    const edge = Math.acos(RIM) / (Math.PI / 180);
    expect(isVisible(camera, edge - 0.01, 0)).toBe(true);
    expect(isVisible(camera, edge + 0.01, 0)).toBe(false);
    expect(isVisible(camera, 0, edge - 0.01)).toBe(true);
    expect(isVisible(camera, 0, edge + 0.01)).toBe(false);
    expect(isVisible(camera, 89.99, 0)).toBe(false);
  });
});

describe("unproject", () => {
  it("round-trips every visible point", () => {
    for (const rotation of ROTATIONS) {
      const { camera } = pair(rotation);
      for (const [lng, lat] of POINTS) {
        const at = project(camera, lng, lat);
        if (!at.visible) continue;
        const back = unproject(camera, at.x, at.y);
        expect(back, `${rotation} / ${lng},${lat}`).not.toBeNull();
        /* Compared as screen positions, not as lng/lat: at a pole every
           longitude names the same point, so the coordinates legitimately
           differ while the position does not. Four places, not nine — near the
           limb the depth axis is recovered through a square root of a quantity
           approaching zero, which costs precision there. 5e-5 of a pixel is far
           below anything a tooltip or a hit test can notice. */
        const again = project(camera, back![0], back![1]);
        expect(again.x).toBeCloseTo(at.x, 4);
        expect(again.y).toBeCloseTo(at.y, 4);
      }
    }
  });

  it("agrees with the pinhole's ray through the pixel", () => {
    for (const rotation of ROTATIONS) {
      const { camera } = pair(rotation);
      for (const [dx, dy] of [
        [0, 0],
        [40, -30],
        [-120, 60],
        [150, 100],
        [-190, 0],
      ] as const) {
        const ours = unproject(camera, WIDTH / 2 + dx, HEIGHT / 2 + dy);
        if (ours === null) {
          expect(Math.hypot(dx, dy)).toBeGreaterThan(RADIUS);
          continue;
        }
        /* Project the answer back: it must land on the pixel that was asked about. */
        const again = project(camera, ours[0], ours[1]);
        expect(again.x).toBeCloseTo(WIDTH / 2 + dx, 6);
        expect(again.y).toBeCloseTo(HEIGHT / 2 + dy, 6);
        expect(again.visible).toBe(true);
      }
    }
  });

  it("returns null outside the sphere", () => {
    const { camera } = pair([0, 0]);
    expect(unproject(camera, WIDTH / 2 + RADIUS + 1, HEIGHT / 2)).toBeNull();
    expect(unproject(camera, WIDTH / 2, HEIGHT / 2 - RADIUS - 0.5)).toBeNull();
    expect(unproject(camera, WIDTH / 2 + RADIUS, HEIGHT / 2)).not.toBeNull();
  });
});

describe("syncCamera", () => {
  it("is required after a rotation change, and then projection follows", () => {
    const { camera } = pair([0, 0]);
    const before = project(camera, 90, 0);
    camera.rotation[0] = -90;
    syncCamera(camera);
    const after = project(camera, 90, 0);
    expect(after.x).toBeCloseTo(WIDTH / 2, 9);
    expect(before.x).not.toBeCloseTo(after.x, 3);
  });
});

describe("sunDirection", () => {
  it("points straight at the viewer when the sun is behind the camera", () => {
    const { camera } = pair([-20, -40]);
    // The subsolar point at the centre of the view: sun straight ahead.
    const sun = sunDirection(camera, 20, 40);
    expect(sun[0]).toBeCloseTo(0, 9);
    expect(sun[1]).toBeCloseTo(0, 9);
    expect(sun[2]).toBeCloseTo(1, 9);
  });

  it("puts a sun to the geographic east on the right of the screen", () => {
    const { camera } = pair([0, 0]); // centred on 0,0
    const sun = sunDirection(camera, 45, 0);
    expect(sun[0]).toBeGreaterThan(0); // screen right
    expect(sun[1]).toBeCloseTo(0, 9); // no vertical component
  });

  it("puts a sun to the north above the centre (screen y points down)", () => {
    const { camera } = pair([0, 0]);
    const sun = sunDirection(camera, 0, 45);
    expect(sun[1]).toBeLessThan(0);
    expect(sun[0]).toBeCloseTo(0, 9);
  });
});

describe("wrapLng / clampLat / shortestAngle", () => {
  it("wraps into [-180, 180)", () => {
    expect(wrapLng(0)).toBe(0);
    expect(wrapLng(180)).toBe(-180);
    expect(wrapLng(-180)).toBe(-180);
    expect(wrapLng(190)).toBe(-170);
    expect(wrapLng(-190)).toBe(170);
    expect(wrapLng(540)).toBe(-180);
  });

  it("clamps latitude to the poles", () => {
    expect(clampLat(91)).toBe(90);
    expect(clampLat(-91)).toBe(-90);
    expect(clampLat(12.5)).toBe(12.5);
  });

  it("takes the short way round", () => {
    expect(shortestAngle(170, -170)).toBe(20);
    expect(shortestAngle(-170, 170)).toBe(-20);
    expect(shortestAngle(0, 10)).toBe(10);
  });
});
