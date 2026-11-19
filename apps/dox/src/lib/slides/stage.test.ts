/**
 * @vitest-environment jsdom
 *
 * The space stage over a fixture deck. The globe engine, the sky and the theme reader are fakes
 * (`vi.mock`, so this file runs in the isolated project): what is under test is what the stage asks
 * of them, in what order, and that it cleans up.
 */
/*
 * The stage draws into aria-hidden canvases and reads the deck's data-* hooks; nothing it does is
 * perceivable by a person or assistive technology, so its contract is asserted on those hooks and
 * on the calls it makes to the (faked) engine.
 */
/* oxlint-disable dox-test/no-markup-read, dox-test/no-implementation-assert, dox-test/no-class-query, testing-library/no-node-access */
import { pick, recordLapses, textOf } from "~/test/deck-events";
import { Temporal } from "@js-temporal/polyfill";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installJsdomShims } from "~/test/jsdom-shims";
import { MERIDIAN_TURN_VAR } from "./earth-clock";
import { loadLapseTools } from "./time-lapse";
import {
  getPlanetZones,
  meridianTurn,
  pointFor,
  resolvePlace,
  rotationFor,
} from "./places";
import {
  mountSpaceStage,
  readStops,
  legsOf,
  REVEAL_MS,
  type SpaceStage,
} from "./stage";

installJsdomShims();

const NOW = Temporal.Instant.from("2027-02-06T12:00:00Z").epochMilliseconds;

const colour = [0.1, 0.2, 0.3, 1] as const;

interface FakeEngine {
  options: Record<string, unknown>;
  flyTo: ReturnType<typeof vi.fn>;
  steer: ReturnType<typeof vi.fn>;
  setZoom: ReturnType<typeof vi.fn>;
  setMarkers: ReturnType<typeof vi.fn>;
  setArcs: ReturnType<typeof vi.fn>;
  refit: ReturnType<typeof vi.fn>;
  requestRender: ReturnType<typeof vi.fn>;
  onInteract: ReturnType<typeof vi.fn>;
  getView: ReturnType<typeof vi.fn>;
  getZoom: ReturnType<typeof vi.fn>;
  getCentre: ReturnType<typeof vi.fn>;
  project: ReturnType<typeof vi.fn>;
  onFrame: ReturnType<typeof vi.fn>;
  frame: () => void;
  destroy: ReturnType<typeof vi.fn>;
  interact: () => void;
}

const made: FakeEngine[] = [];
let failEngine = false;
/** While set, the fake engine waits for it before it arrives, to stand for a slow start. */
let hold: Promise<void> | undefined;

vi.mock("~/lib/globe/engine", () => ({
  createGlobeEngine: vi.fn(
    async (host: HTMLElement, options: Record<string, unknown>) => {
      await hold;
      if (failEngine) throw new Error("no renderer");
      const canvas = document.createElement("canvas");
      canvas.tabIndex = 0;
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", "Globe");
      host.append(canvas);
      let interact: () => void = () => {};
      let frame: () => void = () => {};
      const engine: FakeEngine = {
        options,
        flyTo: vi.fn(),
        steer: vi.fn(),
        setZoom: vi.fn(),
        setMarkers: vi.fn(),
        setArcs: vi.fn(),
        refit: vi.fn(),
        requestRender: vi.fn(),
        onInteract: vi.fn((cb: () => void) => {
          interact = cb;
        }),
        getView: vi.fn(() => ({ rotation: [0, 0], zoom: 1, moving: false })),
        getZoom: vi.fn(() => 0.8),
        getCentre: vi.fn(() => ({ x: 500, y: 300, radius: 160 })),
        project: vi.fn(() => ({ x: 10, y: 20, visible: true })),
        onFrame: vi.fn((cb: () => void) => {
          frame = cb;
        }),
        destroy: vi.fn(),
        interact: () => interact(),
        frame: () => frame(),
      };
      made.push(engine);
      return engine;
    },
  ),
}));

interface FakeWall {
  options: Record<string, (...args: unknown[]) => unknown>;
  state: string;
  show: ReturnType<typeof vi.fn>;
  hide: ReturnType<typeof vi.fn>;
  restore: ReturnType<typeof vi.fn>;
  flyThrough: ReturnType<typeof vi.fn>;
  setDepth: ReturnType<typeof vi.fn>;
  paneCentres: ReturnType<typeof vi.fn>;
  paneWidth: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}

const walls: FakeWall[] = [];

vi.mock("./ice-wall/wall", () => ({
  mountIceWall: vi.fn((options: FakeWall["options"]) => {
    const wall: FakeWall = {
      options,
      state: "whole",
      show: vi.fn(),
      hide: vi.fn(),
      restore: vi.fn(),
      flyThrough: vi.fn(),
      setDepth: vi.fn(),
      paneCentres: vi.fn(() => [[1, 2]]),
      paneWidth: vi.fn(() => 400),
      destroy: vi.fn(),
    };
    walls.push(wall);
    return wall;
  }),
}));

vi.mock("./clocks", async (original) => ({
  ...(await original<typeof import("./clocks")>()),
  loadZonedNow: async () => () => "2024-02-29T23:30+09:00[Asia/Tokyo]",
}));

/**
 * The Earth's clock ticks through the venue clock, whose own test is `title-clock.test.ts`. Here it
 * has no time now, so the hands move only for an instant a build holds them at.
 */
vi.mock("./title-clock", () => ({
  loadClock: async () => ({
    read: () => null,
    at: (utc: string) =>
      ({
        "2027-03-28T00:59:00Z": {
          hour: 2,
          minute: 59,
          second: 0,
          zoned: "2027-03-28T02:59:00+02:00[Europe/Helsinki]",
        },
        "2027-03-28T01:00:00Z": {
          hour: 4,
          minute: 0,
          second: 0,
          zoned: "2027-03-28T04:00:00+03:00[Europe/Helsinki]",
        },
      })[utc] ?? null,
    untilNextSecond: () => 1000,
  }),
}));

