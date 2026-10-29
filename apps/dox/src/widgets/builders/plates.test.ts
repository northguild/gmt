// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../test-fixture";
import { NO_RESULT, plates } from "./plates";

describe("plates", () => {
  it("gives each value its term, with its lines as further definitions", () => {
    renderHtml(
      plates([
        { caption: "Issue date", value: "2026-11-03", lines: ["a Tuesday"] },
        { caption: "Due date", value: "2026-11-17", lines: ["14 days later"] },
      ]),
    );
    expect(screen.getAllByRole("term").map((t) => t.textContent)).toEqual([
      "Issue date",
      "Due date",
    ]);
    expect(screen.getByText("2026-11-17")).toBeVisible();
    expect(screen.getByText("a Tuesday")).toBeVisible();
  });

  it("reads 'no result' for a null value and blanks the lines, keeping them", () => {
    renderHtml(
      plates([{ caption: "Overlap", value: null, lines: ["x", "y"] }]),
    );
    expect(screen.getByText(NO_RESULT)).toBeVisible();
    expect(screen.queryByText("x")).not.toBeInTheDocument();
    expect(screen.getAllByRole("definition")).toHaveLength(3);
    expect(screen.queryByText(/NO SIGNAL/)).not.toBeInTheDocument();
  });

  it("reserves the widest caption and value, hidden from assistive technology", () => {
    renderHtml(
      plates([
        {
          caption: "Short",
          value: "1",
          lines: [],
          captions: ["A much longer caption"],
          samples: ["2026-11-03T23:59:59Z"],
        },
      ]),
    );
    const term = screen.getByRole("term");
    expect(within(term).getByText("A much longer caption")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(screen.getByText("2026-11-03T23:59:59Z")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("escapes text", () => {
    renderHtml(plates([{ caption: "<b>", value: "&", lines: ["<i>"] }]));
    expect(screen.getByText("<b>")).toBeInTheDocument();
    expect(screen.getByText("&")).toBeInTheDocument();
  });

  it("has no axe violations, live or empty", async () => {
    const a = renderHtml(
      plates([
        { caption: "A", value: "1", lines: ["l"], series: 2 },
        { caption: "B", value: null, lines: ["l"], quiet: true },
      ]),
    );
    await expectNoAxeViolations(a.host);
  });
});
