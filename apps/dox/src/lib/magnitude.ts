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
 * Near the faint limit the curve is flat, so 0.01 mag moves a dated event by days: Uranus reaches
 * 5.5 on 11 December 2033 by this law and on 3 December by Horizons, whose APmag for Uranus has
 * almost no phase term (this law adds 0.012 at 1.8 degrees).
 *
 * An asteroid has no law of its own: `hgMagnitude` is the IAU H, G system (IAU Commission 20,
 * 1985; Bowell et al. 1989, Asteroids II), from the H and G of its Minor Planet Center row.
 * Pluto has no IAU law, and the H, G system measurably misfits it (0.42 to 0.57 mag too faint
 * against Horizons' APmag), so it takes `DWARF_ABSOLUTE`.
 */
import { SATURN_ROTATION, URANUS_ROTATION } from "./body-rotation";
import { bodyPole } from "./body-frame";
import type { Orbits, PlanetView } from "./ephemeris";
import { RAD } from "./globe/pinhole";
import type { PointId, SkyBodyId } from "./sky-registry";

/** A polynomial in `x`, constant term first. */
const poly = (c: readonly number[], x: number): number =>
  c.reduceRight((sum, k) => sum * x + k, 0);

type Law = (alpha: number, lat: number) => number;

/** The planets that reach the stars' faint limit: the ids of the point rows. */
export type PlanetId = Extract<
  SkyBodyId,
  "mercury" | "venus" | "mars" | "jupiter" | "saturn" | "uranus"
>;

/** The dwarf planets the sky places: the ids of the point rows after the planets that have a law of their own. */
export type DwarfId = Extract<SkyBodyId, "pluto">;

/** The asteroids: the point rows that are neither a planet nor a dwarf planet, each magnitude by the IAU H, G system. */
export type SmallId = Exclude<PointId, PlanetId | DwarfId>;

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

/**
 * A dwarf planet's absolute visual magnitude at 1 au from the Sun and from the observer, with no
 * phase term: the Astronomical Almanac's Pluto, V(1,0) = -1.01 (Explanatory Supplement to the
 * Astronomical Almanac, 3rd ed., Urban and Seidelmann 2013, Table 10.6, p. 413, as corrected by
 * the USNO errata; Harris 1961's value). Against Horizons' APmag it holds within 0.07 mag
 * (`magnitude.test.ts`). Its phase angle never exceeds 2 degrees, so a phase term has nothing to
 * fit. The apparent magnitude adds `5 log10(r delta)`.
 */
export const DWARF_ABSOLUTE = { pluto: -1.01 } satisfies Record<
  DwarfId,
  number
>;

/**
 * An asteroid's apparent visual magnitude from its absolute magnitude `H` and slope `G`: `H + 5
 * log10(r delta)` less `2.5 log10` of the two phase functions mixed by `G`. Each phase function
 * blends the long form's smooth fall (constants `A`, `B`) for a wide angle with the short form's
 * (constant `C`) for a narrow one, by the weight `W` that is 1 at opposition (Bowell et al. 1989,
 * Table 1 and eq. A4). At a phase angle of 0 the phase term is 0, so it is `H + 5 log10(r delta)`.
 */
export function hgMagnitude(
  H: number,
  G: number,
  { delta, r, phase }: PlanetView,
): number {
  const alpha = phase * RAD;
  const half = Math.tan(alpha / 2);
  const w = Math.exp(-90.56 * half * half);
  const s = Math.sin(alpha);
  const mix = (A: number, B: number, C: number) =>
    w * (1 - (C * s) / (0.119 + 1.341 * s - 0.754 * s * s)) +
    (1 - w) * Math.exp(-A * half ** B);
  return (
    H +
    5 * Math.log10(r * delta) -
    2.5 *
      Math.log10((1 - G) * mix(3.33, 0.63, 0.986) + G * mix(1.87, 1.22, 0.238))
  );
}

/** A point body's magnitude as the camera sees it: an asteroid or a pass by its H and G, a dwarf planet by its absolute magnitude, a planet by its own law. The layer and the generator's spell search both read this. */
export function viewMagnitude(
  orbits: Orbits,
  id: PointId,
  view: PlanetView,
  instantMs: number,
): number {
  if (id in DWARF_ABSOLUTE)
    return DWARF_ABSOLUTE[id as DwarfId] + 5 * Math.log10(view.r * view.delta);
  const hg = orbits.small[id as SmallId] ?? orbits.passes[id as SmallId];
  return hg
    ? hgMagnitude(hg.H, hg.G, view)
    : apparentMagnitude(id as PlanetId, view, instantMs);
}
