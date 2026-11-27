// @vitest-environment jsdom
import { Temporal } from "@js-temporal/polyfill";
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { aimBody, aimLens, behindEarth, bodyAt } from "./sky-aim";
import { sunRaDec } from "./sky-math";
import { mountSkyNames, type SkyNamesEngine } from "./sky-names";
import type { EventsKit } from "./sky-events";
import { at, kitOf } from "~/test/events-kit";
import {
  bodyRow,
  holdBody,
  providePoints,
  type SkyBodyId,
} from "./sky-registry";

/* The dates are the file's, so the test hands the labels a kit of its own, or none before it has loaded. */
let kit: EventsKit | null = null;
vi.mock("./sky-events-kit", () => ({ eventsKit: () => kit }));

/* Where the label sits, and that it hangs below a body near the window's top, are the browser
   gate's (`hero-space-check.mjs`, "sky names"): jsdom lays nothing out. */

const START = Temporal.Instant.from("2027-04-20T06:30:00Z").epochMilliseconds;
const FOCAL = 374 * Math.sqrt(6.6107 ** 2 - 1);
/* The surface sits at the window's corner, so its pixels are the window's. */
const FRAME = { width: 3200, height: 2000, shift: { x: 0, y: 0 }, rects: [] };

function fakeEngine() {
  const view = {
    rotation: [0, 0] as readonly [number, number],
    zoom: 1,
    get focalPx() {
      return FOCAL * this.zoom;
    },
    centre: { x: 1600, y: 1000 },
  };
  const frames: (() => void)[] = [];
  const engine: SkyNamesEngine = {
    getView: () => view,
    getCentre: () => ({ ...view.centre, radius: 374 * view.zoom }),
    onFrame: (callback) => frames.push(callback),
  };
  return { engine, view, frame: () => frames.forEach((run) => run()) };
}

let hero: HTMLElement;
let space: HTMLElement;
let abort: AbortController;
let fake: ReturnType<typeof fakeEngine>;
let names: ReturnType<typeof mountSkyNames>;
type User = ReturnType<typeof userEvent.setup>;
let user: User;

beforeEach(() => {
  hero = document.createElement("div");
  space = document.createElement("div");
  space.dataset["space"] = "";
  const copy = document.createElement("button");
  copy.textContent = "Get started";
  space.append(copy);
  hero.append(space);
  document.body.append(hero);
  abort = new AbortController();
  fake = fakeEngine();
  names = mountSkyNames({
    engine: fake.engine,
    hero,
    surface: space,
    frame: () => FRAME,
    now: () => START,
    signal: abort.signal,
  });
  user = userEvent.setup();
});

afterEach(() => {
  abort.abort();
  hero.remove();
  providePoints(null);
  holdBody(null);
  kit = null;
  vi.unstubAllGlobals();
});

/** The name the sky shows now, or null. */
function shown(): string | null {
  for (const name of [
    "Sun",
    "Moon",
    "Mars",
    "Venus",
    "Uranus",
    "Vesta",
    "Pluto",
  ]) {
    const label = screen.queryByText(name, { exact: false, ignore: "span" });
    if (label && !label.hidden) return label.textContent;
  }
  return null;
}
const lens = () => aimLens(fake.view, FRAME);
/** Where a body is drawn now, in the window's pixels. */
const spot = (id: SkyBodyId) => bodyAt(id, START, lens(), fake.view.zoom)!;
/** Turns the camera so the body sits beside the Earth's limb. */
function lookAt(id: SkyBodyId): void {
  const aim = aimBody(id, START, lens(), [])!;
  fake.view.rotation = aim.rotation;
  fake.view.zoom = aim.zoom;
}
/** A mouse comes to rest at `x, y` over `target` (bare sky unless given). */
const hover = (x: number, y: number, target: Element = space) =>
  user.pointer({ target, coords: { clientX: x, clientY: y } });

