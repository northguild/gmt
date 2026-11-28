// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { setHtml } from "~/widgets/builders";
import { bodyAt, type AimLens } from "./sky-aim";
import {
  providePoints,
  heldBody,
  holdBody,
  type SkyBodyId,
} from "./sky-registry";
import type { EventsKit } from "./sky-events";
import { at, kitOf } from "~/test/events-kit";
import {
  mountSkyView,
  renderSkyView,
  type SkyView,
  type SkyViewEngine,
} from "./sky-view";

/* The dates are the file's, so the test hands the bar a kit of its own, or none before the file has loaded. */
let kit: EventsKit | null = null;
vi.mock("./sky-events-kit", () => ({
  eventsKit: () => kit,
  askEvents: () => Promise.resolve(kit),
}));

const START = at("2027-04-20T06:30:00Z");
const FOCAL = 374 * Math.sqrt(6.6107 ** 2 - 1);
/* Roomy, so a few pixels of drift never push the body's box past the hero's inset. */
const FRAME = {
  width: 3200,
  height: 2000,
  shift: { x: 0, y: 0 },
  rects: [],
};

/** A camera that records what it is asked and goes where `flyTo` sends it. */
function fakeEngine() {
  const view = {
    rotation: [0, 0] as readonly [number, number],
    zoom: 1,
    moving: false,
    get focalPx() {
      return FOCAL * this.zoom;
    },
    centre: { x: 1600, y: 1000 },
  };
  const calls: string[] = [];
  const flights: { hop: boolean }[] = [];
  const frames: (() => void)[] = [];
  const engine: SkyViewEngine = {
    getView: () => view,
    setZoom: (zoom) => {
      calls.push("setZoom");
      view.zoom = zoom;
    },
    flyTo: (rotation, options) => {
      calls.push("flyTo");
      flights.push({ hop: options?.hop !== undefined });
      view.rotation = rotation;
    },
    holdAmbient: (hold) => calls.push(`hold:${hold}`),
    onFrame: (callback) => frames.push(callback),
  };
  return { engine, view, calls, flights, frames };
}

let hero: HTMLElement;
let abort: AbortController;
let mounted: SkyView | null;
let clock: number;
let reduced: boolean;

function mount(fake = fakeEngine()) {
  mounted = mountSkyView({
    engine: fake.engine,
    host: hero,
    avoid: () => FRAME,
    now: () => clock,
    reducedMotion: () => reduced,
    signal: abort.signal,
  });
  return fake;
}

const lookButton = () => screen.getByRole("button", { name: "Look at" });
/** A body's button in the bar; the bar may be shut, so hidden buttons count. */
const bodyButton = (name: string) =>
  screen.getByRole("button", {
    name: new RegExp(`\\b${name}\\b`),
    hidden: true,
  });
/** The button's `aria-pressed`: whether its body is the held one. */
const selected = (name: string) =>
  bodyButton(name).getAttribute("aria-pressed");
type User = ReturnType<typeof userEvent.setup>;
const user = (): User =>
  userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
/** Opens the bar and presses a body's button, as a reader does. */
async function choose(who: User, name: string): Promise<void> {
  await who.click(lookButton());
  await who.click(bodyButton(name));
}

/** Seconds of `now` after which `body`, held where it was aimed, has drifted `px` on screen. */
function secondsFor(
  fake: ReturnType<typeof fakeEngine>,
  body: SkyBodyId,
  px: number,
): number {
  const lens = (): AimLens => ({
    width: FRAME.width,
    height: FRAME.height,
    centre: fake.view.centre,
    focalAtRest: FOCAL,
    rotation: fake.view.rotation,
  });
  const at = (ms: number) => bodyAt(body, ms, lens(), fake.view.zoom)!;
  const home = at(START);
  let [low, high] = [0, 6 * 3600_000];
  for (let i = 0; i < 50; i++) {
    const mid = (low + high) / 2;
    const moved = Math.hypot(
      at(START + mid).x - home.x,
      at(START + mid).y - home.y,
    );
    if (moved < px) low = mid;
    else high = mid;
  }
  return low;
}

