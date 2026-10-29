// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import {
  LADDER_NO_SIGNAL,
  emptyRead,
  ladderLayout,
  type ClockKey,
} from "~/lib/satellite-clock-converter";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import { clockLadder, clockLegend, type ClockLadderRow } from "./clock-ladder";

const layout = ladderLayout(emptyRead(), 0);

function row(
  key: ClockKey,
  over: Partial<ClockLadderRow> = {},
): ClockLadderRow {
  return {
    key,
    top: layout.tops[key],
    tie: null,
    tieText: "",
    chip: "",
    reading: "",
    yours: false,
    title: "",
    ...over,
  };
}

const base = {
  label: "Ladder of clocks",
  layout,
  sentences: [],
  lost: false,
  offReserve: 0,
};

describe("clockLadder", () => {
  it("is one named image holding every clock's row", () => {
    renderHtml(
      clockLadder({
        ...base,
        rows: [
          row("UTC", {
            tieText: "baseline",
            chip: "0 s",
            reading: "2024-01-01T00:00:00Z",
          }),
          row("TAI", { tieText: "top rail", chip: "37 s" }),
        ],
      }),
    );
    const figure = screen.getByRole("img", { name: "Ladder of clocks" });
    expect(figure).toHaveTextContent("UTC");
    expect(figure).toHaveTextContent("baseline");
    expect(figure).toHaveTextContent("37 s");
  });

  it("lists one sentence for each clock outside the image", () => {
    renderHtml(
      clockLadder({
        ...base,
        sentences: [
          "UTC: 2024-01-01T00:00:00Z",
          "TAI: 2024-01-01T00:00:37 TAI",
        ],
        rows: [row("UTC"), row("TAI")],
      }),
    );
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items.map((i) => i.textContent)).toEqual([
      "UTC: 2024-01-01T00:00:00Z",
      "TAI: 2024-01-01T00:00:37 TAI",
    ]);
  });

  it("puts a clock with no place on the scale in its own group, in words", () => {
    renderHtml(
      clockLadder({
        ...base,
        offReserve: 2,
        rows: [row("UTC"), row("GLO", { top: null, chip: "no result" })],
      }),
    );
    expect(screen.getByText("No place on the scale")).toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveTextContent("GLO");
  });

  it("keeps the amber NO SIGNAL slot in the document and shows it only when lost", () => {
    const { host } = renderHtml(
      clockLadder({ ...base, rows: [row("UTC")], lost: true }),
    );
    expect(screen.getByText(LADDER_NO_SIGNAL)).toBeVisible();
    renderHtml(clockLadder({ ...base, rows: [row("UTC")], lost: false }));
    expect(screen.getAllByText(LADDER_NO_SIGNAL)).toHaveLength(2);
    expect(host).toBeInTheDocument();
  });

  it("escapes a reading", () => {
    renderHtml(
      clockLadder({ ...base, rows: [row("UTC", { reading: "<b>x</b>" })] }),
    );
    expect(screen.getByText("<b>x</b>")).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { host } = renderHtml(
      clockLadder({
        ...base,
        sentences: ["UTC: now"],
        rows: [
          row("UTC", { chip: "0 s" }),
          row("TAI", { chip: "37 s", yours: true }),
        ],
      }),
    );
    await expectNoAxeViolations(host);
  });
});

describe("clockLegend", () => {
  it("says what the two outlines mean in words", () => {
    renderHtml(clockLegend());
    expect(screen.getByText(/^Tied to TAI/)).toBeInTheDocument();
    expect(screen.getByText(/^Follows UTC/)).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { host } = renderHtml(clockLegend());
    await expectNoAxeViolations(host);
  });
});
