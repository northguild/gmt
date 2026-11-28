/**
 * How each body turns: the IAU WGCCRE rotational elements (Archinal et al. 2018, Celestial
 * Mechanics and Dynamical Astronomy 130:22, Tables 1 to 3), one named export per body so that a
 * painter chunk imports only its own. Every row has the report's form, with T in Julian centuries
 * and d in days from J2000.0 (TDB):
 *
 *   pole right ascension  ra0 = ra[0] + ra[1] T + sum(k sin(argument))
 *   pole declination      dec0 = dec[0] + dec[1] T + sum(k cos(argument))
 *   prime meridian        W = w[0] + w[1] d + w[2] d^2 + sum(k sin(argument))
 *
 * The columns of `terms` pick an argument by its 1-based index in `args`. `bodyFrame`
 * (`body-frame.ts`) turns a row into a pole and a prime meridian. A row keeps the report's terms.
 * The rows are keyed by the ids of `SKY_BODIES` (`sky-registry.ts`), by name: `SUN_ROTATION`
 * is the Sun's.
 */

/** A periodic argument, degrees: its value at J2000.0 and its rate a day. */
type Argument = readonly [epoch: number, rate: number];
/** A term of a sum: [1-based index into `args`, coefficient in degrees]. */
type Term = readonly [index: number, coefficient: number];

export interface BodyRotation {
  ra: readonly [number, number];
  dec: readonly [number, number];
  w: readonly [number, number, number?];
  args?: readonly Argument[];
  raTerms?: readonly Term[];
  decTerms?: readonly Term[];
  wTerms?: readonly Term[];
}

/** The Sun (Table 1). */
export const SUN_ROTATION: BodyRotation = {
  ra: [286.13, 0],
  dec: [63.87, 0],
  w: [84.176, 14.1844],
};

/** The Moon, mean-Earth/polar-axis frame (Table 2): the 13 arguments E1 to E13. */
export const MOON_ROTATION: BodyRotation = {
  ra: [269.9949, 0.0031],
  dec: [66.5392, 0.013],
  w: [38.3213, 13.176_358_15, -1.4e-12],
  args: [
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
  ],
  raTerms: [
    [1, -3.8787],
    [2, -0.1204],
    [3, 0.07],
    [4, -0.0172],
    [6, 0.0072],
    [10, -0.0052],
    [13, 0.0043],
  ],
  decTerms: [
    [1, 1.5419],
    [2, 0.0239],
    [3, -0.0278],
    [4, 0.0068],
    [6, -0.0029],
    [7, 0.0009],
    [10, 0.0008],
    [13, -0.0009],
  ],
  wTerms: [
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
  ],
};

/** The days in a Julian century: Mars's arguments are stated a century, as in the report. */
const CENTURY = 36_525;

/** Mars (Table 1): the arguments M1 to M16, rates a century over `CENTURY`. */
export const MARS_ROTATION: BodyRotation = {
  ra: [317.269_202, -0.109_275_47],
  dec: [54.432_516, -0.058_271_05],
  w: [176.049_863, 350.891_982_443_297],
  args: [
    [198.991_226, 19_139.481_998_5 / CENTURY],
    [226.292_679, 38_280.851_128_1 / CENTURY],
    [249.663_391, 57_420.725_159_3 / CENTURY],
    [266.183_51, 76_560.636_795 / CENTURY],
    [79.398_797, 0.504_261_5 / CENTURY],
    [122.433_576, 19_139.940_747_6 / CENTURY],
    [43.058_401, 38_280.875_327_2 / CENTURY],
    [57.663_379, 57_420.751_720_5 / CENTURY],
    [79.476_401, 76_560.649_500_4 / CENTURY],
    [166.325_722, 0.504_261_5 / CENTURY],
    [129.071_773, 19_140.032_824_4 / CENTURY],
    [36.352_167, 38_281.047_359_1 / CENTURY],
    [56.668_646, 57_420.929_536 / CENTURY],
    [67.364_003, 76_560.255_221_5 / CENTURY],
    [104.792_68, 95_700.438_757_8 / CENTURY],
    [95.391_654, 0.504_261_5 / CENTURY],
  ],
  raTerms: [
    [1, 0.000_068],
    [2, 0.000_238],
    [3, 0.000_052],
    [4, 0.000_009],
    [5, 0.419_057],
  ],
  decTerms: [
    [6, 0.000_051],
    [7, 0.000_141],
    [8, 0.000_031],
    [9, 0.000_005],
    [10, 1.591_274],
  ],
  wTerms: [
    [11, 0.000_145],
    [12, 0.000_157],
    [13, 0.000_04],
    [14, 0.000_001],
    [15, 0.000_001],
    [16, 0.584_542],
  ],
};

/** Saturn (Table 1), System III. */
export const SATURN_ROTATION: BodyRotation = {
  ra: [40.589, -0.036],
  dec: [83.537, -0.004],
  w: [38.9, 810.7939024],
};

/** Uranus (Table 1): retrograde, so W falls. */
export const URANUS_ROTATION: BodyRotation = {
  ra: [257.311, 0],
  dec: [-15.175, 0],
  w: [203.81, -501.1600928],
};
