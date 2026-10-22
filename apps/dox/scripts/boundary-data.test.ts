import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { TBB_TAG } from "../src/lib/data-credits";

/**
 * The three public boundary files are derived databases offered to the public, so each carries the
 * ODbL notice (ODbL 1.0 §4.2–4.4) as GeoJSON foreign members and names the release it came from.
 */
const APP = resolve(import.meta.dirname, "..");
const FILES = [
  "timezone-boundaries.json",
  "timezone-boundaries-globe.json",
  "timezone-boundaries-canada.json",
] as const;

interface Collection {
  type: string;
  source: string;
  attribution: string;
  license: string;
  licenseUrl: string;
  features: Array<{ type: string; properties: { tzid?: unknown } }>;
}

function load(name: string): Collection {
  return JSON.parse(
    readFileSync(resolve(APP, "public", name), "utf8"),
  ) as Collection;
}

describe.each(FILES)("public/%s", (name) => {
  const data = load(name);

  it("is a FeatureCollection carrying the ODbL notice", () => {
    expect(data.type).toBe("FeatureCollection");
    expect(data.license).toBe("ODbL-1.0");
    expect(data.licenseUrl).toBe(
      "https://opendatacommons.org/licenses/odbl/1-0/",
    );
    expect(data.attribution).toBe(
      "© OpenStreetMap contributors, timezone-boundary-builder",
    );
  });

  it("names the pinned release, never latest", () => {
    expect(data.source).toContain(`timezone-boundary-builder ${TBB_TAG}`);
    expect(data.source).not.toMatch(/latest/i);
  });

  it("gives every feature a string tzid", () => {
    expect(data.features.length).toBeGreaterThan(0);
    for (const f of data.features) {
      expect(f.type).toBe("Feature");
      expect(typeof f.properties.tzid).toBe("string");
    }
  });
});

describe("the Canada file", () => {
  it("holds exactly the zones in canada-zones.json", () => {
    const { tzdb, zones } = JSON.parse(
      readFileSync(resolve(APP, "src/lib/canada-zones.json"), "utf8"),
    ) as { tzdb: string; zones: string[] };
    expect(tzdb).toBe(TBB_TAG);
    expect(zones).toEqual([...zones].sort());
    const tzids = load("timezone-boundaries-canada.json")
      .features.map((f) => f.properties.tzid as string)
      .sort();
    expect(tzids).toEqual(zones);
  });

  it("stays within the 400 KB budget", () => {
    const bytes = readFileSync(
      resolve(APP, "public/timezone-boundaries-canada.json"),
    ).length;
    expect(bytes).toBeLessThanOrEqual(400 * 1024);
  });
});
