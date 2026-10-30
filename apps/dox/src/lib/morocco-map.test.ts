// @vitest-environment jsdom
import { statSync } from "node:fs";
import { resolve } from "node:path";
import { within } from "@testing-library/dom";
import { geoPath } from "d3-geo";
import { describe, expect, it, vi } from "vitest";
import { expectNoAxeViolations } from "~/test/render-widget";
import { moroccoTense } from "./clock-change-tense.fixture";
import {
  MAP_HEIGHT,
  MAP_MARKERS,
  MOROCCO_FRAME,
  MOROCCO_MAP,
  moroccoProjection,
  releaseOf,
} from "./morocco-map";
import regionZones from "./morocco-region-zones.json";
import {
  MAP_WIDTH,
  classWords,
  displayKind,
  largestPartPx,
  isZoneFeature,
  type MapZone,
} from "./zone-map";
import {
  drawZoneMap,
  loadBoundaries,
  mapQueries,
  ringsOf,
  zoneDeps,
} from "./zone-map.fixture";

const FILE = resolve(
  __dirname,
  "../../public/timezone-boundaries-morocco.json",
);
const boundaries = loadBoundaries("morocco");
const IDS = regionZones.zones;

/** Fixture rows: offsets are fixture values, never a claim about the tz data. */
const ZONES: MapZone[] = IDS.map((zone) => ({
  zone,
  offset: "+00:00",
  last: null,
  next: null,
  kind: "none" as const,
}));

async function draw(over: Parameters<typeof zoneDeps>[2] = {}) {
  const deps = zoneDeps(boundaries, moroccoTense, {
    location: { href: "https://example.test/gmt/check/morocco/" },
    ...over,
  });
  const drawn = drawZoneMap({
    config: MOROCCO_MAP,
    ids: IDS,
    rows: ZONES,
    deps,
  });
  await drawn.handle.ready;
  return { ...drawn, deps, ...mapQueries(MOROCCO_MAP) };
}

describe("the boundary file", () => {
  it("has exactly one feature for every zone in the zone file, and no other", () => {
    const tzids = boundaries.features
      .filter(isZoneFeature)
      .map((f) => f.properties.tzid);
    expect([...tzids].sort()).toEqual([...IDS].sort());
    expect(new Set(tzids).size).toBe(tzids.length);
    expect(IDS).toEqual([...IDS].sort());
    // The land beside Morocco that the box shows has a zone of its own (Mali, France).
    expect(IDS).toContain("Africa/Bamako");
    expect(IDS).toContain("Europe/Paris");
    expect(regionZones.tzdb).toBe("2026e");
  });

  it("carries the four notice members, names the pinned release, and fits the size limit", () => {
    for (const member of ["source", "attribution", "license", "licenseUrl"]) {
      expect(typeof boundaries[member]).toBe("string");
    }
    expect(boundaries.source).toContain("2026e");
    expect(boundaries.license).toBe("ODbL-1.0");
    // The formatted file under the 400 KB limit (the script's compact budget is 300 KiB).
    expect(statSync(FILE).size).toBeLessThan(409600);
  });

  it("leaves out Atlantic/Azores, whose shape lies west of the frame", () => {
    expect(IDS).not.toContain("Atlantic/Azores");
  });
});

describe("the projection", () => {
  it("fits the frame to the 800 by height box, and Casablanca projects inside it", () => {
    const projection = moroccoProjection();
    const [west, south, east, north] = MOROCCO_FRAME;
    const corners: [number, number][] = [
      [west, south],
      [east, south],
      [west, north],
      [east, north],
      [(west + east) / 2, north],
      [(west + east) / 2, south],
    ];
    for (const point of corners) {
      const [x, y] = projection(point)!;
      expect(x).toBeGreaterThanOrEqual(-0.5);
      expect(x).toBeLessThanOrEqual(MAP_WIDTH + 0.5);
      expect(y).toBeGreaterThanOrEqual(-0.5);
      expect(y).toBeLessThanOrEqual(MAP_HEIGHT + 0.5);
    }
    const [x, y] = projection(
      MAP_MARKERS["Africa/Casablanca"]!.slice() as [number, number],
    )!;
    expect(x).toBeGreaterThan(0);
    expect(x).toBeLessThan(MAP_WIDTH);
    expect(y).toBeGreaterThan(0);
    expect(y).toBeLessThan(MAP_HEIGHT);
  });

  it("is the rounded height of the frame projected at the drawing's width", () => {
    const [west, south, east, north] = MOROCCO_FRAME;
    const edge: [number, number][] = [];
    for (let lon = west; lon <= east; lon += 0.5)
      edge.push([lon, south], [lon, north]);
    for (let lat = south; lat <= north; lat += 0.5)
      edge.push([west, lat], [east, lat]);
    const projection = moroccoProjection(undefined, MAP_WIDTH, 100_000);
    const ys = edge.map((p) => projection(p)![1]);
    // With a box far taller than the frame, the width binds, so the spread of y is the frame's
    // height at width 800.
    const spread = Math.max(...ys) - Math.min(...ys);
    expect(Math.round(spread / 10) * 10).toBe(MAP_HEIGHT);
    expect(MOROCCO_MAP.height).toBe(MAP_HEIGHT);
  });

  it("puts Madrid north-east of Casablanca and Lisbon west of Madrid", () => {
    const projection = moroccoProjection();
    const at = (id: string) =>
      projection(MAP_MARKERS[id]!.slice() as [number, number])!;
    expect(at("Europe/Madrid")[1]).toBeLessThan(at("Africa/Casablanca")[1]);
    expect(at("Europe/Lisbon")[0]).toBeLessThan(at("Europe/Madrid")[0]);
  });
});

