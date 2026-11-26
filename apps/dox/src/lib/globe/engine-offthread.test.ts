// @vitest-environment jsdom

/**
 * Which canvas-2D backend the engine picks: the worker where it can, the main thread
 * otherwise, and the main thread again if the worker fails. The backends are faked.
 */
import { installJsdomShims } from "~/test/jsdom-shims";
import { createGlobeEngine } from "./engine";
import type { GlobeRenderer } from "./renderer";
import type { GlobeOptions } from "./types";

installJsdomShims();

const state = vi.hoisted(() => ({
  supported: true,
  workerStarts: true,
  made: [] as Array<GlobeRenderer & { fail(reason: string): void }>,
}));

function fake(host: HTMLElement, offThread: boolean) {
  const canvas = document.createElement("canvas");
  host.append(canvas);
  let onFailure: (reason: string) => void = () => {};
  const renderer = {
    kind: "canvas2d" as const,
    offThread,
    canvas,
    resize() {},
    setTheme() {},
    setRegions() {},
    setMarkers() {},
    setArcs() {},
    render() {},
    onFailure(callback: (reason: string) => void) {
      onFailure = callback;
    },
    destroy() {
      canvas.remove();
    },
    fail(reason: string) {
      onFailure(reason);
    },
  };
  state.made.push(renderer);
  return renderer;
}

vi.mock("./off-thread-support", () => ({
  canDrawOffThread: () => state.supported,
}));
vi.mock("./canvas2d/renderer-canvas2d-worker", () => ({
  createWorkerCanvas2dRenderer: async (init: { host: HTMLElement }) => {
    if (!state.workerStarts) throw new Error("module workers unsupported");
    return fake(init.host, true);
  },
}));
vi.mock("./canvas2d/renderer-canvas2d", () => ({
  createCanvas2dRenderer: async (init: { host: HTMLElement }) =>
    fake(init.host, false),
}));

const options = (extra: Partial<GlobeOptions> = {}): GlobeOptions => ({
  renderer: "canvas2d",
  sunInstant: () => 0,
  theme: {} as GlobeOptions["theme"],
  labelFont: "12px sans-serif",
  ariaLabel: "Globe",
  initialRotation: [0, 0],
  ...extra,
});

const engines: Array<{ destroy(): void }> = [];

async function start(extra: Partial<GlobeOptions> = {}) {
  const host = document.createElement("div");
  document.body.append(host);
  const engine = await createGlobeEngine(host, options(extra));
  engines.push(engine);
  return host;
}

beforeEach(() => {
  state.supported = true;
  state.workerStarts = true;
});

afterEach(() => {
  for (const engine of engines.splice(0)) engine.destroy();
  state.made.length = 0;
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("choosing where canvas 2D draws", () => {
  it("draws in the worker when the browser can", async () => {
    await start();
    expect(state.made.map((r) => r.offThread)).toEqual([true]);
  });

  it("draws on the main thread when the browser cannot hand a canvas to a worker", async () => {
    state.supported = false;
    await start();
    expect(state.made.map((r) => r.offThread)).toEqual([false]);
  });

  it("draws on the main thread when the worker does not start", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    state.workerStarts = false;
    const host = await start();
    expect(state.made.map((r) => r.offThread)).toEqual([false]);
    expect(host.querySelector("canvas")).not.toBeNull();
  });

  it("draws on the main thread when the caller turns the worker off", async () => {
    await start({ offThread: false });
    expect(state.made.map((r) => r.offThread)).toEqual([false]);
  });

  it("replaces a worker that dies with the main thread, not another worker", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const host = await start();
    state.made[0]!.fail("out of memory");
    await vi.waitFor(() => expect(state.made).toHaveLength(2));
    expect(state.made.map((r) => r.offThread)).toEqual([true, false]);
    expect(host.querySelectorAll("canvas")).toHaveLength(1);
  });
});
