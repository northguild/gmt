// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import { describe, expect, it } from "vitest";
import { isBeforeUtc } from "@northguild/gmt/utc/compare";
import { expectNoAxeViolations } from "~/test/render-widget";
import {
  MAP_HEIGHT,
  CANADA_MAP,
  canadaProjection,
  releaseOf,
} from "./canada-map";
import { canadaTense } from "./clock-change-tense.fixture";
import {
  MAP_WIDTH,
  classCounts,
  classWords,
  displayKind,
  isDataStale,
  lastText,
  nextText,
  offsetAt,
  offsetWords,
  releaseWords,
  isZoneFeature,
  type MapZone,
} from "./zone-map";
import { STOPPED_ZONES } from "./canada-clock-change";
import {
  NOW,
  drawZoneMap,
  loadBoundaries,
  mapQueries,
  zoneDeps,
} from "./zone-map.fixture";

const boundaries = loadBoundaries("canada");
const IDS = boundaries.features
  .filter(isZoneFeature)
  .map((f) => f.properties.tzid);

/** Fixture rows: offsets are fixture values, never a claim about the tz data. */
const ZONES: MapZone[] = [
  {
    zone: "America/Winnipeg",
    offset: "-06:00",
    last: {
      instant: "2026-03-08T08:00:00Z",
      offsetBefore: "-06:00",
      offsetAfter: "-05:00",
    },
    next: null,
    kind: "stopped",
  },
  {
    zone: "America/Toronto",
    offset: "-04:00",
    last: null,
    next: {
      instant: "2026-11-01T06:00:00Z",
      offsetBefore: "-04:00",
      offsetAfter: "-05:00",
    },
    kind: "changes-after",
  },
  {
    zone: "America/Regina",
    offset: "-06:00",
    last: null,
    next: null,
    kind: "none",
  },
];

/** Renders the Canada section over `IDS` and waits for the drawing. */
async function draw(over: Parameters<typeof zoneDeps>[2] = {}) {
  const deps = zoneDeps(boundaries, canadaTense, {
    location: {
      href: "https://example.test/gmt/check/canada-2026-clock-change/",
    },
    ...over,
  });
  const drawn = drawZoneMap({
    config: CANADA_MAP,
    ids: IDS,
    rows: ZONES,
    deps,
  });
  await drawn.handle.ready;
  return { ...drawn, deps, ...mapQueries(CANADA_MAP) };
}

describe("the projection", () => {
  it("fits the drawing's box with the inset, and the centre point falls near its middle", () => {
    const projection = canadaProjection(boundaries);
    const [x, y] = projection([-91.866667, 63.390675])!;
    // EPSG:3347's origin projects to the middle of the box horizontally; fitExtent centres the
    // shapes' bounds, not the origin, so the vertical position follows the data.
    expect(Math.abs(x! - MAP_WIDTH / 2)).toBeLessThan(MAP_WIDTH * 0.1);
    expect(y).toBeGreaterThan(0);
    expect(y).toBeLessThan(MAP_HEIGHT);
  });

  it("puts Vancouver west of Winnipeg", () => {
    const projection = canadaProjection(boundaries);
    const vancouver = projection([-123.12, 49.28])!;
    const winnipeg = projection([-97.14, 49.9])!;
    expect(vancouver[0]).toBeLessThan(winnipeg[0]);
  });
});

