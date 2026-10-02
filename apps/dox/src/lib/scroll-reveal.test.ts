/**
 * @vitest-environment jsdom
 */
/// <reference types="vitest/globals" />

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initScrollReveal } from "./scroll-reveal";

class FakeIntersectionObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

beforeEach(() => {
  document.body.innerHTML = `<ul data-reveal-group><li>a</li><li>b</li></ul>`;
  document.documentElement.classList.remove("gmt-reveal-ready");
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("initScrollReveal", () => {
  it("marks the page ready to hide only when it is about to observe", () => {
    initScrollReveal();
    expect(
      document.documentElement.classList.contains("gmt-reveal-ready"),
    ).toBe(true);
  });

  it("hides nothing under reduced motion", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    initScrollReveal();
    expect(
      document.documentElement.classList.contains("gmt-reveal-ready"),
    ).toBe(false);
    expect(
      document
        .querySelector("[data-reveal-group]")!
        .classList.contains("gmt-reveal-in"),
    ).toBe(true);
  });

  it("hides nothing without IntersectionObserver", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    delete (window as { IntersectionObserver?: unknown }).IntersectionObserver;
    initScrollReveal();
    expect(
      document.documentElement.classList.contains("gmt-reveal-ready"),
    ).toBe(false);
  });
});
