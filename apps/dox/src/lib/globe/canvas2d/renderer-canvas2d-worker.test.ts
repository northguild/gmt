// @vitest-environment jsdom

import type { FrameState, RendererInit } from "../renderer";
import type { GlobeTheme } from "../types";
import {
  createWorkerCanvas2dRenderer,
  READY_TIMEOUT_MS,
  type WorkerLike,
} from "./renderer-canvas2d-worker";
import type { FromWorker, ToWorker } from "./protocol";

const theme = {} as GlobeTheme;
const frameOf = (zoom: number) => ({ zoom }) as unknown as FrameState;

class FakeWorker implements WorkerLike {
  sent: ToWorker[] = [];
  terminated = false;
  onmessage: WorkerLike["onmessage"] = null;
  onerror: WorkerLike["onerror"] = null;
  onmessageerror: WorkerLike["onmessageerror"] = null;
  postMessage(message: ToWorker) {
    this.sent.push(message);
  }
  terminate() {
    this.terminated = true;
  }
  reply(message: FromWorker) {
    this.onmessage?.({ data: message } as MessageEvent<FromWorker>);
  }
  frames() {
    return this.sent.filter((m) => m.type === "frame");
  }
}

let host: HTMLElement;
let worker: FakeWorker;
const owned: Array<{ destroy(): void }> = [];

function init(): RendererInit {
  return {
    host,
    theme,
    labelFont: "12px x",
    ariaLabel: "Globe",
    invalidate() {},
    reducedMotion: () => false,
  };
}

async function start(options: { timeout?: number } = {}) {
  const pending = createWorkerCanvas2dRenderer(init(), {
    spawn: () => worker,
    readyTimeoutMs: options.timeout,
    textMatchesPage: () => true,
  });
  worker.reply({ type: "ready" });
  const renderer = await pending;
  owned.push(renderer);
  return renderer;
}

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  worker = new FakeWorker();
  Object.defineProperty(
    HTMLCanvasElement.prototype,
    "transferControlToOffscreen",
    {
      configurable: true,
      value: () => ({}) as OffscreenCanvas,
    },
  );
});

afterEach(() => {
  for (const renderer of owned.splice(0)) renderer.destroy();
  delete (
    HTMLCanvasElement.prototype as { transferControlToOffscreen?: unknown }
  ).transferControlToOffscreen;
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe("the canvas 2D worker renderer", () => {
  it("hands the worker its canvas and shows the page canvas once the worker is ready", async () => {
    const pending = createWorkerCanvas2dRenderer(init(), {
      spawn: () => worker,
      textMatchesPage: () => true,
    });
    expect(worker.sent[0]).toMatchObject({ type: "init", labelFont: "12px x" });
    expect(host.querySelector("canvas")).toBeNull();
    worker.reply({ type: "ready" });
    const renderer = await pending;
    owned.push(renderer);
    expect(renderer.offThread).toBe(true);
    expect(host.querySelector("canvas")).toBe(renderer.canvas);
  });

  it("sends the pixel size with the next frame", async () => {
    const renderer = await start();
    renderer.resize(400, 300, 2);
    renderer.render(frameOf(1));
    expect(worker.frames()[0]).toMatchObject({
      size: { width: 400, height: 300, dpr: 2 },
    });
  });

  it("keeps one frame in flight and draws only the newest after it", async () => {
    const renderer = await start();
    renderer.render(frameOf(1));
    renderer.render(frameOf(2));
    renderer.render(frameOf(3));
    expect(worker.frames()).toHaveLength(1);

    worker.reply({ type: "drawn", seq: 1 });
    expect(worker.frames()).toHaveLength(2);
    expect(worker.frames()[1]).toMatchObject({ frame: { zoom: 3 }, seq: 2 });

    worker.reply({ type: "drawn", seq: 2 });
    expect(worker.frames()).toHaveLength(2);
  });

  it("sends changed state once, and not again on later frames", async () => {
    const renderer = await start();
    renderer.setMarkers([]);
    renderer.setTheme(theme);
    renderer.render(frameOf(1));
    worker.reply({ type: "drawn", seq: 1 });
    renderer.render(frameOf(2));
    const [first, second] = worker.frames();
    expect(first).toMatchObject({ markers: [], theme });
    expect(second).toMatchObject({ markers: undefined, theme: undefined });
  });

  it("never starts a worker whose labels would differ from the page's, so the shell draws on the main thread", async () => {
    const spawn = vi.fn(() => worker);
    await expect(
      createWorkerCanvas2dRenderer(init(), {
        spawn,
        textMatchesPage: () => false,
      }),
    ).rejects.toThrow("differently from the page");
    expect(spawn).not.toHaveBeenCalled();
    expect(host.querySelector("canvas")).toBeNull();
  });

  it("rejects, and ends the worker, when the worker errors before it is ready", async () => {
    const pending = createWorkerCanvas2dRenderer(init(), {
      spawn: () => worker,
      textMatchesPage: () => true,
    });
    worker.onerror?.({ message: "module workers unsupported" } as ErrorEvent);
    await expect(pending).rejects.toThrow("module workers unsupported");
    expect(worker.terminated).toBe(true);
    expect(host.querySelector("canvas")).toBeNull();
  });

  it("rejects when the worker has no 2D context", async () => {
    const pending = createWorkerCanvas2dRenderer(init(), {
      spawn: () => worker,
      textMatchesPage: () => true,
    });
    worker.reply({ type: "failed", reason: "canvas 2D is unavailable" });
    await expect(pending).rejects.toThrow("canvas 2D is unavailable");
    expect(worker.terminated).toBe(true);
  });

  it("rejects when the worker never answers", async () => {
    vi.useFakeTimers();
    const pending = createWorkerCanvas2dRenderer(init(), {
      spawn: () => worker,
      textMatchesPage: () => true,
    });
    const outcome = expect(pending).rejects.toThrow("did not start");
    await vi.advanceTimersByTimeAsync(READY_TIMEOUT_MS);
    await outcome;
    expect(worker.terminated).toBe(true);
  });

  it("tells the shell when the worker fails after it started", async () => {
    const renderer = await start();
    const reasons: string[] = [];
    renderer.onFailure((reason) => reasons.push(reason));
    worker.onerror?.({ message: "out of memory" } as ErrorEvent);
    expect(reasons).toEqual(["out of memory"]);
  });

  it("stops the worker and removes the canvas on destroy, and draws nothing after", async () => {
    const renderer = await start();
    renderer.destroy();
    expect(worker.terminated).toBe(true);
    expect(host.querySelector("canvas")).toBeNull();
    renderer.render(frameOf(1));
    expect(worker.frames()).toHaveLength(0);
    expect(worker.sent.at(-1)).toEqual({ type: "destroy" });
  });
});
