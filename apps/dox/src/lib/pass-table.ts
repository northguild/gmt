/**
 * A close pass's tabulated state vectors: JPL Horizons' geocentric position and velocity of a body
 * (`scripts/prepare-sky-orbits.ts` writes the rows into `src/assets/sky-orbits.json`), read at any
 * instant of the pass by cubic Hermite interpolation of position and velocity between rows. A pass
 * that bends by tens of degrees at six Earth radii has no two-body orbit; the table is the orbit.
 */
import { EARTH_EQUATORIAL_RADIUS_KM, type Vec3 } from "./globe/pinhole";
import { KM_PER_AU, LIGHT_KM_S, minus, type PassPlacer } from "./ephemeris";
import { trueCamera } from "./nutation";
import { precessToDate } from "./sky-math";

/** One pass: rows are `[x, y, z, vx, vy, vz]` flat, kilometres and kilometres per second, ICRF axes of J2000, one row every `stepMs` from `startMs` (a pass's `startMs` is in `sky-orbits.json`, its rows in `sky-passes.json`). */
export interface PassTable {
  startMs: number;
  stepMs: number;
  rows: readonly number[];
}

const STRIDE = 6;

/**
 * The geocentric state at an instant: position (km) and velocity (km/s), or null outside the rows
 * (one step outside, or before the table starts, there is nothing to interpolate).
 */
export function tableState(
  { startMs, stepMs, rows }: PassTable,
  instantMs: number,
): { p: Vec3; v: Vec3 } | null {
  const last = rows.length / STRIDE - 1;
  const at = (instantMs - startMs) / stepMs;
  if (!(at >= 0 && at <= last) || last < 1) return null;
  const i = Math.min(Math.floor(at), last - 1);
  const s = at - i;
  const h = stepMs / 1000;
  const [s2, s3] = [s * s, s * s * s];
  /* The four Hermite weights and their slopes in `s`. */
  const w = [2 * s3 - 3 * s2 + 1, s3 - 2 * s2 + s, -2 * s3 + 3 * s2, s3 - s2];
  const d = [
    6 * s2 - 6 * s,
    3 * s2 - 4 * s + 1,
    -6 * s2 + 6 * s,
    3 * s2 - 2 * s,
  ];
  const p: number[] = [];
  const v: number[] = [];
  for (let k = 0; k < 3; k++) {
    const [p0, v0, p1, v1] = [
      rows[i * STRIDE + k]!,
      rows[i * STRIDE + 3 + k]! * h,
      rows[(i + 1) * STRIDE + k]!,
      rows[(i + 1) * STRIDE + 3 + k]! * h,
    ];
    p.push(w[0]! * p0 + w[1]! * v0 + w[2]! * p1 + w[3]! * v1);
    v.push((d[0]! * p0 + d[1]! * v0 + d[2]! * p1 + d[3]! * v1) / h);
  }
  return { p: p as unknown as Vec3, v: v as unknown as Vec3 };
}

/**
 * A pass's place: the body where it was when its light left, as the Earth's heliocentric place
 * (`earthAt`, au of date, as a function of the days back) plus the table's geocentric position
 * turned to the equator of date, less the light-time in its geocentric velocity. The table is
 * relative to the Earth of the same instant, so the Earth is read at the instant the light left
 * too: its own motion in that time (30 km/s) is 9 km at 90,000 km. The body is placed for the
 * camera in the true equator of date (`trueCamera`), the one Horizons' Earth-fixed sites sit in:
 * the place is moved by the difference between the two cameras, so the caller's subtraction of its
 * mean camera leaves the body less the true one. Null outside the table.
 */
export const passPlacer =
  (tables: Readonly<Record<string, PassTable>>): PassPlacer =>
  (id, instantMs, earthAt, camera) => {
    const table = tables[id];
    const state = table && tableState(table, instantMs);
    if (!state) return null;
    const [p, v] = [
      precessToDate(state.p, instantMs),
      precessToDate(state.v, instantMs),
    ];
    const seen = trueCamera(camera, instantMs);
    const km = (c: number): number => c * EARTH_EQUATORIAL_RADIUS_KM;
    const range = Math.hypot(...minus(p, seen.map(km) as Vec3));
    const back = range / LIGHT_KM_S;
    return earthAt(back / 86_400).map(
      (c, i) =>
        c + (p[i]! - v[i]! * back + km(camera[i]! - seen[i]!)) / KM_PER_AU,
    ) as Vec3;
  };
