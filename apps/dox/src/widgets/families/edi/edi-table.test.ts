// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import { cellsInColumn, expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import {
  memberTable,
  NO_MEMBER,
  setMember,
  setStripCell,
  zoneStrip,
} from "./edi-table";

const id = (local: string) => `t-${local}`;

describe("memberTable", () => {
  it("names every member and starts each on no result", async () => {
    const { host } = renderHtml(
      memberTable({
        id,
        caption: "What the parser returned",
        prefix: "member",
        rows: [
          { key: "kind", label: "Kind" },
          { key: "value", label: "Value" },
        ],
      }),
    );
    const table = screen.getByRole("table", {
      name: "What the parser returned",
    });
    expect(cellsInColumn(table, "Member").map((c) => c.textContent)).toEqual([
      "Kind",
      "Value",
    ]);
    expect(cellsInColumn(table, "Value").map((c) => c.textContent)).toEqual([
      NO_MEMBER,
      NO_MEMBER,
    ]);
    await expectNoAxeViolations(host);
  });

  it("shows what setMember writes", () => {
    renderHtml(
      memberTable({
        id,
        caption: "Members",
        prefix: "member",
        rows: [{ key: "kind", label: "Kind" }],
      }),
    );
    const table = screen.getByRole("table");
    setMember(cellsInColumn(table, "Value")[0]!, "date", "value");
    expect(cellsInColumn(table, "Value")[0]).toHaveTextContent("date");
  });
});

describe("zoneStrip", () => {
  const strip = (third: string, disabled = false) =>
    zoneStrip({
      id,
      caption: "The same local time in up to four zones",
      third,
      zones: ["Europe/Paris", "", "", ""],
      disabled,
      widths: { instant: 20, third: 20 },
    });

  it("has a named zone choice for each of the four rows and the third column's name", async () => {
    const { host } = renderHtml(strip("As 205"));
    for (const n of [1, 2, 3, 4]) {
      expect(
        screen.getByRole("combobox", { name: `Zone ${n}` }),
      ).toBeInTheDocument();
    }
    expect(screen.getByRole("combobox", { name: "Zone 1" })).toHaveValue(
      "Europe/Paris",
    );
    expect(
      screen.getByRole("columnheader", { name: "As 205" }),
    ).toBeInTheDocument();
    await expectNoAxeViolations(host);
  });

  it("keeps a chosen zone that is not on the list", () => {
    renderHtml(
      zoneStrip({
        id,
        caption: "Strip",
        third: "With offset",
        zones: ["Pacific/Auckland", "", "", ""],
        disabled: false,
        widths: { instant: 20, third: 20 },
      }),
    );
    expect(screen.getByRole("combobox", { name: "Zone 1" })).toHaveValue(
      "Pacific/Auckland",
    );
  });

  it("writes a cell as text, and the sentinel in words", () => {
    renderHtml(strip("With offset"));
    const table = screen.getByRole("table");
    const instants = cellsInColumn(table, "Instant");
    setStripCell(instants[0]!, "2024-06-15T12:30:00Z");
    setStripCell(instants[1]!, "NO SIGNAL", true);
    expect(within(table).getByText("2024-06-15T12:30:00Z")).toBeInTheDocument();
    expect(within(table).getByText("NO SIGNAL")).toBeInTheDocument();
  });
});