/** A planet layer that draws `drawn`, each at `place`. */
function planets(
  drawn: string[],
  place: (rotation?: readonly [number, number]) => { ra: number; dec: number },
) {
  providePoints({
    place: (_id, _at, rotation) => place(rotation),
    placed: () => drawn.map((id) => ({ id: id as "venus", V: -4 })),
    drawn: () => drawn.map((id) => ({ id: id as "venus", V: -4 })),
  });
}

/** A layer that places Uranus at magnitude 5.6, too faint to draw, near the Sun. */
function faintUranus(): void {
  const sun = sunRaDec(START);
  providePoints({
    place: () => ({ ra: sun.ra, dec: sun.dec + 3 }),
    placed: () => [{ id: "uranus", V: 5.6 }],
    drawn: () => [],
  });
}
const FIRST = "Too faint to draw: magnitude 5.6; the sky draws to 5.5.";

describe("the sky's names", () => {
  it("names the Moon under a mouse over bare sky, hidden from assistive tech", async () => {
    lookAt("moon");
    const moon = spot("moon");
    await hover(moon.x, moon.y);
    expect(shown()).toBe("Moon");
    expect(screen.getByText("Moon")).toBeVisible();
    expect(screen.getByText("Moon")).toHaveAttribute("aria-hidden", "true");
  });

  it("reaches 12 px past the disc for a mouse and 28 px for a touch, whose name stays until the next tap", async () => {
    lookAt("sun");
    const sun = spot("sun");
    const far = sun.x + sun.r + 20;
    await hover(far, sun.y);
    expect(shown()).toBeNull();
    await hover(sun.x + sun.r + 11, sun.y);
    expect(shown()).toBe("Sun");
    await hover(far, sun.y);
    expect(shown()).toBeNull();
    await user.pointer({
      keys: "[TouchA]",
      target: space,
      coords: { clientX: far, clientY: sun.y },
    });
    expect(shown()).toBe("Sun");
    await user.pointer({
      keys: "[TouchA]",
      target: space,
      coords: { clientX: far + 40, clientY: sun.y },
    });
    expect(shown()).toBeNull();
  });

  it("goes when a mouse leaves the window, or the page scrolls", async () => {
    lookAt("moon");
    const moon = spot("moon");
    await hover(moon.x, moon.y);
    expect(shown()).toBe("Moon");
    const leave = new PointerEvent("pointerleave", { pointerType: "mouse" }); // oxlint-disable-line dox-test/no-dispatch-event -- no user action leaves the window in jsdom; the event is the input
    // oxlint-disable-next-line dox-test/no-dispatch-event -- no user action leaves the window in jsdom; the event is the input
    document.documentElement.dispatchEvent(leave);
    expect(shown()).toBeNull();
    await hover(moon.x + 1, moon.y);
    expect(shown()).toBe("Moon");
    // oxlint-disable-next-line dox-test/no-dispatch-event -- jsdom cannot scroll; the event is the input
    window.dispatchEvent(new Event("scroll"));
    expect(shown()).toBeNull();
  });

  it("calls a planet a planet, and names only the planets the layer draws", async () => {
    lookAt("sun");
    const sun = sunRaDec(START);
    const near = () => ({ ra: sun.ra, dec: sun.dec + 3 });
    planets(["venus"], near);
    const venus = spot("venus");
    await hover(venus.x, venus.y);
    expect(shown()).toBe("VenusPlanet");
    expect(screen.getByText("Planet")).toBeVisible();
    planets([], near);
    await hover(venus.x + 1, venus.y);
    expect(shown()).toBeNull();
  });

  it("calls an asteroid an asteroid", async () => {
    lookAt("sun");
    const sun = sunRaDec(START);
    planets(["vesta"], () => ({ ra: sun.ra, dec: sun.dec + 3 }));
    const vesta = spot("vesta");
    await hover(vesta.x, vesta.y);
    expect(shown()).toBe("VestaAsteroid");
  });

  it("calls Pluto a dwarf planet and tells its years as the ninth planet", async () => {
    lookAt("sun");
    const sun = sunRaDec(START);
    planets(["pluto"], () => ({ ra: sun.ra, dec: sun.dec + 3 }));
    const pluto = spot("pluto");
    await hover(pluto.x, pluto.y);
    expect(shown()).toBe("PlutoDwarf planetThe ninth planet from 1930 to 2006");
  });

  it("names no planet behind the Moon, and no body behind the Earth", async () => {
    lookAt("moon");
    let covered = false;
    /* Mars a degree south of the Moon, and then (`covered`) behind it. */
    planets(["mars"], (rotation) => {
      const { ra, dec } = bodyRow("moon").place(START, rotation)!;
      return { ra, dec: covered ? dec : dec - 1 };
    });
    const mars = spot("mars");
    await hover(mars.x, mars.y);
    expect(shown()).toBe("MarsPlanet");
    covered = true;
    fake.frame();
    expect(shown()).toBeNull();
    const moon = spot("moon");
    await hover(moon.x, moon.y);
    expect(shown()).toBe("Moon");
    /* The camera looks past the Earth's centre at the Moon. */
    fake.view.rotation = behindEarth("moon", START)!;
    fake.view.zoom = 1;
    fake.frame();
    expect(shown()).toBeNull();
    const hidden = spot("moon");
    await hover(hidden.x, hidden.y, hero);
    expect(shown()).toBeNull();
  });

  it("names nothing over the page's own controls, under a drag, while the globe is worked, or in forced colours", async () => {
    lookAt("moon");
    const moon = spot("moon");
    await hover(moon.x, moon.y, screen.getByRole("button"));
    expect(shown()).toBeNull();
    await hover(moon.x, moon.y);
    expect(shown()).toBe("Moon");
    await user.pointer([
      {
        keys: "[MouseLeft>]",
        target: space,
        coords: { clientX: moon.x, clientY: moon.y },
      },
      { target: space, coords: { clientX: moon.x + 1, clientY: moon.y } },
      { keys: "[/MouseLeft]" },
    ]);
    expect(shown()).toBeNull();
    await hover(moon.x, moon.y);
    names.hide();
    expect(shown()).toBeNull();
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(forced-colors: active)",
    }));
    await hover(moon.x + 1, moon.y);
    expect(shown()).toBeNull();
  });
});

