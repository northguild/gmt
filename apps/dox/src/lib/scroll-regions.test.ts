// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// jsdom has no layout and no ResizeObserver: each box's size is set by hand, and a stand-in
// observer records what is watched so a test can report a resize.
const watched = new Set<Element>();
let report: (targets: Element[]) => void = () => {};

beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: (entries: { target: Element }[]) => void) {
        report = (targets) => callback(targets.map((target) => ({ target })));
      }
      observe(el: Element) {
        watched.add(el);
      }
      unobserve(el: Element) {
        watched.delete(el);
      }
      disconnect() {}
    },
  );
});

afterEach(() => {
  document.body.innerHTML = "";
});

const { mountScrollRegions } = await import("./scroll-regions");

/** Gives `el` a content size against a 100 × 100 box. */
function size(el: Element, width: number, height = 50): void {
  const props = {
    scrollWidth: width,
    clientWidth: 100,
    scrollHeight: height,
    clientHeight: 100,
  };
  for (const [name, value] of Object.entries(props)) {
    Object.defineProperty(el, name, { configurable: true, get: () => value });
  }
}

function mount(html: string, width: number, height?: number): HTMLElement {
  document.body.innerHTML = html;
  const box = document.querySelector<HTMLElement>("pre, table")!;
  size(box, width, height);
  mountScrollRegions(document);
  return box;
}

/** MutationObserver callbacks run as a microtask. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("mountScrollRegions", () => {
  it("makes a code block that overflows a named, focusable region", () => {
    const pre = mount("<pre><code>x</code></pre>", 300);
    expect(pre.getAttribute("tabindex")).toBe("0");
    expect(pre.getAttribute("role")).toBe("region");
    expect(pre.getAttribute("aria-label")).toBe("Code, scrolls sideways");
    expect(pre.dataset.scrollRegion).toBe("tabindex role aria-label");
  });

  it("leaves a box that fits alone", () => {
    const pre = mount("<pre><code>x</code></pre>", 100);
    expect(pre.hasAttribute("tabindex")).toBe(false);
    expect(pre.hasAttribute("role")).toBe(false);
    expect("scrollRegion" in pre.dataset).toBe(false);
  });

  it("says which way it scrolls", () => {
    expect(mount("<pre>x</pre>", 100, 300).getAttribute("aria-label")).toBe(
      "Code, scrolls up and down",
    );
    expect(mount("<pre>x</pre>", 300, 300).getAttribute("aria-label")).toBe(
      "Code, scrolls in both directions",
    );
  });

  it("keeps a table's own role, and names it only when it has no name", () => {
    const table = mount("<table><tr><td>x</td></tr></table>", 300);
    expect(table.hasAttribute("role")).toBe(false);
    expect(table.getAttribute("tabindex")).toBe("0");
    expect(table.getAttribute("aria-label")).toBe("Scrolls sideways");

    const captioned = mount(
      "<table><caption>Offsets</caption><tr><td>x</td></tr></table>",
      300,
    );
    expect(captioned.hasAttribute("role")).toBe(false);
    expect(captioned.hasAttribute("aria-label")).toBe(false);
    expect(captioned.dataset.scrollRegion).toBe("tabindex");
  });

  it("removes only what it added when the box fits again", () => {
    const pre = mount('<pre aria-label="Example" tabindex="-1">x</pre>', 300);
    expect(pre.getAttribute("aria-label")).toBe("Example");
    expect(pre.getAttribute("tabindex")).toBe("-1");
    expect(pre.dataset.scrollRegion).toBe("role");

    size(pre, 100);
    report([pre]);
    expect(pre.getAttribute("aria-label")).toBe("Example");
    expect(pre.getAttribute("tabindex")).toBe("-1");
    expect(pre.hasAttribute("role")).toBe(false);
    expect("scrollRegion" in pre.dataset).toBe(false);
  });

  it("re-reads a box when its content resizes, and relabels it", () => {
    const pre = mount("<pre><code>x</code></pre>", 300);
    const code = pre.querySelector("code")!;
    expect(watched.has(code)).toBe(true);
    size(pre, 300, 300);
    report([code]);
    expect(pre.getAttribute("aria-label")).toBe(
      "Code, scrolls in both directions",
    );
  });

  it("wires a table a widget renders after the mount", async () => {
    document.body.innerHTML = '<div class="gmt-widget"></div>';
    mountScrollRegions(document);
    const widget = document.querySelector(".gmt-widget")!;
    widget.innerHTML = "<table><tr><td>x</td></tr></table>";
    const table = widget.querySelector("table")!;
    size(table, 300);
    await settle();
    expect(table.getAttribute("tabindex")).toBe("0");
    expect(watched.has(table)).toBe(true);

    // A re-render replaces it: the old one is let go, the new one wired.
    widget.innerHTML = "<table><tr><td>y</td></tr></table>";
    const next = widget.querySelector("table")!;
    size(next, 300);
    await settle();
    expect(watched.has(table)).toBe(false);
    expect(watched.has(next)).toBe(true);
    expect(next.getAttribute("tabindex")).toBe("0");
  });

  it("re-reads a wired box whose content is replaced", async () => {
    const pre = mount("<pre><code>x</code></pre>", 100);
    expect(pre.hasAttribute("tabindex")).toBe(false);
    pre.innerHTML = "<code>a much longer line</code>";
    size(pre, 300);
    await settle();
    expect(pre.getAttribute("tabindex")).toBe("0");
    expect(watched.has(pre.querySelector("code")!)).toBe(true);
  });

  it("is safe to call twice", () => {
    const pre = mount("<pre>x</pre>", 300);
    mountScrollRegions(document);
    expect(pre.dataset.scrollRegion).toBe("tabindex role aria-label");
  });
});
