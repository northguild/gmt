/**
 * @vitest-environment jsdom
 */
import {
  spyOnResizeObservers,
  type ResizeObserverSpy,
} from "../test/resize-observer-spy";
import { mountOverflowFocus } from "./overflow-focus";

/** jsdom does no layout, so a test states the two widths the browser would report. */
const size = (
  el: HTMLElement,
  scrollWidth: number,
  clientWidth: number,
): void => {
  Object.defineProperty(el, "scrollWidth", {
    configurable: true,
    value: scrollWidth,
  });
  Object.defineProperty(el, "clientWidth", {
    configurable: true,
    value: clientWidth,
  });
};

describe("mountOverflowFocus", () => {
  let spy: ResizeObserverSpy;
  let region: HTMLElement;

  beforeEach(() => {
    spy = spyOnResizeObservers();
    document.body.innerHTML = `<div class="scroll" tabindex="0" role="region" aria-label="Bugs"><table></table></div>`;
    region = document.querySelector<HTMLElement>(".scroll")!;
  });
  afterEach(() => spy.restore());

  it("removes the tab stop from a region that fits, and keeps its role and name", () => {
    size(region, 500, 500);
    mountOverflowFocus(document, ".scroll");
    expect(region.hasAttribute("tabindex")).toBe(false);
    expect(region.getAttribute("role")).toBe("region");
    expect(region.getAttribute("aria-label")).toBe("Bugs");
  });

  it("keeps the tab stop on a region that overflows", () => {
    size(region, 640, 343);
    mountOverflowFocus(document, ".scroll");
    expect(region.getAttribute("tabindex")).toBe("0");
  });

  it("ignores the sub-pixel overflow layout rounding produces", () => {
    size(region, 500.6, 500);
    mountOverflowFocus(document, ".scroll");
    expect(region.hasAttribute("tabindex")).toBe(false);
  });

  it("follows the width: restores the tab stop when the region starts to overflow, and drops it again", () => {
    size(region, 500, 500);
    mountOverflowFocus(document, ".scroll");
    expect(region.hasAttribute("tabindex")).toBe(false);

    size(region, 640, 343);
    spy.fire();
    expect(region.getAttribute("tabindex")).toBe("0");

    size(region, 640, 900);
    spy.fire();
    expect(region.hasAttribute("tabindex")).toBe(false);
  });

  it("leaves the tab stop in place where there is no ResizeObserver to follow", () => {
    spy.restore();
    vi.stubGlobal("ResizeObserver", undefined);
    size(region, 500, 500);
    mountOverflowFocus(document, ".scroll");
    expect(region.getAttribute("tabindex")).toBe("0");
  });

  it("stops observing when the returned function is called", () => {
    size(region, 500, 500);
    const stop = mountOverflowFocus(document, ".scroll");
    expect(spy.live.size).toBeGreaterThan(0);
    stop();
    expect(spy.live.size).toBe(0);
  });
});
