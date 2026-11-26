/**
 * The planets' places: truncated VSOP87B (Bretagnon and Francou 1988; IMCCE), the series in
 * `src/assets/sky-orbits.json` made by `scripts/prepare-sky-orbits.ts`. Pure; the data is passed
 * in, so the lazy planet chunk and the generator share this code.
 *
 * A series is VSOP87B's own sum, heliocentric spherical coordinates of the J2000 dynamical
 * ecliptic: `L`, `B` and `R` are each a list by power of `t` of flat triplets `[A, B, C, ...]`,
 * summed as `A cos(B + C t)` times `t` to that power, `t` in Julian millennia from J2000.0.
 *
 * `bodyFromCamera` gives a planet as Horizons' astrometric place (QUANTITIES 1): one light-time
 * step, no aberration or nutation, in the J2000 equator, then turned to the equator of date
 * (`precessToDate`) like the Sun and the Moon, and seen from the globe's camera (`cameraAt`). The
 * instant is Unix milliseconds taken as TDB, which UTC trails by under 70 s: under 0.2 px for
 * Mercury, the fastest.
 */
import { DAY_MS, J2000_JD, UNIX_EPOCH_JD } from "./globe/sun";
import type { Vec3 } from "./globe/pinhole";
import type { PlanetId } from "./magnitude";
import { AU, precessToDate, type RaDec, type Unit } from "./sky-math";

/** One coordinate's series: the triplets `[A, B, C, ...]` of each power of `t`, lowest first. */
type Powers = readonly (readonly number[])[];

export interface Series {
  L: Powers;
  B: Powers;
  R: Powers;
}

/** What `sky-orbits.json` holds. */
export interface Orbits {
  /** The years the series is truncated for, Unix milliseconds. */
  span: { from: number; to: number };
  /** The Earth's series: the observer's. */
  earth: Series;
  /** Each planet that reaches the faint limit: its series, brightest magnitude over the span, and measured worst error from the Earth, arcseconds. */
  bodies: Partial<Record<PlanetId, Series & { peak: number; worst: number }>>;
}

/** Light's travel time for one au, in days (IAU 2012 au over the speed of light). */
const LIGHT_DAYS_PER_AU = 149_597_870_700 / 299_792_458 / 86_400;
/** The J2000 mean obliquity, degrees (IAU 1976: 84381.448"). */
const OBLIQUITY = 84_381.448 / 3600;
const RAD = Math.PI / 180;
const MILLENNIUM_DAYS = 365_250;

const sum = (powers: Powers, t: number): number =>
  powers.reduce((total, terms, k) => {
    let part = 0;
    for (let i = 0; i < terms.length; i += 3)
      part += terms[i]! * Math.cos(terms[i + 1]! + terms[i + 2]! * t);
    return total + part * t ** k;
  }, 0);

/** The heliocentric position of a series at `t` Julian millennia from J2000.0: au, equatorial axes of J2000. */
export function vsopPosition(series: Series, t: number): Vec3 {
  const l = sum(series.L, t);
  const b = sum(series.B, t);
  const r = sum(series.R, t);
  const flat = r * Math.cos(b);
  const [x, y, z] = [flat * Math.cos(l), flat * Math.sin(l), r * Math.sin(b)];
  const [c, s] = [Math.cos(OBLIQUITY * RAD), Math.sin(OBLIQUITY * RAD)];
  return [x, y * c - z * s, y * s + z * c];
}

/** A planet from the camera: the direction (unit, equatorial axes of date), its distance from the camera and from the Sun, au, and the phase angle, degrees. */
export interface PlanetView {
  unit: Vec3;
  delta: number;
  r: number;
  phase: number;
}

/** A direction's right ascension (0 to 360) and declination, degrees. */
export const raDecOf = ([x, y, z]: Unit): RaDec => ({
  ra: (Math.atan2(y, x) / RAD + 360) % 360,
  dec: Math.asin(Math.max(-1, Math.min(1, z))) / RAD,
});

const minus = (a: Vec3, b: Vec3): Vec3 => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2],
];

/**
 * A planet as the camera sees it at an instant. `camera` is the camera's offset from the Earth's
 * centre, Earth radii in the equatorial axes of date (`cameraAt`); none is the geocentre. Null
 * when `orbits` holds no series for the planet.
 */
export function bodyFromCamera(
  orbits: Orbits,
  id: PlanetId,
  instantMs: number,
  camera: Vec3 = [0, 0, 0],
): PlanetView | null {
  const series = orbits.bodies[id];
  if (!series) return null;
  const t = (instantMs / DAY_MS + UNIX_EPOCH_JD - J2000_JD) / MILLENNIUM_DAYS;
  const earth = vsopPosition(orbits.earth, t);
  /* One step: the planet where it was when the light left it, `delta` au away at the instant. */
  const now = vsopPosition(series, t);
  const lag =
    (LIGHT_DAYS_PER_AU * Math.hypot(...minus(now, earth))) / MILLENNIUM_DAYS;
  const there = vsopPosition(series, t - lag);
  const over = (v: Vec3): Vec3 => precessToDate(v, instantMs);
  const place = over(there);
  const eye = over(earth).map((c, i) => c + camera[i]! / AU) as Vec3;
  const v = minus(place, eye);
  const delta = Math.hypot(...v);
  const r = Math.hypot(...place);
  /* The phase angle sits at the planet, between the Sun (the origin) and the camera. */
  const cos =
    (place[0] * v[0] + place[1] * v[1] + place[2] * v[2]) / (r * delta);
  return {
    unit: v.map((c) => c / delta) as Vec3,
    delta,
    r,
    phase: Math.acos(Math.min(1, Math.max(-1, cos))) / RAD,
  };
}
