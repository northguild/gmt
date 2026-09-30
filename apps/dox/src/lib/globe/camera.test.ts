/// <reference types="vitest/globals" />

/**
 * The camera replaces `d3.geoOrthographic()` on the GPU path, so d3 *is* the
 * oracle here: the canvas-2D fallback still projects with d3, and any drift
 * between the two would show as a tooltip or a hit test landing in a different
 * place depending on which renderer started.
 *
 * Tested against d3 rather than against hand-computed numbers on purpose. A
 * hand-rolled expectation would only prove the maths matches itself.
 */

import { geoDistance, geoOrthographic } from "d3-geo";
import { describe, expect, it } from "vitest";
import {
  cameraCentre,
  clampLat,
  createCamera,
  dot3,
  isVisible,
  project,
  shortestAngle,
  sunDirection,
  syncCamera,
  unitVector,
  unproject,
  wrapLng,
} from "./camera";

const WIDTH = 640;
const HEIGHT = 480;
const RADIUS = 200;

/** Our camera and a d3 projection configured identically. */
function pair(rotation: [number, number]) {
  const camera = createCamera(rotation);
  camera.radius = RADIUS;
  camera.centreX = WIDTH / 2;
  camera.centreY = HEIGHT / 2;
  const projection = geoOrthographic()
    .rotate([rotation[0], rotation[1]])
    .scale(RADIUS)
    .translate([WIDTH / 2, HEIGHT / 2])
    .clipAngle(90);
  return { camera, projection };
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
  /* Note `clipAngle(90)` does not enter into this. d3's point-wise
     `projection(p)` applies the raw forward transform and never clips — only
     `projection.stream` and `geoPath` honour the clip angle — so a far-side
     point comes back at its silhouette position rather than as null. The
     existing `globe.ts` depends on exactly that to place the sun's screen
     vector, and `project` reproduces it: `visible` reports the hemisphere while
     `x`/`y` stay defined on both sides. */
  it("agrees with d3.geoOrthographic on both hemispheres", () => {
    for (const rotation of ROTATIONS) {
      const { camera, projection } = pair(rotation);
      for (const [lng, lat] of POINTS) {
        const expected = projection([lng, lat]);
        const actual = project(camera, lng, lat);
        expect(expected, `${rotation} / ${lng},${lat}`).not.toBeNull();
        expect(actual.x, `${rotation} / ${lng},${lat} x`).toBeCloseTo(
          expected![0],
          9,
        );
        expect(actual.y, `${rotation} / ${lng},${lat} y`).toBeCloseTo(
          expected![1],
          9,
        );
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
  it("is true exactly within a quarter turn of the view centre", () => {
    for (const rotation of ROTATIONS) {
      const { camera } = pair(rotation);
      const centre = cameraCentre(camera);
      for (const [lng, lat] of POINTS) {
        const turn = geoDistance([lng, lat], centre);
        // Points sitting exactly on the horizon are the one ambiguous case;
        // the convention for those is asserted on its own below.
        if (Math.abs(turn - Math.PI / 2) < 1e-9) continue;
        expect(isVisible(camera, lng, lat), `${rotation} / ${lng},${lat}`).toBe(
          turn < Math.PI / 2,
        );
      }
    }
  });

  /* A point *exactly* on the horizon has no stable answer and is not worth
     pinning one to: the test is `rotated.x > 0`, and at a quarter turn that x is
     `cos(π/2)`, which in doubles is 6e-17 rather than 0. Whether it lands
     either side of zero depends on the rotation's own rounding. What has to
     hold is that the boundary is in the right place to well under a pixel —
     a marker half a degree off the limb must not flicker. */
  it("switches at the horizon, to well under a pixel", () => {
    const { camera } = pair([0, 0]);
    expect(isVisible(camera, 89.99, 0)).toBe(true);
    expect(isVisible(camera, 90.01, 0)).toBe(false);
    expect(isVisible(camera, 0, 89.99)).toBe(true);
    // A quarter turn away in both axes at once.
    expect(isVisible(camera, 90.01, 45)).toBe(false);
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

  it("agrees with d3's invert", () => {
    for (const rotation of ROTATIONS) {
      const { camera, projection } = pair(rotation);
      for (const [dx, dy] of [
        [0, 0],
        [40, -30],
        [-120, 60],
        [150, 100],
        [-190, 0],
      ] as const) {
        const sx = WIDTH / 2 + dx;
        const sy = HEIGHT / 2 + dy;
        const ours = unproject(camera, sx, sy);
        const theirs = projection.invert!([sx, sy]);
        if (ours === null) {
          // Outside the disc; d3 either returns null or a point off the sphere.
          expect(Math.hypot(dx, dy)).toBeGreaterThan(RADIUS);
          continue;
        }
        expect(theirs).not.toBeNull();
        expect(wrapLng(ours[0] - theirs![0])).toBeCloseTo(0, 6);
        expect(ours[1]).toBeCloseTo(theirs![1], 6);
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

describe("unitVector / dot3", () => {
  it("is a unit vector for any lng/lat", () => {
    for (const [lng, lat] of POINTS) {
      const [x, y, z] = unitVector(lng, lat);
      expect(x * x + y * y + z * z).toBeCloseTo(1, 10);
    }
  });

  it("matches cos(geoDistance(...)) to 9 places", () => {
    const cases: [[number, number], [number, number]][] = [
      [
        [-73.99, 40.73],
        [139.69, 35.68],
      ],
      [
        [0, 51.5],
        [2.35, 48.85],
      ],
      [
        [10, 20],
        [-170, -20],
      ],
      [
        [0, 0],
        [0, 0],
      ],
    ];
    for (const [a, b] of cases) {
      expect(dot3(unitVector(...a), unitVector(...b))).toBeCloseTo(
        Math.cos(geoDistance(a, b)),
        9,
      );
    }
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

  it("is a unit vector, and its depth is the cosine to the view centre", () => {
    const { camera } = pair([-10, -15]);
    for (const [lng, lat] of POINTS) {
      const sun = sunDirection(camera, lng, lat);
      expect(Math.hypot(sun[0], sun[1], sun[2])).toBeCloseTo(1, 9);
      expect(sun[2]).toBeCloseTo(
        Math.cos(geoDistance([lng, lat], cameraCentre(camera))),
        9,
      );
    }
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
