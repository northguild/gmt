/**
 * Camera maths for the globe (#289).
 *
 * Pure, no DOM, no d3. The projection is a pinhole at geostationary distance (`pinhole.ts`),
 * checked from first principles in `camera.test.ts`. The canvas-2D fallback and the GPU path
 * share it, so a tooltip or a hit test lands in the same place under either renderer.
 *
 * ## The frame
 *
 * A geographic point becomes a unit vector, is rotated by the camera, and the result's three axes
 * are read as: `y` right on screen, `z` up on screen, `x` towards the viewer. So a point is on the
 * visible cap exactly when its rotated `x` exceeds `RIM`, and the screen position is one divide by
 * the distance to the camera.
 *
 * `rotation` is `[λ, φ]` in degrees. Both are *negated*: `[-lng, -lat]` brings `(lng, lat)` to the
 * centre. There is no third (roll) component, as the globe never rolls.
 */

import { RIM, projectPoint, rayHit, toView, type Vec3 } from "./pinhole";

const DEG = Math.PI / 180;

/** A point's position on screen, and whether it is on the visible cap. */
interface Projected {
  x: number;
  y: number;
  /** False beyond the visible cap (camera-frame x <= RIM). `x`/`y` are still where the point's
   *  line of sight crosses the image (inside the disc); the caller decides whether to draw it. */
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
  out: Vec3,
): Vec3 {
  return toView(camera, lng, lat, out);
}

const SCRATCH: Vec3 = [0, 0, 0];
const SCRATCH_HIT: Vec3 = [0, 0, 0];

/** Screen position of a geographic point, in CSS pixels within the host box. */
export function project(camera: Camera, lng: number, lat: number): Projected {
  const out = { x: 0, y: 0, visible: false };
  out.visible = projectPoint(camera, toView(camera, lng, lat, SCRATCH), out);
  return out;
}

/**
 * The geographic point under a screen position, or null outside the sphere.
 *
 * The inverse of `project` for the visible cap: intersect the pixel's ray with the
 * sphere (`rayHit`), then undo the two rotations.
 */
export function unproject(
  camera: Camera,
  screenX: number,
  screenY: number,
): [number, number] | null {
  const hit = SCRATCH_HIT;
  if (
    !rayHit(
      (screenX - camera.centreX) / camera.radius,
      (camera.centreY - screenY) / camera.radius,
      hit,
    )
  )
    return null;

  const y2 = hit[1];
  const z2 = hit[2];
  const x2 = hit[0];

  // Undo the latitude rotation (transpose of the rotation above).
  const x1 = x2 * camera.cosPhi + z2 * camera.sinPhi;
  const z1 = z2 * camera.cosPhi - x2 * camera.sinPhi;
  const y1 = y2;

  const lat = Math.asin(Math.min(1, Math.max(-1, z1))) / DEG;
  const lng = Math.atan2(y1, x1) / DEG - camera.rotation[0];
  return [wrapLng(lng), lat];
}

/**
 * Whether a point faces the camera.
 *
 * `project(...).visible` answers the same question; this skips the screen
 * position for callers that only need the cull (the marker loop's early out).
 */
export function isVisible(camera: Camera, lng: number, lat: number): boolean {
  return toView(camera, lng, lat, SCRATCH)[0] > RIM;
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
