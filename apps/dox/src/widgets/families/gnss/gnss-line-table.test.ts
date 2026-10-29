// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import { cellsInColumn, expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import { gnssLineTable } from "./gnss-line-table";

const columns = ["Clock", "Reading", "Ahead of UTC"];
const rows = [
  {
    name: { text: "GPS", sub: "your reading · tied to TAI" },
    yours: true,
    cells: [
      {
        text: "2024-01-01T00:00:18 GPS",
        sub: "written as 2024-01-01T00:00:18",
      },
      { text: "18 s", sub: "" },
    ],
  },
  {
    name: { text: "IRN", sub: "derived" },
    yours: false,
    cells: [
      { text: "no result", sub: "" },
      { text: "", sub: "" },
    ],
  },
];

describe("gnssLineTable", () => {
  it("is a named table in a named, focusable scrolling region", () => {
    renderHtml(gnssLineTable({ caption: "Every clock", columns, rows }));
    expect(screen.getByRole("region", { name: "Every clock" })).toHaveAttribute(
      "tabindex",
      "0",
    );
    expect(screen.getByRole("table", { name: "Every clock" })).toBeVisible();
    expect(
      screen.getAllByRole("columnheader").map((c) => c.textContent),
    ).toEqual(columns);
  });

  it("draws both lines of every cell and names the reading's own row in words", () => {
    renderHtml(gnssLineTable({ caption: "Every clock", columns, rows }));
    const table = screen.getByRole("table");
    const [own, other] = within(table).getAllByRole("row").slice(1);
    expect(within(own!).getByRole("rowheader")).toHaveTextContent(
      "GPS your reading · tied to TAI",
    );
    expect(within(own!).getAllByRole("cell")[0]).toHaveTextContent(
      "2024-01-01T00:00:18 GPS written as 2024-01-01T00:00:18",
    );
    expect(within(other!).getByRole("rowheader")).toHaveTextContent(
      "IRN derived",
    );
    expect(cellsInColumn(table, "Ahead of UTC")).toHaveLength(2);
  });

  it("keeps a missing cell's two lines", () => {
    renderHtml(
      gnssLineTable({
        caption: "Every clock",
        columns,
        rows: [{ name: { text: "UTC", sub: "" }, yours: false, cells: [] }],
      }),
    );
    expect(
      within(screen.getAllByRole("row")[1]!).getAllByRole("cell"),
    ).toHaveLength(2);
  });

  it("escapes its text", () => {
    renderHtml(
      gnssLineTable({
        caption: "<b>t</b>",
        columns: ["<i>", "x"],
        rows: [
          {
            name: { text: "<u>", sub: "" },
            yours: false,
            cells: [{ text: "&", sub: "" }],
          },
        ],
      }),
    );
    expect(screen.getByText("<u>")).toBeInTheDocument();
    expect(screen.getByText("&")).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { host } = renderHtml(
      gnssLineTable({ caption: "Every clock", columns, rows }),
    );
    await expectNoAxeViolations(host);
  });
});
