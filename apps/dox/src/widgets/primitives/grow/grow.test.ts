// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { html } from "../../builders/html";
import { renderHtml } from "../../test-fixture";
import { cssTimeMs, grow } from "./grow";

describe("cssTimeMs", () => {
  it("reads seconds and milliseconds", () => {
    expect(cssTimeMs("0s")).toBe(0);
    expect(cssTimeMs(" 0.24s ")).toBe(240);
    expect(cssTimeMs("180ms")).toBe(180);
  });
  it("is NaN for anything else", () => {
    expect(cssTimeMs("")).toBeNaN();
    expect(cssTimeMs("var(--x)")).toBeNaN();
  });
});

describe("the grow element", () => {
  it("keeps its children", () => {
    renderHtml(grow(html`<p>inside</p>`));
    expect(screen.getByText("inside")).toBeInTheDocument();
  });

  it("survives connect, disconnect, connect", () => {
    const fx = renderHtml(grow(html`<p>inside</p>`));
    const el = fx.element("grow");
    fx.reconnect(el);
    fx.reconnect(el);
    expect(screen.getByText("inside")).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const fx = renderHtml(grow(html`<p>inside</p>`));
    await expectNoAxeViolations(fx.host);
  });
});
