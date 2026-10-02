/// <reference types="vitest/globals" />

import { MAX_SEEDED_ZONES, permalinkOf, seededZones } from "./zone-planner";
import {
  decodeWidgetPermalink,
  encodeWidgetPermalink,
  seedFromLocation,
} from "./widget-permalink";

describe("seededZones", () => {
  it("reads the chat tool's array", () => {
    expect(seededZones({ zones: ["Asia/Tokyo", "Europe/London"] })).toEqual([
      "Asia/Tokyo",
      "Europe/London",
    ]);
  });

  it("reads a permalink's numbered keys in order, skipping gaps", () => {
    expect(
      seededZones({ zone1: "Asia/Tokyo", zone3: "Europe/London" }),
    ).toEqual(["Asia/Tokyo", "Europe/London"]);
  });

  it("drops blanks and repeats, and caps the count", () => {
    expect(
      seededZones({
        zones: ["Asia/Tokyo", " ", "Asia/Tokyo", "Europe/London"],
      }),
    ).toEqual(["Asia/Tokyo", "Europe/London"]);
    expect(
      seededZones({
        zones: Array.from({ length: 12 }, (_, i) => `Etc/Zone${i}`),
      }),
    ).toHaveLength(MAX_SEEDED_ZONES);
  });

  it("is empty when the seed names no zone, which leaves the defaults", () => {
    expect(seededZones({})).toEqual([]);
  });
});

describe("the planner's permalink", () => {
  it("is strings only, so seedFromLocation keeps every key", () => {
    const pinned = [
      "America/Argentina/Buenos_Aires",
      "America/Argentina/Salta",
      "America/Indiana/Indianapolis",
      "America/North_Dakota/New_Salem",
      "Pacific/Port_Moresby",
      "Atlantic/South_Georgia",
      "Antarctica/DumontDUrville",
      "America/Argentina/ComodRivadavia",
    ];
    const state = permalinkOf(pinned, "2026-03-08T06:45:00Z");
    for (const value of Object.values(state)) {
      expect(typeof value).toBe("string");
      expect(value.length).toBeLessThanOrEqual(64);
    }
    const url = encodeWidgetPermalink("planner", state);
    expect(url.startsWith("/tools/zone-planner/?")).toBe(true);
    const seeded = seedFromLocation("planner", url.slice(url.indexOf("?")));
    expect(seeded).toEqual(state);
    expect(seededZones(seeded)).toEqual(pinned);
    expect(decodeWidgetPermalink(url.slice(url.indexOf("?")))?.kind).toBe(
      "planner",
    );
  });
});
