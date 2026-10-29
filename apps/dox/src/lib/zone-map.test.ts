// @vitest-environment jsdom
/**
 * The place labels of the zone map, for both checkers' configs: which labels show, what they say,
 * and where the stated anchors sit. The labels are read as text (they are `aria-hidden`; the shapes
 * carry the names); where they sit is checked on the stated anchors, not on a laid-out page.
 */
import { within } from "@testing-library/dom";
import { geoContains } from "d3-geo";
import { describe, expect, it } from "vitest";
import { expectNoAxeViolations } from "~/test/render-widget";
import { CANADA_MAP } from "./canada-map";
import { canadaTense, moroccoTense } from "./clock-change-tense.fixture";
import { MOROCCO_MAP } from "./morocco-map";
import {
  MAP_WIDTH,
  isZoneFeature,
  offsetAt,
  type BoundaryCollection,
  type MapZone,
} from "./zone-map";
import {
  LABEL_HEIGHT_PX,
  boxesIntersect,
  cityOf,
  labelBox,
  labelSize,
} from "./zone-map-labels";
import {
  NOW,
  drawZoneMap,
  loadBoundaries,
  mapQueries,
  ringsOf,
  zoneDeps,
} from "./zone-map.fixture";
import { isBeforeUtc } from "@northguild/gmt/utc/compare";

const WIDTHS = [400, 600, 800];

const CASES = [
  {
    name: "Canada",
    config: CANADA_MAP,
    boundaries: loadBoundaries("canada"),
    tense: canadaTense,
  },
  {
    name: "Morocco",
    config: MOROCCO_MAP,
    boundaries: loadBoundaries("morocco"),
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

/** The zones of the drawing, as the page's list holds them. */
const idsOf = (boundaries: BoundaryCollection) =>
  boundaries.features.filter(isZoneFeature).map((f) => f.properties.tzid);

async function draw(
  c: (typeof CASES)[number],
  rows: MapZone[] = rowsFor(c.boundaries),
) {
  const drawn = drawZoneMap({
    config: c.config,
    ids: idsOf(c.boundaries),
    rows,
    deps: zoneDeps(c.boundaries, c.tense),
  });
  await drawn.handle.ready;
  const { shape, listButton } = mapQueries(c.config);
  const frame = mapQueries(c.config).frame();
  /** A label is on show when its city is in the frame's text and not hidden. */
  const shown = (id: string) => {
    const found = within(frame).queryAllByText(cityOf(id));
    return found.some((el) => {
      try {
        expect(el).toBeVisible();
        return true;
      } catch {
        return false;
      }
    });
  };
  return { ...drawn, frame, shape, listButton, shown };
}

describe.each(CASES)("the labels on the $name map", (c) => {
  const rows = rowsFor(c.boundaries);

  it("shows the labelled zones, and only those, before anything is touched", async () => {
    const { shown } = await draw(c);
    for (const id of idsOf(c.boundaries))
      expect(shown(id), id).toBe(c.config.labelled.includes(id));
  });

  it("names the city with its offset, or the NO SIGNAL mark for a zone with no row", async () => {
    const lost = c.config.labelled[0]!;
    const { frame } = await draw(c, rowsFor(c.boundaries, [lost]));
    for (const id of c.config.labelled) {
      expect(within(frame).getAllByText(cityOf(id)).length, id).toBeGreaterThan(
        0,
      );
    }
    expect(within(frame).getAllByText("NO SIGNAL")).toHaveLength(1);
    const row = rows.find((r) => r.zone === c.config.labelled[1]);
    expect(
      within(frame).getAllByText(offsetAt(row!, NOW, isBeforeUtc)).length,
    ).toBeGreaterThan(0);
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

  it.each(WIDTHS)(
    "keeps the permanent labels apart, off the rings and inside the frame at %i px",
    (width) => {
      const projection = c.config.projection(
        c.boundaries,
        MAP_WIDTH,
        c.config.height,
      );
      const boxes = c.config.labelled.map((id) => {
        const at = projection([...c.config.anchors[id]!] as [number, number])!;
        const size = {
          ...labelSize(cityOf(id), "+00:00"),
          height: LABEL_HEIGHT_PX,
        };
        return {
          id,
          box: labelBox(at, size, MAP_WIDTH, c.config.height, width),
        };
      });
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
      for (const [id, ringAt] of ringsOf(c.config, c.boundaries)) {
        const ring = {
          left: (ringAt.x - ringAt.r) * scale,
          right: (ringAt.x + ringAt.r) * scale,
          top: (ringAt.y - ringAt.r) * scale,
          bottom: (ringAt.y + ringAt.r) * scale,
        };
        for (const { id: label, box } of boxes)
          expect(
            boxesIntersect(box, ring),
            `${label} covers the ring of ${id}`,
          ).toBe(false);
      }
    },
  );

  it("shows one passing label for the hovered zone, and drops it when the pointer leaves", async () => {
    const { shape, shown, user } = await draw(c);
    const others = idsOf(c.boundaries).filter(
      (id) => !c.config.labelled.includes(id),
    );
    const [other, another] = others as [string, string];
    await user.hover(shape(other));
    expect(shown(other)).toBe(true);
    // Moving to another zone swaps the passing label; it never adds a second one.
    await user.hover(shape(another));
    expect(shown(another)).toBe(true);
    expect(shown(other)).toBe(false);
    await user.unhover(shape(another));
    expect(shown(another)).toBe(false);
    for (const id of c.config.labelled) expect(shown(id), id).toBe(true);
  });

  it("keeps a pinned zone's label until another zone is pinned", async () => {
    const { shape, listButton, shown, user } = await draw(c);
    const [first, second] = idsOf(c.boundaries).filter(
      (id) => !c.config.labelled.includes(id),
    ) as [string, string];
    await user.click(shape(first));
    expect(shown(first)).toBe(true);
    await user.unhover(shape(first));
    expect(shown(first)).toBe(true);
    await user.click(listButton(second));
    expect(shown(second)).toBe(true);
    expect(shown(first)).toBe(false);
  });

  it("has no accessibility violations once drawn and once a zone is pinned", async () => {
    const { fixture, shape, user } = await draw(c);
    await expectNoAxeViolations(fixture.host);
    await user.click(shape(idsOf(c.boundaries)[0]!));
    await expectNoAxeViolations(fixture.host);
  });
});
