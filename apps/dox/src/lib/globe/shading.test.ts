import {
  cityLightsOn,
  dayFactor,
  hazeFactor,
  IMAGERY_AMBIENT,
  IMAGERY_FADE_END_ZOOM,
  IMAGERY_FADE_START_ZOOM,
  imageryLight,
  imageryZoomFade,
  nightFactor,
  paintShading,
  type ShadingInput,
} from "./shading";
import { G, P } from "./pinhole";

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

describe("imageryZoomFade", () => {
  it("shows the imagery in full on the resting globe", () => {
    expect(imageryZoomFade(1)).toBe(1);
    expect(imageryZoomFade(IMAGERY_FADE_START_ZOOM)).toBe(1);
  });

  it("has faded to the vector look by the top of the zoom range", () => {
    /* The Dox globe zooms over [1, 5], and one 4096-wide image is soft well
       before 5×. The fade has to be complete by then, not merely under way. */
    expect(IMAGERY_FADE_END_ZOOM).toBeLessThanOrEqual(5);
    expect(imageryZoomFade(IMAGERY_FADE_END_ZOOM)).toBe(0);
    expect(imageryZoomFade(5)).toBe(0);
  });

  it("eases between the two, through a half-way point", () => {
    const middle = (IMAGERY_FADE_START_ZOOM + IMAGERY_FADE_END_ZOOM) / 2;
    expect(imageryZoomFade(middle)).toBeCloseTo(0.5, 10);
    let previous = 1;
    for (let zoom = 1; zoom <= 5; zoom += 0.125) {
      const fade = imageryZoomFade(zoom);
      expect(fade).toBeLessThanOrEqual(previous);
      previous = fade;
    }
  });
});

