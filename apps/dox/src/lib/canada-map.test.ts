// @vitest-environment jsdom
import { canadaTense } from "./clock-change-tense.fixture";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isBeforeUtc } from "@northguild/gmt/utc/compare";
import { convertUtcToPlainDateTime } from "@northguild/gmt/utc/convert";
import {
  MAP_HEIGHT,
  CANADA_MAP,
  canadaProjection,
  releaseOf,
} from "./canada-map";
import {
  MAP_WIDTH,
  classCounts,
  classWords,
  displayKind,
  isDataStale,
  lastText,
  mountZoneMap,
  nextText,
  offsetAt,
  offsetWords,
  releaseWords,
  type BoundaryCollection,
  isZoneFeature,
  type MapZone,
  type ZoneMapDeps,
} from "./zone-map";
import { renderCanadaClockChangeTemplate } from "./canada-clock-change-mount";
import { STOPPED_ZONES } from "./canada-clock-change";
import { msToNextSecond } from "./clock-change-common";

const NOW = "2026-10-22T12:00:00Z";
const boundaries = JSON.parse(
  readFileSync(
    resolve(__dirname, "../../public/timezone-boundaries-canada.json"),
    "utf8",
  ),
) as BoundaryCollection;

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

function deps(over: Partial<ZoneMapDeps> = {}): ZoneMapDeps {
  return {
    tense: () => canadaTense,
    responseNow: NOW,
    now: () => NOW,
    wall: (at, offset) => convertUtcToPlainDateTime(at, { timeZone: offset }),
    isBefore: isBeforeUtc,
    msToNextSecond,
    fetch: vi.fn(async () =>
      Response.json(boundaries),
    ) as unknown as typeof fetch,
    measure: () => 900,
    location: {
      href: "https://example.test/gmt/check/canada-2026-clock-change/",
    },
    history: { replaceState: vi.fn() },
    ...over,
  };
}

function host(): HTMLElement {
  document.body.innerHTML = renderCanadaClockChangeTemplate({
    tense: canadaTense,
  });
  return document.querySelector<HTMLElement>(".gmt-canada")!;
}

const btn = (root: HTMLElement, id: string) =>
  root.querySelector<HTMLButtonElement>(`button[data-tz-id="${id}"]`)!;
const text = (el: Element | null) => el?.textContent?.trim() ?? "";

afterEach(() => {
  document.body.innerHTML = "";
});

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

describe("the classes on the shapes", () => {
  it("gives every shape exactly one class, and a zone with no row the neutral one", async () => {
    const root = host();
    const handle = mountZoneMap(
      root,
      ZONES,
      new AbortController().signal,
      deps(),
      CANADA_MAP,
    );
    await handle.ready;
    const shapes = root.querySelectorAll<SVGPathElement>(
      "path.gmt-zonemap-shape",
    );
    expect(shapes).toHaveLength(
      boundaries.features.filter(isZoneFeature).length,
    );
    for (const shape of shapes) {
      const id = shape.dataset.tzId!;
      const row = ZONES.find((z) => z.zone === id);
      expect(shape.getAttribute("data-kind")).toBe(
        displayKind(CANADA_MAP, id, row),
      );
      expect(shape.getAttribute("aria-label")).toBe(
        `${id}, ${classWords(CANADA_MAP, id, row, canadaTense)}`,
      );
      expect(shape.getAttribute("tabindex")).toBe("-1");
      expect(shape.getAttribute("role")).toBe("button");
    }
    expect(
      text(btn(root, "America/Halifax").querySelector('[data-role="kind"]')),
    ).toBe("no data");
  });
});

describe("the land around the zones", () => {
  it("is one aria-hidden path drawn before every zone, and never a zone", async () => {
    const root = host();
    const listed = root.querySelectorAll(".gmt-zonemap-zone").length;
    const handle = mountZoneMap(
      root,
      ZONES,
      new AbortController().signal,
      deps(),
      CANADA_MAP,
    );
    await handle.ready;
    const svg = root.querySelector("svg.gmt-zonemap-svg")!;
    const land = svg.querySelectorAll("path.gmt-zonemap-land");
    expect(land).toHaveLength(1);
    expect(svg.firstElementChild).toBe(land[0]);
    expect(land[0]!.getAttribute("aria-hidden")).toBe("true");
    for (const attr of ["role", "tabindex", "data-tz-id", "data-kind"])
      expect(land[0]!.hasAttribute(attr)).toBe(false);
    // The zone list, and what a click on the land pins, are unchanged.
    expect(root.querySelectorAll(".gmt-zonemap-zone")).toHaveLength(listed);
    land[0]!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(handle.pinned()).toBeNull();
  });
});