describe("the ring's name", () => {
  /** Hovers the ring of the held, faint Uranus. */
  async function overRing(): Promise<void> {
    lookAt("sun");
    faintUranus();
    holdBody("uranus");
    const uranus = spot("uranus");
    await hover(uranus.x, uranus.y);
  }

  it("names a faint body only while it is held, and says why before the dates have loaded", async () => {
    lookAt("sun");
    faintUranus();
    const uranus = spot("uranus");
    await hover(uranus.x, uranus.y);
    expect(shown()).toBeNull();
    holdBody("uranus");
    await hover(uranus.x + 1, uranus.y);
    expect(shown()).toBe(`UranusPlanet${FIRST}`);
  });

  it("says when it will be bright enough, from the data", async () => {
    kit = kitOf([
      {
        id: "uranus",
        rare: false,
        startMs: at("2033-12-11T06:00:00Z"),
        endMs: at("2034-03-01T00:00:00Z"),
        unit: "day",
      },
    ]);
    await overRing();
    expect(shown()).toBe(
      `UranusPlanet${FIRST} Bright enough from 11 Dec 2033.`,
    );
  });

  it("says when nothing is ahead", async () => {
    kit = kitOf([]);
    await overRing();
    expect(shown()).toBe(`UranusPlanet${FIRST} Not brighter before Nov 2036.`);
  });

  it("goes when the view is released", async () => {
    await overRing();
    expect(shown()).not.toBeNull();
    holdBody(null);
    fake.frame();
    expect(shown()).toBeNull();
  });
});
