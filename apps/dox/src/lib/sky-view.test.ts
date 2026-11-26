// @vitest-environment jsdom
import { Temporal } from "@js-temporal/polyfill";
import { screen, within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { setHtml } from "~/widgets/builders";
import { bodyAt, type AimLens } from "./sky-aim";
import { providePoints, type SkyBodyId } from "./sky-registry";
import {
  mountSkyView,
  renderSkyView,
  type SkyView,
  type SkyViewEngine,
} from "./sky-view";

const START = Temporal.Instant.from("2027-04-20T06:30:00Z").epochMilliseconds;
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
    /* The focal length at the current zoom, as the engine reports it. */
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
  screen.getByRole("button", { name, hidden: true });
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
    ];
    const buttons = within(bar).getAllByRole("button", { hidden: true });
    expect(
      buttons.map((button) => button.textContent?.trim().slice(-10)),
    ).toEqual(names.map((name) => expect.stringContaining(name)));
    for (const name of names) expect(selected(name)).toBe("false");
    expect(
      screen.queryByRole("group", { name: "Look at" }),
    ).not.toBeInTheDocument();
  });
});

/** A planet layer that draws `drawn` and places every planet ahead of the camera. */
function points(drawn: string[]) {
  providePoints({
    place: () => ({ ra: 0, dec: 0 }),
    drawn: () => drawn.map((id) => ({ id: id as "venus", V: -4 })),
  });
}

describe("the planets' buttons", () => {
  it("are unavailable while the planets load, with the reason as the tip", () => {
    mount();
    expect(bodyButton("Venus")).toHaveAttribute("aria-disabled", "true");
    expect(bodyButton("Venus")).toHaveAttribute(
      "title",
      "Venus: the planets are still loading",
    );
    expect(bodyButton("Sun")).not.toHaveAttribute("aria-disabled");
  });

  it("come on with the layer, and a planet too faint to draw stays off", () => {
    const fake = mount();
    points(["venus"]);
    clock += 1000;
    fake.frames.forEach((frame) => frame());
    expect(bodyButton("Venus")).not.toHaveAttribute("aria-disabled");
    expect(bodyButton("Venus")).not.toHaveAttribute("title");
    expect(bodyButton("Uranus")).toHaveAttribute(
      "title",
      "Uranus: too faint to see now",
    );
  });

  it("a drawn one is looked at and held", async () => {
    const fake = mount();
    points(["venus"]);
    fake.frames.forEach((frame) => frame());
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
    fake.frames.forEach((frame) => frame());
    expect(fake.flights).toHaveLength(2);
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
