/**
 * @vitest-environment jsdom
 *
 * The space stage over a fixture deck: the route, the globe, the ice wall and the Earth's spin. The globe engine, the sky and the theme reader are fakes (`~/test/stage-fixture`): what is under test is what the stage asks of them, in what order, and that it cleans up. The opt-in features have their own files: `stage-lapse.test.ts` and `stage-reveal.test.ts`.
 */
/*
 * The stage draws into aria-hidden canvases and reads the deck's data-* hooks; nothing it does is
 * perceivable by a person or assistive technology, so its contract is asserted on those hooks and
 * on the calls it makes to the (faked) engine.
 */
/* oxlint-disable dox-test/no-markup-read, dox-test/no-implementation-assert, dox-test/no-class-query, testing-library/no-node-access */
import { installJsdomShims, stubReducedMotion } from "~/test/jsdom-shims";
import {
  control,
  engine,
  fixture,
  made,
  stageHarness,
  skyCalls,
  walls,
  type FakeEngine,
  type FakeWall,
} from "~/test/stage-fixture";
import {
  FIXTURE_PLANET_ZONES,
  FIXTURE_STAGE as STAGE,
} from "~/test/deck-stage-fixture";
import { setLook } from "~/lib/look";
import { getPlanetZones } from "./places";
import { mountSpaceStage } from "./stage";
import { legsOf, readStops } from "./stage-route";

installJsdomShims();

vi.mock("~/lib/globe/engine", async () =>
  (await import("~/test/stage-fixture")).engineMock(),
);
vi.mock("./ice-wall/wall", async () =>
  (await import("~/test/stage-fixture")).wallMock(),
);
vi.mock("./gmt-loader", async (original) =>
  (await import("~/test/stage-fixture")).gmtLoaderMock(await original()),
);
vi.mock("./title-clock", async () =>
  (await import("~/test/stage-fixture")).titleClockMock(),
);
vi.mock("~/lib/globe/globe-theme", async () =>
  (await import("~/test/stage-fixture")).themeMock(),
);
vi.mock("~/lib/space-sky", async () =>
  (await import("~/test/stage-fixture")).skyMock(),
);

const h = stageHarness((root, signal) =>
  mountSpaceStage(root, { signal, data: STAGE }),
);

describe("the route", () => {
  it("lists the places slides and builds name, in order, geographic ones only", () => {
    const stops = readStops(h.root);
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
    h.root.querySelector("[data-deck-stage]")!.append(again);
    expect(legsOf(readStops(h.root))).toHaveLength(2);
  });
});

