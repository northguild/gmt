/**
 * The Sun, in a lazy chunk that loads with its map (`sky-sun.webp`): a self-lit disc painted from
 * the photograph, turned to the Sun's pole. `paintEmissiveDisc` is pure; the painter shares the
 * Moon's disc cache and screen axes (`body-paint.ts`).
 */
import { bodyPole } from "./body-frame";
import { SUN_ROTATION } from "./body-rotation";
import { cachedDisc, coverage, screenAxes } from "./body-paint";
import { RAD } from "./globe/pinhole";
import type { Rgb, SunPainter } from "./sky-bodies";
import { sampleMap, type SkyMap } from "./sky-map";
import { dot, MIN_BODY } from "./sky-math";

/** What `paintEmissiveDisc` needs: the disc's radius in device pixels, the screen angle of the Sun's north pole (radians, counter-clockwise from the right), the tint. */
interface EmissiveGeometry {
  radius: number;
  angle: number;
  tint: Rgb;
}

/** The disc image's half side in disc radii (`sky-sun.json`'s `disc.crop`). */
const CROP = 1.02;
/**
 * Paints a self-lit disc into `out` from its image: a map byte over 255 is the share of the tint
 * (the map's white is 255, so nothing clips). The image has north up; it is turned so that north
 * points at `angle`. Each pixel's colour is opaque, the edge takes coverage alpha. Reads stay two
 * map pixels inside the limb, where the map is black past it: a read across the limb would
 * draw a dark ring under the glare.
 */
export function paintEmissiveDisc(
  map: SkyMap,
  { radius, angle, tint }: EmissiveGeometry,
  out: ImageData,
): void {
  const c = out.width / 2;
  const inner = 1 - (4 * CROP) / map.width;
  const [cos, sin] = [Math.sin(angle), -Math.cos(angle)];
  for (let j = 0, o = 0; j < out.height; j++) {
    for (let i = 0; i < out.width; i++, o += 4) {
      const x = (i + 0.5 - c) / radius;
      const y = (c - j - 0.5) / radius;
      const rho = Math.hypot(x, y);
      const hold = rho > inner ? inner / rho : 1;
      const [u, v] = [x * hold, y * hold];
      const level =
        sampleMap(
          map,
          0.5 + (u * cos + v * sin) / (2 * CROP),
          0.5 - (v * cos - u * sin) / (2 * CROP),
          0,
        ) / 255;
      for (let a = 0; a < 3; a++)
        out.data[o + a] = Math.round(tint[a]! * level);
      out.data[o + 3] = Math.round(255 * coverage(radius, x, y));
    }
  }
}

/** The Sun's painter: the disc turned to its pole's screen angle, repainted when the radius or the angle moves half a unit or the look changes. */
export function createSunPainter(
  map: SkyMap,
  paint: typeof paintEmissiveDisc = paintEmissiveDisc,
  /** The tint to paint now. Read on every call, so a look change repaints. */
  tintOf: () => Rgb,
): SunPainter {
  const draw = cachedDisc();
  return (ctx, lens, m, instantMs, dpr, disc, sun) => {
    if (disc.r <= MIN_BODY) return false;
    const axes = screenAxes(lens, m, sun, disc);
    if (!axes) return false;
    const pole = bodyPole(SUN_ROTATION, instantMs);
    const angle = Math.atan2(dot(pole, axes.up), dot(pole, axes.right));
    const radius = disc.r * dpr;
    const tint = tintOf();
    return draw(
      ctx,
      disc,
      dpr,
      `${tint}${[radius * 2, (angle / RAD) * 2].map(Math.round).join()}`,
      (image) => paint(map, { radius, angle, tint }, image),
    );
  };
}
