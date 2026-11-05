/**
 * The sky's geometry: the stereographic projection of the part of the sky behind the Earth, the
 * IAU galactic system, and which part of the sky that is for a camera and a moment. Pure
 * functions, shared by the page's sky and by the tests.
 *
 * The galactic system is the one published with the Hipparcos catalogue in its ICRS form
 * (ESA 1997, The Hipparcos and Tycho Catalogues, Vol. 1 §1.5.3): the north galactic pole and the
 * galactic longitude of the north celestial pole below define it completely.
 */

import { DAY_MS, J2000_JD, subsolarPoint, UNIX_EPOCH_JD } from "./globe/sun";

const RAD = Math.PI / 180;

/** Right ascension of the north galactic pole, degrees (ESA 1997, Vol. 1 §1.5.3). */
export const NGP_RA = 192.85948;

/** Declination of the north galactic pole, degrees (ESA 1997, Vol. 1 §1.5.3). */
export const NGP_DEC = 27.12825;

/** Galactic longitude of the north celestial pole, degrees (ESA 1997, Vol. 1 §1.5.3). */
export const NCP_LONGITUDE = 122.93192;

/** The working box, in the units the projection is drawn in. */
export const BOX = { width: 2400, height: 1500 };

/** Half the box's width spans this many degrees of sky along the centre line. */
export const HALF_WIDTH_DEGREES = 70;

/** Box units per unit of the stereographic plane: 1200 / (2 tan 35 deg). */
export const SCALE =
  BOX.width / 2 / (2 * Math.tan((HALF_WIDTH_DEGREES / 2) * RAD));

/**
 * Points farther than this from the view's centre are not drawn, degrees. Every corner of a hero
 * from 390 to 2560 px wide lies within 106 degrees of the centre, with the Earth anywhere from a
 * fifth to four fifths of the way across; the rest is margin for a star's own radius.
 */
export const MAX_ANGLE = 120;

const MIN_COS = Math.cos(MAX_ANGLE * RAD);

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

/**
 * Greenwich mean sidereal time, degrees in [0, 360), at a Unix instant in milliseconds. Meeus,
 * Astronomical Algorithms, 2nd ed., eq. 12.4, with the instant taken as UT.
 */
export function siderealDeg(instantMs: number): number {
  const days = instantMs / DAY_MS + UNIX_EPOCH_JD - J2000_JD;
  const t = days / 36_525;
  return wrap360(
    280.46061837 +
      360.98564736629 * days +
      0.000387933 * t * t -
      (t * t * t) / 38_710_000,
  );
}

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
    ra: wrap360(siderealDeg(instantMs) + 180 - rotation[0]),
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

/** The mean obliquity of the ecliptic, degrees, `T` centuries from J2000.0 (23.439 deg - 0.013 deg T). */
const obliquityDeg = (t: number): number => 23.439 - 0.013 * t;

/**
 * The Moon's geocentric position and angular radius, degrees, from the Astronomical Almanac's
 * low-precision lunar formulae (Section D). The coefficients are those of the Almanac's
 * 1990s editions as transcribed in the MOONPOS routine (Greason and Steele, IDL Astronomy
 * Library); they are good to about 0.3 degree of right ascension and 0.2 degree of declination
 * between 1900 and 2100. The ecliptic position is turned into the equatorial one by the mean
 * obliquity. The radius is the Moon's mean-to-Earth radius ratio, k = 0.2725076 (IAU 1982,
 * Explanatory Supplement to the Astronomical Almanac), times the horizontal parallax.
 */
export function moonRaDec(instantMs: number): RaDec & { radius: number } {
  const t = (instantMs / DAY_MS + UNIX_EPOCH_JD - J2000_JD) / 36_525;
  const sin = (a: number, b: number): number => Math.sin((a + b * t) * RAD);
  const cos = (a: number, b: number): number => Math.cos((a + b * t) * RAD);
  const longitude =
    (218.32 +
      481_267.883 * t +
      6.29 * sin(134.9, 477_198.85) -
      1.27 * sin(259.2, -413_335.38) +
      0.66 * sin(235.7, 890_534.23) +
      0.21 * sin(269.9, 954_397.7) -
      0.19 * sin(357.5, 35_999.05) -
      0.11 * sin(186.6, 966_404.05)) *
    RAD;
  const latitude =
    (5.13 * sin(93.3, 483_202.03) +
      0.28 * sin(228.2, 960_400.87) -
      0.28 * sin(318.3, 6_003.18) -
      0.17 * sin(217.6, -407_332.2)) *
    RAD;
  const parallax =
    0.9508 +
    0.0518 * cos(134.9, 477_198.85) +
    0.0095 * cos(259.2, -413_335.38) +
    0.0078 * cos(235.7, 890_534.23) +
    0.0028 * cos(269.9, 954_397.7);
  const tilt = obliquityDeg(t) * RAD;
  const x = Math.cos(latitude) * Math.cos(longitude);
  const y = Math.cos(latitude) * Math.sin(longitude);
  const z = Math.sin(latitude);
  return {
    ra: wrap360(Math.atan2(y * Math.cos(tilt) - z * Math.sin(tilt), x) / RAD),
    dec: Math.asin(y * Math.sin(tilt) + z * Math.cos(tilt)) / RAD,
    radius: 0.272_507_6 * parallax,
  };
}

/** The Sun's mean angular radius seen from the Earth, degrees. */
export const SUN_RADIUS = 0.267;

/**
 * The Moon's lit fraction, `(1 + cos i) / 2` with the phase angle `i = 180 - elongation`, seen
 * from the Earth's centre, and the position angle of its bright limb: degrees from celestial
 * north through east, toward the Sun along the great circle from the Moon (Meeus, Astronomical
 * Algorithms, 2nd ed., eq. 48.5).
 */
