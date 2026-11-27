import { describe, expect, it } from "vitest";
import orbitText from "../assets/sky-orbits.json?raw";
import type { Orbits } from "./ephemeris";
import rowsText from "../assets/sky-passes.json?raw";
import { tableState, type PassTable } from "./pass-table";
import type { PassRows } from "./sky-pass";

const pass: PassTable = {
  startMs: (JSON.parse(orbitText) as Orbits).passes["apophis"]!.startMs,
  ...(JSON.parse(rowsText) as PassRows)["apophis"]!,
};

describe("tableState", () => {
  it("reproduces a cubic path and its velocity exactly", () => {
    /* x(t) = 2 + 3t - t^2 + 0.5 t^3 with t in steps of 10 s; km and km/s. */
    const f = (t: number) => 2 + 3 * t - t * t + 0.5 * t ** 3;
    const df = (t: number) => (3 - 2 * t + 1.5 * t * t) / 10;
    const rows = [0, 1, 2, 3].flatMap((t) => [f(t), 0, 0, df(t), 0, 0]);
    const table: PassTable = { startMs: 1000, stepMs: 10_000, rows };
    const state = tableState(table, 1000 + 12_500)!;
    expect(state.p[0]).toBeCloseTo(f(1.25), 9);
    expect(state.v[0]).toBeCloseTo(df(1.25), 9);
  });

  it("is null before the first row and past the last, and for one row", () => {
    const table: PassTable = {
      startMs: 0,
      stepMs: 1000,
      rows: Array(12).fill(1),
    };
    expect(tableState(table, -1)).toBeNull();
    expect(tableState(table, 1001)).toBeNull();
    expect(tableState({ ...table, rows: Array(6).fill(1) }, 0)).toBeNull();
  });

  /* Horizons VECTORS, COMMAND='99942' CENTER='500@399' REF_PLANE='FRAME' VEC_TABLE='2'
     OUT_UNITS='KM-S' VEC_CORR='NONE' TIME_TYPE='UT' TLIST_TYPE='JD' TLIST=<each instant as a
     Julian date>: position x, y, z in km at five past each hour, 2029-04-13 12:05 to 23:05 UT,
     and at 21:45 (the pass's closest approach is at 21:46). */
  it.each([
    [1870776300000, -187521.097784549, -75669.65477911383, -94128.56705795601],
    [1870779900000, -171672.4274009764, -65086.56950505823, -82821.5337944515],
    [1870783500000, -155714.8922109008, -54462.35080188513, -71461.95715527609],
    [1870787100000, -139618.1243499219, -43789.70961599797, -60038.57827536389],
    [1870790700000, -123337.4337435961, -33059.91409673542, -48536.42055819929],
    [1870794300000, -106803.5444929302, -22263.33385698497, -36935.38847597688],
    [1870797900000, -89901.88925465941, -11392.54551593214, -25209.04768892378],
    [1870801500000, -72427.68134072423, -455.6452953517437, -13327.24026679993],
    [1870805100000, -53986.47465291619, 10467.01263326406, -1283.704616449773],
    [1870808700000, -33849.1858330667, 20988.96797835082, 10742.67701106519],
    [1870811100000, -19129.05246320367, 27228.90804256499, 18371.95472779498],
    [1870812300000, -11443.06369027495, 29949.82369918376, 21925.47729125991],
    [1870815900000, 11992.69292393327, 36495.9898122251, 31359.55550390109],
  ])("is within 1 km of Horizons' position at %d", (t, x, y, z) => {
    const { p } = tableState(pass, t)!;
    expect(Math.hypot(p[0] - x, p[1] - y, p[2] - z)).toBeLessThan(1);
  });

  it("is null one step outside the shipped window", () => {
    const last = pass.startMs + (pass.rows.length / 6 - 1) * pass.stepMs;
    expect(tableState(pass, pass.startMs - pass.stepMs)).toBeNull();
    expect(tableState(pass, last + pass.stepMs)).toBeNull();
  });
});
