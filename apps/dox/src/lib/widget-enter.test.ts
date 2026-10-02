/**
 * @vitest-environment jsdom
 *
 * `enterWidgetSections`: which elements get the shared entrance, in what order,
 * and that nothing is left hidden. jsdom runs no animations and paints nothing,
 * so animationend is dispatched by hand and "after first paint" is the state the
 * DOM holds once the timers have run. A flash on the very first frame (the
 * class landing after the server-rendered section was already painted) needs a
 * browser.
 */
/// <reference types="vitest/globals" />

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  CARD_STAGGER_MS,
  ENTER_HOLD_CLASS,
  enterWidgetSections,
  releaseEntranceHold,
} from "./widget-enter";

function setReducedMotion(matches: boolean): void {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({ matches } as MediaQueryList),
  );
}

function animationEnd(el: HTMLElement): void {
  const event = new Event("animationend") as AnimationEvent;
  Object.defineProperty(event, "animationName", { value: "gmt-enter" });
  el.dispatchEvent(event);
}

/** A widget as the server renders it: cards of sections, plus things that are not. */
function widget(): HTMLElement {
  const root = document.createElement("div");
  root.className = "gmt-widget";
  root.innerHTML =
    `<div class="gmt-widget-card" id="a">` +
    `<section class="gmt-widget-section" id="a1"></section>` +
    `<section class="gmt-widget-section" id="a2"></section>` +
    `<section class="gmt-widget-section" id="a3"></section>` +
    `<div class="gmt-grow"><section class="gmt-widget-section" id="nested"></section></div>` +
    `</div>` +
    `<div class="gmt-widget-card" id="b">` +
    `<section class="gmt-widget-section" id="b1"></section>` +
    `</div>` +
    `<section class="gmt-widget-section" id="loose"></section>`;
  document.body.append(root);
  return root;
}

const el = (id: string) => document.getElementById(id) as HTMLElement;

describe("enterWidgetSections", () => {
  let root: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    setReducedMotion(false);
    root = widget();
  });

  afterEach(() => {
    root.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("enters each card's direct sections and nothing else", () => {
    enterWidgetSections(document);
    for (const id of ["a1", "a2", "a3", "b1"]) {
      expect(el(id).classList.contains("gmt-enter"), id).toBe(true);
    }
    // A section nested inside a wrapper, or outside any card, does not enter.
    expect(el("nested").classList.contains("gmt-enter")).toBe(false);
    expect(el("loose").classList.contains("gmt-enter")).toBe(false);
  });

  it("staggers in reading order and restarts the stagger per card", () => {
    enterWidgetSections(root);
    const delay = (id: string) =>
      el(id).style.getPropertyValue("--gmt-enter-delay");
    expect(delay("a1")).toBe("0ms");
    expect(delay("a2")).toBe(`${CARD_STAGGER_MS}ms`);
    expect(delay("a3")).toBe(`${2 * CARD_STAGGER_MS}ms`);
    expect(delay("b1")).toBe("0ms");
  });

  it("leaves nothing hidden once the entrance has run", () => {
    enterWidgetSections(root);
    // Whether animationend arrives or the timer has to finish it.
    animationEnd(el("a1"));
    vi.advanceTimersByTime(5000);
    for (const id of ["a1", "a2", "a3", "b1"]) {
      const section = el(id);
      expect(section.classList.contains("gmt-enter"), id).toBe(false);
      expect(section.hasAttribute("data-enter"), id).toBe(false);
      expect(section.hasAttribute("data-entered"), id).toBe(true);
      expect(section.style.opacity, id).toBe("");
    }
  });

  it("never marks a section as held: only the class plays the entrance", () => {
    enterWidgetSections(root);
    for (const id of ["a1", "a2", "a3", "b1"]) {
      expect(el(id).getAttribute("data-enter"), id).toBeNull();
    }
  });

  it("shows server-rendered sections at once under reduced motion", () => {
    setReducedMotion(true);
    enterWidgetSections(root);
    for (const id of ["a1", "a2", "a3", "b1"]) {
      expect(el(id).classList.contains("gmt-enter"), id).toBe(false);
      expect(el(id).hasAttribute("data-entered"), id).toBe(true);
    }
  });

  it("is a no-op the second time over the same scope", () => {
    enterWidgetSections(root);
    vi.advanceTimersByTime(5000);
    const before = root.innerHTML;
    enterWidgetSections(root);
    expect(root.innerHTML).toBe(before);
  });

  it("does nothing for a scope with no cards", () => {
    const empty = document.createElement("div");
    expect(() => enterWidgetSections(empty)).not.toThrow();
  });
});

