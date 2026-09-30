/**
 * Orthographic camera maths for the globe (#289).
 *
 * Pure, no DOM, no d3 — unit-tested against `d3-geo` itself, which is the
 * reference this has to agree with: the canvas-2D fallback still projects with
 * `geoOrthographic`, so if these two disagree the two renderers disagree.
 *
 * Replacing d3's projection here is what lets the GPU path drop d3 entirely. It
 * is also a small amount of maths: an orthographic projection of a rotated
 * sphere is one rotation and a drop of the depth axis.
 *
 * ## The frame
 *
 * A geographic point becomes a unit vector, is rotated by the camera, and the
 * result's three axes are read as: `y` right on screen, `z` up on screen, `x`
 * towards the viewer. So a point is on the near hemisphere exactly when its
 * rotated `x` is positive, which is the horizon test, and the screen position
 * needs no trigonometry beyond building the vector.
 *
 * `rotation` is `[λ, φ]` in degrees and matches `d3.geoOrthographic().rotate()`:
 * both are *negated* — `[-lng, -lat]` brings `(lng, lat)` to the centre. There
 * is no third (roll) component, as the globe never rolls.
 */

const DEG = Math.PI / 180;

/** A point's position on screen, and whether it faces the viewer. */
export interface Projected {
  x: number;
  y: number;
  /** False on the far hemisphere, where `x`/`y` are still the point's
   *  silhouette position — the caller decides whether to draw it. */
  visible: boolean;
}

/**
 * Everything the projection needs, in one object the caller mutates in place.
 *
 * Deliberately a plain record rather than a class with setters: it is rebuilt or
 * adjusted every frame, it is uploaded to a uniform buffer nearly verbatim, and
 * the per-frame code path should allocate nothing.
 */
export interface Camera {
  /** `[λ, φ]` in degrees, as `.rotate()` takes it. */
  rotation: [number, number];
  /** Sphere radius in CSS pixels — `baseScale * zoom`. */
  radius: number;
  /** Sphere centre in CSS pixels, within the host box. */
  centreX: number;
  centreY: number;
  /* Cached from `rotation`, so the per-point maths is multiply-add only. */
  cosLambda: number;
  sinLambda: number;
  cosPhi: number;
  sinPhi: number;
}

export function createCamera(
  rotation: readonly [number, number] = [0, 0],
): Camera {
  const camera: Camera = {
    rotation: [rotation[0], rotation[1]],
    radius: 1,
    centreX: 0,
    centreY: 0,
    cosLambda: 1,
    sinLambda: 0,
    cosPhi: 1,
    sinPhi: 0,
  };
  syncCamera(camera);
  return camera;
}

/** Recompute the cached trig after `rotation` changes. Cheap; call it freely. */
export function syncCamera(camera: Camera): void {
  const lambda = camera.rotation[0] * DEG;
  const phi = camera.rotation[1] * DEG;
  camera.cosLambda = Math.cos(lambda);
  camera.sinLambda = Math.sin(lambda);
  camera.cosPhi = Math.cos(phi);
  camera.sinPhi = Math.sin(phi);
}

/**
 * The camera-space unit vector for a geographic point, written into `out`.
 *
 * Axes as described in this file's header: `[towardsViewer, screenRight,
 * screenUp]`. Takes an output array because the hot loops (every marker, every
 * hit test) call this per point and must not allocate.
 */
export function rotatePoint(
  camera: Camera,
  lng: number,
  lat: number,
  out: [number, number, number],
): [number, number, number] {
  const lambda = lng * DEG;
  const phi = lat * DEG;
  const cosLat = Math.cos(phi);

  /* Longitude rotation folded into the angle sum, so the point's own sin/cos
     are combined with the camera's cached ones instead of adding the angles and
     calling sin/cos again: cos(a+b) and sin(a+b) by the addition formulae. */
  const cosSum =
    Math.cos(lambda) * camera.cosLambda - Math.sin(lambda) * camera.sinLambda;
  const sinSum =
    Math.sin(lambda) * camera.cosLambda + Math.cos(lambda) * camera.sinLambda;

  const x1 = cosLat * cosSum;
  const y1 = cosLat * sinSum;
  const z1 = Math.sin(phi);

  // Latitude rotation, about the screen-right axis.
  out[0] = x1 * camera.cosPhi - z1 * camera.sinPhi;
  out[1] = y1;
  out[2] = z1 * camera.cosPhi + x1 * camera.sinPhi;
  return out;
}

