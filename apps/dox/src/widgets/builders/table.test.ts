// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { screen, within } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../test-fixture";
import { table } from "./table";

const markup = () =>
  table({
    caption: "Offsets",
    rowHeader: "zone",
    columns: [
      { key: "zone", header: "Zone", align: "start", numeric: false },
      { key: "off", header: "Offset", align: "end", numeric: true },
    ],
    rows: [
      { zone: "Berlin", off: "+01:00" },
      { zone: "<b>x</b>", off: "+00:00" },
    ],
  });

describe("table", () => {
  it("is a named table with column and row headers", () => {
    renderHtml(markup());
    const t = screen.getByRole("table", { name: "Offsets" });
    expect(
      within(t).getByRole("columnheader", { name: "Offset" }),
    ).toBeInTheDocument();
    expect(
      within(t).getByRole("rowheader", { name: "Berlin" }),
    ).toBeInTheDocument();
    expect(within(t).getByRole("cell", { name: "+01:00" })).toBeInTheDocument();
  });

  it("keeps its headers and cells when the columns are laid out once", () => {
    renderHtml(
      table({
        caption: "Calls",
        columns: [
          { key: "a", header: "Year", align: "start", numeric: false },
          { key: "b", header: "Result", align: "end", numeric: true },
        ],
        rows: [{ a: "2024", b: "yes" }],
        layout: "fixed",
        widths: ["34%"],
      }),
    );
    const t = screen.getByRole("table", { name: "Calls" });
    expect(
      within(t).getByRole("columnheader", { name: "Result" }),
    ).toBeInTheDocument();
    expect(within(t).getByRole("cell", { name: "yes" })).toBeInTheDocument();
  });

  it("escapes cell text", () => {
    renderHtml(markup());
    expect(
      screen.getByRole("rowheader", { name: "<b>x</b>" }),
    ).toBeInTheDocument();
  });

  it("puts a scrolling table in a focusable region", () => {
    renderHtml(markup());
    expect(screen.getByRole("region", { name: "Offsets" })).toHaveAttribute(
      "tabindex",
      "0",
    );
  });

  // jsdom applies no CSS modules, so the sheet is read as text. The widget reset draws a content
  // table as `display: block; overflow: auto`, which would scroll the table and leave the
  // focusable region with nothing to scroll.
  it("lays its table out as a table box so the region is what scrolls", () => {
    const css = readFileSync(
      join(import.meta.dirname, "table.module.css"),
      "utf8",
    );
    const rule = (selector: string) =>
      css.match(
        new RegExp(`^${selector.replace(".", "\\.")} \\{([^}]*)\\}`, "m"),
      )?.[1] ?? "";
    expect(rule(".table")).toMatch(/display:\s*table;/);
    expect(rule(".table")).not.toMatch(/overflow/);
    expect(rule(".wrap")).toMatch(/overflow-x:\s*auto;/);
    expect(rule(".fixed")).toMatch(/table-layout:\s*fixed;/);
  });

  it("has no axe violations", async () => {
    const fx = renderHtml(markup());
    await expectNoAxeViolations(fx.host);
  });
});
