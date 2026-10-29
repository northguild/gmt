/**
 * @vitest-environment jsdom
 *
 * `crossingBar`: the proportional strip under the Crossing Clock's two faces, in its three
 * views. The bar is one named image; the changes are a list a reader can count.
 */
import { screen } from "@testing-library/dom";
import type { CrossingStrip } from "~/lib/crossing-clock";
import { renderHtml } from "~/widgets/test-fixture";
import { crossingBar } from "./crossing-strip";

const DRAWN: CrossingStrip = {
  entryLabel: "00:00",
  exitLabel: "08:00",
  summary: "Seven hours, 00:00 to 08:00. 01:00–02:00 never shown.",
  stepHours: 1,
  ticks: [
    { percent: 0, label: null },
    { percent: 50, label: "4h" },
  ],
  changes: [
    {
      kind: "skip",
      percent: 14.3,
      label: "01:00–02:00 never shown",
      fromHour: 1,
      fromMinute: 0,
      toHour: 2,
      toMinute: 0,
    },
  ],
};

const QUIET: CrossingStrip = { ...DRAWN, summary: "Seven hours.", changes: [] };

describe("crossingBar", () => {
  it("names the bar by the strip's summary", () => {
    renderHtml(crossingBar({ kind: "drawn", strip: DRAWN }));
    expect(
      screen.getByRole("img", { name: DRAWN.summary }),
    ).toBeInTheDocument();
  });

  it("writes one list item for each change", () => {
    renderHtml(crossingBar({ kind: "drawn", strip: DRAWN }));
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByRole("listitem")).toHaveTextContent(
      "01:00–02:00 never shown",
    );
  });

  it("says so in one quiet sentence when nothing changes", () => {
    renderHtml(crossingBar({ kind: "drawn", strip: QUIET }));
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
    expect(
      screen.getByText(/No clock change during the crossing/),
    ).toBeInTheDocument();
  });

  it("explains the marker kinds that occur, and only those", () => {
    renderHtml(crossingBar({ kind: "drawn", strip: DRAWN }));
    expect(
      screen.getByText(/an hour the clock never showed/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/showed twice/)).not.toBeInTheDocument();
  });

  it("keeps its box before a reading, named as not drawn", () => {
    renderHtml(crossingBar({ kind: "blank" }));
    expect(
      screen.getByRole("img", { name: "Crossing strip, not drawn" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("shows the sentinel in words at the edge of the range", () => {
    renderHtml(crossingBar({ kind: "edge", text: "⟨ NO SIGNAL — edge ⟩" }));
    expect(screen.getByRole("status")).toHaveTextContent("NO SIGNAL");
  });

  it("escapes a label rather than reading it as markup", () => {
    renderHtml(
      crossingBar({
        kind: "drawn",
        strip: { ...QUIET, summary: "<b>x</b>" },
      }),
    );
    expect(screen.getByRole("img", { name: "<b>x</b>" })).toBeInTheDocument();
  });
});
