/**
 * Day/night terminator geometry for the globe (DOX-E1a).
 *
 * Pure math, no DOM, no `@northguild/gmt` — unit-tested directly. The globe
 * renders the *night* hemisphere as a translucent overlay: a spherical cap of
 * angular radius 90° centred on the anti-solar point.
 *
 * The subsolar-point formula is the standard low-precision solar position
 * (Astronomical Almanac, "Approximate Solar Coordinates"), accurate to well
 * under a degree — far finer than a terminator drawn a few pixels wide needs.
 */

const RAD = Math.PI / 180;

/** Milliseconds per day. */
const DAY_MS = 86_400_000;
/** Julian date of the Unix epoch (1970-01-01T00:00:00Z). */
const UNIX_EPOCH_JD = 2_440_587.5;
/** Julian date of J2000.0. */
const J2000_JD = 2_451_545.0;

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Longitude/latitude on Earth where the sun is directly overhead, in degrees.
 *
 * @param instantMs milliseconds since the Unix epoch — e.g. `getUnixNow()`, or
 *   `convertUtcToUnix(utc, "milliseconds")`. Deliberately a plain number, not a
 *   `Date`: this file is pure astronomy maths and callers stay on
 *   `@northguild/gmt`.
 */
export function subsolarPoint(instantMs: number): LatLng {
  const julian = instantMs / DAY_MS + UNIX_EPOCH_JD;
  const n = julian - J2000_JD;

  const meanLongitude = (280.46 + 0.985_647_4 * n) % 360;
  const meanAnomaly = ((357.528 + 0.985_600_3 * n) % 360) * RAD;
  const eclipticLongitude =
    (meanLongitude +
      1.915 * Math.sin(meanAnomaly) +
      0.02 * Math.sin(2 * meanAnomaly)) *
    RAD;
  const obliquity = 23.439 * RAD;

  const declination =
    Math.asin(Math.sin(obliquity) * Math.sin(eclipticLongitude)) / RAD;
  const rightAscension =
    Math.atan2(
      Math.cos(obliquity) * Math.sin(eclipticLongitude),
      Math.cos(eclipticLongitude),
    ) / RAD;

  const gmst = (280.147 + 360.985_623_5 * n) % 360;

  return { lat: declination, lng: wrapLongitude(rightAscension - gmst) };
}

/** The anti-solar point — centre of the night hemisphere. */
export function antisolarPoint(instantMs: number): LatLng {
  const sun = subsolarPoint(instantMs);
  return { lat: -sun.lat, lng: wrapLongitude(sun.lng + 180) };
}

/** Normalise a longitude to the half-open interval [-180, 180). */
export function wrapLongitude(lng: number): number {
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}
