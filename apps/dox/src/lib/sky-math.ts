/**
 * The sky's geometry: the part of the sky behind the Earth seen through the globe's own pinhole
 * camera (`globe/pinhole.ts`), and which part of the sky that is for a camera and a moment. Pure
 * functions, shared by the page's sky and by the tests.
 */

import {
  EARTH_EQUATORIAL_RADIUS_KM,
  focal,
  P,
  projectDirection,
  rotationMatrix,
  type Lens,
  type Screen,
  type Vec3,
} from "./globe/pinhole";
import { DAY_MS, J2000_JD, subsolarPoint, UNIX_EPOCH_JD } from "./globe/sun";

const RAD = Math.PI / 180;

/** The reference box star dots are sized against: a star's dot scales by the hero's fit to it. */
export const BOX = { width: 2400, height: 1500 };

/**
 * Where the view's centre sits in the hero, as a fraction of its width and height, when the globe
 * has not mounted and so has no Earth to sit behind.
 */
export const SKY_ANCHOR = { x: 0.4, y: 0.6 } as const;

export interface SkyCentre {
  ra: number;
  dec: number;
}

const wrap360 = (degrees: number): number => ((degrees % 360) + 360) % 360;

/** Julian centuries from J2000.0 at a Unix instant in milliseconds. */
const centuries = (instantMs: number): number =>
  (instantMs / DAY_MS + UNIX_EPOCH_JD - J2000_JD) / 36_525;

/**
 * Greenwich mean sidereal time, degrees in [0, 360), at a Unix instant in milliseconds. Meeus,
 * Astronomical Algorithms, 2nd ed., eq. 12.4, with the instant taken as UT and without the cubic
 * term, which adds under 0.001" between 1900 and 2100.
 */
export function siderealDeg(instantMs: number): number {
  const t = centuries(instantMs);
  return wrap360(
    280.46061837 + 13_185_000.770_053_742 * t + 0.000387933 * t * t,
  );
}

/** The sky's turn about the pole for a camera at an instant, degrees: the rotation's `lambda` less the sidereal time. */
export const turnOf = (
  rotation: readonly [number, number],
  instantMs: number,
): number => rotation[0] - siderealDeg(instantMs);

/**
 * The part of the sky behind the Earth for a camera and a moment. `rotation` is the globe's
 * `[λ, φ]`: the camera looks at longitude −λ and latitude −φ, so the point behind the Earth is at
 * longitude 180 − λ and latitude φ. That point's right ascension is the sidereal time there:
 * Greenwich's plus its longitude. The declination stops 1 degree short of each pole, where right
 * ascension means nothing.
 */
export function skyCentre(
  rotation: readonly [number, number],
  instantMs: number,
): SkyCentre {
  return {
    ra: wrap360(180 - turnOf(rotation, instantMs)),
    dec: Math.min(89, Math.max(-89, rotation[1])),
  };
}

/** A position on the celestial sphere, degrees. */
export interface RaDec {
  ra: number;
  dec: number;
}

/** The Sun's geocentric position: overhead at the subsolar point, whose longitude the sidereal time shifts into right ascension. */
export function sunRaDec(instantMs: number): RaDec {
  const { lat, lng } = subsolarPoint(instantMs);
  return { ra: wrap360(siderealDeg(instantMs) + lng), dec: lat };
}

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

/** The Sun's mean angular radius seen from the Earth, degrees. */
export const SUN_RADIUS = 0.267;

/** A unit vector on the celestial sphere, equatorial axes. */
export type Unit = readonly [number, number, number];

/** The unit vector of a position, degrees. */
export function toUnit(ra: number, dec: number): [number, number, number] {
  const cosDec = Math.cos(dec * RAD);
  return [
    cosDec * Math.cos(ra * RAD),
    cosDec * Math.sin(ra * RAD),
    Math.sin(dec * RAD),
  ];
}

/** The astronomical unit in Earth equatorial radii: 149,597,870.7 km (IAU 2012 Resolution B2). */
const AU = 149_597_870.7 / EARTH_EQUATORIAL_RADIUS_KM;

/** The dot product of two directions; a view matrix's first row is its forward axis. */
const dot = (a: ArrayLike<number>, b: Unit): number =>
  a[0]! * b[0] + a[1]! * b[1] + a[2]! * b[2];
/** `a + k b`. */
const plus = (a: Unit, k: number, b: Unit): Vec3 => [
  a[0] + k * b[0],
  a[1] + k * b[1],
  a[2] + k * b[2],
];

/** The Moon seen from the globe's camera: its place, angular radius, phase angle and bright limb, degrees, and its lit fraction. */
export interface CameraMoon {
  ra: number;
  dec: number;
  /** The angular radius. */
  radius: number;
  /** The phase angle: Sun, Moon and camera, at the Moon. */
  phase: number;
  /** The illuminated fraction of the disc, 0 to 1. */
  lit: number;
  /** The bright limb's position angle: from celestial north through east, toward the Sun. */
  limb: number;
}

/**
 * The Moon seen from the globe's camera, `P` Earth radii over the point it looks at (`rotation`
 * `[lambda, phi]` looks at `(-lambda, -phi)`), at an instant. Every vector is equatorial of date,
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
  const camera = toUnit(-turnOf(rotation, instantMs), -rotation[1]);
  const [moon, parallax] = moonGeocentric(instantMs);
  const sun = sunRaDec(instantMs);
  /* The camera's view of the Moon, over its geocentric distance 1 / sin(parallax), and of the Sun, over 1 AU. */
  const near = Math.sin(parallax * RAD);
  const v = plus(moon, -P * near, camera);
  const w = plus(toUnit(sun.ra, sun.dec), -P / AU, camera);
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

