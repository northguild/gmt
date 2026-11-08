// @vitest-environment jsdom

/**
 * The engine's renderer hand-over after a device loss. The backends are faked:
 * what is under test is which canvas the reader can see afterwards.
 */
import { fireEvent, screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { installJsdomShims } from "~/test/jsdom-shims";
import { createGlobeEngine } from "./engine";
import type { FrameState, GlobeRenderer } from "./renderer";
import type { GlobeOptions, RendererKind } from "./types";

installJsdomShims();

type Fake = GlobeRenderer & {
  fail: (reason: string) => void;
  frames: FrameState[];
  sizes: Array<[number, number, number]>;
};

const made: Fake[] = [];
/** A `ready` promise the next fake renderer reports, for the dawn tests. */
let pendingReady: Promise<void> | undefined;
/** While set, every renderer being made waits for it, to stand for a slow load. */
let loadHeld: Promise<void> | undefined;

function fakeRenderer(kind: RendererKind, host: HTMLElement): Fake {
  const canvas = document.createElement("canvas");
  host.append(canvas);
  let onFailure: (reason: string) => void = () => {};
  const frames: FrameState[] = [];
  const sizes: Array<[number, number, number]> = [];
  const renderer = {
    kind,
    canvas,
    ready: pendingReady,
    frames,
    sizes,
    resize(w: number, h: number, dpr: number) {
      sizes.push([w, h, dpr]);
    },
    setTheme() {},
    setRegions() {},
    setMarkers() {},
    setArcs() {},
    render(frame: FrameState) {
      frames.push({ ...frame, camera: { ...frame.camera } });
    },
    onFailure(cb: (reason: string) => void) {
      onFailure = cb;
    },
    destroy() {
      canvas.remove();
    },
    fail(reason: string) {
      onFailure(reason);
    },
  };
  made.push(renderer);
  return renderer;
}

vi.mock("./webgpu/renderer-webgpu", () => ({
  createWebgpuRenderer: async (init: { host: HTMLElement }) => {
    await loadHeld;
    return fakeRenderer("webgpu", init.host);
  },
}));
vi.mock("./canvas2d/renderer-canvas2d", () => ({
  createCanvas2dRenderer: async (init: { host: HTMLElement }) => {
    await loadHeld;
    return fakeRenderer("canvas2d", init.host);
  },
}));

const options = (renderer: GlobeOptions["renderer"]): GlobeOptions => ({
  renderer,
  sunInstant: () => 0,
  theme: {} as GlobeOptions["theme"],
  labelFont: "12px sans-serif",
  ariaLabel: "Globe",
  initialRotation: [0, 0],
});

const engines: Array<{ destroy(): void }> = [];

afterEach(() => {
  for (const engine of engines.splice(0)) engine.destroy();
  made.length = 0;
  pendingReady = undefined;
  loadHeld = undefined;
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("adopting a renderer after a device loss", () => {
  it("adopts a replacement canvas after a device loss, and falls back to canvas-2D after a second", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const host = document.createElement("div");
    document.body.append(host);
    const engine = await createGlobeEngine(host, options("webgpu"));

    const first = made[0]!;
    first.fail("device lost");
    await vi.waitFor(() => expect(made).toHaveLength(2));

    const second = made[1]!;
    expect(second.canvas.isConnected).toBe(true);

    // The one retry is spent: a second loss falls back to canvas-2D, whose
    // canvas must also be visible.
    second.fail("device lost again");
    await vi.waitFor(() => expect(made).toHaveLength(3));
    expect(made[2]!.kind).toBe("canvas2d");

    engine.destroy();
  });

  /** Hold the next renderer's load until the returned function is called. */
  function holdLoad(): () => void {
    let release = () => {};
    loadHeld = new Promise<void>((resolve) => (release = resolve));
    return () => {
      loadHeld = undefined;
      release();
    };
  }

  it.each([
    ["the WebGPU retry", 1],
    ["the canvas-2D fallback", 2],
  ])(
    "destroys %s when it arrives after the globe is gone, and shows no canvas",
    async (_label, losses) => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const host = document.createElement("div");
      document.body.append(host);
      const engine = await createGlobeEngine(host, options("webgpu"));
      // Every loss before the last is recovered from at once.
      for (let i = 1; i < losses; i++) {
        made.at(-1)!.fail("device lost");
        await vi.waitFor(() => expect(made).toHaveLength(i + 1));
      }

      const release = holdLoad();
      made.at(-1)!.fail("device lost");
      engine.destroy();
      release();

      await vi.waitFor(() => expect(made).toHaveLength(losses + 1));
      const late = made.at(-1)!;
      await vi.waitFor(() => expect(late.canvas.isConnected).toBe(false));
      // No renderer, early or late, has left a canvas behind.
      expect(made.filter((r) => r.canvas.isConnected)).toEqual([]);
    },
  );
});

function hostWithBox(width = 400, height = 300): HTMLElement {
  const host = document.createElement("div");
  Object.defineProperty(host, "clientWidth", { value: width });
  Object.defineProperty(host, "clientHeight", { value: height });
  document.body.append(host);
  return host;
}

async function start(host: HTMLElement, extra: Partial<GlobeOptions> = {}) {
  const engine = await createGlobeEngine(host, {
    ...options("canvas2d"),
    ...extra,
  });
  engines.push(engine);
  return engine;
}

describe("framing", () => {
  it("places the sphere where the callback says", async () => {
    const host = hostWithBox(400, 300);
    await start(host, {
      framing: (w, h) => ({ cx: w * 0.75, cy: h * 0.4, radius: 80 }),
    });
    const frame = made[0]!.frames.at(-1)!;
    expect(frame.camera.centreX).toBe(300);
    expect(frame.camera.centreY).toBe(120);
    expect(frame.camera.radius).toBe(80);
  });

  it("centres the sphere on the shorter side when unset", async () => {
    const host = hostWithBox(400, 300);
    await start(host);
    const frame = made[0]!.frames.at(-1)!;
    expect(frame.camera.centreX).toBe(200);
    expect(frame.camera.centreY).toBe(150);
    expect(frame.camera.radius).toBeCloseTo(150 * 0.94, 6);
  });
});

describe("getCentre", () => {
  it("reports the silhouette radius at zoom 1 and after zooming", async () => {
    const host = hostWithBox(400, 300);
    const engine = await start(host);
    const base = made[0]!.frames.at(-1)!.camera.radius;
    expect(engine.getCentre()).toEqual({ x: 200, y: 150, radius: base });
    engine.setZoom(2);
    /* The ease is asymptotic: the controller stops once the zoom is within 0.001 of its goal and
       does not snap, so the radius settles within 0.001 * base (a seventh of a pixel here) of
       base * 2. Wait for the frame loop to go quiet, then pin that tolerance and the exact hand-over. */
    const lastRadius = () => made[0]!.frames.at(-1)!.camera.radius;
    await vi.waitFor(() =>
      expect(Math.abs(lastRadius() - base * 2)).toBeLessThanOrEqual(
        0.001 * base,
      ),
    );
    expect(engine.getCentre().radius).toBe(lastRadius());
    expect(Math.abs(engine.getCentre().radius - base * 2)).toBeLessThanOrEqual(
      0.001 * base,
    );
  });
});

describe("maxDpr", () => {
  it("caps the raster density at the host's ceiling", async () => {
    vi.stubGlobal("devicePixelRatio", 3);
    const host = hostWithBox();
    await start(host, { maxDpr: 1.5 });
    expect(made[0]!.sizes.at(-1)![2]).toBe(1.5);
  });

  it("defaults to a ceiling of 2", async () => {
    vi.stubGlobal("devicePixelRatio", 3);
    const host = hostWithBox();
    await start(host);
    expect(made[0]!.sizes.at(-1)![2]).toBe(2);
  });
});

describe("hit area", () => {
  function hitAreaIn(host: HTMLElement): HTMLElement {
    const hit = document.createElement("div");
    hit.tabIndex = 0;
    hit.setAttribute("aria-label", "Globe");
    host.append(hit);
    return hit;
  }

  it("covers the disc and nothing else", async () => {
    const host = hostWithBox(400, 300);
    const hit = hitAreaIn(host);
    await start(host, {
      hitArea: hit,
      framing: () => ({ cx: 250, cy: 100, radius: 60 }),
    });
    // The hit area is a bare element placed by inline style; the placement is the behaviour.
    // oxlint-disable-next-line dox-test/no-implementation-assert
    expect(hit).toHaveStyle({
      transform: "translate(190px, 40px)",
      width: "120px",
      height: "120px",
    });
  });

  it("is the one named tab stop, and the canvas under it is hidden from assistive technology", async () => {
    const host = hostWithBox();
    const hit = document.createElement("div");
    host.append(hit);
    await start(host, { hitArea: hit });
    expect(screen.getByRole("img", { name: "Globe" })).toBe(hit);
    expect(hit.tabIndex).toBe(0);
    expect(made[0]!.canvas.tabIndex).toBe(-1);
    expect(made[0]!.canvas).toHaveAttribute("aria-hidden", "true");
  });

  it("takes input in place of the canvas, and keeps it across a renderer swap", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const host = hostWithBox();
    const hit = hitAreaIn(host);
    const engine = await start(host, { renderer: "webgpu", hitArea: hit });
    const interactions: string[] = [];
    engine.onInteract((kind) => interactions.push(kind));

    made[0]!.fail("device lost");
    await vi.waitFor(() => expect(made).toHaveLength(2));

    const user = userEvent.setup();
    await user.click(hit);
    expect(interactions).toEqual(["tap"]);
    await user.click(made[1]!.canvas);
    expect(interactions).toEqual(["tap"]);
  });

  it("leaves a wheel unhandled at a zoom limit so the page scrolls", async () => {
    const host = hostWithBox();
    const hit = hitAreaIn(host);
    await start(host, { hitArea: hit });
    // At the minimum zoom, zooming out is a no-op.
    // oxlint-disable-next-line dox-test/no-dispatch-event -- userEvent has no wheel; the return value says whether the engine took it
    expect(fireEvent.wheel(hit, { deltaY: 100 })).toBe(true);
    // Zooming in changes the zoom, so the engine takes the event.
    // oxlint-disable-next-line dox-test/no-dispatch-event -- userEvent has no wheel; the return value says whether the engine took it
    expect(fireEvent.wheel(hit, { deltaY: -100 })).toBe(false);
  });

  it("removes its listeners on destroy", async () => {
    const host = hostWithBox();
    const hit = hitAreaIn(host);
    const engine = await start(host, { hitArea: hit });
    const interactions: string[] = [];
    engine.onInteract((kind) => interactions.push(kind));
    engine.destroy();
    // oxlint-disable-next-line dox-test/no-dispatch-event -- userEvent has no wheel; the return value says whether the engine took it
    expect(fireEvent.wheel(hit, { deltaY: -100 })).toBe(true);
    expect(interactions).toEqual([]);
  });
});

