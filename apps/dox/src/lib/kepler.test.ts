import { describe, expect, it } from "vitest";
import orbitText from "../assets/sky-orbits.json?raw";
import { RAD } from "./globe/pinhole";
import { keplerPosition, solveKepler, type KeplerElements } from "./kepler";
import type { Orbits } from "./ephemeris";

const vesta = (JSON.parse(orbitText) as Orbits).small.vesta!;

describe("solveKepler", () => {
  it("is the mean anomaly on a circle", () => {
    for (const M of [-3, 0, 0.5, 2, 6])
      expect(Math.cos(solveKepler(M, 0)) - Math.cos(M)).toBeCloseTo(0, 12);
  });

  it("satisfies Kepler's equation after fewer than 10 steps at e 0.9", () => {
    for (const M of [0.01, 0.3, 1, 2.5, 3.1, -1.2]) {
      const E = solveKepler(M, 0.9, 9);
      expect(E - 0.9 * Math.sin(E)).toBeCloseTo(M, 10);
    }
  });
});

describe("keplerPosition", () => {
  it("is the semi-major axis from the Sun on a circular orbit at every anomaly", () => {
    const circle: KeplerElements = {
      a: 2.5,
      e: 0,
      i: 20,
      node: 40,
      peri: 60,
      M: 0,
      n: 1,
      epoch: 2_461_000.5,
    };
    for (let day = 0; day < 360; day += 17)
      expect(
        Math.hypot(...keplerPosition(circle, circle.epoch + day)),
      ).toBeCloseTo(2.5, 12);
  });

  /* Horizons, COMMAND='4;' CENTER='500@10' EPHEM_TYPE='VECTORS' REF_PLANE='ECLIPTIC'
     REF_SYSTEM='ICRF' VEC_TABLE='1' OUT_UNITS='AU-D' TLIST_TYPE='JD' (TDB): heliocentric
     x, y, z, au, at the epoch of the MPC 2026 elements, and 180 and 360 days on. */
  it.each([
    [
      2_461_000.5,
      [0.6431852094416994, -2.078623478309465, -0.01660742972003032],
    ],
    [2_461_180.5, [2.18825514765455, -0.7545770386781662, -0.2440597012078604]],
    [2_461_360.5, [2.188691373756372, 1.158277687169259, -0.3008954190308938]],
  ])("is Horizons' vector within 0.010 degrees at JD %d", (jd, truth) => {
    const p = keplerPosition(vesta, jd);
    const t = truth as number[];
    const cos =
      (p[0] * t[0]! + p[1] * t[1]! + p[2] * t[2]!) /
      (Math.hypot(...p) * Math.hypot(...t));
    expect(Math.acos(Math.min(1, cos)) / RAD).toBeLessThan(0.01);
  });
});
