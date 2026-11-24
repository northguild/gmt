/** @vitest-environment jsdom */
import { drawnScale } from "./drawn-scale";

function box(
  layout: { w: number; h: number },
  drawn: { w: number; h: number },
) {
  const el = document.createElement("div");
  Object.defineProperty(el, "offsetWidth", { value: layout.w });
  Object.defineProperty(el, "offsetHeight", { value: layout.h });
  el.getBoundingClientRect = () =>
    ({ width: drawn.w, height: drawn.h }) as DOMRect;
  return el;
}

describe("how much a transform scales a box as drawn", () => {
  it("is the drawn size over the layout size, across or down", () => {
    const el = box({ w: 1280, h: 720 }, { w: 640, h: 360 });
    expect(drawnScale(el)).toBe(0.5);
    expect(drawnScale(el, "block")).toBe(0.5);
  });

  it("is 1 within 1% of 1, where the layout size is only rounded", () => {
    expect(drawnScale(box({ w: 1000, h: 10 }, { w: 1004, h: 10 }))).toBe(1);
  });

  it("is 1 for a box with no size", () => {
    expect(drawnScale(box({ w: 0, h: 0 }, { w: 0, h: 0 }))).toBe(1);
    expect(drawnScale(box({ w: 0, h: 100 }, { w: 0, h: 50 }), "block")).toBe(
      0.5,
    );
  });
});
