/**
 * The pinhole camera as a d3 projection, for the canvas-2D fallback.
 *
 * d3 stays the renderer (`geoPath` draws the land, graticule and arcs); the geometry
 * is `../pinhole.ts` expressed in d3's raw form, so both renderers draw through one camera.
 * Lives in this directory so deleting the fallback deletes it too.
 *
 * @internal
 */

import { geoProjection, type GeoProjection } from "d3-geo";
import type { Camera } from "../camera";
import { G, P, RIM } from "../pinhole";

/** The pinhole's raw form: lng/lat in radians after d3's rotation, out in d3's raw units. */
export function pinholeRaw(lambda: number, phi: number): [number, number] {
  const cosPhi = Math.cos(phi);
  const k = (P - 1) / (P - cosPhi * Math.cos(lambda));
  return [k * cosPhi * Math.sin(lambda), k * Math.sin(phi)];
}

/** A d3 projection clipped to the cap the camera can see. */
export function createPinholeProjection(): GeoProjection {
  return geoProjection(pinholeRaw)
    .clipAngle((Math.acos(RIM) * 180) / Math.PI)
    .precision(0.4);
}

/** Aim the projection: rotation, silhouette radius and centre come from the camera. */
export function setProjectionCamera(
  projection: GeoProjection,
  camera: Camera,
): void {
  projection
    .rotate([camera.rotation[0], camera.rotation[1]])
    .scale((camera.radius * G) / (P - 1))
    .translate([camera.centreX, camera.centreY]);
}
