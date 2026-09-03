/** @vitest-environment jsdom */
/// <reference types="vitest/globals" />

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// --------------------------------------------------------------------------
// A minimal IntersectionObserver stand-in — jsdom ships none. Captures the
// callback so a test can drive intersections by hand.
// --------------------------------------------------------------------------

class FakeIntersectionObserver {
  static last: FakeIntersectionObserver | undefined;
  cb: IntersectionObserverCallback;
  observed = new Set<Element>();
  unobserved: Element[] = [];

  constructor(cb: IntersectionObserverCallback) {
    this.cb = cb;
    FakeIntersectionObserver.last = this;
  }
  observe(el: Element) {
    this.observed.add(el);
  }
  unobserve(el: Element) {
    this.observed.delete(el);
    this.unobserved.push(el);
  }
  disconnect() {
    this.observed.clear();
  }
  trigger(el: Element, isIntersecting: boolean) {
    this.cb(
      [{ target: el, isIntersecting } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
}

function setReducedMotion(matches: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("reduce") ? matches : false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
}

async function load() {
  vi.resetModules();
  return import("./reveal-primitive");
}

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  setReducedMotion(false);
  FakeIntersectionObserver.last = undefined;
  document.body.innerHTML = "";
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("exported surface", () => {
  it("exposes exactly one export — an element revealer, not a text API", async () => {
    const mod = await load();
    expect(Object.keys(mod).sort()).toEqual(["initRevealPrimitive"]);
  });

  it("has no push / chunk / text / character-style API", async () => {
    const mod = await load();
    for (const name of Object.keys(mod)) {
      expect(name).not.toMatch(/push|write|chunk|text|char|token|type|stream/i);
    }
  });
});

describe("initRevealPrimitive", () => {
  it("reveals a .gmt-reveal element when it scrolls into view", async () => {
    vi.useFakeTimers();
    const el = document.createElement("div");
    el.className = "gmt-reveal";
    document.body.append(el);

    const { initRevealPrimitive } = await load();
    initRevealPrimitive();

    const obs = FakeIntersectionObserver.last;
    expect(obs?.observed.has(el)).toBe(true);
    expect(el.classList.contains("revealed")).toBe(false);

    obs?.trigger(el, true);
    vi.runAllTimers();

    expect(el.classList.contains("revealed")).toBe(true);
    expect(obs?.unobserved).toContain(el);
  });

  it("adds a one-shot scanline sweep only when the target is a panel", async () => {
    vi.useFakeTimers();
    const panel = document.createElement("div");
    panel.className = "gmt-reveal gmt-widget-card";
    const plain = document.createElement("div");
    plain.className = "gmt-reveal";
    document.body.append(panel, plain);

    const { initRevealPrimitive } = await load();
    initRevealPrimitive();
    const obs = FakeIntersectionObserver.last;

    obs?.trigger(panel, true);
    obs?.trigger(plain, true);
    vi.advanceTimersByTime(0);

    expect(panel.classList.contains("scanline-active")).toBe(true);
    expect(plain.classList.contains("scanline-active")).toBe(false);

    vi.runAllTimers();
    expect(panel.classList.contains("scanline-active")).toBe(false);
  });

  it("under prefers-reduced-motion reveals everything immediately, no observer", async () => {
    setReducedMotion(true);
    const el = document.createElement("div");
    el.className = "gmt-reveal";
    document.body.append(el);

    const { initRevealPrimitive } = await load();
    initRevealPrimitive();

    expect(el.classList.contains("revealed")).toBe(true);
    expect(FakeIntersectionObserver.last).toBeUndefined();
  });

  it("is idempotent — a second call does not re-observe", async () => {
    const el = document.createElement("div");
    el.className = "gmt-reveal";
    document.body.append(el);

    const { initRevealPrimitive } = await load();
    initRevealPrimitive();
    const first = FakeIntersectionObserver.last;
    initRevealPrimitive();

    expect(FakeIntersectionObserver.last).toBe(first);
  });

  it("honours data-reveal-delay before revealing", async () => {
    vi.useFakeTimers();
    const el = document.createElement("div");
    el.className = "gmt-reveal";
    el.setAttribute("data-reveal-delay", "250");
    document.body.append(el);

    const { initRevealPrimitive } = await load();
    initRevealPrimitive();
    FakeIntersectionObserver.last?.trigger(el, true);

    vi.advanceTimersByTime(200);
    expect(el.classList.contains("revealed")).toBe(false);
    vi.advanceTimersByTime(100);
    expect(el.classList.contains("revealed")).toBe(true);
  });
});
