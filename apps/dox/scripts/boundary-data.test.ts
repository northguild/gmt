import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { geoContains, geoPath } from "d3-geo";
import { describe, expect, it } from "vitest";
import { NE_TAG, TBB_TAG } from "../src/lib/data-credits";
import { CANADA_MAP } from "../src/lib/canada-map";
import { MOROCCO_MAP } from "../src/lib/morocco-map";
import { MAP_WIDTH } from "../src/lib/zone-map";
import type { BoundaryCollection } from "../src/lib/zone-map";

/**
 * The three public boundary files are derived databases offered to the public, so each carries the
 * ODbL notice (ODbL 1.0 §4.2–4.4) as GeoJSON foreign members and names the release it came from.
 */
const APP = resolve(import.meta.dirname, "..");
const FILES = [
  "timezone-boundaries.json",
  "timezone-boundaries-globe.json",
  "timezone-boundaries-canada.json",
  "timezone-boundaries-morocco.json",
] as const;

/** `land_frame` of each region row, read from the script that writes the files. */
function landFrames(): Record<string, [number, number, number, number]> {
  const text = readFileSync(
    resolve(APP, "scripts/prepare-region-boundaries.py"),
    "utf8",
  );
  const frames: Record<string, [number, number, number, number]> = {};
  for (const block of text.split(/\n    "(?=canada|morocco)/).slice(1)) {
    const region = block.slice(0, block.indexOf('"'));
    const m = block.match(/"land_frame": \(([^)]*)\)/);
    frames[`timezone-boundaries-${region}.json`] = m![1]!
      .split(",")
      .map(Number) as [number, number, number, number];
  }
  return frames;
}
const LAND_FRAMES = landFrames();

interface Collection {
  type: string;
  source: string;
  attribution: string;
  license: string;
  licenseUrl: string;
  landSource?: string;
  features: Array<{
    type: string;
    properties: { tzid?: unknown; land?: unknown };
    geometry: { type: string; coordinates: unknown };
  }>;
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