vi.mock("~/lib/globe/globe-theme", () => ({
  readTheme: () => ({
    markerPrimary: colour,
    markerOther: colour,
    label: colour,
  }),
  parseColour: () => colour,
  labelFont: () => "12px sans-serif",
  rendererOverride: () => "auto",
}));

const skyCalls = { drawWithout: 0, follow: 0 };

vi.mock("~/lib/space-sky", () => ({
  loadClock: async () => ({
    getUnixNow: () => NOW,
    getSystemTimeZone: () => "UTC",
  }),
  loadSky: vi.fn(async () => ({})),
  drawWithoutGlobe: vi.fn(async () => {
    skyCalls.drawWithout += 1;
  }),
  followGlobe: vi.fn(async () => {
    skyCalls.follow += 1;
    return true;
  }),
}));

/** A three-slide deck: Helsinki, then Tokyo with a build that goes to Manila, then the wall. */
function fixture(): HTMLElement {
  const root = document.createElement("article");
  root.innerHTML = `
    <div data-deck-space data-sky-src="/sky.bin" data-earth="/earth.webp">
      <div><canvas data-sky-canvas="band"></canvas></div>
      <canvas data-sky-canvas="stars"></canvas>
    </div>
    <div data-deck-stage>
      <section data-slide data-place="Europe/Helsinki"><h2>One</h2></section>
      <section data-slide data-place="Asia/Tokyo"><h2>Two</h2>
        <div data-build="1" data-place="Asia/Manila">b</div>
      </section>
      <section data-slide data-place="wall"><h2>Three</h2></section>
    </div>`;
  document.body.append(root);
  return root;
}

let abort: AbortController;
let root: HTMLElement;
let stage: SpaceStage | undefined;

const engine = (): FakeEngine => made[made.length - 1]!;

async function ready(): Promise<FakeEngine> {
  await vi.waitFor(() =>
    expect(root.querySelector("[data-deck-space]")).toHaveAttribute(
      "data-globe",
      "ready",
    ),
  );
  return engine();
}

beforeEach(() => {
  made.length = 0;
  walls.length = 0;
  failEngine = false;
  hold = undefined;
  skyCalls.drawWithout = 0;
  skyCalls.follow = 0;
  abort = new AbortController();
  root = fixture();
});

afterEach(() => {
  stage?.destroy();
  stage = undefined;
  abort.abort();
  root.remove();
  vi.restoreAllMocks();
});

describe("the route", () => {
  it("lists the places slides and builds name, in order, geographic ones only", () => {
    const stops = readStops(root);
    expect(stops.map((s) => [s.key, s.slide, s.build])).toEqual([
      ["Europe/Helsinki", 0, 0],
      ["Asia/Tokyo", 1, 0],
      ["Asia/Manila", 1, 1],
    ]);
    expect(legsOf(stops)).toHaveLength(2);
  });

  it("makes no leg between two stops at one place", () => {
    const again = document.createElement("section");
    again.setAttribute("data-slide", "");
    again.dataset["place"] = "Asia/Manila";
    root.querySelector("[data-deck-stage]")!.append(again);
    expect(legsOf(readStops(root))).toHaveLength(2);
  });
});

