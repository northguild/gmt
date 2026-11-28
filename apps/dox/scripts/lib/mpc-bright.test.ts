import { describe, expect, it } from "vitest";
import { parseMpcRow, peakMagnitude, selectBright } from "./mpc-bright";

/* Three rows of the Minor Planet Center's Soft00Bright.txt for 2026 (the MPC orbit format). */
const CERES = `00001    3.35  0.15 K25BL 231.53975   73.29974   80.24963   10.58789  0.0795763  0.21429712   2.7656157  0 MPO950947  7369 126 1801-2025 0.69 M-v 30k MPC        0000              (1) Ceres`;
const VESTA = `00004    3.25  0.15 K25BL  26.80968  151.53712  103.70232    7.14406  0.0901676  0.27158812   2.3615413  0 MPO925791  7543 112 1821-2025 0.69 M-p 18k MPC        0000              (4) Vesta`;
const EROS = `00433   10.39  0.15 K25BL 310.55432  178.92978  304.27008   10.82847  0.2228360  0.55977530   1.4581210  0 MPO950953 15533  59 1893-2025 0.54 M-v 3Ek MPC        0000            (433) Eros`;

/** The row with its absolute magnitude H (columns 9 to 12) replaced. */
const withH = (line: string, H: string) =>
  line.slice(0, 9) + H + line.slice(13);

describe("parseMpcRow", () => {
  it("reads the fixed columns of Vesta, the epoch as a Julian date", () => {
    expect(parseMpcRow(VESTA)).toEqual({
      name: "Vesta",
      H: 3.25,
      G: 0.15,
      epoch: 2_461_000.5,
      M: 26.80968,
      peri: 151.53712,
      node: 103.70232,
      i: 7.14406,
      e: 0.0901676,
      n: 0.27158812,
      a: 2.3615413,
    });
  });

  it("reads Ceres and Eros, and nothing from a short line", () => {
    expect(parseMpcRow(CERES)?.name).toBe("Ceres");
    expect(parseMpcRow(EROS)?.name).toBe("Eros");
    expect(parseMpcRow("")).toBeNull();
    expect(parseMpcRow("00004    3.25")).toBeNull();
  });
});

describe("selectBright", () => {
  /* Vesta's perihelion is 2.149 au: peak magnitude H + 1.96. */
  it("keeps a body whose peak is at the limit and under, and drops one over", () => {
    const row = parseMpcRow(VESTA)!;
    expect(selectBright(VESTA, peakMagnitude(row))).toHaveLength(1);
    expect(selectBright(withH(VESTA, "3.53"), 5.5)).toHaveLength(1);
    expect(selectBright(withH(VESTA, "3.55"), 5.5)).toHaveLength(0);
  });

  it("drops a near-Earth body however bright (perihelion under 1.3 au)", () => {
    expect(selectBright(withH(EROS, "1.00"), 5.5)).toHaveLength(0);
  });
});
