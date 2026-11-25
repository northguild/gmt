// @vitest-environment jsdom
import { Temporal } from "@js-temporal/polyfill";
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { setHtml } from "~/widgets/builders";
import { bodyAt, type AimLens, type SkyBodyId } from "./sky-aim";
import {
  mountSkyView,
  renderSkyView,
  SKY_VIEWS,
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
let pressed: number;

function mount(fake = fakeEngine()) {
  mounted = mountSkyView({
    engine: fake.engine,
    host: hero,
    avoid: () => FRAME,
    now: () => clock,
    reducedMotion: () => reduced,
    onPress: () => pressed++,
    signal: abort.signal,
  });
  return fake;
}

const button = (name: string) => screen.getByRole("button", { name });
const state = (name: string) => button(name).getAttribute("aria-pressed");

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
  pressed = 0;
});

afterEach(() => {
  abort.abort();
  mounted?.destroy();
  hero.remove();
  expect(vi.getTimerCount()).toBe(0);
  vi.useRealTimers();
});

describe("renderSkyView", () => {
  it("offers one unpressed toggle per body, each with a visible label", () => {
    for (const { label } of SKY_VIEWS) expect(state(label)).toBe("false");
    expect(screen.getByRole("group", { name: "Sky view" })).toBeInTheDocument();
  });
});

describe("mountSkyView", () => {
  it("holds the spin, sets the zoom, then flies with the hop", async () => {
    const fake = mount();
    await userEvent
      .setup({ advanceTimers: vi.advanceTimersByTime })
      .click(button("View Moon"));
    expect(fake.calls).toEqual(["hold:true", "setZoom", "flyTo"]);
    expect(fake.flights).toEqual([{ hop: true }]);
    expect(state("View Moon")).toBe("true");
    expect(state("View Sun")).toBe("false");
    expect(pressed).toBe(1);
    expect(hero.dataset["skyView"]).toBe("moon");
  });

  it("jumps under reduced motion", async () => {
    reduced = true;
    const fake = mount();
    await userEvent
      .setup({ advanceTimers: vi.advanceTimersByTime })
      .click(button("View Sun"));
    expect(fake.flights).toEqual([{ hop: false }]);
  });

  it("switches bodies with the other button", async () => {
    const fake = mount();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(button("View Moon"));
    await user.click(button("View Sun"));
    expect(state("View Moon")).toBe("false");
    expect(state("View Sun")).toBe("true");
    expect(fake.flights).toHaveLength(2);
  });

  it("releases on a second press without a camera call", async () => {
    const fake = mount();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(button("View Moon"));
    fake.calls.length = 0;
    await user.click(button("View Moon"));
    expect(fake.calls).toEqual(["hold:false"]);
    expect(state("View Moon")).toBe("false");
    expect(hero.dataset["skyView"]).toBeUndefined();
  });

  it("releases when told to, and again harmlessly", async () => {
    const fake = mount();
    await userEvent
      .setup({ advanceTimers: vi.advanceTimersByTime })
      .click(button("View Moon"));
    mounted?.release();
    mounted?.release();
    expect(fake.calls.filter((c) => c === "hold:false")).toHaveLength(1);
    expect(state("View Moon")).toBe("false");
  });

  it("follows a body that drifted 9 px once, without a hop, and ignores 7 px", async () => {
    const fake = mount();
    await userEvent
      .setup({ advanceTimers: vi.advanceTimersByTime })
      .click(button("View Moon"));
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
    await userEvent
      .setup({ advanceTimers: vi.advanceTimersByTime })
      .click(button("View Moon"));
    const nine = secondsFor(fake, "moon", 9);
    clock = START + nine;
    fake.frames.forEach((frame) => frame());
    fake.frames.forEach((frame) => frame());
    expect(fake.flights).toHaveLength(2);
  });

  it("does not check during a flight", async () => {
    const fake = mount();
    await userEvent
      .setup({ advanceTimers: vi.advanceTimersByTime })
      .click(button("View Moon"));
    const nine = secondsFor(fake, "moon", 9);
    fake.view.moving = true;
    clock = START + nine;
    fake.frames.forEach((frame) => frame());
    expect(fake.flights).toHaveLength(1);
  });

  it("stops checking after a release", async () => {
    const fake = mount();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(button("View Moon"));
    const nine = secondsFor(fake, "moon", 9);
    await user.click(button("View Moon"));
    clock = START + nine;
    fake.frames.forEach((frame) => frame());
    expect(fake.flights).toHaveLength(1);
  });

  it("stops on abort and releases the hold", async () => {
    const fake = mount();
    await userEvent
      .setup({ advanceTimers: vi.advanceTimersByTime })
      .click(button("View Moon"));
    abort.abort();
    expect(fake.calls.at(-1)).toBe("hold:false");
  });
});
