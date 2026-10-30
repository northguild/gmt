/**
 * @vitest-environment jsdom
 */
import { screen } from "@testing-library/dom";
import {
  spyOnResizeObservers,
  type ResizeObserverSpy,
} from "../test/resize-observer-spy";
import { mountRefTables } from "./ref-table";
import { BOX_CLASS } from "./rehype-table-scroll";

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

/** A scroll box as the build writes it, after an optional heading. */
function box(
  attrs: Record<string, string>,
  heading?: { tag: string; text: string },
): HTMLElement {
  document.body.replaceChildren();
  if (heading) {
    const h = document.createElement(heading.tag);
    h.textContent = heading.text;
    document.body.append(h);
  }
  const el = document.createElement("div");
  el.setAttribute("class", BOX_CLASS);
  for (const [name, value] of Object.entries(attrs)) {
    el.setAttribute(name, value);
  }
  el.append(document.createElement("table"));
  document.body.append(el);
  return el;
}

const HINT = "Scroll sideways to see every column";

describe("mountRefTables", () => {
  let spy: ResizeObserverSpy;

  beforeEach(() => {
    spy = spyOnResizeObservers();
  });
  afterEach(() => spy.restore());

  it("names an overflowing box by its label and makes it a focus stop", () => {
    const el = box(
      { "data-kind": "content", "data-label": "Bundle size per import" },
      { tag: "h2", text: "Ignored heading" },
    );
    size(el, 900, 600);
    mountRefTables(document);
    const region = screen.getByRole("region", {
      name: "Bundle size per import, table, scrolls sideways",
    });
    expect(region).toHaveAttribute("tabindex", "0");
    expect(screen.getByText(HINT)).toBeInTheDocument();
  });

  it("names a box with no label by the heading above it", () => {
    const el = box({ "data-kind": "members" }, { tag: "h3", text: "Foo" });
    size(el, 900, 600);
    mountRefTables(document);
    expect(
      screen.getByRole("region", {
        name: "Members of Foo, table, scrolls sideways",
      }),
    ).toBeInTheDocument();
  });

  it("gives a box that fits no tab stop, region or hint", () => {
    const el = box({
      "data-kind": "content",
      "data-label": "Bugs worked around",
    });
    size(el, 600, 600);
    mountRefTables(document);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(el).not.toHaveAttribute("tabindex");
    expect(screen.queryByText(HINT)).not.toBeInTheDocument();
  });
});
