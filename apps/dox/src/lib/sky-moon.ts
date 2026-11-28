/**
 * The Moon's theory and the Moon seen from the globe's camera. Its own module so the page's
 * lazy close-approach chunk (`sky-pass.ts`) is the only code that reaches it from the planets
 * layer; `sky-math.ts` holds the geometry both share.
 */

import { RAD } from "./globe/pinhole";
import {
  AU,
  cameraAt,
  centuries,
  dot,
  plus,
  sunRaDec,
  toUnit,
  wrap360,
  type CameraMoon,
  type RaDec,
  type Unit,
} from "./sky-math";

/**
 * The Moon's mean radius over the Earth's equatorial radius, k = 0.2725076 (IAU 1982,
 * Explanatory Supplement to the Astronomical Almanac).
 */
export const MOON_K = 0.272_507_6;

/**
 * The Moon's geocentric direction, a unit vector in equatorial axes of date, and its horizontal
 * parallax, degrees, from the Astronomical Almanac's low-precision lunar formulae (Section D). The coefficients are those of the Almanac's
 * 1990s editions as transcribed in the MOONPOS routine (Greason and Steele, IDL Astronomy
 * Library). Against JPL Horizons, every 6 hours through 2026 and 2027, the direction is off by
 * 0.1 degree on average and at most 0.37 degree, up to 0.39 degree of right ascension and 0.24
 * degree of declination. The ecliptic position is turned into the equatorial one by the mean
 * obliquity.
 */
function moonGeocentric(instantMs: number): [Unit, number] {
  const t = centuries(instantMs);
  const sin = (a: number, b: number): number => Math.sin((a + b * t) * RAD);
  const cos = (a: number, b: number): number => Math.cos((a + b * t) * RAD);
  const longitude =
    218.32 +
    481_267.883 * t +
    6.29 * sin(134.9, 477_198.85) -
    1.27 * sin(259.2, -413_335.38) +
    0.66 * sin(235.7, 890_534.23) +
    0.21 * sin(269.9, 954_397.7) -
    0.19 * sin(357.5, 35_999.05) -
    0.11 * sin(186.6, 966_404.05);
  const latitude =
    5.13 * sin(93.3, 483_202.03) +
    0.28 * sin(228.2, 960_400.87) -
    0.28 * sin(318.3, 6_003.18) -
    0.17 * sin(217.6, -407_332.2);
  const parallax =
    0.9508 +
    0.0518 * cos(134.9, 477_198.85) +
    0.0095 * cos(259.2, -413_335.38) +
    0.0078 * cos(235.7, 890_534.23) +
    0.0028 * cos(269.9, 954_397.7);
  /* Ecliptic to equatorial: turn about the equinox by the mean obliquity, 23.439 deg - 0.013 deg T. */
  const c = cos(23.439, -0.013);
  const n = sin(23.439, -0.013);
  const [x, y, z] = toUnit(longitude, latitude);
  return [[x, y * c - z * n, y * n + z * c], parallax];
}

/** The Moon's geocentric position and angular radius, degrees: `MOON_K` times the horizontal parallax (`moonGeocentric`). */
export function moonRaDec(instantMs: number): RaDec & { radius: number } {
  const [[x, y, z], parallax] = moonGeocentric(instantMs);
  return {
    ra: wrap360(Math.atan2(y, x) / RAD),
    dec: Math.asin(z) / RAD,
    radius: MOON_K * parallax,
  };
}

/**
 * The Moon seen from the globe's camera (`cameraAt`) at an instant. Every vector is equatorial of date,
 * in Earth radii: the camera turned into right ascension by the sidereal time; the Moon at
 * `1 / sin(parallax)` along `moonRaDec` (Astronomical Almanac, Section D); the Sun at one
 * astronomical unit (IAU 2012 B2) along `sunRaDec`. The place and the radius `asin(k / distance)`
 * are the Moon's from the camera (Meeus, Astronomical Algorithms, 2nd ed., ch. 40); the phase
 * angle, `(1 + cos i) / 2` lit and the limb's position angle are Meeus ch. 48 (eq. 48.1-48.5),
 * the limb written as the Sun's offset along the Moon's east and north. Checked against JPL
 * Horizons, observer at `coord@399` 42,164 km out (QUANTITIES 2, 10, 13, 16, 24).
 */
export function moonFromCamera(
  instantMs: number,
  rotation: readonly [number, number],
): CameraMoon {
  const camera = cameraAt(rotation, instantMs);
  const [moon, parallax] = moonGeocentric(instantMs);
  const sun = sunRaDec(instantMs);
  /* The camera's view of the Moon, over its geocentric distance 1 / sin(parallax), and of the Sun, over 1 AU. */
  const near = Math.sin(parallax * RAD);
  const v = plus(moon, -near, camera);
  const w = plus(toUnit(sun.ra, sun.dec), -1 / AU, camera);
  const far = Math.hypot(...v);
  const ra = Math.atan2(v[1], v[0]) / RAD;
  const dec = Math.asin(v[2] / far) / RAD;
  /* The Sun along the Moon's east and north, and along the line of sight beyond it. */
  const east = dot(w, toUnit(ra + 90, 0));
  const north = dot(w, toUnit(ra, dec + 90));
  /* The phase angle at the Moon, between the Sun and the camera: atan2 of the across and along parts. */
  const phase = Math.atan2(
    AU * near * Math.hypot(east, north),
    far - (AU * near * dot(w, v)) / far,
  );
  return {
    ra: wrap360(ra),
    dec,
    radius: Math.asin((MOON_K * near) / far) / RAD,
    phase: phase / RAD,
    lit: (1 + Math.cos(phase)) / 2,
    limb: wrap360(Math.atan2(east, north) / RAD),
  };
}
