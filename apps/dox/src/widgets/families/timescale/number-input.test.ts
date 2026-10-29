/**
 * @vitest-environment jsdom
 */
import { screen } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { field, html } from "../../builders";
import { renderHtml, type Fixture } from "../../test-fixture";

let page: Fixture;
import { numberInput } from "./number-input";

describe("numberInput", () => {
  it("is a spin button named by its field, with its bounds", async () => {
    page = renderHtml(
      html`<div>${field({
        id: "yr",
        label: "Year",
        hint: { id: "yr-hint", html: html`<p id="yr-hint">Whole years.</p>` },
        control: ({ id, describedBy }) =>
          numberInput({
            id,
            value: "2024",
            min: 1900,
            max: 2100,
            step: 1,
            describedBy,
          }),
      })}</div>`,
    );
    const input = screen.getByRole("spinbutton", { name: "Year" });
    expect(input).toHaveValue(2024);
    expect(input).toHaveAttribute("min", "1900");
    expect(input).toHaveAttribute("max", "2100");
    expect(input).toHaveAccessibleDescription("Whole years.");
    await expectNoAxeViolations(page.host);
  });
});
