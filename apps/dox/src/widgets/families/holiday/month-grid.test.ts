// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Temporal } from "@js-temporal/polyfill";
import { screen, within } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import { cell, monthGrid, type MonthGridOptions } from "./month-grid";

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

  it("draws a day outside the range with its number and no mark", () => {
    const grid = {
      year: 2026,
      months: { from: 12, to: 12 },
      weekend: [6, 7],
      marks: { "2026-12-25": { closed: true, rules: [1], pick: 1 } },
    } as const;
    const { host } = renderHtml(
      cell(Temporal.PlainDate.from("2026-12-25"), grid, { outside: true }),
    );
    expect(host).toHaveTextContent(/^25$/);
    expect(
      within(host as HTMLElement).queryByText("1"),
    ).not.toBeInTheDocument();
  });

  // jsdom applies no CSS modules, so the sheet is read as text. The cue for a day outside the
  // range is a dashed hairline border and an empty fill: a pattern, not a tone, so the day
  // number keeps the full ink at 7:1.
  it("sets an outside day in the full ink on an empty fill", () => {
    const css = readFileSync(
      join(import.meta.dirname, "month-grid.module.css"),
      "utf8",
    );
    const block = css.match(/\.cell\[data-outside\] \{([^}]*)\}/)?.[1] ?? "";
    expect(block).not.toMatch(/--gmt-ice-dim/);
    expect(block).toMatch(/background:\s*none;/);
    expect(block).toMatch(/color:\s*var\(--gmt-ice\);/);
    expect(block).toMatch(/outline:\s*none;/);
  });
});
