// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import type { DayCell } from "~/lib/dwell-ledger";
import { expectNoAxeViolations } from "~/test/render-widget";
import { html } from "../../builders/html";
import { renderHtml } from "../../test-fixture";
import { dayColumns } from "./day-columns";

const DAY = 86_400_000;
const T0 = 1_718_323_200_000;
const cell = (i: number, hours = 24): DayCell => ({
  date: `2024-06-${String(14 + i)}`,
  startMs: T0 + i * DAY,
  endMs: T0 + i * DAY + hours * 3_600_000,
  hours,
  touched: true,
});
const canvas = { toPercent: (ms: number) => ((ms - T0) / (3 * DAY)) * 100 };

const draw = (
  cells: DayCell[],
  states: Parameters<typeof dayColumns>[2] = {},
) =>
  renderHtml(
    html`<div role="list" aria-label="Days">${dayColumns(cells, canvas, states)}</div>`,
  );
const items = () =>
  within(screen.getByRole("list", { name: "Days" })).getAllByRole("listitem");

describe("dayColumns", () => {
  it("is one listitem a day, named by its date, weekday and state", () => {
    draw([cell(0), cell(1), cell(2)], {
      "2024-06-14": { state: "lit", chip: "free" },
      "2024-06-15": { state: "hatched", chip: "charged", tier: 2 },
    });
    expect(items().map((d) => d.getAttribute("aria-label"))).toEqual([
      "14 Jun Fri, free",
      "15 Jun Sat, tier 2, charged",
      "16 Jun Sun",
    ]);
  });

  it("uses the mark's aria wording over its chip", () => {
    draw([cell(0)], {
      "2024-06-14": {
        state: "closed",
        chip: "closed",
        aria: "closed, not counted",
      },
    });
    expect(items()[0]).toHaveAccessibleName("14 Jun Fri, closed, not counted");
  });

  it("names a day that is not 24 hours long", () => {
    draw([cell(0, 23)]);
    expect(items()[0]).toHaveAccessibleName("14 Jun Fri, 23 hours");
    expect(screen.getByText("23 h")).toBeInTheDocument();
  });

  it("draws nothing for a day outside the canvas", () => {
    draw([cell(0), { ...cell(1), startMs: T0 + DAY, endMs: T0 + DAY }]);
    expect(items()).toHaveLength(1);
  });

  it("escapes a mark's text", () => {
    draw([cell(0)], {
      "2024-06-14": { state: "lit", chip: "<b>x</b>", aria: "<b>x</b>" },
    });
    expect(screen.getByText("<b>x</b>")).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { host } = draw([cell(0), cell(1, 23)], {
      "2024-06-14": { state: "lit", chip: "free" },
    });
    await expectNoAxeViolations(host);
  });
});
