import { geoPath } from "d3-geo";
import {
  US_LAYOUT_BOTTOM,
  US_PARTS,
  geoUsComposite,
  type UsPartName,
} from "./us-projection";

/** Known places, one in each part: `[name, lon, lat, the part it belongs to]`. */
const PLACES: readonly [string, number, number, UsPartName][] = [
  ["Denver", -104.99, 39.74, "lower48"],
  ["Anchorage", -149.9, 61.22, "alaska"],
  ["Honolulu", -157.86, 21.31, "hawaii"],
  ["San Juan", -66.11, 18.47, "puertoRico"],
  ["Hagåtña", 144.75, 13.47, "marianas"],
  ["Pago Pago", -170.7, -14.28, "samoa"],
];

describe("geoUsComposite", () => {
  const projection = geoUsComposite().scale(1000).translate([400, 300]);

  it.each(PLACES)(
    "%s lands in its own part's frame",
    (_name, lon, lat, part) => {
      const point = projection([lon, lat]);
      expect(point).not.toBeNull();
      const [[x0, y0], [x1, y1]] = projection.frames()[part];
      expect(point![0]).toBeGreaterThan(x0);
      expect(point![0]).toBeLessThan(x1);
      expect(point![1]).toBeGreaterThan(y0);
      expect(point![1]).toBeLessThan(y1);
    },
  );

  it.each(PLACES)("%s inverts to where it started", (_name, lon, lat) => {
    const back = projection.invert(projection([lon, lat])!);
    expect(back![0]).toBeCloseTo(lon, 6);
    expect(back![1]).toBeCloseTo(lat, 6);
  });

  it("keeps the six frames apart", () => {
    const frames = Object.values(projection.frames());
    expect(frames).toHaveLength(US_PARTS.length);
    frames.forEach((a, i) => {
      frames.slice(i + 1).forEach((b) => {
        const apart =
          a[1][0] <= b[0][0] ||
          b[1][0] <= a[0][0] ||
          a[1][1] <= b[0][1] ||
          b[1][1] <= a[0][1];
        expect(apart).toBe(true);
      });
    });
  });

  it("draws the extremes of every inset inside its frame, so no land is clipped", () => {
    for (const part of US_PARTS) {
      for (const [lon, lat] of part.panes.flatMap((pane) => pane.reference)) {
        expect(
          projection([lon, lat]),
          `${part.name} ${lon},${lat}`,
        ).not.toBeNull();
      }
    }
  });

  it("drops a point that lies in no frame", () => {
    // Midway is not drawn, and Moscow is nowhere near any part.
    expect(projection([-177.4, 28.2])).toBeNull();
    expect(projection([37.6, 55.75])).toBeNull();
  });

  it("scales and translates", () => {
    expect(projection.scale()).toBe(1000);
    expect(projection.translate()).toEqual([400, 300]);
  });

  it("fits a drawing into an extent, so a path can use it like any projection", () => {
    const fitted = geoUsComposite().fitExtent(
      [
        [16, 16],
        [784, 544],
      ],
      {
        type: "MultiPoint",
        coordinates: PLACES.map(([, lon, lat]) => [lon, lat]),
      },
    );
    const [[x0, y0], [x1, y1]] = geoPath(fitted).bounds({
      type: "MultiPoint",
      coordinates: PLACES.map(([, lon, lat]) => [lon, lat]),
    });
    expect(x0).toBeGreaterThanOrEqual(16 - 1e-6);
    expect(y0).toBeGreaterThanOrEqual(16 - 1e-6);
    expect(x1).toBeLessThanOrEqual(784 + 1e-6);
    expect(y1).toBeLessThanOrEqual(544 + 1e-6);
    // One axis is filled edge to edge.
    expect(Math.max(x1 - x0 - 768, y1 - y0 - 528)).toBeGreaterThan(-1);
  });

  describe("the inset strip", () => {
    const k = 1000;
    const strip = geoUsComposite().scale(k).translate([500, 300]);
    const frames = strip.frames();
    const insets = (
      ["alaska", "hawaii", "puertoRico", "marianas", "samoa"] as const
    ).map((name) => ({ name, frame: frames[name] }));

    it("spans the whole width of the lower 48, with even gaps", () => {
      const [[left], [right]] = [frames.lower48[0], frames.lower48[1]];
      expect(insets[0]!.frame[0][0]).toBeCloseTo(left, 6);
      expect(insets.at(-1)!.frame[1][0]).toBeCloseTo(right, 6);
      const gaps = insets
        .slice(1)
        .map((inset, i) => inset.frame[0][0] - insets[i]!.frame[1][0]);
      for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0]!, 6);
      expect(gaps[0]).toBeGreaterThan(0);
    });

    it("is tall, and leaves a band under it for the credits button", () => {
      for (const { frame } of insets) {
        expect(frame[1][1] - frame[0][1]).toBeGreaterThanOrEqual(0.19 * k);
        expect(frame[1][1]).toBeLessThan(300 + US_LAYOUT_BOTTOM * k - 0.04 * k);
      }
    });

    it.each(insets)("zooms $name to fill its card", ({ name, frame }) => {
      const spec = US_PARTS.find((part) => part.name === name)!;
      const points = spec.panes
        .flatMap((pane) => pane.reference)
        .map((p) => strip([p[0], p[1]])!);
      const xs = points.map((p) => p[0]);
      const ys = points.map((p) => p[1]);
      const width =
        (Math.max(...xs) - Math.min(...xs)) / (frame[1][0] - frame[0][0]);
      const height =
        (Math.max(...ys) - Math.min(...ys)) / (frame[1][1] - frame[0][1]);
      // The land's extent fills the card along one axis, less the pad and the label band (the card is 0.2 k tall).
      expect(Math.max(width, height)).toBeGreaterThan(0.7);
      // And lies inside it, below the label band.
      expect(Math.min(...xs)).toBeGreaterThan(frame[0][0]);
      expect(Math.max(...xs)).toBeLessThan(frame[1][0]);
      expect(Math.min(...ys)).toBeGreaterThan(frame[0][1]);
      expect(Math.max(...ys)).toBeLessThan(frame[1][1]);
    });

    it("draws Tutuila and the Manu'a group side by side in one card, each zoomed on its own", () => {
      const [[x0, y0], [x1, y1]] = frames.samoa;
      // Tutuila's east cape, and Tau's west and east ends.
      const tutuilaEast = strip([-170.56, -14.28])!;
      const tauWest = strip([-169.52, -14.24])!;
      const tauEast = strip([-169.42, -14.24])!;
      for (const p of [tutuilaEast, tauWest, tauEast]) {
        expect(p[0]).toBeGreaterThan(x0);
        expect(p[0]).toBeLessThan(x1);
        expect(p[1]).toBeGreaterThan(y0);
        expect(p[1]).toBeLessThan(y1);
      }
      expect(tauWest[0]).toBeGreaterThan(tutuilaEast[0]);
      // At one zoom for both, the 0.1 degrees of Tau would take a fifteenth of the card's width.
      expect(tauEast[0] - tauWest[0]).toBeGreaterThan((x1 - x0) / 10);
      // The open sea between the panes draws nothing: a point there is in neither pane.
      expect(strip([-170.1, -14.3])).toBeNull();
    });

    it("puts each label in the same band along its card's top, clear of the land", () => {
      const labels = strip.labelPoints();
      const offsets = insets.map(({ name, frame }) => {
        const [lx, ly] = labels[name];
        expect(lx).toBeCloseTo((frame[0][0] + frame[1][0]) / 2, 6);
        const spec = US_PARTS.find((part) => part.name === name)!;
        const top = Math.min(
          ...spec.panes
            .flatMap((pane) => pane.reference)
            .map((p) => strip([p[0], p[1]])![1]),
        );
        expect(ly).toBeLessThan(top);
        return ly - frame[0][1];
      });
      for (const offset of offsets) expect(offset).toBeCloseTo(offsets[0]!, 6);
    });
  });
});
