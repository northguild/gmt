/// <reference types="vitest/globals" />

import { convertUtcToUnix } from "@northguild/gmt";
import { describe, expect, it } from "vitest";
import { CURATED_TIMEZONES } from "../../scripts/build-utils/build-utils";
import {
  antisolarPoint,
  subsolarPoint,
  wrapLongitude,
} from "./globe-terminator";
import {
  COORDINATES_BY_ID,
  GLOBE_PRIMARY_ZONES,
  resolveGlobeZones,
  rotationForZone,
} from "./globe-zones";
import { TZ_COORDINATES } from "./tz-coordinates";

/** UTC instant string -> epoch ms, for the terminator maths. */
function ms(utc: string): number {
  const value = convertUtcToUnix(utc, "milliseconds");
  if (value === null) throw new Error(`bad instant: ${utc}`);
  return value;
}

// ---------------------------------------------------------------------------
// Terminator / subsolar-point maths (globe-terminator.ts)
// ---------------------------------------------------------------------------

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
// ---------------------------------------------------------------------------

describe("TZ_COORDINATES", () => {
  it("covers the whole globe with plausible values", () => {
    expect(TZ_COORDINATES.length).toBeGreaterThan(250);
    for (const zone of TZ_COORDINATES) {
      expect(zone.lat).toBeGreaterThanOrEqual(-90);
      expect(zone.lat).toBeLessThanOrEqual(90);
      expect(zone.lng).toBeGreaterThanOrEqual(-180);
      expect(zone.lng).toBeLessThanOrEqual(180);
    }
  });

  it("places well-known zones correctly", () => {
    const nyc = COORDINATES_BY_ID.get("America/New_York");
    expect(nyc?.lat).toBeCloseTo(40.71, 1);
    expect(nyc?.lng).toBeCloseTo(-74.01, 1);
    const kathmandu = COORDINATES_BY_ID.get("Asia/Kathmandu");
    expect(kathmandu?.lat).toBeCloseTo(27.72, 1);
    expect(kathmandu?.lng).toBeCloseTo(85.32, 1);
  });
});

describe("GLOBE_PRIMARY_ZONES", () => {
  it("stays in step with the shared CURATED_TIMEZONES list", () => {
    for (const id of GLOBE_PRIMARY_ZONES) {
      expect(CURATED_TIMEZONES).toContain(id);
    }
    // Every curated zone that has a coordinate should be a primary marker.
    const withCoords = CURATED_TIMEZONES.filter((id) =>
      COORDINATES_BY_ID.has(id),
    );
    expect([...GLOBE_PRIMARY_ZONES].sort()).toEqual([...withCoords].sort());
  });
});

describe("resolveGlobeZones", () => {
  it("intersects the runtime list with the coordinate table", () => {
    const resolved = resolveGlobeZones([
      "America/New_York",
      "Europe/London",
      "Not/AZone",
    ]);
    expect(resolved.map((z) => z.id)).toEqual([
      "America/New_York",
      "Europe/London",
    ]);
    expect(resolved[0]?.primary).toBe(true);
  });

  it("falls back to the full table when the runtime list is empty", () => {
    expect(resolveGlobeZones([]).length).toBe(TZ_COORDINATES.length);
  });

  it("returns zones sorted by id", () => {
    // localeCompare, matching resolveGlobeZones's own comparator — plain
    // .sort() orders "-" vs "_" differently and would false-fail here.
    const ids = resolveGlobeZones([]).map((z) => z.id);
    expect(ids).toEqual([...ids].sort((a, b) => a.localeCompare(b)));
  });
});

describe("rotationForZone", () => {
  it("negates lng/lat so the zone rotates to centre", () => {
    expect(rotationForZone({ id: "x", lat: 35, lng: 139 })).toEqual([
      -139, -35,
    ]);
  });
});
