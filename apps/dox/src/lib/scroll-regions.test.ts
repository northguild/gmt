// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// jsdom has no layout and no ResizeObserver: each box's size is set by hand, and a stand-in
// observer lets a test report a resize.
let report: (targets: Element[]) => void = () => {};

beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: (entries: { target: Element }[]) => void) {
        report = (targets) => callback(targets.map((target) => ({ target })));
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  document.body.replaceChildren();
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

function el(
  tag: string,
  attrs: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElement {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    node.setAttribute(name, value);
  }
  node.append(...children);
  return node;
}

const codeBlock = (text = "x", attrs: Record<string, string> = {}) =>
  el("pre", attrs, el("code", {}, text));
const table = (text = "x", ...before: Node[]) =>
  el("table", {}, ...before, el("tr", {}, el("td", {}, text)));

/** Puts `box` on the page at the given content size and wires it. */
function mount(box: HTMLElement, width: number, height?: number): HTMLElement {
  document.body.replaceChildren(box);
  size(box, width, height);
  mountScrollRegions(document);
  return box;
}

/** MutationObserver callbacks run as a microtask. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("mountScrollRegions", () => {
  it("makes a code block that overflows a named region the keyboard can reach", async () => {
    mount(codeBlock(), 300);
    const region = screen.getByRole("region", {
      name: "Code, scrolls sideways",
    });
    await userEvent.tab();
    expect(region).toHaveFocus();
  });

  it("leaves a box that fits alone", async () => {
    mount(codeBlock(), 100);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    await userEvent.tab();
    expect(document.body).toHaveFocus();
  });

  it("says which way it scrolls", () => {
    mount(codeBlock(), 100, 300);
    expect(
      screen.getByRole("region", { name: "Code, scrolls up and down" }),
    ).toBeInTheDocument();
    mount(codeBlock(), 300, 300);
    expect(
      screen.getByRole("region", { name: "Code, scrolls in both directions" }),
    ).toBeInTheDocument();
  });

  it("keeps a table's own role, and names it only when it has no name", async () => {
    mount(table(), 300);
    const plain = screen.getByRole("table", { name: "Scrolls sideways" });
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    await userEvent.tab();
    expect(plain).toHaveFocus();

    mount(table("x", el("caption", {}, "Offsets")), 300);
    const captioned = screen.getByRole("table", { name: "Offsets" });
    await userEvent.tab();
    expect(captioned).toHaveFocus();
  });

  it("removes only what it added when the box fits again", () => {
    const pre = mount(
      codeBlock("x", { "aria-label": "Example", tabindex: "-1" }),
      300,
    );
    expect(screen.getByRole("region", { name: "Example" })).toBe(pre);
    expect(pre).toHaveAttribute("tabindex", "-1");

    size(pre, 100);
    report([pre]);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(pre).toHaveAttribute("aria-label", "Example");
    expect(pre).toHaveAttribute("tabindex", "-1");
  });

  it("re-reads a box when its content resizes, and relabels it", () => {
    const pre = mount(codeBlock(), 300);
    expect(
      screen.getByRole("region", { name: "Code, scrolls sideways" }),
    ).toBeInTheDocument();
    size(pre, 300, 300);
    report([pre]);
    expect(
      screen.getByRole("region", { name: "Code, scrolls in both directions" }),
    ).toBeInTheDocument();
  });

  it("wires a table a widget renders after the mount, and the one that replaces it", async () => {
    const widget = el("section", { "aria-label": "Widget" });
    document.body.replaceChildren(widget);
    mountScrollRegions(document);

    const first = table("x");
    size(first, 300);
    widget.replaceChildren(first);
    await settle();
    expect(screen.getByRole("table", { name: "Scrolls sideways" })).toBe(first);

    const next = table("y");
    size(next, 300);
    widget.replaceChildren(next);
    await settle();
    expect(screen.getByRole("table", { name: "Scrolls sideways" })).toBe(next);
    expect(screen.getAllByRole("table")).toHaveLength(1);
  });

  it("re-reads a wired box whose content is replaced", async () => {
    const pre = mount(codeBlock(), 100);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    size(pre, 300);
    pre.replaceChildren(el("code", {}, "a much longer line"));
    await settle();
    expect(
      screen.getByRole("region", { name: "Code, scrolls sideways" }),
    ).toBeInTheDocument();
  });

  it("is safe to call twice", () => {
    mount(codeBlock(), 300);
    mountScrollRegions(document);
    expect(screen.getAllByRole("region")).toHaveLength(1);
  });
});
