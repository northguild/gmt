/**
 * Reads the IAU Minor Planet Center's yearly bright minor planets file
 * (`https://www.minorplanetcenter.net/iau/Ephemerides/Bright/<year>/Soft00Bright.txt`, the MPC's
 * orbit format) and picks the bodies that can reach the stars' faint limit. Used by
 * `scripts/prepare-sky-orbits.ts`; pure, so its test needs no download.
 *
 * A row's fixed columns (0-based, end exclusive): designation 0-7, H 8-13, G 14-19, epoch 20-25
 * (packed), M 26-35, perihelion argument 37-46, ascending node 48-57, inclination 59-68,
 * eccentricity 70-79, mean motion 80-91, semi-major axis 92-103, readable name 166-.
 */
import { convertUtcToUnix } from "@northguild/gmt/utc/convert";
import { DAY_MS, UNIX_EPOCH_JD } from "../../src/lib/globe/sun";
import type { KeplerElements } from "../../src/lib/kepler";

/** One body of the file: its elements (epoch as a Julian date), magnitude parameters and name. */
interface MpcRow extends KeplerElements {
  /** The name with its number and brackets dropped: "Vesta". */
  name: string;
  H: number;
  G: number;
}

/**
 * Near-Earth objects (the MPC's definition: perihelion under 1.3 au) are left out: a close
 * approach defeats two-body elements.
 */
const NEAR_EARTH_Q = 1.3;

/** The MPC bright minor planets file of each year, pinned by size and sha256: add a year's pin when the refresh reaches it. */
export const MPC_PINS: Record<string, { bytes: number; sha256: string }> = {
  "2026": {
    bytes: 59_808,
    sha256: "3cb4367cf5fc28c519599d65b7bccab1aa4ea32e89297e225abecdf57febf565",
  },
};
export const mpcUrl = (year: string) =>
  `https://www.minorplanetcenter.net/iau/Ephemerides/Bright/${year}/Soft00Bright.txt`;

/** A packed epoch (`K25BL`: century letter, two-digit year, month, day, each in base 31) as a Julian date at 0h. */
function unpackEpoch(packed: string): number {
  const digit = (c: string) => (c <= "9" ? Number(c) : c.charCodeAt(0) - 55);
  const two = (n: number) => String(n).padStart(2, "0");
  const ms = convertUtcToUnix(
    `${digit(packed[0]!) * 100 + Number(packed.slice(1, 3))}-${two(digit(packed[3]!))}-${two(digit(packed[4]!))}T00:00:00Z`,
  );
  return (ms ?? NaN) / DAY_MS + UNIX_EPOCH_JD;
}

/** A row's perihelion distance, au. */
export const perihelion = (row: Pick<MpcRow, "a" | "e">): number =>
  row.a * (1 - row.e);

/**
 * The brightest a body can be: at the opposition nearest its perihelion, phase angle 0,
 * `H + 5 log10(q (q - 1))`, `q` its perihelion distance in au.
 */
export const peakMagnitude = (row: Pick<MpcRow, "H" | "a" | "e">): number => {
  const q = perihelion(row);
  return row.H + 5 * Math.log10(q * (q - 1));
};

/**
 * One row of the file, or null for an orbit that is not an ellipse or a line that is not a row. The
 * MPC's ephemeris files list minor planets only, so no other kind of body comes through.
 */
export function parseMpcRow(line: string): MpcRow | null {
  if (line.length < 104) return null;
  const at = (from: number, to: number) => Number(line.slice(from, to));
  const row: MpcRow = {
    name: line
      .slice(166)
      .trim()
      .replace(/^\(\d+\)\s*/, ""),
    H: at(8, 13),
    G: at(14, 19),
    M: at(26, 35),
    peri: at(37, 46),
    node: at(48, 57),
    i: at(59, 68),
    e: at(70, 79),
    n: at(80, 91),
    a: at(92, 103),
    epoch: unpackEpoch(line.slice(20, 25)),
  };
  const numbers = [
    row.H,
    row.G,
    row.epoch,
    row.M,
    row.peri,
    row.node,
    row.i,
    row.e,
    row.n,
    row.a,
  ];
  return numbers.every(Number.isFinite) && row.e < 1 && row.a > 0 ? row : null;
}

/** The rows of the file that can reach `limit`: not near-Earth, and a perihelic opposition at or under it. */
export function selectBright(text: string, limit: number): MpcRow[] {
  return text
    .split("\n")
    .flatMap((line) => parseMpcRow(line) ?? [])
    .filter(
      (row) => perihelion(row) >= NEAR_EARTH_Q && peakMagnitude(row) <= limit,
    );
}
