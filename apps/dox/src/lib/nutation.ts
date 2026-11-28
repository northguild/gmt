/**
 * The camera as the true equator of date puts it. The sky's axes and its sidereal time are the mean ones
 * (`sky-math.ts`: Meeus, Astronomical Algorithms, 2nd ed., eq. 12.4), and a point fixed to the
 * Earth sits in the true ones: the pole is tilted by the nutation (up to 17 arcseconds), and the
 * sidereal time is the mean one plus the equation of the equinoxes, `dpsi cos(eps)`. Seen from
 * far away that is invisible; at 6.61 Earth radii it moves the camera by up to 3.5 km, which is
 * a minute of arc for a close pass 4,000 km off. The terms are Meeus ch. 22's
 * (IAU 1980 theory, its four largest, good to 0.5 arcsecond), so the lazy close-pass chunk
 * (`sky-pass.ts`) is the only code that carries them.
 */
import type { Vec3 } from "./globe/pinhole";
import { centuries } from "./sky-math";

const ARCSECOND = Math.PI / 648_000;
const RAD = Math.PI / 180;

/** `v` turned by `a` about the x axis, then about z, as the rotation matrices of Meeus ch. 22. */
const aboutX = (a: number, [x, y, z]: Vec3): Vec3 => [
  x,
  y * Math.cos(a) + z * Math.sin(a),
  z * Math.cos(a) - y * Math.sin(a),
];
const aboutZ = (a: number, [x, y, z]: Vec3): Vec3 => [
  x * Math.cos(a) + y * Math.sin(a),
  y * Math.cos(a) - x * Math.sin(a),
  z,
];

/** The mean-equator place of the Earth-fixed point `camera` would be, nutation and equation of the equinoxes put back. */
export function trueCamera(camera: Vec3, instantMs: number): Vec3 {
  const t = centuries(instantMs);
  const node = (125.04452 - 1934.136261 * t) * RAD;
  const sun = (280.4665 + 36_000.7698 * t) * RAD;
  const moon = (218.3165 + 481_267.8813 * t) * RAD;
  const dpsi =
    (-17.2 * Math.sin(node) -
      1.32 * Math.sin(2 * sun) -
      0.23 * Math.sin(2 * moon) +
      0.21 * Math.sin(2 * node)) *
    ARCSECOND;
  const deps =
    (9.2 * Math.cos(node) +
      0.57 * Math.cos(2 * sun) +
      0.1 * Math.cos(2 * moon) -
      0.09 * Math.cos(2 * node)) *
    ARCSECOND;
  const eps = (23.439291 - 0.0130042 * t) * RAD;
  // The Earth-fixed point is `camera` in the true frame; the mean one is the inverse turn.
  return aboutZ(
    -dpsi * Math.cos(eps),
    aboutX(-eps, aboutZ(dpsi, aboutX(eps + deps, camera))),
  );
}