describe("the config", () => {
  it("lists a marker coordinate for exactly the ids the zone file gives coordinates for", () => {
    expect(Object.keys(regionZones.coords).sort()).toEqual([...IDS].sort());
    expect(Object.keys(MOROCCO_MAP.markers!).sort()).toEqual(
      Object.keys(regionZones.coords).sort(),
    );
    expect(MOROCCO_MAP.markerMinPx).toBe(12);
  });

  it("states the two Moroccan zones as stopped, whatever the server says", () => {
    const old: MapZone = {
      ...ZONES[0]!,
      zone: "Africa/Casablanca",
      kind: "changes-after",
    };
    expect([...MOROCCO_MAP.stopped].sort()).toEqual([
      "Africa/Casablanca",
      "Africa/El_Aaiun",
    ]);
    expect(displayKind(MOROCCO_MAP, "Africa/Casablanca", old)).toBe("stopped");
    expect(displayKind(MOROCCO_MAP, "Europe/Lisbon", undefined)).toBe(
      "no-data",
    );
    expect(
      classWords(MOROCCO_MAP, "Africa/El_Aaiun", undefined, moroccoTense),
    ).toBe(
      "Stopped changing clocks on 20 September 2026 at 02:00 local time (01:00 UTC)",
    );
    expect(releaseOf("Africa/El_Aaiun")).toBe("2026c");
    expect(releaseOf("Europe/Madrid")).toBeNull();
  });

  it("serves the file from the site base, never a bare root path", () => {
    expect(MOROCCO_MAP.boundariesUrl).toMatch(
      /timezone-boundaries-morocco\.json$/,
    );
  });
});

describe("the small-shape rings", () => {
  it("measures the largest part of a shape, so Ceuta and Melilla count as two specks", () => {
    const path = geoPath(moroccoProjection());
    const size = (id: string) =>
      largestPartPx(
        boundaries.features.find((f) => f.properties.tzid === id)!,
        path,
      );
    expect(size("Europe/Gibraltar")).toBeLessThan(12);
    expect(size("Africa/Ceuta")).toBeLessThan(12);
    expect(size("Europe/Madrid")).toBeGreaterThan(12);
    expect(size("Africa/Casablanca")).toBeGreaterThan(12);
  });
  it("draws a ring only for the small zones, and pressing it pins its zone", async () => {
    const { handle, shape, listButton, user } = await draw();
    const rings = ringsOf(MOROCCO_MAP, boundaries);
    expect([...rings.keys()]).toContain("Europe/Gibraltar");
    expect([...rings.keys()]).toContain("Africa/Ceuta");
    expect([...rings.keys()]).not.toContain("Europe/Madrid");
    expect([...rings.keys()]).not.toContain("Africa/Casablanca");
    for (const id of rings.keys()) {
      const row = ZONES.find((z) => z.zone === id);
      expect(shape(id)).toHaveAccessibleName(
        `${id}, ${classWords(MOROCCO_MAP, id, row, moroccoTense)}`,
      );
      expect(shape(id)).toHaveAttribute("tabindex", "-1");
    }
    await user.click(shape("Europe/Gibraltar"));
    expect(handle.pinned()).toBe("Europe/Gibraltar");
    expect(shape("Europe/Gibraltar")).toBePressed();
    expect(listButton("Europe/Gibraltar")).toBePressed();
    await expectNoAxeViolations(document.body);
  });

  it("draws no two rings that touch, so a press cannot land on the wrong zone", () => {
    const rings = [...ringsOf(MOROCCO_MAP, boundaries)].map(([id, ring]) => ({
      id,
      ...ring,
    }));
    expect(rings.length).toBeGreaterThanOrEqual(2);
    for (const [index, a] of rings.entries()) {
      for (const b of rings.slice(index + 1)) {
        const gap = Math.hypot(a.x - b.x, a.y - b.y) - (a.r + b.r);
        // A circle that merely touches still shares a boundary pixel: ask for a clear gap.
        expect(gap, `${a.id} and ${b.id}`).toBeGreaterThan(1);
      }
    }
  });

  it("draws the shapes of every zone in the file and the credits button in Morocco's own id", async () => {
    const { svg, frame } = await draw();
    for (const id of IDS) {
      expect(
        within(svg()!).getAllByRole("button", {
          name: new RegExp(`^${id},`),
        }).length,
      ).toBeGreaterThan(0);
    }
    expect(
      within(frame()).getByRole("button", { name: "Data credits" }),
    ).toHaveAttribute("popovertarget", "morocco-data-credits");
  });
});

describe("a narrow section", () => {
  it("fetches nothing and still renders the list", async () => {
    const fetchSpy = vi.fn(() => {
      throw new Error("a narrow section must not fetch");
    });
    const { svg, listButtons, listButton } = await draw({
      measure: () => 375,
      fetch: fetchSpy as unknown as typeof fetch,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(svg()).not.toBeInTheDocument();
    expect(listButtons()).toHaveLength(IDS.length);
    expect(listButton("Africa/Casablanca")).toHaveTextContent(
      "Stopped changing clocks on 20 September 2026 at 02:00 local time (01:00 UTC)",
    );
  });
});
