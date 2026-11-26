// @vitest-environment jsdom
import { moonSight, stubImageCanvas } from "../test/body-sight";
import { createMoonPainter, discSize } from "./body-paint";
import { ICE_TINT, type Disc, type Rgb } from "./sky-bodies";
import { paintLook, setLook } from "./look";
import type { SkyMap } from "./sky-map";
import {
  bodyOnScreen,
  limbOnScreen,
  siderealDeg,
  SUN_RADIUS,
  sunRaDec,
  skyLens,
  toUnit,
  viewMatrix,
} from "./sky-math";
import { createSunPainter, paintEmissiveDisc } from "./sun-paint";

const DEG = 180 / Math.PI;

/** A 64 x 64 grey map: `base` everywhere, `at` where it says so (all three channels). */
function map(
  base: number,
  at: (x: number, y: number) => number | undefined = () => undefined,
): SkyMap {
  const size = 64;
  const data = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      data.fill(at(x, y) ?? base, (y * size + x) * 4, (y * size + x) * 4 + 3);
  return { width: size, height: size, data };
}

function paint(
  m: SkyMap,
  radius: number,
  angle: number,
  tint: Rgb = ICE_TINT,
): ImageData {
  const size = discSize(radius);
  const out = {
    width: size,
    height: size,
    data: new Uint8ClampedArray(size * size * 4),
  } as ImageData;
  paintEmissiveDisc(m, { radius, angle, tint }, out);
  return out;
}

describe("paintEmissiveDisc", () => {
  it("covers a uniform disc's area, within 2 %", () => {
    const radius = 100;
    const image = paint(map(200), radius, Math.PI / 2);
    let covered = 0;
    for (let i = 3; i < image.data.length; i += 4)
      covered += image.data[i]! / 255;
    expect(Math.abs(covered / (Math.PI * radius ** 2) - 1)).toBeLessThan(0.02);
  });

  it.each([0, 90, 200])(
    "turns the image's north to the pole angle: a dot at the top centre lands %d degrees round",
    (degrees) => {
      const radius = 100;
      /* A bright centre and dot, a dark rest: the dot is where the level is high away from the centre. */
      const m = map(20, (x, y) =>
        (Math.abs(x - 32) < 8 && Math.abs(y - 32) < 8) ||
        (Math.abs(x - 32) < 3 && y < 10)
          ? 220
          : undefined,
      );
      const image = paint(m, radius, degrees / DEG);
      const c = image.width / 2;
      let sx = 0;
      let sy = 0;
      for (let j = 0; j < image.height; j++)
        for (let i = 0; i < image.width; i++) {
          const x = (i + 0.5 - c) / radius;
          const y = (c - j - 0.5) / radius;
          if (
            Math.hypot(x, y) > 0.55 &&
            image.data[(j * image.width + i) * 4]! > 150
          ) {
            sx += x;
            sy += y;
          }
        }
      const found = (Math.atan2(sy, sx) * DEG + 360) % 360;
      const off = Math.abs(((found - degrees + 540) % 360) - 180);
      expect(off).toBeLessThan(10);
    },
  );

  it("paints a map byte of 255 as the tint at full strength", () => {
    const m = map(50, (x, y) =>
      Math.abs(x - 32) < 5 && Math.abs(y - 32) < 5 ? 255 : undefined,
    );
    const image = paint(m, 100, Math.PI / 2);
    const o = (100 * image.width + 100) * 4;
    ICE_TINT.forEach((channel, a) =>
      expect(Math.abs(image.data[o + a]! - channel)).toBeLessThanOrEqual(1),
    );
    expect(image.data[o + 3]).toBe(255);
  });

  it("scales the tint by the map byte over 255, unclipped", () => {
    const image = paint(map(128), 50, Math.PI / 2);
    const o = (51 * image.width + 51) * 4;
    ICE_TINT.forEach((channel, a) =>
      expect(
        Math.abs(image.data[o + a]! - (channel * 128) / 255),
      ).toBeLessThanOrEqual(1),
    );
  });

  it("draws no dark ring at the limb when the map is black past it", () => {
    /* A uniform disc filling the crop, black outside: every covered pixel keeps the centre's colour. */
    const radius = 100;
    const edge = 32 / 1.02;
    const m = map(0, (x, y) =>
      Math.hypot(x + 0.5 - 32, y + 0.5 - 32) < edge ? 200 : undefined,
    );
    const image = paint(m, radius, Math.PI / 2);
    const c = image.width / 2;
    const centre =
      image.data[(Math.floor(c) * image.width + Math.floor(c)) * 4]!;
    let darkest = 255;
    for (let j = 0; j < image.height; j++)
      for (let i = 0; i < image.width; i++) {
        const o = (j * image.width + i) * 4;
        if (image.data[o + 3]! > 0) darkest = Math.min(darkest, image.data[o]!);
      }
    expect(centre - darkest).toBeLessThanOrEqual(1);
  });

  it("leaves the pixels outside the disc clear", () => {
    const image = paint(map(200), 50, 0);
    expect(image.data[3]).toBe(0);
    expect(image.data[image.data.length - 1]).toBe(0);
  });
});

