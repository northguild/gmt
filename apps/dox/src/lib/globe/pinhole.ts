/**
 * The globe's one camera: a pinhole at geostationary distance.
 *
 * The camera sits `P` Earth radii from the centre, on the +x axis of the camera frame
 * `[towards the camera, screen right, screen up]`. The focal length is `f = radius * G` with
 * `G = sqrt(P^2 - 1)`, so the Earth's silhouette (a cone of half-angle asin(1/P)) lands at exactly
 * `radius` pixels. No other file may hold these constants: the camera, the shaders, the fallback
 * and the sky all take them from here. Imports nothing, so the sky bundle pays only for what it calls.
 */

/**
 * Geostationary altitude, km. The orbit is defined by ITU Radio Regulations Nos. 1.189-1.190, which
 * give no altitude; the altitude follows from Kepler's third law with GM of the Earth =
 * 3.986004418e14 m^3/s^2 (IERS Conventions 2010, Table 1.1) and a sidereal day of 86 164.0905 s,
 * which gives 35 786.03 km.
 */
const GEOSTATIONARY_ALTITUDE_KM = 35786;
/** Earth's equatorial radius, km (IERS Conventions (2010), Table 1.2, GRS80). */
export const EARTH_EQUATORIAL_RADIUS_KM = 6378.137;
/** Camera distance from the Earth's centre, in Earth radii. */
export const P = 1 + GEOSTATIONARY_ALTITUDE_KM / EARTH_EQUATORIAL_RADIUS_KM;
/** Focal length per pixel of silhouette radius: `f = radius * G` keeps the Earth's disc at `radius`. */
export const G = Math.sqrt(P * P - 1);
/** Camera-frame x of the silhouette; a surface point is on the visible cap when its x exceeds it. */
export const RIM = 1 / P;

const DEG = Math.PI / 180;

/** A vector in the camera frame: `[towards the camera, screen right, screen up]`. */
export type Vec3 = [number, number, number];
/** A position in CSS pixels. */
export interface Screen {
  x: number;
  y: number;
}
/** The cached trigonometry of the camera rotation. */
interface ViewTrig {
  cosLambda: number;
  sinLambda: number;
  cosPhi: number;
  sinPhi: number;
}
/** Where the sphere sits on screen, and the silhouette radius in pixels. */
export interface Lens {
  centreX: number;
  centreY: number;
  radius: number;
}

/** Focal length in pixels for a silhouette radius. */
export function focal(radius: number): number {
  return radius * G;
}

/**
 * The camera-frame unit vector for a geographic point, written into `out`.
 *
 * Takes an output array because the hot loops (every marker, every hit test) call this per point
 * and must not allocate.
 */
export function toView(
  trig: ViewTrig,
  lng: number,
  lat: number,
  out: Vec3,
): Vec3 {
  const lambda = lng * DEG;
  const phi = lat * DEG;
  const cosLat = Math.cos(phi);

  /* Longitude rotation folded into the angle sum, so the point's own sin/cos are combined with the
     camera's cached ones instead of adding the angles and calling sin/cos again. */
  const cosSum =
    Math.cos(lambda) * trig.cosLambda - Math.sin(lambda) * trig.sinLambda;
  const sinSum =
    Math.sin(lambda) * trig.cosLambda + Math.cos(lambda) * trig.sinLambda;

  const x1 = cosLat * cosSum;
  const y1 = cosLat * sinSum;
  const z1 = Math.sin(phi);

  // Latitude rotation, about the screen-right axis.
  out[0] = x1 * trig.cosPhi - z1 * trig.sinPhi;
  out[1] = y1;
  out[2] = z1 * trig.cosPhi + x1 * trig.sinPhi;
  return out;
}

/**
 * The camera rotation `[lambda, phi]`, degrees, as one 3 x 3 matrix, row-major: `toView(trig, lng,
 * lat)` is this matrix times the unit vector of `(lng, lat)`. A turn by `lambda` about the pole,
 * then by `phi` about the screen's horizontal axis, written out so a caller that turns many
 * directions by one rotation (the sky's stars) pays one product each.
 */
export function rotationMatrix(lambda: number, phi: number): Float64Array {
  const [ca, sa, cp, sp] = [
    Math.cos(lambda * DEG),
    Math.sin(lambda * DEG),
    Math.cos(phi * DEG),
    Math.sin(phi * DEG),
  ];
  return new Float64Array([
    ca * cp,
    -sa * cp,
    -sp,
    sa,
    ca,
    0,
    ca * sp,
    -sa * sp,
    cp,
  ]);
}

/**
 * Screen position of a camera-frame point, written into `out` even when the point is hidden (a
 * caller drawing a clipped line needs it). Returns whether the point is on the visible cap.
 */
export function projectPoint(lens: Lens, v: Vec3, out: Screen): boolean {
  const f = focal(lens.radius);
  const w = P - v[0];
  out.x = lens.centreX + (f * v[1]) / w;
  out.y = lens.centreY - (f * v[2]) / w;
  return v[0] > RIM;
}

/**
 * Screen position of a direction at infinity (a star, the Sun) in the camera frame. Returns false
 * and leaves `out` untouched when the direction is not in front of the camera.
 */
export function projectDirection(lens: Lens, d: Vec3, out: Screen): boolean {
  const w = -d[0];
  if (w <= 0) return false;
  const f = focal(lens.radius);
  out.x = lens.centreX + (f * d[1]) / w;
  out.y = lens.centreY - (f * d[2]) / w;
  return true;
}

/**
 * The camera-frame direction at infinity seen at screen position `(x, y)`, the inverse of
 * `projectDirection`, written into `out`. It is not normalised: its length is the distance from
 * the pinhole to the pixel, in pixels.
 */
export function directionAt(lens: Lens, x: number, y: number, out: Vec3): Vec3 {
  out[0] = -focal(lens.radius);
  out[1] = x - lens.centreX;
  out[2] = lens.centreY - y;
  return out;
}

/**
 * The surface point under a pixel offset `(u, v)` in silhouette radii (v up), written into `out`
 * as the hit point, which is also its unit normal. False outside the silhouette.
 */
export function rayHit(u: number, v: number, out: Vec3): boolean {
  const rho2 = u * u + v * v;
  if (rho2 > 1) return false;
  const t = (P - Math.sqrt(1 - rho2)) / (1 + rho2 / (G * G));
  out[0] = P - t;
  out[1] = (t * u) / G;
  out[2] = (t * v) / G;
  return true;
}
