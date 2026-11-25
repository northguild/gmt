// @vitest-environment jsdom
import {
  createMoonPainter,
  paintLitSphere,
  discSize,
  type DiscGeometry,
} from "./body-paint";
import { moonSight, stubImageCanvas } from "../test/body-sight";
import type { Vec3 } from "./globe/pinhole";
import { ICE_TINT, type Disc, type MoonPainter } from "./sky-bodies";
import type { SkyMap } from "./sky-map";
import { limbOnScreen, skyLens } from "./sky-math";

const DEG = Math.PI / 180;

/** A `width x height` map with one value in all three channels, `value` where `at` says so, else `base`. */
function map(
  base: number,
  at: (x: number, y: number) => number | undefined = () => undefined,
): SkyMap {
  const width = 64;
  const height = 32;
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      data.fill(at(x, y) ?? base, (y * width + x) * 4, (y * width + x) * 4 + 3);
  return { width, height, data };
}

/** The Moon seen with its north up and the camera straight above its prime meridian, lit from `phase` degrees round to the right. */
function geometry(
  phase: number,
  over: Partial<DiscGeometry> = {},
): DiscGeometry {
  const sun: Vec3 = [Math.sin(phase * DEG), 0, Math.cos(phase * DEG)];
  return {
    radius: 100,
    view: [0, 0, 1],
    right: [1, 0, 0],
    up: [0, 1, 0],
    sun,
    frame: { pole: [0, 1, 0], prime: [0, 0, 1] },
    shine: 0,
    tint: ICE_TINT,
    ...over,
  };
}

function paint(m: SkyMap, g: DiscGeometry): ImageData {
  const size = discSize(g.radius);
  const out = {
    width: size,
    height: size,
    data: new Uint8ClampedArray(size * size * 4),
  } as ImageData;
  paintLitSphere(m, g, out);
  return out;
}

/** Each pixel's distance from the disc's centre in radii, and its alpha, for the pixels the disc covers in full. */
function pixels(image: ImageData, radius: number) {
  const found: { x: number; y: number; rho: number; alpha: number }[] = [];
  for (let j = 0; j < image.height; j++)
    for (let i = 0; i < image.width; i++) {
      const x = i + 0.5 - image.width / 2;
      const y = image.height / 2 - (j + 0.5);
      const rho = Math.hypot(x, y) / radius;
      if (rho <= 1 - 1 / radius)
        found.push({
          x,
          y,
          rho,
          alpha: image.data[(j * image.width + i) * 4 + 3]!,
        });
    }
  return found;
}

/** The sRGB transfer function, linear light to the encoded value, written out from IEC 61966-2-1. */
const srgb = (l: number): number =>
  l <= 0.0031308 ? 12.92 * l : 1.055 * l ** (1 / 2.4) - 0.055;