/**
 * The first-paint hold. A flash on the very first frame needs a browser, so the
 * browser check lives in the Dox report; what is pinned here is each part of the
 * mechanism: the inline script that sets the hold before paint, the CSS that
 * reads it, and the release that ends it.
 */
describe("the first-paint hold", () => {
  const read = (rel: string) =>
    readFileSync(new URL(rel, import.meta.url), "utf8");

  /** The text of Head.astro's inline script, run as the browser would run it. */
  function runInlineHold(): void {
    const match = /<script is:inline>([\s\S]*?)<\/script>/.exec(
      read("../components/Head.astro"),
    );
    expect(match, "Head.astro has an inline script").not.toBeNull();
    new Function(match![1]!)();
  }

  beforeEach(() => {
    vi.useFakeTimers();
    document.documentElement.classList.remove(ENTER_HOLD_CLASS);
  });

  afterEach(() => {
    document.documentElement.classList.remove(ENTER_HOLD_CLASS);
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("is set by the inline script when motion is allowed", () => {
    setReducedMotion(false);
    runInlineHold();
    expect(document.documentElement.classList.contains(ENTER_HOLD_CLASS)).toBe(
      true,
    );
  });

  it("is never set under reduced motion", () => {
    setReducedMotion(true);
    runInlineHold();
    expect(document.documentElement.classList.contains(ENTER_HOLD_CLASS)).toBe(
      false,
    );
  });

  it("lifts itself after two seconds if the module script never runs", () => {
    setReducedMotion(false);
    runInlineHold();
    vi.advanceTimersByTime(1999);
    expect(document.documentElement.classList.contains(ENTER_HOLD_CLASS)).toBe(
      true,
    );
    vi.advanceTimersByTime(2);
    expect(document.documentElement.classList.contains(ENTER_HOLD_CLASS)).toBe(
      false,
    );
  });

  it("is lifted by releaseEntranceHold, after every card has taken its entrance", () => {
    setReducedMotion(false);
    runInlineHold();
    const root = widget();
    enterWidgetSections(document);
    releaseEntranceHold();
    expect(document.documentElement.classList.contains(ENTER_HOLD_CLASS)).toBe(
      false,
    );
    // Every card the hold covered is already in its entrance, so lifting the
    // hold cannot let one paint at full opacity first.
    for (const id of ["a1", "a2", "a3", "b1"]) {
      expect(el(id).classList.contains("gmt-enter"), id).toBe(true);
    }
    root.remove();
  });

  it("is safe to lift when it was never set", () => {
    expect(() => releaseEntranceHold()).not.toThrow();
  });

  it("hides cards by CSS only behind the hold class, only until they enter", () => {
    const css = read("../styles/gmt-primitives.css").replace(/\s+/g, " ");
    const rule =
      /html\.gmt-enter-hold \.gmt-widget-card > \.gmt-widget-section:not\(\.gmt-enter\):not\(\[data-entered\]\) \{ opacity: 0; \}/;
    expect(css).toMatch(rule);
    // No other rule makes a widget section transparent.
    const others = css
      .split("}")
      .filter(
        (block) =>
          /\.gmt-widget-section/.test(block) && /opacity: 0\b/.test(block),
      )
      .filter((block) => !block.includes("html.gmt-enter-hold"));
    expect(others).toEqual([]);
  });
});
