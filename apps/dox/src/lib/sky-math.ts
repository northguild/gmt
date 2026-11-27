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
  RAD,
  rotationMatrix,
  type Lens,
  type Screen,
  type Vec3,
} from "./globe/pinhole";
import { DAY_MS, J2000_JD, subsolarPoint, UNIX_EPOCH_JD } from "./globe/sun";

/**
 * A star's dot scales with the Earth's radius on screen, the camera's own scale, and never with
 * the hero's box: a stacked phone's hero is as tall as the whole page. `DOT_SCALE` is the scale
 * at `DOT_RADIUS`, the disc of the locked 1440 x 900 landing (374.3 px, measured in the page).
 */
const DOT_RADIUS = 374;
export const DOT_SCALE = 0.6;

/**
 * Where the view's centre sits in the hero, as a fraction of its width and height, when the globe
 * has not mounted and so has no Earth to sit behind.
 */
export const SKY_ANCHOR = { x: 0.4, y: 0.6 } as const;

export interface SkyCentre {
  ra: number;
  dec: number;
}

export const wrap360 = (degrees: number): number =>
  ((degrees % 360) + 360) % 360;

/** Julian centuries from J2000.0 at a Unix instant in milliseconds. */
export const centuries = (instantMs: number): number =>
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
export const AU = 149_597_870.7 / EARTH_EQUATORIAL_RADIUS_KM;

/** The dot product of two directions; a view matrix's first row is its forward axis. */
export const dot = (a: ArrayLike<number>, b: Unit): number =>
  a[0]! * b[0] + a[1]! * b[1] + a[2]! * b[2];
/** `a + k b`. */
export const plus = (a: Unit, k: number, b: Unit): Vec3 => [
  a[0] + k * b[0],
  a[1] + k * b[1],
  a[2] + k * b[2],
];

/** The globe's camera in Earth radii, equatorial axes of date: `P` over the point `rotation` looks at, `(-lambda, -phi)`. */
export const cameraAt = (
  rotation: readonly [number, number],
  instantMs: number,
): Vec3 =>
  toUnit(-turnOf(rotation, instantMs), -rotation[1]).map((c) => c * P) as Vec3;

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
 * Algorithms, 2nd ed., eq. 21.2 to 21.4) first, then the view. First-order terms only, zeta = z =
 * 2306.2181" and theta = 2004.3109" a Julian century; the rest add under 2" in 1900 to 2100.
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
 * A J2000 direction in the equatorial axes of date, the axes the Sun, the Moon and the sidereal
 * time use: `starViewMatrix`'s precession, with the view left out.
 */
export function precessToDate(unit: Unit, instantMs: number): Vec3 {
  /* The view turned to zero at this instant leaves the precession alone. */
  const p = starViewMatrix([siderealDeg(instantMs), 0], instantMs);
  return [0, 3, 6].map((r) => dot(p.subarray(r, r + 3), unit)) as Vec3;
}

/** `precessToDate` undone: a direction in the equatorial axes of date, in J2000's. */
export function precessFromDate(unit: Unit, instantMs: number): Vec3 {
  const p = starViewMatrix([siderealDeg(instantMs), 0], instantMs);
  return [0, 1, 2].map(
    (c) => p[c]! * unit[0] + p[c + 3]! * unit[1] + p[c + 6]! * unit[2],
  ) as Vec3;
}

/**
 * The sky's lens: the globe's own `Lens` (pinhole.ts), the Earth's centre in the hero and its disc
 * radius in CSS pixels, zoom included, so the focal length is `focal(radius)`; and the scale of a
 * star's dot.
 */
export interface SkyLens extends Lens {
  /** The scale of a star's dot: the Earth's radius, zoom included, against `DOT_RADIUS`. */
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
): SkyLens {
  const at = centre ?? { x: SKY_ANCHOR.x * width, y: SKY_ANCHOR.y * height };
  const radius = at.radius ?? NO_GLOBE_RADIUS * Math.min(width, height);
  return {
    centreX: at.x,
    centreY: at.y,
    radius,
    dots: (DOT_SCALE * radius) / DOT_RADIUS,
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
