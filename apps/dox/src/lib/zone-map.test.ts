// @vitest-environment jsdom
/**
 * The place labels of the zone map, for both checkers' configs at frame widths 400, 600 and 800:
 * which labels show, where they sit, what they say, and that the drawing under them is unchanged.
 */
import type { TenseView } from "./clock-change-tense";
import { canadaTense, moroccoTense } from "./clock-change-tense.fixture";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { geoContains } from "d3-geo";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isBeforeUtc } from "@northguild/gmt/utc/compare";
import { convertUtcToPlainDateTime } from "@northguild/gmt/utc/convert";
import { CANADA_MAP } from "./canada-map";
import { renderCanadaClockChangeTemplate } from "./canada-clock-change-mount";
import { msToNextSecond } from "./clock-change-common";
import { MOROCCO_MAP } from "./morocco-map";
import { renderMoroccoClockChangeTemplate } from "./morocco-clock-change-mount";
import {
  MAP_WIDTH,
  isZoneFeature,
  mountZoneMap,
  offsetAt,
  type BoundaryCollection,
  type MapZone,
  type ZoneMapConfig,
  type ZoneMapDeps,
} from "./zone-map";
import {
  LABEL_HEIGHT_PX,
  boxesIntersect,
  cityOf,
  labelBox,
  labelSize,
  type Box,
} from "./zone-map-labels";

const NOW = "2026-10-22T12:00:00Z";
const WIDTHS = [400, 600, 800];

function load(file: string): BoundaryCollection {
  return JSON.parse(
    readFileSync(resolve(__dirname, `../../public/${file}`), "utf8"),
  ) as BoundaryCollection;
}

const CASES = [
  {
    name: "Canada",
    config: CANADA_MAP,
    boundaries: load("timezone-boundaries-canada.json"),
    template: () => renderCanadaClockChangeTemplate({ tense: canadaTense }),
    rootClass: ".gmt-canada",
    tense: canadaTense,
  },
  {
    name: "Morocco",
    config: MOROCCO_MAP,
    boundaries: load("timezone-boundaries-morocco.json"),
    template: () => renderMoroccoClockChangeTemplate({ tense: moroccoTense }),
    rootClass: ".gmt-morocco",
    tense: moroccoTense,
  },
] as const;

/** A fixture row for every zone of the drawing; the offsets are fixture values. */
function rowsFor(boundaries: BoundaryCollection, without: string[] = []) {
  return boundaries.features
    .filter(isZoneFeature)
    .map((f) => f.properties.tzid)
    .map((zone, i): MapZone => ({
      zone,
      offset: i % 2 === 0 ? "-05:00" : "+01:00",
      last: null,
      next: null,
      kind: "none",
    }))
    .filter((row) => !without.includes(row.zone));
}

function deps(boundaries: BoundaryCollection, tense: TenseView): ZoneMapDeps {
  return {
    tense: () => tense,
    responseNow: NOW,
    now: () => NOW,
    wall: (at, offset) => convertUtcToPlainDateTime(at, { timeZone: offset }),
    isBefore: isBeforeUtc,
    msToNextSecond,
    fetch: vi.fn(async () =>
      Response.json(boundaries),
    ) as unknown as typeof fetch,
    measure: () => 900,
    location: { href: "https://example.test/gmt/check/" },
    history: { replaceState: vi.fn() },
  };
}

type Case = (typeof CASES)[number];

async function mount(c: Case, rows: MapZone[]) {
  document.body.innerHTML = c.template();
  const root = document.querySelector<HTMLElement>(c.rootClass)!;
  const handle = mountZoneMap(
    root,
    rows,
    new AbortController().signal,
    deps(c.boundaries, c.tense),
    c.config,
  );
  await handle.ready;
  return { root, handle };
}

const labelOf = (root: HTMLElement, id: string) =>
  root.querySelector<HTMLElement>(`.gmt-zonemap-label[data-label-for="${id}"]`);
const shown = (root: HTMLElement) =>
  [...root.querySelectorAll<HTMLElement>(".gmt-zonemap-label")].filter(
    (l) => !l.hidden,
  );
const passing = (root: HTMLElement) =>
  shown(root).filter((l) => l.classList.contains("is-passing"));
