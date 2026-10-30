// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import { gnssCounterTable } from "./gnss-counter-table";

const columns = ["Counter", "Week", "Time of week (s)", "Era"];
const rows = [
  { name: "GPS-LNAV", yours: true, cells: ["247", "86418", "2"] },
  { name: "GAL", yours: false, cells: ["no result", "", ""] },
];

describe("gnssCounterTable", () => {
  it("is a named table in a named, focusable scrolling region", () => {
    renderHtml(gnssCounterTable({ caption: "Every counter", columns, rows }));
    expect(
      screen.getByRole("region", { name: "Every counter" }),
    ).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("table", { name: "Every counter" })).toBeVisible();
    expect(
      screen.getAllByRole("columnheader").map((c) => c.textContent),
    ).toEqual(columns);
  });

  it("draws every row, says which one is the reading's own, and blanks cells without a result", () => {
    renderHtml(gnssCounterTable({ caption: "Every counter", columns, rows }));
    const [own, none] = screen.getAllByRole("row").slice(1);
    expect(
      within(own!).getByRole("rowheader", { name: "GPS-LNAV (your reading)" }),
    ).toBeInTheDocument();
    expect(
      within(own!)
        .getAllByRole("cell")
        .map((c) => c.textContent),
    ).toEqual(["247", "86418", "2"]);
    expect(within(none!).getByRole("rowheader")).toHaveTextContent("GAL");
    expect(within(none!).getByText("no result")).toBeInTheDocument();
    expect(within(none!).getAllByRole("cell")).toHaveLength(3);
  });

  it("names each cell's column for the stacked layout", () => {
    renderHtml(gnssCounterTable({ caption: "Every counter", columns, rows }));
    const [own] = screen.getAllByRole("row").slice(1);
    expect(
      within(own!)
        .getAllByRole("cell")
        .map((c) => c.getAttribute("data-label")),
    ).toEqual(["Week", "Time of week (s)", "Era"]);
  });

  it("escapes its text", () => {
    renderHtml(
      gnssCounterTable({
        caption: "<b>t</b>",
        columns: ["<i>", "x"],
        rows: [{ name: "<u>", yours: false, cells: ["&"] }],
      }),
    );
    expect(screen.getByText("<u>")).toBeInTheDocument();
    expect(screen.getByText("&")).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { host } = renderHtml(
      gnssCounterTable({ caption: "Every counter", columns, rows }),
    );
    await expectNoAxeViolations(host);
  });
});
