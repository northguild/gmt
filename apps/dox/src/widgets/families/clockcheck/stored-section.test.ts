// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { CANADA_STORED } from "~/lib/canada-saved-example";
import { html } from "../../builders/html";
import { widget } from "../../builders/layout";
import { renderHtml } from "../../test-fixture";
import { storedSection } from "./stored-section";

const config = { ...CANADA_STORED, idPrefix: "test" };

function render() {
  renderHtml(
    html`${widget({ name: "stored-test", label: "Saved events", scope: "test" }, storedSection(config))}`,
  );
}

describe("storedSection", () => {
  it("is a region named by its heading, with the example, form and controls", async () => {
    render();
    const section = screen.getByRole("region", {
      name: "Did your saved events move?",
    });
    expect(
      within(section).getByRole("list", { name: "An example" }),
    ).toBeInTheDocument();
    expect(
      within(section).getByRole("textbox", {
        name: "Saved events, one per line",
      }),
    ).toHaveValue(config.preset);
    expect(
      within(section).getByRole("button", { name: "Check" }),
    ).toBeInTheDocument();
    expect(
      within(section).getByRole("button", { name: "Reset example" }),
    ).toBeInTheDocument();
    await expectNoAxeViolations(document.body);
  });

  it("offers the filter as a labelled group of two toggle buttons, All pressed", () => {
    render();
    const group = screen.getByRole("group", { name: "Show" });
    expect(within(group).getByRole("button", { name: "All" })).toBePressed();
    expect(
      within(group).getByRole("button", { name: "Only moved" }),
    ).not.toBePressed();
  });

  it("starts in a checking state and keeps the filter message and stale note out of sight", () => {
    render();
    expect(screen.getAllByText("Checking…").length).toBeGreaterThan(0);
    expect(
      screen.getByText("No line is left with this filter."),
    ).not.toBeVisible();
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });
});
