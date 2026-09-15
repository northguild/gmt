/// <reference types="vitest/globals" />

import { describe, expect, it } from "vitest";
import { gmtStats } from "../data/gmt-stats";
import { TIMEZONE_COORDINATES, TIMEZONES } from "./timezones";

describe("timezones", () => {
  it("has coordinates for every published CI zone", () => {
    for (const id of gmtStats.timezoneList) {
      expect(
        TIMEZONE_COORDINATES[id],
        `missing coordinates for ${id}`,
      ).toBeDefined();
    }
  });

  it("has no coordinates for a zone that isn't published", () => {
    const published = new Set(gmtStats.timezoneList);
    for (const id of Object.keys(TIMEZONE_COORDINATES)) {
      expect(published.has(id), `${id} is not in gmtStats.timezoneList`).toBe(
        true,
      );
    }
  });

  it("renders exactly the published zones, in order, and no extras", () => {
    expect(TIMEZONES.map((tz) => tz.id)).toEqual(gmtStats.timezoneList);
  });
});