const percent = (label: HTMLElement, name: string) =>
  parseFloat(label.style.getPropertyValue(name)) / 100;
const px = (label: HTMLElement, name: string) =>
  parseFloat(label.style.getPropertyValue(name));

/** The box a mounted label takes in a frame `frameWidth` px wide, from the numbers on the label. */
function boxOf(
  label: HTMLElement,
  config: ZoneMapConfig,
  frameWidth: number,
): Box {
  const anchor: [number, number] = [
    percent(label, "--ax") * MAP_WIDTH,
    percent(label, "--ay") * config.height,
  ];
  return labelBox(
    anchor,
    { width: px(label, "--lw"), height: px(label, "--lh") },
    MAP_WIDTH,
    config.height,
    frameWidth,
  );
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe.each(CASES)("the labels on the $name map", (c) => {
  const rows = rowsFor(c.boundaries);
  const zoneIds = rows.map((r) => r.zone);

  it("shows the labelled zones, and only those, before anything is touched", async () => {
    const { root } = await mount(c, rows);
    expect(
      shown(root)
        .map((l) => l.dataset.labelFor!)
        .sort(),
    ).toEqual([...c.config.labelled].sort());
    expect(passing(root)).toHaveLength(0);
  });

  it("names the city with its offset, or the NO SIGNAL mark for a zone with no row", async () => {
    const lost = c.config.labelled[0]!;
    const { root } = await mount(c, rowsFor(c.boundaries, [lost]));
    for (const id of c.config.labelled) {
      const label = labelOf(root, id)!;
      expect(label.getAttribute("aria-hidden")).toBe("true");
      expect(label.querySelector(".gmt-zonemap-label-city")!.textContent).toBe(
        cityOf(id),
      );
      const offset = label.querySelector(".gmt-zonemap-label-offset")!;
      const row = rows.find((r) => r.zone === id);
      if (id === lost) {
        expect(offset.querySelector(".gmt-playground-sentinel")).not.toBeNull();
      } else {
        expect(offset.textContent).toBe(offsetAt(row!, NOW, isBeforeUtc));
      }
    }
  });

  it("puts the city in capitals' source form: an underscore is a space", () => {
    expect(cityOf("Africa/El_Aaiun")).toBe("El Aaiun");
    expect(cityOf("America/Vancouver")).toBe("Vancouver");
  });

  it("states every anchor inside its own zone", () => {
    const features = new Map(
      c.boundaries.features
        .filter(isZoneFeature)
        .map((f) => [f.properties.tzid, f]),
    );
    for (const id of c.config.labelled) {
      const anchor = c.config.anchors[id];
      expect(anchor, `${id} has no anchor`).toBeDefined();
      const feature = features.get(id)!;
      expect(
        geoContains(feature as unknown as Parameters<typeof geoContains>[0], [
          anchor![0],
          anchor![1],
        ]),
        `${id}'s anchor is outside its zone`,
      ).toBe(true);
    }
  });

  it("puts every zone's passing label inside that zone's land", async () => {
    const { root, handle } = await mount(c, rows);
    const projection = c.config.projection(
      c.boundaries,
      MAP_WIDTH,
      c.config.height,
    );
    const features = new Map(
      c.boundaries.features
        .filter(isZoneFeature)
        .map((f) => [f.properties.tzid, f]),
    );
    for (const id of zoneIds) {
      handle.pin(id);
      const label = labelOf(root, id)!;
      const at = projection.invert!([
        percent(label, "--ax") * MAP_WIDTH,
        percent(label, "--ay") * c.config.height,
      ])!;
      expect(
        geoContains(
          features.get(id) as unknown as Parameters<typeof geoContains>[0],
          at,
        ),
        `${id}'s label is outside its land`,
      ).toBe(true);
    }
  });

  it.each(WIDTHS)(
    "keeps the permanent labels apart, off the rings and inside the frame at %i px",
    async (width) => {
      const { root } = await mount(c, rows);
      const labels = shown(root);
      const boxes = labels.map((l) => ({
        id: l.dataset.labelFor!,
        box: boxOf(l, c.config, width),
      }));
      const frameHeight = (c.config.height / MAP_WIDTH) * width;
      for (const { id, box } of boxes) {
        expect(box.left, id).toBeGreaterThanOrEqual(0);
        expect(box.top, id).toBeGreaterThanOrEqual(0);
        expect(box.right, id).toBeLessThanOrEqual(width);
        expect(box.bottom, id).toBeLessThanOrEqual(frameHeight);
      }
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++)
          expect(
            boxesIntersect(boxes[i]!.box, boxes[j]!.box),
            `${boxes[i]!.id} and ${boxes[j]!.id} overlap`,
          ).toBe(false);
      const scale = width / MAP_WIDTH;
      for (const ring of root.querySelectorAll(".gmt-zonemap-marker")) {
        const cx = Number(ring.getAttribute("cx")) * scale;
        const cy = Number(ring.getAttribute("cy")) * scale;
        const r = Number(ring.getAttribute("r")) * scale;
        const ringBox = {
          left: cx - r,
          right: cx + r,
          top: cy - r,
          bottom: cy + r,
        };
        for (const { id, box } of boxes)
          expect(
            boxesIntersect(box, ringBox),
            `${id} covers the ring of ${ring.getAttribute("data-tz-id")}`,
          ).toBe(false);
      }
    },
  );

  it("reserves the size of the longest offset, so a new offset moves nothing", async () => {
    const { root } = await mount(c, rows);
    for (const l of shown(root)) {
      const city = l.querySelector(".gmt-zonemap-label-city")!.textContent!;
      expect(px(l, "--lw")).toBeGreaterThanOrEqual(
        labelSize(city, "+00:00").width,
      );
      expect(px(l, "--lh")).toBe(LABEL_HEIGHT_PX);
    }
  });

  it("shows one passing label for the hovered zone, and drops it when the pointer leaves", async () => {
    const { root } = await mount(c, rows);
    const other = zoneIds.find((id) => !c.config.labelled.includes(id))!;
    const target = root.querySelector(
      `path.gmt-zonemap-shape[data-tz-id="${other}"]`,
    )!;
    target.dispatchEvent(new Event("pointerover", { bubbles: true }));
    expect(passing(root).map((l) => l.dataset.labelFor)).toEqual([other]);
    // Moving to another zone swaps the passing label; it never adds a second one.
    const another = zoneIds.find(
      (id) => id !== other && !c.config.labelled.includes(id),
    )!;
    root
      .querySelector(`path.gmt-zonemap-shape[data-tz-id="${another}"]`)!
      .dispatchEvent(new Event("pointerover", { bubbles: true }));
    expect(passing(root).map((l) => l.dataset.labelFor)).toEqual([another]);
    target.dispatchEvent(new Event("pointerout", { bubbles: true }));
    expect(passing(root)).toHaveLength(0);
    expect(shown(root)).toHaveLength(c.config.labelled.length);
  });

  it("keeps a pinned zone's label until another zone is pinned", async () => {
    const { root, handle } = await mount(c, rows);
    const [first, second] = zoneIds.filter(
      (id) => !c.config.labelled.includes(id),
    );
    handle.pin(first!);
    expect(passing(root).map((l) => l.dataset.labelFor)).toEqual([first]);
    root
      .querySelector(`path.gmt-zonemap-shape[data-tz-id="${first}"]`)!
      .dispatchEvent(new Event("pointerout", { bubbles: true }));
    expect(passing(root).map((l) => l.dataset.labelFor)).toEqual([first]);
    handle.pin(second!);
    expect(passing(root).map((l) => l.dataset.labelFor)).toEqual([second]);
  });

  it("leaves the land and the zone shapes as the drawing had them", async () => {
    const { root } = await mount(c, rows);
    expect(root.querySelectorAll("path.gmt-zonemap-land")).toHaveLength(1);
    expect(
      [...root.querySelectorAll("path.gmt-zonemap-shape")]
        .map((s) => (s as SVGPathElement).dataset.tzId)
        .sort(),
    ).toEqual(
      c.boundaries.features
        .filter(isZoneFeature)
        .map((f) => f.properties.tzid)
        .sort(),
    );
    expect(
      root.querySelector(".gmt-zonemap-labels")!.getAttribute("aria-hidden"),
    ).toBe("true");
  });
});
