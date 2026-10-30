// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import { yearStepper } from "./year-stepper";

const options = {
  id: "y",
  label: "Year",
  value: "2021",
  min: 1900,
  max: 2100,
  prevLabel: "Previous year",
  nextLabel: "Next year",
};

describe("yearStepper", () => {
  it("names the field and both buttons", () => {
    renderHtml(yearStepper(options));
    expect(screen.getByRole("spinbutton", { name: "Year" })).toHaveValue(2021);
    expect(screen.getByRole("button", { name: "Previous year" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Next year" })).toBeEnabled();
  });

  it("has no axe violations", async () => {
    const { host } = renderHtml(yearStepper(options));
    await expectNoAxeViolations(host);
  });
});
