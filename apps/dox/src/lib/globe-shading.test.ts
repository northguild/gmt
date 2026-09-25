import { describe, expect, it } from "vitest";
import {
  cityLightsOn,
  dayFactor,
  hazeFactor,
  nightFactor,
  paintShading,
  type ShadingInput,
} from "./globe-shading";

const TWILIGHT_END = Math.sin((18 * Math.PI) / 180);

const CIVIL_TWILIGHT = Math.sin((6 * Math.PI) / 180);

const SIZE = 101;
const CENTRE = 50.5;

function shade(
  sun: ShadingInput["sun"],
  overrides: Partial<ShadingInput> = {},
) {
  const pixels = new Uint8ClampedArray(SIZE * SIZE * 4);
  paintShading(pixels, {
    width: SIZE,
    height: SIZE,
    cx: CENTRE,
    cy: CENTRE,
    radius: 50,
    sun,
    day: [34, 211, 238],
    night: [3, 8, 12],
    dayAlpha: 0.26,
    nightAlpha: 0.5,
    hazeAlpha: 0,
    dither: false,
    ...overrides,
  });
  const at = (x: number, y: number) => {
    const i = (y * SIZE + x) * 4;
    return Array.from(pixels.slice(i, i + 4));
  };
  return { pixels, at };
}

describe("nightFactor", () => {
  it("is 0 in daylight and at the horizon", () => {
    expect(nightFactor(0.5)).toBe(0);
    expect(nightFactor(0)).toBe(0);
  });

  it("reaches 1 at the end of astronomical twilight and stays there", () => {
    expect(nightFactor(-TWILIGHT_END)).toBe(1);
    expect(nightFactor(-1)).toBe(1);
  });

  it("is halfway through the ease midway through twilight", () => {
    expect(nightFactor(-TWILIGHT_END / 2)).toBeCloseTo(0.5, 10);
  });
});

describe("dayFactor", () => {
  it("is 1 with the sun overhead", () => {
    expect(dayFactor(1)).toBeCloseTo(1, 10);
  });

  it("still lights the ground at the horizon and fades out by 6° below it", () => {
    expect(dayFactor(0)).toBeGreaterThan(0);
    expect(dayFactor(-CIVIL_TWILIGHT)).toBe(0);
    expect(dayFactor(-0.5)).toBe(0);
  });

  it("is gamma-encoded, so half the linear light is brighter than half", () => {
    // Linear light halfway between the civil twilight limit and overhead.
    const halfway = (1 - CIVIL_TWILIGHT) / 2;
    expect(dayFactor(halfway)).toBeCloseTo(0.5 ** (1 / 2.2), 10);
  });
});

describe("cityLightsOn", () => {
  it("is off in daylight and at the horizon, while the ground is still lit", () => {
    expect(cityLightsOn(0.5)).toBe(false);
    expect(cityLightsOn(0)).toBe(false);
  });

  it("switches on at civil dusk, where daylight has faded out", () => {
    expect(cityLightsOn(-CIVIL_TWILIGHT)).toBe(true);
    expect(dayFactor(-CIVIL_TWILIGHT)).toBe(0);
    expect(cityLightsOn(-1)).toBe(true);
  });
});

describe("hazeFactor", () => {
  it("is 0 inside the thin limb rim and 1 at the limb", () => {
    expect(hazeFactor(0)).toBe(0);
    expect(hazeFactor(0.96)).toBe(0);
    expect(hazeFactor(1)).toBe(1);
  });
});

