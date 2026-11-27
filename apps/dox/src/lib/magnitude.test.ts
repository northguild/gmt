import { describe, expect, it } from "vitest";
import orbitText from "../assets/sky-orbits.json?raw";
import { bodyFromCamera, type Orbits } from "./ephemeris";
import { APOPHIS_SITES } from "../test/apophis-pins";
import { loadPasses } from "./sky-pass";
import { cameraAt } from "./sky-math";
import { hgMagnitude, viewMagnitude } from "./magnitude";

const { H, G } = (JSON.parse(orbitText) as Orbits).small.vesta!;

/* Horizons, COMMAND='4;' CENTER='500@399' TIME_TYPE='TT' TLIST_TYPE='JD' QUANTITIES='9,19,20,24':
   APmag (Q9), r and delta, au (Q19, Q20) and the phase angle, degrees (Q24). The shipped row's H and G are JPL's fitted pair (3.25, 0.32). */
const PINS = [
  {
    jd: 2461060.5,
    r: 2.215976492426,
    delta: 3.19515075094745,
    phase: 2.1041,
    V: 7.695,
  },
  {
    jd: 2461150.5,
    r: 2.297443596908,
    delta: 2.96389532390593,
    phase: 16.5598,
    V: 8.124,
  },
  {
    jd: 2461250.5,
    r: 2.39784460432,
    delta: 1.99230940323878,
    phase: 24.593,
    V: 7.565,
  },
  {
    jd: 2461330.5,
    r: 2.470859554924,
    delta: 1.48873102566712,
    phase: 5.0863,
    V: 6.416,
  },
  {
    jd: 2461699.5,
    r: 2.537605158984,
    delta: 2.54707653748304,
    phase: 22.5869,
    V: 8.17,
  },
];

describe("hgMagnitude", () => {
  it.each(PINS)(
    "is Horizons' APmag within 0.05 with the shipped H and G at JD $jd",
    ({ V, ...view }) => {
      expect(
        Math.abs(hgMagnitude(H, G, { ...view, unit: [1, 0, 0] }) - V),
      ).toBeLessThan(0.05);
    },
  );

  it("is H + 5 log10(r delta) at a phase angle of 0", () => {
    const view = {
      unit: [1, 0, 0] as [number, number, number],
      r: 2.2,
      delta: 1.3,
      phase: 0,
    };
    expect(hgMagnitude(3.25, 0.15, view)).toBeCloseTo(
      3.25 + 5 * Math.log10(2.2 * 1.3),
      12,
    );
  });
});

describe("hgMagnitude for Apophis", () => {
  const { H, G } = (JSON.parse(orbitText) as Orbits).passes["apophis"]!;
  /* Horizons' APmag (Q9) from each camera site (`apophis-pins.ts`), the body's H 19.09 and G 0.24 from JPL's record. */
  it.each(APOPHIS_SITES)("is within 0.05 magnitude of APmag: $name", (site) => {
    const view = bodyFromCamera(
      JSON.parse(orbitText) as Orbits,
      "apophis",
      site.t,
      cameraAt(site.rotation, site.t),
      loadPasses(JSON.parse(orbitText) as Orbits).place,
    )!;
    expect(Math.abs(hgMagnitude(H, G, view) - site.mag)).toBeLessThan(0.05);
  });
});

describe("viewMagnitude for Pluto", () => {
  const orbits = JSON.parse(orbitText) as Orbits;

  /* Horizons, COMMAND='999' CENTER='500@399' QUANTITIES='9': APmag 14.606 on 2026-11-27. The H, G system reads 0.42 to 0.57 magnitude too faint for Pluto, so the Almanac's V = -1.01 + 5 log10(r delta) (Urban and Seidelmann 2013, Table 10.6) is used and held to 0.07. */
  it("is within 0.07 magnitude of Horizons' APmag on 2026-11-27", () => {
    const t = 1_795_737_600_000;
    const view = bodyFromCamera(orbits, "pluto", t, cameraAt([0, 0], t))!;
    expect(
      Math.abs(viewMagnitude(orbits, "pluto", view, t) - 14.606),
    ).toBeLessThan(0.07);
  });
});
