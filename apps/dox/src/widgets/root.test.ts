// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import { html } from "./builders/html";
import { section, widget } from "./builders/layout";
import { expectNoAxeViolations } from "~/test/render-widget";
import { findWidget } from "./root";
import { renderHtml } from "./test-fixture";

const tool = (scope: string) =>
  widget(
    { name: "demo", label: `Demo ${scope}`, scope },
    section(
      { id: `${scope}-pick`, heading: "Pick", level: 3 },
      html`<p id="${scope}-note">note ${scope}</p>`,
    ),
  );

describe("findWidget", () => {
  it("finds the region when root is the region itself", () => {
    const fx = renderHtml(tool("a"));
    const region = screen.getByRole("region", { name: "Demo a" });
    const found = findWidget(region, "demo");
    expect(found.el).toBe(region);
    expect(fx.host).toContainElement(found.el);
  });

  it("finds the region as a descendant of root", () => {
    const fx = renderHtml(tool("a"));
    const found = findWidget(fx.host, "demo");
    expect(found.el).toBe(screen.getByRole("region", { name: "Demo a" }));
  });

  it("rebuilds the template's ids from the scope", () => {
    const fx = renderHtml(tool("alpha"));
    const found = findWidget(fx.host, "demo");
    expect(found.id("note")).toBe("alpha-note");
    expect(found.part("note")).toHaveTextContent("note alpha");
  });

  it("types a part as the element the caller names", () => {
    const fx = renderHtml(tool("a"));
    const note = findWidget(fx.host, "demo").part<HTMLParagraphElement>("note");
    expect(note).toHaveTextContent("note a");
  });

  it("keeps two widgets on one page apart", () => {
    const fx = renderHtml(html`${tool("a")}${tool("b")}`);
    const second = screen.getByRole("region", { name: "Demo b" });
    const found = findWidget(second, "demo");
    expect(found.part("note")).toHaveTextContent("note b");
    // The page-wide root would give the first widget; the scoped lookup never leaks.
    expect(within(second).getByText("note b")).toBe(found.part("note"));
    expect(findWidget(fx.host, "demo").part("note")).toHaveTextContent(
      "note a",
    );
  });

  it("throws naming the widget when it is absent", () => {
    const fx = renderHtml(html`<p>nothing</p>`);
    expect(() => findWidget(fx.host, "demo")).toThrow(/demo/);
  });

  it("throws naming the part when it is absent", () => {
    const fx = renderHtml(tool("a"));
    expect(() => findWidget(fx.host, "demo").part("missing")).toThrow(
      /missing/,
    );
  });

  it("throws when the region carries no scope", () => {
    const fx = renderHtml(
      html`<div data-widget="demo" role="region" aria-label="Old">x</div>`,
    );
    expect(() => findWidget(fx.host, "demo")).toThrow(/no scope/);
  });

  it("has no axe violations in what it finds", async () => {
    const fx = renderHtml(tool("a"));
    await expectNoAxeViolations(findWidget(fx.host, "demo").el);
  });
});