describe("the globe", () => {
  it("starts the engine with a still, capped, hidden-aware configuration", async () => {
    stage = mountSpaceStage(root, { signal: abort.signal });
    const fake = await ready();
    expect(fake.options).toMatchObject({
      ambient: false,
      maxDpr: 1.5,
      zoomRange: [0.5, 4],
      imageryUrl: "/earth.webp",
    });
    expect(fake.options["pauseWhenHidden"]).toBe(
      root.querySelector("[data-deck-space]"),
    );
    expect(fake.options["sunInstant"]).toEqual(expect.any(Function));
    expect(root).toHaveAttribute("data-space");
  });

  it("keeps the canvas out of the tab order and the accessibility tree", async () => {
    stage = mountSpaceStage(root, { signal: abort.signal });
    await ready();
    const canvas = root.querySelector<HTMLCanvasElement>(
      "[data-deck-space] > canvas",
    )!;
    expect(canvas).not.toHaveAttribute("tabindex");
    expect(canvas).not.toHaveAttribute("role");
    expect(canvas).toHaveAttribute("aria-hidden", "true");
  });

  it("flies a hop to a new place, and a plain ease with no hop asked for", async () => {
    stage = mountSpaceStage(root, { signal: abort.signal });
    const fake = await ready();
    stage.goTo("Asia/Tokyo", { hop: true, at: { slide: 1, build: 0 } });
    const [rotation, flight] = fake.flyTo.mock.calls.at(-1)!;
    expect(rotation[0]).toBeCloseTo(-139.74, 1);
    expect(flight.hop.durationMs).toBeGreaterThanOrEqual(2000);
    expect(flight.hop.durationMs).toBeLessThanOrEqual(4000);
    stage.goTo("Asia/Manila", { at: { slide: 1, build: 1 } });
    expect(fake.flyTo.mock.calls.at(-1)).toHaveLength(1);
  });

  it("does nothing when asked for the place it already holds", async () => {
    stage = mountSpaceStage(root, { signal: abort.signal });
    const fake = await ready();
    stage.goTo("Asia/Tokyo", { hop: true, at: { slide: 1, build: 0 } });
    const calls = fake.flyTo.mock.calls.length;
    stage.goTo("Asia/Tokyo", { hop: true, at: { slide: 1, build: 0 } });
    expect(fake.flyTo.mock.calls).toHaveLength(calls);
  });

  it("returns to the slide's place after free flight, and a step does the same", async () => {
    stage = mountSpaceStage(root, { signal: abort.signal });
    const fake = await ready();
    stage.goTo("Asia/Tokyo", { hop: true, at: { slide: 1, build: 0 } });
    const calls = fake.flyTo.mock.calls.length;
    stage.returnHome();
    expect(fake.flyTo.mock.calls).toHaveLength(calls);
    stage.steer({ lng: 60, lat: 0, zoom: 0 });
    stage.steer({ lng: 0, lat: 0, zoom: 0 });
    stage.returnHome();
    expect(fake.flyTo.mock.calls).toHaveLength(calls + 1);
    stage.steer({ lng: 0, lat: 60, zoom: 0 });
    stage.goTo("Asia/Tokyo", { hop: true, at: { slide: 1, build: 0 } });
    expect(fake.flyTo.mock.calls).toHaveLength(calls + 2);
  });

  it("returns after a drag", async () => {
    stage = mountSpaceStage(root, { signal: abort.signal });
    const fake = await ready();
    stage.goTo("Asia/Tokyo", { hop: true, at: { slide: 1, build: 0 } });
    const calls = fake.flyTo.mock.calls.length;
    fake.interact();
    stage.returnHome();
    expect(fake.flyTo.mock.calls).toHaveLength(calls + 1);
  });

  it("passes a held rate to the engine and stops it on zeros", async () => {
    stage = mountSpaceStage(root, { signal: abort.signal });
    const fake = await ready();
    stage.steer({ lng: 60, lat: 0, zoom: 1 });
    stage.steer({ lng: 0, lat: 0, zoom: 0 });
    expect(fake.steer.mock.calls).toEqual([
      [{ lng: 60, lat: 0, zoom: 1 }],
      [{ lng: 0, lat: 0, zoom: 0 }],
    ]);
  });

  it("publishes whether the camera moves, and where it rests, after each frame", async () => {
    stage = mountSpaceStage(root, { signal: abort.signal });
    const fake = await ready();
    const space = root.querySelector<HTMLElement>("[data-deck-space]")!;
    fake.getView.mockReturnValue({
      rotation: [-24.9, -60.2],
      zoom: 1,
      moving: true,
    });
    fake.frame();
    expect(space).toHaveAttribute("data-flight", "moving");
    expect(space).not.toHaveAttribute("data-rotation");
    fake.getView.mockReturnValue({
      rotation: [-24.9, -60.2],
      zoom: 1,
      moving: false,
    });
    fake.frame();
    expect(space).toHaveAttribute("data-flight", "rest");
    expect(space).toHaveAttribute("data-rotation", "24.90 60.20");
    expect(space).toHaveAttribute(
      "data-target",
      expect.stringMatching(/^-?\d+\.\d{2} -?\d+\.\d{2}$/),
    );
  });

  it("lights every pin and arc in the overview, and goes back after", async () => {
    stage = mountSpaceStage(root, { signal: abort.signal });
    const fake = await ready();
    stage.goTo("Asia/Tokyo", { hop: true, at: { slide: 1, build: 0 } });
    expect(
      fake.setMarkers.mock.calls
        .at(-1)![0]
        .filter((m: { label?: string }) => m.label),
    ).toHaveLength(1);
    expect(fake.setArcs.mock.calls.at(-1)![0]).toHaveLength(1);
    stage.overview(true);
    expect(
      fake.setMarkers.mock.calls
        .at(-1)![0]
        .filter((m: { label?: string }) => m.label),
    ).toHaveLength(3);
    expect(fake.setArcs.mock.calls.at(-1)![0]).toHaveLength(2);
    const calls = fake.flyTo.mock.calls.length;
    stage.overview(false);
    expect(fake.flyTo.mock.calls).toHaveLength(calls + 1);
    expect(fake.setArcs.mock.calls.at(-1)![0]).toHaveLength(1);
  });

  it("frames the Earth in the right third on every slide, whatever the slide", async () => {
    stage = mountSpaceStage(root, { signal: abort.signal });
    const fake = await ready();
    const framing = fake.options["framing"] as (
      w: number,
      h: number,
    ) => { cx: number; cy: number; radius: number };
    const before = framing(1200, 600);
    stage.goTo("Asia/Tokyo", { hop: true, at: { slide: 1, build: 0 } });
    stage.goTo("wall", { hop: true, at: { slide: 2, build: 0 } });
    expect(framing(1200, 600)).toEqual(before);
    // Five sixths across: the middle of the right third.
    expect(before.cx).toBe(1000);
    expect(before.cy).toBe(300);
    expect(fake.refit).not.toHaveBeenCalled();
  });

  it("flies a cut under reduced motion", async () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes("reduce"),
      media: query,
      addEventListener() {},
      removeEventListener() {},
    })) as unknown as typeof window.matchMedia;
    try {
      stage = mountSpaceStage(root, { signal: abort.signal });
      const fake = await ready();
      stage.goTo("Asia/Tokyo", { hop: true, at: { slide: 1, build: 0 } });
      expect(fake.flyTo.mock.calls.at(-1)).toHaveLength(1);
    } finally {
      window.matchMedia = original;
    }
  });

  describe("time moving under a held camera", () => {
    const reduce = (): (() => void) => {
      const original = window.matchMedia;
      window.matchMedia = ((query: string) => ({
        matches: query.includes("reduce"),
        media: query,
        addEventListener() {},
        removeEventListener() {},
      })) as unknown as typeof window.matchMedia;
      return () => {
        window.matchMedia = original;
      };
    };

    it("moves the sun and dates the zone's pin from gmt, then stops with the lapse", async () => {
      const undo = reduce();
      try {
        // The lapse reads gmt from five modules loaded on first use. Loading them here keeps that
        // cold import, slow on a busy worker, out of the wait below, which then times the stage.
        await loadLapseTools();
        const events = recordLapses(root);
        stage = mountSpaceStage(root, { signal: abort.signal });
        const fake = await ready();
        await vi.waitFor(() => {
          stage!.lapse("tehran");
          expect(events.length).toBeGreaterThan(0);
        });
        expect(events.at(-1)!.name).toBe("tehran");
        expect(events.at(-1)!.dates["Asia/Tehran"]).toMatch(
          /^\d{4}-\d\d-\d\d$/,
        );
        const sun = (fake.options["sunInstant"] as () => number)();
        expect(sun).not.toBe(NOW);
        const host = root.querySelector("[data-deck-space]")!;
        expect(host).toHaveAttribute("data-lapse", "tehran");
        stage.lapse(null);
        expect(host).not.toHaveAttribute("data-lapse");
        expect((fake.options["sunInstant"] as () => number)()).toBe(NOW);
      } finally {
        undo();
      }
    });

    it("ignores a lapse name it does not know", async () => {
      stage = mountSpaceStage(root, { signal: abort.signal });
      const fake = await ready();
      stage.lapse("nonsense");
      expect((fake.options["sunInstant"] as () => number)()).toBe(NOW);
    });
  });

  describe("the filings' pins", () => {
    it("counts up to the total and lights a pin at each named zone", async () => {
      const undo = (() => {
        const original = window.matchMedia;
        window.matchMedia = ((query: string) => ({
          matches: query.includes("reduce"),
          media: query,
          addEventListener() {},
          removeEventListener() {},
        })) as unknown as typeof window.matchMedia;
        return () => {
          window.matchMedia = original;
        };
      })();
      try {
        root.insertAdjacentHTML(
          "beforeend",
          `<div data-filing-steps="a|Asia/Manila;b|;c|Asia/Tokyo"><output data-filing-count>3</output></div>`,
        );
        stage = mountSpaceStage(root, { signal: abort.signal });
        const fake = await ready();
        stage.pinFilings(true);
        const out = pick(root, "[data-filing-count]")!;
        await vi.waitFor(() => expect(textOf(out)).toBe("3"));
        const labels = fake.setMarkers.mock.calls
          .at(-1)![0]
          .map((m: { label?: string }) => m.label)
          .filter(Boolean);
        expect(labels).toEqual(expect.arrayContaining(["Manila 1", "Tokyo 1"]));
        stage.pinFilings(false);
        expect(textOf(out)).toBe("3");
      } finally {
        undo();
      }
    });
  });

  it("destroys the engine with the stage", async () => {
    stage = mountSpaceStage(root, { signal: abort.signal });
    const fake = await ready();
    stage.destroy();
    expect(fake.destroy).toHaveBeenCalledTimes(1);
    expect(root).not.toHaveAttribute("data-space");
  });

  it("destroys an engine that arrives after the stage is gone", async () => {
    let release: () => void = () => {};
    hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { createGlobeEngine } = await import("~/lib/globe/engine");
    vi.mocked(createGlobeEngine).mockClear();
    stage = mountSpaceStage(root, { signal: abort.signal });
    await vi.waitFor(() => expect(createGlobeEngine).toHaveBeenCalled());
    stage.destroy();
    release();
    await vi.waitFor(() => expect(made).toHaveLength(1));
    await vi.waitFor(() => expect(engine().destroy).toHaveBeenCalledTimes(1));
    expect(root.querySelector("[data-deck-space]")).not.toHaveAttribute(
      "data-globe",
    );
  });
});