describe("paintLitSphere", () => {
  it.each([0.05, 0.25, 0.5, 0.75, 0.98])(
    "lights %s of a uniform map",
    (lit) => {
      const phase = Math.acos(2 * lit - 1) / DEG;
      const all = pixels(paint(map(120), geometry(phase)), 100);
      const share = all.filter((p) => p.alpha > 0).length / all.length;
      expect(Math.abs(share - lit)).toBeLessThan(0.03);
    },
  );

  it("puts a bright spot at the sub-observer point at the disc's centre", () => {
    const spot = map(0, (x, y) =>
      (x === 31 || x === 32) && (y === 15 || y === 16) ? 255 : undefined,
    );
    const bright = pixels(paint(spot, geometry(30)), 100).filter(
      (p) => p.alpha > 0,
    );
    expect(bright.length).toBeGreaterThan(20);
    const mean = (key: "x" | "y") =>
      bright.reduce((sum, p) => sum + p[key], 0) / bright.length;
    expect(Math.abs(mean("x"))).toBeLessThan(1);
    expect(Math.abs(mean("y"))).toBeLessThan(1);
  });

  it("puts the north pole on the side the pole angle gives", () => {
    const tilt = 30 * DEG;
    const turn = 40 * DEG;
    const pole: Vec3 = [
      Math.sin(tilt) * Math.sin(turn),
      Math.sin(tilt) * Math.cos(turn),
      Math.cos(tilt),
    ];
    const prime: Vec3 = [
      -pole[0] * pole[2],
      -pole[1] * pole[2],
      1 - pole[2] * pole[2],
    ];
    const length = Math.hypot(...prime);
    const cap = map(0, (_x, y) => (y === 0 ? 255 : undefined));
    const bright = pixels(
      paint(
        cap,
        geometry(0, {
          frame: { pole, prime: prime.map((c) => c / length) as Vec3 },
        }),
      ),
      100,
    ).filter((p) => p.alpha > 0);
    expect(bright.length).toBeGreaterThan(20);
    const x = bright.reduce((sum, p) => sum + p.x, 0) / bright.length;
    const y = bright.reduce((sum, p) => sum + p.y, 0) / bright.length;
    expect(Math.abs(Math.atan2(x, y) / DEG - 40)).toBeLessThan(10);
  });

  it("shows the dark side as its albedo times the earthshine, with `shine` meaning the flat Moon's alpha", () => {
    const shine = 0.08;
    const night = pixels(paint(map(120), geometry(180, { shine })), 100);
    expect(night.length).toBeGreaterThan(0);
    for (const p of night)
      expect(Math.abs(p.alpha - 255 * shine)).toBeLessThanOrEqual(2);
    const spot = map(40, (x, y) => (x < 32 && y < 16 ? 200 : undefined));
    const seen = pixels(paint(spot, geometry(180, { shine })), 100);
    const up = seen.filter((p) => p.x < -20 && p.y > 20 && p.rho < 0.8);
    const down = seen.filter((p) => p.x > 20 && p.y < -20 && p.rho < 0.8);
    expect(up.length).toBeGreaterThan(0);
    expect(down.length).toBeGreaterThan(0);
    expect(up[0]!.alpha).toBeGreaterThan(down[0]!.alpha * 2);
  });

  it("leaves no dark seam at the terminator: no lit pixel within 3 px of it is darker than the night side on its row", () => {
    const image = paint(map(120), geometry(90, { shine: 0.04 }));
    const at = (i: number, j: number) =>
      image.data[(j * image.width + i) * 4 + 3]!;
    const mid = Math.floor(image.height / 2);
    for (const j of [mid - 40, mid, mid + 40]) {
      /* The sun is to the right, so the lit side is x > 0; the terminator is the centre column. */
      const centre = Math.floor(image.width / 2);
      const night = at(centre - 6, j);
      for (let i = centre - 3; i <= centre + 3; i++)
        expect(at(i, j)).toBeGreaterThanOrEqual(night - 1);
    }
  });

  it("keeps a full Moon's tone from clipping: under 1 % of the lit pixels saturate", () => {
    /* Shaped like the real map: mostly mid grey, a darker third (maria), a thin bright tail. */
    const shaped = map(150, (x, y) => {
      const r = (x * 7 + y * 13) % 100;
      return r < 33 ? 70 : r < 99 ? 150 + (r % 20) : 255;
    });
    for (const lit of [0.98, 0.5]) {
      const phase = Math.acos(2 * lit - 1) / DEG;
      const seen = pixels(paint(shaped, geometry(phase)), 100).filter(
        (p) => p.alpha > 0,
      );
      expect(
        seen.filter((p) => p.alpha >= 254).length / seen.length,
      ).toBeLessThan(0.01);
    }
    /* The half Moon is darker than the full one, as the real one is. */
    const mean = (phase: number) => {
      const lit = pixels(paint(shaped, geometry(phase)), 100).filter(
        (p) => p.alpha > 0,
      );
      return lit.reduce((sum, p) => sum + p.alpha, 0) / lit.length;
    };
    expect(mean(90)).toBeLessThan(mean(16));
  });

  it("sets a pixel's alpha to the sRGB encoding of its linear level", () => {
    /* A uniform map's albedo is 1, so a full Moon's level is 1 and a pixel at the quarter's is 2 mu0 / (mu0 + mu). */
    const full = pixels(paint(map(120), geometry(0)), 100);
    for (const p of full)
      expect(Math.abs(p.alpha - 255 * srgb(1))).toBeLessThanOrEqual(1);
    const quarter = pixels(paint(map(120), geometry(90)), 100);
    const lit = quarter.find((p) => p.x > 50 && Math.abs(p.y) < 2)!;
    const mu = Math.sqrt(1 - lit.rho ** 2);
    const mu0 = lit.x / 100;
    expect(
      Math.abs(lit.alpha - 255 * srgb((2 * mu0) / (mu0 + mu))),
    ).toBeLessThanOrEqual(1.5);
  });

  it("leaves the pixels outside the disc clear", () => {
    const image = paint(map(120), geometry(0));
    expect(image.data[3]).toBe(0);
    expect(image.data[(image.width * image.height - 1) * 4 + 3]).toBe(0);
  });
});

