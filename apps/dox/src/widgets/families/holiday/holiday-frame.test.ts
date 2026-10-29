// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { html } from "../../builders/html";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import { holidayFrame } from "./holiday-frame";

describe("holidayFrame", () => {
  it("holds its children", () => {
    renderHtml(holidayFrame(html`<p>inside</p>`));
    expect(screen.getByText("inside")).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { host } = renderHtml(holidayFrame(html`<p>inside</p>`));
    await expectNoAxeViolations(host);
  });
});
