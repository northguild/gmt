/**
 * The Dox globe's zone data: the generated coordinate table, the curated set the
 * globe labels, and how the two are intersected with the runtime's own zone list.
 *
 * The engine's own maths is tested inside `globe/` — the camera against d3, the
 * geometry and triangulation against the shipped datasets, the controller under a
 * fake clock, and the sun in `globe/sun.test.ts`.
 */

import { CURATED_TIMEZONES } from "./curated-timezones";
import {
  COORDINATES_BY_ID,
  GLOBE_PRIMARY_ZONES,
  resolveGlobeZones,
  rotationForZone,
} from "./globe-zones";
import { TZ_COORDINATES } from "./tz-coordinates";
import { lookSwitchOffered } from "./globe";

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

describe("lookSwitchOffered", () => {
  const cases = [true, false].flatMap((photo) =>
    [true, false].flatMap((sky) =>
      [true, false].flatMap((contrast) =>
        [true, false].map((forced) => ({ photo, sky, contrast, forced })),
      ),
    ),
  );
  it.each(cases)(
    "photo $photo, sky $sky, contrast $contrast, forced $forced",
    ({ photo, sky, contrast, forced }) => {
      expect(
        lookSwitchOffered({
          imagery: photo ? 1 : 0,
          renderer: photo ? "webgpu" : "canvas2d",
          skyTextured: sky,
          contrast,
          forced,
        }),
      ).toBe((photo || sky) && !contrast && !forced);
    },
  );

  it("needs both WebGPU and imagery for the photograph", () => {
    const base = { skyTextured: false, contrast: false, forced: false };
    expect(
      lookSwitchOffered({ ...base, imagery: 0.4, renderer: "webgpu" }),
    ).toBe(true);
    expect(lookSwitchOffered({ ...base, imagery: 0, renderer: "webgpu" })).toBe(
      false,
    );
    expect(
      lookSwitchOffered({ ...base, imagery: 1, renderer: "canvas2d" }),
    ).toBe(false);
  });
});