describe("when the globe cannot start", () => {
  it("draws the sky once without it and throws nothing", async () => {
    failEngine = true;
    stage = mountSpaceStage(root, { signal: abort.signal });
    await vi.waitFor(() => expect(skyCalls.drawWithout).toBe(1));
    expect(root.querySelector("[data-deck-space]")).toHaveAttribute(
      "data-globe",
      "none",
    );
    expect(skyCalls.follow).toBe(0);
    expect(() => {
      stage!.goTo("Asia/Tokyo", { hop: true });
      stage!.steer({ lng: 1, lat: 0, zoom: 0 });
      stage!.returnHome();
      stage!.overview(true);
    }).not.toThrow();
  });

  it("does nothing without a space layer", () => {
    root.querySelector("[data-deck-space]")!.remove();
    stage = mountSpaceStage(root, { signal: abort.signal });
    expect(() => stage!.goTo("Asia/Tokyo")).not.toThrow();
    expect(root).not.toHaveAttribute("data-space");
  });
});

/** Slides 2 and 3 hang the wall, slide 4 is the planet: the wall's own deck. */
function wallFixture(): HTMLElement {
  const wallRoot = document.createElement("article");
  wallRoot.innerHTML = `
    <div data-deck-space data-sky-src="/sky.bin" data-earth="/earth.webp"></div>
    <div data-deck-stage>
      <section data-slide data-place="wall">
        <figure data-wall-pane="moment"><img alt="Moment" src="/a.webp"></figure>
        <figure data-wall-pane="luxon"><img alt="Luxon" src="/b.webp"></figure>
      </section>
      <section data-slide data-place="wall"><h2>Two</h2></section>
      <section data-slide data-place="planet"><h2>Three</h2></section>
    </div>`;
  document.body.append(wallRoot);
  return wallRoot;
}