describe("the text", () => {
  it("says none in the two years around now when a change is null", () => {
    const toronto = ZONES[1]!;
    expect(lastText(toronto, NOW)).toBe("none in 2025 or 2026");
    expect(nextText(ZONES[0]!, NOW)).toBe("none in 2026 or 2027");
    expect(nextText(toronto, NOW)).toContain("2026-11-01 06:00 UTC");
  });

  it("names the class, or no data for a zone with no row", () => {
    expect(
      classWords(CANADA_MAP, "America/Winnipeg", ZONES[0], canadaTense),
    ).toBe(
      "Stops changing clocks on 1 November 2026 at 02:00 local time (07:00 UTC)",
    );
    expect(
      classWords(CANADA_MAP, "America/Toronto", ZONES[1], canadaTense),
    ).toBe("Still changes clocks");
    expect(
      classWords(CANADA_MAP, "America/Regina", ZONES[2], canadaTense),
    ).toBe("Never changes clocks");
    expect(
      classWords(CANADA_MAP, "America/Halifax", undefined, canadaTense),
    ).toBe("no data");
  });

  it("colours the four stopped zones from the page's own facts, whatever the server says", () => {
    const old: MapZone = { ...ZONES[1]!, zone: "America/Vancouver" };
    expect(displayKind(CANADA_MAP, "America/Vancouver", old)).toBe("stopped");
    expect(displayKind(CANADA_MAP, "America/Vancouver", undefined)).toBe(
      "stopped",
    );
    expect(displayKind(CANADA_MAP, "America/Toronto", ZONES[1])).toBe(
      "changes-after",
    );
    expect(isDataStale(STOPPED_ZONES, [old])).toBe(true);
    expect(
      isDataStale(STOPPED_ZONES, [{ ...old, kind: "stopped" }, ZONES[1]!]),
    ).toBe(false);
    const rows = new Map([
      [old.zone, old],
      ["America/Toronto", ZONES[1]!],
      ["America/Regina", ZONES[2]!],
    ]);
    expect(
      classCounts(
        CANADA_MAP,
        [
          "America/Vancouver",
          "America/Toronto",
          "America/Regina",
          "America/Edmonton",
        ],
        rows,
      ),
    ).toEqual({ stopped: 2, "changes-after": 1, none: 1 });
  });

  it("gives a release only to a stopped zone in the probe", () => {
    expect(releaseOf("America/Winnipeg")).toBe("2026e");
    expect(releaseOf("America/Toronto")).toBeNull();
  });

  it("switches offset at the next change", () => {
    const toronto = ZONES[1]!;
    expect(offsetAt(toronto, "2026-10-31T00:00:00Z", isBeforeUtc)).toBe(
      "-04:00",
    );
    expect(offsetAt(toronto, "2026-11-01T06:00:00Z", isBeforeUtc)).toBe(
      "-05:00",
    );
  });
});
describe("the shapes", () => {
  it("names every shape by its zone and class, and a zone with no row has no data", async () => {
    const { shape, listButton } = await draw();
    for (const id of IDS) {
      const row = ZONES.find((z) => z.zone === id);
      expect(shape(id)).toHaveAccessibleName(
        `${id}, ${classWords(CANADA_MAP, id, row, canadaTense)}`,
      );
    }
    expect(listButton("America/Halifax")).toHaveTextContent("no data");
  });

  it("states every shape as a button that is not a tab stop of its own", async () => {
    const { shape, listButtons } = await draw();
    for (const id of IDS) expect(shape(id)).toHaveAttribute("tabindex", "-1");
    // The zone list is the keyboard path: one tab stop.
    expect(
      listButtons().filter((b) => (b as HTMLButtonElement).tabIndex === 0),
    ).toHaveLength(1);
  });

  it("pins nothing for a press on the land around the zones", async () => {
    const { handle, svg, user } = await draw();
    await user.click(svg()!);
    expect(handle.pinned()).toBeNull();
  });
});

