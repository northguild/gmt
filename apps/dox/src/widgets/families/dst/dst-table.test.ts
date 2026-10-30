// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import { cellsInColumn, expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import { DST_EMPTY_TEXT, dstBadge, dstTable, type DstRow } from "./dst-table";

const ROWS: DstRow[] = [
  {
    kind: "gap",
    date: "2024-03-31",
    hour: "01:00",
    instant: "2024-03-31T01:00:00Z",
    before: "+00:00",
    after: "+01:00",
  },
  {
    kind: "overlap",
    date: "2024-10-27",
    hour: "02:00",
    instant: "2024-10-27T01:00:00Z",
    before: "+01:00",
    after: "+00:00",
  },
];

describe("dstBadge", () => {
  it("names the kind in words", () => {
    renderHtml(dstBadge("gap"));
    expect(screen.getByText("Gap")).toBeInTheDocument();
  });
});

describe("dstTable", () => {
  it("is a captioned table with a row per transition", async () => {
    const c = renderHtml(dstTable(ROWS)).host;
    const t = screen.getByRole("table", { name: "DST transitions" });
    expect(within(t).getAllByRole("columnheader")).toHaveLength(5);
    expect(cellsInColumn(t, "Local Date").map((x) => x.textContent)).toEqual([
      "2024-03-31",
      "2024-10-27",
    ]);
    expect(cellsInColumn(t, "Type").map((x) => x.textContent)).toEqual([
      "Gap",
      "Overlap",
    ]);
    await expectNoAxeViolations(c);
  });

  it("says so, politely, when there are no transitions", async () => {
    const c = renderHtml(dstTable([])).host;
    expect(screen.getByRole("status")).toHaveTextContent(DST_EMPTY_TEXT);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    await expectNoAxeViolations(c);
  });
});