/** The smallest a Sun or Moon disc is drawn, in CSS pixels, so it never vanishes. */
export const MIN_BODY = 2.5;

/**
 * The Earth's radius as a share of the hero's short side when the globe failed to mount and so
 * reported none: about what `frameSpace` gives the disc (409 px of 900 at 1440 x 900).
 */
const NO_GLOBE_RADIUS = 0.45;

/**
 * The equatorial-to-camera rotation for a globe rotation `[lambda, phi]` at an instant: 9 numbers,
 * row-major. A direction's geographic longitude is its right ascension minus the sidereal time,
 * so this is the camera's own rotation (`rotationMatrix`, pinhole.ts) turned back by the sidereal
 * time: `toView(trig, ra - gst, dec)` for every direction.
 */
export function viewMatrix(
  rotation: readonly [number, number],
  instantMs: number,
): Float64Array {
  return rotationMatrix(turnOf(rotation, instantMs), rotation[1]);
}

/**
 * `viewMatrix` for a J2000 direction (a star, the Milky Way map), whose axes drift from those of
 * date that the Sun, the Moon and the sidereal time use: IAU 1976 precession (Meeus, Astronomical
 * Algorithms, 2nd ed., eq. 21.2 to 21.4) first, then the view. Precession turns by zeta about the
 * pole, by theta about the new y axis and by z about the pole again; the last turn joins the
 * view's own turn about the pole. Only the angles' first-order terms are kept, zeta = z =
 * 2306.2181" and theta = 2004.3109" a Julian century; the rest add under 2" between 1900 and
 * 2100.
 */
export function starViewMatrix(
  rotation: readonly [number, number],
  instantMs: number,
): Float64Array {
  const t = centuries(instantMs);
  const zeta = 0.640_616_14 * t;
  const a = rotationMatrix(turnOf(rotation, instantMs) + zeta, rotation[1]);
  const b = rotationMatrix(zeta, 0.556_753_03 * t);
  return a.map((_, i) => {
    const row = i - (i % 3);
    const column = i % 3;
    return (
      a[row]! * b[column]! +
      a[row + 1]! * b[column + 3]! +
      a[row + 2]! * b[column + 6]!
    );
  });
}

/**
 * The sky's lens: the globe's own `Lens` (pinhole.ts), the Earth's centre in the hero and its disc
 * radius in CSS pixels, zoom included, so the focal length is `focal(radius)`; and the scale of a
 * star's dot.
 */
export interface SkyLens extends Lens {
  /** The scale of a star's dot: the hero's fit to `BOX`, times the zoom. */
  dots: number;
}

/**
 * The sky's lens for a `width x height` hero: the globe's `centre` and radius, so the sky shares
 * the globe's camera, zoom included. A null centre (the globe never mounted) puts the Earth at
 * `SKY_ANCHOR`, and a missing radius is `NO_GLOBE_RADIUS` of the hero's short side.
 */
export function skyLens(
  width: number,
  height: number,
  centre: { x: number; y: number; radius?: number } | null,
  zoom: number,
): SkyLens {
  const at = centre ?? { x: SKY_ANCHOR.x * width, y: SKY_ANCHOR.y * height };
  return {
    centreX: at.x,
    centreY: at.y,
    radius: at.radius ?? NO_GLOBE_RADIUS * Math.min(width, height),
    dots: Math.max(width / BOX.width, height / BOX.height) * zoom,
  };
}

const direction: Vec3 = [0, 0, 0];

/** A sky direction (equatorial unit) on screen; false, leaving `out`, when it is not in front of the camera. */
export function skyToScreen(
  lens: SkyLens,
  m: Float64Array,
  [x, y, z]: Unit,
  out: Screen,
): boolean {
  for (let i = 0; i < 3; i++)
    direction[i] = m[i * 3]! * x + m[i * 3 + 1]! * y + m[i * 3 + 2]! * z;
  return projectDirection(lens, direction, out);
}

const body: Screen = { x: 0, y: 0 };

/**
 * A body's screen disc, or null outside the field of view: behind the camera, or with its disc
 * and `reach` of its own radii of glare clear of the `width x height` box. The radius is the gnomonic scale
 * across the body at that point, `f tan(a) / cos(theta)`, round: the further stretch along the
 * radius belongs to the flat screen, not to the body.
 */
export function bodyOnScreen(
  lens: SkyLens,
  m: Float64Array,
  unit: Unit,
  angularRadiusDeg: number,
  width: number,
  height: number,
  reach: number,
): { x: number; y: number; r: number } | null {
  if (!skyToScreen(lens, m, unit, body)) return null;
  const cosTheta = -dot(m, unit);
  const r = Math.max(
    MIN_BODY,
    (focal(lens.radius) * Math.tan(angularRadiusDeg * RAD)) / cosTheta,
  );
  const margin = r * (1 + reach);
  if (
    body.x + margin < 0 ||
    body.x - margin > width ||
    body.y + margin < 0 ||
    body.y - margin > height
  )
    return null;
  return { ...body, r };
}

/**
 * The screen direction, radians, of a Moon's bright limb drawn at `at`: a 0.5 degree step from its
 * centre along the limb's position angle, projected. 0 when that step is not in front of the
 * camera.
 */
export function limbOnScreen(
  lens: SkyLens,
  m: Float64Array,
  moon: CameraMoon,
  at: Screen,
): number {
  const chi = moon.limb * RAD;
  return skyToScreen(
    lens,
    m,
    toUnit(
      moon.ra + (0.5 * Math.sin(chi)) / Math.cos(moon.dec * RAD),
      moon.dec + 0.5 * Math.cos(chi),
    ),
    body,
  )
    ? Math.atan2(body.y - at.y, body.x - at.x)
    : 0;
}
