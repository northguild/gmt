// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import { compareMatrix, type MatrixBlock } from "./compare-matrix";

const date = (line1: string, line2 = ""): MatrixBlock => ({
  name: "Holiday 1",
  state: "date",
  line1,
  line2,
  note: "",
});

const options = {
  id: "m",
  caption:
    "Observed dates of Holiday 1, one row per year and one column per policy",
  columns: [
    { label: "No shift", reason: "" },
    {
      label: "Custom, unreadable",
      reason: "NO SIGNAL: the policy is not readable.",
    },
  ],
  rows: [
    {
      year: 2021,
      disagree: true,
      word: "policies disagree",
      cells: [
        [date("Sat 25 Dec")],
        [{ ...date(""), state: "sentinel" as const }],
      ],
    },
    {
      year: 2022,
      disagree: false,
      word: "policies agree",
      cells: [[date("Sun 25 Dec")], [date("Sun 25 Dec", "moved from Sat")]],
    },
  ],
  bodyRows: 4,
  holidays: 1,
  selectedYear: 2021,
  selectedColumn: 0,
};

describe("compareMatrix", () => {
  it("is a named table with a column header per policy", () => {
    renderHtml(compareMatrix(options));
    const table = screen.getByRole("table", { name: options.caption });
    const heads = within(table).getAllByRole("columnheader");
    expect(heads).toHaveLength(3);
    expect(heads[0]).toHaveTextContent("Year");
    expect(heads[1]).toHaveTextContent("No shift");
    expect(heads[2]).toHaveTextContent(
      "NO SIGNAL: the policy is not readable.",
    );
  });

  it("draws every body row, padding a short span with hidden ones", () => {
    renderHtml(compareMatrix(options));
    const table = screen.getByRole("table");
    // The header row, the two years and no padding row a reader can reach.
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    expect(screen.getByText("policies disagree")).toBeInTheDocument();
  });

  it("presses the selected year, column and cell", () => {
    renderHtml(compareMatrix(options));
    expect(screen.getByRole("button", { name: "2021" })).toBePressed();
    expect(screen.getByRole("button", { name: "No shift" })).toBePressed();
    expect(
      screen.getByRole("button", { name: /^2021, No shift: / }),
    ).toBePressed();
    expect(
      screen.getByRole("button", { name: /^2022, No shift: / }),
    ).not.toBePressed();
  });

  it("names a cell by its year, column and dates", () => {
    renderHtml(compareMatrix(options));
    expect(
      screen.getByRole("button", {
        name: "2022, Custom, unreadable: Holiday 1: Sun 25 Dec, moved from Sat",
      }),
    ).toBeInTheDocument();
  });

  it("reads a sentinel block as NO SIGNAL in words", () => {
    renderHtml(compareMatrix(options));
    expect(
      screen.getByRole("button", {
        name: "2021, Custom, unreadable: Holiday 1: no signal, invalid input",
      }),
    ).toHaveTextContent("⟨ NO SIGNAL — invalid input ⟩");
  });

  it("has no axe violations", async () => {
    const { host } = renderHtml(compareMatrix(options));
    await expectNoAxeViolations(host);
  });
});