const SCRATCH: [number, number, number] = [0, 0, 0];

/** Screen position of a geographic point, in CSS pixels within the host box. */
export function project(camera: Camera, lng: number, lat: number): Projected {
  const v = rotatePoint(camera, lng, lat, SCRATCH);
  return {
    x: camera.centreX + camera.radius * v[1],
    // Screen y grows downwards; the camera's up axis does not.
    y: camera.centreY - camera.radius * v[2],
    visible: v[0] > 0,
  };
}

/**
 * The geographic point under a screen position, or null outside the sphere.
 *
 * The inverse of `project` for the near hemisphere: recover the depth axis from
 * the unit-length constraint, then undo the two rotations.
 */
export function unproject(
  camera: Camera,
  screenX: number,
  screenY: number,
): [number, number] | null {
  const u = (screenX - camera.centreX) / camera.radius;
  const v = -(screenY - camera.centreY) / camera.radius;
  const squared = u * u + v * v;
  if (squared > 1) return null;

  const y2 = u;
  const z2 = v;
  const x2 = Math.sqrt(1 - squared);

  // Undo the latitude rotation (transpose of the rotation above).
  const x1 = x2 * camera.cosPhi + z2 * camera.sinPhi;
  const z1 = z2 * camera.cosPhi - x2 * camera.sinPhi;
  const y1 = y2;

  const lat = Math.asin(Math.min(1, Math.max(-1, z1))) / DEG;
  const lng = Math.atan2(y1, x1) / DEG - camera.rotation[0];
  return [wrapLng(lng), lat];
}

/**
 * Whether a point faces the viewer.
 *
 * `project(...).visible` answers the same question; this skips the screen
 * position for callers that only need the cull (the marker loop's early out).
 */
export function isVisible(camera: Camera, lng: number, lat: number): boolean {
  return rotatePoint(camera, lng, lat, SCRATCH)[0] > 0;
}

/** The geographic point at the centre of the visible hemisphere. */
export function cameraCentre(camera: Camera): [number, number] {
  return [wrapLng(-camera.rotation[0]), -camera.rotation[1]];
}

/**
 * Unit vector for a geographic point in the *unrotated* frame.
 *
 * Its dot product with another such vector is the cosine of the angle between
 * the two points, which is how the day/night test avoids a distance call.
 */
export function unitVector(lng: number, lat: number): [number, number, number] {
  const lambda = lng * DEG;
  const phi = lat * DEG;
  const cosLat = Math.cos(phi);
  return [cosLat * Math.cos(lambda), cosLat * Math.sin(lambda), Math.sin(phi)];
}

/** Dot product of two vectors from `unitVector`. */
export function dot3(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** Normalise a longitude into `[-180, 180)`. */
export function wrapLng(lng: number): number {
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}

/** Clamp a latitude to the poles. */
export function clampLat(lat: number): number {
  return Math.min(90, Math.max(-90, lat));
}

/** Signed shortest angular delta from `a` to `b`, in degrees. */
export function shortestAngle(a: number, b: number): number {
  return wrapLng(b - a);
}

/**
 * Sun direction in camera space: `[towardsViewer, screenRight, screenUp]`.
 *
 * The shading needs the sun as a screen-space vector, because it shades by
 * comparing it against each pixel's surface normal, which it derives from the
 * pixel's offset from the sphere's centre. Reusing `rotatePoint` keeps that
 * vector and the marker positions in one frame by construction.
 */
export function sunDirection(
  camera: Camera,
  subsolarLng: number,
  subsolarLat: number,
  out: [number, number, number] = [0, 0, 0],
): [number, number, number] {
  rotatePoint(camera, subsolarLng, subsolarLat, out);
  /* Camera axes to the shading's screen axes: x right, y *down*, z towards the
     viewer. So screenRight stays, screenUp flips sign, and depth moves last. */
  const toViewer = out[0];
  const right = out[1];
  const up = out[2];
  out[0] = right;
  out[1] = -up;
  out[2] = toViewer;
  return out;
}
