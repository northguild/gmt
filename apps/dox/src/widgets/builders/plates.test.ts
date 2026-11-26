// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../test-fixture";
import { NO_RESULT, paintPlates, plates } from "./plates";

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

  it("keeps a word value readable beside a number's reserved room", () => {
    renderHtml(
      plates([
        {
          caption: "Gap",
          value: "inside an inserted second",
          lines: [],
          samples: ["888.888888888 s", "inside an inserted second"],
          words: ["inside an inserted second"],
        },
      ]),
    );
    expect(screen.getByRole("definition")).toHaveTextContent(
      "inside an inserted second",
    );
    expect(screen.getAllByText("inside an inserted second")[0]).toBeVisible();
  });

  it("reserves the widest text of a line, hidden from assistive technology", () => {
    renderHtml(
      plates([
        {
          caption: "UTC",
          value: "1",
          lines: ["as typed", ""],
          lineSamples: [["read from GAL"]],
        },
      ]),
    );
    expect(screen.getByText("as typed")).toBeVisible();
    expect(screen.getByText("read from GAL")).toHaveAttribute(
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

describe("paintPlates", () => {
  const row = (value: string | null, line = "a Tuesday") => [
    { caption: "Issue date", value, lines: [line] },
  ];

  it("writes a new value and line into the same nodes", () => {
    const { host } = renderHtml(plates(row("2026-11-03")));
    const held = screen.getByText("2026-11-03");
    const line = screen.getByText("a Tuesday");
    paintPlates(host, row("2026-11-04", "a Wednesday"));
    expect(held).toHaveTextContent("2026-11-04");
    expect(line).toHaveTextContent("a Wednesday");
    expect(screen.getByText("2026-11-04")).toBe(held);
  });

  it("reads no result and blanks the line for a null value, then comes back", () => {
    const { host } = renderHtml(plates(row("2026-11-03")));
    paintPlates(host, row(null));
    expect(screen.getByText(NO_RESULT)).toBeInTheDocument();
    expect(screen.queryByText("a Tuesday")).not.toBeInTheDocument();
    expect(screen.getAllByRole("definition")).toHaveLength(2);
    paintPlates(host, row("2026-11-03"));
    expect(screen.getByText("2026-11-03")).toBeInTheDocument();
    expect(screen.getByText("a Tuesday")).toBeInTheDocument();
    expect(screen.queryByText(NO_RESULT)).not.toBeInTheDocument();
  });

  it("leaves the row alone past its last plate", () => {
    const { host } = renderHtml(plates(row("2026-11-03")));
    paintPlates(host, [...row("2026-11-04"), ...row("2026-11-05")]);
    expect(screen.getByText("2026-11-04")).toBeInTheDocument();
    expect(screen.queryByText("2026-11-05")).not.toBeInTheDocument();
  });
});
