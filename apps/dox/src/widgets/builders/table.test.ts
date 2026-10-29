// @vitest-environment jsdom
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

  it("has no axe violations", async () => {
    const fx = renderHtml(markup());
    await expectNoAxeViolations(fx.host);
  });
});
