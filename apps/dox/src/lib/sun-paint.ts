/**
 * The Sun, in a lazy chunk that loads with its map (`sky-sun.webp`): a self-lit disc painted from
 * the photograph, turned to the Sun's pole. `paintEmissiveDisc` is pure; the painter shares the
 * Moon's disc cache and screen axes (`body-paint.ts`).
 */
import { sunPole } from "./body-frame";
import { cachedDisc, coverage, dot, screenAxes } from "./body-paint";
import { ICE_TINT, type Rgb, type SunPainter } from "./sky-bodies";
import { sampleMap, type SkyMap } from "./sky-map";
import { MIN_BODY } from "./sky-math";

/** What `paintEmissiveDisc` needs: the disc's radius in device pixels, the screen angle of the Sun's north pole (radians, counter-clockwise from the right), the tint. */
interface EmissiveGeometry {
  radius: number;
  angle: number;
  tint: Rgb;
}

/** The disc image's half side in disc radii (`sky-sun.json`'s `disc.crop`). */
const CROP = 1.02;
/**
 * Paints a self-lit disc into `out` from its image: the map's centre level is the tint at full
 * strength, the rest scales with the image, held to the tint. The image has north up; it is turned
 * so that north points at `angle`. Each pixel's colour is opaque, the edge takes coverage alpha.
 */
export function paintEmissiveDisc(
  map: SkyMap,
  { radius, angle, tint }: EmissiveGeometry,
  out: ImageData,
): void {
  const centre = sampleMap(map, 0.5, 0.5, 0);
  const c = out.width / 2;
  const [cos, sin] = [Math.sin(angle), -Math.cos(angle)];
  for (let j = 0, o = 0; j < out.height; j++) {
    for (let i = 0; i < out.width; i++, o += 4) {
      const x = (i + 0.5 - c) / radius;
      const y = (c - j - 0.5) / radius;
      const level = Math.min(
        1,
        sampleMap(
          map,
          0.5 + (x * cos + y * sin) / (2 * CROP),
          0.5 - (y * cos - x * sin) / (2 * CROP),
          0,
        ) / centre,
      );
      for (let a = 0; a < 3; a++)
        out.data[o + a] = Math.round(tint[a]! * level);
      out.data[o + 3] = Math.round(255 * coverage(radius, x, y));
    }
  }
}

const DEG = 180 / Math.PI;

/** The Sun's painter: the disc turned to its pole's screen angle, repainted when the radius or the angle moves half a unit. */
export function createSunPainter(
  map: SkyMap,
  paint: typeof paintEmissiveDisc = paintEmissiveDisc,
): SunPainter {
  const draw = cachedDisc();
  return (ctx, lens, m, instantMs, dpr, disc, sun) => {
    if (disc.r <= MIN_BODY) return false;
    const axes = screenAxes(lens, m, sun, disc);
    if (!axes) return false;
    const pole = sunPole(instantMs);
    const angle = Math.atan2(dot(pole, axes.up), dot(pole, axes.right));
    const radius = disc.r * dpr;
    return draw(
      ctx,
      disc,
      dpr,
      [radius * 2, angle * DEG * 2].map(Math.round).join(),
      (image) => paint(map, { radius, angle, tint: ICE_TINT }, image),
    );
  };
}
