/**
 * @vitest-environment jsdom
 */
import {
  spyOnResizeObservers,
  type ResizeObserverSpy,
} from "../test/resize-observer-spy";
import { mountRefTables } from "./ref-table";

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

describe("mountRefTables", () => {
  let spy: ResizeObserverSpy;

  beforeEach(() => {
    spy = spyOnResizeObservers();
  });
  afterEach(() => spy.restore());

  it("names an overflowing box by its data-label", () => {
    document.body.innerHTML = `<h2>Ignored heading</h2><div class="gmt-ref-table" data-kind="content" data-label="Bundle size per import"><table></table></div>`;
    const box = document.querySelector<HTMLElement>(".gmt-ref-table")!;
    size(box, 900, 600);
    mountRefTables(document);
    expect(box.getAttribute("role")).toBe("region");
    expect(box.getAttribute("tabindex")).toBe("0");
    expect(box.getAttribute("aria-label")).toBe(
      "Bundle size per import, table, scrolls sideways",
    );
  });

  it("names a box with no data-label by the heading above it", () => {
    document.body.innerHTML = `<h3>Foo</h3><div class="gmt-ref-table" data-kind="members"><table></table></div>`;
    const box = document.querySelector<HTMLElement>(".gmt-ref-table")!;
    size(box, 900, 600);
    mountRefTables(document);
    expect(box.getAttribute("aria-label")).toBe(
      "Members of Foo, table, scrolls sideways",
    );
  });

  it("gives a box that fits no tab stop, role or name", () => {
    document.body.innerHTML = `<div class="gmt-ref-table" data-kind="content" data-label="Bugs GMT works around"><table></table></div>`;
    const box = document.querySelector<HTMLElement>(".gmt-ref-table")!;
    size(box, 600, 600);
    mountRefTables(document);
    expect(box.hasAttribute("tabindex")).toBe(false);
    expect(box.hasAttribute("role")).toBe(false);
    expect(box.hasAttribute("aria-label")).toBe(false);
  });
});
