// @vitest-environment jsdom
import {
  createSlicer,
  whenIdle,
  whenPainted,
  yieldToMain,
} from "./yield-to-main";

afterEach(() => {
  vi.useRealTimers();
});

describe("yieldToMain", () => {
  it("lets a queued task run first", async () => {
    const order: string[] = [];
    setTimeout(() => order.push("queued"), 0);
    await yieldToMain();
    order.push("resumed");
    expect(order).toEqual(["queued", "resumed"]);
  });

  it("uses scheduler.yield where there is one", async () => {
    const yielded = vi.fn(() => Promise.resolve());
    vi.stubGlobal("scheduler", { yield: yielded });
    await yieldToMain();
    expect(yielded).toHaveBeenCalledTimes(1);
  });
});

describe("createSlicer", () => {
  it("yields only once the budget is spent", async () => {
    vi.useFakeTimers();
    const yielded = vi.fn(() => Promise.resolve());
    vi.stubGlobal("scheduler", { yield: yielded });
    const slicer = createSlicer(10);
    await slicer.turn();
    expect(yielded).not.toHaveBeenCalled();
    vi.advanceTimersByTime(11);
    await slicer.turn();
    expect(yielded).toHaveBeenCalledTimes(1);
    await slicer.turn();
    expect(yielded).toHaveBeenCalledTimes(1);
  });
});

describe("whenIdle", () => {
  it("waits for requestIdleCallback after the page has loaded", async () => {
    let run: () => void = () => {};
    vi.stubGlobal("requestIdleCallback", (callback: () => void) => {
      run = callback;
    });
    let idle = false;
    const done = whenIdle().then(() => (idle = true));
    await vi.waitFor(() => expect(run).not.toBe(undefined));
    await Promise.resolve();
    expect(idle).toBe(false);
    run();
    await done;
    expect(idle).toBe(true);
  });

  it("falls back to a timer where requestIdleCallback does not exist", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestIdleCallback", undefined);
    let idle = false;
    const done = whenIdle().then(() => (idle = true));
    await vi.advanceTimersByTimeAsync(50);
    expect(idle).toBe(false);
    await vi.advanceTimersByTimeAsync(200);
    await done;
    expect(idle).toBe(true);
  });
});

describe("whenPainted", () => {
  const paint = { name: "first-contentful-paint" };

  it("resolves at once when the first contentful paint has already happened", async () => {
    vi.spyOn(performance, "getEntriesByName").mockReturnValue([
      paint as PerformanceEntry,
    ]);
    await expect(whenPainted()).resolves.toBeUndefined();
  });

  it("waits for the paint entry where it has not happened yet", async () => {
    let entries: PerformanceEntry[] = [];
    vi.spyOn(performance, "getEntriesByName").mockImplementation(() => entries);
    let notify: () => void = () => {};
    const disconnect = vi.fn();
    class Observer {
      static supportedEntryTypes = ["paint"];
      constructor(callback: () => void) {
        notify = callback;
      }
      observe() {}
      disconnect = disconnect;
    }
    vi.stubGlobal("PerformanceObserver", Observer);
    let painted = false;
    const done = whenPainted().then(() => (painted = true));
    notify();
    await Promise.resolve();
    expect(painted).toBe(false);
    entries = [paint as PerformanceEntry];
    notify();
    await done;
    expect(painted).toBe(true);
    expect(disconnect).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it("resolves at once where the browser reports no paint timing", async () => {
    vi.stubGlobal(
      "PerformanceObserver",
      class {
        static supportedEntryTypes = ["mark"];
      },
    );
    await expect(whenPainted()).resolves.toBeUndefined();
    vi.unstubAllGlobals();
  });
});