beforeEach(() => {
  vi.useFakeTimers();
  hero = document.createElement("div");
  setHtml(hero, renderSkyView("t"));
  document.body.append(hero);
  abort = new AbortController();
  mounted = null;
  clock = START;
  reduced = false;
});

afterEach(() => {
  abort.abort();
  mounted?.destroy();
  hero.remove();
  providePoints(null);
  holdBody(null);
  kit = null;
  expect(vi.getTimerCount()).toBe(0);
  vi.useRealTimers();
});

describe("renderSkyView", () => {
  it("is the stack's button and a shut bar of every body, the registry's order, none pressed", () => {
    expect(lookButton()).toHaveAttribute("aria-expanded", "false");
    const bar = screen.getByRole("group", { name: "Look at", hidden: true });
    const names = [
      "Sun",
      "Moon",
      "Mercury",
      "Venus",
      "Mars",
      "Jupiter",
      "Saturn",
      "Uranus",
      "Neptune",
      "Pluto Dwarf planet",
      "Vesta Asteroid",
      "Apophis Asteroid",
    ];
    const buttons = within(bar).getAllByRole("button", { hidden: true });
    expect(buttons.map((button) => button.textContent)).toEqual(
      names.map((name) => expect.stringContaining(name)),
    );
    for (const name of names) expect(selected(name)).toBe("false");
    expect(
      screen.queryByRole("group", { name: "Look at" }),
    ).not.toBeInTheDocument();
  });
});

/** A planet layer that places `placed` (id to magnitude) and draws those of them at 5.5 or brighter. */
function points(placed: Record<string, number>) {
  const list = () =>
    Object.entries(placed).map(([id, V]) => ({ id: id as "venus", V }));
  providePoints({
    place: (id) => (id in placed ? { ra: 0, dec: 0 } : null),
    placed: list,
    drawn: () => list().filter(({ V }) => V <= 5.5),
  });
}

const sync = (fake: ReturnType<typeof fakeEngine>) => {
  clock += 1000;
  fake.frames.forEach((frame) => frame());
};

