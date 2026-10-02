/**
 * @vitest-environment jsdom
 *
 * `smoothHeight` / `smoothHeights`: the contract is in the file header of
 * smooth-height.ts. jsdom has no layout, no ResizeObserver and no frames, so a
 * hand-driven fake observer delivers batches, `offsetWidth` / `offsetHeight` say
 * what layout would, and a manual clock runs the frame loop one frame at a time.
 */
/// <reference types="vitest/globals" />

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EXPLAIN_TOLERANCE_PX,
  FOLLOW_TAU_MS,
  MAX_GROW_MS,
  SETTLE_PX,
  STEP_BUDGET_PX,
  budgetScale,
  followFraction,
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
  /** Delivers one batch, as the browser does after layout. A target given
   *  with a size is set to that size first; one given alone keeps its own. */
  deliver(...targets: ([Element] | [Element, number, number])[]): void {
    this.cb(
      targets.map((t) => {
        const [target, w, h] = t;
        if (w !== undefined && h !== undefined) setSize(target, w, h);
        const width = (target as HTMLElement).offsetWidth;
        const height = (target as HTMLElement).offsetHeight;
        return {
          target,
          borderBoxSize: [{ inlineSize: width, blockSize: height }],
          contentRect: { width, height },
        } as unknown as ResizeObserverEntry;
      }),
      this as unknown as ResizeObserver,
    );
  }
  static get current(): FakeResizeObserver {
    return FakeResizeObserver.instances[
      FakeResizeObserver.instances.length - 1
    ]!;
  }
}

/** Layout says this element is `w` x `h`. */
function setSize(el: Element, w: number, h: number): void {
  Object.defineProperty(el, "offsetWidth", { configurable: true, value: w });
  Object.defineProperty(el, "offsetHeight", { configurable: true, value: h });
}

/** An outer with one inner; the inner's seed size is `w` x `h`. */
function makeGrow(w = 400, h = 100) {
  const outer = document.createElement("div");
  outer.className = "gmt-grow";
  const inner = document.createElement("div");
  inner.className = "gmt-grow-inner";
  outer.append(inner);
  document.body.append(outer);
  setSize(inner, w, h);
  return { outer, inner };
}

/** The manual frame clock. `frame()` runs the queued frame callback at the
 *  next `ms`; nothing runs between calls. */
let clock = 0;
let queued: ((at: number) => void) | undefined;

function frame(ms = 1000 / 60): void {
  clock += ms;
  const cb = queued;
  queued = undefined;
  cb?.(clock);
}

/** Runs frames until the loop stops, or fails after `max` of them. */
function runToRest(max = 400): number {
  let n = 0;
  while (queued && n < max) {
    frame();
    n += 1;
  }
  expect(queued).toBeUndefined();
  return n;
}

const px = (el: HTMLElement) => parseFloat(el.style.height);
const moving = (el: Element) => el.hasAttribute("data-growing");

let controller: AbortController;

beforeEach(() => {
  FakeResizeObserver.instances = [];
  clock = 1000;
  queued = undefined;
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  vi.stubGlobal("performance", { now: () => clock });
  vi.stubGlobal("requestAnimationFrame", (cb: (at: number) => void) => {
    queued = cb;
    return 1;
  });
  controller = new AbortController();
});