describe("createMoonPainter", () => {
  const T = 703_036_800_000;
  const lens = skyLens(1440, 844, { x: 600, y: 400, radius: 300 });
  const drawImage = vi.fn();
  const putImageData = vi.fn();

  /** The Moon at the centre of the view at `instantMs`: what the sky hands the painter. */
  function sight(instantMs: number) {
    const { m, moon, disc } = moonSight(lens, instantMs);
    const ctx = { drawImage } as unknown as CanvasRenderingContext2D;
    const angle = limbOnScreen(lens, m, moon, disc);
    /** Hands `painter` this sight, its disc replaced by `at` when given. */
    const show = (painter: MoonPainter, at: Disc = disc) =>
      painter(ctx, lens, m, instantMs, 1, at, moon, angle, 0.04);
    return { show, disc, moon, angle };
  }

  beforeEach(() => {
    drawImage.mockClear();
    putImageData.mockClear();
    stubImageCanvas(putImageData);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("hands the sphere axes that agree with the screen and the phase", () => {
    const seen: DiscGeometry[] = [];
    const painter = createMoonPainter(map(120), (_map, g) => void seen.push(g));
    const { show, moon, angle } = sight(T);
    expect(show(painter)).toBe(true);
    const { view, right, up, sun } = seen[0]!;
    const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    expect(Math.hypot(...right)).toBeCloseTo(1, 6);
    expect(dot(right, view)).toBeCloseTo(0, 6);
    expect(dot(up, view)).toBeCloseTo(0, 6);
    expect(dot(right, up)).toBeCloseTo(0, 6);
    /* Right, up and toward the camera make a right-handed set. */
    expect(right[1] * up[2] - right[2] * up[1]).toBeCloseTo(view[0], 6);
    expect((1 + dot(sun, view)) / 2).toBeCloseTo(moon.lit, 6);
    expect(Math.atan2(-dot(sun, up), dot(sun, right))).toBeCloseTo(angle, 6);
  });

  it("paints once, draws the cached disc again at the same key, and paints once more on a change", () => {
    const spy = vi.fn();
    const painter = createMoonPainter(map(120), spy);
    const first = sight(T);
    first.show(painter);
    first.show(painter);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(drawImage).toHaveBeenCalledTimes(2);
    const later = sight(T + 6 * 3_600_000);
    later.show(painter);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(drawImage).toHaveBeenCalledTimes(3);
  });

  it("leaves a disc at the smallest size to the flat Moon", () => {
    const spy = vi.fn();
    const painter = createMoonPainter(map(120), spy);
    const { show, disc } = sight(T);
    expect(show(painter, { ...disc, r: 2.5 })).toBe(false);
    expect(spy).not.toHaveBeenCalled();
    expect(drawImage).not.toHaveBeenCalled();
  });

  it("leaves the Moon to the flat one when the canvas gives no context", () => {
    vi.restoreAllMocks();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const painter = createMoonPainter(map(120), vi.fn());
    expect(sight(T).show(painter)).toBe(false);
  });
});