describe("the planets' buttons", () => {
  it("are unavailable while the planets load, and say Loading", () => {
    mount();
    expect(bodyButton("Venus")).toHaveAttribute("aria-disabled", "true");
    expect(bodyButton("Venus")).toHaveAccessibleName(/Venus\s*Loading/);
    expect(bodyButton("Sun")).not.toHaveAttribute("aria-disabled");
  });

  it("a drawn one is on and has no second line", () => {
    const fake = mount();
    points({ venus: -4 });
    sync(fake);
    expect(bodyButton("Venus")).not.toHaveAttribute("aria-disabled");
    expect(bodyButton("Venus")).toHaveAccessibleName("Venus");
  });

  it("a drawn asteroid says what it is on its second line", () => {
    const fake = mount();
    points({ vesta: 5 });
    sync(fake);
    expect(bodyButton("Vesta")).not.toHaveAttribute("aria-disabled");
    expect(bodyButton("Vesta")).toHaveAccessibleName(/Vesta\s*Asteroid$/);
  });

  it("a placed body too faint to draw is on, with its magnitude in the name", () => {
    const fake = mount();
    points({ uranus: 5.6, vesta: 7.24 });
    sync(fake);
    expect(bodyButton("Uranus")).not.toHaveAttribute("aria-disabled");
    expect(bodyButton("Uranus")).toHaveAccessibleName(
      /Uranus\s*Too faint · 5\.6/,
    );
    expect(bodyButton("Vesta")).toHaveAccessibleName(
      /Vesta\s*Asteroid\s*Too faint · 7\.2/,
    );
  });

  it("a body with no place is off and says why before the dates have loaded", () => {
    const fake = mount();
    points({ venus: -4 });
    sync(fake);
    expect(bodyButton("Apophis")).toHaveAttribute("aria-disabled", "true");
    expect(bodyButton("Apophis")).toHaveAccessibleName(
      /Apophis\s*Asteroid\s*Too faint$/,
    );
  });

  it("a body with no place dates its next spell, pass or none ahead", () => {
    kit = kitOf([
      {
        id: "vesta",
        rare: true,
        startMs: at("2029-07-08T12:00:00Z"),
        endMs: at("2029-08-02T12:00:00Z"),
        unit: "day",
      },
      {
        id: "apophis",
        rare: true,
        startMs: at("2029-04-13T14:00:00Z"),
        endMs: at("2029-04-13T22:00:00Z"),
        unit: "minute",
      },
    ]);
    const fake = mount();
    points({ venus: -4 });
    sync(fake);
    expect(bodyButton("Vesta")).toHaveAccessibleName(
      /Vesta\s*Asteroid\s*Too faint until 8 Jul 2029/,
    );
    expect(bodyButton("Apophis")).toHaveAccessibleName(
      /Apophis\s*Asteroid\s*Close pass 13 Apr 2029/,
    );
    expect(bodyButton("Uranus")).toHaveAccessibleName(
      /Uranus\s*Too faint through Nov 2036/,
    );
  });

  it("choosing a faint placed body aims at it and holds it", async () => {
    const fake = mount();
    points({ uranus: 5.6 });
    sync(fake);
    await choose(user(), "Uranus");
    expect(fake.calls).toEqual(["hold:true", "setZoom", "flyTo"]);
    expect(selected("Uranus")).toBe("true");
    expect(hero.dataset["skyView"]).toBe("uranus");
    expect(heldBody()).toBe("uranus");
  });

  it("a drawn one is looked at and held", async () => {
    const fake = mount();
    points({ venus: -4 });
    sync(fake);
    await choose(user(), "Venus");
    expect(fake.calls).toEqual(["hold:true", "setZoom", "flyTo"]);
    expect(selected("Venus")).toBe("true");
    expect(hero.dataset["skyView"]).toBe("venus");
  });

  it("an unavailable one does nothing when pressed, and the bar stays open", async () => {
    const fake = mount();
    await choose(user(), "Uranus");
    expect(fake.calls).toEqual([]);
    expect(lookButton()).toHaveAttribute("aria-expanded", "true");
    expect(selected("Uranus")).toBe("false");
  });
});

