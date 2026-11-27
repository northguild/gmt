/**
 * The textured Moon, in a lazy chunk that loads with its map (`sky-moon.webp`): a lit sphere painted
 * from an equirectangular map. `paintLitSphere` is pure; the painter caches the disc in an offscreen
 * canvas and repaints it only when it looks different. The Sun's painter (`sun-paint.ts`) shares the
 * disc cache, the screen axes and the edge coverage from here.
 */
import { bodyFrame, cross, surfaceAt, type BodyFrame } from "./body-frame";
import { MOON_ROTATION } from "./body-rotation";
import { RAD, type Screen, type Vec3 } from "./globe/pinhole";
import type { Disc, MoonPainter, Rgb } from "./sky-bodies";
import { sampleMap, type SkyMap } from "./sky-map";
import {
  dot,
  MIN_BODY,
  skyToScreen,
  toUnit,
  type RaDec,
  type SkyLens,
} from "./sky-math";

/** Everything `paintLitSphere` needs, in the one set of axes (the equatorial axes of date). */
export interface DiscGeometry {
  /** The disc's radius, device pixels; the image is `discSize(radius)` square with the disc centred. */
  radius: number;
  /** The unit vector from the body toward the camera, and the screen's right and up at the body. */
  view: Vec3;
  right: Vec3;
  up: Vec3;
  /** The unit vector from the body toward the Sun. */
  sun: Vec3;
  frame: BodyFrame;
  /** The night side's strength: its albedo times this. */
  shine: number;
  /** The `ice` look tints the map's brightness to this; `null` is the `natural` look, the map's own colour. */
  tint: Rgb | null;
}

/** The image's side, in pixels, for a disc of this radius: the disc and a pixel of edge each side. */
export const discSize = (radius: number): number => Math.ceil(2 * radius) + 2;

/** An sRGB-encoded value (0 to 1) as linear light: the inverse of `encode`. */
const decode = (c: number): number =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;

/** sRGB bytes to linear light. `@__PURE__` lets the Sun's chunk, which never reads it, drop it. */
const LINEAR = /* @__PURE__ */ Array.from({ length: 256 }, (_, i) =>
  decode(i / 255),
);

/** The brightest tone of each map, found once: the map's luminance is taken relative to it. */
const whites = new WeakMap<SkyMap, number>();

/** The share of a map's pixels that may be brighter than its white. */
const WHITE_SHARE = 0.001;
/** Bins of the luminance histogram the white is read from. */
const BINS = 1024;

/** Linear light to the sRGB transfer function's encoded value, the units a canvas composites in. */
const encode = (l: number): number =>
  l <= 0.003_130_8 ? 12.92 * l : 1.055 * l ** (1 / 2.4) - 0.055;

/** Rec. 709 luminance of three sRGB bytes, linear. */
const luminance = (r: number, g: number, b: number): number =>
  0.2126 * LINEAR[Math.round(r)]! +
  0.7152 * LINEAR[Math.round(g)]! +
  0.0722 * LINEAR[Math.round(b)]!;

function whiteOf(map: SkyMap): number {
  let white = whites.get(map);
  if (white === undefined) {
    const { data } = map;
    const count = new Uint32Array(BINS);
    for (let i = 0; i < data.length; i += 4)
      count[
        Math.min(
          BINS - 1,
          Math.floor(luminance(data[i]!, data[i + 1]!, data[i + 2]!) * BINS),
        )
      ]!++;
    let above = (data.length / 4) * WHITE_SHARE;
    let bin = BINS;
    while (bin > 1 && above >= 0) above -= count[--bin]!;
    whites.set(map, (white = (bin + 0.5) / BINS));
  }
  return white;
}

/** The share of a pixel at (x, y) disc radii from the centre that the disc covers. */
export const coverage = (radius: number, x: number, y: number): number =>
  Math.min(1, Math.max(0, radius * (1 - Math.hypot(x, y)) + 0.5));

/**
 * Paints a sphere into `out`, lit from `sun` and seen from `view`. Each pixel's surface normal is
 * the orthographic disc's (the Moon spans under 0.3 degree); its place on the map comes from the
 * body's frame. A lit pixel is the albedo times the Lommel-Seeliger factor `2 mu0 / (mu0 + mu)`,
 * the regolith's law, which is 1 everywhere at a full Moon. Earthshine is added to every pixel: the
 * albedo times the linear light of `shine`, which is the flat Moon's alpha, an encoded value, so a
 * white night pixel's alpha comes back as `shine`. Albedo is the map's luminance over the map's white (its 99.9th percentile), so the
 * brightest ground of a full Moon is at most 1 and the half Moon is darker, as the real one is.
 * The level is linear light; its sRGB encoding is the pixel's alpha, over the tint, since a canvas
 * composites encoded values. The edge takes coverage alpha. In the `natural` look each map channel
 * (as linear light, over the same white) is lit the same way and the pixel is opaque colour, its
 * alpha the coverage alone.
 */