  it("gives every feature a string tzid (the region files' land feature aside)", () => {
    expect(data.features.length).toBeGreaterThan(0);
    for (const f of data.features.filter(
      (f) => f.properties.land === undefined,
    )) {
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
      .features.filter((f) => f.properties.land === undefined)
      .map((f) => f.properties.tzid as string)
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

/**
 * The coastline rule: the land is Natural Earth's, each zone is cut back to it, and the land no
 * zone covers is one feature, written first. The points were checked against `ne_10m_land` itself.
 */
describe.each([
  {
    name: "timezone-boundaries-canada.json",
    seaPoints: {
      "Hudson Bay": [-85, 60],
      "Viscount Melville Sound (Arctic, between islands)": [-108, 74.5],
      "Barrow Strait (Arctic, between islands)": [-96, 74.2],
    },
    landPoints: { "the United States": [-100, 45], Greenland: [-40, 72] },
  },
  {
    name: "timezone-boundaries-morocco.json",
    seaPoints: {
      "the Atlantic between Tenerife and Gran Canaria": [-16.1, 28.1],
    },
    // Every piece of land in the drawn box has a zone, so none is left for the land feature.
    landPoints: {},
  },
])("the land in public/$name", ({ name, seaPoints, landPoints }) => {
  const data = load(name);
  const features = data.features as unknown as Array<{
    properties: { tzid?: string; land?: string };
  }>;
  const land = data.features[0]!;
  const asFeature = (f: (typeof data.features)[number]) =>
    f as unknown as Parameters<typeof geoContains>[0];

  it("is one land feature, first, with no tzid", () => {
    expect(land.properties).toEqual({ land: "other" });
    expect(
      features.filter((f) => f.properties.land !== undefined),
    ).toHaveLength(1);
    expect(
      features.slice(1).every((f) => typeof f.properties.tzid === "string"),
    ).toBe(true);
  });

  it("names its coastline source and the tag", () => {
    expect(data.landSource).toContain("ne_10m_land");
    expect(data.landSource).toContain(NE_TAG);
  });

  it.each(Object.entries(seaPoints))(
    "%s is sea: in no feature",
    (_label, point) => {
      for (const f of data.features)
        expect(geoContains(asFeature(f), point as [number, number])).toBe(
          false,
        );
    },
  );

  it.each(Object.entries(landPoints))(
    "%s is land outside the zones: in the land feature only",
    (_label, point) => {
      expect(geoContains(asFeature(land), point as [number, number])).toBe(
        true,
      );
      for (const f of data.features.slice(1))
        expect(geoContains(asFeature(f), point as [number, number])).toBe(
          false,
        );
    },
  );
});

/**
 * The land frame must cover the whole drawn box, or a land edge would end inside it. Sample the
 * box's edge every 10 px, invert each point with the projection and test it against the frame.
 */
describe.each([
  {
    label: "Canada",
    config: CANADA_MAP,
    file: "timezone-boundaries-canada.json",
  },
  {
    label: "Morocco",
    config: MOROCCO_MAP,
    file: "timezone-boundaries-morocco.json",
  },
])("the drawn box of the $label map", ({ config, file }) => {
  it("lies inside the region's land_frame", () => {
    const frame = LAND_FRAMES[file]!;
    const projection = config.projection(
      load(file) as unknown as BoundaryCollection,
      MAP_WIDTH,
      config.height,
    );
    const outside: string[] = [];
    const check = (x: number, y: number) => {
      const at = projection.invert?.([x, y]);
      if (!at) return outside.push(`${x},${y}: no inverse`);
      const [lon, lat] = at;
      if (lon < frame[0] || lon > frame[2] || lat < frame[1] || lat > frame[3])
        outside.push(`${x},${y} -> ${lon.toFixed(2)},${lat.toFixed(2)}`);
    };
    for (let t = 0; t <= MAP_WIDTH; t += 10) {
      check(t, 0);
      check(t, config.height);
    }
    for (let t = 0; t <= config.height; t += 10) {
      check(0, t);
      check(MAP_WIDTH, t);
    }
    expect(outside).toEqual([]);
  });
});

/**
 * The map draws a zone for every piece of land in its box: no point of the box lies on land that
 * belongs to no zone, and every zone in the file has land inside the box.
 */
describe.each([
  {
    label: "Morocco",
    config: MOROCCO_MAP,
    file: "timezone-boundaries-morocco.json",
  },
])("the land in the drawn box of the $label map", ({ config, file }) => {
  const data = load(file);
  const projection = config.projection(
    data as unknown as BoundaryCollection,
    MAP_WIDTH,
    config.height,
  );
  const asFeature = (f: (typeof data.features)[number]) =>
    f as unknown as Parameters<typeof geoContains>[0];

  it("has no land without a zone: no pixel of the box lies on the land feature", () => {
    const land = asFeature(data.features[0]!);
    const bare: string[] = [];
    for (let x = 0; x <= MAP_WIDTH; x += 4)
      for (let y = 0; y <= config.height; y += 4) {
        const at = projection.invert?.([x, y]);
        if (at && geoContains(land, at)) bare.push(`${x},${y}`);
      }
    expect(bare).toEqual([]);
  });

  it.each([
    ["Tunisia", [8.5, 34]],
    ["northern Niger", [8, 20.5]],
  ] as const)(
    "does not store %s, whose zone lies outside the box",
    (_label, point) => {
      for (const f of data.features)
        expect(geoContains(asFeature(f), [...point])).toBe(false);
    },
  );

  it("gives every zone land inside the box", () => {
    const path = geoPath(projection);
    // A shape wholly outside the clip extent has no bounds.
    const empty = data.features
      .slice(1)
      .filter((f) => Number.isNaN(path.bounds(asFeature(f))[0]![0]))
      .map((f) => f.properties.tzid);
    expect(empty).toEqual([]);
  });
});