describe("mountSkyView", () => {
  it("holds the spin, sets the zoom, then flies with the hop", async () => {
    const fake = mount();
    const who = user();
    await choose(who, "Moon");
    expect(fake.calls).toEqual(["hold:true", "setZoom", "flyTo"]);
    expect(fake.flights).toEqual([{ hop: true }]);
    expect(selected("Moon")).toBe("true");
    expect(selected("Sun")).toBe("false");
    expect(hero.dataset["skyView"]).toBe("moon");
    expect(lookButton()).toHaveAttribute("aria-expanded", "false");
    expect(lookButton()).toHaveFocus();
  });

  it("jumps under reduced motion", async () => {
    reduced = true;
    const fake = mount();
    await choose(user(), "Sun");
    expect(fake.flights).toEqual([{ hop: false }]);
  });

  it("switches bodies with the other button", async () => {
    const fake = mount();
    const who = user();
    await choose(who, "Moon");
    await choose(who, "Sun");
    expect(selected("Moon")).toBe("false");
    expect(selected("Sun")).toBe("true");
    expect(fake.flights).toHaveLength(2);
  });

  it("opens onto its first row, and moves between the rows with the arrow keys, Home and End, wrapping", async () => {
    mount();
    const who = user();
    await who.click(lookButton());
    expect(bodyButton("Sun")).toHaveFocus();
    await who.keyboard("{ArrowDown}");
    expect(bodyButton("Moon")).toHaveFocus();
    await who.keyboard("{ArrowUp}{ArrowUp}");
    expect(bodyButton("Apophis")).toHaveFocus();
    await who.keyboard("{Home}");
    expect(bodyButton("Sun")).toHaveFocus();
    expect(bodyButton("Sun")).toHaveAttribute("tabindex", "0");
    expect(bodyButton("Moon")).toHaveAttribute("tabindex", "-1");
  });

  it("makes the held body the bar's one tab stop, and opens onto it", async () => {
    mount();
    const who = user();
    await choose(who, "Moon");
    expect(bodyButton("Moon")).toHaveAttribute("tabindex", "0");
    expect(bodyButton("Sun")).toHaveAttribute("tabindex", "-1");
    await who.click(lookButton());
    expect(bodyButton("Moon")).toHaveFocus();
  });

  it("releases when the held body is chosen again, without a camera call", async () => {
    const fake = mount();
    const who = user();
    await choose(who, "Moon");
    fake.calls.length = 0;
    await choose(who, "Moon");
    expect(fake.calls).toEqual(["hold:false"]);
    expect(selected("Moon")).toBe("false");
    expect(hero.dataset["skyView"]).toBeUndefined();
  });

  it("releases when told to, and again harmlessly", async () => {
    const fake = mount();
    await choose(user(), "Moon");
    mounted?.release();
    mounted?.release();
    expect(fake.calls.filter((c) => c === "hold:false")).toHaveLength(1);
    expect(selected("Moon")).toBe("false");
  });

  it("follows a body that drifted 9 px once, without a hop, and ignores 7 px", async () => {
    const fake = mount();
    await choose(user(), "Moon");
    const seven = secondsFor(fake, "moon", 7);
    const nine = secondsFor(fake, "moon", 9);
    expect(nine).toBeGreaterThan(seven);
    clock = START + seven;
    fake.frames.forEach((frame) => frame());
    expect(fake.flights).toHaveLength(1);
    clock = START + nine;
    fake.frames.forEach((frame) => frame());
    expect(fake.flights).toEqual([{ hop: true }, { hop: false }]);
  });

  it("checks at most once per second of the sky's clock", async () => {
    const fake = mount();
    await choose(user(), "Moon");
    const nine = secondsFor(fake, "moon", 9);
    clock = START + nine;
    fake.frames.forEach((frame) => frame());
    expect(fake.flights).toHaveLength(2);
    /* The Moon cannot drift 8 px in under a second of sky time, so the camera is turned 2° off
       the new aim instead: the Moon is then far from its anchor at every check below. */
    const [lon, lat] = fake.view.rotation;
    fake.view.rotation = [lon + 2, lat];
    clock = START + nine + 999;
    fake.frames.forEach((frame) => frame());
    expect(fake.flights).toHaveLength(2);
    clock = START + nine + 1000;
    fake.frames.forEach((frame) => frame());
    expect(fake.flights).toHaveLength(3);
  });

  it("does not check during a flight", async () => {
    const fake = mount();
    await choose(user(), "Moon");
    const nine = secondsFor(fake, "moon", 9);
    fake.view.moving = true;
    clock = START + nine;
    fake.frames.forEach((frame) => frame());
    expect(fake.flights).toHaveLength(1);
  });

  it("stops checking after a release", async () => {
    const fake = mount();
    const who = user();
    await choose(who, "Moon");
    const nine = secondsFor(fake, "moon", 9);
    await choose(who, "Moon");
    clock = START + nine;
    fake.frames.forEach((frame) => frame());
    expect(fake.flights).toHaveLength(1);
  });

  it("stops on abort and releases the hold", async () => {
    const fake = mount();
    await choose(user(), "Moon");
    abort.abort();
    expect(fake.calls.at(-1)).toBe("hold:false");
  });
});
