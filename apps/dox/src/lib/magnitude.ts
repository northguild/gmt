/**
 * The planets' visual magnitudes: Mallama and Hilton 2018 (Astronomy and Computing 25, 10-24), the
 * laws the Astronomical Almanac uses, and the B-V colours of Mallama, Krobusek and Pavlov 2017
 * (Icarus 282, 19-33, Table 3: the Reference B less the Reference V). Keyed by the ids of
 * `SKY_BODIES` (`sky-registry.ts`); the planets' lazy chunk (`sky-planets.ts`) and the generator
 * (`scripts/prepare-sky-orbits.ts`) read them, so the eager sky never carries them.
 *
 * Each law gives the magnitude at 1 au from the Sun and from the observer, for the phase angle
 * `alpha` and the observer's planetocentric latitude `lat` (both degrees); the apparent magnitude
 * adds `5 log10(r delta)`. Against JPL Horizons' APmag (QUANTITIES 9) over 2026 to 2029 and both
 * ends of the span the laws agree within 0.04 mag, except Mars (up to 0.1 at a phase angle of 13
 * to 19 degrees, where the paper's own scatter is 0.1: Mars's albedo markings are not in the law).
 */
import { SATURN_ROTATION, URANUS_ROTATION } from "./body-rotation";
import { bodyPole } from "./body-frame";
import type { PlanetView } from "./ephemeris";
import type { SkyBodyId } from "./sky-registry";

const RAD = Math.PI / 180;

/** A polynomial in `x`, constant term first. */
const poly = (c: readonly number[], x: number): number =>
  c.reduceRight((sum, k) => sum * x + k, 0);

type Law = (alpha: number, lat: number) => number;

/** The planets that reach the stars' faint limit: the ids of the point rows. */
export type PlanetId = Extract<
  SkyBodyId,
  "mercury" | "venus" | "mars" | "jupiter" | "saturn" | "uranus"
>;

const LAWS = {
  mercury: (a) =>
    poly(
      [
        -0.613, 6.328e-2, -1.6336e-3, 3.3644e-5, -3.4265e-7, 1.6893e-9,
        -3.0334e-12,
      ],
      a,
    ),
  venus: (a) =>
    a <= 163.7
      ? poly([-4.384, -1.044e-3, 3.687e-4, -2.814e-6, 8.938e-9], a)
      : poly([236.058_28, -2.819_14, 8.390_34e-3], a),
  mars: (a) =>
    a <= 50
      ? -1.601 + 0.022_67 * a - 0.000_130_2 * a * a
      : -0.367 - 0.025_73 * a + 0.000_344_5 * a * a,
  jupiter: (a) => {
    if (a <= 12) return -9.395 - 3.7e-4 * a + 6.16e-4 * a * a;
    const x = a / 180;
    return (
      -9.428 -
      2.5 *
        Math.log10(
          1 -
            1.507 * x -
            0.363 * x ** 2 -
            0.062 * x ** 3 +
            2.809 * x ** 4 -
            1.876 * x ** 5,
        )
    );
  },
  /* The rings count while the phase angle is small and the planet is seen within 27 degrees of
     their plane; outside that the globe alone is left. */
  saturn: (a, lat) => {
    const s = Math.sin(Math.abs(lat) * RAD);
    return a <= 6.5 && Math.abs(lat) <= 27
      ? -8.914 - 1.825 * s + 0.026 * a - 0.378 * s * Math.exp(-2.25 * a)
      : poly([-8.94, 2.446e-4, 2.672e-4, -1.506e-6, 4.767e-9], a);
  },
  uranus: (a, lat) =>
    -7.11 - 8.4e-4 * Math.abs(lat) + 6.587e-3 * a + 1.045e-4 * a * a,
} satisfies Record<PlanetId, Law>;

/** The planets whose law reads the camera's latitude on them, and the rotation that gives it. */
const POLES = { saturn: SATURN_ROTATION, uranus: URANUS_ROTATION };

/**
 * A planet's apparent visual magnitude as the camera sees it at an instant: the law's value at 1
 * au plus `5 log10(r delta)`. Saturn's rings and Uranus's pole read the pole through `bodyPole`,
 * the camera's latitude on the planet being the pole's angle to the line back to the camera.
 */
export function apparentMagnitude(
  id: PlanetId,
  { unit, delta, r, phase }: PlanetView,
  instantMs: number,
): number {
  const pole =
    id in POLES && bodyPole(POLES[id as keyof typeof POLES], instantMs);
  const lat = pole
    ? -Math.asin(pole[0] * unit[0] + pole[1] * unit[1] + pole[2] * unit[2]) /
      RAD
    : 0;
  return 5 * Math.log10(r * delta) + LAWS[id](phase, lat);
}

/** Each planet's B-V colour index (Mallama, Krobusek and Pavlov 2017, Table 3). */
export const COLOUR_INDEX = {
  mercury: 0.97,
  venus: 0.7,
  mars: 1.36,
  jupiter: 0.86,
  saturn: 1.07,
  uranus: 0.5,
} satisfies Record<PlanetId, number>;