describe("paintShading", () => {
  it("lights the sub-viewer point at the full day alpha when the sun is straight ahead", () => {
    const { at } = shade([0, 0, 1]);
    expect(at(50, 50)).toEqual([34, 211, 238, Math.round(0.26 * 255)]);
  });

  it("darkens the sub-viewer point to the full night alpha when the sun is straight behind", () => {
    const { at } = shade([0, 0, -1]);
    expect(at(50, 50)).toEqual([3, 8, 12, Math.round(0.5 * 255)]);
  });

  it("lights the limb facing the sun and darkens the opposite one", () => {
    const { at } = shade([1, 0, 0]);
    expect(at(SIZE - 1, 50).slice(0, 3)).toEqual([34, 211, 238]);
    expect(at(0, 50)).toEqual([3, 8, 12, Math.round(0.5 * 255)]);
  });

  it("leaves no hard edge across the terminator", () => {
    // The regression: stacked caps left visible steps. Across a row from the
    // lit limb to the night limb of a globe the size the hero draws (radius
    // 250 CSS px, so 125 at SHADE_RESOLUTION), neighbouring pixels must change
    // gently. The haze rim is left out: it is steep by design, at the limb.
    const size = 251;
    const pixels = new Uint8ClampedArray(size * size * 4);
    paintShading(pixels, {
      width: size,
      height: size,
      cx: size / 2,
      cy: size / 2,
      radius: 125,
      sun: [1, 0, 0],
      day: [34, 211, 238],
      night: [3, 8, 12],
      dayAlpha: 0.26,
      nightAlpha: 0.5,
      hazeAlpha: 0,
    });
    // Dither is on here: the check must hold for what the globe draws.
    const at = (x: number) => {
      const i = (125 * size + x) * 4;
      return Array.from(pixels.slice(i, i + 4));
    };
    for (let x = 1; x < size; x++) {
      const [r0, g0, b0, a0] = at(x - 1);
      const [r1, g1, b1, a1] = at(x);
      const premultiplied = (c: number, a: number) => (c * a) / 255;
      expect(Math.abs(a1 - a0)).toBeLessThanOrEqual(8);
      expect(
        Math.abs(premultiplied(g1, a1) - premultiplied(g0, a0)),
      ).toBeLessThanOrEqual(8);
      expect(
        Math.abs(premultiplied(r1, a1) - premultiplied(r0, a0)),
      ).toBeLessThanOrEqual(8);
      expect(
        Math.abs(premultiplied(b1, a1) - premultiplied(b0, a0)),
      ).toBeLessThanOrEqual(8);
    }
  });

  it("adds the limb haze only where the limb is lit", () => {
    const withHaze = shade([0, -1, 0], { hazeAlpha: 0.2 });
    const without = shade([0, -1, 0]);
    // Lit (top) limb: brighter with haze.
    expect(withHaze.at(50, 0)[3]).toBeGreaterThan(without.at(50, 0)[3]);
    // Night (bottom) limb: no haze at all.
    expect(withHaze.at(50, SIZE - 1)).toEqual(without.at(50, SIZE - 1));
  });

  it("keeps the haze to a thin rim", () => {
    const withHaze = shade([0, -1, 0], { hazeAlpha: 0.2 });
    const without = shade([0, -1, 0]);
    // 10% of the radius in from the lit limb there is no haze.
    expect(withHaze.at(50, 5)).toEqual(without.at(50, 5));
  });

  it("shades pixels past the limb as if on it, so smoothing never pulls in a fringe", () => {
    // The buffer corner lies outside the disc, towards the lit limb.
    const { at } = shade([1, 0, 0]);
    expect(at(SIZE - 1, 0)[3]).toBeGreaterThan(0);
  });

  it("dithers without shifting the average", () => {
    const flat = shade([0, 0, 1]);
    const dithered = shade([0, 0, 1], { dither: true });
    // A 4×4 tile round the centre: every value within one level, and the
    // tile's mean alpha matches the undithered value.
    let sum = 0;
    for (let y = 48; y < 52; y++) {
      for (let x = 48; x < 52; x++) {
        const a = dithered.at(x, y)[3];
        expect(Math.abs(a - flat.at(x, y)[3])).toBeLessThanOrEqual(1);
        sum += a;
      }
    }
    expect(Math.abs(sum / 16 - 0.26 * 255)).toBeLessThan(0.5);
  });
});
