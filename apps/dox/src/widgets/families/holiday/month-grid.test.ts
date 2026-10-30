// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import { monthGrid, type MonthGridOptions } from "./month-grid";

const options: MonthGridOptions = {
  year: 2026,
  months: { from: 12, to: 12 },
  weekend: [6, 7],
  marks: {
    "2026-12-25": { closed: true, rules: [1] },
    "2026-12-26": { movedFrom: true, movedTo: 5 },
  },
};

describe("monthGrid", () => {
  it("labels the image with its span and weekend", () => {
    renderHtml(monthGrid(options));
    expect(
      screen.getByRole("img", {
        name: "Calendar, December 2026. Weekend: Saturday, Sunday. The marked dates follow in the list.",
      }),
    ).toBeInTheDocument();
  });

  it("lists every marked date as a sentence", () => {
    renderHtml(monthGrid(options));
    const list = screen.getByRole("list", { name: "Marked dates" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Friday 25 December 2026: closed");
    expect(items[1]).toHaveTextContent("Saturday 26 December 2026");
  });

  it("names the month and says when it has no holidays", () => {
    renderHtml(monthGrid({ ...options, marks: {} }));
    expect(
      screen.getByRole("heading", { name: "December", level: 4 }),
    ).toBeInTheDocument();
    expect(screen.getByText("No holidays in December")).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { host } = renderHtml(monthGrid(options));
    await expectNoAxeViolations(host);
  });
});
