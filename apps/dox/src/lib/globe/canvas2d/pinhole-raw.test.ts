import { geoPath } from "d3-geo";
import { createCamera, isVisible, project, syncCamera } from "../camera";
import { RIM } from "../pinhole";
import { createPinholeProjection, setProjectionCamera } from "./pinhole-raw";

/** A small seeded generator, so the sampled points are the same every run. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

const ROTATIONS: ReadonlyArray<[number, number]> = [
  [0, 0],
  [-73.5, -40.2],
  [118, 52.7],
];

describe("canvas pinhole projection", () => {
  it.each(ROTATIONS.flatMap((r) => [1, 5].map((zoom) => [r, zoom] as const)))(
    "matches camera.ts to 1e-6 px for rotation %j at radius x%s",
    (rotation, zoom) => {
      const camera = createCamera(rotation);
      camera.radius = 220 * zoom;
      camera.centreX = 410;
      camera.centreY = 305;
      syncCamera(camera);
      const projection = createPinholeProjection();
      setProjectionCamera(projection, camera);

      const random = seeded(7);
      let checked = 0;
      while (checked < 500) {
        const lng = random() * 360 - 180;
        const lat = Math.asin(random() * 2 - 1) * (180 / Math.PI);
        const expected = project(camera, lng, lat);
        if (!expected.visible) continue;
        const drawn = projection([lng, lat]);
        expect(drawn).not.toBeNull();
        expect(drawn?.[0]).toBeCloseTo(expected.x, 6);
        expect(drawn?.[1]).toBeCloseTo(expected.y, 6);
        checked++;
      }
    },
  );

  it("draws the whole sphere as a disc of the silhouette radius", () => {
    const camera = createCamera([20, -15]);
    camera.radius = 180;
    camera.centreX = 300;
    camera.centreY = 250;
    syncCamera(camera);
    const projection = createPinholeProjection();
    setProjectionCamera(projection, camera);
    const [[x0, y0], [x1, y1]] = geoPath(projection).bounds({
      type: "Sphere",
    });
    expect(Math.abs(x0 - (300 - 180))).toBeLessThan(0.5);
    expect(Math.abs(x1 - (300 + 180))).toBeLessThan(0.5);
    expect(Math.abs(y0 - (250 - 180))).toBeLessThan(0.5);
    expect(Math.abs(y1 - (250 + 180))).toBeLessThan(0.5);
  });

  it("clips at the silhouette's cap angle", () => {
    const projection = createPinholeProjection();
    expect(
      Math.abs(
        (projection.clipAngle() as number) - (Math.acos(RIM) * 180) / Math.PI,
      ),
    ).toBeLessThan(1e-12);
  });
});

/* The renderer culls its markers with `isVisible`, so these rows drive that call. */
describe("marker cull", () => {
  const capDeg = (Math.acos(RIM) * 180) / Math.PI;
  const centreOffset = (deg: number) => {
    const camera = createCamera([0, 0]);
    // A marker `deg` degrees east of the sub-camera point on the equator.
    return isVisible(camera, deg, 0);
  };

  it("draws a marker just inside the cap", () => {
    expect(centreOffset(capDeg - 0.01)).toBe(true);
  });

  it("leaves out a marker just past the cap", () => {
    expect(centreOffset(capDeg + 0.01)).toBe(false);
  });
});