describe("pinning", () => {
  it("pins from the list by Enter on a focused button, and a shape click pins the same zone", async () => {
    const root = host();
    const handle = mountZoneMap(
      root,
      ZONES,
      new AbortController().signal,
      deps(),
      CANADA_MAP,
    );
    await handle.ready;
    btn(root, "America/Toronto").click();
    expect(handle.pinned()).toBe("America/Toronto");
    expect(btn(root, "America/Toronto").getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(text(root.querySelector('[data-role="pin-zone"]'))).toBe(
      "America/Toronto",
    );

    root
      .querySelector<SVGPathElement>('path[data-tz-id="America/Winnipeg"]')!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(handle.pinned()).toBe("America/Winnipeg");
    expect(btn(root, "America/Winnipeg").getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(btn(root, "America/Toronto").getAttribute("aria-pressed")).toBe(
      "false",
    );
    expect(
      root
        .querySelector('path[data-tz-id="America/Winnipeg"]')!
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("moves along the list with the arrow keys, Home and End, on one tab stop", async () => {
    const root = host();
    const handle = mountZoneMap(
      root,
      ZONES,
      new AbortController().signal,
      deps(),
      CANADA_MAP,
    );
    await handle.ready;
    const buttons = [
      ...root.querySelectorAll<HTMLButtonElement>(
        "[data-role=zone-list] button",
      ),
    ];
    expect(buttons.filter((b) => b.tabIndex === 0)).toHaveLength(1);
    buttons[0]!.focus();
    const press = (key: string) =>
      document.activeElement!.dispatchEvent(
        new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
      );
    press("ArrowDown");
    expect(document.activeElement).toBe(buttons[1]);
    expect(buttons.filter((b) => b.tabIndex === 0)).toEqual([buttons[1]]);
    press("End");
    expect(document.activeElement).toBe(buttons[buttons.length - 1]);
    press("Home");
    expect(document.activeElement).toBe(buttons[0]);
    press("ArrowUp");
    expect(document.activeElement).toBe(buttons[0]);
  });

  it("writes ?zone= and reads it back on load", async () => {
    const root = host();
    const d = deps();
    const handle = mountZoneMap(
      root,
      ZONES,
      new AbortController().signal,
      d,
      CANADA_MAP,
    );
    await handle.ready;
    handle.pin("America/Regina");
    expect(d.history!.replaceState).toHaveBeenCalledWith(
      null,
      "",
      "https://example.test/gmt/check/canada-2026-clock-change/?zone=America%2FRegina",
    );

    const again = host();
    const pinned = mountZoneMap(
      again,
      ZONES,
      new AbortController().signal,
      deps({
        location: { href: "https://example.test/x/?zone=America/Winnipeg" },
      }),
      CANADA_MAP,
    );
    expect(pinned.pinned()).toBe("America/Winnipeg");
    const ignored = mountZoneMap(
      host(),
      ZONES,
      new AbortController().signal,
      deps({ location: { href: "https://example.test/x/?zone=Nowhere/Land" } }),
      CANADA_MAP,
    );
    expect(ignored.pinned()).toBeNull();
  });

  it("shows the null texts and the release on the panel", async () => {
    const root = host();
    const handle = mountZoneMap(
      root,
      ZONES,
      new AbortController().signal,
      deps(),
      CANADA_MAP,
    );
    await handle.ready;
    handle.pin("America/Toronto");
    expect(text(root.querySelector('[data-role="pin-last"]'))).toBe(
      "none in 2025 or 2026",
    );
    handle.pin("America/Winnipeg");
    expect(text(root.querySelector('[data-role="pin-next"]'))).toBe(
      "none in 2026 or 2027",
    );
    expect(text(root.querySelector('[data-role="pin-release"]'))).toBe(
      "tzdb 2026e",
    );
    expect(
      root.querySelector('[data-role="pin-clock"] svg.gmt-crystal-clock'),
    ).not.toBeNull();
  });

  it("keeps the panel, list and map in place: the same boxes, three pins in a row", async () => {
    const root = host();
    const handle = mountZoneMap(
      root,
      ZONES,
      new AbortController().signal,
      deps(),
      CANADA_MAP,
    );
    await handle.ready;
    const rects = () =>
      ["pin", "zone-list", "map"].map((role) => {
        const r = root
          .querySelector(`[data-role="${role}"]`)!
          .getBoundingClientRect();
        return [r.x, r.y, r.width, r.height];
      });
    const before = rects();
    for (const id of [
      "America/Winnipeg",
      "America/Toronto",
      "America/Regina",
    ]) {
      handle.pin(id);
      expect(rects()).toEqual(before);
    }
  });
});

describe("the data credits", () => {
  it("puts one boundaries button in the map's corner when the map is drawn", async () => {
    const root = host();
    const handle = mountZoneMap(
      root,
      ZONES,
      new AbortController().signal,
      deps(),
      CANADA_MAP,
    );
    await handle.ready;
    const frame = root.querySelector<HTMLElement>('[data-role="map"]')!;
    const buttons = frame.querySelectorAll(
      ".gmt-data-credits-button[data-placement='corner']",
    );
    expect(buttons).toHaveLength(1);
    expect(buttons[0]!.getAttribute("popovertarget")).toBe(
      "canada-data-credits",
    );
    const panel = frame.querySelector("#canada-data-credits");
    expect(panel?.hasAttribute("popover")).toBe(true);
    expect(panel?.textContent).toContain("Time zone boundaries");
    expect(panel?.textContent).not.toContain("Earth imagery");
  });
});

describe("the entrance", () => {
  it("plays the site's arrival gesture on the drawing, inside a stage that keeps its box", async () => {
    const root = host();
    const handle = mountZoneMap(
      root,
      ZONES,
      new AbortController().signal,
      deps(),
      CANADA_MAP,
    );
    expect(root.querySelector("svg.gmt-zonemap-svg")).toBeNull();
    await handle.ready;
    const svg = root.querySelector<SVGSVGElement>("svg.gmt-zonemap-svg")!;
    // enter() adds the class at once, or the settled mark under reduced motion.
    expect(
      svg.classList.contains("gmt-enter") || svg.hasAttribute("data-entered"),
    ).toBe(true);
    expect(svg.parentElement?.dataset.role).toBe("map");
  });

  it("settles on the drawing with data-entered once the timer fires", async () => {
    vi.useFakeTimers();
    try {
      const root = host();
      const handle = mountZoneMap(
        root,
        ZONES,
        new AbortController().signal,
        deps(),
        CANADA_MAP,
      );
      await handle.ready;
      const svg = root.querySelector<SVGSVGElement>("svg.gmt-zonemap-svg")!;
      vi.advanceTimersByTime(2000);
      expect(svg.hasAttribute("data-entered")).toBe(true);
      expect(svg.classList.contains("gmt-enter")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("narrow screens", () => {
  it("draws no SVG and never fetches the boundary file at 375 px", async () => {
    const root = host();
    const d = deps({ measure: () => 375 });
    const handle = mountZoneMap(
      root,
      ZONES,
      new AbortController().signal,
      d,
      CANADA_MAP,
    );
    await handle.ready;
    expect(root.querySelector("svg.gmt-zonemap-svg")).toBeNull();
    expect(root.querySelector(".gmt-data-credits-button")).toBeNull();
    expect(d.fetch).not.toHaveBeenCalled();
    // The list still pins, and the panel opens in its own place below the list's scroll box.
    const panel = root.querySelector<HTMLElement>('[data-role="pin"]')!;
    expect(panel.dataset.pinned).toBe("false");
    btn(root, "America/Toronto").click();
    expect(
      root.querySelector('[data-role="zone-scroll"]')?.contains(panel),
    ).toBe(false);
    expect(panel.dataset.pinned).toBe("true");
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

  it("fills the labelled rows, with dashes before a zone is pinned", async () => {
    const root = host();
    const handle = mountZoneMap(
      root,
      ZONES,
      new AbortController().signal,
      deps(),
      CANADA_MAP,
    );
    await handle.ready;
    for (const role of ["pin-time", "pin-offset", "pin-release"]) {
      expect(text(root.querySelector(`[data-role="${role}"]`))).not.toBe("");
    }
    handle.pin("America/Toronto");
    expect(text(root.querySelector('[data-role="pin-offset"]'))).toBe(
      "UTC-04:00",
    );
    expect(text(root.querySelector('[data-role="pin-time"]'))).toMatch(
      /^\d\d:\d\d:\d\d$/,
    );
    expect(text(root.querySelector('[data-role="pin-release"]'))).not.toBe("");
  });

  it("puts the list in a named, focusable scroll region", () => {
    const root = host();
    const box = root.querySelector('[data-role="zone-scroll"]')!;
    expect(box.getAttribute("role")).toBe("region");
    expect(box.getAttribute("aria-label")).toMatch(/Canada time zones/);
    expect(box.getAttribute("tabindex")).toBe("0");
    expect(box.querySelector('[data-role="zone-list"]')).not.toBeNull();
  });

  it("draws a hover ring and a pin ring over the shapes", async () => {
    const root = host();
    const handle = mountZoneMap(
      root,
      ZONES,
      new AbortController().signal,
      deps(),
      CANADA_MAP,
    );
    await handle.ready;
    expect(root.querySelectorAll(".gmt-zonemap-ring").length).toBe(2);
    handle.pin("America/Winnipeg");
    const ring = root.querySelector<SVGElement>(".gmt-zonemap-ring--pin")!;
    expect(ring.getAttribute("visibility")).not.toBe("hidden");
  });
});
