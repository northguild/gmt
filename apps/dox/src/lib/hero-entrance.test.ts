/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENTRANCE_MARK, ENTRANCE_MS, runHeroEntrance } from "./hero-entrance";

const html = document.documentElement;
let controller: AbortController;
let clock = 0;

/** A promise the test settles by hand. */
function gate(): { promise: Promise<void>; open: () => void } {
  let open = () => {};
  const promise = new Promise<void>((resolve) => (open = resolve));
  return { promise, open };
}

function start(
  sky: Promise<void>,
  globe: Promise<void>,
  startDawn = vi.fn(),
  deadline?: number,
) {
  runHeroEntrance({
    sky: { ready: sky },
    globe: { ready: globe, startDawn },
    signal: controller.signal,
    now: () => clock,
    ...(deadline === undefined ? {} : { deadline }),
  });
  return startDawn;
}

beforeEach(() => {
  vi.useFakeTimers();
  controller = new AbortController();
  clock = 0;
  html.dataset["entrance"] = "wait";
  vi.spyOn(performance, "mark").mockReturnValue({} as PerformanceMark);
});

afterEach(() => {
  controller.abort();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete html.dataset["entrance"];
});

describe("runHeroEntrance", () => {
  it("waits for the sky and the globe, then runs once", async () => {
    const sky = gate();
    const globe = gate();
    const startDawn = start(sky.promise, globe.promise);
    await vi.advanceTimersByTimeAsync(100);
    expect(html.dataset["entrance"]).toBe("wait");

    sky.open();
    await vi.advanceTimersByTimeAsync(0);
    expect(html.dataset["entrance"]).toBe("wait");
    expect(startDawn).not.toHaveBeenCalled();

    globe.open();
    await vi.advanceTimersByTimeAsync(0);
    expect(html.dataset["entrance"]).toBe("run");
    expect(startDawn).toHaveBeenCalledTimes(1);
    expect(performance.mark).toHaveBeenCalledTimes(1);
    expect(performance.mark).toHaveBeenCalledWith(ENTRANCE_MARK);

    await vi.advanceTimersByTimeAsync(5000);
    expect(startDawn).toHaveBeenCalledTimes(1);
  });

  it("starts at the deadline when the sky and globe are late", async () => {
    clock = 300;
    const never = new Promise<void>(() => {});
    const startDawn = start(never, never);
    await vi.advanceTimersByTimeAsync(499);
    expect(html.dataset["entrance"]).toBe("wait");
    await vi.advanceTimersByTimeAsync(1);
    expect(html.dataset["entrance"]).toBe("run");
    expect(startDawn).toHaveBeenCalledTimes(1);
  });

  it("honours a deadline passed in", async () => {
    const never = new Promise<void>(() => {});
    const startDawn = start(never, never, vi.fn(), 120);
    await vi.advanceTimersByTimeAsync(119);
    expect(startDawn).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(startDawn).toHaveBeenCalledTimes(1);
  });

  it("starts at once when the deadline has already passed", async () => {
    clock = 1500;
    const never = new Promise<void>(() => {});
    const startDawn = start(never, never);
    await vi.advanceTimersByTimeAsync(0);
    expect(html.dataset["entrance"]).toBe("run");
    expect(startDawn).toHaveBeenCalledTimes(1);
  });

  it("treats a sky or globe that failed as ready", async () => {
    const startDawn = start(
      Promise.reject(new Error("no stars")),
      Promise.resolve(),
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(html.dataset["entrance"]).toBe("run");
    expect(startDawn).toHaveBeenCalledTimes(1);
  });

  it("sets nothing when aborted before t0", async () => {
    const sky = gate();
    const globe = gate();
    const startDawn = start(sky.promise, globe.promise);
    controller.abort();
    sky.open();
    globe.open();
    await vi.advanceTimersByTimeAsync(5000);
    expect(html.dataset["entrance"]).toBe("wait");
    expect(startDawn).not.toHaveBeenCalled();
    expect(performance.mark).not.toHaveBeenCalled();
  });

  it("does not run on a page already shown static", async () => {
    html.dataset["entrance"] = "static";
    const startDawn = start(Promise.resolve(), Promise.resolve());
    await vi.advanceTimersByTimeAsync(0);
    expect(html.dataset["entrance"]).toBe("static");
    expect(startDawn).toHaveBeenCalledTimes(1);
  });

  it("hands the page over to its resting state once every animation has ended", async () => {
    start(Promise.resolve(), Promise.resolve());
    await vi.advanceTimersByTimeAsync(0);
    expect(html.dataset["entrance"]).toBe("run");
    await vi.advanceTimersByTimeAsync(ENTRANCE_MS - 1);
    expect(html.dataset["entrance"]).toBe("run");
    await vi.advanceTimersByTimeAsync(1);
    expect(html.dataset["entrance"]).toBe("done");
  });

  it("leaves a page the failsafe already showed as it is", async () => {
    html.dataset["entrance"] = "static";
    start(Promise.resolve(), Promise.resolve());
    await vi.advanceTimersByTimeAsync(ENTRANCE_MS + 10);
    expect(html.dataset["entrance"]).toBe("static");
  });

  it("stops the hand-over when the page is torn down mid-entrance", async () => {
    start(Promise.resolve(), Promise.resolve());
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    expect(vi.getTimerCount()).toBe(0);
  });

  describe("in a browser that reports the reveal", () => {
    /** What the sequencer registered for `pagereveal`, delivered by hand. */
    let reveal: () => void;

    beforeEach(() => {
      const real = window.addEventListener.bind(window);
      reveal = () => {};
      vi.spyOn(window, "addEventListener").mockImplementation(((
        name: string,
        listener: EventListener,
        options?: AddEventListenerOptions,
      ) => {
        if (name === "pagereveal")
          reveal = () => listener({ type: name } as Event);
        else real(name, listener, options);
      }) as typeof window.addEventListener);
      Object.defineProperty(window, "onpagereveal", {
        value: null,
        configurable: true,
      });
    });

    afterEach(() => {
      Reflect.deleteProperty(window, "onpagereveal");
      delete html.dataset["arrival"];
    });

    it("waits for the reveal, which says how the page was reached, before it runs", async () => {
      const startDawn = start(Promise.resolve(), Promise.resolve());
      await vi.advanceTimersByTimeAsync(1000);
      expect(html.dataset["entrance"]).toBe("wait");
      expect(startDawn).not.toHaveBeenCalled();

      html.dataset["arrival"] = "transition";
      reveal();
      expect(html.dataset["entrance"]).toBe("run");
      expect(startDawn).toHaveBeenCalledTimes(1);
    });

    it("runs at once when the reveal has already happened", async () => {
      html.dataset["arrival"] = "load";
      const startDawn = start(Promise.resolve(), Promise.resolve());
      await vi.advanceTimersByTimeAsync(0);
      expect(html.dataset["entrance"]).toBe("run");
      expect(startDawn).toHaveBeenCalledTimes(1);
    });

    it("does not run on a reveal that comes after an abort", async () => {
      const startDawn = start(Promise.resolve(), Promise.resolve());
      await vi.advanceTimersByTimeAsync(1000);
      controller.abort();
      html.dataset["arrival"] = "load";
      reveal();
      expect(html.dataset["entrance"]).toBe("wait");
      expect(startDawn).not.toHaveBeenCalled();
    });
  });
});