describe("onInteract", () => {
  async function setup() {
    const host = hostWithBox();
    const hit = document.createElement("div");
    hit.tabIndex = 0;
    host.append(hit);
    const engine = await start(host, { hitArea: hit });
    const kinds: string[] = [];
    engine.onInteract((kind) => kinds.push(kind));
    return { hit, kinds };
  }

  it("fires once for a drag that has moved past a tap", async () => {
    const { hit, kinds } = await setup();
    const user = userEvent.setup();
    await user.pointer([
      {
        keys: "[MouseLeft>]",
        target: hit,
        coords: { clientX: 10, clientY: 10 },
      },
      { coords: { clientX: 12, clientY: 10 } },
    ]);
    expect(kinds).toEqual([]);
    await user.pointer([
      { coords: { clientX: 40, clientY: 10 } },
      { coords: { clientX: 80, clientY: 10 } },
      { keys: "[/MouseLeft]" },
    ]);
    expect(kinds).toEqual(["drag"]);
  });

  it("fires for a tap, a zooming wheel and a handled key, not for hover or an unhandled key", async () => {
    const { hit, kinds } = await setup();
    const user = userEvent.setup();
    await user.hover(hit);
    expect(kinds).toEqual([]);
    await user.click(hit);
    expect(kinds).toEqual(["tap"]);
    // oxlint-disable-next-line dox-test/no-dispatch-event -- userEvent has no wheel; the return value says whether the engine took it
    fireEvent.wheel(hit, { deltaY: -100 });
    expect(kinds).toEqual(["tap", "wheel"]);
    hit.focus();
    await user.keyboard("a");
    expect(kinds).toEqual(["tap", "wheel"]);
    await user.keyboard("{ArrowLeft}");
    expect(kinds).toEqual(["tap", "wheel", "key"]);
  });

  it("does not fire for a wheel at a zoom limit", async () => {
    const { hit, kinds } = await setup();
    // oxlint-disable-next-line dox-test/no-dispatch-event -- userEvent has no wheel; the return value says whether the engine took it
    fireEvent.wheel(hit, { deltaY: 100 });
    expect(kinds).toEqual([]);
  });
});

