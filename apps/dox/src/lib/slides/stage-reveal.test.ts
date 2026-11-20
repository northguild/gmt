/**
 * @vitest-environment jsdom
 *
 * The clock that stands in the Earth's place and breaks away to show it (`stage-reveal.ts`), over the talk's opening slides.
 */
/*
 * The stage draws into aria-hidden canvases and reads the deck's data-* hooks; nothing it does is
 * perceivable by a person or assistive technology, so its contract is asserted on those hooks and
 * on the calls it makes to the (faked) engine.
 */
/* oxlint-disable dox-test/no-markup-read, dox-test/no-implementation-assert, dox-test/no-class-query, testing-library/no-node-access */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { installJsdomShims, stubReducedMotion } from "~/test/jsdom-shims";
import {
  control,
  fixture,
  NOW,
  stageHarness,
  skyCalls,
  walls,
  type FakeEngine,
  type FakeWall,
} from "~/test/stage-fixture";
import { FIXTURE_STAGE as STAGE } from "~/test/deck-stage-fixture";
import { pointFor, resolvePlace, rotationFor } from "./places";
import { mountSpaceStage } from "./stage";
import { CLEAR_MS } from "./ice-wall/wall-run";
import { REVEAL_MS } from "./stage-reveal";

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
      <section data-slide data-place="planet" data-plain-clock><h2>Three</h2></section>
      <section data-slide data-place="planet" data-reveal="Europe/Helsinki" data-spin><h2>Four</h2></section>
      <section data-slide data-place="Europe/Helsinki" data-clock><h2>Five</h2></section>
      <section data-slide data-place="meridian"><h2>Six</h2>
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
  /** Read after mounting: the stage sets the planet's zones from the deck's data. */
  const planetPoint = (): readonly [number, number] =>
    pointFor({ kind: "planet" }, ctx);

  const space = (): HTMLElement =>
    h.root.querySelector<HTMLElement>("[data-deck-space]")!;
  const face = (): HTMLElement | null =>
    h.root.querySelector<HTMLElement>("[data-earth-clock-face]");
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

  const reduce = (): (() => void) => stubReducedMotion(true);

  /** Mounts as the deck does: the first place is asked for before the globe is up. */
  const setUp = async (
    first: [string, number] = ["Europe/Helsinki", 0],
  ): Promise<{ fake: FakeEngine; wall: FakeWall }> => {
    h.mount();
    h.stage.goTo(first[0], { at: { slide: first[1], build: 0 } });
    const fake = await h.ready();
    await vi.waitFor(() => expect(walls).toHaveLength(1));
    return { fake, wall: walls[0]! };
  };

  /** Steps from the title to the wall slide. */
  const toWall = (): void => {
    h.stage.goTo("wall", { hop: true, at: { slide: 1, build: 0 } });
  };
  /** Steps on to the slide after the wall, still before the reveal: the wall breaks here. */
  const toDate = (): void => {
    toWall();
    h.stage.goTo("planet", { hop: true, at: { slide: 2, build: 0 } });
  };
  const busy = (): boolean => h.root.hasAttribute("data-stage-busy");

  beforeEach(() => {
    h.useDeck(revealFixture());
    HTMLImageElement.prototype.decode = async () => {};
  });

  it("stands a clock where the Earth would be on every slide before the reveal", async () => {
    await setUp();
    expect(face()).not.toBeNull();
    expect(space()).toHaveAttribute("data-earth-clock", "on");
    toWall();
    expect(space()).toHaveAttribute("data-earth-clock", "on");
    h.stage.goTo("planet", { hop: true, at: { slide: 2, build: 0 } });
    expect(space()).toHaveAttribute("data-earth-clock", "on");
  });

  it("shows the clock plain on a slide that asks for it, and breaks it plain on the reveal", async () => {
    await setUp();
    expect(face()).not.toHaveAttribute("data-plain");
    toDate();
    expect(face()).toHaveAttribute("data-plain");
    h.stage.goTo("wall", { hop: true, at: { slide: 1, build: 0 } });
    expect(face()).not.toHaveAttribute("data-plain");
    h.stage.goTo("planet", { hop: true, at: { slide: 2, build: 0 } });
    holdTimeouts();
    h.stage.goTo("planet", { hop: true, at: { slide: 3, build: 0 } });
    expect(space()).toHaveAttribute("data-earth-clock", "shatter");
    expect(face()).toHaveAttribute("data-plain");
    runReveal();
    h.stage.goTo("Europe/Helsinki", { hop: true, at: { slide: 4, build: 0 } });
    expect(face()).not.toHaveAttribute("data-plain");
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
      h.mount();
      h.stage.goTo("Europe/Helsinki", { at: { slide: 0, build: 0 } });
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
    h.stage.goTo("planet", { hop: true, at: { slide: 2, build: 0 } });
    expect(wall.flyThrough).toHaveBeenCalledTimes(1);
    expect(space()).toHaveAttribute("data-earth-clock", "on");
    expectRotation(aimedAt(fake), poleRotation);
    expect(timeouts.some(([, ms]) => ms === REVEAL_MS)).toBe(false);
  });

  it("shatters the clock on the reveal, the Earth already turned to the planet behind it", async () => {
    const { fake, wall } = await setUp();
    const planet = planetPoint();
    toDate();
    holdTimeouts();
    h.stage.goTo("planet", { hop: true, at: { slide: 3, build: 0 } });
    expect(space()).toHaveAttribute("data-earth-clock", "shatter");
    // The Earth turns while the clock still hides it, so it emerges in place and never swings.
    expectRotation(aimedAt(fake), [-planet[0], -planet[1]]);
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

  it("holds the spin back until the clock is gone, then begins it", async () => {
    const { fake, wall } = await setUp();
    toDate();
    wall.options["onBreak"]!();
    wall.options["onState"]!("gone");
    fake.frame();
    expect(fake.setSpin).not.toHaveBeenCalled();
    holdTimeouts();
    h.stage.goTo("planet", { hop: true, at: { slide: 3, build: 0 } });
    // The clock is still turning into the Earth.
    fake.frame();
    expect(fake.setSpin).not.toHaveBeenCalled();
    runReveal();
    fake.frame();
    expect(fake.setSpin).toHaveBeenLastCalledWith(true);
    expect(space()).toHaveAttribute("data-spin", "on");
  });

  it("stops the spin when the talk steps back to the clock, and turns again on the way forward", async () => {
    const { fake, wall } = await setUp();
    toDate();
    wall.options["onBreak"]!();
    wall.options["onState"]!("gone");
    holdTimeouts();
    h.stage.goTo("planet", { hop: true, at: { slide: 3, build: 0 } });
    runReveal();
    fake.frame();
    expect(space()).toHaveAttribute("data-spin", "on");
    h.stage.goTo("planet", { hop: true, at: { slide: 2, build: 0 } });
    expect(space()).not.toHaveAttribute("data-spin");
    expect(fake.setSpin).toHaveBeenLastCalledWith(false);
    timeouts.length = 0;
    h.stage.goTo("planet", { hop: true, at: { slide: 3, build: 0 } });
    runReveal();
    fake.frame();
    expect(fake.setSpin).toHaveBeenLastCalledWith(true);
  });

  it("is busy while the wall breaks and idle after, and the clock's shards hold no text back", async () => {
    const { wall } = await setUp();
    const idle = vi.fn();
    // oxlint-disable-next-line dox-test/no-house-class -- the event's name, not a class
    h.root.addEventListener("gmt-stage-idle", idle);
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
    h.stage.goTo("planet", { hop: true, at: { slide: 3, build: 0 } });
    expect(busy()).toBe(false);
    runReveal();
    expect(busy()).toBe(false);
    expect(idle).toHaveBeenCalledTimes(1);
  });

  it("is never busy under reduced motion", async () => {
    const undo = reduce();
    try {
      const { wall } = await setUp();
      toDate();
      wall.options["onState"]!("approach");
      expect(busy()).toBe(false);
      holdTimeouts();
      h.stage.goTo("planet", { hop: true, at: { slide: 3, build: 0 } });
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
      h.stage.goTo("planet", { hop: true, at: { slide: 3, build: 0 } });
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
    h.stage.goTo("planet", { hop: true, at: { slide: 3, build: 0 } });
    expect(wall.flyThrough).toHaveBeenCalledTimes(1);
    expect(space()).toHaveAttribute("data-earth-clock", "shatter");
  });

  it("breaks the wall first on the step past it, then shatters the clock once the wall's shards have faded", async () => {
    const { wall } = await setUp();
    toWall();
    holdTimeouts();
    wall.flyThrough.mockImplementation(() =>
      wall.options["onState"]!("approach"),
    );
    h.stage.goTo("planet", { hop: true, at: { slide: 3, build: 0 } });
    expect(wall.flyThrough).toHaveBeenCalledTimes(1);
    // The clock stands whole while the wall in front of it breaks.
    expect(space()).toHaveAttribute("data-earth-clock", "on");
    const waiting = timeouts.find(([, ms]) => ms === CLEAR_MS);
    expect(waiting).toBeDefined();
    expect(timeouts.some(([, ms]) => ms === REVEAL_MS)).toBe(false);
    waiting![0]();
    expect(space()).toHaveAttribute("data-earth-clock", "shatter");
    runReveal();
    expect(space()).not.toHaveAttribute("data-earth-clock");
  });

  it("brings the clock back when the talk steps back before the reveal", async () => {
    const { fake } = await setUp();
    toDate();
    holdTimeouts();
    h.stage.goTo("planet", { hop: true, at: { slide: 3, build: 0 } });
    runReveal();
    h.stage.goTo("planet", { hop: true, at: { slide: 2, build: 0 } });
    expect(space()).toHaveAttribute("data-earth-clock", "on");
    expectRotation(aimedAt(fake), poleRotation);
  });

  it("stands the clock in the Earth's place again on a slide past the reveal that asks for it", async () => {
    const { fake } = await setUp(["planet", 3]);
    expect(space()).not.toHaveAttribute("data-earth-clock");
    h.stage.goTo("Europe/Helsinki", { hop: true, at: { slide: 4, build: 0 } });
    expect(space()).toHaveAttribute("data-earth-clock", "on");
    expectRotation(aimedAt(fake), poleRotation);
    h.stage.goTo("planet", { hop: true, at: { slide: 3, build: 0 } });
    expect(space()).not.toHaveAttribute("data-earth-clock");
  });

  it("keeps the clock, with no reveal, on a jump from the title straight to that slide", async () => {
    await setUp();
    holdTimeouts();
    h.stage.goTo("Europe/Helsinki", { hop: true, at: { slide: 4, build: 0 } });
    expect(space()).toHaveAttribute("data-earth-clock", "on");
    expect(timeouts.some(([, ms]) => ms === REVEAL_MS)).toBe(false);
  });

  it("stands the clock in the Earth's place, held at each build's instant, and lets it go after", async () => {
    const { fake } = await setUp(["meridian", 5]);
    const hour = (): Element | null =>
      h.root.querySelector('[data-earth-clock-face] [data-hand="hour"]');
    expect(space()).not.toHaveAttribute("data-earth-clock");
    h.stage.goTo("meridian", { at: { slide: 5, build: 1 } });
    expect(space()).toHaveAttribute("data-earth-clock", "on");
    expectRotation(aimedAt(fake), poleRotation);
    // 02:59 is 179 minutes into the day, at a quarter of a degree a minute.
    await vi.waitFor(() =>
      expect(hour()).toHaveAttribute("transform", "rotate(44.75 50 50)"),
    );
    // The build listed first in the markup is the later one: the highest reached build holds it.
    h.stage.goTo("meridian", { at: { slide: 5, build: 2 } });
    expect(hour()).toHaveAttribute("transform", "rotate(60 50 50)");
    expect(face()).toHaveTextContent("UTC+03:00");
    h.stage.goTo("meridian", { at: { slide: 5, build: 0 } });
    expect(space()).not.toHaveAttribute("data-earth-clock");
    // The place is the same, but the camera leaves the pole for it.
    expectRotation(aimedAt(fake), rotationFor(resolvePlace("meridian"), ctx));
  });

  it("stands the clock at the talk's start while the deck is locked, and ticks the time now once unlocked", async () => {
    h.root.setAttribute("data-deck-root", "");
    h.root.setAttribute("data-deck-preview-at", "2026-12-16T16:00:00Z");
    h.root.setAttribute("data-locked", "");
    await setUp();
    const hour = (): Element | null =>
      h.root.querySelector('[data-earth-clock-face] [data-hand="hour"]');
    // 18:00 in Helsinki is 1080 minutes into the day, at a quarter of a degree a minute.
    await vi.waitFor(() =>
      expect(hour()).toHaveAttribute("transform", "rotate(270 50 50)"),
    );
    expect(face()).toHaveTextContent("16");
    h.root.removeAttribute("data-locked");
    // The faked clock reads 23:30 now.
    await vi.waitFor(() =>
      expect(hour()).toHaveAttribute("transform", "rotate(352.5 50 50)"),
    );
    h.root.setAttribute("data-locked", "");
    await vi.waitFor(() =>
      expect(hour()).toHaveAttribute("transform", "rotate(270 50 50)"),
    );
  });

  it("shows the Earth in the overview and the clock again after it", async () => {
    await setUp();
    h.stage.overview(true);
    expect(space()).not.toHaveAttribute("data-earth-clock");
    h.stage.overview(false);
    expect(space()).toHaveAttribute("data-earth-clock", "on");
  });

  it("finishes the reveal at once when the overview opens during it", async () => {
    const { wall } = await setUp();
    toDate();
    holdTimeouts();
    h.stage.goTo("planet", { hop: true, at: { slide: 3, build: 0 } });
    h.stage.overview(true);
    expect(space()).not.toHaveAttribute("data-earth-clock");
    expect(wall.flyThrough).toHaveBeenCalledTimes(1);
    h.stage.overview(false);
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
    control.fail = true;
    Object.defineProperty(space(), "clientWidth", {
      value: 1024,
      configurable: true,
    });
    Object.defineProperty(space(), "clientHeight", {
      value: 768,
      configurable: true,
    });
    h.mount();
    h.stage.goTo("Europe/Helsinki", { at: { slide: 0, build: 0 } });
    await vi.waitFor(() => expect(skyCalls.drawWithout).toBe(1));
    expect(space()).toHaveAttribute("data-earth-clock", "on");
    // The right third of a 1024 by 768 space layer at zoom 1: a rim of 153.6 pixels.
    expect(face()).toHaveStyle({ width: "384px" });
    h.stage.goTo("planet", { hop: true, at: { slide: 2, build: 0 } });
    h.stage.goTo("planet", { hop: true, at: { slide: 3, build: 0 } });
    expect(space()).not.toHaveAttribute("data-earth-clock");
  });

  it("has no clock in a deck with no reveal", async () => {
    h.useDeck(fixture());
    h.mount();
    await h.ready();
    expect(face()).toBeNull();
    expect(space()).not.toHaveAttribute("data-earth-clock");
  });
});