describe("the globe", () => {
  it("starts the engine with a still, capped, hidden-aware configuration", async () => {
    h.mount();
    const fake = await h.ready();
    expect(fake.options).toMatchObject({
      ambient: false,
      maxDpr: 1.5,
      zoomRange: [0.5, 4],
      imageryUrl: "/earth.webp",
    });
    expect(fake.options["pauseWhenHidden"]).toBe(
      h.root.querySelector("[data-deck-space]"),
    );
    expect(fake.options["sunInstant"]).toEqual(expect.any(Function));
    expect(h.root).toHaveAttribute("data-space");
  });

  it("keeps the canvas out of the tab order and the accessibility tree", async () => {
    h.mount();
    await h.ready();
    const canvas = h.root.querySelector<HTMLCanvasElement>(
      "[data-deck-space] > canvas",
    )!;
    expect(canvas).not.toHaveAttribute("tabindex");
    expect(canvas).not.toHaveAttribute("role");
    expect(canvas).toHaveAttribute("aria-hidden", "true");
  });

  it("flies a hop to a new place, and a plain ease with no hop asked for", async () => {
    h.mount();
    const fake = await h.ready();
    h.stage.goTo("Asia/Tokyo", { hop: true, at: { slide: 1, build: 0 } });
    const [rotation, flight] = fake.flyTo.mock.calls.at(-1)!;
    expect(rotation[0]).toBeCloseTo(-139.74, 1);
    expect(flight.hop.durationMs).toBeGreaterThanOrEqual(2000);
    expect(flight.hop.durationMs).toBeLessThanOrEqual(4000);
    h.stage.goTo("Asia/Manila", { at: { slide: 1, build: 1 } });
    expect(fake.flyTo.mock.calls.at(-1)).toHaveLength(1);
  });

  it("does nothing when asked for the place it already holds", async () => {
    h.mount();
    const fake = await h.ready();
    h.stage.goTo("Asia/Tokyo", { hop: true, at: { slide: 1, build: 0 } });
    const calls = fake.flyTo.mock.calls.length;
    h.stage.goTo("Asia/Tokyo", { hop: true, at: { slide: 1, build: 0 } });
    expect(fake.flyTo.mock.calls).toHaveLength(calls);
  });

  it("returns to the slide's place after free flight, and a step does the same", async () => {
    h.mount();
    const fake = await h.ready();
    h.stage.goTo("Asia/Tokyo", { hop: true, at: { slide: 1, build: 0 } });
    const calls = fake.flyTo.mock.calls.length;
    h.stage.returnHome();
    expect(fake.flyTo.mock.calls).toHaveLength(calls);
    h.stage.steer({ lng: 60, lat: 0, zoom: 0 });
    h.stage.steer({ lng: 0, lat: 0, zoom: 0 });
    h.stage.returnHome();
    expect(fake.flyTo.mock.calls).toHaveLength(calls + 1);
    h.stage.steer({ lng: 0, lat: 60, zoom: 0 });
    h.stage.goTo("Asia/Tokyo", { hop: true, at: { slide: 1, build: 0 } });
    expect(fake.flyTo.mock.calls).toHaveLength(calls + 2);
  });

  it("returns after a drag", async () => {
    h.mount();
    const fake = await h.ready();
    h.stage.goTo("Asia/Tokyo", { hop: true, at: { slide: 1, build: 0 } });
    const calls = fake.flyTo.mock.calls.length;
    fake.interact();
    h.stage.returnHome();
    expect(fake.flyTo.mock.calls).toHaveLength(calls + 1);
  });

  it("passes a held rate to the engine and stops it on zeros", async () => {
    h.mount();
    const fake = await h.ready();
    h.stage.steer({ lng: 60, lat: 0, zoom: 1 });
    h.stage.steer({ lng: 0, lat: 0, zoom: 0 });
    expect(fake.steer.mock.calls).toEqual([
      [{ lng: 60, lat: 0, zoom: 1 }],
      [{ lng: 0, lat: 0, zoom: 0 }],
    ]);
  });

  it("publishes whether the camera moves, and where it rests, after each frame", async () => {
    h.mount();
    const fake = await h.ready();
    const space = h.root.querySelector<HTMLElement>("[data-deck-space]")!;
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
    h.mount();
    const fake = await h.ready();
    h.stage.goTo("Asia/Tokyo", { hop: true, at: { slide: 1, build: 0 } });
    expect(
      fake.setMarkers.mock.calls
        .at(-1)![0]
        .filter((m: { label?: string }) => m.label),
    ).toHaveLength(1);
    expect(fake.setArcs.mock.calls.at(-1)![0]).toHaveLength(1);
    h.stage.overview(true);
    expect(
      fake.setMarkers.mock.calls
        .at(-1)![0]
        .filter((m: { label?: string }) => m.label),
    ).toHaveLength(3);
    expect(fake.setArcs.mock.calls.at(-1)![0]).toHaveLength(2);
    const calls = fake.flyTo.mock.calls.length;
    h.stage.overview(false);
    expect(fake.flyTo.mock.calls).toHaveLength(calls + 1);
    expect(fake.setArcs.mock.calls.at(-1)![0]).toHaveLength(1);
  });

  it("frames the Earth in the right third on every slide, whatever the slide", async () => {
    h.mount();
    const fake = await h.ready();
    const framing = fake.options["framing"] as (
      w: number,
      h: number,
    ) => { cx: number; cy: number; radius: number };
    const before = framing(1200, 600);
    h.stage.goTo("Asia/Tokyo", { hop: true, at: { slide: 1, build: 0 } });
    h.stage.goTo("wall", { hop: true, at: { slide: 2, build: 0 } });
    expect(framing(1200, 600)).toEqual(before);
    // Five sixths across: the middle of the right third.
    expect(before.cx).toBe(1000);
    expect(before.cy).toBe(300);
    expect(fake.refit).not.toHaveBeenCalled();
  });

  it("flies a cut under reduced motion", async () => {
    const undo = stubReducedMotion(true);
    try {
      h.mount();
      const fake = await h.ready();
      h.stage.goTo("Asia/Tokyo", { hop: true, at: { slide: 1, build: 0 } });
      expect(fake.flyTo.mock.calls.at(-1)).toHaveLength(1);
    } finally {
      undo();
    }
  });

  it("destroys the engine with the stage", async () => {
    h.mount();
    const fake = await h.ready();
    h.stage.destroy();
    expect(fake.destroy).toHaveBeenCalledTimes(1);
    expect(h.root).not.toHaveAttribute("data-space");
  });

  it("re-reads the theme once for each look flip, and stops when the stage's signal aborts", async () => {
    h.mount();
    const fake = await h.ready();
    try {
      setLook("natural");
      await vi.waitFor(() => expect(fake.setTheme).toHaveBeenCalledTimes(1));
      h.abort();
      setLook("ice");
      await new Promise((resolve) => setTimeout(resolve));
      expect(fake.setTheme).toHaveBeenCalledTimes(1);
    } finally {
      setLook("ice");
    }
  });

  it("destroys an engine that arrives after the stage is gone", async () => {
    let release: () => void = () => {};
    control.hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { createGlobeEngine } = await import("~/lib/globe/engine");
    vi.mocked(createGlobeEngine).mockClear();
    h.mount();
    await vi.waitFor(() => expect(createGlobeEngine).toHaveBeenCalled());
    h.stage.destroy();
    release();
    await vi.waitFor(() => expect(made).toHaveLength(1));
    await vi.waitFor(() => expect(engine().destroy).toHaveBeenCalledTimes(1));
    expect(h.root.querySelector("[data-deck-space]")).not.toHaveAttribute(
      "data-globe",
    );
  });
});

