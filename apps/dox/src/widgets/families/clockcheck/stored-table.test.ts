// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import { cellsInColumn, expectNoAxeViolations } from "~/test/render-widget";
import { computeStoredCheck } from "../../../../worker/clock-change-shared";
import { readingsOf } from "~/lib/stored-time-audit";
import { STORED_PRESET } from "~/lib/canada-clock-change";
import { html } from "../../builders/html";
import { renderHtml } from "../../test-fixture";
import { storedTable } from "./stored-table";

function render(lines: string, staleZones: ReadonlySet<string> = new Set()) {
  const check = computeStoredCheck(lines, "America/Vancouver");
  renderHtml(
    html`<section aria-label="Answer">${storedTable({
      idPrefix: "test",
      rows: check.rows,
      readings: readingsOf,
      staleZones,
    })}</section>`,
  );
}

describe("storedTable", () => {
  it("is a table of status, saved event and what to do, one row to a line", async () => {
    render(STORED_PRESET);
    const table = screen.getByRole("table", { name: "Saved events, checked" });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((h) => h.textContent?.trim()),
    ).toEqual(["Status", "Saved event", "What to do"]);
    expect(
      cellsInColumn(table, "Status").every(
        (cell) => cell.textContent?.trim() !== "",
      ),
    ).toBe(true);
    await expectNoAxeViolations(document.body);
  });

  it("shows the NO SIGNAL sentinel for a line it could not read, never a blank", async () => {
    render("not a stored time");
    expect(screen.getByText("NO SIGNAL")).toBeInTheDocument();
    await expectNoAxeViolations(document.body);
  });

  it("gives a line in a stale zone no verdict and no advice", async () => {
    render(
      "2026-11-15T09:00:00-08:00[America/Vancouver]",
      new Set(["America/Vancouver"]),
    );
    expect(screen.getByText("Can’t check yet")).toBeInTheDocument();
    expect(screen.getByText("Try again after the update.")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Readings" }),
    ).not.toBeInTheDocument();
    await expectNoAxeViolations(document.body);
  });
});
