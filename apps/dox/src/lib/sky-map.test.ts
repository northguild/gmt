import { sampleMap, type SkyMap } from "./sky-map";

/** A 16 x 8 map whose red channel is `(x * 37 + y * 91 + x * y * 13) % 256`, green and blue offset. */
function synthetic(): SkyMap {
  const width = 16;
  const height = 8;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 4;
      data[at] = (x * 37 + y * 91 + x * y * 13) % 256;
      data[at + 1] = 255 - data[at]!;
      data[at + 2] = (x * 16) % 256;
    }
  return { width, height, data };
}

/**
 * Recorded from the band's own lookup in `sky.ts` before it moved here (the same expression, run
 * on this map): `[u, v, value]`.
 */
const BAND_BEFORE: [number, number, number][] = [
  [0.5, 0, 21.5],
  [0.5371, 1, 136.9808],
  [0.5742, 0.013, 65.4264],
  [0.6113, 0.987, 217.0576],
  [0.6484, 0.5, 125.2148],
  [0.6855, 0.25, 87.942],
  [0.7226, 0.75, 36.6836],
  [0.7597, 0.333, 146.066486],
  [0.7968, 0.9, 158.57608],
  [0.8339, 0.1, 219.75416],
  [0.871, 0, 129.516],
  [0.9081, 1, 128.7888],
  [0.9452, 0.013, 29.0584],
  [0.9823, 0.987, 225.2496],
  [1.0194, 0.5, 78.7108],
  [1.0565, 0.25, 159.326],
  [1.0936, 0.75, 97.0468],
  [1.1307, 0.333, 132.051779],
  [1.1678, 0.9, 112.83368],
  [1.2049, 0.1, 140.93656],
];

describe("sampleMap", () => {
  it.each(BAND_BEFORE)(
    "matches the band's old lookup at u %f, v %f",
    (u, v, value) => {
      expect(sampleMap(synthetic(), u, v)).toBeCloseTo(value, 5);
    },
  );

  it("returns a cell's own value at its centre, for each channel", () => {
    const map = synthetic();
    const at = (5 * 16 + 3) * 4;
    const u = 3.5 / 16;
    const v = 5.5 / 8;
    expect(sampleMap(map, u, v, 0)).toBeCloseTo(map.data[at]!, 9);
    expect(sampleMap(map, u, v, 1)).toBeCloseTo(map.data[at + 1]!, 9);
    expect(sampleMap(map, u, v, 2)).toBeCloseTo(map.data[at + 2]!, 9);
  });

  it("wraps at u = 0 and 1: the same place a whole turn apart reads the same", () => {
    const map = synthetic();
    for (const v of [0.2, 0.5, 0.8]) {
      expect(sampleMap(map, 0, v)).toBeCloseTo(sampleMap(map, 1, v), 9);
      expect(sampleMap(map, 0.03, v)).toBeCloseTo(sampleMap(map, 1.03, v), 9);
      expect(sampleMap(map, 0.03, v)).toBeCloseTo(sampleMap(map, -0.97, v), 9);
    }
  });

  it("blends the last column into the first across the seam", () => {
    const map = synthetic();
    const last = (3 * 16 + 15) * 4;
    const first = 3 * 16 * 4;
    const v = 3.5 / 8;
    expect(sampleMap(map, 0, v)).toBeCloseTo(
      (map.data[last]! + map.data[first]!) / 2,
      9,
    );
  });

  it("clamps at the poles: above the first row and below the last read those rows", () => {
    const map = synthetic();
    const top = sampleMap(map, 0.3, 0.5 / 8);
    expect(sampleMap(map, 0.3, 0)).toBeCloseTo(top, 9);
    expect(sampleMap(map, 0.3, -0.2)).toBeCloseTo(top, 9);
    const bottom = sampleMap(map, 0.3, 7.5 / 8);
    expect(sampleMap(map, 0.3, 1)).toBeCloseTo(bottom, 9);
    expect(sampleMap(map, 0.3, 1.2)).toBeCloseTo(bottom, 9);
  });
});
