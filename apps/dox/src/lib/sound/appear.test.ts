/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cueOnAppear } from "./appear";

const cue = vi.fn();
vi.mock("./cue", () => ({ cue: (name: string) => cue(name) }));

type Callback = (entries: Partial<IntersectionObserverEntry>[]) => void;

/** The live observers, each with its callback and whether it was disconnected. */
const observers: { callback: Callback; options: unknown; off: boolean }[] = [];

class FakeIntersectionObserver {
  private readonly record;
  constructor(callback: Callback, options: unknown) {
    this.record = { callback, options, off: false };
    observers.push(this.record);
  }
  observe(): void {}
  disconnect(): void {
    this.record.off = true;
  }
}

let active = true;
let reduced = false;
let life: AbortController;

/** The element comes into view (`true`) or is still out of it. */
function scroll(inView: boolean): void {
  for (const o of observers)
    if (!o.off) o.callback([{ isIntersecting: inView }]);
}

beforeEach(() => {
  cue.mockClear();
  observers.length = 0;
  active = true;
  reduced = false;
  life = new AbortController();
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduced && query.includes("reduce"),
  }));
  vi.stubGlobal("navigator", {
    userActivation: {
      get hasBeenActive() {
        return active;
      },
    },
  });
});

afterEach(() => {
  life.abort();
  vi.unstubAllGlobals();
});

describe("cueOnAppear", () => {
  it("plays once, when a quarter of the element first comes into view", () => {
    cueOnAppear(document.body, "appearMap", life.signal);
    expect(observers[0].options).toEqual({ threshold: 0.25 });
    scroll(false);
    expect(cue).not.toHaveBeenCalled();
    scroll(true);
    scroll(true);
    expect(cue).toHaveBeenCalledExactlyOnceWith("appearMap");
  });

  it("stays silent for good for an element on screen before the reader's first gesture", () => {
    active = false;
    cueOnAppear(document.body, "appearGlobe", life.signal);
    scroll(true);
    active = true;
    scroll(true);
    expect(cue).not.toHaveBeenCalled();
  });

  it("plays for one that comes into view after the first gesture", () => {
    active = false;
    cueOnAppear(document.body, "appearGlobe", life.signal);
    scroll(false);
    active = true;
    scroll(true);
    expect(cue).toHaveBeenCalledExactlyOnceWith("appearGlobe");
  });

  it("plays nothing under reduced motion, which removes the arrival it doubles", () => {
    reduced = true;
    cueOnAppear(document.body, "appearMap", life.signal);
    scroll(true);
    expect(cue).not.toHaveBeenCalled();
  });

  it("stops watching when its signal aborts, and never starts on an aborted one", () => {
    cueOnAppear(document.body, "appearMap", life.signal);
    life.abort();
    expect(observers[0].off).toBe(true);
    cueOnAppear(document.body, "appearMap", life.signal);
    expect(observers).toHaveLength(1);
  });
});
