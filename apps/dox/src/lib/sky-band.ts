/**
 * The Milky Way on the sky's second canvas: each pixel looked up in the map through the camera,
 * at an eighth of the hero's size (the upscale smooths it).
 */
import { directionAt, type Vec3 } from "./globe/pinhole";
import type { Disc, Rgb } from "./sky-bodies";
import { sampleMap, type SkyMap } from "./sky-map";
import type { SkyLens } from "./sky-math";

/** The band canvas holds this fraction of the hero's size, each way: two looks per map cell at rest. */
export const BAND_SCALE = 0.125;

/** The band is drawn this many times brighter and the canvas dimmed back by the same factor in CSS, so the faint glow has more than a handful of 8-bit steps. */
const BAND_GAIN = 8;

/** The Milky Way's alpha where the map is brightest. */
const BAND_PEAK = 0.09;

const ray: Vec3 = [0, 0, 0];

/**
 * Looks each band pixel up in the Milky Way map: the camera's ray through the pixel's centre,
 * turned into the sky, gives a right ascension and declination, and the map is read there
 * between its four nearest cells. Pixels on the solid Earth's disc or the Moon's are left clear.
 * The loop runs on every frame of a flight (`frame-budget`), so each row turns one ray into the
 * sky, at its left edge, and steps along the row from there. `glow` is the canvas's pixels from the last draw, written again (undefined at first and after a
 * resize); returns them for the next draw.
 */
export function drawBand(
  lens: SkyLens,
  m: Float64Array,
  [radius, moon]: [number, Disc | null],
  [r, g, b]: Rgb,
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  map: SkyMap | undefined,
  glow: ImageData | undefined,
): ImageData | undefined {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!map) return glow;
  const out = (glow ??= ctx.createImageData(canvas.width, canvas.height));
  const earth = radius ** 2;
  const gain = BAND_PEAK * BAND_GAIN;
  for (let j = 0, o = 0; j < out.height; j++) {
    const y = (j + 0.5) / BAND_SCALE;
    directionAt(lens, 0, y, ray);
    /* The camera's rotation is orthonormal, so its transpose turns the ray into the sky. */
    const ax = m[0]! * ray[0] + m[3]! * ray[1] + m[6]! * ray[2];
    const ay = m[1]! * ray[0] + m[4]! * ray[1] + m[7]! * ray[2];
    const az = m[2]! * ray[0] + m[5]! * ray[1] + m[8]! * ray[2];
    for (let i = 0; i < out.width; i++, o += 4) {
      const x = (i + 0.5) / BAND_SCALE;
      let alpha = 0;
      if (
        (x - lens.centreX) ** 2 + (y - lens.centreY) ** 2 >= earth &&
        !(moon && (x - moon.x) ** 2 + (y - moon.y) ** 2 < moon.r ** 2)
      ) {
        /* A pixel's ray (`directionAt`) is affine in the pixel: `x` to the right adds `x` to its
           second part, which the rotation turns into `x` times its second row. */
        const sx = ax + x * m[3]!;
        const sy = ay + x * m[4]!;
        const sz = az + x * m[5]!;
        /* The angle from the pole, `acos(sz / |s|)`, taken without the ray's length: `Math.hypot`
           is several times the cost of a square root, here once a pixel. */
        alpha =
          sampleMap(
            map,
            Math.atan2(sy, sx) / (2 * Math.PI) + 1,
            Math.atan2(Math.sqrt(sx * sx + sy * sy), sz) / Math.PI,
          ) * gain;
      }
      out.data[o] = r;
      out.data[o + 1] = g;
      out.data[o + 2] = b;
      out.data[o + 3] = alpha;
    }
  }
  ctx.putImageData(out, 0, 0);
  return out;
}