describe("pinning", () => {
  it("pins from the list by Enter on a focused button, and a shape click pins the same zone", async () => {
    const { handle, listButton, shape, user } = await draw();
    listButton("America/Toronto").focus();
    await user.keyboard("{Enter}");
    expect(handle.pinned()).toBe("America/Toronto");
    expect(listButton("America/Toronto")).toBePressed();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Pinned America/Toronto. Still changes clocks.",
    );

    await user.click(shape("America/Winnipeg"));
    expect(handle.pinned()).toBe("America/Winnipeg");
    expect(listButton("America/Winnipeg")).toBePressed();
    expect(listButton("America/Toronto")).not.toBePressed();
    expect(shape("America/Winnipeg")).toBePressed();
    expect(shape("America/Toronto")).not.toBePressed();
  });

  it("moves along the list with the arrow keys, Home and End, on one tab stop, and wraps", async () => {
    const { listButtons, user } = await draw();
    const buttons = listButtons();
    const stops = () =>
      buttons.filter((b) => (b as HTMLButtonElement).tabIndex === 0);
    expect(stops()).toHaveLength(1);
    // From the scroll region, one Tab reaches the list's one stop.
    screen
      .getByRole("region", { name: "canada time zones, scrollable list" })
      .focus();
    await user.tab();
    expect(buttons[0]).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(buttons[1]).toHaveFocus();
    expect(stops()).toEqual([buttons[1]]);
    await user.keyboard("{End}");
    expect(buttons[buttons.length - 1]).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(buttons[0]).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(buttons[buttons.length - 1]).toHaveFocus();
    await user.keyboard("{Home}");
    expect(buttons[0]).toHaveFocus();
  });

  it("writes ?zone= and reads it back on load", async () => {
    const { handle, deps } = await draw();
    handle.pin("America/Regina");
    expect(deps.history!.replaceState).toHaveBeenCalledWith(
      null,
      "",
      "https://example.test/gmt/check/canada-2026-clock-change/?zone=America%2FRegina",
    );
  });

  it("opens pinned on a ?zone= it knows, and ignores one it does not", async () => {
    const known = await draw({
      location: { href: "https://example.test/x/?zone=America/Winnipeg" },
    });
    expect(known.handle.pinned()).toBe("America/Winnipeg");
    expect(known.listButton("America/Winnipeg")).toBePressed();
  });

  it("ignores a ?zone= that is not a zone of the list", async () => {
    const { handle } = await draw({
      location: { href: "https://example.test/x/?zone=Nowhere/Land" },
    });
    expect(handle.pinned()).toBeNull();
  });

  it("shows the null texts and the release on the panel", async () => {
    const { listButton, user } = await draw();
    await user.click(listButton("America/Toronto"));
    expect(screen.getByText("none in 2025 or 2026")).toBeVisible();
    await user.click(listButton("America/Winnipeg"));
    expect(screen.getByText("none in 2026 or 2027")).toBeVisible();
    expect(screen.getByText("tzdb 2026e")).toBeVisible();
  });

  it("has no accessibility violations after a pin", async () => {
    const { fixture, listButton, user } = await draw();
    await expectNoAxeViolations(fixture.host);
    await user.click(listButton("America/Winnipeg"));
    await expectNoAxeViolations(fixture.host);
  });
});

describe("the data credits", () => {
  it("puts one boundaries button in the map's corner when the map is drawn", async () => {
    const { frame } = await draw();
    const button = within(frame()).getByRole("button", {
      name: "Data credits",
    });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveAttribute("popovertarget", "canada-data-credits");
    expect(frame()).toHaveTextContent("Time zone boundaries");
    expect(frame()).not.toHaveTextContent("Earth imagery");
  });
});

describe("narrow screens", () => {
  it("draws no map and never fetches the boundary file at 375 px", async () => {
    const { deps, svg, frame, listButton, user } = await draw({
      measure: () => 375,
    });
    expect(svg()).not.toBeInTheDocument();
    expect(
      within(frame()).queryByRole("button", { name: "Data credits" }),
    ).not.toBeInTheDocument();
    expect(deps.fetch).not.toHaveBeenCalled();
    // The list still pins.
    await user.click(listButton("America/Toronto"));
    expect(listButton("America/Toronto")).toBePressed();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Pinned America/Toronto",
    );
  });
});

describe("the pin panel's words and the scroll box", () => {
  it("never leaves Recorded in blank, and separates the offset from the time", () => {
    const [stopped, changes] = [ZONES[0]!, ZONES[1]!];
    expect(releaseWords(CANADA_MAP, stopped.zone)).toMatch(/^tzdb 2026/);
    expect(releaseWords(CANADA_MAP, changes.zone)).toContain(
      "no change recorded",
    );
    expect(offsetWords("-07:00")).toBe("UTC-07:00");
  });

  it("shows dashes before a zone is pinned, and the zone's words after", async () => {
    const { listButton, user } = await draw();
    expect(screen.getByText("Press a zone to pin it.")).toBeVisible();
    await user.click(listButton("America/Toronto"));
    expect(screen.getByText("UTC-04:00")).toBeVisible();
    expect(screen.getByText(/^\d\d:\d\d:\d\d$/)).toBeVisible();
    expect(
      screen.queryByText("Press a zone to pin it."),
    ).not.toBeInTheDocument();
  });

  it("puts the list in a named, focusable scroll region", async () => {
    await draw();
    const box = screen.getByRole("region", {
      name: "canada time zones, scrollable list",
    });
    expect(box).toHaveAttribute("tabindex", "0");
    expect(within(box).getByRole("list", { name: "Zones" })).toBeVisible();
  });
});
