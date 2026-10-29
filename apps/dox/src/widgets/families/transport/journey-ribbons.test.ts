// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { html } from "../../builders/html";
import { renderHtml } from "../../test-fixture";
import {
  journeyLane,
  layer,
  noteChips,
  noteLeaders,
  pct,
  ribbonAxis,
  ribbonBadges,
  ribbonBars,
  ribbonBrackets,
  ribbonEmpty,
  ribbonLegend,
  type RibbonSegment,
} from "./journey-ribbons";

const SEGMENTS: RibbonSegment[] = [
  { kind: "moving", leg: 1, series: 1, fromMs: 0, toMs: 40 },
  { kind: "handling", leg: 1, series: 1, fromMs: 40, toMs: 50 },
  { kind: "moving", leg: 2, series: 2, fromMs: 50, toMs: 100 },
];
const NOTES = [{ hop: 1, center: 45, row: 0, text: "10 h of handling" }];

function drawn() {
  return renderHtml(
    html`${journeyLane({
      id: "track-a",
      label: "As it happens",
      name: "As it happens: leg 1 moving, then leg 2 moving.",
      variant: "happens",
      children: html`${layer("badges", "b", ribbonBadges(SEGMENTS, 100))}${layer("bars", "c", ribbonBars(SEGMENTS, 100))}${layer("leaders", "d", noteLeaders(NOTES))}${layer("notes", "e", noteChips(NOTES))}${layer("empty", "f", ribbonEmpty(""))}`,
    })}${ribbonAxis("axis", [
      { at: 0, label: "0 h" },
      { at: 100, label: "100 h" },
    ])}${ribbonLegend([
      { kind: "moving", text: "moving" },
      { kind: "handling", text: "handling" },
      { kind: "scheduled", text: "waiting for the scheduled departure" },
    ])}`,
  );
}

describe("pct", () => {
  it("is a share of the span to four places", () => {
    expect(pct(1, 3)).toBe(33.3333);
    expect(pct(50, 100)).toBe(50);
  });
});

describe("journeyLane", () => {
  it("is one named image whose marks are hidden from the tree", () => {
    drawn();
    const track = screen.getByRole("img", {
      name: "As it happens: leg 1 moving, then leg 2 moving.",
    });
    expect(track).toBeInTheDocument();
    expect(screen.getAllByRole("img")).toEqual([track]);
  });

  it("lists what each mark means", () => {
    drawn();
    const legend = screen.getByRole("list", { name: "Legend" });
    expect(within(legend).getAllByRole("listitem")).toHaveLength(3);
    expect(legend).toHaveTextContent("waiting for the scheduled departure");
  });

  it("says why a ribbon is empty", () => {
    const { host } = renderHtml(ribbonEmpty("No journey to draw."));
    expect(host).toHaveTextContent("No journey to draw.");
  });

  it("draws the two totals on the brackets", () => {
    const { host } = renderHtml(
      ribbonBrackets({
        movingEnd: 80,
        movingText: "moving · PT400H",
        waitingText: "waiting · PT84H",
      }),
    );
    expect(host).toHaveTextContent("moving · PT400H");
    expect(host).toHaveTextContent("waiting · PT84H");
  });

  it("has no axe violations", async () => {
    const { host } = drawn();
    await expectNoAxeViolations(host);
  });
});