describe("pauseWhenHidden", () => {
  it("watches the element and disconnects on destroy", async () => {
    const observers: Array<{
      cb: IntersectionObserverCallback;
      target: Element | null;
      disconnect: ReturnType<typeof vi.fn>;
    }> = [];
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        entry = {
          cb: undefined as unknown as IntersectionObserverCallback,
          target: null as Element | null,
          disconnect: vi.fn(),
        };
        constructor(cb: IntersectionObserverCallback) {
          this.entry.cb = cb;
          observers.push(this.entry);
        }
        observe(target: Element) {
          this.entry.target = target;
        }
        disconnect() {
          this.entry.disconnect();
        }
      },
    );
    const host = hostWithBox();
    const engine = await start(host, { pauseWhenHidden: host });
    expect(observers[0]!.target).toBe(host);
    engine.destroy();
    expect(observers[0]!.disconnect).toHaveBeenCalled();
  });

  it("draws nothing while out of view and resumes when it returns", async () => {
    vi.useFakeTimers();
    let notify: IntersectionObserverCallback = () => {};
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(cb: IntersectionObserverCallback) {
          notify = cb;
        }
        observe() {}
        disconnect() {}
      },
    );
    try {
      const host = hostWithBox();
      const engine = await start(host, { pauseWhenHidden: host });
      const fake = made[0]!;
      notify(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
      const before = fake.frames.length;
      engine.setZoom(3);
      await vi.advanceTimersByTimeAsync(500);
      expect(fake.frames.length).toBe(before);
      notify(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
      await vi.advanceTimersByTimeAsync(100);
      expect(fake.frames.length).toBeGreaterThan(before);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("pauseWhile", () => {
  it("hands the host a setter and calls the returned stop on destroy", async () => {
    const stop = vi.fn();
    const pauseWhile = vi.fn(() => stop);
    const engine = await start(hostWithBox(), { pauseWhile });
    expect(pauseWhile).toHaveBeenCalledTimes(1);
    expect(stop).not.toHaveBeenCalled();
    engine.destroy();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("draws nothing while held and carries on when released", async () => {
    vi.useFakeTimers();
    try {
      let hold: (held: boolean) => void = () => {};
      const engine = await start(hostWithBox(), {
        pauseWhile: (set) => {
          hold = set;
          return () => {};
        },
      });
      const fake = made[0]!;
      hold(true);
      const before = fake.frames.length;
      engine.setZoom(3);
      await vi.advanceTimersByTimeAsync(500);
      expect(fake.frames.length).toBe(before);
      hold(false);
      await vi.advanceTimersByTimeAsync(100);
      expect(fake.frames.length).toBeGreaterThan(before);
    } finally {
      vi.useRealTimers();
    }
  });

  it("stays held until every reason has cleared", async () => {
    vi.useFakeTimers();
    let notify: IntersectionObserverCallback = () => {};
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(cb: IntersectionObserverCallback) {
          notify = cb;
        }
        observe() {}
        disconnect() {}
      },
    );
    try {
      let hold: (held: boolean) => void = () => {};
      const host = hostWithBox();
      const engine = await start(host, {
        pauseWhenHidden: host,
        pauseWhile: (set) => {
          hold = set;
          return () => {};
        },
      });
      const fake = made[0]!;
      notify(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
      hold(true);
      hold(false);
      const before = fake.frames.length;
      engine.setZoom(3);
      await vi.advanceTimersByTimeAsync(500);
      expect(fake.frames.length).toBe(before);
      notify(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
      await vi.advanceTimersByTimeAsync(100);
      expect(fake.frames.length).toBeGreaterThan(before);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("the dawn entrance", () => {
  /** Frame times and exposures, read from `onFrame` against the faked clock. */
  function watch(engine: Awaited<ReturnType<typeof start>>, fake: Fake) {
    const seen: Array<{ at: number; exposure: number }> = [];
    engine.onFrame(() => {
      seen.push({
        at: performance.now(),
        exposure: fake.frames.at(-1)!.exposure,
      });
    });
    return seen;
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("draws nothing until the dawn starts", async () => {
    const host = hostWithBox();
    await start(host, { renderer: "webgpu", entrance: "dawn" });
    await vi.advanceTimersByTimeAsync(1500);
    expect(made[0]!.frames).toHaveLength(0);
  });

  it("draws at once, at full exposure, when the entrance is the fade", async () => {
    const host = hostWithBox();
    await start(host, { renderer: "webgpu" });
    expect(made[0]!.frames.at(-1)!.exposure).toBe(1);
    expect(host.dataset["dawn"]).toBeUndefined();
  });

  it("ramps exposure from 0 at t0 + .35 s to 1 at t0 + 2.4 s on the stated curve", async () => {
    const host = hostWithBox();
    const engine = await start(host, { renderer: "webgpu", entrance: "dawn" });
    const fake = made[0]!;
    const seen = watch(engine, fake);
    const t0 = performance.now();
    const done = engine.startDawn();
    await vi.advanceTimersByTimeAsync(2600);
    await done;

    const rel = seen.map((s) => ({ ...s, at: s.at - t0 }));
    expect(rel[0]!.at).toBeLessThanOrEqual(20);
    for (const s of rel.filter((s) => s.at <= 350)) expect(s.exposure).toBe(0);
    const bright = rel.find((s) => s.exposure > 0.95)!;
    expect(bright.at).toBeGreaterThanOrEqual(1800);
    expect(bright.at).toBeLessThanOrEqual(1850);
    for (const s of rel.filter((s) => s.at >= 2400)) expect(s.exposure).toBe(1);
    const rising = rel.filter((s) => s.at > 350 && s.at < 2400);
    rising.forEach((s, i) => {
      if (i > 0)
        expect(s.exposure).toBeGreaterThanOrEqual(rising[i - 1]!.exposure);
    });
    expect(host.dataset["dawn"]).toBe("done");
  });

  it("starts the spin as the dawn ends, not before", async () => {
    const host = hostWithBox();
    const engine = await start(host, { renderer: "webgpu", entrance: "dawn" });
    engine.startDawn();
    await vi.advanceTimersByTimeAsync(2350);
    expect(engine.getRotation()).toEqual([0, 0]);
    await vi.advanceTimersByTimeAsync(1500);
    expect(engine.getRotation()[0]).not.toBe(0);
  });

  it("draws the ambient spin at about 30 Hz, and a gesture at every frame", async () => {
    const host = hostWithBox();
    const engine = await start(host, { renderer: "webgpu", entrance: "dawn" });
    const fake = made[0]!;
    engine.startDawn();
    await vi.advanceTimersByTimeAsync(4500);
    const before = fake.frames.length;
    await vi.advanceTimersByTimeAsync(1000);
    const spun = fake.frames.length - before;
    expect(spun).toBeGreaterThanOrEqual(25);
    expect(spun).toBeLessThanOrEqual(36);

    engine.zoomBy(1.5);
    const zoomFrom = fake.frames.length;
    await vi.advanceTimersByTimeAsync(300);
    expect(fake.frames.length - zoomFrom).toBeGreaterThanOrEqual(14);
  });

  it("keeps the globe still however long the dawn is held back", async () => {
    const host = hostWithBox();
    const engine = await start(host, { renderer: "webgpu", entrance: "dawn" });
    await vi.advanceTimersByTimeAsync(6000);
    expect(engine.getRotation()).toEqual([0, 0]);
    engine.startDawn();
    await vi.advanceTimersByTimeAsync(2300);
    expect(engine.getRotation()).toEqual([0, 0]);
  });

  it("is at full exposure and done at once under reduced motion", async () => {
    const host = hostWithBox();
    const engine = await start(host, {
      renderer: "webgpu",
      entrance: "dawn",
      reducedMotion: () => true,
    });
    const done = engine.startDawn();
    await vi.advanceTimersByTimeAsync(0);
    await done;
    expect(made[0]!.frames.at(-1)!.exposure).toBe(1);
    expect(host.dataset["dawn"]).toBe("done");
  });

  it("starts the dawn once however often it is asked", async () => {
    const host = hostWithBox();
    const engine = await start(host, { renderer: "webgpu", entrance: "dawn" });
    const first = engine.startDawn();
    await vi.advanceTimersByTimeAsync(1000);
    expect(engine.startDawn()).toBe(first);
    await vi.advanceTimersByTimeAsync(1500);
    await first;
    expect(made[0]!.frames.at(-1)!.exposure).toBe(1);
  });

  it("leaves no frame pending when destroyed during the dawn", async () => {
    const host = hostWithBox();
    const engine = await start(host, { renderer: "webgpu", entrance: "dawn" });
    engine.startDawn();
    await vi.advanceTimersByTimeAsync(800);
    engine.destroy();
    expect(vi.getTimerCount()).toBe(0);
    expect(host.dataset["dawn"]).toBeUndefined();
  });

  it("runs the canvas-2D fallback for .8 s at full exposure, and leaves no timer behind", async () => {
    const host = hostWithBox();
    const engine = await start(host, {
      renderer: "canvas2d",
      entrance: "dawn",
    });
    const fake = made[0]!;
    engine.startDawn();
    await vi.advanceTimersByTimeAsync(700);
    expect(host.dataset["dawn"]).toBeUndefined();
    await vi.advanceTimersByTimeAsync(200);
    expect(host.dataset["dawn"]).toBe("done");
    for (const frame of fake.frames) expect(frame.exposure).toBe(1);
    engine.destroy();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("is ready to dawn when the renderer has its textures", async () => {
    const host = hostWithBox();
    let upload = () => {};
    const ready = new Promise<void>((resolve) => (upload = resolve));
    pendingReady = ready;
    const engine = await start(host, { renderer: "webgpu", entrance: "dawn" });
    let settled = false;
    void engine.dawnReady.then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);
    upload();
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(true);
  });
});
