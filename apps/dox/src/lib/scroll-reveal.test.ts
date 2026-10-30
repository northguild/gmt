/**
 * @vitest-environment jsdom
 *
 * What a reader sees (hidden until scrolled to, the stagger) is paint, which the browser gates
 * check on the built pages. This test covers the observer wiring.
 */

import { initScrollReveal } from "./scroll-reveal";

type Callback = (entries: Array<Partial<IntersectionObserverEntry>>) => void;

const observed: Element[] = [];
const unobserved: Element[] = [];
let callback: Callback | undefined;
let created = 0;

class FakeIntersectionObserver {
  constructor(cb: Callback) {
    callback = cb;
    created += 1;
  }
  observe(el: Element): void {
    observed.push(el);
  }
  unobserve(el: Element): void {
    unobserved.push(el);
  }
  disconnect(): void {}
}

function addGroups(count: number): HTMLElement[] {
  document.body.replaceChildren();
  return Array.from({ length: count }, (_, i) => {
    const list = document.createElement("ul");
    list.setAttribute("data-reveal-group", "");
    list.setAttribute("aria-label", `group ${i + 1}`);
    list.append(document.createElement("li"), document.createElement("li"));
    document.body.append(list);
    return list;
  });
}

beforeEach(() => {
  observed.length = 0;
  unobserved.length = 0;
  callback = undefined;
  created = 0;
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("initScrollReveal", () => {
  it("watches every reveal group with one observer", () => {
    const groups = addGroups(2);
    initScrollReveal();
    expect(created).toBe(1);
    expect(observed).toEqual(groups);
  });

  it("creates no observer when the page has no group", () => {
    addGroups(0);
    initScrollReveal();
    expect(created).toBe(0);
  });

  it("stops watching a group once it has scrolled into view, and only then", () => {
    const [first, second] = addGroups(2);
    initScrollReveal();
    callback?.([
      { target: first, isIntersecting: true },
      { target: second, isIntersecting: false },
    ]);
    expect(unobserved).toEqual([first]);
  });

  it("watches nothing under reduced motion", () => {
    addGroups(2);
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    initScrollReveal();
    expect(created).toBe(0);
  });

  it("watches nothing without IntersectionObserver", () => {
    addGroups(2);
    vi.stubGlobal("IntersectionObserver", undefined);
    delete (window as { IntersectionObserver?: unknown }).IntersectionObserver;
    initScrollReveal();
    expect(created).toBe(0);
  });
});
