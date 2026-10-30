// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import { cellsInColumn, expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import { handoffRows, handoffTable } from "./handoff-table";

const COLUMNS = ["Arrives", "Handling", "Ready", "Departs", "Waited"];
const ROWS = [
  ["Leg 1: Mon 10 Jun 14:00", "6 h", "Mon 20:00", "Wed 14:00", "2 d"],
];

const render = (rows = ROWS, empty = "") =>
  renderHtml(
    handoffTable({
      caption: "Hand-offs",
      columns: COLUMNS,
      rows,
      reserve: 3,
      empty,
      bodyId: "body",
      emptyId: "empty",
    }),
  );

describe("handoffTable", () => {
  it("is a named table in a focusable region", () => {
    render();
    expect(screen.getByRole("region", { name: "Hand-offs" })).toHaveAttribute(
      "tabindex",
      "0",
    );
    const table = screen.getByRole("table", { name: "Hand-offs" });
    expect(within(table).getAllByRole("columnheader")).toHaveLength(5);
    expect(cellsInColumn(table, "Waited")[0]).toHaveTextContent("2 d");
  });

  it("holds three rows and shows only the ones it has", () => {
    render();
    const table = screen.getByRole("table", { name: "Hand-offs" });
    // The header row and one real row; the two blank rows are hidden from the tree.
    expect(within(table).getAllByRole("row")).toHaveLength(2);
    expect(within(table).getAllByRole("row", { hidden: true })).toHaveLength(4);
  });

  it("says why there is no row", () => {
    const { host } = render([], "A single leg has no hand-off.");
    expect(host).toHaveTextContent("A single leg has no hand-off.");
    expect(
      within(screen.getByRole("table", { name: "Hand-offs" })).getAllByRole(
        "row",
        { hidden: true },
      ),
    ).toHaveLength(4);
  });

  it("escapes a cell", () => {
    const { host } = renderHtml(handoffRows(COLUMNS, [["<b>x</b>"]], 1));
    expect(host).toHaveTextContent("<b>x</b>");
  });

  it("has no axe violations", async () => {
    const { host } = render();
    await expectNoAxeViolations(host);
  });
});
