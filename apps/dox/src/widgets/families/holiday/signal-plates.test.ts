// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { screen } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import { paintSignalPlates, signalPlates, SIGNAL_TEXT } from "./signal-plates";

const plate = (value: string | null) => ({
  caption: "Gregorian Easter",
  value,
  line: "Gregorian computus",
  series: 1 as const,
  samples: ["-271821-04-19"],
});

describe("signalPlates", () => {
  it("reads a placed date with its caption and line", () => {
    renderHtml(signalPlates([plate("2024-03-31")]));
    expect(screen.getByText("Gregorian Easter")).toBeInTheDocument();
    expect(screen.getByText("2024-03-31")).toBeInTheDocument();
    expect(screen.getByText("Gregorian computus")).toBeInTheDocument();
  });

  it("reads NO SIGNAL in the plate when the library placed nothing, and drops the line", () => {
    renderHtml(signalPlates([plate(null)]));
    expect(screen.getAllByText(SIGNAL_TEXT).length).toBeGreaterThan(0);
    expect(screen.queryByText("Gregorian computus")).not.toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { host } = renderHtml(
      signalPlates([plate("2024-03-31"), plate(null)]),
    );
    await expectNoAxeViolations(host);
  });

  // jsdom applies no CSS modules, so the sheet is read as text. The row wraps its plates, each
  // sized to its own widest ghost, so no track decides the width and no measured breakpoint is
  // needed.
  it("lets each plate take the width of its widest ghost and wraps the row", () => {
    const css = readFileSync(
      join(import.meta.dirname, "signal-plates.module.css"),
      "utf8",
    );
    const rule = (selector: string) =>
      css.match(
        new RegExp(`^${selector.replace(".", "\\.")} \\{([^}]*)\\}`, "m"),
      )?.[1] ?? "";
    expect(rule(".row")).not.toMatch(/minmax\(0/);
    expect(rule(".row")).toMatch(/flex-wrap:\s*wrap;/);
    expect(css).not.toMatch(/grid-template-columns:\s*repeat\(3/);
    expect(rule(".shown,\n.ghost")).toMatch(/grid-area:\s*1 \/ 1;/);
  });

  describe("paintSignalPlates", () => {
    const row = (value: string | null, line = "Gregorian computus") => [
      { ...plate(value), line },
    ];

    it("writes a new value and line into the plate on the page", () => {
      const { host } = renderHtml(signalPlates(row("2024-03-31")));
      paintSignalPlates(host, row("2025-04-20", "Julian computus"));
      expect(screen.getByText("2025-04-20")).toBeInTheDocument();
      expect(screen.getByText("Julian computus")).toBeInTheDocument();
      expect(screen.queryByText("2024-03-31")).not.toBeInTheDocument();
    });

    it("replaces no node, so a node a reader holds is the one that changes", () => {
      const { host } = renderHtml(signalPlates(row("2024-03-31")));
      const held = screen.getByText("2024-03-31");
      paintSignalPlates(host, row("2025-04-20"));
      expect(held).toHaveTextContent("2025-04-20");
      expect(screen.getByText("2025-04-20")).toBe(held);
    });

    it("reads NO SIGNAL and drops the line when the library placed nothing", () => {
      const { host } = renderHtml(signalPlates(row("2024-03-31")));
      paintSignalPlates(host, row(null));
      expect(screen.getAllByText(SIGNAL_TEXT).length).toBeGreaterThan(0);
      expect(screen.queryByText("Gregorian computus")).not.toBeInTheDocument();
      expect(screen.queryByText("2024-03-31")).not.toBeInTheDocument();
    });

    it("returns to a value after NO SIGNAL", () => {
      const { host } = renderHtml(signalPlates(row(null)));
      paintSignalPlates(host, row("2024-03-31"));
      expect(screen.getByText("2024-03-31")).toBeInTheDocument();
      expect(screen.getByText("Gregorian computus")).toBeInTheDocument();
    });

    it("leaves a plate alone when the list is longer than the row", () => {
      const { host } = renderHtml(signalPlates(row("2024-03-31")));
      paintSignalPlates(host, [...row("2025-04-20"), ...row("2026-04-05")]);
      expect(screen.getByText("2025-04-20")).toBeInTheDocument();
      expect(screen.queryByText("2026-04-05")).not.toBeInTheDocument();
    });

    it("has no axe violations after a repaint", async () => {
      const { host } = renderHtml(signalPlates(row("2024-03-31")));
      paintSignalPlates(host, row(null));
      await expectNoAxeViolations(host);
    });
  });
});
