/**
 * Where a body's surface faces. `moonFrame` is the Moon's pole and prime meridian, from the IAU
 * WGCCRE model (Archinal et al. 2018, Table 2, the Moon, mean-Earth/polar-axis frame), in the
 * equatorial axes of date that `sky-math.ts` draws the Sun and the Moon in. `sunPole` is the Sun's
 * pole from the same report (Table 1, the Sun).
 */
import { precessToDate, toUnit, type Unit } from "./sky-math";

/** A body's north pole and the direction of its prime meridian, unit vectors in the equatorial axes of date. */
export interface BodyFrame {
  pole: Unit;
  prime: Unit;
}

const RAD = Math.PI / 180;
const DAY_MS = 86_400_000;
/** Unix 0 in Julian days, and J2000.0 (2000-01-01 12:00 TT), as `sky-math` has them. */
const UNIX_EPOCH_JD = 2_440_587.5;
const J2000_JD = 2_451_545;

/**
 * The 13 libration and precession arguments E1 to E13, degrees: their value at J2000 and their
 * rate a day (Archinal et al. 2018, Table 2, the Moon).
 */
const MOON_ARGUMENTS: readonly (readonly [number, number])[] = [
  [125.045, -0.052_992_1],
  [250.089, -0.105_984_2],
  [260.008, 13.012_000_9],
  [176.625, 13.340_715_4],
  [357.529, 0.985_600_3],
  [311.589, 26.405_708_4],
  [134.963, 13.064_993],
  [276.617, 0.328_714_6],
  [34.226, 1.748_487_7],
  [15.134, -0.158_976_3],
  [119.743, 0.003_609_6],
  [239.961, 0.164_357_3],
  [25.053, 12.959_008_8],
];

/** The pole's right ascension terms, in `sin E` of the argument at the same index: [index from 1, coefficient]. */
const POLE_RA: readonly (readonly [number, number])[] = [
  [1, -3.8787],
  [2, -0.1204],
  [3, 0.07],
  [4, -0.0172],
  [6, 0.0072],
  [10, -0.0052],
  [13, 0.0043],
];
/** The pole's declination terms, in `cos E`. */
const POLE_DEC: readonly (readonly [number, number])[] = [
  [1, 1.5419],
  [2, 0.0239],
  [3, -0.0278],
  [4, 0.0068],
  [6, -0.0029],
  [7, 0.0009],
  [10, 0.0008],
  [13, -0.0009],
];
/** The prime meridian's terms, in `sin E`. */
const PRIME_W: readonly (readonly [number, number])[] = [
  [1, 3.561],
  [2, 0.1208],
  [3, -0.0642],
  [4, 0.0158],
  [5, 0.0252],
  [6, -0.0066],
  [7, -0.0047],
  [8, -0.0046],
  [9, 0.0028],
  [10, 0.0052],
  [11, 0.004],
  [12, 0.0019],
  [13, -0.0044],
];

const cross = (a: Unit, b: Unit): Unit => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/**
 * The Moon's pole and prime meridian at a Unix instant in milliseconds, in the equatorial axes of
 * date. The instant is taken as TDB (the model's time); UTC is under 70 s behind, 0.01 degree of
 * rotation. The prime meridian is the node of the Moon's equator on the equator of J2000, turned
 * by W along the Moon's equator, then both precessed to date.
 */
export function moonFrame(instantMs: number): BodyFrame {
  const d = instantMs / DAY_MS + UNIX_EPOCH_JD - J2000_JD;
  const t = d / 36_525;
  const e = MOON_ARGUMENTS.map(([epoch, rate]) => (epoch + rate * d) * RAD);
  const at = (index: number): number => e[index - 1]!;
  const sum = (terms: typeof POLE_RA, f: (x: number) => number): number =>
    terms.reduce((total, [index, k]) => total + k * f(at(index)), 0);
  const ra = 269.9949 + 0.0031 * t + sum(POLE_RA, Math.sin);
  const dec = 66.5392 + 0.013 * t + sum(POLE_DEC, Math.cos);
  const w =
    38.3213 + 13.176_358_15 * d - 1.4e-12 * d * d + sum(PRIME_W, Math.sin);
  const pole = toUnit(ra, dec);
  const node: Unit = [-Math.sin(ra * RAD), Math.cos(ra * RAD), 0];
  const along = cross(pole, node);
  const prime: Unit = [
    Math.cos(w * RAD) * node[0] + Math.sin(w * RAD) * along[0],
    Math.cos(w * RAD) * node[1] + Math.sin(w * RAD) * along[1],
    Math.cos(w * RAD) * node[2] + Math.sin(w * RAD) * along[2],
  ];
  return {
    pole: precessToDate(pole, instantMs),
    prime: precessToDate(prime, instantMs),
  };
}

/**
 * The Sun's north pole at a Unix instant in milliseconds, in the equatorial axes of date: right
 * ascension 286.13 degrees and declination 63.87 degrees in the ICRF (Archinal et al. 2018,
 * Table 1, the Sun), which have no rate, turned to date.
 */
export function sunPole(instantMs: number): Unit {
  return precessToDate(toUnit(286.13, 63.87), instantMs);
}

/**
 * Where a unit direction (equatorial axes of date) meets a body's surface: east longitude from the
 * prime meridian and north latitude, radians. East is the pole crossed with the prime meridian,
 * so longitude grows to the right when the body is seen from outside with its north up.
 */
export function surfaceAt(
  { pole, prime }: BodyFrame,
  [x, y, z]: Unit,
): [number, number] {
  const east = cross(pole, prime);
  return [
    Math.atan2(
      x * east[0] + y * east[1] + z * east[2],
      x * prime[0] + y * prime[1] + z * prime[2],
    ),
    Math.asin(
      Math.max(-1, Math.min(1, x * pole[0] + y * pole[1] + z * pole[2])),
    ),
  ];
}
