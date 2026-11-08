// @vitest-environment jsdom
import { createSlicer, whenIdle, yieldToMain } from "./yield-to-main";

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