describe("when the globe cannot start", () => {
  it("draws the sky once without it and throws nothing", async () => {
    control.fail = true;
    h.mount();
    await vi.waitFor(() => expect(skyCalls.drawWithout).toBe(1));
    expect(h.root.querySelector("[data-deck-space]")).toHaveAttribute(
      "data-globe",
      "none",
    );
    expect(skyCalls.follow).toBe(0);
    expect(() => {
      h.stage.goTo("Asia/Tokyo", { hop: true });
      h.stage.steer({ lng: 1, lat: 0, zoom: 0 });
      h.stage.returnHome();
      h.stage.overview(true);
    }).not.toThrow();
  });

  it("does nothing without a space layer", () => {
    h.root.querySelector("[data-deck-space]")!.remove();
    h.mount();
    expect(() => h.stage.goTo("Asia/Tokyo")).not.toThrow();
    expect(h.root).not.toHaveAttribute("data-space");
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
    h.mount();
    const fake = await h.ready();
    await vi.waitFor(() => expect(walls).toHaveLength(1));
    return { fake, wall: walls[0]! };
  };

  beforeEach(() => {
    h.useDeck(wallFixture());
    HTMLImageElement.prototype.decode = async () => {};
  });

  it("is not mounted for a deck with no panes", async () => {
    h.useDeck(fixture());
    h.mount();
    await h.ready();
    expect(walls).toHaveLength(0);
  });

  it("hangs on a wall slide and shows no clocks", async () => {
    const { fake, wall } = await setUpWall();
    h.stage.goTo("wall", { hop: true, at: { slide: 0, build: 0 } });
    expect(wall.show).toHaveBeenCalled();
    expect(clockIds(fake)).toEqual([]);
  });

  it("breaks into one shard for each planet zone, up to twelve, when the talk steps on", async () => {
    const { wall } = await setUpWall();
    h.stage.goTo("wall", { hop: true, at: { slide: 1, build: 0 } });
    h.stage.goTo("planet", { hop: true, at: { slide: 2, build: 0 } });
    expect(wall.flyThrough).toHaveBeenCalledTimes(1);
    const zones = wall.flyThrough.mock.calls[0]![0] as string[];
    const planet = getPlanetZones().length;
    expect(planet).toBe(FIXTURE_PLANET_ZONES.length);
    expect(zones).toHaveLength(Math.min(12, planet));
    expect(new Set(zones).size).toBe(zones.length);
  });

  it("lights a clock with the local time as each shard lands, and the rest at the break", async () => {
    const { fake, wall } = await setUpWall();
    h.stage.goTo("wall", { hop: true, at: { slide: 1, build: 0 } });
    h.stage.goTo("planet", { hop: true, at: { slide: 2, build: 0 } });
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

  it("lights every clock at once on a deep link to the planet", async () => {
    h.root
      .querySelectorAll("[data-slide]")[0]!
      .setAttribute("data-place", "planet");
    const { fake, wall } = await setUpWall();
    h.stage.goTo("planet", { hop: false, at: { slide: 0, build: 0 } });
    expect(wall.hide).toHaveBeenCalled();
    expect(clockIds(fake)).toHaveLength(getPlanetZones().length);
  });

  it("brings the wall back whole when the talk steps back from the planet", async () => {
    const { fake, wall } = await setUpWall();
    h.stage.goTo("wall", { hop: true, at: { slide: 1, build: 0 } });
    h.stage.goTo("planet", { hop: true, at: { slide: 2, build: 0 } });
    h.stage.goTo("wall", { hop: true, at: { slide: 1, build: 0 } });
    expect(wall.restore).toHaveBeenCalledTimes(1);
    expect(clockIds(fake)).toEqual([]);
  });

  it("matches the wall's depth to the camera's zoom while it hangs", async () => {
    const { fake, wall } = await setUpWall();
    h.stage.goTo("wall", { hop: true, at: { slide: 1, build: 0 } });
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
    h.stage.destroy();
    expect(wall.destroy).toHaveBeenCalledTimes(1);
  });
});

/** Helsinki, then three planet slides that turn the Earth, then one that holds a place. */
function spinFixture(): HTMLElement {
  const spinRoot = document.createElement("article");
  spinRoot.innerHTML = `
    <div data-deck-space data-sky-src="/sky.bin" data-earth="/earth.webp"></div>
    <div data-deck-stage>
      <section data-slide data-place="Europe/Helsinki"><h2>One</h2></section>
      <section data-slide data-place="planet" data-spin><h2>Two</h2></section>
      <section data-slide data-place="planet" data-spin><h2>Three</h2></section>
      <section data-slide data-place="planet"><h2>Four</h2></section>
    </div>`;
  document.body.append(spinRoot);
  return spinRoot;
}

describe("the Earth's spin", () => {
  const at = (slide: number) => ({ hop: true, at: { slide, build: 0 } });
  const spinSpace = (): HTMLElement =>
    h.root.querySelector<HTMLElement>("[data-deck-space]")!;

  beforeEach(() => {
    h.useDeck(spinFixture());
  });

  const start = async (): Promise<FakeEngine> => {
    h.mount();
    const fake = await h.ready();
    h.stage.goTo("Europe/Helsinki", at(0));
    return fake;
  };

  it("asks the engine to spin on a spin slide, and publishes it", async () => {
    const fake = await start();
    expect(fake.setSpin).not.toHaveBeenCalled();
    expect(spinSpace()).not.toHaveAttribute("data-spin");
    h.stage.goTo("planet", at(1));
    fake.frame();
    expect(fake.setSpin).toHaveBeenLastCalledWith(true);
    expect(spinSpace()).toHaveAttribute("data-spin", "on");
  });

  it("keeps the spin and the camera still between two spin slides on the same place", async () => {
    const fake = await start();
    h.stage.goTo("planet", at(1));
    fake.frame();
    fake.spinActive = true;
    const flights = fake.flyTo.mock.calls.length;
    h.stage.goTo("planet", at(2));
    fake.frame();
    expect(fake.flyTo.mock.calls.length).toBe(flights);
    expect(fake.setSpin).toHaveBeenCalledTimes(1);
  });

  it("hands the turning Earth straight to the flight back, at its own speed and with no dip", async () => {
    const fake = await start();
    h.stage.goTo("planet", at(2));
    fake.frame();
    fake.spinActive = true;
    const flights = fake.flyTo.mock.calls.length;
    h.stage.goTo("Europe/Helsinki", at(0));
    expect(fake.setSpin).toHaveBeenLastCalledWith(false);
    // At once, and with no hop: the controller carries the spin's speed into the flight.
    expect(fake.flyTo.mock.calls.length).toBe(flights + 1);
    expect(fake.flyTo.mock.calls.at(-1)).toHaveLength(1);
    fake.frame();
    expect(spinSpace()).not.toHaveAttribute("data-spin");
  });

  it("flies back at once when the Earth was not spinning yet", async () => {
    const fake = await start();
    h.stage.goTo("planet", at(1));
    const flights = fake.flyTo.mock.calls.length;
    h.stage.goTo("Europe/Helsinki", at(0));
    expect(fake.flyTo.mock.calls.length).toBe(flights + 1);
  });

  it("turns again when the talk steps back onto a spin slide", async () => {
    const fake = await start();
    h.stage.goTo("planet", at(2));
    fake.frame();
    fake.spinActive = true;
    h.stage.goTo("planet", at(3));
    h.stage.goTo("planet", at(2));
    fake.frame();
    expect(fake.setSpin).toHaveBeenLastCalledWith(true);
    expect(spinSpace()).toHaveAttribute("data-spin", "on");
  });

  it("does not spin under reduced motion", async () => {
    const undo = stubReducedMotion(true);
    try {
      const fake = await start();
      h.stage.goTo("planet", at(1));
      fake.frame();
      expect(fake.setSpin).not.toHaveBeenCalled();
      expect(spinSpace()).not.toHaveAttribute("data-spin");
    } finally {
      undo();
    }
  });

  it("does not spin in the overview, and goes on after it", async () => {
    const fake = await start();
    h.stage.goTo("planet", at(1));
    fake.frame();
    h.stage.overview(true);
    fake.frame();
    expect(fake.setSpin).toHaveBeenLastCalledWith(false);
    h.stage.overview(false);
    fake.frame();
    expect(fake.setSpin).toHaveBeenLastCalledWith(true);
  });

  it("starts only after the wall has broken", async () => {
    h.useDeck(wallFixture());
    h.root.querySelectorAll("[data-slide]")[2]!.setAttribute("data-spin", "");
    HTMLImageElement.prototype.decode = async () => {};
    h.mount();
    const fake = await h.ready();
    await vi.waitFor(() => expect(walls).toHaveLength(1));
    const wall = walls[0]!;
    h.stage.goTo("wall", at(1));
    wall.options["onState"]!("whole");
    h.stage.goTo("planet", at(2));
    wall.options["onState"]!("approach");
    wall.options["onState"]!("breaking");
    fake.frame();
    expect(fake.setSpin).not.toHaveBeenCalled();
    wall.options["onState"]!("gone");
    fake.frame();
    expect(fake.setSpin).toHaveBeenLastCalledWith(true);
  });
});
