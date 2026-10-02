/**
 * @vitest-environment jsdom
 *
 * `enter` / `holdEntrance`: the contract is in the file header of enter.ts.
 * jsdom runs no animations, so animationend is dispatched by hand.
 */
/// <reference types="vitest/globals" />

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enter, holdEntrance } from "./enter";

function animationEnd(el: HTMLElement, animationName = "gmt-enter"): void {
  const event = new Event("animationend") as AnimationEvent;
  Object.defineProperty(event, "animationName", { value: animationName });
  el.dispatchEvent(event);
}

function setReducedMotion(matches: boolean): void {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({ matches } as MediaQueryList),
  );
}

describe("enter", () => {
  let el: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    setReducedMotion(false);
    el = document.createElement("div");
    document.body.append(el);
  });

  afterEach(() => {
    el.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("plays the entrance, then leaves the element entered and unclassed", () => {
    const onEntered = vi.fn();
    enter(el, { onEntered });
    expect(el.classList.contains("gmt-enter")).toBe(true);
    expect(onEntered).not.toHaveBeenCalled();

    animationEnd(el);
    expect(el.classList.contains("gmt-enter")).toBe(false);
    expect(el.hasAttribute("data-entered")).toBe(true);
    expect(onEntered).toHaveBeenCalledOnce();
  });

  it("ignores another animation ending on the element", () => {
    enter(el);
    animationEnd(el, "gmt-focus-sonar");
    expect(el.classList.contains("gmt-enter")).toBe(true);
  });

  it("sets the stagger as --gmt-enter-delay and clears it after", () => {
    enter(el, { delayMs: 80 });
    expect(el.style.getPropertyValue("--gmt-enter-delay")).toBe("80ms");
    animationEnd(el);
    expect(el.style.getPropertyValue("--gmt-enter-delay")).toBe("");
  });

  it("finishes on its timer when animationend never comes", () => {
    const onEntered = vi.fn();
    enter(el, { delayMs: 80, onEntered });
    vi.advanceTimersByTime(80 + 1500);
    expect(el.hasAttribute("data-entered")).toBe(true);
    expect(onEntered).toHaveBeenCalledOnce();

    animationEnd(el);
    expect(onEntered).toHaveBeenCalledOnce();
  });

  it("enters at once under reduced motion", () => {
    setReducedMotion(true);
    const onEntered = vi.fn();
    enter(el, { onEntered });
    expect(el.classList.contains("gmt-enter")).toBe(false);
    expect(el.hasAttribute("data-entered")).toBe(true);
    expect(onEntered).toHaveBeenCalledOnce();
  });

  it("does nothing a second time, while playing or after", () => {
    const onEntered = vi.fn();
    enter(el, { onEntered });
    enter(el, { onEntered });
    animationEnd(el);
    enter(el, { onEntered });
    expect(el.classList.contains("gmt-enter")).toBe(false);
    expect(onEntered).toHaveBeenCalledOnce();
  });

  it("works where matchMedia does not exist", () => {
    vi.stubGlobal("matchMedia", undefined);
    enter(el);
    expect(el.classList.contains("gmt-enter")).toBe(true);
  });
});

describe("holdEntrance", () => {
  let el: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    setReducedMotion(false);
    el = document.createElement("div");
    document.body.append(el);
  });

  afterEach(() => {
    el.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("holds the element pending until released, then plays the entrance", () => {
    const release = holdEntrance(el);
    expect(el.getAttribute("data-enter")).toBe("pending");

    release({ delayMs: 80 });
    expect(el.hasAttribute("data-enter")).toBe(false);
    expect(el.classList.contains("gmt-enter")).toBe(true);
    expect(el.style.getPropertyValue("--gmt-enter-delay")).toBe("80ms");
  });

  it("releases itself when nobody does, so the element is never left hidden", () => {
    holdEntrance(el, 1500);
    vi.advanceTimersByTime(1500);
    expect(el.hasAttribute("data-enter")).toBe(false);
    expect(el.classList.contains("gmt-enter")).toBe(true);
  });

  it("does not hold under reduced motion", () => {
    setReducedMotion(true);
    const release = holdEntrance(el);
    expect(el.hasAttribute("data-enter")).toBe(false);
    release();
    expect(el.classList.contains("gmt-enter")).toBe(false);
  });
});