describe("the ice wall", () => {
  const clockIds = (fake: FakeEngine): string[] =>
    fake.setMarkers.mock.calls
      .at(-1)![0]
      .map((m: { id: string }) => m.id)
      .filter((id: string) => id.startsWith("clock-"));

  const setUpWall = async (): Promise<{ fake: FakeEngine; wall: FakeWall }> => {
    stage = mountSpaceStage(root, { signal: abort.signal });
    const fake = await ready();
    await vi.waitFor(() => expect(walls).toHaveLength(1));
    return { fake, wall: walls[0]! };
  };

  beforeEach(() => {
    root.remove();
    root = wallFixture();
    HTMLImageElement.prototype.decode = async () => {};
  });

  it("is not mounted for a deck with no panes", async () => {
    root.remove();
    root = fixture();
    stage = mountSpaceStage(root, { signal: abort.signal });
    await ready();
    expect(walls).toHaveLength(0);
  });

  it("hangs on a wall slide and shows no clocks", async () => {
    const { fake, wall } = await setUpWall();
    stage!.goTo("wall", { hop: true, at: { slide: 0, build: 0 } });
    expect(wall.show).toHaveBeenCalled();
    expect(clockIds(fake)).toEqual([]);
  });

  it("breaks into one shard for each planet zone, up to twelve, when the talk steps on", async () => {
    const { wall } = await setUpWall();
    stage!.goTo("wall", { hop: true, at: { slide: 1, build: 0 } });
    stage!.goTo("planet", { hop: true, at: { slide: 2, build: 0 } });
    expect(wall.flyThrough).toHaveBeenCalledTimes(1);
    const zones = wall.flyThrough.mock.calls[0]![0] as string[];
    const planet = getPlanetZones().length;
    expect(planet).toBe(10);
    expect(zones).toHaveLength(Math.min(12, planet));
    expect(new Set(zones).size).toBe(zones.length);
  });

  it("lights a clock with the local time as each shard lands, and the rest at the break", async () => {
    const { fake, wall } = await setUpWall();
    stage!.goTo("wall", { hop: true, at: { slide: 1, build: 0 } });
    stage!.goTo("planet", { hop: true, at: { slide: 2, build: 0 } });
    const zones = wall.flyThrough.mock.calls[0]![0] as string[];
    wall.options["onBreak"]!();
    expect(clockIds(fake)).toHaveLength(getPlanetZones().length - zones.length);
    wall.options["onPin"]!(zones[0]);
    expect(clockIds(fake)).toContain(`clock-${zones[0]}`);
    const label = fake.setMarkers.mock.calls
      .at(-1)![0]
      .find((m: { id: string }) => m.id === `clock-${zones[0]}`).label;
    expect(label).toMatch(/ 23:30$/);
  });

  it("turns the Earth once after the break, then holds the place again", async () => {
    const { fake, wall } = await setUpWall();
    stage!.goTo("wall", { hop: true, at: { slide: 1, build: 0 } });
    stage!.goTo("planet", { hop: true, at: { slide: 2, build: 0 } });
    const timeouts: [() => void, number][] = [];
    vi.spyOn(window, "setTimeout").mockImplementation(((
      cb: () => void,
      ms: number,
    ) => {
      timeouts.push([cb, ms]);
      return timeouts.length;
    }) as unknown as typeof window.setTimeout);
    wall.options["onBreak"]!();
    fake.frame();
    expect(fake.steer).toHaveBeenCalledWith({ lng: 30, lat: 0, zoom: 0 });
    const turn = timeouts.find(([, ms]) => ms === 12000)!;
    const flights = fake.flyTo.mock.calls.length;
    turn[0]();
    expect(fake.steer).toHaveBeenLastCalledWith({ lng: 0, lat: 0, zoom: 0 });
    expect(fake.flyTo.mock.calls.length).toBe(flights + 1);
  });

  it("does not turn the Earth under reduced motion", async () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes("reduce"),
      media: query,
      addEventListener() {},
      removeEventListener() {},
    })) as unknown as typeof window.matchMedia;
    try {
      const { fake, wall } = await setUpWall();
      stage!.goTo("wall", { hop: true, at: { slide: 1, build: 0 } });
      stage!.goTo("planet", { hop: true, at: { slide: 2, build: 0 } });
      wall.options["onBreak"]!();
      fake.frame();
      expect(fake.steer).not.toHaveBeenCalled();
    } finally {
      window.matchMedia = original;
    }
  });

  it("lights every clock at once on a deep link to the planet", async () => {
    root
      .querySelectorAll("[data-slide]")[0]!
      .setAttribute("data-place", "planet");
    const { fake, wall } = await setUpWall();
    stage!.goTo("planet", { hop: false, at: { slide: 0, build: 0 } });
    expect(wall.hide).toHaveBeenCalled();
    expect(clockIds(fake)).toHaveLength(getPlanetZones().length);
  });

  it("brings the wall back whole when the talk steps back from the planet", async () => {
    const { fake, wall } = await setUpWall();
    stage!.goTo("wall", { hop: true, at: { slide: 1, build: 0 } });
    stage!.goTo("planet", { hop: true, at: { slide: 2, build: 0 } });
    stage!.goTo("wall", { hop: true, at: { slide: 1, build: 0 } });
    expect(wall.restore).toHaveBeenCalledTimes(1);
    expect(clockIds(fake)).toEqual([]);
  });

  it("matches the wall's depth to the camera's zoom while it hangs", async () => {
    const { fake, wall } = await setUpWall();
    stage!.goTo("wall", { hop: true, at: { slide: 1, build: 0 } });
    fake.getView.mockReturnValue({
      rotation: [0, 0],
      zoom: 0.4,
      moving: false,
    });
    fake.frame();
    expect(wall.setDepth).toHaveBeenLastCalledWith(2);
  });

  it("destroys the wall with the stage", async () => {
    const { wall } = await setUpWall();
    stage!.destroy();
    expect(wall.destroy).toHaveBeenCalledTimes(1);
  });
});

/**
 * The talk's opening: the title, a wall slide and a planet slide show a 24-hour clock where the
 * Earth would be, and the fourth slide reveals the planet. Slide 2 hangs the wall and slide 3
 * breaks it over the clock. The fifth, the close, asks
 * for the clock again. The sixth's builds hold it either side of Helsinki's skipped hour.
 */
function revealFixture(): HTMLElement {
  const deck = document.createElement("article");
  deck.innerHTML = `
    <div data-deck-space data-sky-src="/sky.bin" data-earth="/earth.webp"></div>
    <div data-deck-stage>
      <section data-slide data-place="Europe/Helsinki" data-layout="title"><h2>One</h2></section>
      <section data-slide data-place="wall">
        <figure data-wall-pane="moment"><img alt="Moment" src="/a.webp"></figure>
      </section>
      <section data-slide data-place="planet"><h2>Three</h2></section>
      <section data-slide data-place="planet" data-reveal="Europe/Helsinki"><h2>Four</h2></section>
      <section data-slide data-place="Europe/Helsinki" data-clock><h2>Five</h2></section>
      <section data-slide data-place="greenwich"><h2>Six</h2>
        <div data-build="2" data-clock-at="2027-03-28T01:00:00Z"></div>
        <div data-build="1" data-clock-at="2027-03-28T00:59:00Z"></div>
      </section>
    </div>`;
  document.body.append(deck);
  return deck;
}