describe("imageryLight", () => {
  it("leaves the imagery at full brightness with the sun overhead", () => {
    expect(imageryLight(1)).toBeCloseTo(1, 10);
  });

  it("follows the day curve, so the imagery and the wash agree on the terminator", () => {
    for (const elevation of [0.8, 0.4, 0, -0.05]) {
      expect(imageryLight(elevation)).toBeCloseTo(
        IMAGERY_AMBIENT + (1 - IMAGERY_AMBIENT) * dayFactor(elevation),
        10,
      );
    }
  });

  it("keeps an ambient floor on the night side for the night wash to darken", () => {
    expect(IMAGERY_AMBIENT).toBeGreaterThan(0);
    expect(IMAGERY_AMBIENT).toBeLessThan(1);
    expect(imageryLight(-CIVIL_TWILIGHT)).toBe(IMAGERY_AMBIENT);
    expect(imageryLight(-1)).toBe(IMAGERY_AMBIENT);
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

describe("paintShading on the pinhole", () => {
  const RADIUS = 400;
  const SIZE_BIG = 2 * RADIUS + 1;
  const TEN = (10 * Math.PI) / 180;

  /**
   * Offset in pixels from the centre where the elevation on the centre row crosses zero.
   * With no day wash only the night wash paints: alpha is `smoothstep(0, -TWILIGHT_END, e)`, which
   * is exactly 0 for e >= 0 but rounds to 0 a few pixels before that. So read the elevation back
   * at two pixels away from the flat ends of the ramp: the first with alpha of at least 120 of 255,
   * and the last beyond it with alpha still at least 30 (8-bit rounding costs under a quarter
   * pixel there). Then extend the straight line through them to zero.
   */
  function terminatorOffset(sun: ShadingInput["sun"]): number {
    const pixels = new Uint8ClampedArray(SIZE_BIG * SIZE_BIG * 4);
    paintShading(pixels, {
      width: SIZE_BIG,
      height: SIZE_BIG,
      cx: RADIUS + 0.5,
      cy: RADIUS + 0.5,
      radius: RADIUS,
      sun,
      day: [255, 0, 0],
      night: [0, 0, 255],
      dayAlpha: 0,
      nightAlpha: 1,
      hazeAlpha: 0,
      dither: false,
    });
    const alphaAt = (x: number) => pixels[(RADIUS * SIZE_BIG + x) * 4 + 3];
    /* Invert the smoothstep: t such that t²(3 − 2t) = a. */
    const elevationAt = (x: number) => {
      const a = alphaAt(x) / 255;
      const t = 0.5 - Math.sin(Math.asin(1 - 2 * a) / 3);
      return -t * TWILIGHT_END;
    };
    let near = RADIUS;
    while (alphaAt(near) < 120) near++;
    let far = near;
    while (alphaAt(far + 1) >= 30) far++;
    const slope = (elevationAt(far) - elevationAt(near)) / (far - near);
    return far - elevationAt(far) / slope - RADIUS;
  }

  it("puts the terminator where the pinhole puts it", () => {
    const sun: [number, number, number] = [Math.cos(TEN), 0, -Math.sin(TEN)];
    const expectedU = (G * Math.sin(TEN)) / (P - Math.cos(TEN));
    expect(expectedU).toBeCloseTo(0.2017, 3);
    expect(
      Math.abs(terminatorOffset(sun) - expectedU * RADIUS),
    ).toBeLessThanOrEqual(1);
  });

  it("does not put it where an orthographic sphere would", () => {
    const sun: [number, number, number] = [Math.cos(TEN), 0, -Math.sin(TEN)];
    expect(
      Math.abs(terminatorOffset(sun) - Math.sin(TEN) * RADIUS),
    ).toBeGreaterThan(10);
  });

  it("shades a pixel past the limb as the rim pixel on the same ray", () => {
    const width = 301;
    const pixels = new Uint8ClampedArray(width * width * 4);
    paintShading(pixels, {
      width,
      height: width,
      cx: 150.5,
      cy: 150.5,
      radius: 100,
      sun: [0.6, -0.48, 0.64],
      day: [255, 0, 0],
      night: [0, 0, 255],
      dayAlpha: 1,
      nightAlpha: 1,
      hazeAlpha: 0,
      dither: false,
    });
    const at = (x: number) => {
      const i = (150 * width + x) * 4;
      return Array.from(pixels.slice(i, i + 4));
    };
    // x = 250 sits on the rim (distance 1.0); x = 270 is at distance 1.2.
    expect(at(270)).toEqual(at(250));
  });
});

describe("paintShading past the limb", () => {
  const DAY: [number, number, number] = [34, 211, 238];
  const rgbAt = (pixels: Uint8ClampedArray, x: number, y: number) => {
    const i = (y * SIZE + x) * 4;
    return Array.from(pixels.slice(i, i + 3));
  };

  it("lights a pixel past the limb at 45 degrees when the Sun lights the rim there", () => {
    // Sun toward the lower right, in the plane of the screen.
    const sun: [number, number, number] = [Math.SQRT1_2, Math.SQRT1_2, 0];
    const { pixels, at } = shade(sun, { radius: 10 });
    expect(at(80, 80)[3]).toBeGreaterThan(0);
    expect(rgbAt(pixels, 80, 80)).toEqual(DAY);
  });

  it("lights every edge pixel past the limb when the globe straddles the left edge", () => {
    // The globe's centre is right of column 0, so column 0 is past the limb. The Sun is on the
    // left, so the rim there is lit; the right end of the previous row is on the night side.
    const sun: [number, number, number] = [-1, 0, 0];
    const { pixels, at } = shade(sun, { cx: 60 });
    for (let y = 25; y <= 75; y++) {
      expect(at(0, y)[3]).toBeGreaterThan(0);
      expect(rgbAt(pixels, 0, y)).toEqual(DAY);
    }
  });
});

describe("shading.ts source", () => {
  it("holds no orthographic depth", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(
      new URL("./shading.ts", import.meta.url),
      "utf8",
    );
    expect(source).not.toContain("Math.sqrt(Math.max(0, 1 - u * u - v * v))");
  });
});
