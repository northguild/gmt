/**
 * @vitest-environment jsdom
 *
 * `smoothHeight` / `smoothHeights`: the contract is in the file header of
 * smooth-height.ts. jsdom has no layout and no ResizeObserver, so a hand-driven
 * fake observer delivers sizes, and `getBoundingClientRect` / `offsetHeight` are
 * stubbed to say what layout would.
 */
/// <reference types="vitest/globals" />

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_GROW_MAX_MS,
  GROW_MS_PER_PX,
  MIN_GROW_MS,
  growDuration,
  smoothHeight,
  smoothHeights,
} from "./smooth-height";

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  observed = new Set<Element>();
  disconnected = false;
  constructor(private cb: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this);
  }
  observe(el: Element): void {
    this.observed.add(el);
  }
  unobserve(el: Element): void {
    this.observed.delete(el);
  }
  disconnect(): void {
    this.observed.clear();
    this.disconnected = true;
  }
  /** Delivers one batch, as the browser does after layout. */
  deliver(...sizes: [Element, number, number][]): void {
    this.cb(
      sizes.map(
        ([target, w, h]) =>
          ({
            target,
            borderBoxSize: [{ inlineSize: w, blockSize: h }],
            contentRect: { width: w, height: h },
          }) as unknown as ResizeObserverEntry,
      ),
      this as unknown as ResizeObserver,
    );
  }
  static get current(): FakeResizeObserver {
    return FakeResizeObserver.instances[
      FakeResizeObserver.instances.length - 1
    ]!;
  }
}

function stubRect(el: Element, w: number, h: number): void {
  el.getBoundingClientRect = () =>
    ({ width: w, height: h, top: 0, left: 0, right: w, bottom: h }) as DOMRect;
}

/** An outer with one inner; the inner's seed size is `w` x `h`. */
function makeGrow(w = 400, h = 100) {
  const outer = document.createElement("div");
  outer.className = "gmt-grow";
  const inner = document.createElement("div");
  inner.className = "gmt-grow-inner";
  outer.append(inner);
  document.body.append(outer);
  stubRect(inner, w, h);
  return { outer, inner };
}

function endEvent(
  target: Element,
  type: "transitionend" | "transitioncancel",
  propertyName = "height",
  bubbles = true,
): void {
  const event = new Event(type, { bubbles });
  Object.defineProperty(event, "propertyName", { value: propertyName });
  target.dispatchEvent(event);
}

let controller: AbortController;

beforeEach(() => {
  FakeResizeObserver.instances = [];
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  controller = new AbortController();
});

