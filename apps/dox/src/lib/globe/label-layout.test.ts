import { createCamera } from "./camera";
import { LABEL_OFFSET_X } from "./casing";
import {
  labelBox,
  layoutMarkerLabels,
  placeLabels,
  type LabelSpot,
} from "./label-layout";
import type { GlobeMarker } from "./types";

function spot(
  x: number,
  y: number,
  width = 60,
  extra: Partial<LabelSpot> = {},
) {
  return { x, y, radius: 3, width, ringShift: 0, ...extra };
}

describe("placeLabels", () => {
  it("puts a lone label on the right of its dot", () => {
    expect(placeLabels([spot(100, 100)])).toEqual(["right"]);
  });

  it("moves a label to the left when the right side is taken", () => {
    const sides = placeLabels([spot(100, 100), spot(100, 106)]);
    expect(sides).toEqual(["right", "left"]);
  });

  it("hides a label that fits on neither side", () => {
    const sides = placeLabels([spot(100, 100), spot(100, 104), spot(100, 102)]);
    expect(sides).toEqual(["right", "left", null]);
  });

  it("never leaves two drawn labels overlapping, or a label over a dot", () => {
    const spots: LabelSpot[] = [];
    for (let i = 0; i < 40; i++) {
      spots.push(spot(200 + ((i * 37) % 90), 200 + ((i * 53) % 70)));
    }
    const sides = placeLabels(spots);
    const boxes = spots.flatMap((s, i) => {
      const side = sides[i];
      return side ? [{ i, box: labelBox(s, side) }] : [];
    });
    for (const a of boxes) {
      for (const b of boxes) {
        if (a.i >= b.i) continue;
        const apart =
          a.box.right <= b.box.left ||
          b.box.right <= a.box.left ||
          a.box.bottom <= b.box.top ||
          b.box.bottom <= a.box.top;
        expect(apart).toBe(true);
      }
      for (let j = 0; j < spots.length; j++) {
        if (j === a.i) continue;
        const d = spots[j];
        const clear =
          a.box.right <= d.x - d.radius ||
          a.box.left >= d.x + d.radius ||
          a.box.bottom <= d.y - d.radius ||
          a.box.top >= d.y + d.radius;
        expect(clear).toBe(true);
      }
    }
  });

  it("keeps both labels of two large dots 12 px apart vertically", () => {
    const big = { radius: 6 };
    expect(
      placeLabels([spot(100, 100, 80, big), spot(100, 112, 80, big)]),
    ).toEqual(["right", "right"]);
  });

  it("keeps both labels of two dots 12 px apart vertically", () => {
    expect(placeLabels([spot(100, 100), spot(100, 112)])).toEqual([
      "right",
      "right",
    ]);
  });

  it("keeps the earlier marker's label when two compete", () => {
    const sides = placeLabels([spot(100, 100, 60), spot(100, 106, 60)]);
    expect(sides[0]).toBe("right");
  });

  it("gives a ringed marker's label first pick", () => {
    const ring = spot(100, 106, 60, { ringShift: 4, ringed: true });
    const sides = placeLabels([spot(100, 100), ring]);
    expect(sides).toEqual(["left", "right"]);
  });

  it("is the same answer every time", () => {
    const spots = [spot(100, 100), spot(110, 104), spot(95, 98), spot(300, 50)];
    expect(placeLabels(spots)).toEqual(placeLabels(spots));
  });

  it("skips a spot with no label but still keeps its dot clear", () => {
    const sides = placeLabels([spot(100, 100, 0), spot(80, 100, 60)]);
    expect(sides[0]).toBeNull();
    // The right side of the second would run over the first dot at x=100.
    expect(sides[1]).toBe("left");
  });

  it("mirrors the ring shift on the left", () => {
    const s = spot(100, 100, 60, { ringShift: 5 });
    expect(labelBox(s, "right").left).toBe(100 + LABEL_OFFSET_X + 5);
    expect(labelBox(s, "left").right).toBe(100 - LABEL_OFFSET_X - 5);
  });
});

describe("layoutMarkerLabels", () => {
  const marker = (
    id: string,
    position: [number, number],
    label?: string,
  ): GlobeMarker => ({
    id,
    position,
    radius: 3,
    color: [1, 1, 1, 1],
    label,
  });

  it("hides labels of far-side markers and keeps one side per near marker", () => {
    const camera = createCamera([0, 0]);
    camera.radius = 200;
    camera.centreX = 300;
    camera.centreY = 300;
    const markers = [
      marker("near", [0, 0], "Near"),
      marker("far", [180, 0], "Far"),
      marker("plain", [10, 10]),
    ];
    const sides = layoutMarkerLabels(markers, camera, () => 40);
    expect(sides).toEqual(["right", null, null]);
  });

  it("separates stacked pins that share a location", () => {
    const camera = createCamera([0, 0]);
    camera.radius = 200;
    camera.centreX = 300;
    camera.centreY = 300;
    const markers = [
      marker("a", [0, 0], "Alpha"),
      marker("b", [0.5, 0.2], "Bravo"),
      marker("c", [0.2, 0.1], "Charlie"),
    ];
    const sides = layoutMarkerLabels(markers, camera, () => 40);
    expect(sides.filter((side) => side !== null).length).toBeLessThan(3);
  });
});
