// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { html } from "./html";
import { renderHtml } from "../test-fixture";
import { swatch } from "./swatch";

describe("swatch", () => {
  it("adds nothing to the name of the control that holds it", () => {
    renderHtml(
      html`<button type="button">${swatch({ series: 2 })} Departure</button>`,
    );
    expect(
      screen.getByRole("button", { name: "Departure" }),
    ).toBeInTheDocument();
  });

  it("has no axe violations for every series", async () => {
    for (const series of [1, 2, 3, 4] as const) {
      const r = renderHtml(html`<p>${swatch({ series })} Series ${series}</p>`);
      await expectNoAxeViolations(r.host);
    }
  });
});
