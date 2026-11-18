import { afterEach, describe, expect, it } from "vitest";
import { zoneMatrixSummary } from "~/data/zone-matrix";
import { getPlanetZones, PLANET_ZONES, setPlanetZones } from "./places";
import { wirePlanetZones } from "./planet-zones";

afterEach(() => setPlanetZones(PLANET_ZONES));

describe("wirePlanetZones", () => {
  it("takes the zone matrix's zones, all ten of GMT's CI zones", () => {
    wirePlanetZones();
    expect(getPlanetZones()).toEqual(zoneMatrixSummary.zones);
    expect(getPlanetZones()).toHaveLength(10);
  });

  it("takes a list it is given", () => {
    wirePlanetZones(["Asia/Tokyo", "Europe/Helsinki"]);
    expect(getPlanetZones()).toEqual(["Asia/Tokyo", "Europe/Helsinki"]);
  });

  it("leaves the default when there is no list, and throws on a zone the map lacks", () => {
    wirePlanetZones([]);
    expect(getPlanetZones()).toEqual(PLANET_ZONES);
    expect(() => wirePlanetZones(["Nowhere/Land"])).toThrow();
  });
});