afterEach(() => {
  controller.abort();
  // A frame the test left queued still runs in a browser, and clears the
  // loop's "a frame is scheduled" flag; run it so the next test starts clean.
  const pending = queued;
  queued = undefined;
  pending?.(clock);
  if (vi.isFakeTimers()) vi.runAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe("followFraction", () => {
  it("is the share of the remaining distance a frame covers", () => {
    expect(followFraction(0)).toBe(0);
    expect(followFraction(1000 / 60)).toBeCloseTo(
      1 - Math.exp(-1000 / 60 / FOLLOW_TAU_MS),
    );
    expect(followFraction(1000 / 60)).toBeGreaterThan(0.2);
    expect(followFraction(1000 / 60)).toBeLessThan(0.4);
  });

  it("grows with the frame, but a stall counts for no more than 100 ms", () => {
    expect(followFraction(33)).toBeGreaterThan(followFraction(16));
    expect(followFraction(100)).toBe(followFraction(5000));
    expect(followFraction(100)).toBeLessThan(1);
  });

  it("falls back to one 60 Hz frame for a non-finite frame time", () => {
    expect(followFraction(Number.NaN)).toBeCloseTo(followFraction(1000 / 60));
  });
});

describe("budgetScale", () => {
  it("leaves a total within the budget alone", () => {
    expect(budgetScale(0, 40)).toBe(1);
    expect(budgetScale(40, 40)).toBe(1);
    expect(budgetScale(-12, 40)).toBe(1);
  });

  it("scales a total over the budget down to it", () => {
    expect(budgetScale(80, 40)).toBeCloseTo(0.5);
    expect(budgetScale(-160, 40)).toBeCloseTo(0.25);
  });

  it("keeps the budget under the 48 px page gate with room to spare", () => {
    expect(STEP_BUDGET_PX).toBeLessThan(48);
    expect(48 - STEP_BUDGET_PX).toBeGreaterThanOrEqual(EXPLAIN_TOLERANCE_PX);
  });
});

describe("smoothHeight", () => {
  it("does not animate at attach", () => {
    const { outer } = makeGrow();
    smoothHeight(outer, controller.signal);
    expect(outer.style.height).toBe("");
    expect(moving(outer)).toBe(false);
    expect(FakeResizeObserver.current.observed.size).toBe(1);
    expect(queued).toBeUndefined();
  });

  it("does nothing when the first observation equals the seed", () => {
    const { outer, inner } = makeGrow(400, 100);
    smoothHeight(outer, controller.signal);
    FakeResizeObserver.current.deliver([inner, 400, 100]);
    expect(outer.style.height).toBe("");
    expect(moving(outer)).toBe(false);
    expect(queued).toBeUndefined();
  });

  it("pins at the old height when the seed is smaller than the first observation", () => {
    const { outer, inner } = makeGrow(400, 100);
    smoothHeight(outer, controller.signal);
    FakeResizeObserver.current.deliver([inner, 400, 400]);
    // Nothing is painted taller than before: the new height is revealed by the loop.
    expect(outer.style.height).toBe("100px");
    expect(moving(outer)).toBe(true);
    expect(queued).toBeDefined();
  });

  it("walks to the new height and puts the outer back to auto", () => {
    const { outer, inner } = makeGrow(400, 100);
    smoothHeight(outer, controller.signal);
    FakeResizeObserver.current.deliver([inner, 400, 400]);
    let last = px(outer);
    let frames = 0;
    while (queued) {
      frame();
      frames += 1;
      if (moving(outer)) {
        expect(px(outer)).toBeGreaterThanOrEqual(last);
        expect(px(outer)).toBeLessThanOrEqual(400);
        last = px(outer);
      }
      expect(frames).toBeLessThan(200);
    }
    expect(outer.style.height).toBe("");
    expect(moving(outer)).toBe(false);
    expect(frames).toBeGreaterThan(5);
  });

  it("moves a small change in a few frames and a large one at the budget", () => {
    const small = makeGrow(400, 100);
    smoothHeight(small.outer, controller.signal);
    FakeResizeObserver.current.deliver([small.inner, 400, 120]);
    const smallFrames = runToRest();
    expect(smallFrames).toBeLessThan(25);

    const big = makeGrow(400, 100);
    smoothHeight(big.outer, controller.signal);
    FakeResizeObserver.current.deliver([big.inner, 400, 1100]);
    frame();
    expect(px(big.outer) - 100).toBeCloseTo(STEP_BUDGET_PX);
    frame();
    expect(px(big.outer) - 100).toBeCloseTo(2 * STEP_BUDGET_PX);
  });

  it("never moves more than the budget in a frame, however late the frame is", () => {
    const { outer, inner } = makeGrow(400, 100);
    smoothHeight(outer, controller.signal);
    FakeResizeObserver.current.deliver([inner, 400, 1500]);
    let before = px(outer);
    const lates = [16.7, 33.4, 100, 250, 1000, 16.7, 50];
    for (const ms of lates) {
      frame(ms);
      expect(px(outer) - before).toBeLessThanOrEqual(STEP_BUDGET_PX + 1e-6);
      expect(px(outer) - before).toBeGreaterThan(0);
      before = px(outer);
    }
    // A late frame moves it further than an on-time one, up to the budget.
    runToRest(800);
    expect(outer.style.height).toBe("");
  });

  it("shrinks the same way it grows, within the same budget", () => {
    const { outer, inner } = makeGrow(400, 900);
    smoothHeight(outer, controller.signal);
    FakeResizeObserver.current.deliver([inner, 400, 100]);
    expect(outer.style.height).toBe("900px");
    frame();
    expect(900 - px(outer)).toBeCloseTo(STEP_BUDGET_PX);
    runToRest(800);
    expect(outer.style.height).toBe("");
  });

  it("counts the child's vertical margins, so releasing to auto does not jump by them", () => {
    const { outer, inner } = makeGrow(400, 100);
    inner.style.marginTop = "24px";
    inner.style.marginBottom = "24px";
    smoothHeight(outer, controller.signal);
    // The seed is 100 + 48. A 300 px child is 348 px of outer.
    FakeResizeObserver.current.deliver([inner, 400, 300]);
    expect(outer.style.height).toBe("148px");
    while (queued) {
      frame();
      expect(px(outer) || 348).toBeLessThanOrEqual(348);
    }
    // Released exactly where `auto` puts it: no step at the end.
    expect(outer.style.height).toBe("");
  });

  it("snaps on a width change with a new viewport and caches the new size", () => {
    const { outer, inner } = makeGrow(400, 100);
    smoothHeight(outer, controller.signal);
    const ro = FakeResizeObserver.current;
    ro.deliver([inner, 400, 300]);
    expect(moving(outer)).toBe(true);
    vi.stubGlobal("innerWidth", 800); // the window itself was resized
    ro.deliver([inner, 320, 500]);
    expect(outer.style.height).toBe("");
    expect(moving(outer)).toBe(false);
    // The cache is the new size: the same size again is no change.
    ro.deliver([inner, 320, 500]);
    expect(moving(outer)).toBe(false);
  });

  it("eases, not snaps, when only a scrollbar changed the width", () => {
    const { outer, inner } = makeGrow(400, 100);
    smoothHeight(outer, controller.signal);
    // Same viewport, 15 px narrower: the page became scrollable as it filled.
    FakeResizeObserver.current.deliver([inner, 385, 400]);
    expect(moving(outer)).toBe(true);
    expect(outer.style.height).toBe("100px");
  });

  it("retargets mid-flight from where it is, not from the old height", () => {
    const { outer, inner } = makeGrow(400, 100);
    smoothHeight(outer, controller.signal);
    const ro = FakeResizeObserver.current;
    ro.deliver([inner, 400, 600]);
    frame();
    frame();
    const here = px(outer);
    expect(here).toBeGreaterThan(100);
    ro.deliver([inner, 400, 1300]);
    // The retarget changes where it is heading, not where it is.
    expect(px(outer)).toBe(here);
    expect(moving(outer)).toBe(true);
    frame();
    expect(px(outer) - here).toBeCloseTo(STEP_BUDGET_PX);
    runToRest(800);
    expect(outer.style.height).toBe("");
  });

  it("holds every box in motion to one budget, and keeps them in proportion", () => {
    const a = makeGrow(400, 100);
    const b = makeGrow(400, 100);
    smoothHeight(a.outer, controller.signal);
    smoothHeight(b.outer, controller.signal);
    // A has 900 px to go, B has 300: both want more than the budget together.
    FakeResizeObserver.current.deliver(
      [a.inner, 400, 1000],
      [b.inner, 400, 400],
    );
    frame();
    const stepA = px(a.outer) - 100;
    const stepB = px(b.outer) - 100;
    expect(stepA + stepB).toBeCloseTo(STEP_BUDGET_PX);
    expect(stepA / stepB).toBeCloseTo(3);
    expect(FakeResizeObserver.instances).toHaveLength(1);
  });

  it("shares the budget with a box that starts later", () => {
    const a = makeGrow(400, 100);
    const b = makeGrow(400, 100);
    smoothHeight(a.outer, controller.signal);
    smoothHeight(b.outer, controller.signal);
    const ro = FakeResizeObserver.current;
    ro.deliver([a.inner, 400, 1100]);
    frame();
    frame();
    const aBefore = px(a.outer);
    ro.deliver([b.inner, 400, 1100]);
    frame();
    const stepA = px(a.outer) - aBefore;
    const stepB = px(b.outer) - 100;
    expect(stepA).toBeGreaterThan(0);
    expect(stepB).toBeGreaterThan(0);
    expect(stepA + stepB).toBeLessThanOrEqual(STEP_BUDGET_PX + 1e-6);
  });

  it("releases a box that has settled within a pixel of its target", () => {
    const { outer, inner } = makeGrow(400, 100);
    smoothHeight(outer, controller.signal);
    FakeResizeObserver.current.deliver([inner, 400, 100 + SETTLE_PX * 4]);
    runToRest();
    expect(outer.style.height).toBe("");
    expect(moving(outer)).toBe(false);
  });

  it("releases a box still pinned after the safety limit", () => {
    const { outer, inner } = makeGrow(400, 100);
    smoothHeight(outer, controller.signal);
    FakeResizeObserver.current.deliver([inner, 400, 5000]);
    frame();
    expect(moving(outer)).toBe(true);
    frame(MAX_GROW_MS + 10);
    expect(moving(outer)).toBe(false);
    expect(outer.style.height).toBe("");
  });

  it("detaches on abort: disconnects, cleans up, stops, re-attaches", () => {
    const { outer, inner } = makeGrow(400, 100);
    smoothHeight(outer, controller.signal);
    const ro = FakeResizeObserver.current;
    ro.deliver([inner, 400, 300]);
    controller.abort();
    expect(ro.disconnected).toBe(true);
    expect(outer.style.height).toBe("");
    expect(moving(outer)).toBe(false);
    // The frame that was already queued finds nothing to move.
    frame();
    expect(outer.style.height).toBe("");
    expect(queued).toBeUndefined();

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
    expect(moving(outer)).toBe(false);
    expect(queued).toBeUndefined();
    // The preference changed; the next change animates.
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    ro.deliver([inner, 400, 500]);
    expect(moving(outer)).toBe(true);
  });

  it("snaps while the page is hidden, where no frame would run", () => {
    const { outer, inner } = makeGrow(400, 100);
    smoothHeight(outer, controller.signal);
    vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    FakeResizeObserver.current.deliver([inner, 400, 300]);
    expect(moving(outer)).toBe(false);
    expect(outer.style.height).toBe("");
    vi.restoreAllMocks();
  });

  it("snaps while a zone combobox list is open", () => {
    const { outer, inner } = makeGrow(400, 100);
    const input = document.createElement("input");
    input.setAttribute("aria-expanded", "true");
    inner.append(input);
    smoothHeight(outer, controller.signal);
    FakeResizeObserver.current.deliver([inner, 400, 300]);
    expect(moving(outer)).toBe(false);
    expect(outer.style.height).toBe("");
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

  it("falls back to a timer where there is no requestAnimationFrame", () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", undefined);
    const { outer, inner } = makeGrow(400, 100);
    smoothHeight(outer, controller.signal);
    FakeResizeObserver.current.deliver([inner, 400, 160]);
    expect(moving(outer)).toBe(true);
    vi.advanceTimersByTime(2000);
    expect(moving(outer)).toBe(false);
  });
});

describe("a box inside a box", () => {
  /** A section holding a slot. The section's height is what layout would give:
   *  its other content, plus the slot at whatever height is pinned on it. */
  function sectionWithSlot(other: { px: number }, slotFull: number) {
    const section = makeGrow(400, 0);
    const slotOuter = document.createElement("div");
    slotOuter.className = "gmt-grow gmt-grow-slot";
    const slotInner = document.createElement("div");
    slotOuter.append(slotInner);
    section.inner.append(slotOuter);
    const slotHeight = () =>
      slotOuter.style.height ? parseFloat(slotOuter.style.height) : slotFull;
    Object.defineProperty(section.inner, "offsetHeight", {
      configurable: true,
      get: () => other.px + slotHeight(),
    });
    setSize(slotInner, 400, slotFull);
    return {
      ...section,
      slotOuter,
      slotInner,
      setSlotFull: (n: number) => {
        slotFull = n;
        setSize(slotInner, 400, n);
      },
    };
  }

  it("eases the change the slot does not account for, and does not pop it", () => {
    const other = { px: 100 };
    const g = sectionWithSlot(other, 20);
    smoothHeight(g.outer, controller.signal);
    smoothHeight(g.slotOuter, controller.signal);
    // One frame: the section gains 300 px of ordinary content and the slot
    // gains 180 px. Delivered section first; the slot is still decided first.
    other.px = 400;
    g.setSlotFull(200);
    FakeResizeObserver.current.deliver([g.inner], [g.slotInner]);
    // The slot is pinned where it was; the section is pinned at what it was,
    // not snapped to its new height (400 + 200 = 600).
    expect(g.slotOuter.style.height).toBe("20px");
    expect(moving(g.slotOuter)).toBe(true);
    expect(moving(g.outer)).toBe(true);
    expect(g.outer.style.height).toBe("120px");
    frame();
    expect(px(g.outer) - 120).toBeGreaterThan(0);
    // Only the outermost box moves the page, so only it spends the budget.
    expect(px(g.outer) - 120).toBeLessThanOrEqual(STEP_BUDGET_PX + 1e-6);
  });

  it("follows a slot that is the only thing changing, without moving itself", () => {
    const other = { px: 100 };
    const g = sectionWithSlot(other, 20);
    smoothHeight(g.outer, controller.signal);
    smoothHeight(g.slotOuter, controller.signal);
    // The slot's content grows: the slot eases, and the section is the same
    // height it will be, so it only follows.
    g.setSlotFull(200);
    FakeResizeObserver.current.deliver([g.inner], [g.slotInner]);
    expect(moving(g.slotOuter)).toBe(true);
    expect(moving(g.outer)).toBe(false);
    expect(g.outer.style.height).toBe("");
    // Each frame the slot steps, the section's height changes by that step and
    // is still only following.
    for (let i = 0; i < 4; i++) {
      frame();
      FakeResizeObserver.current.deliver([g.inner]);
      expect(moving(g.outer)).toBe(false);
    }
    expect(px(g.slotOuter)).toBeGreaterThan(20);
  });

  it("lets a moving section keep moving when a slot inside it starts to ease", () => {
    const other = { px: 100 };
    const g = sectionWithSlot(other, 20);
    smoothHeight(g.outer, controller.signal);
    smoothHeight(g.slotOuter, controller.signal);
    const ro = FakeResizeObserver.current;
    other.px = 700;
    ro.deliver([g.inner]);
    expect(moving(g.outer)).toBe(true);
    frame();
    const here = px(g.outer);
    g.setSlotFull(120);
    ro.deliver([g.inner], [g.slotInner]);
    // No snap: the section is where it was and now heads for the new height.
    expect(moving(g.outer)).toBe(true);
    expect(px(g.outer)).toBe(here);
  });

  it("spends the budget once for a slot inside a moving section", () => {
    const other = { px: 100 };
    const g = sectionWithSlot(other, 20);
    smoothHeight(g.outer, controller.signal);
    smoothHeight(g.slotOuter, controller.signal);
    other.px = 900;
    g.setSlotFull(220);
    FakeResizeObserver.current.deliver([g.inner], [g.slotInner]);
    frame();
    const section = px(g.outer) - 120;
    expect(section).toBeCloseTo(STEP_BUDGET_PX);
    // The slot is scaled by the same factor as the section, so the pair stay in step.
    expect(px(g.slotOuter) - 20).toBeGreaterThan(0);
    expect(px(g.slotOuter) - 20).toBeLessThan(STEP_BUDGET_PX);
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
    setSize(root.querySelector("#scrubber-host") as HTMLElement, 300, 50);
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