describe("the clock that becomes the Earth", () => {
  /** The faked zoned clock reads 23:30 in every zone. */
  const ctx = { instantMs: NOW, pins: [], wallMinutes: () => 23 * 60 + 30 };
  const pole = resolvePlace("pole:Europe/Helsinki");
  const poleRotation = rotationFor(pole, ctx);
  const poleLng = pointFor(pole, ctx)[0];
  /** Read after mounting: the stage sets the planet's zones from the zone matrix. */
  const planetPoint = (): readonly [number, number] =>
    pointFor({ kind: "planet" }, ctx);

  const space = (): HTMLElement =>
    root.querySelector<HTMLElement>("[data-deck-space]")!;
  const face = (): HTMLElement | null =>
    root.querySelector<HTMLElement>("[data-earth-clock-face]");
  const aimedAt = (fake: FakeEngine): [number, number] =>
    fake.flyTo.mock.calls.at(-1)![0] as [number, number];
  const expectRotation = (
    actual: readonly number[],
    expected: readonly number[],
  ): void => {
    expect(actual[0]).toBeCloseTo(expected[0]!, 6);
    expect(actual[1]).toBeCloseTo(expected[1]!, 6);
  };

  const timeouts: [() => void, number][] = [];
  const holdTimeouts = (): void => {
    timeouts.length = 0;
    vi.spyOn(window, "setTimeout").mockImplementation(((
      cb: () => void,
      ms: number,
    ) => {
      timeouts.push([cb, ms]);
      return timeouts.length;
    }) as unknown as typeof window.setTimeout);
  };
  const runReveal = (): void => {
    const timer = timeouts.find(([, ms]) => ms === REVEAL_MS);
    expect(timer).toBeDefined();
    timer![0]();
  };

  const reduce = (): (() => void) => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes("reduce"),
      media: query,
      addEventListener() {},
      removeEventListener() {},
    })) as unknown as typeof window.matchMedia;
    return () => {
      window.matchMedia = original;
    };
  };

  /** Mounts as the deck does: the first place is asked for before the globe is up. */
  const setUp = async (
    first: [string, number] = ["Europe/Helsinki", 0],
  ): Promise<{ fake: FakeEngine; wall: FakeWall }> => {
    stage = mountSpaceStage(root, { signal: abort.signal });
    stage.goTo(first[0], { at: { slide: first[1], build: 0 } });
    const fake = await ready();
    await vi.waitFor(() => expect(walls).toHaveLength(1));
    return { fake, wall: walls[0]! };
  };

  /** Steps from the title to the wall slide. */
  const toWall = (): void => {
    stage!.goTo("wall", { hop: true, at: { slide: 1, build: 0 } });
  };
  /** Steps on to the slide after the wall, still before the reveal: the wall breaks here. */
  const toDate = (): void => {
    toWall();
    stage!.goTo("planet", { hop: true, at: { slide: 2, build: 0 } });
  };
  const busy = (): boolean => root.hasAttribute("data-stage-busy");

  beforeEach(() => {
    root.remove();
    root = revealFixture();
    HTMLImageElement.prototype.decode = async () => {};
  });

  it("stands a clock where the Earth would be on every slide before the reveal", async () => {
    await setUp();
    expect(face()).not.toBeNull();
    expect(space()).toHaveAttribute("data-earth-clock", "on");
    toWall();
    expect(space()).toHaveAttribute("data-earth-clock", "on");
    stage!.goTo("planet", { hop: true, at: { slide: 2, build: 0 } });
    expect(space()).toHaveAttribute("data-earth-clock", "on");
  });

  it("holds the camera over the North Pole with the zone under the hour hand, at the slide's zoom", async () => {
    const { fake } = await setUp();
    expectRotation(fake.options["initialRotation"] as number[], poleRotation);
    // The globe opens at the slide's zoom, so the clock does not shrink and grow as it takes over.
    expect(fake.options["initialZoom"]).toBe(1);
    expectRotation(aimedAt(fake), poleRotation);
    expect(fake.setZoom).toHaveBeenLastCalledWith(1);
    toWall();
    expectRotation(aimedAt(fake), poleRotation);
    expect(fake.setZoom).toHaveBeenLastCalledWith(0.8);
    expect(space()).toHaveAttribute(
      "data-target",
      `${poleLng.toFixed(2)} 90.00`,
    );
  });

  it("stands the clock in the space layer's frame before the globe is up, not the window's", () => {
    const size = (w: number, h: number): void => {
      Object.defineProperty(space(), "clientWidth", {
        value: w,
        configurable: true,
      });
      Object.defineProperty(space(), "clientHeight", {
        value: h,
        configurable: true,
      });
    };
    const windowHeight = (h: number): void => {
      Object.defineProperty(window, "innerHeight", {
        value: h,
        configurable: true,
      });
      // oxlint-disable-next-line dox-test/no-dispatch-event -- no user action resizes the window in jsdom; the event is the input
      window.dispatchEvent(new Event("resize"));
    };
    const own = Object.getOwnPropertyDescriptor(window, "innerHeight");
    try {
      size(1280, 665);
      stage = mountSpaceStage(root, { signal: abort.signal });
      stage.goTo("Europe/Helsinki", { at: { slide: 0, build: 0 } });
      const first = face()?.style.transform;
      expect(first).toMatch(/^translate\(/);
      // The site header takes the window's height above the layer: the clock does not move for it.
      windowHeight(720);
      expect(face()?.style.transform).toBe(first);
      windowHeight(900);
      expect(face()?.style.transform).toBe(first);
      size(1280, 600);
      // oxlint-disable-next-line dox-test/no-dispatch-event -- no user action resizes the window in jsdom; the event is the input
      window.dispatchEvent(new Event("resize"));
      expect(face()?.style.transform).not.toBe(first);
    } finally {
      if (own) Object.defineProperty(window, "innerHeight", own);
      else Reflect.deleteProperty(window, "innerHeight");
    }
  });

  it("sets the clock's hour ring on the Earth's rim each frame", async () => {
    const { fake } = await setUp();
    fake.frame();
    expect(face()).toHaveStyle({
      width: "400px",
      transform: "translate(300px, 100px)",
    });
  });

  it("breaks the wall over the clock when the talk leaves the wall, before the Earth shows", async () => {
    const { fake, wall } = await setUp();
    toWall();
    holdTimeouts();
    stage!.goTo("planet", { hop: true, at: { slide: 2, build: 0 } });
    expect(wall.flyThrough).toHaveBeenCalledTimes(1);
    expect(space()).toHaveAttribute("data-earth-clock", "on");
    expectRotation(aimedAt(fake), poleRotation);
    expect(timeouts.some(([, ms]) => ms === REVEAL_MS)).toBe(false);
  });

  it("turns the clock into the Earth on the reveal, after the break, and flies to the planet", async () => {
    const { fake, wall } = await setUp();
    const planet = planetPoint();
    toDate();
    holdTimeouts();
    stage!.goTo("planet", { hop: true, at: { slide: 3, build: 0 } });
    expect(space()).toHaveAttribute("data-earth-clock", "morph");
    expect(face()!.style.getPropertyValue(MERIDIAN_TURN_VAR)).toBe(
      `${meridianTurn(poleLng)}deg`,
    );
    expectRotation(aimedAt(fake), poleRotation);
    fake.frame();
    expect(space()).toHaveAttribute("data-flight", "moving");
    expect(space()).toHaveAttribute(
      "data-target",
      `${planet[0].toFixed(2)} ${planet[1].toFixed(2)}`,
    );
    runReveal();
    expect(space()).not.toHaveAttribute("data-earth-clock");
    expect(wall.flyThrough).toHaveBeenCalledTimes(1);
    expectRotation(aimedAt(fake), [-planet[0], -planet[1]]);
    // No zoom dip: the Earth keeps the size the clock had.
    expect(fake.flyTo.mock.calls.at(-1)![1]).toBeUndefined();
  });

  it("holds the turn back until the clock is gone, then begins it", async () => {
    const { fake, wall } = await setUp();
    toDate();
    wall.options["onBreak"]!();
    expect(space()).not.toHaveAttribute("data-turn");
    holdTimeouts();
    stage!.goTo("planet", { hop: true, at: { slide: 3, build: 0 } });
    // The reveal publishes the turn: the gate waits on it from here.
    expect(space()).toHaveAttribute("data-turn", "on");
    fake.frame();
    runReveal();
    expect(space()).not.toHaveAttribute("data-earth-clock");
  });

  it("stops the turn and owes it again when the talk steps back to the clock", async () => {
    const { fake, wall } = await setUp();
    toDate();
    wall.options["onBreak"]!();
    holdTimeouts();
    stage!.goTo("planet", { hop: true, at: { slide: 3, build: 0 } });
    runReveal();
    fake.frame();
    expect(space()).toHaveAttribute("data-turn", "on");
    stage!.goTo("planet", { hop: true, at: { slide: 2, build: 0 } });
    expect(space()).not.toHaveAttribute("data-turn");
    expect(fake.steer).toHaveBeenLastCalledWith({ lng: 0, lat: 0, zoom: 0 });
    stage!.goTo("planet", { hop: true, at: { slide: 3, build: 0 } });
    expect(space()).toHaveAttribute("data-turn", "on");
  });

  it("is busy while the wall breaks and while the clock turns, and idle after", async () => {
    const { wall } = await setUp();
    const idle = vi.fn();
    // oxlint-disable-next-line dox-test/no-house-class -- the event's name, not a class
    root.addEventListener("gmt-stage-idle", idle);
    toDate();
    expect(busy()).toBe(false);
    wall.options["onState"]!("approach");
    expect(busy()).toBe(true);
    wall.options["onState"]!("breaking");
    expect(busy()).toBe(true);
    wall.options["onState"]!("gone");
    expect(busy()).toBe(false);
    expect(idle).toHaveBeenCalledTimes(1);
    holdTimeouts();
    stage!.goTo("planet", { hop: true, at: { slide: 3, build: 0 } });
    expect(busy()).toBe(true);
    runReveal();
    expect(busy()).toBe(false);
    expect(idle).toHaveBeenCalledTimes(2);
  });

  it("is never busy under reduced motion", async () => {
    const undo = reduce();
    try {
      const { wall } = await setUp();
      toDate();
      wall.options["onState"]!("approach");
      expect(busy()).toBe(false);
      holdTimeouts();
      stage!.goTo("planet", { hop: true, at: { slide: 3, build: 0 } });
      expect(busy()).toBe(false);
    } finally {
      undo();
    }
  });

  it("cuts from the clock to the Earth under reduced motion", async () => {
    const undo = reduce();
    try {
      const { fake, wall } = await setUp();
      const planet = planetPoint();
      toDate();
      holdTimeouts();
      stage!.goTo("planet", { hop: true, at: { slide: 3, build: 0 } });
      expect(space()).not.toHaveAttribute("data-earth-clock");
      expect(timeouts.some(([, ms]) => ms === REVEAL_MS)).toBe(false);
      expect(wall.flyThrough).toHaveBeenCalledTimes(1);
      expectRotation(aimedAt(fake), [-planet[0], -planet[1]]);
    } finally {
      undo();
    }
  });

  it("breaks the wall at a jump straight past the date slide, with the reveal over it", async () => {
    const { wall } = await setUp();
    toWall();
    holdTimeouts();
    stage!.goTo("planet", { hop: true, at: { slide: 3, build: 0 } });
    expect(wall.flyThrough).toHaveBeenCalledTimes(1);
    expect(space()).toHaveAttribute("data-earth-clock", "morph");
  });

  it("brings the clock back when the talk steps back before the reveal", async () => {
    const { fake } = await setUp();
    toDate();
    holdTimeouts();
    stage!.goTo("planet", { hop: true, at: { slide: 3, build: 0 } });
    runReveal();
    stage!.goTo("planet", { hop: true, at: { slide: 2, build: 0 } });
    expect(space()).toHaveAttribute("data-earth-clock", "on");
    expectRotation(aimedAt(fake), poleRotation);
  });

  it("stands the clock in the Earth's place again on a slide past the reveal that asks for it", async () => {
    const { fake } = await setUp(["planet", 3]);
    expect(space()).not.toHaveAttribute("data-earth-clock");
    stage!.goTo("Europe/Helsinki", { hop: true, at: { slide: 4, build: 0 } });
    expect(space()).toHaveAttribute("data-earth-clock", "on");
    expectRotation(aimedAt(fake), poleRotation);
    stage!.goTo("planet", { hop: true, at: { slide: 3, build: 0 } });
    expect(space()).not.toHaveAttribute("data-earth-clock");
  });

  it("keeps the clock, with no reveal, on a jump from the title straight to that slide", async () => {
    await setUp();
    holdTimeouts();
    stage!.goTo("Europe/Helsinki", { hop: true, at: { slide: 4, build: 0 } });
    expect(space()).toHaveAttribute("data-earth-clock", "on");
    expect(timeouts.some(([, ms]) => ms === REVEAL_MS)).toBe(false);
  });

  it("stands the clock in the Earth's place, held at each build's instant, and lets it go after", async () => {
    const { fake } = await setUp(["greenwich", 5]);
    const hour = (): Element | null =>
      root.querySelector('[data-earth-clock-face] [data-hand="hour"]');
    expect(space()).not.toHaveAttribute("data-earth-clock");
    stage!.goTo("greenwich", { at: { slide: 5, build: 1 } });
    expect(space()).toHaveAttribute("data-earth-clock", "on");
    expectRotation(aimedAt(fake), poleRotation);
    // 02:59 is 179 minutes into the day, at a quarter of a degree a minute.
    await vi.waitFor(() =>
      expect(hour()).toHaveAttribute("transform", "rotate(44.75 50 50)"),
    );
    // The build listed first in the markup is the later one: the highest reached build holds it.
    stage!.goTo("greenwich", { at: { slide: 5, build: 2 } });
    expect(hour()).toHaveAttribute("transform", "rotate(60 50 50)");
    expect(face()).toHaveTextContent("UTC+03:00");
    stage!.goTo("greenwich", { at: { slide: 5, build: 0 } });
    expect(space()).not.toHaveAttribute("data-earth-clock");
    // The place is the same, but the camera leaves the pole for it.
    expectRotation(aimedAt(fake), rotationFor(resolvePlace("greenwich"), ctx));
  });

  it("shows the Earth in the overview and the clock again after it", async () => {
    await setUp();
    stage!.overview(true);
    expect(space()).not.toHaveAttribute("data-earth-clock");
    stage!.overview(false);
    expect(space()).toHaveAttribute("data-earth-clock", "on");
  });

  it("finishes the reveal at once when the overview opens during it", async () => {
    const { wall } = await setUp();
    toDate();
    holdTimeouts();
    stage!.goTo("planet", { hop: true, at: { slide: 3, build: 0 } });
    stage!.overview(true);
    expect(space()).not.toHaveAttribute("data-earth-clock");
    expect(wall.flyThrough).toHaveBeenCalledTimes(1);
    stage!.overview(false);
    expect(space()).not.toHaveAttribute("data-earth-clock");
    runReveal();
    expect(wall.flyThrough).toHaveBeenCalledTimes(1);
  });

  it("shows the Earth with no clock and no reveal on a deep link past it", async () => {
    holdTimeouts();
    const { fake } = await setUp(["planet", 3]);
    const planet = planetPoint();
    expect(space()).not.toHaveAttribute("data-earth-clock");
    expect(timeouts.some(([, ms]) => ms === REVEAL_MS)).toBe(false);
    expectRotation(fake.options["initialRotation"] as number[], [
      -planet[0],
      -planet[1],
    ]);
  });

  it("keeps the clock in the Earth's place when the globe cannot start, and cuts it at the reveal", async () => {
    failEngine = true;
    Object.defineProperty(space(), "clientWidth", {
      value: 1024,
      configurable: true,
    });
    Object.defineProperty(space(), "clientHeight", {
      value: 768,
      configurable: true,
    });
    stage = mountSpaceStage(root, { signal: abort.signal });
    stage.goTo("Europe/Helsinki", { at: { slide: 0, build: 0 } });
    await vi.waitFor(() => expect(skyCalls.drawWithout).toBe(1));
    expect(space()).toHaveAttribute("data-earth-clock", "on");
    // The right third of a 1024 by 768 space layer at zoom 1: a rim of 153.6 pixels.
    expect(face()).toHaveStyle({ width: "384px" });
    stage.goTo("planet", { hop: true, at: { slide: 2, build: 0 } });
    stage.goTo("planet", { hop: true, at: { slide: 3, build: 0 } });
    expect(space()).not.toHaveAttribute("data-earth-clock");
  });

  it("has no clock in a deck with no reveal", async () => {
    root.remove();
    root = fixture();
    stage = mountSpaceStage(root, { signal: abort.signal });
    await ready();
    expect(face()).toBeNull();
    expect(space()).not.toHaveAttribute("data-earth-clock");
  });
});
