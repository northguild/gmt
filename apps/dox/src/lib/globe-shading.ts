/**
 * Sun-lit shading for the globe (DOX-E1a).
 *
 * Pure math, no DOM — unit-tested directly. Shades every pixel of the sphere
 * from the one number that decides how lit it is: the cosine of the angle
 * between its surface normal and the sun, which is also the sine of the sun's
 * elevation there. Doing it per pixel, rather than by stacking translucent
 * caps, leaves no band edges to see — caps showed as rings on the day side
 * and bunched into stripes near the limb, where they are seen edge-on.
 *
 * The caller renders into a small offscreen buffer and scales it up with
 * smoothing, so the cost stays at a few tens of thousands of pixels a frame.
 */

export type Rgb = readonly [number, number, number];

export interface ShadingInput {
  /** Buffer size, in pixels. */
  width: number;
  height: number;
  /** Sphere centre and radius, in buffer pixels. */
  cx: number;
  cy: number;
  radius: number;
  /**
   * Unit vector towards the sun in view space: x right, y down (screen axes),
   * z towards the viewer.
   */
  sun: readonly [number, number, number];
  day: Rgb;
  night: Rgb;
  /** Wash alpha where the sun is overhead; see `dayFactor`. */
  dayAlpha: number;
  /** Wash alpha once the sun is 18° or more below the horizon. */
  nightAlpha: number;
  /** Alpha of the limb haze at the very edge of the sphere. */
  hazeAlpha: number;
  /**
   * Add an ordered dither before 8-bit rounding, so long faint gradients do
   * not show steps on large screens. Default true; tests turn it off to
   * check exact values.
   */
  dither?: boolean;
}

/** Sine of 18°: astronomical twilight ends when the sun is this far down. */
const TWILIGHT_END = Math.sin((18 * Math.PI) / 180);

/**
 * Sine of 6°: through civil twilight the sky still lights the ground, so
 * daylight fades out over this much sun depression instead of at the horizon.
 */
const CIVIL_TWILIGHT = Math.sin((6 * Math.PI) / 180);

/**
 * sRGB's display gamma. Lambert's law holds in linear light; blending it
 * straight into sRGB darkens the day side far too early and flattens it.
 */
const GAMMA = 2.2;

/**
 * The haze starts this fraction of the radius out from the centre. The real
 * atmosphere is only 1–2% of Earth's radius deep, so this is a thin rim.
 */
const HAZE_START = 0.97;

/**
 * 4×4 Bayer matrix, as offsets in (-0.5, 0.5): added before rounding, it
 * breaks an 8-bit step into a fine fixed pattern instead of a visible edge.
 */
const BAYER_4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(
  (n) => (n + 0.5) / 16 - 0.5,
);

/** Hermite ease from 0 at `edge0` to 1 at `edge1`. */
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
}

/**
 * Night wash strength for a given sine of the sun's elevation: 0 in daylight,
 * easing to 1 across twilight.
 */
export function nightFactor(sunElevationSine: number): number {
  return smoothstep(0, -TWILIGHT_END, sunElevationSine);
}

/**
 * Daylight strength for a given sine of the sun's elevation: Lambert's cosine
 * law, carried a little way into civil twilight, then gamma-encoded so it
 * blends in the same space the screen displays.
 */
export function dayFactor(sunElevationSine: number): number {
  const lit = (sunElevationSine + CIVIL_TWILIGHT) / (1 + CIVIL_TWILIGHT);
  return lit <= 0 ? 0 : lit ** (1 / GAMMA);
}

/**
 * Whether street lights are on for a given sine of the sun's elevation: from
 * civil dusk, when the sun is 6° below the horizon, the same point the day
 * wash above finishes fading out.
 */
export function cityLightsOn(sunElevationSine: number): boolean {
  return sunElevationSine <= -CIVIL_TWILIGHT;
}

/** Limb haze strength at a distance from the centre, as a fraction of the radius. */
export function hazeFactor(distance: number): number {
  return smoothstep(HAZE_START, 1, distance);
}

/**
 * Write RGBA (not premultiplied, as `ImageData` expects) into `pixels`.
 * Layers, bottom to top: the day wash, the limb haze, then the night wash —
 * so the night side darkens the haze too and it only glows where it is lit.
 *
 * Pixels past the limb are shaded as if on it, so smoothing when the buffer
 * is scaled up never pulls in a dark fringe; the caller clips to the sphere.
 */
export function paintShading(
  pixels: Uint8ClampedArray,
  input: ShadingInput,
): void {
  const { width, height, cx, cy, radius, sun, day, night } = input;
  const [sx, sy, sz] = sun;
  const dither = input.dither ?? true;
  for (let y = 0; y < height; y++) {
    const v0 = (y + 0.5 - cy) / radius;
    for (let x = 0; x < width; x++) {
      let u = (x + 0.5 - cx) / radius;
      let v = v0;
      let distance = Math.hypot(u, v);
      if (distance > 1) {
        u /= distance;
        v /= distance;
        distance = 1;
      }
      const nz = Math.sqrt(Math.max(0, 1 - u * u - v * v));
      const elevation = u * sx + v * sy + nz * sz;

      const dayA = input.dayAlpha * dayFactor(elevation);
      // The haze is sunlight scattered by the air, so it fades with the day.
      const hazeA =
        input.hazeAlpha * hazeFactor(distance) * (1 - nightFactor(elevation));
      // Both lit layers are the day colour: stack their alphas.
      const litA = 1 - (1 - dayA) * (1 - hazeA);
      const nightA = input.nightAlpha * nightFactor(elevation);
      const alpha = nightA + litA * (1 - nightA);

      const i = (y * width + x) * 4;
      if (alpha <= 0) {
        pixels[i + 3] = 0;
        continue;
      }
      const litWeight = (litA * (1 - nightA)) / alpha;
      const nightWeight = nightA / alpha;
      const offset = dither ? BAYER_4[(y & 3) * 4 + (x & 3)] : 0;
      pixels[i] = day[0] * litWeight + night[0] * nightWeight + offset;
      pixels[i + 1] = day[1] * litWeight + night[1] * nightWeight + offset;
      pixels[i + 2] = day[2] * litWeight + night[2] * nightWeight + offset;
      pixels[i + 3] = alpha * 255 + offset;
    }
  }
}
