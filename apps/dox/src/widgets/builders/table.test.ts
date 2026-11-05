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

  it("marks only the named row as the current one", () => {
    renderHtml(
      table({
        caption: "Starts",
        currentRow: 1,
        columns: [
          { key: "zone", header: "Zone", align: "start", numeric: false },
        ],
        rows: [{ zone: "Berlin" }, { zone: "Oslo" }],
      }),
    );
    const current = screen.getAllByRole("row", { current: true });
    expect(current).toHaveLength(1);
    expect(
      within(current[0]!).getByRole("cell", { name: "Oslo" }),
    ).toBeInTheDocument();
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

  // A table that asks for neither option must print what it printed before they existed: no
  // stray space before a `>`, no empty `<tr >`, no `data-col`, no `aria-current`.
  it("prints an ordinary table with no trace of the optional attributes", () => {
    const out = markup().toString();
    expect(out).not.toMatch(/"[ ]>/);
    expect(out).not.toContain("<tr >");
    expect(out).not.toContain("data-col");
    expect(out).not.toContain("aria-current");
    expect(out).toMatch(/<th class="[^"]*" scope="row">Berlin<\/th>/);
    expect(out).toMatch(/<td class="[^"]*">\+01:00<\/td>/);
  });

  // The label a narrow sheet draws is `content: attr(data-col)`, which jsdom does not paint, so
  // the markup is read as text: every body cell carries its own column's header, the header row
  // carries none.
  it("labels each cell with its column header when asked", () => {
    const out = table({
      caption: "Starts",
      labelCells: true,
      rowHeader: "start",
      columns: [
        { key: "start", header: "Start", align: "start", numeric: false },
        { key: "len", header: "Length", align: "end", numeric: true },
      ],
      rows: [{ start: "2027-01-01", len: "86400 s" }],
    }).toString();
    expect(out).toMatch(
      /<th [^>]*scope="row" data-col="Start">2027-01-01<\/th>/,
    );
    expect(out).toMatch(/<td [^>]*data-col="Length">86400 s<\/td>/);
    expect(out.match(/data-col=/g)).toHaveLength(2);
  });

  // A role a native element already gives is invisible to a role query, so this reads the markup:
  // the explicit attribute is what keeps the semantics once a sheet changes a part's `display`.
  it("writes an explicit role on every part with roles, and none without", () => {
    const out = table({
      caption: "Offsets",
      rowHeader: "zone",
      roles: true,
      columns: [
        { key: "zone", header: "Zone", align: "start", numeric: false },
        { key: "off", header: "Offset", align: "end", numeric: true },
      ],
      rows: [{ zone: "Berlin", off: "+01:00" }],
    }).toString();
    expect(out).toMatch(/<table [^>]*role="table"/);
    expect(out.match(/<(thead|tbody)[^>]* role="rowgroup"/g)).toHaveLength(2);
    expect(out.match(/<tr[^>]* role="row"/g)).toHaveLength(2);
    expect(out.match(/<th [^>]*scope="col" role="columnheader"/g)).toHaveLength(
      2,
    );
    expect(out).toMatch(/<th [^>]*scope="row" role="rowheader"/);
    expect(out).toMatch(/<td [^>]* role="cell"/);
    expect(
      markup()
        .toString()
        .match(/ role="/g),
    ).toHaveLength(1);
  });

  it("has no axe violations", async () => {
    const fx = renderHtml(markup());
    await expectNoAxeViolations(fx.host);
  });
});