describe("the natural look", () => {
  it("paints the Sun's grey level as neutral white, r = g = b", () => {
    const image = paint(map(200), 50, 0, [255, 255, 255]);
    const o = ((image.height >> 1) * image.width + (image.width >> 1)) * 4;
    const [r, g, b] = image.data.slice(o, o + 3);
    expect(Math.abs(r! - g!)).toBeLessThanOrEqual(1);
    expect(Math.abs(g! - b!)).toBeLessThanOrEqual(1);
    expect(r).toBe(Math.round((255 * 200) / 255));
  });
});

describe("createSunPainter", () => {
  const T = 703_036_800_000;
  const lens = skyLens(1440, 844, { x: 600, y: 400, radius: 300 });
  const drawImage = vi.fn();
  const ctx = { drawImage } as unknown as CanvasRenderingContext2D;

  /** The Sun at the centre of the view at `instantMs`: what the sky hands the painter. */
  function sight(instantMs: number) {
    const sun = sunRaDec(instantMs);
    const rotation: [number, number] = [
      siderealDeg(instantMs) + 180 - sun.ra,
      sun.dec,
    ];
    const m = viewMatrix(rotation, instantMs);
    const disc = bodyOnScreen(
      lens,
      m,
      toUnit(sun.ra, sun.dec),
      SUN_RADIUS,
      1440,
      844,
      0,
    )!;
    return { m, disc, sun };
  }

  beforeEach(() => {
    drawImage.mockClear();
    stubImageCanvas();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("paints once, draws the cached disc again at the same key, and paints once more when the radius changes", () => {
    const spy = vi.fn();
    const painter = createSunPainter(map(200), spy, () => ICE_TINT);
    const { m, disc, sun } = sight(T);
    expect(painter(ctx, lens, m, T, 1, disc, sun)).toBe(true);
    painter(ctx, lens, m, T, 1, disc, sun);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(drawImage).toHaveBeenCalledTimes(2);
    painter(ctx, lens, m, T, 1, { ...disc, r: disc.r * 2 }, sun);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("paints once more when the look changes", () => {
    const spy = vi.fn();
    const painter = createSunPainter(map(200), spy, () =>
      paintLook() === "natural" ? [255, 255, 255] : ICE_TINT,
    );
    const { m, disc, sun } = sight(T);
    try {
      painter(ctx, lens, m, T, 1, disc, sun);
      setLook("natural");
      painter(ctx, lens, m, T, 1, disc, sun);
      painter(ctx, lens, m, T, 1, disc, sun);
      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy.mock.calls[1]![1].tint).toEqual([255, 255, 255]);
    } finally {
      setLook("ice");
    }
  });

  it("hands the painting a finite screen angle for the Sun's pole", () => {
    const seen: number[] = [];
    const painter = createSunPainter(
      map(200),
      (_map, g) => void seen.push(g.angle),
      () => ICE_TINT,
    );
    const { m, disc, sun } = sight(T);
    painter(ctx, lens, m, T, 1, disc, sun);
    expect(Number.isFinite(seen[0])).toBe(true);
    expect(Math.abs(seen[0]!)).toBeLessThanOrEqual(Math.PI);
  });

  it("leaves a disc at the smallest size to the flat Sun", () => {
    const spy = vi.fn();
    const painter = createSunPainter(map(200), spy, () => ICE_TINT);
    const { m, disc, sun } = sight(T);
    expect(painter(ctx, lens, m, T, 1, { ...disc, r: 2.5 }, sun)).toBe(false);
    expect(spy).not.toHaveBeenCalled();
    expect(drawImage).not.toHaveBeenCalled();
  });

  it("leaves the Sun to the flat one when the canvas gives no context", () => {
    vi.restoreAllMocks();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const painter = createSunPainter(map(200), vi.fn(), () => ICE_TINT);
    const { m, disc, sun } = sight(T);
    expect(painter(ctx, lens, m, T, 1, disc, sun)).toBe(false);
  });

  it("repaints only the Moon when only the Moon moves", () => {
    const sunSpy = vi.fn();
    const moonSpy = vi.fn();
    const sunPainter = createSunPainter(map(200), sunSpy, () => ICE_TINT);
    const moonPainter = createMoonPainter(map(120), moonSpy, () => ICE_TINT);
    const moonAt = (instantMs: number) => {
      const { m, moon, disc } = moonSight(lens, instantMs);
      return () =>
        moonPainter(
          ctx,
          lens,
          m,
          instantMs,
          1,
          disc as Disc,
          moon,
          limbOnScreen(lens, m, moon, disc),
          0.04,
        );
    };
    const { m, disc, sun } = sight(T);
    const frame = (moon: () => boolean) => {
      sunPainter(ctx, lens, m, T, 1, disc, sun);
      moon();
    };
    frame(moonAt(T));
    frame(moonAt(T + 6 * 3_600_000));
    expect(sunSpy).toHaveBeenCalledTimes(1);
    expect(moonSpy).toHaveBeenCalledTimes(2);
  });
});