export function paintLitSphere(
  map: SkyMap,
  g: DiscGeometry,
  out: ImageData,
): void {
  const { radius, view, right, up, sun, frame, shine, tint } = g;
  const centre = out.width / 2;
  const white = whiteOf(map);
  /* `shine` is the flat Moon's earthshine alpha, an encoded value; the sphere adds its linear light. */
  const earthshine = decode(shine);
  const n: Vec3 = [0, 0, 0];
  for (let j = 0, o = 0; j < out.height; j++) {
    for (let i = 0; i < out.width; i++, o += 4) {
      const x = (i + 0.5 - centre) / radius;
      const y = (j + 0.5 - centre) / radius;
      const rho = Math.hypot(x, y);
      const cover = coverage(radius, x, y);
      if (cover === 0) continue;
      const k = rho > 1 ? 1 / rho : 1;
      const z = Math.sqrt(Math.max(0, 1 - (x * k) ** 2 - (y * k) ** 2));
      for (let a = 0; a < 3; a++)
        n[a] = x * k * right[a]! - y * k * up[a]! + z * view[a]!;
      const [lon, lat] = surfaceAt(frame, n);
      const u = 0.5 + lon / (2 * Math.PI);
      const v = 0.5 - lat / Math.PI;
      const lit = dot(n, sun);
      /* Earthshine lights the whole Earth-facing disc, so the lit side has it too and no seam shows at the terminator. */
      const shade =
        ((lit > 0 ? (2 * lit) / (lit + z) : 0) + earthshine) / white;
      const [r, g, b] = ([0, 1, 2] as const).map((a) =>
        sampleMap(map, u, v, a),
      ) as Vec3;
      for (const [a, c] of [r, g, b].entries())
        out.data[o + a] = tint
          ? tint[a]!
          : 255 * encode(shade * LINEAR[Math.round(c)]!);
      out.data[o + 3] = Math.round(
        255 *
          cover *
          (tint ? encode(Math.min(1, shade * luminance(r, g, b))) : 1),
      );
    }
  }
}

const step: Screen = { x: 0, y: 0 };

/**
 * A disc kept in an offscreen canvas: `paint` fills it only when `key` is new, and it is drawn at the
 * disc's place again either way. False when there is no 2D context.
 */
export function cachedDisc(): (
  ctx: CanvasRenderingContext2D,
  disc: Disc,
  dpr: number,
  key: string,
  paint: (image: ImageData) => void,
) => boolean {
  const canvas = document.createElement("canvas");
  let last = "";
  return (ctx, disc, dpr, key, paint) => {
    const size = discSize(disc.r * dpr);
    if (key !== last) {
      canvas.width = canvas.height = size;
      const target = canvas.getContext("2d");
      if (!target) return false;
      const image = target.createImageData(size, size);
      paint(image);
      target.putImageData(image, 0, 0);
      last = key;
    }
    ctx.drawImage(
      canvas,
      disc.x - size / 2 / dpr,
      disc.y - size / 2 / dpr,
      size / dpr,
      size / dpr,
    );
    return true;
  };
}

/**
 * The unit vector from a body toward the camera and the screen's right and up at the body, in the
 * equatorial axes of date, from where a half-degree step north and east of it lands on screen.
 */
export function screenAxes(
  lens: SkyLens,
  m: Float64Array,
  body: RaDec,
  disc: Disc,
): { view: Vec3; right: Vec3; up: Vec3 } | null {
  const around = (toRa: number, toDec: number): [number, number] | null =>
    skyToScreen(lens, m, toUnit(body.ra + toRa, body.dec + toDec), step)
      ? [step.x - disc.x, step.y - disc.y]
      : null;
  const north = around(0, 0.5);
  const east = around(0.5 / Math.cos(body.dec * RAD), 0);
  if (!north || !east) return null;
  const view = toUnit(body.ra + 180, -body.dec);
  const toN = Math.hypot(...north);
  const toE = Math.hypot(...east);
  const eN = toUnit(body.ra, body.dec + 90);
  const eE = toUnit(body.ra + 90, 0);
  /* (north, east) on screen are orthonormal axes there: the right axis is their transpose applied to the screen's x. */
  const lean = [0, 1, 2].map(
    (a) => (north[0] / toN) * eN[a]! + (east[0] / toE) * eE[a]!,
  );
  const right = lean.map((c) => c / Math.hypot(...lean)) as Vec3;
  return { view, right, up: cross(view, right) };
}

/**
 * The painter for a map: it works out the disc's axes from the camera, and paints into an
 * offscreen canvas only when the disc has changed by half a device pixel of radius, half a degree
 * of Sun direction or pole angle, or a quarter degree of sub-observer point; otherwise it draws
 * the cached disc again. A disc at the smallest size is left to the flat Moon.
 */
export function createMoonPainter(
  map: SkyMap,
  paint: typeof paintLitSphere = paintLitSphere,
  /** The tint to paint now: `null` is the natural look. Read on every call, so a look change repaints. */
  tintOf: () => Rgb | null,
): MoonPainter {
  const draw = cachedDisc();
  return (ctx, lens, m, instantMs, dpr, disc, moon, angle, shine) => {
    if (disc.r <= MIN_BODY) return false;
    const axes = screenAxes(lens, m, moon, disc);
    if (!axes) return false;
    const { view, right, up: upward } = axes;
    const psi = moon.phase * RAD;
    const sun = [0, 1, 2].map(
      (a) =>
        Math.cos(psi) * view[a]! +
        Math.sin(psi) *
          (Math.cos(angle) * right[a]! - Math.sin(angle) * upward[a]!),
    ) as Vec3;
    const frame = bodyFrame(MOON_ROTATION, instantMs);
    const [lon, lat] = surfaceAt(frame, view);
    const poleAngle = Math.atan2(
      dot(frame.pole, upward),
      dot(frame.pole, right),
    );
    const radius = disc.r * dpr;
    const tint = tintOf();
    const next = [
      radius * 2,
      moon.phase * 2,
      (angle / RAD) * 2,
      (lon / RAD) * 4,
      (lat / RAD) * 4,
      (poleAngle / RAD) * 2,
    ]
      .map(Math.round)
      .join(String(tint));
    return draw(ctx, disc, dpr, next, (image) =>
      paint(
        map,
        {
          radius,
          view,
          right,
          up: upward,
          sun,
          frame,
          shine,
          tint,
        },
        image,
      ),
    );
  };
}
