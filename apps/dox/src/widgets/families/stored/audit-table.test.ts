// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { cellsInColumn, expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import { auditTable, LINE_NO_SIGNAL, type AuditRow } from "./audit-table";

const mismatch: AuditRow = {
  n: 1,
  selected: true,
  stored: "2016-12-01T09:00:00+02:00[Europe/Istanbul]",
  kind: "offsetMismatch",
  kindText: "Offset mismatch",
  pair: { stored: "+02:00", zone: "+03:00" },
  tokens: [{ name: "instant", value: "2016-12-01T06:00:00.250Z" }],
  sentence: "The zone was at +03:00 at this time.",
};

const lost: AuditRow = {
  n: 2,
  selected: false,
  stored: "not a time",
  kind: null,
  kindText: "",
  pair: null,
  tokens: [],
  sentence: "Not a stored time.",
};

function draw(rows: readonly AuditRow[]) {
  return renderHtml(
    auditTable({
      caption: "Every pasted line",
      group: "audit-lines",
      kindWidth: 19,
      emptyText: "Paste a stored time above: one line each.",
      rows,
    }),
  );
}

describe("auditTable", () => {
  it("is a named table with four named columns", () => {
    draw([mismatch, lost]);
    const table = screen.getByRole("table", { name: "Every pasted line" });
    for (const name of ["Line", "Stored", "Kind", "Readings"]) {
      expect(
        within(table).getByRole("columnheader", { name }),
      ).toBeInTheDocument();
    }
    expect(cellsInColumn(table, "Kind")).toHaveLength(2);
  });

  it("gives each row a radio named for its line, with the number visible", () => {
    draw([mismatch, lost]);
    expect(screen.getByRole("radio", { name: "Draw line 1" })).toBeChecked();
    expect(
      screen.getByRole("radio", { name: "Draw line 2" }),
    ).not.toBeChecked();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(screen.getByText("2")).toBeVisible();
  });

  it("lets one radio be drawn at a time, from the keyboard", async () => {
    const user = userEvent.setup();
    draw([mismatch, lost]);
    await user.click(screen.getByRole("radio", { name: "Draw line 2" }));
    expect(screen.getByRole("radio", { name: "Draw line 2" })).toBeChecked();
    expect(
      screen.getByRole("radio", { name: "Draw line 1" }),
    ).not.toBeChecked();
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("radio", { name: "Draw line 1" })).toBeChecked();
  });

  it("names the kind in words and shows a mismatch as one pair", () => {
    draw([mismatch]);
    expect(screen.getByText("Offset mismatch")).toBeVisible();
    const row = screen.getAllByRole("row")[1]!;
    expect(within(row).getAllByRole("listitem")[0]).toHaveTextContent(
      "storedOffset +02:00 → zoneOffset +03:00",
    );
    expect(within(row).getAllByRole("listitem")).toHaveLength(2);
    expect(within(row).getByText(/The zone was at/)).toBeVisible();
  });

  it("keeps a reading's text whole although it may break", () => {
    draw([mismatch]);
    const row = screen.getAllByRole("row")[1]!;
    expect(within(row).getAllByRole("listitem")[1]).toHaveTextContent(
      "instant 2016-12-01T06:00:00.250Z",
    );
  });

  it("shows the bracketed sentinel for a line that was not read, with no readings", () => {
    draw([lost]);
    expect(screen.getByText(LINE_NO_SIGNAL)).toBeVisible();
    const row = screen.getAllByRole("row")[1]!;
    expect(within(row).queryAllByRole("listitem")).toHaveLength(0);
    expect(within(row).getByText("Not a stored time.")).toBeVisible();
  });

  it("says so in one row when there is no line", () => {
    draw([]);
    expect(
      screen.getByText("Paste a stored time above: one line each."),
    ).toBeVisible();
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    expect(screen.getAllByRole("row")).toHaveLength(2);
  });

  it("checks the selected row and escapes what was pasted", () => {
    draw([{ ...lost, selected: true, stored: "<b>x</b>" }]);
    expect(screen.getByText("<b>x</b>")).toBeVisible();
    expect(screen.queryByText("x")).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Draw line 2" })).toBeChecked();
  });

  it("has no axe violations", async () => {
    const { host } = draw([mismatch, lost]);
    await expectNoAxeViolations(host);
  });
});
