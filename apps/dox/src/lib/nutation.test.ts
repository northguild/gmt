import { describe, expect, it } from "vitest";
import { trueCamera } from "./nutation";

const RAD = Math.PI / 180;
/** Apophis's 2029 pass, 2029-04-13T21:46Z. */
const PASS_MS = 1_870_811_160_000;

describe("trueCamera", () => {
  const camera: [number, number, number] = [6.61, 0, 0];
  const moved = trueCamera(camera, PASS_MS);

  it("keeps the camera's distance from the centre", () => {
    expect(Math.hypot(...moved)).toBeCloseTo(6.61, 12);
  });

  it("moves it by arcseconds, never by degrees", () => {
    const cos = moved[0] / 6.61;
    const arcseconds = (Math.acos(cos) / RAD) * 3600;
    expect(arcseconds).toBeGreaterThan(1);
    expect(arcseconds).toBeLessThan(20);
  });

  it("puts the pole 6.6 arcseconds off the mean one in April 2029 (nutation in longitude 15.8 times sin of the obliquity, with 1.95 in obliquity)", () => {
    const pole = trueCamera(
      [0, 0, 1],
      1_870_732_800_000 /* 2029-04-13T00:00Z */,
    );
    const arcseconds = Math.hypot(pole[0], pole[1]) * (3600 / RAD);
    expect(arcseconds).toBeGreaterThan(6.2);
    expect(arcseconds).toBeLessThan(7);
  });

  it("is the same turn at the same instant", () => {
    expect(trueCamera(camera, PASS_MS)).toEqual(trueCamera(camera, PASS_MS));
  });
});
