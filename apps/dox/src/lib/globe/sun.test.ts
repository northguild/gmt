/// <reference types="vitest/globals" />

/**
 * The low-precision solar position (Astronomical Almanac, "Approximate Solar
 * Coordinates"), which decides where day meets night on the globe.
 *
 * Checked against the astronomy rather than a golden value: the sun sits over the
 * equator at an equinox and over a tropic at a solstice, and its longitude tracks
 * noon. Moved here with the module itself in #289.
 */

import { convertUtcToUnix } from "@northguild/gmt";
import { describe, expect, it } from "vitest";
import { antisolarPoint, subsolarPoint, wrapLongitude } from "./sun";

/** UTC instant string -> epoch ms. No `Date`: that is banned repo-wide. */
function ms(utc: string): number {
  const value = convertUtcToUnix(utc, { epochUnit: "milliseconds" });
  if (value === null) throw new Error(`bad instant: ${utc}`);
  return value;
}

describe("subsolarPoint", () => {
  it("puts the sun near the equator at an equinox", () => {
    const { lat } = subsolarPoint(ms("2026-03-20T12:00:00Z"));
    expect(Math.abs(lat)).toBeLessThan(1.5);
  });

  it("puts the sun near the Tropic of Cancer at the June solstice", () => {
    const { lat } = subsolarPoint(ms("2026-06-21T12:00:00Z"));
    expect(lat).toBeGreaterThan(22.5);
    expect(lat).toBeLessThan(23.9);
  });

  it("puts the sun near the Tropic of Capricorn at the December solstice", () => {
    const { lat } = subsolarPoint(ms("2026-12-21T12:00:00Z"));
    expect(lat).toBeLessThan(-22.5);
    expect(lat).toBeGreaterThan(-23.9);
  });

  it("puts the subsolar meridian near Greenwich at noon UTC", () => {
    const { lng } = subsolarPoint(ms("2026-03-20T12:00:00Z"));
    expect(Math.abs(lng)).toBeLessThan(5);
  });

  it("puts the subsolar meridian near the antimeridian at midnight UTC", () => {
    const { lng } = subsolarPoint(ms("2026-03-20T00:00:00Z"));
    expect(Math.abs(lng)).toBeGreaterThan(175);
  });

  it("moves the subsolar meridian ~15° west per hour", () => {
    const noon = subsolarPoint(ms("2026-03-20T12:00:00Z")).lng;
    const onePm = subsolarPoint(ms("2026-03-20T13:00:00Z")).lng;
    expect(wrapLongitude(noon - onePm)).toBeGreaterThan(14);
    expect(wrapLongitude(noon - onePm)).toBeLessThan(16);
  });
});

describe("antisolarPoint", () => {
  it("is the antipode of the subsolar point", () => {
    const when = ms("2026-08-01T09:17:00Z");
    const sun = subsolarPoint(when);
    const night = antisolarPoint(when);
    expect(night.lat).toBeCloseTo(-sun.lat, 6);
    expect(Math.abs(wrapLongitude(night.lng - sun.lng))).toBeCloseTo(180, 4);
  });
});

describe("wrapLongitude", () => {
  it("normalises into [-180, 180)", () => {
    expect(wrapLongitude(190)).toBe(-170);
    expect(wrapLongitude(-190)).toBe(170);
    expect(wrapLongitude(540)).toBe(-180);
    expect(wrapLongitude(0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Zone list + coordinate resolution (globe-zones.ts)