afterEach(() => {
  controller.abort();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe("growDuration", () => {
  it("is linear in distance between the floor and the cap", () => {
    expect(growDuration(500, 700)).toBeCloseTo(500 * GROW_MS_PER_PX);
    expect(growDuration(900, 700) - growDuration(800, 700)).toBeCloseTo(
      100 * GROW_MS_PER_PX,
    );
    expect(GROW_MS_PER_PX).toBe(0.6);
  });

  it("never goes below the floor", () => {
    expect(growDuration(0, 700)).toBe(MIN_GROW_MS);
    expect(growDuration(10, 700)).toBe(MIN_GROW_MS);
    expect(MIN_GROW_MS).toBe(120);
  });

  it("never goes above the cap", () => {
    expect(growDuration(5000, 700)).toBe(700);
    expect(growDuration(1176, 700)).toBe(700);
    expect(growDuration(5000, 300)).toBe(300);
    expect(DEFAULT_GROW_MAX_MS).toBe(1250);
    expect(growDuration(2000, DEFAULT_GROW_MAX_MS)).toBeCloseTo(1200);
    expect(growDuration(5000, DEFAULT_GROW_MAX_MS)).toBe(1250);
  });

  it("treats a shrink like a growth", () => {
    expect(growDuration(-400, 700)).toBe(growDuration(400, 700));
  });

  it("lets a cap below the floor win", () => {
    expect(growDuration(500, 80)).toBe(80);
  });
});

describe("smoothHeight", () => {
  it("does not animate at attach", () => {
    const { outer } = makeGrow();
    smoothHeight(outer, controller.signal);
    expect(outer.style.height).toBe("");
    expect(outer.hasAttribute("data-growing")).toBe(false);
    expect(FakeResizeObserver.current.observed.size).toBe(1);
  });

  it("does nothing when the first observation equals the seed", () => {
    const { outer, inner } = makeGrow(400, 100);
    smoothHeight(outer, controller.signal);
    FakeResizeObserver.current.deliver([inner, 400, 100]);
    expect(outer.style.height).toBe("");
    expect(outer.hasAttribute("data-growing")).toBe(false);
  });

  it("animates when the seed is smaller than the first observation", () => {
    const { outer, inner } = makeGrow(400, 100);
    const pinned: string[] = [];
    Object.defineProperty(outer, "offsetHeight", {
      get() {
        pinned.push(outer.style.height);
        return 0;
      },
    });
    smoothHeight(outer, controller.signal);
    FakeResizeObserver.current.deliver([inner, 400, 400]);
    // Pinned at the old height before layout was forced, then released.
    expect(pinned).toEqual(["100px"]);
    expect(outer.style.height).toBe("400px");
    expect(outer.hasAttribute("data-growing")).toBe(true);
    expect(outer.style.getPropertyValue("--gmt-grow-duration")).toBe(
      `${growDuration(300, DEFAULT_GROW_MAX_MS)}ms`,
    );
  });

  it("reads the cap from --gmt-grow-max", () => {
    const { outer, inner } = makeGrow(400, 100);
    outer.style.setProperty("--gmt-grow-max", "0.2s");
    smoothHeight(outer, controller.signal);
    FakeResizeObserver.current.deliver([inner, 400, 1100]);
    expect(outer.style.getPropertyValue("--gmt-grow-duration")).toBe("200ms");
  });

  it("snaps on a width change and caches the new size", () => {
    const { outer, inner } = makeGrow(400, 100);
    smoothHeight(outer, controller.signal);
    const ro = FakeResizeObserver.current;
    ro.deliver([inner, 400, 300]);
    expect(outer.hasAttribute("data-growing")).toBe(true);
    vi.stubGlobal("innerWidth", 800); // the window itself was resized
    ro.deliver([inner, 320, 500]);
    expect(outer.style.height).toBe("");
    expect(outer.hasAttribute("data-growing")).toBe(false);
    // The cache is the new size: the same size again is no change.
    ro.deliver([inner, 320, 500]);
    expect(outer.hasAttribute("data-growing")).toBe(false);
  });

  it("retargets mid-flight without resetting to the old height", () => {
    const { outer, inner } = makeGrow(400, 100);
    const pinned: string[] = [];
    Object.defineProperty(outer, "offsetHeight", {
      get() {
        pinned.push(outer.style.height);
        return 0;
      },
    });
    smoothHeight(outer, controller.signal);
    const ro = FakeResizeObserver.current;
    ro.deliver([inner, 400, 300]);
    ro.deliver([inner, 400, 1300]);
    expect(outer.style.height).toBe("1300px");
    expect(outer.hasAttribute("data-growing")).toBe(true);
    // Only the first change pinned the old height; the retarget did not.
    expect(pinned).toEqual(["100px", "300px"]);
    // The new duration is for the distance from where it was (300) to 1300.
    expect(outer.style.getPropertyValue("--gmt-grow-duration")).toBe(
      `${growDuration(1000, DEFAULT_GROW_MAX_MS)}ms`,
    );
  });

  it("eases, not snaps, when only a scrollbar changed the width", () => {
    const { outer, inner } = makeGrow(400, 100);
    smoothHeight(outer, controller.signal);
    // Same viewport, 15 px narrower: the page became scrollable as it filled.
    FakeResizeObserver.current.deliver([inner, 385, 400]);
    expect(outer.hasAttribute("data-growing")).toBe(true);
    expect(outer.style.height).toBe("400px");
  });

  it("retargets boxes already easing with a new one, on one shared budget", () => {
    const a = makeGrow(400, 100);
    const b = makeGrow(400, 100);
    smoothHeight(a.outer, controller.signal);
    smoothHeight(b.outer, controller.signal);
    const ro = FakeResizeObserver.current;
    ro.deliver([a.inner, 400, 400]);
    // A is part-way there when B changes in a later frame.
    a.outer.style.height = "250px";
    const pinned: string[] = [];
    Object.defineProperty(b.outer, "offsetHeight", {
      get() {
        pinned.push(a.outer.style.height);
        return 0;
      },
    });
    ro.deliver([b.inner, 400, 400]);
    // A: 150 px left. B: 300 px. One duration for the 450 px.
    const expected = `${growDuration(450, DEFAULT_GROW_MAX_MS)}ms`;
    expect(a.outer.style.getPropertyValue("--gmt-grow-duration")).toBe(
      expected,
    );
    expect(b.outer.style.getPropertyValue("--gmt-grow-duration")).toBe(
      expected,
    );
    expect(pinned).toEqual(["250px"]);
    expect(a.outer.style.height).toBe("400px");
    expect(b.outer.style.height).toBe("400px");
  });

  it.each(["transitionend", "transitioncancel"] as const)(
    "cleans up on %s from its own height transition",
    (type) => {
      const { outer, inner } = makeGrow(400, 100);
      smoothHeight(outer, controller.signal);
      FakeResizeObserver.current.deliver([inner, 400, 300]);
      expect(outer.hasAttribute("data-growing")).toBe(true);
      endEvent(outer, type);
      expect(outer.style.height).toBe("");
      expect(outer.style.getPropertyValue("--gmt-grow-duration")).toBe("");
      expect(outer.hasAttribute("data-growing")).toBe(false);
    },
  );

  it("ignores an event bubbled up from a nested grow, or another property", () => {
    const { outer, inner } = makeGrow(400, 100);
    const nested = document.createElement("div");
    inner.append(nested);
    smoothHeight(outer, controller.signal);
    FakeResizeObserver.current.deliver([inner, 400, 300]);
    endEvent(nested, "transitionend");
    expect(outer.hasAttribute("data-growing")).toBe(true);
    endEvent(outer, "transitionend", "opacity");
    expect(outer.hasAttribute("data-growing")).toBe(true);
  });

  it("ignores a cancel while a newer height transition is running", () => {
    const { outer, inner } = makeGrow(400, 100);
    outer.getAnimations = (() => [
      { transitionProperty: "height", playState: "running" },
    ]) as unknown as typeof outer.getAnimations;
    smoothHeight(outer, controller.signal);
    FakeResizeObserver.current.deliver([inner, 400, 300]);
    endEvent(outer, "transitioncancel");
    expect(outer.hasAttribute("data-growing")).toBe(true);
  });

  it("cleans up on the timeout fallback when no event fires", () => {
    vi.useFakeTimers();
    const { outer, inner } = makeGrow(400, 100);
    smoothHeight(outer, controller.signal);
    FakeResizeObserver.current.deliver([inner, 400, 300]);
    const duration = growDuration(200, DEFAULT_GROW_MAX_MS);
    vi.advanceTimersByTime(duration + 99);
    expect(outer.hasAttribute("data-growing")).toBe(true);
    vi.advanceTimersByTime(2);
    expect(outer.hasAttribute("data-growing")).toBe(false);
    expect(outer.style.height).toBe("");
  });

  it("detaches on abort: disconnects, drops listeners, cleans up, re-attaches", () => {
    const { outer, inner } = makeGrow(400, 100);
    smoothHeight(outer, controller.signal);
    const ro = FakeResizeObserver.current;
    ro.deliver([inner, 400, 300]);
    controller.abort();
    expect(ro.disconnected).toBe(true);
    expect(outer.style.height).toBe("");
    expect(outer.hasAttribute("data-growing")).toBe(false);

    const second = new AbortController();
    smoothHeight(outer, second.signal);
    expect(FakeResizeObserver.current.observed.has(inner)).toBe(true);
    second.abort();
  });

  it("does not attach twice", () => {
    const { outer } = makeGrow();
    smoothHeight(outer, controller.signal);
    smoothHeight(outer, controller.signal);
    expect(FakeResizeObserver.current.observed.size).toBe(1);
    expect(FakeResizeObserver.instances).toHaveLength(1);
  });

  it("snaps under prefers-reduced-motion, read at each change", () => {
    const { outer, inner } = makeGrow(400, 100);
    smoothHeight(outer, controller.signal);
    const ro = FakeResizeObserver.current;
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    ro.deliver([inner, 400, 300]);
    expect(outer.style.height).toBe("");
    expect(outer.hasAttribute("data-growing")).toBe(false);
    // The preference changed; the next change animates.
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    ro.deliver([inner, 400, 500]);
    expect(outer.hasAttribute("data-growing")).toBe(true);
  });

  it("snaps while a zone combobox list is open", () => {
    const { outer, inner } = makeGrow(400, 100);
    const input = document.createElement("input");
    input.setAttribute("aria-expanded", "true");
    inner.append(input);
    smoothHeight(outer, controller.signal);
    FakeResizeObserver.current.deliver([inner, 400, 300]);
    expect(outer.hasAttribute("data-growing")).toBe(false);
    expect(outer.style.height).toBe("");
  });

  it("snaps when a descendant grow is already animating", () => {
    const { outer, inner } = makeGrow(400, 100);
    const nested = document.createElement("div");
    nested.className = "gmt-grow";
    nested.setAttribute("data-growing", "");
    inner.append(nested);
    smoothHeight(outer, controller.signal);
    FakeResizeObserver.current.deliver([inner, 400, 300]);
    expect(outer.hasAttribute("data-growing")).toBe(false);
  });

  it("gives every box that moves in one frame the duration of the summed distance", () => {
    const a = makeGrow(400, 100);
    const b = makeGrow(400, 100);
    smoothHeight(a.outer, controller.signal);
    smoothHeight(b.outer, controller.signal);
    FakeResizeObserver.current.deliver(
      [a.inner, 400, 400],
      [b.inner, 400, 400],
    );
    const expected = `${growDuration(600, DEFAULT_GROW_MAX_MS)}ms`;
    expect(a.outer.style.getPropertyValue("--gmt-grow-duration")).toBe(
      expected,
    );
    expect(b.outer.style.getPropertyValue("--gmt-grow-duration")).toBe(
      expected,
    );
    // One observer serves both.
    expect(FakeResizeObserver.instances).toHaveLength(1);
  });

  it("animates a slot and snaps the section around it when both change at once", () => {
    const section = makeGrow(400, 100);
    const slotOuter = document.createElement("div");
    slotOuter.className = "gmt-grow gmt-grow-slot";
    const slotInner = document.createElement("div");
    slotOuter.append(slotInner);
    section.inner.append(slotOuter);
    stubRect(slotInner, 400, 20);
    smoothHeight(section.outer, controller.signal);
    smoothHeight(slotOuter, controller.signal);
    // Delivered section-first, as an arbitrary order; the slot is still decided first.
    FakeResizeObserver.current.deliver(
      [section.inner, 400, 300],
      [slotInner, 400, 220],
    );
    expect(slotOuter.hasAttribute("data-growing")).toBe(true);
    expect(slotOuter.style.height).toBe("220px");
    expect(section.outer.hasAttribute("data-growing")).toBe(false);
    expect(section.outer.style.height).toBe("");
  });

  it("changes nothing without ResizeObserver", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    const { outer } = makeGrow();
    smoothHeight(outer, controller.signal);
    expect(FakeResizeObserver.instances).toHaveLength(0);
    expect(outer.style.height).toBe("");
  });

  it("ignores an element with no child", () => {
    const outer = document.createElement("div");
    smoothHeight(outer, controller.signal);
    expect(FakeResizeObserver.instances).toHaveLength(0);
  });
});

describe("smoothHeights", () => {
  function card(html: string): HTMLElement {
    const root = document.createElement("div");
    root.innerHTML = `<div class="gmt-widget"><div class="gmt-widget-card">${html}</div></div>`;
    document.body.append(root);
    return root;
  }
  const THREE = `
    <div class="gmt-widget-section"><h4>1</h4><select data-role="preset"></select></div>
    <div class="gmt-widget-section"><h4>2</h4><output data-role="out"></output><!-- note --></div>
    <div class="gmt-widget-section" data-grow="off"><h4>3</h4></div>
    <div class="gmt-widget-section"><h4>4</h4></div>`;

  it("wraps sections 2 and later, never section 1, and honours data-grow=off", () => {
    const root = card(THREE);
    smoothHeights(root, controller.signal);
    const sections = root.querySelectorAll(".gmt-widget-section");
    expect(sections[0]!.classList.contains("gmt-grow")).toBe(false);
    expect(sections[0]!.querySelector(".gmt-grow-inner")).toBeNull();
    expect(sections[1]!.classList.contains("gmt-grow")).toBe(true);
    expect(sections[2]!.classList.contains("gmt-grow")).toBe(false);
    expect(sections[3]!.classList.contains("gmt-grow")).toBe(true);
    expect(sections[1]!.firstElementChild!.className).toBe("gmt-grow-inner");
    expect(sections[1]!.children).toHaveLength(1);
    expect(FakeResizeObserver.current.observed.size).toBe(2);
  });

  it("keeps node identity and comments", () => {
    const root = card(THREE);
    const out = root.querySelector('[data-role="out"]')!;
    const select = root.querySelector('[data-role="preset"]')!;
    smoothHeights(root, controller.signal);
    expect(root.querySelector('[data-role="out"]')).toBe(out);
    expect(out.parentElement!.className).toBe("gmt-grow-inner");
    expect(root.querySelector('[data-role="preset"]')).toBe(select);
    const inner = root.querySelectorAll(".gmt-grow-inner")[0]!;
    const comments = [...inner.childNodes].filter(
      (n) => n.nodeType === Node.COMMENT_NODE,
    );
    expect(comments).toHaveLength(1);
  });

  it("wraps slots in any section, including section 1, around the slot itself", () => {
    const root = card(`
      <div class="gmt-widget-section"><p data-role="aside" data-grow="slot" class="x" aria-live="polite"></p></div>
      <div class="gmt-widget-section"><p data-role="summary" data-grow="slot"></p></div>`);
    const aside = root.querySelector('[data-role="aside"]')!;
    const summary = root.querySelector('[data-role="summary"]')!;
    smoothHeights(root, controller.signal);
    expect(aside.parentElement!.className).toBe("gmt-grow gmt-grow-slot");
    expect(aside.className).toBe("x");
    expect(aside.getAttribute("aria-live")).toBe("polite");
    // The slot in a wrapped section lands inside the section's inner box.
    expect(summary.parentElement!.classList.contains("gmt-grow-slot")).toBe(
      true,
    );
    expect(summary.parentElement!.parentElement!.className).toBe(
      "gmt-grow-inner",
    );
  });

  it("attaches a static host", () => {
    const root = document.createElement("div");
    root.innerHTML = `<div class="gmt-grow"><div id="scrubber-host"></div></div>`;
    document.body.append(root);
    stubRect(root.querySelector("#scrubber-host")!, 300, 50);
    smoothHeights(root, controller.signal);
    expect(FakeResizeObserver.current.observed.size).toBe(1);
    expect(root.querySelector(".gmt-grow")!.firstElementChild!.id).toBe(
      "scrubber-host",
    );
  });

  it("is idempotent", () => {
    const root = card(
      THREE +
        `<p data-grow="slot" data-role="aside"></p>` +
        `<div class="gmt-grow"><i></i></div>`,
    );
    smoothHeights(root, controller.signal);
    const html = root.innerHTML;
    const watched = FakeResizeObserver.current.observed.size;
    smoothHeights(root, controller.signal);
    expect(root.innerHTML).toBe(html);
    expect(FakeResizeObserver.current.observed.size).toBe(watched);
    expect(FakeResizeObserver.instances).toHaveLength(1);
  });

  it("wraps nothing without ResizeObserver", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    const root = card(THREE + `<p data-grow="slot"></p>`);
    const html = root.innerHTML;
    smoothHeights(root, controller.signal);
    expect(root.innerHTML).toBe(html);
  });
});
