// @vitest-environment jsdom
import { moroccoTense } from "./clock-change-tense.fixture";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { geoPath } from "d3-geo";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isBeforeUtc } from "@northguild/gmt/utc/compare";
import { convertUtcToPlainDateTime } from "@northguild/gmt/utc/convert";
import { msToNextSecond } from "./clock-change-common";
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
  mountZoneMap,
  renderPinPanelHtml,
  zoneListItemHtml,
  type BoundaryCollection,
  isZoneFeature,
  type MapZone,
  type ZoneMapDeps,
} from "./zone-map";

const NOW = "2026-10-22T12:00:00Z";
const FILE = resolve(
  __dirname,
  "../../public/timezone-boundaries-morocco.json",
);
const boundaries = JSON.parse(
  readFileSync(FILE, "utf8"),
) as BoundaryCollection & Record<string, unknown>;
const IDS = regionZones.zones;

/** Fixture rows: offsets are fixture values, never a claim about the tz data. */
const ZONES: MapZone[] = IDS.map((zone) => ({
  zone,
  offset: "+00:00",
  last: null,
  next: null,
  kind: "none" as const,
}));

function deps(over: Partial<ZoneMapDeps> = {}): ZoneMapDeps {
  return {
    tense: () => moroccoTense,
    responseNow: NOW,
    now: () => NOW,
    wall: (at, offset) => convertUtcToPlainDateTime(at, { timeZone: offset }),
    isBefore: isBeforeUtc,
    msToNextSecond,
    fetch: vi.fn(async () =>
      Response.json(boundaries),
    ) as unknown as typeof fetch,
    measure: () => 900,
    location: { href: "https://example.test/gmt/check/morocco/" },
    history: { replaceState: vi.fn() },
    ...over,
  };
}

/** The map section as the checker's markup builds it, from the shared pieces. */
function host(): HTMLElement {
  document.body.innerHTML =
    `<div class="gmt-morocco"><div data-role="map-section">` +
    `<div class="gmt-zonemap-map gmt-theme-dark" data-role="map" data-credits-id="morocco-data-credits"></div>` +
    `<div data-role="zone-scroll"><ul data-role="zone-list">${IDS.map(zoneListItemHtml).join("")}</ul></div>` +
    `<div data-role="pin">${renderPinPanelHtml()}</div>` +
    `</div></div>`;
  return document.querySelector<HTMLElement>(".gmt-morocco")!;
}

afterEach(() => {
  document.body.innerHTML = "";
});

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
    const root = host();
    const handle = mountZoneMap(
      root,
      ZONES,
      new AbortController().signal,
      deps(),
      MOROCCO_MAP,
    );
    await handle.ready;
    const rings = [
      ...root.querySelectorAll<SVGCircleElement>("circle.gmt-zonemap-marker"),
    ];
    const ids = rings.map((ring) => ring.dataset.tzId).sort();
    expect(ids).toContain("Europe/Gibraltar");
    expect(ids).toContain("Africa/Ceuta");
    expect(ids).not.toContain("Europe/Madrid");
    expect(ids).not.toContain("Africa/Casablanca");
    for (const ring of rings) {
      expect(ring.getAttribute("r")).toBe("6");
      expect(ring.getAttribute("tabindex")).toBe("-1");
      expect(ring.getAttribute("role")).toBe("button");
      expect(ring.getAttribute("aria-label")).toBe(
        `${ring.dataset.tzId}, ${classWords(
          MOROCCO_MAP,
          ring.dataset.tzId!,
          ZONES.find((z) => z.zone === ring.dataset.tzId),
          moroccoTense,
        )}`,
      );
    }
    root
      .querySelector('circle[data-tz-id="Europe/Gibraltar"]')!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(handle.pinned()).toBe("Europe/Gibraltar");
    expect(
      root
        .querySelector('circle[data-tz-id="Europe/Gibraltar"]')!
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      root
        .querySelector('button[data-tz-id="Europe/Gibraltar"]')!
        .getAttribute("aria-pressed"),
    ).toBe("true");
    // The ring is not a tab stop; the list is one.
    expect(
      root.querySelectorAll('[data-role="zone-list"] button[tabindex="0"]'),
    ).toHaveLength(1);
  });

  it("draws no two rings that touch, so a press cannot land on the wrong zone", async () => {
    const root = host();
    const handle = mountZoneMap(
      root,
      ZONES,
      new AbortController().signal,
      deps(),
      MOROCCO_MAP,
    );
    await handle.ready;
    const rings = [
      ...root.querySelectorAll<SVGCircleElement>("circle.gmt-zonemap-marker"),
    ].map((ring) => ({
      id: ring.dataset.tzId!,
      x: Number(ring.getAttribute("cx")),
      y: Number(ring.getAttribute("cy")),
      r: Number(ring.getAttribute("r")),
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
    const root = host();
    const handle = mountZoneMap(
      root,
      ZONES,
      new AbortController().signal,
      deps(),
      MOROCCO_MAP,
    );
    await handle.ready;
    expect(root.querySelectorAll("path.gmt-zonemap-shape")).toHaveLength(
      IDS.length,
    );
    expect(root.querySelector("#morocco-data-credits")).not.toBeNull();
  });
});

describe("a narrow section", () => {
  it("fetches nothing and still renders the list", async () => {
    const root = host();
    const fetchSpy = vi.fn(() => {
      throw new Error("a narrow section must not fetch");
    });
    const handle = mountZoneMap(
      root,
      ZONES,
      new AbortController().signal,
      deps({ measure: () => 375, fetch: fetchSpy as unknown as typeof fetch }),
      MOROCCO_MAP,
    );
    await handle.ready;
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(root.querySelector("svg")).toBeNull();
    expect(
      root.querySelectorAll('[data-role="zone-list"] button'),
    ).toHaveLength(IDS.length);
    expect(
      root.querySelector(
        '[data-role="zone-list"] [data-tz-id="Africa/Casablanca"] [data-role="kind"]',
      )?.textContent,
    ).toBe(
      "Stopped changing clocks on 20 September 2026 at 02:00 local time (01:00 UTC)",
    );
  });
});
