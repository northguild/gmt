// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import { holidayLegend, kindItems } from "./holiday-legend";

describe("holidayLegend", () => {
  it("names each mark in words", () => {
    renderHtml(holidayLegend({ label: "Marks", items: kindItems() }));
    const items = within(
      screen.getByRole("list", { name: "Marks" }),
    ).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual([
      "Closed",
      "Weekend",
      "Moved from (not closed)",
      "Moved to",
      "Picked",
    ]);
  });

  it("takes the caller's words for a series", () => {
    renderHtml(
      holidayLegend({
        label: "Series",
        items: [{ kind: "pick", series: 2, label: "Julian series (hatched)" }],
      }),
    );
    expect(screen.getByText("Julian series (hatched)")).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { host } = renderHtml(
      holidayLegend({ label: "Marks", items: kindItems() }),
    );
    await expectNoAxeViolations(host);
  });
});