export function moonPhase(
  sun: RaDec,
  moon: RaDec,
): { lit: number; limb: number } {
  const [sx, sy, sz] = toUnit(sun.ra, sun.dec);
  const [mx, my, mz] = toUnit(moon.ra, moon.dec);
  const cosElongation = sx * mx + sy * my + sz * mz;
  const d0 = sun.dec * RAD;
  const d = moon.dec * RAD;
  const da = (sun.ra - moon.ra) * RAD;
  return {
    lit: (1 - cosElongation) / 2,
    limb: wrap360(
      Math.atan2(
        Math.cos(d0) * Math.sin(da),
        Math.sin(d0) * Math.cos(d) - Math.cos(d0) * Math.sin(d) * Math.cos(da),
      ) / RAD,
    ),
  };
}

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

/** The view's axes: toward its centre, toward east and toward north. */
export interface SkyBasis {
  centre: Unit;
  east: Unit;
  north: Unit;
}

export function skyBasis({ ra, dec }: SkyCentre): SkyBasis {
  const a = ra * RAD;
  const d = dec * RAD;
  return {
    centre: [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)],
    east: [-Math.sin(a), Math.cos(a), 0],
    north: [
      -Math.sin(d) * Math.cos(a),
      -Math.sin(d) * Math.sin(a),
      Math.cos(d),
    ],
  };
}

/**
 * Stereographic projection of a unit vector, north up and east to the left as the sky looks from
 * the ground. Writes box units into `out` and returns true; returns false for a point more than
 * `MAX_ANGLE` from the centre, where the projection runs off.
 */
export function projectUnit(
  basis: SkyBasis,
  [x, y, z]: Unit,
  out: { x: number; y: number },
): boolean {
  const { centre, east, north } = basis;
  const cosAngle = x * centre[0] + y * centre[1] + z * centre[2];
  if (cosAngle < MIN_COS) return false;
  const k = SCALE * (2 / (1 + cosAngle));
  out.x = BOX.width / 2 - k * (x * east[0] + y * east[1] + z * east[2]);
  out.y = BOX.height / 2 - k * (x * north[0] + y * north[1] + z * north[2]);
  return true;
}

/**
 * The size in box units of an angular radius, degrees, at a point of the sky: the projection
 * stretches by `2 / (1 + cos)` of the angle from the view's centre, as it does a star's position.
 */
export function angularRadius(
  basis: SkyBasis,
  [x, y, z]: Unit,
  degrees: number,
): number {
  const { centre } = basis;
  const cosAngle = x * centre[0] + y * centre[1] + z * centre[2];
  return degrees * RAD * SCALE * (2 / (1 + cosAngle));
}

/**
 * The projection of one position, degrees, in box units, or `null` past `MAX_ANGLE` from the
 * centre.
 */
export function project(
  ra: number,
  dec: number,
  centre: SkyCentre,
): { x: number; y: number } | null {
  const out = { x: 0, y: 0 };
  return projectUnit(skyBasis(centre), toUnit(ra, dec), out) ? out : null;
}

/** Whether a projected point lies in the box, allowing `margin` units beyond each edge. */
export function inBox(
  point: { x: number; y: number } | null,
  margin = 0,
): boolean {
  return (
    point !== null &&
    point.x >= -margin &&
    point.x <= BOX.width + margin &&
    point.y >= -margin &&
    point.y <= BOX.height + margin
  );
}

/**
 * The box laid over a hero the way `object-fit: cover` lays an image, with the view's centre at
 * `centre` (the Earth's centre, in the hero's pixels): the scale, and where the box's centre lands.
 */
export function coverFit(
  width: number,
  height: number,
  centre: { x: number; y: number },
): { scale: number; originX: number; originY: number } {
  return {
    scale: Math.max(width / BOX.width, height / BOX.height),
    originX: centre.x,
    originY: centre.y,
  };
}

/** Galactic longitude and latitude, degrees, of an equatorial position (J2000, degrees). */
export function toGalactic(ra: number, dec: number): { l: number; b: number } {
  const a = (ra - NGP_RA) * RAD;
  const d = dec * RAD;
  const dg = NGP_DEC * RAD;
  const sinB =
    Math.sin(d) * Math.sin(dg) + Math.cos(d) * Math.cos(dg) * Math.cos(a);
  const l =
    NCP_LONGITUDE * RAD -
    Math.atan2(
      Math.cos(d) * Math.sin(a),
      Math.sin(d) * Math.cos(dg) - Math.cos(d) * Math.sin(dg) * Math.cos(a),
    );
  return {
    l: (((l / RAD) % 360) + 360) % 360,
    b: Math.asin(Math.max(-1, Math.min(1, sinB))) / RAD,
  };
}

/** The equatorial position, degrees, of a galactic longitude and latitude: the inverse of `toGalactic`. */
export function fromGalactic(
  l: number,
  b: number,
): { ra: number; dec: number } {
  const lat = b * RAD;
  const dl = (NCP_LONGITUDE - l) * RAD;
  const dg = NGP_DEC * RAD;
  const sinDec =
    Math.sin(lat) * Math.sin(dg) + Math.cos(lat) * Math.cos(dg) * Math.cos(dl);
  const ra =
    NGP_RA * RAD +
    Math.atan2(
      Math.cos(lat) * Math.sin(dl),
      Math.sin(lat) * Math.cos(dg) -
        Math.cos(lat) * Math.sin(dg) * Math.cos(dl),
    );
  return {
    ra: (((ra / RAD) % 360) + 360) % 360,
    dec: Math.asin(Math.max(-1, Math.min(1, sinDec))) / RAD,
  };
}
